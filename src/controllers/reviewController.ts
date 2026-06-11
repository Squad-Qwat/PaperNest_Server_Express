import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import documentBodyRepository from "../repositories/documentBodyRepository";
import notificationRepository from "../repositories/notificationRepository";
import reviewRepository from "../repositories/reviewRepository";
import userRepository from "../repositories/userRepository";
import type { Review } from "../types";
import {
	BadRequestError,
	ForbiddenError,
	NotFoundError,
} from "../utils/errorTypes";
import logger from "../utils/logger";
import {
	createdResponse,
	noContentResponse,
	successResponse,
} from "../utils/responseFormatter";

// Helper to populate student and lecturer user details on multiple reviews
const populateReviewUsers = async (reviews: Review[]): Promise<any[]> => {
	if (reviews.length === 0) return [];

	const studentIds = reviews.map((r) => r.studentUserId);
	const lecturerIds = reviews.map((r) => r.lecturerUserId);
	const allUserIds = [...new Set([...studentIds, ...lecturerIds])];
	const users = await userRepository.findByIds(allUserIds);
	const userMap = new Map(users.map((u) => [u.userId, u]));

	return reviews.map((review) => {
		const student = userMap.get(review.studentUserId);
		const lecturer = userMap.get(review.lecturerUserId);
		return {
			...review,
			student: student
				? {
						name: student.name,
						photoURL: student.photoURL || null,
				  }
				: undefined,
			lecturer: lecturer
				? {
						name: lecturer.name,
						photoURL: lecturer.photoURL || null,
				  }
				: undefined,
		};
	});
};

// Helper to populate student and lecturer user details on a single review
const populateSingleReviewUsers = async (review: Review): Promise<any> => {
	const student = await userRepository.findById(review.studentUserId);
	const lecturer = await userRepository.findById(review.lecturerUserId);
	return {
		...review,
		student: student
			? {
					name: student.name,
					photoURL: student.photoURL || null,
			  }
			: undefined,
		lecturer: lecturer
			? {
					name: lecturer.name,
					photoURL: lecturer.photoURL || null,
			  }
			: undefined,
	};
};

/**
 * Create a review request
 * POST /api/documents/:documentId/versions/:documentBodyId/reviews
 * Protected (student requesting review)
 */
export const createReview = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const documentBodyId = req.params.documentBodyId as string;
		const { lecturerUserId, message } = req.body;
		const studentUserId = req.userId!;

		logger.info("Create review request", {
			documentId,
			documentBodyId,
			lecturerUserId,
			studentUserId,
		});

		// Verify lecturer exists and has Lecturer role
		const lecturer = await userRepository.findById(lecturerUserId);
		if (!lecturer) {
			throw new NotFoundError("Lecturer not found");
		}
		if (lecturer.role !== "Lecturer") {
			throw new BadRequestError("Selected user is not a lecturer");
		}

		// Verify document version exists
		const version = await documentBodyRepository.findById(documentBodyId);
		if (!version || version.documentId !== documentId) {
			throw new NotFoundError("Document version not found");
		}

		// Create review
		const review = await reviewRepository.create({
			documentBodyId,
			documentId,
			lecturerUserId,
			studentUserId,
			message: message || "",
			status: "pending",
			requestedAt: new Date(),
			reviewedAt: null,
		});

		// Create notification for lecturer
		await notificationRepository.create({
			userId: lecturerUserId,
			type: "review_request",
			title: "New Review Request",
			message: `You have a new review request from ${req.user?.name}`,
			relatedId: review.reviewId,
			isRead: false,
		});

		const populatedReview = await populateSingleReviewUsers(review);

		return createdResponse(
			res,
			{ review: populatedReview },
			"Review request created successfully",
		);
	},
);

/**
 * Get all reviews (filtered by user role)
 * GET /api/reviews
 * Protected
 */
export const getUserReviews = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;
		const status = req.query.status as string | undefined;

		logger.info("Get user reviews request", { userId, status });

		let reviews: Review[];

		if (req.user?.role === "Lecturer") {
			// Get reviews assigned to this lecturer
			if (status) {
				const allReviews = await reviewRepository.findByLecturer(userId);
				reviews = allReviews.filter((r) => r.status === status);
			} else {
				reviews = await reviewRepository.findByLecturer(userId);
			}
		} else {
			// Get reviews requested by this student
			if (status) {
				const allReviews = await reviewRepository.findByStudent(userId);
				reviews = allReviews.filter((r) => r.status === status);
			} else {
				reviews = await reviewRepository.findByStudent(userId);
			}
		}

		const populatedReviews = await populateReviewUsers(reviews);

		return successResponse(
			res,
			{ reviews: populatedReviews, count: reviews.length },
			"Reviews retrieved successfully",
		);
	},
);

/**
 * Get pending reviews for lecturer
 * GET /api/reviews/pending
 * Protected (lecturer only)
 */
