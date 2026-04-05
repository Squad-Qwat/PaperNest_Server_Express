import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import userRepository from "../../repositories/userRepository";
import { mockUser } from "../../tests/fixtures";
import {
	mockNext,
	mockRequest,
	mockResponse,
} from "../../tests/mocks/express.mocks";
import { UnauthorizedError } from "../../utils/errorTypes";

// Extended Request type with user property
interface RequestWithUser extends Request {
	user?: any;
	userId?: string;
}

jest.mock("../../config/firebase", () => ({
	auth: require("../../../__mocks__/firebase-admin").__mockAuth,
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
}));

jest.mock("../../repositories/userRepository");

jest.mock("jsonwebtoken");

// Import after mocks are set up
const {
	authenticate,
	optionalAuthenticate,
	generateToken,
} = require("../../middlewares/auth");
const { auth } = require("../../config/firebase");

describe("Auth Middleware", () => {
	let req: Partial<RequestWithUser>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("authenticate", () => {
		it("should authenticate with valid JWT token", async () => {
			req = mockRequest({
				headers: {
					authorization: "Bearer valid-jwt-token",
				},
			});

			const mockDecodedToken = {
				userId: "user-123",
				email: "test@example.com",
			};

			// Mock JWT verification to fail first (so it tries Firebase)
			jest.mocked(jwt.verify).mockImplementation(() => {
				throw new Error("Invalid JWT");
			});

			// Mock Firebase to succeed
			const mockFirebaseUser = {
				uid: "user-123",
				email: "test@example.com",
			};
			jest.mocked(auth.verifyIdToken).mockResolvedValue(mockFirebaseUser);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);

			await authenticate(req as RequestWithUser, res as Response, next);

			expect(req.user).toEqual(mockUser);
			expect(next).toHaveBeenCalled();
		});

		it("should authenticate with valid Firebase token", async () => {
			req = mockRequest({
				headers: {
					authorization: "Bearer firebase-token",
				},
			});

			jest.mocked(jwt.verify).mockImplementation(() => {
				throw new Error("Invalid JWT");
			});

			const mockFirebaseUser = {
				uid: "user-123",
				email: "test@example.com",
			};

			jest.mocked(auth.verifyIdToken).mockResolvedValue(mockFirebaseUser);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);

			await authenticate(req as RequestWithUser, res as Response, next);

			expect(req.user).toEqual(mockUser);
			expect(next).toHaveBeenCalled();
		});

		it("should throw UnauthorizedError when no token provided", async () => {
			req = mockRequest({
				headers: {},
			});

			await authenticate(req as RequestWithUser, res as Response, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalledWith({
				success: false,
				error: "No token provided",
			});
			expect(next).not.toHaveBeenCalled();
		});

		it("should throw UnauthorizedError with invalid token", async () => {
			req = mockRequest({
				headers: {
					authorization: "Bearer invalid-token",
				},
			});

			jest.mocked(jwt.verify).mockImplementation(() => {
				throw new Error("Invalid token");
			});

			jest
				.mocked(auth.verifyIdToken)
				.mockRejectedValue(new Error("Invalid Firebase token"));

			await authenticate(req as RequestWithUser, res as Response, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalled();
			expect(next).not.toHaveBeenCalled();
		});

		it("should handle Bearer token without prefix", async () => {
			req = mockRequest({
				headers: {
					authorization: "invalid-format-token",
				},
			});

			await authenticate(req as RequestWithUser, res as Response, next);

			expect(res.status).toHaveBeenCalledWith(401);
			expect(res.json).toHaveBeenCalled();
			expect(next).not.toHaveBeenCalled();
		});
	});

	describe("optionalAuthenticate", () => {
		it("should authenticate user when token is provided", async () => {
			req = mockRequest({
				headers: {
					authorization: "Bearer valid-jwt-token",
				},
			});

			const mockDecodedToken = {
				userId: "user-123",
				email: "test@example.com",
			};

			jest.mocked(jwt.verify).mockImplementation(() => {
				throw new Error("Invalid JWT");
			});

			const mockFirebaseUser = {
				uid: "user-123",
				email: "test@example.com",
			};
			jest.mocked(auth.verifyIdToken).mockResolvedValue(mockFirebaseUser);
			jest.mocked(userRepository.findById).mockResolvedValue(mockUser);

			await optionalAuthenticate(req as RequestWithUser, res as Response, next);

			expect(req.user).toEqual(mockUser);
			expect(next).toHaveBeenCalled();
		});

		it("should continue without error when no token provided", async () => {
			req = mockRequest({
				headers: {},
			});

			await optionalAuthenticate(req as RequestWithUser, res as Response, next);

			expect(req.user).toBeUndefined();
			expect(next).toHaveBeenCalled();
		});
	});

	describe("generateToken", () => {
		it("should generate JWT token with user data", () => {
			const payload = {
				userId: "user-123",
				email: "test@example.com",
				role: "Student",
			};

			jest.mocked(jwt.sign).mockReturnValue("generated-jwt-token" as any);

			const token = generateToken(payload);

			expect(token).toBe("generated-jwt-token");
			expect(jwt.sign).toHaveBeenCalledWith(
				payload,
				expect.any(String),
				expect.objectContaining({ expiresIn: expect.any(String) }),
			);
		});
	});
});
