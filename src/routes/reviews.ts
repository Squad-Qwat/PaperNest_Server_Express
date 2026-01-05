import { Router } from 'express';
import * as reviewController from '../controllers/reviewController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  authorizeDocument,
  authorizeLecturer,
  authorizeReview,
  authorizeReviewLecturer,
  authorizeReviewStudent,
} from '../middlewares/authorization';
import {
  createReviewSchema,
  updateReviewSchema,
  updateReviewStatusSchema,
  filterReviewStatusSchema,
} from '../models/validators/reviewValidator';

const router = Router();

/**
 * @route   GET /api/reviews
 * @desc    Get all reviews for current user (filtered by role)
 * @access  Protected
 */
router.get(
  '/reviews',
  authenticate,
  reviewController.getUserReviews
);

/**
 * @route   GET /api/reviews/pending
 * @desc    Get pending reviews for lecturer
 * @access  Protected (lecturer only)
 */
router.get(
  '/reviews/pending',
  authenticate,
  authorizeLecturer,
  reviewController.getPendingReviews
);

/**
 * @route   GET /api/reviews/:reviewId
 * @desc    Get review by ID
 * @access  Protected (must be involved in review)
 */
router.get(
  '/reviews/:reviewId',
  authenticate,
  authorizeReview,
  reviewController.getReviewById
);

/**
 * @route   PUT /api/reviews/:reviewId
 * @desc    Update review message
 * @access  Protected (assigned lecturer only)
 */
router.put(
  '/reviews/:reviewId',
  authenticate,
  authorizeReviewLecturer,
  validate({ body: updateReviewSchema }),
  reviewController.updateReview
);

/**
 * @route   POST /api/reviews/:reviewId/approve
 * @desc    Approve review
 * @access  Protected (assigned lecturer only)
 */
router.post(
  '/reviews/:reviewId/approve',
  authenticate,
  authorizeReviewLecturer,
  reviewController.approveReview
);

/**
 * @route   POST /api/reviews/:reviewId/reject
 * @desc    Reject review
 * @access  Protected (assigned lecturer only)
 */
router.post(
  '/reviews/:reviewId/reject',
  authenticate,
  authorizeReviewLecturer,
  validate({ body: updateReviewStatusSchema }),
  reviewController.rejectReview
);

/**
 * @route   POST /api/reviews/:reviewId/request-revision
 * @desc    Request revision
 * @access  Protected (assigned lecturer only)
 */
router.post(
  '/reviews/:reviewId/request-revision',
  authenticate,
  authorizeReviewLecturer,
  validate({ body: updateReviewStatusSchema }),
  reviewController.requestRevision
);

/**
 * @route   DELETE /api/reviews/:reviewId
 * @desc    Delete review (only if pending)
 * @access  Protected (student who created it)
 */
router.delete(
  '/reviews/:reviewId',
  authenticate,
  authorizeReviewStudent,
  reviewController.deleteReview
);

/**
 * Document-specific review routes
 */

/**
 * @route   POST /api/documents/:documentId/versions/:documentBodyId/reviews
 * @desc    Create a review request for a document version
 * @access  Protected (requires document access)
 */
router.post(
  '/documents/:documentId/versions/:documentBodyId/reviews',
  authenticate,
  authorizeDocument,
  validate({ body: createReviewSchema }),
  reviewController.createReview
);

/**
 * @route   GET /api/documents/:documentId/reviews
 * @desc    Get all reviews for a document
 * @access  Protected (requires document access)
 */
router.get(
  '/documents/:documentId/reviews',
  authenticate,
  authorizeDocument,
  reviewController.getDocumentReviews
);

export default router;
