import express from "express";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import fileUpload from "express-fileupload";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import cron from "node-cron";

import { initializeSocket } from "./lib/socket.js";
import { handleWebSocketFallback } from "./lib/websocket-fallback.js";

import { connectDB } from "./lib/db.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import authRoutes from "./routes/auth.route.js";
import songRoutes from "./routes/song.route.js";
import albumRoutes from "./routes/album.route.js";
import statRoutes from "./routes/stat.route.js";

dotenv.config();

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT;

const httpServer = createServer(app);

// 初始化Socket.IO
initializeSocket(httpServer);

app.use(
	cors({
		origin: process.env.NODE_ENV === "production" ? "https://music-frontend-rust.vercel.app" : "http://localhost:3000",
		credentials: true,
	})
);

app.use(express.json()); // to parse req.body
app.use(clerkMiddleware()); // this will add auth to req obj => req.auth
app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: path.join(__dirname, "tmp"),
		createParentPath: true,
		limits: {
			fileSize: 20 * 1024 * 1024, // 10MB  max file size
		},
	})
);

// cron jobs
const tempDir = path.join(process.cwd(), "tmp");
cron.schedule("0 * * * *", () => {
	if (fs.existsSync(tempDir)) {
		fs.readdir(tempDir, (err, files) => {
			if (err) {
				console.log("error", err);
				return;
			}
			for (const file of files) {
				fs.unlink(path.join(tempDir, file), (err) => {});
			}
		});
	}
});

app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/stats", statRoutes);

// error handler
app.use((err, req, res, next) => {
	console.log('报错', err.message);
	res.status(500).json({ message: process.env.NODE_ENV === "production" ? err.message : err.message });
});

// 在Vercel环境中，我们需要导出httpServer而不是app
// 因为Socket.IO需要HTTP服务器实例
let isConnected = false;

// 数据库连接
const connectDBOnce = async () => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
};

// 导出HTTP服务器而不是Express应用
export default async (req, res) => {
  await connectDBOnce();
  
  // 首先尝试WebSocket备用方案
  if (req.url.startsWith('/socket.io/') || req.url.startsWith('/api/websocket/')) {
    return handleWebSocketFallback(req, res);
  }
  
  // 在Vercel中，我们需要手动处理请求
  app(req, res);
};
