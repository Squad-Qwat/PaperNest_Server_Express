import {
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import documentBodyRepository from "../../repositories/documentBodyRepository";
import notificationRepository from "../../repositories/notificationRepository";
import reviewRepository from "../../repositories/reviewRepository";
import userRepository from "../../repositories/userRepository";
import {
	mockDocumentBody,
	mockLecturerUser,
	mockReview,
	mockUser,
} from "../../tests/fixtures";
import {
	mockAuthRequest,
	mockNext,
	mockResponse,
} from "../../tests/mocks/express.mocks";
import { BadRequestError, NotFoundError } from "../../utils/errorTypes";

jest.mock("firebase-admin", () => require("../../../__mocks__/firebase-admin"));
jest.mock("../../repositories/userRepository");
jest.mock("../../repositories/documentBodyRepository");
jest.mock("../../repositories/reviewRepository");
jest.mock("../../repositories/notificationRepository");
jest.mock("../../utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

let reviewController: typeof import("../../controllers/reviewController");

beforeAll(() => {
	reviewController = require("../../controllers/reviewController");
});

describe("ReviewController", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("createReview", () => {
		/**
		 * Test Case 1: Sukses membuat review request
		 *
		 * Precondition:
		 * - Lecturer dengan role "Lecturer" ada di DB
		 * - Document body ada & documentId cocok
		 *
		 * Request params:
		 * - documentId → "doc-123" (valid, ada di DB)
		 * - documentBodyId → "version-1" (valid, cocok dengan document)
		 *
		 * Request body:
		 * - lecturerUserId: "lecturer-123" (valid, ada di DB)
		 * - message: "Tolong review bab 3"
		 *
		 * Expected: status 201, review berhasil dibuat, notifikasi dikirim ke lecturer
		 */
		it("should create a review request successfully", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123", documentBodyId: "version-1" },
				body: {
					lecturerUserId: "lecturer-123",
					message: "Tolong review bab 3",
				},
			});

			jest.mocked(userRepository.findById).mockResolvedValue(mockLecturerUser);
			jest
				.mocked(documentBodyRepository.findById)
				.mockResolvedValue(mockDocumentBody);
			jest.mocked(reviewRepository.create).mockResolvedValue(mockReview);
			jest
				.mocked(notificationRepository.create)
				.mockResolvedValue({} as any);
			// populateSingleReviewUsers calls findById twice (student & lecturer)
			jest
				.mocked(userRepository.findById)
				.mockResolvedValueOnce(mockLecturerUser) // first call: validate lecturer
				.mockResolvedValueOnce(mockUser)          // second call: populate student
				.mockResolvedValueOnce(mockLecturerUser); // third call: populate lecturer

			await reviewController.createReview(
				req as Request,
				res as Response,
				next,
			);

			expect(next).not.toHaveBeenCalled();
			expect(userRepository.findById).toHaveBeenCalledWith("lecturer-123");
			expect(documentBodyRepository.findById).toHaveBeenCalledWith("version-1");
			expect(reviewRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					documentBodyId: "version-1",
					documentId: "doc-123",
					lecturerUserId: "lecturer-123",
					studentUserId: "user-123",
					message: "Tolong review bab 3",
					status: "pending",
				}),
			);
			expect(notificationRepository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "lecturer-123",
					type: "review_request",
					title: "New Review Request",
				}),
			);
			expect(res.status).toHaveBeenCalledWith(201);
		});

		/**
		 * Test Case 2: Lecturer tidak ditemukan di DB
		 *
		 * Precondition:
		 * - userRepo.findById() dikonfigurasi return null
		 *
		 * Request params:
		 * - documentId → valid
		 * - documentBodyId → valid
		 *
		 * Request body:
		 * - lecturerUserId: tidak terdaftar di DB
		 * - message: "pesan review"
		 *
		 * Expected: NotFoundError dengan pesan "Lecturer not found"
		 */
		it("should throw NotFoundError when lecturerUserId is not registered in DB", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123", documentBodyId: "version-1" },
				body: {
					lecturerUserId: "nonexistent-lecturer",
					message: "pesan review",
				},
			});

			jest.mocked(userRepository.findById).mockResolvedValue(null);

			await reviewController.createReview(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
			expect(reviewRepository.create).not.toHaveBeenCalled();
			expect(notificationRepository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test Case 3: User ditemukan tapi bukan Lecturer (role: "Student")
		 *
		 * Precondition:
		 * - userRepo.findById() return user dengan role: "Student"
		 *
		 * Request params:
		 * - documentId → valid
		 * - documentBodyId → valid
		 *
		 * Request body:
		 * - lecturerUserId: ada di DB tapi bukan Lecturer
		 * - message: "pesan review"
		 *
		 * Expected: BadRequestError dengan pesan "Selected user is not a lecturer"
		 */
		it("should throw BadRequestError when the specified user is not a Lecturer", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123", documentBodyId: "version-1" },
				body: {
					lecturerUserId: "student-user-456",
					message: "pesan review",
				},
			});

			// Return user dengan role "Student", bukan "Lecturer"
			jest.mocked(userRepository.findById).mockResolvedValue({
				...mockUser,
				userId: "student-user-456",
				role: "Student",
			});

			await reviewController.createReview(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(BadRequestError));
			expect(documentBodyRepository.findById).not.toHaveBeenCalled();
			expect(reviewRepository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test Case 4: Document body tidak ditemukan di DB
		 *
		 * Precondition:
		 * - Lecturer dengan role "Lecturer" ada di DB
		 * - docBodyRepo.findById() dikonfigurasi return null
		 *
		 * Request params:
		 * - documentId → valid
		 * - documentBodyId → tidak terdaftar di DB
		 *
		 * Request body:
		 * - lecturerUserId: valid
		 * - message: "pesan review"
		 *
		 * Expected: NotFoundError dengan pesan "Document version not found"
		 */
		it("should throw NotFoundError when documentBodyId is not registered in DB", async () => {
			req = mockAuthRequest("user-123", {
				params: {
					documentId: "doc-123",
					documentBodyId: "nonexistent-version",
				},
				body: {
					lecturerUserId: "lecturer-123",
					message: "pesan review",
				},
			});

			jest.mocked(userRepository.findById).mockResolvedValue(mockLecturerUser);
			jest.mocked(documentBodyRepository.findById).mockResolvedValue(null);

			await reviewController.createReview(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
			expect(reviewRepository.create).not.toHaveBeenCalled();
			expect(notificationRepository.create).not.toHaveBeenCalled();
		});

		/**
		 * Test Case 5: Document body ditemukan tapi milik dokumen lain
		 *
		 * Precondition:
		 * - Lecturer dengan role "Lecturer" ada di DB
		 * - docBodyRepo.findById() return version dengan documentId berbeda dari params.documentId
		 *
		 * Request params:
		 * - documentId → "doc-A"
		 * - documentBodyId → terdaftar, tapi milik dokumen lain ("doc-B")
		 *
		 * Request body:
		 * - lecturerUserId: valid
		 * - message: "pesan review"
		 *
		 * Expected: NotFoundError karena documentId tidak cocok
		 */
		it("should throw NotFoundError when documentBodyId belongs to a different document", async () => {
			req = mockAuthRequest("user-123", {
				params: {
					documentId: "doc-A",
					documentBodyId: "version-belongs-to-doc-B",
				},
				body: {
					lecturerUserId: "lecturer-123",
					message: "pesan review",
				},
			});

			jest.mocked(userRepository.findById).mockResolvedValue(mockLecturerUser);
			// documentBodyId terdaftar, tapi documentId-nya "doc-B" bukan "doc-A"
			jest.mocked(documentBodyRepository.findById).mockResolvedValue({
				...mockDocumentBody,
				documentBodyId: "version-belongs-to-doc-B",
				documentId: "doc-B", // berbeda dari params.documentId "doc-A"
			});

			await reviewController.createReview(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
			expect(reviewRepository.create).not.toHaveBeenCalled();
			expect(notificationRepository.create).not.toHaveBeenCalled();
		});
	});
	
	// describe("updateUser", () => {
	// 		const verifyUserUpdateSuccess = async (updatedUser: any) => {
	// 			await userController.updateUser(
	// 				mockReq as Request,
	// 				mockRes as Response,
	// 				next,
	// 			);

	// 			expect(mockRes.status).toHaveBeenCalledWith(200);
	// 			expect(mockRes.json).toHaveBeenCalledWith(
	// 				expect.objectContaining({
	// 					success: true,
	// 					data: { user: updatedUser },
	// 				}),
	// 			);
	// 		};

	// 		it("should update user if authorized", async () => {
	// 			const updates = { name: "John Updated" };
	// 			const updatedUser = { ...mockUser, ...updates };
	// 			jest.mocked(userRepository.findByUsername).mockResolvedValue(null);
	// 			jest.mocked(userRepository.update).mockResolvedValue(updatedUser);
	// 			mockReq.params = { userId: "user-123" };
	// 			mockReq.userId = "user-123";
	// 			mockReq.body = updates;

	// 			await verifyUserUpdateSuccess(updatedUser);
	// 		});

	// 		it("should throw error if updating another user's profile", async () => {
	// 			mockReq.params = { userId: "other-user" };
	// 			mockReq.userId = "user-123";

	// 			await userController.updateUser(
	// 				mockReq as Request,
	// 				mockRes as Response,
	// 				next,
	// 			);

	// 			expect(next).toHaveBeenCalledWith(expect.any(Error));
	// 			const error = next.mock.calls[0][0] as any;
	// 			expect(error.message).toBe("You can only update your own profile");
	// 		});

	// 		it("should update user username if not taken", async () => {
	// 			const updates = { username: "rina123" };
	// 			const updatedUser = { ...mockUser, ...updates };
	// 			jest.mocked(userRepository.findByUsername).mockResolvedValue(null);
	// 			jest.mocked(userRepository.update).mockResolvedValue(updatedUser);
	// 			mockReq.params = { userId: "user-123" };
	// 			mockReq.userId = "user-123";
	// 			mockReq.body = updates;

	// 			await verifyUserUpdateSuccess(updatedUser);
	// 		});

	// 		it("should throw ConflictError if username is already taken by another user", async () => {
	// 			const updates = { username: "alex99" };
	// 			const existingUser = {
	// 				...mockUser,
	// 				userId: "user-456",
	// 				username: "alex99",
	// 			};
	// 			jest
	// 				.mocked(userRepository.findByUsername)
	// 				.mockResolvedValue(existingUser as any);
	// 			mockReq.params = { userId: "user-123" };
	// 			mockReq.userId = "user-123";
	// 			mockReq.body = updates;

	// 			await userController.updateUser(
	// 				mockReq as Request,
	// 				mockRes as Response,
	// 				next,
	// 			);

	// 			expect(next).toHaveBeenCalledWith(expect.any(Error));
	// 			const error = next.mock.calls[0][0] as any;
	// 			expect(error.message).toBe("Username already taken");
	// 		});

	// 		it("should update user username if username belongs to the same user", async () => {
	// 			const updates = { username: "rina123" };
	// 			const existingUser = {
	// 				...mockUser,
	// 				userId: "user-123",
	// 				username: "rina123",
	// 			};
	// 			const updatedUser = { ...mockUser, ...updates };
	// 			jest
	// 				.mocked(userRepository.findByUsername)
	// 				.mockResolvedValue(existingUser as any);
	// 			jest.mocked(userRepository.update).mockResolvedValue(updatedUser);
	// 			mockReq.params = { userId: "user-123" };
	// 			mockReq.userId = "user-123";
	// 			mockReq.body = updates;

	// 			await verifyUserUpdateSuccess(updatedUser);
	// 		});
	// 	});
});
