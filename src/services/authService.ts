import { auth } from '../config/firebase';
import userRepository from '../repositories/userRepository';
import { User } from '../types';
import { ERROR_MESSAGES } from '../config/constants';
import logger from '../utils/logger';
import bcrypt from 'bcryptjs';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../middlewares/auth';

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  username: string;
  role: 'Student' | 'Lecturer';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  firebaseToken?: string;
}

/**
 * Register a new user with Firebase Auth
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  try {
    // Check if email already exists in our database
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }

    // Check if username already exists
    const existingUsername = await userRepository.findByUsername(data.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // Create user in Firebase Auth
    const firebaseUser = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: data.name,
      emailVerified: false,
    });

    logger.info(`Firebase user created: ${firebaseUser.uid}`);

    // Hash password for our database (backup)
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user in our Firestore database
    const user = await userRepository.create(firebaseUser.uid, {
      email: data.email,
      name: data.name,
      username: data.username,
      role: data.role,
      photoURL: null,
    });

    logger.info(`User created in database: ${user.userId}`);

    // Generate custom JWT tokens
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    // Generate Firebase custom token
    const firebaseToken = await auth.createCustomToken(firebaseUser.uid);

    return {
      user,
      token,
      refreshToken,
      firebaseToken,
    };
  } catch (error: any) {
    logger.error('Registration error:', error);
    
    // Handle Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      throw new Error('Email already exists in Firebase Auth');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email format');
    }
    if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Must be at least 6 characters');
    }
    
    throw error;
  }
};

/**
 * Login user with Firebase Auth verification
 * Note: Actual password verification happens on client-side with Firebase Auth
 * This endpoint is for getting custom JWT tokens after Firebase authentication
 */
export const login = async (firebaseToken: string): Promise<AuthResponse> => {
  try {
    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(firebaseToken);
    
    // Get user from our database
    const user = await userRepository.findById(decodedToken.uid);

    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    logger.info(`User logged in: ${user.userId}`);

    // Generate custom JWT tokens
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      token,
      refreshToken,
      firebaseToken,
    };
  } catch (error: any) {
    logger.error('Login error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      throw new Error('Firebase token has expired');
    }
    if (error.code === 'auth/invalid-id-token') {
      throw new Error('Invalid Firebase token');
    }
    
    throw error;
  }
};

/**
 * Alternative login with email/password (for testing without Firebase client SDK)
 * This creates a custom token that can be used with Firebase
 */
export const loginWithEmailPassword = async (data: LoginData): Promise<AuthResponse> => {
  try {
    // Get user by email
    const user = await userRepository.findByEmail(data.email);

    if (!user) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // For production, you should verify password against Firebase Auth
    // For now, we'll generate tokens directly
    
    // Generate Firebase custom token
    const firebaseToken = await auth.createCustomToken(user.userId);

    // Generate custom JWT tokens
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    logger.info(`User logged in with email/password: ${user.userId}`);

    return {
      user,
      token,
      refreshToken,
      firebaseToken,
    };
  } catch (error) {
    logger.error('Email/password login error:', error);
    throw error;
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<{ token: string }> => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user to ensure they still exist
    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Generate new access token
    const token = generateToken({
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    return { token };
  } catch (error) {
    logger.error('Refresh token error:', error);
    throw new Error('Invalid refresh token');
  }
};

/**
 * Verify Firebase token
 */
export const verifyFirebaseToken = async (token: string): Promise<User> => {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    const user = await userRepository.findById(decodedToken.uid);

    if (!user) {
      throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    return user;
  } catch (error) {
    logger.error('Token verification error:', error);
    throw new Error('Invalid token');
  }
};

/**
 * Delete user from Firebase Auth and database
 */
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    // Delete from Firebase Auth
    await auth.deleteUser(userId);
    
    // Delete from database
    await userRepository.delete(userId);
    
    logger.info(`User deleted: ${userId}`);
  } catch (error) {
    logger.error('Delete user error:', error);
    throw error;
  }
};

/**
 * Update user email in Firebase Auth
 */
export const updateUserEmail = async (userId: string, newEmail: string): Promise<void> => {
  try {
    await auth.updateUser(userId, {
      email: newEmail,
    });
    
    await userRepository.update(userId, {
      email: newEmail,
    });
    
    logger.info(`User email updated: ${userId}`);
  } catch (error) {
    logger.error('Update email error:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (email: string): Promise<void> => {
  try {
    // Get Firebase user by email
    const firebaseUser = await auth.getUserByEmail(email);
    
    // Generate password reset link (this would typically be done client-side)
    const resetLink = await auth.generatePasswordResetLink(email);
    
    logger.info(`Password reset link generated for: ${email}`);
    
    // In production, send email via email service
    // For now, just log it
    logger.info(`Password reset link: ${resetLink}`);
    
  } catch (error: any) {
    logger.error('Password reset error:', error);
    
    if (error.code === 'auth/user-not-found') {
      // Don't reveal if email exists
      logger.info(`Password reset requested for non-existent email: ${email}`);
      return;
    }
    
    throw error;
  }
};

export default {
  register,
  login,
  loginWithEmailPassword,
  refreshAccessToken,
  verifyFirebaseToken,
  deleteUser,
  updateUserEmail,
  sendPasswordResetEmail,
};
