// effect.js
export function runSuccessEffect(scene, targetEl) {
  // 텍스트 색상을 500ms 동안 노란색으로 변경한 후 원래 색상으로 복원
  targetEl.setAttribute("material", { color: "#FFFF00" });
  setTimeout(() => {
    targetEl.setAttribute("material", { color: "#FFFFFF" });
  }, 500);

  const particleCount = 200;
  const particles = [];
  // 폭죽 효과 시작 위치 (main.js의 firework 위치와 동일)
  const center = { x: 1, y: 4, z: -1 };
  // 파티클 생성: 작은 구체 형태
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement("a-entity");
    particle.setAttribute("geometry", { primitive: "sphere", radius: 0.05 });
    const colors = ["#FFD700", "#FF4500"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.setAttribute("material", { color: color, opacity: 1, transparent: true });
    particle.setAttribute("position", `${center.x} ${center.y} ${center.z}`);
    scene.appendChild(particle);
    particles.push(particle);
  }

  // 각 파티클에 대해 랜덤한 방향과 속도를 할당
  const velocities = [];
  for (let i = 0; i < particleCount; i++) {
    const angle1 = Math.random() * 2 * Math.PI;
    const angle2 = Math.random() * Math.PI;
    const speed = Math.random() * 0.5 + 0.5; // 0.5 ~ 1.0 범위
    const vx = Math.cos(angle1) * Math.sin(angle2) * speed;
    const vy = Math.cos(angle2) * speed;
    const vz = Math.sin(angle1) * Math.sin(angle2) * speed;
    velocities.push({ vx, vy, vz });
  }

  // 1.5초 동안 파티클들이 퍼지며 점점 사라지는 애니메이션 실행
  const duration = 1500;
  const startTime = Date.now();
  function animateParticles() {
    const elapsed = Date.now() - startTime;
    const t = elapsed / duration;
    if (t > 1) {
      // 애니메이션 종료 후 파티클 제거
      particles.forEach(p => scene.removeChild(p));
      return;
    }
    for (let i = 0; i < particleCount; i++) {
      const newX = center.x + velocities[i].vx * t * 5;
      const newY = center.y + velocities[i].vy * t * 5;
      const newZ = center.z + velocities[i].vz * t * 5;
      particles[i].setAttribute("position", `${newX} ${newY} ${newZ}`);
      const newOpacity = 1 - t;
      particles[i].setAttribute("material", { opacity: newOpacity });
    }
    requestAnimationFrame(animateParticles);
  }
  animateParticles();
}
