import { Router } from 'express';
import * as userController from '../controllers/userController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  updateUserSchema,
  searchUserSchema,
} from '../models/validators/userValidator';

const router: Router = Router();

/**
 * @route   GET /api/users/search?q=query
 * @desc    Search users by name or email
 * @access  Protected
 */
router.get(
  '/search',
  authenticate,
  validate({ query: searchUserSchema }),
  userController.searchUsers
);

/**
 * @route   GET /api/users/:userId
 * @desc    Get user by ID
 * @access  Protected
 */
router.get(
  '/:userId',
  authenticate,
  userController.getUserById
);

/**
 * @route   PUT /api/users/:userId
 * @desc    Update user profile (own profile only)
 * @access  Protected
 */
router.put(
  '/:userId',
  authenticate,
  validate({ body: updateUserSchema }),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user account (own account only)
 * @access  Protected
 */
router.delete(
  '/:userId',
  authenticate,
  userController.deleteUser
);

export default router;
