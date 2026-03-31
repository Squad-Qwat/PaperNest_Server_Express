import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from '../utils/responseFormatter';
import { SUCCESS_MESSAGES } from '../config/constants';
import * as authService from '../services/authService';
import logger from '../utils/logger';

/**
 * Register a new user
 * POST /api/auth/register
 * Public
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Registration request received', { email: req.body.email });
  
  const result = await authService.register(req.body);
  
  return createdResponse(
    res,
    result,
    SUCCESS_MESSAGES.REGISTER_SUCCESS
  );
});

/**
 * Login user with Firebase token
 * POST /api/auth/login
 * Public
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Login request received');
  
  const result = await authService.login(req.body.firebaseToken);
  
  return successResponse(
    res,
    result,
    SUCCESS_MESSAGES.LOGIN_SUCCESS
  );
});

/**
 * Login user with email and password (alternative method)
 * POST /api/auth/login/email
 * Public
 */
export const loginWithEmailPassword = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Email/password login request received', { email: req.body.email });
  
  const result = await authService.loginWithEmailPassword(req.body);
  
  return successResponse(
    res,
    result,
    SUCCESS_MESSAGES.LOGIN_SUCCESS
  );
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 * Public (requires valid refresh token in body)
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Token refresh request received');
  
  const result = await authService.refreshAccessToken(req.body.refreshToken);
  
  return successResponse(
    res,
    result,
    'Access token refreshed successfully'
  );
});

/**
 * Verify Firebase token
 * POST /api/auth/verify
 * Public
 */
export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Token verification request received');
  
  const user = await authService.verifyFirebaseToken(req.body.token);
  
  return successResponse(
    res,
    { user },
    'Token is valid'
  );
});

/**
 * Get current user profile
 * GET /api/auth/me
 * Protected
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Get current user request received', { userId: req.userId });
  
  // User is already attached to request by authenticate middleware
  return successResponse(
    res,
    { user: req.user },
    'User retrieved successfully'
  );
});

/**
 * Delete user account
 * DELETE /api/auth/account
 * Protected
 */
export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Delete account request received', { userId: req.userId });
  
  if (!req.userId) {
    throw new Error('User ID not found in request');
  }
  
  await authService.deleteUser(req.userId);
  
  return noContentResponse(res);
});

/**
 * Update user email
 * PUT /api/auth/email
 * Protected
 */
export const updateEmail = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Update email request received', { 
    userId: req.userId, 
    newEmail: req.body.newEmail 
  });
  
  if (!req.userId) {
    throw new Error('User ID not found in request');
  }
  
  await authService.updateUserEmail(req.userId, req.body.newEmail);
  
  return successResponse(
    res,
    null,
    'Email updated successfully'
  );
});

/**
 * Send password reset email
 * POST /api/auth/password/reset
 * Public
 */
export const sendPasswordReset = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Password reset request received', { email: req.body.email });
  
  await authService.sendPasswordResetEmail(req.body.email);
  
  return successResponse(
    res,
    null,
    'If the email exists, a password reset link has been sent'
  );
});



export const loginWithGoogle = asyncHandler(async (req: Request, res: Response) => {
  logger.info('Google login request received');
  
});

export default {
  register,
  login,
  loginWithEmailPassword,
  refreshToken,
  verifyToken,
  getCurrentUser,
  deleteAccount,
  updateEmail,
  sendPasswordReset,
};
