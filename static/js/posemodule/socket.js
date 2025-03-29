// socket.js
export function initPoseWebSocket(onData) {
  const protocol = window.location.protocol === "https:" ? "wss://" : "ws://";
  const socketUrl = `${protocol}${window.location.host}/ws/pose_data/`;
  const socket = new WebSocket(socketUrl);

  socket.onopen = () => console.log("WebSocket connected!");
  socket.onerror = err => console.error("WebSocket Error:", err);
  socket.onclose = () => console.log("WebSocket closed.");

  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    console.log("🛰 Received from server:", data.pose);
    onData?.(data);
  };

  function sendPose(data) {
    const payload = JSON.stringify(data);
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    } else {
      socket.addEventListener("open", () => socket.send(payload), { once: true });
    }
  }

  return { socket, sendPose };
}
