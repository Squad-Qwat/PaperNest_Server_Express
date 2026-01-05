import { Router } from 'express';
import * as authController from '../controllers/authController';
import { validate } from '../middlewares/validation';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { authenticate } from '../middlewares/auth';
import {
  registerSchema,
  loginSchema,
  loginWithEmailPasswordSchema,
  refreshTokenSchema,
  verifyTokenSchema,
  updateEmailSchema,
  passwordResetSchema,
} from '../models/validators/authValidator';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login with Firebase token
 * @access  Public
 */
router.post(
  '/login',
  // authRateLimiter,
validate({ body: loginSchema }),
  authController.login
);

/**
 * @route   POST /api/auth/login/email
 * @desc    Login with email and password (alternative method for testing)
 * @access  Public
 */
router.post(
  '/login/email',
  // authRateLimiter,
  validate({ body: loginWithEmailPasswordSchema }),
  authController.loginWithEmailPassword
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 */
router.post(
  '/refresh',
  validate({ body: refreshTokenSchema }),
  authController.refreshToken
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify Firebase token
 * @access  Public
 */
router.post(
  '/verify',
  validate({ body: verifyTokenSchema }),
  authController.verifyToken
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Protected
 */
router.get(
  '/me',
  authenticate,
  authController.getCurrentUser
);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account
 * @access  Protected
 */
router.delete(
  '/account',
  authenticate,
  authController.deleteAccount
);

/**
 * @route   PUT /api/auth/email
 * @desc    Update user email
 * @access  Protected
 */
router.put(
  '/email',
  authenticate,
  validate({ body: updateEmailSchema }),
  authController.updateEmail
);

/**
 * @route   POST /api/auth/password/reset
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  '/password/reset',
  authRateLimiter,
  validate({ body: passwordResetSchema }),
  authController.sendPasswordReset
);

export default router;