export const getPendingReviews = asyncHandler(
	async (req: Request, res: Response) => {
		const userId = req.userId!;

		logger.info("Get pending reviews request", { userId });

		const reviews = await reviewRepository.findPendingByLecturer(userId);
		const populatedReviews = await populateReviewUsers(reviews);

		return successResponse(
			res,
			{ reviews: populatedReviews, count: reviews.length },
			"Pending reviews retrieved successfully",
		);
	},
);

/**
 * Get all reviews for a document
 * GET /api/documents/:documentId/reviews
 * Protected (requires document access)
 */
export const getDocumentReviews = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;

		logger.info("Get document reviews request", { documentId });

		const reviews = await reviewRepository.findByDocument(documentId);
		const populatedReviews = await populateReviewUsers(reviews);

		return successResponse(
			res,
			{ reviews: populatedReviews, count: reviews.length },
			"Reviews retrieved successfully",
		);
	},
);

/**
 * Get review by ID
 * GET /api/reviews/:reviewId
 * Protected (must be involved in review)
 */
export const getReviewById = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;

		logger.info("Get review request", { reviewId });

		const review = await reviewRepository.findById(reviewId);

		if (!review) {
			throw new NotFoundError("Review not found");
		}

		const populatedReview = await populateSingleReviewUsers(review);

		return successResponse(res, { review: populatedReview }, "Review retrieved successfully");
	},
);

/**
 * Update review message
 * PUT /api/reviews/:reviewId
 * Protected (lecturer only)
 */
export const updateReview = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;
		const { message } = req.body;

		logger.info("Update review request", { reviewId });

		const review = await reviewRepository.update(reviewId, { message });
		const populatedReview = await populateSingleReviewUsers(review);

		return successResponse(res, { review: populatedReview }, "Review updated successfully");
	},
);

/**
 * Approve review
 * POST /api/reviews/:reviewId/approve
 * Protected (assigned lecturer only)
 */
export const approveReview = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;
		const { message } = req.body;

		logger.info("Approve review request", { reviewId });
		const review = await reviewRepository.updateStatus(
			reviewId,
			"approved",
			message || "",
		);

		// Create notification for student
		await notificationRepository.create({
			userId: review.studentUserId,
			type: "review_completed",
			title: "Review Approved",
			message: "Your document has been approved",
			relatedId: reviewId,
			isRead: false,
		});

		const populatedReview = await populateSingleReviewUsers(review);

		return successResponse(res, { review: populatedReview }, "Review approved successfully");
	},
);

/**
 * Reject review
 * POST /api/reviews/:reviewId/reject
 * Protected (assigned lecturer only)
 */
export const rejectReview = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;
		const { message } = req.body;

		logger.info("Reject review request", { reviewId });
		const review = await reviewRepository.updateStatus(
			reviewId,
			"rejected",
			message || "",
		);

		// Create notification for student
		await notificationRepository.create({
			userId: review.studentUserId,
			type: "review_completed",
			title: "Review Rejected",
			message: "Your document has been rejected",
			relatedId: reviewId,
			isRead: false,
		});

		const populatedReview = await populateSingleReviewUsers(review);

		return successResponse(res, { review: populatedReview }, "Review rejected successfully");
	},
);

/**
 * Request revision
 * POST /api/reviews/:reviewId/request-revision
 * Protected (assigned lecturer only)
 */
export const requestRevision = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;
		const { message } = req.body;

		logger.info("Request revision request", { reviewId });

		if (!message) {
			throw new BadRequestError("Message is required when requesting revision");
		}

		const review = await reviewRepository.updateStatus(
			reviewId,
			"revision_required",
			message,
		);

		// Create notification for student
		await notificationRepository.create({
			userId: review.studentUserId,
			type: "review_completed",
			title: "Revision Required",
			message: "Your document requires revision",
			relatedId: reviewId,
			isRead: false,
		});

		const populatedReview = await populateSingleReviewUsers(review);

		return successResponse(res, { review: populatedReview }, "Revision requested successfully");
	},
);

/**
 * Delete review
 * DELETE /api/reviews/:reviewId
 * Protected (student who created it or admin)
 */
export const deleteReview = asyncHandler(
	async (req: Request, res: Response) => {
		const reviewId = req.params.reviewId as string;
		const userId = req.userId!;

		logger.info("Delete review request", { reviewId });

		const review = await reviewRepository.findById(reviewId);

		if (!review) {
			throw new NotFoundError("Review not found");
		}

		// Only student who created the review can delete it (and only if pending)
		if (review.studentUserId !== userId) {
			throw new ForbiddenError("You can only delete your own review requests");
		}

		if (review.status !== "pending") {
			throw new ForbiddenError("Cannot delete review that has been processed");
		}

		await Promise.all([
			reviewRepository.delete(reviewId),
			notificationRepository.deleteByRelatedId(reviewId),
		]);

		return noContentResponse(res);
	},
);

export default {
	createReview,
	getUserReviews,
	getPendingReviews,
	getDocumentReviews,
	getReviewById,
	updateReview,
	approveReview,
	rejectReview,
	requestRevision,
	deleteReview,
};
