import { env } from '../config/env';
import { RoomCleanupResult } from '../types';
import logger from '../utils/logger';

export class LiveblocksWebhookService {
  private apiSecret: string;

  constructor() {
    this.apiSecret = env.LIVEBLOCKS_SECRET_KEY;
    
    if (!this.apiSecret) {
      throw new Error('LIVEBLOCKS_SECRET_KEY not configured');
    }
  }

  async checkAndCleanupRoom(roomId: string): Promise<RoomCleanupResult> {
    try {
      const activeUsers = await this.getActiveUsers(roomId);

      if (activeUsers.length > 0) {
        logger.info(`Room ${roomId} has ${activeUsers.length} active users - keeping room`);
        return { action: 'keep_room', activeUsers: activeUsers.length };
      }

      await this.deleteRoom(roomId);
      logger.info(`Room ${roomId} deleted successfully`);
      return { action: 'deleted', roomId };

    } catch (error: any) {
      if (error.message?.includes('Room not found')) {
        logger.info(`Room ${roomId} not found - may already be deleted`);
        return { action: 'room_not_found' };
      }
      logger.error(`Error checking/cleaning room ${roomId}:`, error);
      throw error;
    }
  }

  private async getActiveUsers(roomId: string): Promise<any[]> {
    const response = await fetch(
      `https://api.liveblocks.io/v2/rooms/${roomId}/active_users`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Room not found');
      }
      const errorText = await response.text();
      throw new Error(`Failed to get active users: ${response.status} ${errorText}`);
    }

    const data = await response.json() as { data?: any[] };
    return data.data || [];
  }

  private async deleteRoom(roomId: string): Promise<void> {
    const response = await fetch(
      `https://api.liveblocks.io/v2/rooms/${roomId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        logger.info(`Room ${roomId} already deleted`);
        throw new Error('Room not found');
      }
      const errorText = await response.text();
      throw new Error(`Failed to delete room: ${response.status} ${errorText}`);
    }
  }
}

export default new LiveblocksWebhookService();
