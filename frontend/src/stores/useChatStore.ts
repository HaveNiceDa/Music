import { axiosInstance } from "@/lib/axios";
import { Message, User } from "@/types";
import { create } from "zustand";
import { io } from "socket.io-client";
import { websocketFallback } from "@/lib/websocket-fallback";

interface ChatStore {
	users: User[];
	isLoading: boolean;
	error: string | null;
	socket: any;
	isConnected: boolean;
	onlineUsers: Set<string>;
	userActivities: Map<string, string>;
	messages: Message[];
	selectedUser: User | null;
	userId: string | null;

	fetchUsers: () => Promise<void>;
	initSocket: (userId: string) => void;
	disconnectSocket: () => void;
	sendMessage: (receiverId: string, senderId: string, content: string) => void;
	fetchMessages: (userId: string) => Promise<void>;
	setSelectedUser: (user: User | null) => void;
}

const baseURL = import.meta.env.MODE === "development" ? "http://localhost:5000" : "https://music-backend-lilac.vercel.app";

const socket = io(baseURL, {
	autoConnect: false, // only connect if user is authenticated
	withCredentials: true,
});

export const useChatStore = create<ChatStore>((set, get) => ({
	users: [],
	isLoading: false,
	error: null,
	socket: socket,
	isConnected: false,
	onlineUsers: new Set(),
	userActivities: new Map(),
	messages: [],
	selectedUser: null,
	userId: null,

	setSelectedUser: (user) => set({ selectedUser: user }),

	fetchUsers: async () => {
		set({ isLoading: true, error: null });
		try {
			const response = await axiosInstance.get("/users");
			set({ users: response.data });
		} catch (error: any) {
			set({ error: error.response.data.message });
		} finally {
			set({ isLoading: false });
		}
	},

	initSocket: async (userId) => {
		if (!get().isConnected) {
			set({ userId });
			try {
				// 首先尝试Socket.IO连接
				socket.auth = { userId };
				socket.connect();

				socket.emit("user_connected", userId);

				socket.on("users_online", (users: string[]) => {
					set({ onlineUsers: new Set(users) });
				});

				socket.on("activities", (activities: [string, string][]) => {
					set({ userActivities: new Map(activities) });
				});

				socket.on("user_connected", (userId: string) => {
					set((state) => ({
						onlineUsers: new Set([...state.onlineUsers, userId]),
					}));
				});

				socket.on("user_disconnected", (userId: string) => {
					set((state) => {
						const newOnlineUsers = new Set(state.onlineUsers);
						newOnlineUsers.delete(userId);
						return { onlineUsers: newOnlineUsers };
					});
				});

				socket.on("receive_message", (message: Message) => {
					set((state) => ({
						messages: [...state.messages, message],
					}));
				});

				socket.on("message_sent", (message: Message) => {
					set((state) => ({
						messages: [...state.messages, message],
					}));
				});

				socket.on("activity_updated", ({ userId, activity }) => {
					set((state) => {
						const newActivities = new Map(state.userActivities);
						newActivities.set(userId, activity);
						return { userActivities: newActivities };
					});
				});

				// 设置连接超时，如果Socket.IO连接失败，使用备用方案
				setTimeout(async () => {
					if (!socket.connected) {
						console.log('Socket.IO连接失败，使用WebSocket备用方案');
						await websocketFallback.connect(userId);
						
						// 监听备用方案的更新事件
						window.addEventListener('websocket-fallback-update', (event: any) => {
							const { onlineUsers, activities } = event.detail;
							set({ 
								onlineUsers: new Set(onlineUsers),
								userActivities: new Map(activities)
							});
						});
					}
				}, 5000);

				set({ isConnected: true });
			} catch (error) {
				console.error('Socket连接失败，使用备用方案:', error);
				// 如果Socket.IO失败，使用备用方案
				await websocketFallback.connect(userId);
				
				// 监听备用方案的更新事件
				window.addEventListener('websocket-fallback-update', (event: any) => {
					const { onlineUsers, activities } = event.detail;
					set({ 
						onlineUsers: new Set(onlineUsers),
						userActivities: new Map(activities)
					});
				});
				
				set({ isConnected: true });
			}
		}
	},

	disconnectSocket: async () => {
		if (get().isConnected) {
			socket.disconnect();
			
			// 如果使用了备用方案，也要断开
			if (websocketFallback) {
				await websocketFallback.disconnect(get().userId || '');
			}
			
			set({ isConnected: false });
		}
	},

	sendMessage: async (receiverId, senderId, content) => {
		const socket = get().socket;
		
		// 如果Socket.IO连接正常，使用Socket.IO
		if (socket && socket.connected) {
			socket.emit("send_message", { receiverId, senderId, content });
		} else {
			// 否则使用备用方案
			try {
				const message = await websocketFallback.sendMessage(senderId, receiverId, content);
				// 手动添加到消息列表
				set((state) => ({
					messages: [...state.messages, message],
				}));
			} catch (error) {
				console.error('发送消息失败:', error);
			}
		}
	},

	fetchMessages: async (userId: string) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axiosInstance.get(`/users/messages/${userId}`);
			set({ messages: response.data });
		} catch (error: any) {
			set({ error: error.response.data.message });
		} finally {
			set({ isLoading: false });
		}
	},
}));
