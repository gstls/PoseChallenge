import json
import numpy as np
import math
import random
import time
from itertools import combinations
from channels.generic.websocket import WebsocketConsumer
from dnn.model_loader import model, scalers, label_encoder

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
    angles = []
    for joint, neighbors in connections.items():
        center = landmarks[joint, :2] if dim == "2d" else landmarks[joint]
        for (i, j) in combinations(neighbors, 2):
            v1 = landmarks[i, :2] - center if dim == "2d" else landmarks[i] - center
            v2 = landmarks[j, :2] - center if dim == "2d" else landmarks[j] - center
            norm1, norm2 = np.linalg.norm(v1)+1e-8, np.linalg.norm(v2)+1e-8
            cosine = np.clip(np.dot(v1/norm1, v2/norm2), -1, 1)
            angles.append(np.arccos(cosine))
    return np.array(angles)

class PoseConsumer(WebsocketConsumer):
    def connect(self):
        self.accept()
        poses = ['cobra', 'dog', 'tree', 'warrior', 'chair']
        self.state = {"target_pose": random.choice(poses), "start_time": None}
        self.send(json.dumps({"target": self.state["target_pose"], "message": "Game started!"}))

    def disconnect(self, close_code):
        pass

    def receive(self, text_data=None, bytes_data=None):
        data = json.loads(text_data or "{}")
        coords = data.get("coords", [])

        try:
            features = np.array(coords, dtype=float)
            if features.size != 39:
                raise ValueError(f"Expected 39 features, got {features.size}")
            features = features.reshape(13, 3)

            # 회전 보정
            left, right = features[1,:2], features[2,:2]
            theta = math.atan2(right[1]-left[1], right[0]-left[0])
            cos_t, sin_t = math.cos(theta), math.sin(theta)
            for i in range(13):
                x, y = features[i,0], features[i,1]
                features[i,0] = x*cos_t + y*sin_t
                features[i,1] = -x*sin_t + y*cos_t

            # 각도 계산 + 스케일링
            angles2d = compute_joint_angles(features, "2d")
            angles3d = compute_joint_angles(features, "3d")
            full = np.concatenate([
                scalers["coords"].transform(features.flatten().reshape(1,-1)),
                scalers["angles2d"].transform(angles2d.reshape(1,-1)),
                scalers["angles3d"].transform(angles3d.reshape(1,-1))
            ], axis=1)

            pred_idx = int(np.argmax(model.predict(full), axis=1)[0])
            pose_label = label_encoder.inverse_transform([pred_idx])[0]

            target = self.state["target_pose"]
            # 목표 자세 검사
            if pose_label == target:
                if self.state["start_time"] is None:
                    self.state["start_time"] = time.time()
                elif time.time() - self.state["start_time"] >= 5:
                    # 성공 → 새 목표
                    poses = ['cobra','dog','tree','warrior','chair']
                    new_target = random.choice([p for p in poses if p != target])
                    response = {
                        "pose": pose_label,
                        "target": target,
                        "effect": "success",
                        "message": "Success! Pose held for 5 seconds."
                    }
                    self.state = {"target_pose": new_target, "start_time": None}
                    self.send(json.dumps(response))
                    return
            else:
                self.state["start_time"] = None

            self.send(json.dumps({"pose": pose_label, "target": self.state["target_pose"]}))
        except Exception as e:
            self.send(json.dumps({"error": str(e)}))
