# Socket.IO 在 Vercel 部署解决方案

## 问题描述
Socket.IO 在 Vercel 部署后报 404 错误，这是因为 Vercel 的无服务器架构与 Socket.IO 的持久连接需求不兼容。

## 解决方案

### 1. 后端修改

#### 修改的文件：
- `backend/src/index.js` - 更新了导出方式和请求处理
- `backend/src/lib/socket.js` - 添加了 Vercel 兼容配置
- `backend/src/lib/websocket-fallback.js` - 新增 WebSocket 备用方案
- `backend/vercel.json` - 更新了 Vercel 配置

#### 主要改进：
1. **优化了 Vercel 配置**：添加了 Socket.IO 路由和更长的函数超时时间
2. **创建了 WebSocket 备用方案**：当 Socket.IO 无法工作时，使用 HTTP 轮询
3. **改进了错误处理**：更好的连接失败处理机制

### 2. 前端修改

#### 修改的文件：
- `frontend/src/stores/useChatStore.ts` - 集成了备用方案
- `frontend/src/lib/websocket-fallback.ts` - 新增备用客户端

#### 主要改进：
1. **自动降级机制**：Socket.IO 连接失败时自动切换到备用方案
2. **HTTP 轮询**：使用定时轮询获取实时更新
3. **无缝切换**：用户无感知的备用方案切换

## 部署步骤

### 1. 后端部署
```bash
cd backend
vercel --prod
```

### 2. 前端部署
```bash
cd frontend
vercel --prod
```

### 3. 环境变量配置
确保在 Vercel 中设置了以下环境变量：
- `NODE_ENV=production`
- 数据库连接字符串
- Clerk 认证密钥

## 工作原理

### Socket.IO 优先策略
1. 前端首先尝试连接 Socket.IO
2. 如果 5 秒内连接失败，自动切换到备用方案
3. 备用方案使用 HTTP 轮询（每 5 秒一次）

### 备用方案特性
- **用户连接管理**：`/api/websocket/connect`
- **活动更新**：`/api/websocket/activity`
- **消息发送**：`/api/websocket/message`
- **在线用户**：`/api/websocket/users`

## 测试验证

### 1. 检查 Socket.IO 连接
打开浏览器开发者工具，查看网络请求：
- 应该能看到 `/socket.io/` 请求
- 如果返回 404，会自动切换到备用方案

### 2. 检查备用方案
- 查看控制台日志，应该看到 "WebSocket fallback connected"
- 网络请求中应该看到 `/api/websocket/` 相关请求

### 3. 功能测试
- 用户连接/断开
- 实时消息发送
- 活动状态更新
- 在线用户列表

## 注意事项

1. **性能考虑**：备用方案使用轮询，会增加服务器负载
2. **实时性**：轮询间隔为 5 秒，实时性略低于 WebSocket
3. **扩展性**：生产环境建议使用 Redis 替代内存存储

## 进一步优化建议

1. **使用 Redis**：在生产环境中使用 Redis 存储用户连接状态
2. **WebSocket 服务**：考虑使用专门的 WebSocket 服务（如 Pusher、Ably）
3. **CDN 优化**：使用 CDN 减少轮询延迟

## 故障排除

### 常见问题：
1. **仍然报 404**：检查 Vercel 配置和路由设置
2. **备用方案不工作**：检查 API 端点是否正确配置
3. **消息延迟**：调整轮询间隔（不推荐低于 3 秒）

### 调试方法：
1. 查看 Vercel 函数日志
2. 检查浏览器网络请求
3. 验证环境变量配置
