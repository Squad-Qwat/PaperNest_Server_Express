import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Notification } from '../types';

export class NotificationRepository {
  private collection = db.collection(COLLECTIONS.NOTIFICATIONS);

  /**
   * Create a new notification
   */
  async create(notificationData: Omit<Notification, 'notificationId' | 'createdAt'>): Promise<Notification> {
    const now = new Date();
    const docRef = this.collection.doc();
    
    const notification: Notification = {
      notificationId: docRef.id,
      ...notificationData,
      createdAt: now,
    };

    await docRef.set(notification);
    return notification;
  }

  /**
   * Find notification by ID
   */
  async findById(notificationId: string): Promise<Notification | null> {
    const doc = await this.collection.doc(notificationId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as Notification;
  }

  /**
   * Find all notifications for a user
   */
  async findByUser(userId: string, limit?: number): Promise<Notification[]> {
    let query = this.collection
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => doc.data() as Notification);
  }

  /**
   * Find unread notifications for a user
   */
  async findUnreadByUser(userId: string, limit?: number): Promise<Notification[]> {
    let query = this.collection
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .orderBy('createdAt', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => doc.data() as Notification);
  }

  /**
   * Find notifications by type
   */
  async findByType(userId: string, type: string, limit?: number): Promise<Notification[]> {
    let query = this.collection
      .where('userId', '==', userId)
      .where('type', '==', type)
      .orderBy('createdAt', 'desc');
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => doc.data() as Notification);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    await this.collection.doc(notificationId).update({ isRead: true });
    
    const updated = await this.findById(notificationId);
    if (!updated) {
      throw new Error('Notification not found after update');
    }
    
    return updated;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
  }

  /**
   * Delete notification
   */
  async delete(notificationId: string): Promise<void> {
    await this.collection.doc(notificationId).delete();
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllByUser(userId: string): Promise<void> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async deleteOldReadNotifications(userId: string, daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('isRead', '==', true)
      .where('createdAt', '<', cutoffDate)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  /**
   * Count unread notifications
   */
  async countUnread(userId: string): Promise<number> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .count()
      .get();
    
    return snapshot.data().count;
  }

  /**
   * Check if notification exists
   */
  async exists(notificationId: string): Promise<boolean> {
    const doc = await this.collection.doc(notificationId).get();
    return doc.exists;
  }
}

export default new NotificationRepository();
