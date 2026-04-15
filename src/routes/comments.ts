import { Router } from 'express';
import * as commentController from '../controllers/commentController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  authorizeDocument,
  authorizeCommentOwner,
} from '../middlewares/authorization';
import {
  createCommentSchema,
  updateCommentSchema,
  filterCommentResolvedSchema,
} from '../models/validators/commentValidator';

const router: Router = Router();

/**
 * @route   GET /api/comments/my-comments
 * @desc    Get user's comments across all documents
 * @access  Protected
 */
router.get(
  '/my-comments',
  authenticate,
  commentController.getUserComments
);

/**
 * Document-specific comment routes
 */

/**
 * @route   POST /api/documents/:documentId/comments
 * @desc    Create a new comment
 * @access  Protected (requires document access)
 */
router.post(
  '/:documentId/comments',
  authenticate,
  authorizeDocument,
  validate({ body: createCommentSchema }),
  commentController.createComment
);

/**
 * @route   GET /api/documents/:documentId/comments/root
 * @desc    Get root comments (no parent)
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/comments/root',
  authenticate,
  authorizeDocument,
  commentController.getRootComments
);

/**
 * @route   GET /api/documents/:documentId/comments
 * @desc    Get all comments for a document (can filter by resolved status)
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/comments',
  authenticate,
  authorizeDocument,
  commentController.getDocumentComments
);

/**
 * @route   GET /api/documents/:documentId/comments/:commentId
 * @desc    Get comment by ID
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/comments/:commentId',
  authenticate,
  authorizeDocument,
  commentController.getCommentById
);

/**
 * @route   GET /api/documents/:documentId/comments/:commentId/replies
 * @desc    Get replies to a comment
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/comments/:commentId/replies',
  authenticate,
  authorizeDocument,
  commentController.getCommentReplies
);

/**
 * @route   PUT /api/documents/:documentId/comments/:commentId
 * @desc    Update comment
 * @access  Protected (comment owner only)
 */
router.put(
  '/:documentId/comments/:commentId',
  authenticate,
  authorizeCommentOwner,
  validate({ body: updateCommentSchema }),
  commentController.updateComment
);

/**
 * @route   PUT /api/documents/:documentId/comments/:commentId/resolve
 * @desc    Mark comment as resolved
 * @access  Protected (requires document access)
 */
router.put(
  '/:documentId/comments/:commentId/resolve',
  authenticate,
  authorizeDocument,
  commentController.resolveComment
);

/**
 * @route   PUT /api/documents/:documentId/comments/:commentId/unresolve
 * @desc    Mark comment as unresolved
 * @access  Protected (requires document access)
 */
router.put(
  '/:documentId/comments/:commentId/unresolve',
  authenticate,
  authorizeDocument,
  commentController.unresolveComment
);

/**
 * @route   DELETE /api/documents/:documentId/comments/:commentId
 * @desc    Delete comment (and all replies)
 * @access  Protected (comment owner only)
 */
router.delete(
  '/:documentId/comments/:commentId',
  authenticate,
  authorizeCommentOwner,
  commentController.deleteComment
);

export default router;
