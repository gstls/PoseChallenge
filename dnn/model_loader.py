import os
import pickle
from django.conf import settings
from tensorflow.keras.models import load_model

# ─── 모델 및 레이블 인코더 경로 설정 ─────────────────────────────
MODEL_DIR = os.path.join(settings.BASE_DIR, "dnn", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "pose_model.h5")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")

# 파일 존재 여부 확인
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"모델 파일을 찾을 수 없습니다: {MODEL_PATH}")
if not os.path.exists(LABEL_ENCODER_PATH):
    raise FileNotFoundError(f"레이블 인코더 파일을 찾을 수 없습니다: {LABEL_ENCODER_PATH}")

# GCN 관련 custom_objects 제거하고 모델 로드
model = load_model(MODEL_PATH)

with open(LABEL_ENCODER_PATH, "rb") as f:
    label_encoder = pickle.load(f)
