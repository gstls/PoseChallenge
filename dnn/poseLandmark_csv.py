import os
import cv2
import mediapipe as mp
import pandas as pd
import numpy as np
import math
from itertools import combinations  # 각도 계산을 위해 추가

# 데이터 경로와 출력 CSV 파일 이름
data_dir = "data/train"
output_csv = "filtered_data.csv"

# 13개 관절 인덱스와 이름
landmark_indices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
landmark_names = {
    0: "Nose",
    11: "LeftShoulder",
    12: "RightShoulder",
    13: "LeftElbow",
    14: "RightElbow",
    15: "LeftWrist",
    16: "RightWrist",
    23: "LeftHip",
    24: "RightHip",
    25: "LeftKnee",
    26: "RightKnee",
    27: "LeftAnkle",
    28: "RightAnkle"
}

# 전처리 파라미터 (두번째 코드에서 사용한 torso_size_multiplier)
torso_size_multiplier = 2.5

mp_pose = mp.solutions.pose
# static_image_mode를 True로 사용하여 이미지 단위 처리, model_complexity=1 적용
pose = mp_pose.Pose(static_image_mode=True, model_complexity=1)

# compute_joint_angles 함수: 각 관절의 2D, 3D 각도 계산 (연결관계 기반)
def compute_joint_angles(landmarks, dim="3d"):
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

data_rows = []

# 각 클래스(라벨) 폴더에 대해 반복
for pose_label in os.listdir(data_dir):
    folder_path = os.path.join(data_dir, pose_label)
    if not os.path.isdir(folder_path):
        continue
    for file_name in os.listdir(folder_path):
        if not file_name.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        img_path = os.path.join(folder_path, file_name)
        image = cv2.imread(img_path)
        if image is None:
            print("이미지를 불러올 수 없습니다:", img_path)
            continue
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)
        if not results.pose_landmarks:
            print("Pose landmarks를 감지하지 못했습니다:", img_path)
            continue
        
        # 선택된 13개 관절에 대한 landmark 객체를 딕셔너리로 저장 (pose_landmarks 사용)
        landmarks = {}
        for idx in landmark_indices:
            lm = results.pose_landmarks.landmark[idx]
            landmarks[idx] = lm

        # 중심 좌표 계산: 왼쪽 엉덩이(23)와 오른쪽 엉덩이(24)의 평균
        left_hip = landmarks[23]
        right_hip = landmarks[24]
        center_x = (left_hip.x + right_hip.x) / 2.0
        center_y = (left_hip.y + right_hip.y) / 2.0

        # 어깨 좌표 계산: 왼쪽 어깨(11)와 오른쪽 어깨(12)의 평균
        left_shoulder = landmarks[11]
        right_shoulder = landmarks[12]
        shoulders_x = (left_shoulder.x + right_shoulder.x) / 2.0
        shoulders_y = (left_shoulder.y + right_shoulder.y) / 2.0

        # torso 크기 계산
        torso_size = math.sqrt((shoulders_x - center_x)**2 + (shoulders_y - center_y)**2)
        max_distance = torso_size * torso_size_multiplier

        # 선택한 13개 관절에 대해 중심으로부터의 최대 거리를 갱신
        for idx in landmark_indices:
            lm = landmarks[idx]
            distance = math.sqrt((lm.x - center_x)**2 + (lm.y - center_y)**2)
            if distance > max_distance:
                max_distance = distance

        # 정규화된 좌표 계산: (x - center_x) / max_distance, (y - center_y) / max_distance, z / max_distance
        norm_coords = []
        for idx in landmark_indices:
            lm = landmarks[idx]
            norm_x = (lm.x - center_x) / max_distance
            norm_y = (lm.y - center_y) / max_distance
            norm_z = lm.z / max_distance  # z는 중심 보정 없이 정규화
            norm_coords.extend([norm_x, norm_y, norm_z])
        
        # 정규화된 좌표를 (13, 3) numpy array로 변환
        norm_landmarks = np.array(norm_coords).reshape(-1, 3)
        # 2D, 3D 각도 계산 (각도는 연결관계 기반으로 계산됨)
        angles_2d = compute_joint_angles(norm_landmarks, dim="2d").tolist()
        angles_3d = compute_joint_angles(norm_landmarks, dim="3d").tolist()

        # 좌표 + 각도 + 라벨 결합
        row = norm_coords + angles_2d + angles_3d + [pose_label]
        data_rows.append(row)
        print(f"Processed: {img_path}")

pose.close()

# CSV 헤더 구성: 13개 관절 x 3 좌표 (총 39개) + 각도 피처 (2D 12개, 3D 12개) + label
header = []
for idx in landmark_indices:
    name = landmark_names[idx]
    header.extend([f"{name}_x", f"{name}_y", f"{name}_z"])

# 각도 피처: 연결관계 기반 (2D, 3D 각각 12개)
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
for dim in ["2d", "3d"]:
    for joint, neighbors in connections.items():
        for (i, j) in combinations(neighbors, 2):
            header.append(f"angle_{dim}_{joint}_{i}_{j}")
header.append("label")

df = pd.DataFrame(data_rows, columns=header)
df.to_csv(output_csv, index=False)
print(f"CSV 파일 저장 완료: {output_csv} (행: {len(df)}, 열: {len(df.columns)})")  