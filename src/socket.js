import { io } from "socket.io-client";

const URL = import.meta.env.PROD
  ? "https://your-render-app.onrender.com"
  : "http://localhost:3001";

export const socket = io(URL, { autoConnect: false });