// 관절 길이 및 내부 매핑 상수들
export const r1  = 0.19;  // 오른쪽 손 → 오른쪽 팔꿈치
export const r2  = 0.21;  // 오른쪽 팔꿈치 → 오른쪽 어깨
export const r3  = 0.53;  // 오른쪽 어깨 → 오른쪽 허리
export const r4  = 0.19;  // 왼쪽 손 → 왼쪽 팔꿈치
export const r5  = 0.21;  // 왼쪽 팔꿈치 → 왼쪽 어깨
export const r6  = 0.53;  // 왼쪽 어깨 → 왼쪽 허리
export const r7  = 0.40;  // 오른쪽 허리 → 오른쪽 무릎
export const r8  = 0.32;  // 오른쪽 무릎 → 오른쪽 발
export const r9  = 0.40;  // 왼쪽 허리 → 왼쪽 무릎
export const r10 = 0.32;  // 왼쪽 무릎 → 왼쪽 발
export const r11 = 0.11;  // (허리 반쪽) → 엉덩이에서 중심까지의 거리


// 내부 관절 인덱스와 Mediapipe landmark 인덱스 매핑 (총 13개)
// 내부 인덱스:  
// 0: face, 1: left shoulder, 2: right shoulder, 3: left elbow, 4: right elbow,
// 5: left wrist, 6: right wrist, 7: left hip, 8: right hip, 9: left knee, 
// 10: right knee, 11: left ankle, 12: right ankle

export const mapping = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// 부모-자식 보정 순서 (내부 인덱스 기준)

export const order = [0, 7, 8, 1, 9, 3, 11, 5, 2, 10, 4, 12, 6];

// 연결선 (내부 인덱스 기준)

export const connectionsInternal = [
  [6, 4],
  [4, 2],
  [2, 1],
  [1, 3],
  [3, 5],
  [2, 8],
  [1, 7],
  [8, 7],
  [8, 10],
  [7, 9],
  [10, 12],
  [9, 11]
];
