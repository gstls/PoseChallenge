import { matIdentity, matAdd, matMult, matTranspose, matScalarMultiply, vecAdd, vecSubtract, matVecMult, matInverse, numericalJacobian } from "./mathutils.js";
import { r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, order } from "./constants.js";

// EKF 상태전이 방정식 (프로젝션, 스무딩)

// (x, y) 좌표를 구의 표면에 투영하는 함수
export function projectToSphere(x, y, centerX, centerY, r) {
  let dx = x - centerX, dy = y - centerY;
  let distSq = dx * dx + dy * dy;
  if (distSq > r * r) {
    let dist = Math.sqrt(distSq);
    let scale = r / dist;
    x = centerX + dx * scale;
    y = centerY + dy * scale;
  }
  return [x, y];
}

// 스무딩 전환 함수 (최대 변화량 maxStep 적용)
export function smoothTransition(currentValue, deltaSq, refValue, jointValue, maxStep = 0.05) {
  if (deltaSq < 0) return refValue;
  let predictedValue = refValue + Math.sign(jointValue - refValue) * Math.sqrt(deltaSq);
  let distanceRatio = deltaSq > 0 ? Math.abs(refValue) / Math.sqrt(deltaSq) : 0;
  let alpha = (distanceRatio > 0.75) ? 0.01 : (distanceRatio <= 0.25 ? 0.3 : 0.05);
  let newValue = alpha * currentValue + (1 - alpha) * predictedValue;
  let diff = newValue - currentValue;
  if (diff > maxStep) diff = maxStep;
  else if (diff < -maxStep) diff = -maxStep;
  return currentValue + diff;
}

// 현재 측정값을 담을 전역 변수 (poseHandler에서 설정)
export let CURRENT_MEAS = {
  joints: null,      // 각 관절의 [x, y, raw z]
  ref_joints: null   // 각 관절의 raw z 값 배열
};

// 상태 전이 함수 (EKF용)
export function fx(state, dt) {
  let newState = state.slice();
  for (let k = 0; k < order.length; k++) {
    let i = order[k];
    let rawZ = CURRENT_MEAS.joints[i][2];
    let oldZ = newState[i];
    let refZValue = CURRENT_MEAS.ref_joints[i];
    let cx = CURRENT_MEAS.joints[i][0], cy = CURRENT_MEAS.joints[i][1];
    let parentIdx, radius, px, py;
    if (i === 0) { // face
      parentIdx = null; radius = r11; px = 0; py = 0;
    } else if (i === 7) { // left hip (특별 처리)
      parentIdx = null; radius = r11; px = 0; py = 0;
    } else if (i === 8) { // right hip (특별 처리)
      parentIdx = null; radius = r11; px = 0; py = 0;
    } else if (i === 1) { // left shoulder (부모: left hip, index 7)
      parentIdx = 7; radius = r6; px = CURRENT_MEAS.joints[7][0]; py = CURRENT_MEAS.joints[7][1];
    } else if (i === 9) { // left knee (부모: left hip, index 7)
      parentIdx = 7; radius = r9; px = CURRENT_MEAS.joints[7][0]; py = CURRENT_MEAS.joints[7][1];
    } else if (i === 3) { // left elbow (부모: left shoulder, index 1)
      parentIdx = 1; radius = r5; px = CURRENT_MEAS.joints[1][0]; py = CURRENT_MEAS.joints[1][1];
    } else if (i === 11) { // left ankle (부모: left knee, index 9)
      parentIdx = 9; radius = r10; px = CURRENT_MEAS.joints[9][0]; py = CURRENT_MEAS.joints[9][1];
    } else if (i === 5) { // left wrist (부모: left elbow, index 3)
      parentIdx = 3; radius = r4; px = CURRENT_MEAS.joints[3][0]; py = CURRENT_MEAS.joints[3][1];
    } else if (i === 2) { // right shoulder (부모: right hip, index 8)
      parentIdx = 8; radius = r3; px = CURRENT_MEAS.joints[8][0]; py = CURRENT_MEAS.joints[8][1];
    } else if (i === 10) { // right knee (부모: right hip, index 8)
      parentIdx = 8; radius = r7; px = CURRENT_MEAS.joints[8][0]; py = CURRENT_MEAS.joints[8][1];
    } else if (i === 4) { // right elbow (부모: right shoulder, index 2)
      parentIdx = 2; radius = r2; px = CURRENT_MEAS.joints[2][0]; py = CURRENT_MEAS.joints[2][1];
    } else if (i === 12) { // right ankle (부모: right knee, index 10)
      parentIdx = 10; radius = r8; px = CURRENT_MEAS.joints[10][0]; py = CURRENT_MEAS.joints[10][1];
    } else if (i === 6) { // right wrist (부모: right elbow, index 4)
      parentIdx = 4; radius = r1; px = CURRENT_MEAS.joints[4][0]; py = CURRENT_MEAS.joints[4][1];
    } else {
      parentIdx = null; radius = 0; px = 0; py = 0;
    }
    let proj = projectToSphere(cx, cy, (parentIdx === null ? 0 : px), (parentIdx === null ? 0 : py), radius);
    let deltaSq, targetZ;
    if (parentIdx === null) {
      deltaSq = radius * radius - (proj[0] * proj[0] + proj[1] * proj[1]);
      let safeDeltaSq = Math.max(deltaSq, 0);
      newState[i] = smoothTransition(oldZ, safeDeltaSq, refZValue, rawZ, 0.05);
    } else {
      let dx = proj[0] - px, dy = proj[1] - py;
      deltaSq = radius * radius - (dx * dx + dy * dy);
      let safeDeltaSq = Math.max(deltaSq, 0);
      let parentZ = newState[parentIdx];
      newState[i] = smoothTransition(oldZ, safeDeltaSq, parentZ, rawZ, 0.05);
    }
  }
  return newState;
}

// 측정 함수 hx(x) = x
export function hx(x) {
  return x.slice();
}

export class ExtendedKalmanFilter {
  constructor(dim_x, dim_z) {
    this.dim_x = dim_x;
    this.dim_z = dim_z;
    this.x = new Array(dim_x).fill(0);
    this.P = matIdentity(dim_x);
    this.Q = matIdentity(dim_x);
    this.R = matScalarMultiply(matIdentity(dim_z), 0.1);
  }
  predict(dt = 1.0) {
    this.x = fx(this.x, dt);
    let F = numericalJacobian(fx, this.x, dt);
    let Ft = matTranspose(F);
    this.P = matAdd(matMult(matMult(F, this.P), Ft), this.Q);
  }
  update(z) {
    let hx_val = hx(this.x);
    let y = vecSubtract(z, hx_val);
    let S = matAdd(this.P, this.R);
    let S_inv = matInverse(S);
    let K = matMult(this.P, S_inv);
    this.x = vecAdd(this.x, matVecMult(K, y));
    let I = matIdentity(this.dim_x);
    let IK = [];
    for (let i = 0; i < I.length; i++) {
      IK[i] = [];
      for (let j = 0; j < I[0].length; j++) {
        IK[i][j] = I[i][j] - K[i][j];
      }
    }
    this.P = matMult(IK, this.P);
  }
}
