import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  filterNotificationTypeSchema,
  filterNotificationReadSchema,
} from '../models/validators/notificationValidator';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user (can filter by type or read status)
 * @access  Protected
 */
router.get(
  '/',
  authenticate,
  notificationController.getUserNotifications
);

/**
 * @route   GET /api/notifications/unread
 * @desc    Get unread notifications
 * @access  Protected
 */
router.get(
  '/unread',
  authenticate,
  notificationController.getUnreadNotifications
);

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Protected
 */
router.put(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead
);

/**
 * @route   DELETE /api/notifications/cleanup
 * @desc    Clean up old read notifications
 * @access  Protected
 */
router.delete(
  '/cleanup',
  authenticate,
  notificationController.cleanupOldNotifications
);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for user
 * @access  Protected
 */
router.delete(
  '/',
  authenticate,
  notificationController.deleteAllNotifications
);

/**
 * @route   GET /api/notifications/:notificationId
 * @desc    Get notification by ID
 * @access  Protected (own notification only)
 */
router.get(
  '/:notificationId',
  authenticate,
  notificationController.getNotificationById
);

/**
 * @route   PUT /api/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Protected (own notification only)
 */
router.put(
  '/:notificationId/read',
  authenticate,
  notificationController.markAsRead
);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete notification
 * @access  Protected (own notification only)
 */
router.delete(
  '/:notificationId',
  authenticate,
  notificationController.deleteNotification
);

export default router;
