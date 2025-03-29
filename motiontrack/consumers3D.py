import json
import time
import random
import numpy as np
import math
from itertools import combinations

from django.core.cache import cache
from channels.generic.websocket import WebsocketConsumer

# dnn.model_loader 안에 이미 model, scalers, label_encoder 등이 로드되어 있다고 가정
# (scalers는 더 이상 사용하지 않습니다.)
from dnn.model_loader import model, label_encoder

# 자세 후보 목록을 세 가지 (chair, tree, warrior)로 제한
POSES = ['chair', 'tree', 'warrior']
CACHE_TIMEOUT = None  # 무제한


def rotate_shoulder(landmarks: np.ndarray) -> np.ndarray:
    """
    학습 데이터 생성 시 적용했던 회전 보정 로직.
    왼쪽 어깨(인덱스 1), 오른쪽 어깨(인덱스 2)를 기준으로 회전하여 x축에 나란히 맞춰줌.
    landmarks는 (13,3) 배열을 가정.
    """
    # 왼쪽 어깨, 오른쪽 어깨
    left_shoulder = landmarks[1, :2]
    right_shoulder = landmarks[2, :2]

    # 회전 각도 계산
    dx = right_shoulder[0] - left_shoulder[0]
    dy = right_shoulder[1] - left_shoulder[1]
    theta = math.atan2(dy, dx)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    # x, y 좌표 회전
    for i in range(landmarks.shape[0]):
        x_orig, y_orig, z_orig = landmarks[i]
        x_new = x_orig * cos_t + y_orig * sin_t
        y_new = -x_orig * sin_t + y_orig * cos_t
        # z축은 회전에 영향받지 않으므로 그대로
        landmarks[i, 0] = x_new
        landmarks[i, 1] = y_new

    return landmarks


def compute_joint_angles(landmarks: np.ndarray, dim="3d") -> np.ndarray:
    """
    2D/3D 각도 계산 함수. 학습 때와 동일한 연결관계 사용.
    landmarks는 (13,3) 형태를 가정.
    """
    connections = {
        1: [0, 3, 7],
        2: [0, 4, 8],
        3: [1, 5],
        4: [2, 6],
        7: [1, 9],
        8: [2, 10],
        9: [7, 11],
        10: [8, 12]
    }
    angles = []
    for joint, neighbors in connections.items():
        # 2D면 landmarks[joint, :2], 3D면 landmarks[joint]
        center = landmarks[joint, :2] if dim == "2d" else landmarks[joint]
        for i, j in combinations(neighbors, 2):
            v1 = (landmarks[i, :2] if dim == "2d" else landmarks[i]) - center
            v2 = (landmarks[j, :2] if dim == "2d" else landmarks[j]) - center
            norm1 = np.linalg.norm(v1) + 1e-8
            norm2 = np.linalg.norm(v2) + 1e-8
            cosine = np.clip(np.dot(v1 / norm1, v2 / norm2), -1, 1)
            angles.append(np.arccos(cosine))
    return np.array(angles)


class PoseConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        # pose 게임 시작 시점 상태
        state = {
            "target_pose": random.choice(POSES),
            "start_time": None,
            "pose_buffer": []
        }
        cache.set(self.channel_name, state, timeout=CACHE_TIMEOUT)
        self.send(json.dumps({
            "target": state["target_pose"],
            "message": "Game started!"
        }))

    def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data or "{}")
        coords = data.get("coords", [])  # (13*3=39개 float 좌표)

        # 기존 state 불러오기
        state = cache.get(self.channel_name) or {
            "target_pose": random.choice(POSES),
            "start_time": None,
            "pose_buffer": []
        }

        try:
            # (13,3) 형태로 변환
            features = np.array(coords, dtype=float).reshape(13, 3)

            # -------------------------
            # 1) 어깨 회전 보정
            features = rotate_shoulder(features)
            # -------------------------

            # -------------------------
            # 2) 학습 시와 동일하게 63차원 피처 구성 후 예측
            #    - 좌표 39차원: 원본 flatten 값 사용
            #    - 2D 각도 12차원: compute_joint_angles(features, "2d")
            #    - 3D 각도 12차원: compute_joint_angles(features, "3d")
            # -------------------------
            coords_raw = features.flatten().reshape(1, -1)
            angles2d_raw = compute_joint_angles(features, "2d").reshape(1, -1)
            angles3d_raw = compute_joint_angles(features, "3d").reshape(1, -1)
            input_vec = np.concatenate([coords_raw, angles2d_raw, angles3d_raw], axis=1)

            pred_idx = np.argmax(model.predict(input_vec), axis=1)[0]
            pose_label = label_encoder.inverse_transform([pred_idx])[0]

            # -------------------------
            # 3) 5초 동안 target_pose를 유지했는지 체크
            # -------------------------
            now = time.time()
            if pose_label == state["target_pose"]:
                if state["start_time"] is None:
                    state["start_time"] = now
                    state["pose_buffer"] = []
                state["pose_buffer"].append(coords)

                # 5초가 지났다면
                if now - state["start_time"] >= 5:
                    new_target = random.choice([p for p in POSES if p != state["target_pose"]])
                    response = {
                        "pose": pose_label,
                        "target": state["target_pose"],
                        "effect": "success",
                        "message": "Held 5 seconds."
                    }
                    # 다음 타겟 초기화
                    state = {
                        "target_pose": new_target,
                        "start_time": None,
                        "pose_buffer": []
                    }
                    cache.set(self.channel_name, state, timeout=CACHE_TIMEOUT)
                    return self.send(json.dumps(response))

            else:
                # 틀렸으니 진행 리셋
                state = {
                    "target_pose": state["target_pose"],
                    "start_time": None,
                    "pose_buffer": []
                }

            # 변경된 state 다시 저장 후, 현재 추론 결과를 클라이언트로 전송
            cache.set(self.channel_name, state, timeout=CACHE_TIMEOUT)
            self.send(json.dumps({
                "pose": pose_label,
                "target": state["target_pose"]
            }))

        except Exception as e:
            # 오류 발생 시 에러 메시지 전송
            self.send(json.dumps({"error": str(e)}))

    def disconnect(self, close_code):
        # 연결 끊길 때 캐시 제거
        cache.delete(self.channel_name)
