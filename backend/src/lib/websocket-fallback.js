// WebSocket备用方案 - 用于Vercel环境
// 由于Vercel的无服务器架构限制，Socket.IO可能无法正常工作
// 这个文件提供了一个基于HTTP轮询的备用方案

import { Message } from "../models/message.model.js";

// 内存存储（在生产环境中应该使用Redis）
const userConnections = new Map(); // { userId: { lastSeen, activity } }
const messages = new Map(); // { conversationId: [messages] }

export const handleWebSocketFallback = (req, res) => {
  const { method, url } = req;
  
  // 处理Socket.IO握手请求
  if (url.startsWith('/socket.io/')) {
    return handleSocketIORequest(req, res);
  }
  
  // 处理用户连接
  if (url === '/api/websocket/connect' && method === 'POST') {
    return handleUserConnect(req, res);
  }
  
  // 处理用户断开连接
  if (url === '/api/websocket/disconnect' && method === 'POST') {
    return handleUserDisconnect(req, res);
  }
  
  // 处理活动更新
  if (url === '/api/websocket/activity' && method === 'POST') {
    return handleActivityUpdate(req, res);
  }
  
  // 处理消息发送
  if (url === '/api/websocket/message' && method === 'POST') {
    return handleMessageSend(req, res);
  }
  
  // 处理在线用户获取
  if (url === '/api/websocket/users' && method === 'GET') {
    return handleGetOnlineUsers(req, res);
  }
  
  res.status(404).json({ message: 'WebSocket endpoint not found' });
};

const handleSocketIORequest = (req, res) => {
  // 模拟Socket.IO握手响应
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' ? "https://music-frontend-rust.vercel.app" : "http://localhost:3000");
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  res.json({
    sid: 'fallback-session-' + Date.now(),
    upgrades: [],
    pingInterval: 25000,
    pingTimeout: 60000
  });
};

const handleUserConnect = async (req, res) => {
  try {
    const { userId } = req.body;
    
    userConnections.set(userId, {
      lastSeen: Date.now(),
      activity: 'Idle'
    });
    
    res.json({ 
      success: true, 
      onlineUsers: Array.from(userConnections.keys()),
      activities: Array.from(userConnections.entries())
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const handleUserDisconnect = async (req, res) => {
  try {
    const { userId } = req.body;
    
    userConnections.delete(userId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const handleActivityUpdate = async (req, res) => {
  try {
    const { userId, activity } = req.body;
    
    if (userConnections.has(userId)) {
      userConnections.set(userId, {
        ...userConnections.get(userId),
        activity,
        lastSeen: Date.now()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const handleMessageSend = async (req, res) => {
  try {
    const { senderId, receiverId, content } = req.body;
    
    const message = await Message.create({
      senderId,
      receiverId,
      content,
    });
    
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const handleGetOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = Array.from(userConnections.keys());
    const activities = Array.from(userConnections.entries());
    
    res.json({ onlineUsers, activities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
