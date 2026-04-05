import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate } from "../middlewares/auth";
import { authRateLimiter } from "../middlewares/rateLimiter";
import { validate } from "../middlewares/validation";
import {
	checkEmailSchema,
	finalizeRegistrationSchema,
	loginSchema,
	loginWithEmailPasswordSchema,
	passwordResetSchema,
	refreshTokenSchema,
	registerSchema,
	updateEmailSchema,
	verifyTokenSchema,
} from "../models/validators/authValidator";

const router: Router = Router();

/**
 * @route   POST /api/auth/check-email
 * @desc    Check email availability
 * @access  Public
 */
router.post(
	"/check-email",
	validate({ body: checkEmailSchema }),
	authController.checkEmail,
);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
	"/register",
	authRateLimiter,
	validate({ body: registerSchema }),
	authController.register,
);

/**
 * @route   POST /api/auth/register/finalize
 * @desc    Finalize registration after email verification
 * @access  Public
 */
router.post(
	"/register/finalize",
	authRateLimiter,
	validate({ body: finalizeRegistrationSchema }),
	authController.finalizeRegistration,
);

/**
 * @route   POST /api/auth/login
 * @desc    Login with Firebase token (Standard)
 * @access  Public
 */
router.post("/login", validate({ body: loginSchema }), authController.login);

/**
 * @route   POST /api/auth/social
 * @desc    Login with Social Auth (Google, GitHub, etc.)
 * @access  Public
 */
router.post(
	"/social",
	validate({ body: loginSchema }),
	authController.socialLogin,
);

/**
 * @route   POST /api/auth/social/complete
 * @desc    Complete social registration (Onboarding)
 * @access  Public
 */
router.post("/social/complete", authController.completeSocialRegistration);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 */
router.post(
	"/refresh",
	validate({ body: refreshTokenSchema }),
	authController.refreshToken,
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify Firebase token
 * @access  Public
 */
router.post(
	"/verify",
	validate({ body: verifyTokenSchema }),
	authController.verifyToken,
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Protected
 */
router.get("/me", authenticate, authController.getCurrentUser);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account
 * @access  Protected
 */
router.delete("/account", authenticate, authController.deleteAccount);

/**
 * @route   PUT /api/auth/email
 * @desc    Update user email
 * @access  Protected
 */
router.put(
	"/email",
	authenticate,
	validate({ body: updateEmailSchema }),
	authController.updateEmail,
);

/**
 * @route   POST /api/auth/password/reset
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
	"/password/reset",
	authRateLimiter,
	validate({ body: passwordResetSchema }),
	authController.sendPasswordReset,
);

export default router;
