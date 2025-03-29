import json
import time
import random
import numpy as np
import math
from itertools import combinations
from channels.generic.websocket import WebsocketConsumer

from dnn.model_loader import model, label_encoder

# 자세 후보 목록 (예: chair, tree, warrior, dog)
POSES = ['chair', 'tree', 'warrior', 'dog']
ALPHA = 0.5  # 지수 평활법의 smoothing factor (0과 1 사이의 값)

class PoseConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        # 지수 평활을 위한 smoothed_pred 변수 초기화 (없으면 첫 프레임의 값 사용)
        self.smoothed_pred = None
        # 각 연결마다 상태를 self.state에 저장 (인메모리 방식)
        self.state = {
            "target_pose": random.choice(POSES),
            "start_time": None,
            "pose_buffer": []
        }
        self.send(json.dumps({
            "target": self.state["target_pose"],
            "message": "Game started!"
        }))

    def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data or "{}")
        # 클라이언트는 13개 관절의 x, y, z 좌표 총 39개 값의 리스트를 전송해야 합니다.
        coords = data.get("coords", [])
        try:
            if len(coords) != 39:
                raise ValueError("좌표 길이가 올바르지 않습니다. 39개의 값이 필요합니다.")
            # (13, 3) 배열로 변환
            landmarks = np.array(coords, dtype=float).reshape(13, 3)
            # 학습 시와 동일한 정규화 수행 → 39차원 벡터
            normalized = self.normalize_landmarks(landmarks)
            # 각도 계산을 위해 (13, 3) 배열로 재구성
            norm_landmarks = normalized.reshape(13, 3)
            # 2D, 3D 각도 피처 계산 (각각 12개)
            angles_2d = self.compute_joint_angles(norm_landmarks, dim="2d").tolist()
            angles_3d = self.compute_joint_angles(norm_landmarks, dim="3d").tolist()
            # 전체 입력 특징: 정규화 좌표 (39) + 2D 각도 (12) + 3D 각도 (12) → 총 63차원
            input_features = np.concatenate([normalized, angles_2d, angles_3d]).reshape(1, -1)

            # 모델 예측 (softmax 확률 벡터)
            pred_probs = model.predict(input_features)[0]
            # 지수 평활법 적용: 첫 프레임이면 그대로, 이후에는 이전 평활값과 혼합
            if self.smoothed_pred is None:
                self.smoothed_pred = pred_probs
            else:
                self.smoothed_pred = ALPHA * pred_probs + (1 - ALPHA) * self.smoothed_pred

            pred_idx = np.argmax(self.smoothed_pred)
            pose_label = label_encoder.inverse_transform([pred_idx])[0]

            now = time.time()
            if pose_label == self.state["target_pose"]:
                if self.state["start_time"] is None:
                    self.state["start_time"] = now
                    self.state["pose_buffer"] = []
                self.state["pose_buffer"].append(coords)
                if now - self.state["start_time"] >= 5:
                    new_target = random.choice([p for p in POSES if p != self.state["target_pose"]])
                    response = {
                        "pose": pose_label,
                        "target": self.state["target_pose"],
                        "effect": "success",
                        "message": "5초 이상 유지되었습니다."
                    }
                    self.state = {
                        "target_pose": new_target,
                        "start_time": None,
                        "pose_buffer": []
                    }
                    self.send(json.dumps(response))
                    return
            else:
                self.state = {
                    "target_pose": self.state["target_pose"],
                    "start_time": None,
                    "pose_buffer": []
                }
            self.send(json.dumps({
                "pose": pose_label,
                "target": self.state["target_pose"]
            }))
        except Exception as e:
            self.send(json.dumps({"error": str(e)}))

    def disconnect(self, close_code):
        # 연결이 종료될 때 별도의 캐시 삭제 작업이 필요 없습니다.
        pass

    def normalize_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """
        13개 관절(각각 3D 좌표)을 학습 시 전처리와 동일하게 정규화합니다.
        landmark 순서는 [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]이며,
        정규화는 좌표 중심(왼쪽/오른쪽 엉덩이 평균)과 torso 크기를 기준으로 진행됩니다.
        """
        torso_size_multiplier = 2.5
        # 중심: 왼쪽 엉덩이(인덱스 7)와 오른쪽 엉덩이(인덱스 8)의 평균 (x, y만 사용)
        center = (landmarks[7, :2] + landmarks[8, :2]) / 2.0
        # 어깨: 왼쪽 어깨(인덱스 1)와 오른쪽 어깨(인덱스 2)의 평균
        shoulders = (landmarks[1, :2] + landmarks[2, :2]) / 2.0
        torso_size = np.linalg.norm(shoulders - center)
        max_distance = torso_size * torso_size_multiplier
        for lm in landmarks:
            dist = np.linalg.norm(lm[:2] - center)
            if dist > max_distance:
                max_distance = dist
        norm_landmarks = []
        for lm in landmarks:
            norm_x = (lm[0] - center[0]) / max_distance
            norm_y = (lm[1] - center[1]) / max_distance
            norm_z = lm[2] / max_distance
            norm_landmarks.extend([norm_x, norm_y, norm_z])
        return np.array(norm_landmarks)

    def compute_joint_angles(self, landmarks: np.ndarray, dim="3d") -> np.ndarray:
        """
        연결 관계 기반으로 2D 혹은 3D 각도를 계산합니다.
        dim="2d"인 경우 x, y 좌표만 사용하며, 그렇지 않으면 3D 좌표 전체를 사용합니다.
        연결 관계는 학습 코드와 동일하게 아래와 같이 정의됩니다.
          1: [0, 3, 7],
          2: [0, 4, 8],
          3: [1, 5],
          4: [2, 6],
          7: [1, 9],
          8: [2, 10],
          9: [7, 11],
          10: [8, 12]
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
        angle_list = []
        for joint, neighbors in connections.items():
            if dim == "2d":
                center = landmarks[joint, :2]
            else:
                center = landmarks[joint]
            for (i, j) in combinations(neighbors, 2):
                if dim == "2d":
                    v1 = landmarks[i, :2] - center
                    v2 = landmarks[j, :2] - center
                else:
                    v1 = landmarks[i] - center
                    v2 = landmarks[j] - center
                norm1 = np.linalg.norm(v1) + 1e-8
                norm2 = np.linalg.norm(v2) + 1e-8
                v1_norm = v1 / norm1
                v2_norm = v2 / norm2
                cosine = np.clip(np.dot(v1_norm, v2_norm), -1, 1)
                angle = np.arccos(cosine)
                angle_list.append(angle)
        return np.array(angle_list)
