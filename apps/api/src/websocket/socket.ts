import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { redis } from "../utils/redis";

let io: Server;

export function setupWebSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => {
        if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);
        if (origin === process.env.WEB_URL) return callback(null, true);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join a PR room to receive live comments
    socket.on("join:pr", (pullRequestId: string) => {
      socket.join(`pr:${pullRequestId}`);
      console.log(`${socket.data.userId} joined pr:${pullRequestId}`);
    });

    socket.on("leave:pr", (pullRequestId: string) => {
      socket.leave(`pr:${pullRequestId}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Redis subscriber for cross-process broadcasting
  const subscriber = redis.duplicate();
  subscriber.subscribe("comments", (err) => {
    if (err) console.error("Redis subscribe error:", err);
  });

  subscriber.on("message", (_channel, message) => {
    const data = JSON.parse(message);
    io.to(`pr:${data.pullRequestId}`).emit("comment:new", data);
  });

  console.log("WebSocket server ready");
  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}
