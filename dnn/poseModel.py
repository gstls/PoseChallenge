import pandas as pd
import numpy as np
import math
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.regularizers import l2
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils import class_weight
import pickle

# CSV 파일 ("filtered_data.csv")에서 데이터 로드
data = pd.read_csv("filtered_data.csv")

if 'label' in data.columns:
    feature_cols = [col for col in data.columns if col != 'label']
    X = data[feature_cols].values
    y = data['label'].values
else:
    X = data.iloc[:, :-1].values
    y = data.iloc[:, -1].values

# X의 shape는 (num_samples, 63)
num_samples = X.shape[0]
input_dim = X.shape[1]  # 63

# 세 그룹으로 분리: 좌표(앞 39), 2D 각도(다음 12), 3D 각도(마지막 12)
# (정규화 제거: 원본 X 데이터를 그대로 사용합니다.)
X_coords = X[:, :39]
X_angles2d = X[:, 39:51]
X_angles3d = X[:, 51:63]

# 정규화 없이 결합 (또는 단순히 원본 X 사용)
X_combined = np.concatenate([X_coords, X_angles2d, X_angles3d], axis=1)
# 또는 X_combined = X 와 같이 사용할 수도 있습니다.

# 레이블 인코딩
le = LabelEncoder()
y_encoded = le.fit_transform(y)
y_categorical = to_categorical(y_encoded)

# 학습/검증 데이터 분리
X_train, X_val, y_train, y_val, y_train_labels, y_val_labels = train_test_split(
    X_combined, y_categorical, y_encoded, test_size=0.2, random_state=42
)

# 클래스 불균형 처리를 위한 클래스 가중치 계산
weights = class_weight.compute_class_weight(
    class_weight='balanced',
    classes=np.unique(y_train_labels),
    y=y_train_labels
)
class_weights = dict(enumerate(weights))
print("계산된 클래스 가중치:", class_weights)

# 모델 구성: 과적합을 완화하기 위해 Dense 레이어 수와 뉴런 수를 약간 줄이고, L2 정규화를 추가합니다.
model = Sequential()
model.add(Dense(32, activation='relu', kernel_regularizer=l2(0.001), input_shape=(input_dim,)))
model.add(BatchNormalization())
model.add(Dropout(0.4))
model.add(Dense(16, activation='relu', kernel_regularizer=l2(0.001)))
model.add(BatchNormalization())
model.add(Dropout(0.4))
model.add(Dense(8, activation='relu', kernel_regularizer=l2(0.001)))
model.add(BatchNormalization())
model.add(Dense(y_categorical.shape[1], activation='softmax'))

model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# 조기 종료 콜백 (val_loss가 5 에포크 동안 개선되지 않으면 중단)
early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)

model.fit(X_train, y_train, validation_data=(X_val, y_val),
          epochs=50, batch_size=32, class_weight=class_weights,
          callbacks=[early_stop])

# 모델 및 레이블 인코더 저장
model.save("pose_model.h5")
with open("label_encoder.pkl", "wb") as f:
    pickle.dump(le, f)

print("학습 및 저장 완료!")
