import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  successResponse,
  noContentResponse,
} from '../utils/responseFormatter';
import { NotFoundError } from '../utils/errorTypes';
import notificationRepository from '../repositories/notificationRepository';
import logger from '../utils/logger';

/**
 * Get all notifications for current user
 * GET /api/notifications
 * Protected
 */
export const getUserNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const { type, read } = req.query;
  
  logger.info('Get user notifications request', { userId, type, read });
  
  let notifications;
  
  if (read !== undefined) {
    const isRead = read === 'true';
    if (isRead) {
      notifications = await notificationRepository.findByUser(userId);
    } else {
      notifications = await notificationRepository.findUnreadByUser(userId);
    }
  } else if (type) {
    notifications = await notificationRepository.findByType(userId, type as string);
  } else {
    notifications = await notificationRepository.findByUser(userId);
  }
  
  return successResponse(
    res,
    { notifications, count: notifications.length },
    'Notifications retrieved successfully'
  );
});

/**
 * Get unread notifications
 * GET /api/notifications/unread
 * Protected
 */
export const getUnreadNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  logger.info('Get unread notifications request', { userId });
  
  const notifications = await notificationRepository.findUnreadByUser(userId);
  const unreadCount = await notificationRepository.countUnread(userId);
  
  return successResponse(
    res,
    { notifications, count: notifications.length, unreadCount },
    'Unread notifications retrieved successfully'
  );
});

/**
 * Get notification by ID
 * GET /api/notifications/:notificationId
 * Protected (own notification only)
 */
export const getNotificationById = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.userId!;
  
  logger.info('Get notification request', { notificationId, userId });
  
  const notification = await notificationRepository.findById(notificationId);
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  // Verify notification belongs to user
  if (notification.userId !== userId) {
    throw new NotFoundError('Notification not found');
  }
  
  return successResponse(res, { notification }, 'Notification retrieved successfully');
});

/**
 * Mark notification as read
 * PUT /api/notifications/:notificationId/read
 * Protected (own notification only)
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.userId!;
  
  logger.info('Mark notification as read request', { notificationId, userId });
  
  const notification = await notificationRepository.findById(notificationId);
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  // Verify notification belongs to user
  if (notification.userId !== userId) {
    throw new NotFoundError('Notification not found');
  }
  
  const updated = await notificationRepository.markAsRead(notificationId);
  
  return successResponse(res, { notification: updated }, 'Notification marked as read');
});

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 * Protected
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  logger.info('Mark all notifications as read request', { userId });
  
  await notificationRepository.markAllAsRead(userId);
  
  return successResponse(res, null, 'All notifications marked as read');
});

/**
 * Delete notification
 * DELETE /api/notifications/:notificationId
 * Protected (own notification only)
 */
export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const userId = req.userId!;
  
  logger.info('Delete notification request', { notificationId, userId });
  
  const notification = await notificationRepository.findById(notificationId);
  
  if (!notification) {
    throw new NotFoundError('Notification not found');
  }
  
  // Verify notification belongs to user
  if (notification.userId !== userId) {
    throw new NotFoundError('Notification not found');
  }
  
  await notificationRepository.delete(notificationId);
  
  return noContentResponse(res);
});

/**
 * Delete all notifications for user
 * DELETE /api/notifications
 * Protected
 */
export const deleteAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  logger.info('Delete all notifications request', { userId });
  
  await notificationRepository.deleteAllByUser(userId);
  
  return noContentResponse(res);
});

/**
 * Clean up old read notifications (older than 30 days)
 * DELETE /api/notifications/cleanup
 * Protected
 */
export const cleanupOldNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  const days = parseInt(req.query.days as string) || 30;
  
  logger.info('Cleanup old notifications request', { userId, days });
  
  await notificationRepository.deleteOldReadNotifications(userId, days);
  
  return successResponse(res, null, `Notifications older than ${days} days cleaned up`);
});

export default {
  getUserNotifications,
  getUnreadNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  cleanupOldNotifications,
};
