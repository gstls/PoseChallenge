// Follow 모드 및 키보드 이벤트 제어
let followMode = false;

export function getFollowMode() {
  return followMode;
}

export function setupUIControls() {
  const toggleFollowBtn = document.getElementById('toggleFollow');
  const userCamera = document.getElementById('userCamera');

  toggleFollowBtn.addEventListener('click', function() {
    followMode = !followMode;
    this.textContent = "Follow Skeleton: " + (followMode ? "ON" : "OFF");
    if (userCamera) {
      if (followMode) {
        userCamera.setAttribute('wasd-controls', 'enabled', 'false');
      } else {
        userCamera.setAttribute('wasd-controls', 'enabled', 'true');
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!followMode && userCamera) {
      let pos = userCamera.getAttribute('position');
      if (event.key === 'q' || event.key === 'Q') {
        pos.y += 0.1;
      } else if (event.key === 'e' || event.key === 'E') {
        pos.y -= 0.1;
      }
      userCamera.setAttribute('position', pos);
    }
  });
}
