export interface Presence {
	userId: string;
	name: string;
	cursorPosition: number;
	selection: {
		start: number;
		end: number;
	} | null;
	lastActive: Date;
}

export interface LiveblocksUser {
	id: string;
	connectionId: string;
	info?: {
		name?: string;
		email?: string;
		[key: string]: any;
	};
}

export interface LiveblocksWebhookEvent {
	type: "userLeft" | "userEntered" | "storageUpdated" | "notification" | string;
	data?: {
		projectId?: string;
		roomId?: string;
		connectionId?: number;
		userId?: string | null;
		userInfo?: Record<string, unknown> | null;
		enteredAt?: string;
		leftAt?: string;
		numActiveUsers?: number;
	};
}

export interface UserLeftEvent extends LiveblocksWebhookEvent {
	type: "userLeft";
	data: {
		projectId: string;
		roomId: string;
		connectionId: number;
		userId: string | null;
		userInfo: Record<string, unknown> | null;
		leftAt: string;
		numActiveUsers: number;
	};
}

export interface UserEnteredEvent extends LiveblocksWebhookEvent {
	type: "userEntered";
	data: {
		projectId: string;
		roomId: string;
		connectionId: number;
		userId: string | null;
		userInfo: Record<string, unknown> | null;
		enteredAt: string;
		numActiveUsers: number;
	};
}

export interface RoomCleanupResult {
	action: "keep_room" | "deleted" | "already_deleted" | "room_not_found";
	roomId?: string;
	activeUsers?: number;
}
