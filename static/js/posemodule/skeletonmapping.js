import { r11, r6, r9, r5, r4, r3, r7, r10, r2, r1, r8 } from "./constants.js";

// 측정된 관절 좌표를 부모–자식 관계에 따라 재맵핑하는 함수
export function computeRemappedPositions(measuredPositions) {
  const kinMap = {
    0: { parent: null, length: 0 },   // face (코)
    7: { parent: null, length: 0 },   // left hip (특별 처리)
    8: { parent: null, length: 0 },   // right hip (특별 처리)
    1: { parent: 7, length: r6 },     // left shoulder (부모: left hip)
    9: { parent: 7, length: r9 },     // left knee (부모: left hip)
    3: { parent: 1, length: r5 },     // left elbow (부모: left shoulder)
    11: { parent: 9, length: r10 },   // left ankle (부모: left knee)
    5: { parent: 3, length: r4 },     // left wrist (부모: left elbow)
    2: { parent: 8, length: r3 },     // right shoulder (부모: right hip)
    10: { parent: 8, length: r7 },    // right knee (부모: right hip)
    4: { parent: 2, length: r2 },     // right elbow (부모: right shoulder)
    12: { parent: 10, length: r8 },   // right ankle (부모: right knee)
    6: { parent: 4, length: r1 }      // right wrist (부모: right elbow)
  };

  let remappedPositions = new Array(measuredPositions.length);

  // 1단계: 엉덩이(인덱스 7,8)를 먼저 처리
  let leftHipMeasured = measuredPositions[7];
  let rightHipMeasured = measuredPositions[8];
  if (!leftHipMeasured || !rightHipMeasured) {
    return measuredPositions;
  }
  let center = {
    x: (leftHipMeasured.x + rightHipMeasured.x) / 2,
    y: (leftHipMeasured.y + rightHipMeasured.y) / 2,
    z: (leftHipMeasured.z + rightHipMeasured.z) / 2
  };
  let dx = rightHipMeasured.x - leftHipMeasured.x;
  let dy = rightHipMeasured.y - leftHipMeasured.y;
  let dz = rightHipMeasured.z - leftHipMeasured.z;
  let dMag = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dMag < 1e-6) { dx = 1; dy = 0; dz = 0; dMag = 1; }
  let unit = { x: dx / dMag, y: dy / dMag, z: dz / dMag };
  remappedPositions[7] = {
    x: center.x - unit.x * r11,
    y: center.y - unit.y * r11,
    z: center.z - unit.z * r11
  };
  remappedPositions[8] = {
    x: center.x + unit.x * r11,
    y: center.y + unit.y * r11,
    z: center.z + unit.z * r11
  };

  // 2단계: 나머지 관절을 부모–자식 순서에 따라 처리
  let orderWithoutHips = Object.keys(kinMap)
    .filter(idx => idx !== "7" && idx !== "8")
    .map(Number);
  for (let i = 0; i < orderWithoutHips.length; i++) {
    let idx = orderWithoutHips[i];
    // 코(얼굴) 위치 조정: 인덱스 0인 경우 z 좌표에 오프셋 추가
    if (idx === 0) {
      remappedPositions[0] = {
        x: measuredPositions[0].x,
        y: measuredPositions[0].y,
        z: measuredPositions[0].z + 0.15 // 원하는 오프셋 값 (조정 가능)
      };
    } else if (!kinMap[idx] || kinMap[idx].parent === null) {
      remappedPositions[idx] = { ...measuredPositions[idx] };
    } else {
      let parentIdx = kinMap[idx].parent;
      let parentPos = remappedPositions[parentIdx] || measuredPositions[parentIdx];
      let measuredChild = measuredPositions[idx];
      let measuredParent = measuredPositions[parentIdx];
      let dx = measuredChild.x - measuredParent.x;
      let dy = measuredChild.y - measuredParent.y;
      let dz = measuredChild.z - measuredParent.z;
      let mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (mag < 1e-6) {
        remappedPositions[idx] = { x: parentPos.x, y: parentPos.y, z: parentPos.z };
      } else {
        let scale = kinMap[idx].length / mag;
        remappedPositions[idx] = {
          x: parentPos.x + dx * scale,
          y: parentPos.y + dy * scale,
          z: parentPos.z + dz * scale
        };
      }
    }
  }
  return remappedPositions;
}


/*
export function clampPositions(positions, previousPositions, maxStep = 0.15, smoothingFactor = 0.8) {
  // 이전 값이 없으면 그대로 반환
  if (!previousPositions) return positions;
  let clamped = [];
  for (let i = 0; i < positions.length; i++) {
    let current = positions[i];
    let prev = previousPositions[i] || { x: current.x, y: current.y, z: current.z };

    // 이전 위치와의 차이 벡터 계산
    let diff = {
      x: current.x - prev.x,
      y: current.y - prev.y,
      z: current.z - prev.z
    };
    // 차이 벡터의 크기 계산
    let mag = Math.sqrt(diff.x * diff.x + diff.y * diff.y + diff.z * diff.z);
    
    // 전체 이동 거리가 maxStep을 초과하면 비례적으로 축소
    if (mag > maxStep) {
      let scale = maxStep / mag;
      diff.x *= scale;
      diff.y *= scale;
      diff.z *= scale;
    }
    
    // 목표 위치 계산 (이전 위치에 클램핑된 차이를 더함)
    let target = {
      x: prev.x + diff.x,
      y: prev.y + diff.y,
      z: prev.z + diff.z
    };
    
    // 선형 보간을 사용해 이전 위치에서 목표 위치로 부드럽게 이동
    let newPos = {
      x: prev.x + (target.x - prev.x) * smoothingFactor,
      y: prev.y + (target.y - prev.y) * smoothingFactor,
      z: prev.z + (target.z - prev.z) * smoothingFactor,
    };
    
    clamped.push(newPos);
  }
  return clamped;
}
*/
