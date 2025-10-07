// WebSocket备用客户端 - 用于Vercel环境
// 当Socket.IO无法正常工作时，使用HTTP轮询作为备用方案

import { axiosInstance } from "./axios";

interface WebSocketFallback {
  connect: (userId: string) => Promise<void>;
  disconnect: (userId: string) => Promise<void>;
  updateActivity: (userId: string, activity: string) => Promise<void>;
  sendMessage: (senderId: string, receiverId: string, content: string) => Promise<any>;
  getOnlineUsers: () => Promise<{ onlineUsers: string[], activities: [string, string][] }>;
}

class WebSocketFallbackClient implements WebSocketFallback {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isConnected = false;
  private userId: string = '';

  async connect(userId: string): Promise<void> {
    this.userId = userId;
    
    try {
      const response = await axiosInstance.post('/websocket/connect', { userId });
      
      if (response.data.success) {
        this.isConnected = true;
        
        // 开始轮询获取更新
        this.startPolling();
        
        console.log('WebSocket fallback connected');
      }
    } catch (error) {
      console.error('WebSocket fallback connection failed:', error);
      throw error;
    }
  }

  async disconnect(userId: string): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    
    try {
      await axiosInstance.post('/websocket/disconnect', { userId });
      this.isConnected = false;
      console.log('WebSocket fallback disconnected');
    } catch (error) {
      console.error('WebSocket fallback disconnect failed:', error);
    }
  }

  async updateActivity(userId: string, activity: string): Promise<void> {
    try {
      await axiosInstance.post('/websocket/activity', { userId, activity });
    } catch (error) {
      console.error('WebSocket fallback activity update failed:', error);
    }
  }

  async sendMessage(senderId: string, receiverId: string, content: string): Promise<any> {
    try {
      const response = await axiosInstance.post('/websocket/message', {
        senderId,
        receiverId,
        content
      });
      return response.data.message;
    } catch (error) {
      console.error('WebSocket fallback message send failed:', error);
      throw error;
    }
  }

  async getOnlineUsers(): Promise<{ onlineUsers: string[], activities: [string, string][] }> {
    try {
      const response = await axiosInstance.get('/websocket/users');
      return response.data;
    } catch (error) {
      console.error('WebSocket fallback get online users failed:', error);
      return { onlineUsers: [], activities: [] };
    }
  }

  private startPolling(): void {
    // 每5秒轮询一次获取更新
    this.pollingInterval = setInterval(async () => {
      if (this.isConnected) {
        try {
          const { onlineUsers, activities } = await this.getOnlineUsers();
          
          // 触发自定义事件，让组件可以监听
          window.dispatchEvent(new CustomEvent('websocket-fallback-update', {
            detail: { onlineUsers, activities }
          }));
        } catch (error) {
          console.error('WebSocket fallback polling failed:', error);
        }
      }
    }, 5000);
  }
}

export const websocketFallback = new WebSocketFallbackClient();
