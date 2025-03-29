//선형 보간 및 확장 칼만 필터 행렬/벡터 연산 함수
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function matIdentity(n) {
  let I = [];
  for (let i = 0; i < n; i++) {
    I[i] = [];
    for (let j = 0; j < n; j++) {
      I[i][j] = (i === j) ? 1 : 0;
    }
  }
  return I;
}

export function matAdd(A, B) {
  let m = A.length, n = A[0].length;
  let C = [];
  for (let i = 0; i < m; i++) {
    C[i] = [];
    for (let j = 0; j < n; j++) {
      C[i][j] = A[i][j] + B[i][j];
    }
  }
  return C;
}

export function matMult(A, B) {
  let m = A.length, n = A[0].length, p = B[0].length;
  let C = [];
  for (let i = 0; i < m; i++) {
    C[i] = [];
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

export function matTranspose(A) {
  let m = A.length, n = A[0].length;
  let T = [];
  for (let i = 0; i < n; i++) {
    T[i] = [];
    for (let j = 0; j < m; j++) {
      T[i][j] = A[j][i];
    }
  }
  return T;
}

export function matScalarMultiply(A, scalar) {
  let m = A.length, n = A[0].length;
  let C = [];
  for (let i = 0; i < m; i++) {
    C[i] = [];
    for (let j = 0; j < n; j++) {
      C[i][j] = A[i][j] * scalar;
    }
  }
  return C;
}

export function vecAdd(a, b) {
  return a.map((val, i) => val + b[i]);
}

export function vecSubtract(a, b) {
  return a.map((val, i) => val - b[i]);
}

export function matVecMult(M, v) {
  let m = M.length;
  let result = new Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    let sum = 0;
    for (let j = 0; j < v.length; j++) {
      sum += M[i][j] * v[j];
    }
    result[i] = sum;
  }
  return result;
}

export function matInverse(A) {
  let n = A.length;
  let I = matIdentity(n);
  let M = [];
  for (let i = 0; i < n; i++) {
    M[i] = A[i].slice();
  }
  for (let i = 0; i < n; i++) {
    M[i] = M[i].concat(I[i]);
  }
  for (let i = 0; i < n; i++) {
    let pivot = M[i][i];
    if (Math.abs(pivot) < 1e-10) {
      let swapRow = i + 1;
      while (swapRow < n && Math.abs(M[swapRow][i]) < 1e-10) {
        swapRow++;
      }
      if (swapRow === n) {
        throw new Error("Matrix is singular and cannot be inverted");
      }
      let temp = M[i];
      M[i] = M[swapRow];
      M[swapRow] = temp;
      pivot = M[i][i];
    }
    for (let j = 0; j < 2 * n; j++) {
      M[i][j] /= pivot;
    }
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        let factor = M[k][i];
        for (let j = 0; j < 2 * n; j++) {
          M[k][j] -= factor * M[i][j];
        }
      }
    }
  }
  let inv = [];
  for (let i = 0; i < n; i++) {
    inv[i] = M[i].slice(n, 2 * n);
  }
  return inv;
}

export function numericalJacobian(f, x, dt, epsilon = 1e-5) {
  let f0 = f(x, dt);
  let m = f0.length;
  let n = x.length;
  let J = [];
  for (let i = 0; i < m; i++) {
    J[i] = new Array(n).fill(0);
  }
  for (let j = 0; j < n; j++) {
    let x1 = x.slice();
    x1[j] += epsilon;
    let f1 = f(x1, dt);
    for (let i = 0; i < m; i++) {
      J[i][j] = (f1[i] - f0[i]) / epsilon;
    }
  }
  return J;
}
