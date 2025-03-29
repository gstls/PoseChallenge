// main.js
import { initPoseWebSocket } from "./socket.js";
import { testSupport, onResults } from "./posehandler.js";
import { setupUIControls, getFollowMode } from "./uicontrols.js";
import { runSuccessEffect } from "./effect.js";  // 효과 모듈 임포트

let gameStartTime = Date.now();
let setCount = 0;

const { socket, sendPose } = initPoseWebSocket(data => {
  if (data.error) return console.error(data.error);
  const scene = document.querySelector("a-scene");

  // TARGET TEXT: 화면 상단에 현재 목표 자세 표시
  let targetEl = document.getElementById("targetText");
  if (!targetEl) {
    targetEl = document.createElement("a-entity");
    targetEl.id = "targetText";
    targetEl.setAttribute("position", "1 3 -3");
    scene.appendChild(targetEl);
  }
  targetEl.setAttribute("text-geometry", {
    value: data.target || "",
    font: "https://cdn.jsdelivr.net/npm/three@0.118.3/examples/fonts/helvetiker_regular.typeface.json",
    size: 0.7,
    height: 0.1
  });
  targetEl.setAttribute("material", { color: "#FFFFFF" });

  // POSE TEXT: 스켈레톤 옆에 현재 예측된 자세 표시
  let poseEl = document.getElementById("poseText");
  if (!poseEl) {
    poseEl = document.createElement("a-entity");
    poseEl.id = "poseText";
    scene.appendChild(poseEl);
  }
  if (data.pose) {
    poseEl.setAttribute("text-geometry", {
      value: data.pose,
      font: "https://cdn.jsdelivr.net/npm/three@0.118.3/examples/fonts/helvetiker_regular.typeface.json",
      size: 0.5,
      height: 0.1
    });
    const skelPos = document.getElementById("skeleton").getAttribute("position");
    poseEl.setAttribute("position", `${skelPos.x + 0.9} ${skelPos.y} ${skelPos.z}`);
    poseEl.setAttribute("material", {
      color: data.pose === data.target ? "#00FF00" : "#FF0000"
    });
  }

  // SUCCESS EFFECT: 성공 시 폭죽 효과 적용
  if (data.effect === "success") {
    runSuccessEffect(scene, targetEl);
    setCount++;
    if (setCount === 1) {
      const elapsedTime = (Date.now() - gameStartTime) / 1000;
      fetch("/submit_score/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": getCsrfToken()
        },
        body: JSON.stringify({ score: elapsedTime })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === "success" && data.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          console.error("점수 제출 오류:", data);
        }
      })
      .catch(error => console.error("점수 전송 오류:", error));
    }
  }
});

// CSRF 토큰 가져오기 (Django용)
function getCsrfToken() {
  const csrfToken = document.cookie.split(";").find(item => item.trim().startsWith("csrftoken="));
  return csrfToken ? csrfToken.split("=")[1] : "";
}

window.addEventListener('load', () => {
  gameStartTime = Date.now();
  setCount = 0;

  testSupport([{ client: 'Chrome' }]);
  setupUIControls();

  const videoElement = document.querySelector('.input_video');
  const canvasElement = document.querySelector('.output_canvas');
  const canvasCtx = canvasElement.getContext('2d');
  const controlsElement = document.querySelector('.control-panel');

  const fpsControl = new FPS();
  const spinner = document.querySelector('.loading');
  spinner.ontransitionend = () => spinner.style.display = 'none';

  const grid = new LandmarkGrid(document.querySelector('.landmark-grid-container'), {
    connectionColor: 0xCCCCCC,
    definedColors: [{ name: 'LEFT', value: 0xffa500 }, { name: 'RIGHT', value: 0x00ffff }],
    range: 2, fitToGrid: true, labelSuffix: 'm', landmarkSize: 2, numCellsPerAxis: 4, showHidden: false, centered: true
  });

  const PoseClass = window.mpPose?.Pose ?? window.Pose;
  if (!PoseClass) {
    console.error("Pose 클래스가 로드되지 않았습니다.");
    return;
  }

  const pose = new PoseClass({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635988162/${file}`
  });

  pose.onResults(results => {
    const followMode = getFollowMode();
    onResults(results, canvasCtx, canvasElement, fpsControl, grid, followMode);

    // 3D 추론을 위해 poseLandmarks의 x, y, z 좌표 사용
    if (results.poseLandmarks) {
      const indices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      const coords = indices.flatMap(i => {
        const lm = results.poseLandmarks[i];
        return [lm.x, lm.y, lm.z];
      });
      sendPose({ coords });
    }
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => await pose.send({ image: videoElement }),
    width: 1280,
    height: 720
  });
  camera.start();

  new ControlPanel(controlsElement, {
    selfieMode: true,
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    smoothSegmentation: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
    effect: 'background'
  })
  .add([
    new StaticText({ title: 'MediaPipe Pose' }),
    fpsControl,
    new Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new Slider({ title: 'Model Complexity', field: 'modelComplexity', discrete: ['Lite', 'Full', 'Heavy'] }),
    new Toggle({ title: 'Smooth Landmarks', field: 'smoothLandmarks' }),
    new Toggle({ title: 'Enable Segmentation', field: 'enableSegmentation' }),
    new Toggle({ title: 'Smooth Segmentation', field: 'smoothSegmentation' }),
    new Slider({ title: 'Min Detection Confidence', field: 'minDetectionConfidence', range: [0, 1], step: 0.01 }),
    new Slider({ title: 'Min Tracking Confidence', field: 'minTrackingConfidence', range: [0, 1], step: 0.01 }),
    new Slider({ title: 'Effect', field: 'effect', discrete: { background: 'Background', mask: 'Foreground' } })
  ])
  .on(config => {
    videoElement.classList.toggle('selfie', config.selfieMode);
    pose.setOptions(config);
  });
});
