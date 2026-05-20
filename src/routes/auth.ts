import { Router } from "express";
import * as authController from "../controllers/authController";
import { authenticate, authenticateFirebase } from "../middlewares/auth";
import { authRateLimiter } from "../middlewares/rateLimiter";
import { validateTurnstile } from "../middlewares/turnstile";
import { validate } from "../middlewares/validation";
import {
	checkEmailSchema,
	finalizeRegistrationSchema,
	loginSchema,
	passwordResetSchema,
	refreshTokenSchema,
	registerSchema,
	updateEmailSchema,
	verifyTokenSchema,
	verifyOTPSchema,
} from "../models/validators/authValidator";

const router: Router = Router();

router.post(
	"/check-email",
	validate({ body: checkEmailSchema }),
	authController.checkEmail,
);

router.post(
	"/register",
	authRateLimiter,
	validateTurnstile,
	validate({ body: registerSchema }),
	authController.register,
);

router.post(
	"/register/finalize",
	authRateLimiter,
	validate({ body: finalizeRegistrationSchema }),
	authController.finalizeRegistration,
);

router.post(
	"/login",
	validateTurnstile,
	validate({ body: loginSchema }),
	authController.login
);

router.post(
	"/social",
	validateTurnstile,
	validate({ body: loginSchema }),
	authController.socialLogin,
);

router.post("/social/complete", authController.completeSocialRegistration);

router.post(
	"/refresh",
	validate({ body: refreshTokenSchema }),
	authController.refreshToken,
);

router.post(
	"/verify",
	validate({ body: verifyTokenSchema }),
	authController.verifyToken,
);

router.get("/me", authenticate, authController.getCurrentUser);

router.delete("/account", authenticate, authController.deleteAccount);

router.put(
	"/email",
	authenticate,
	validate({ body: updateEmailSchema }),
	authController.updateEmail,
);

router.post(
	"/password/reset",
	authRateLimiter,
	validate({ body: passwordResetSchema }),
	authController.sendPasswordReset,
);

router.post(
	"/otp/send",
	authenticateFirebase,
	authRateLimiter,
	authController.sendOTP,
);

router.post(
	"/otp/verify",
	authenticateFirebase,
	validate({ body: verifyOTPSchema }),
	authController.verifyOTP,
);

export default router;
