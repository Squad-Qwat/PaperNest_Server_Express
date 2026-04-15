import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from '../utils/responseFormatter';
import { NotFoundError } from '../utils/errorTypes';
import commentRepository from '../repositories/commentRepository';
import notificationRepository from '../repositories/notificationRepository';
import documentRepository from '../repositories/documentRepository';
import logger from '../utils/logger';

/**
 * Create a new comment
 * POST /api/documents/:documentId/comments
 * Protected (requires document access)
 */
export const createComment = asyncHandler(async (req: Request, res: Response) => {
  const documentId = req.params.documentId as string;
  const { content, textSelection, parentCommentId } = req.body;
  const userId = req.userId!;
  
  logger.info('Create comment request', { documentId, userId, parentCommentId });
  
  const comment = await commentRepository.create({
    documentId,
    userId,
    content,
    textSelection: textSelection || null,
    parentCommentId: parentCommentId || null,
    isResolved: false,
  });
  
  // Create notification for document owner (if not the commenter)
  const document = await documentRepository.findById(documentId);
  if (document && document.createdBy !== userId) {
    await notificationRepository.create({
      userId: document.createdBy,
      type: 'comment',
      title: 'New Comment',
      message: `New comment on "${document.title}"`,
      relatedId: comment.commentId,
      isRead: false,
    });
  }
  
  // If it's a reply, notify the parent comment author
  if (parentCommentId) {
    const parentComment = await commentRepository.findById(parentCommentId);
    if (parentComment && parentComment.userId !== userId) {
      await notificationRepository.create({
        userId: parentComment.userId,
        type: 'comment',
        title: 'Comment Reply',
        message: 'Someone replied to your comment',
        relatedId: comment.commentId,
        isRead: false,
      });
    }
  }
  
  return createdResponse(res, { comment }, 'Comment created successfully');
});

/**
 * Get all comments for a document
 * GET /api/documents/:documentId/comments
 * Protected (requires document access)
 */
export const getDocumentComments = asyncHandler(async (req: Request, res: Response) => {
  const documentId = req.params.documentId as string;
  const resolved = req.query.resolved as string | undefined;
  
  logger.info('Get document comments request', { documentId, resolved });
  
  let comments;
  
  if (resolved !== undefined) {
    const isResolved = resolved === 'true';
    comments = isResolved
      ? await commentRepository.findByDocument(documentId) // All comments
      : await commentRepository.findUnresolved(documentId);
  } else {
    comments = await commentRepository.findByDocument(documentId);
  }
  
  return successResponse(
    res,
    { comments, count: comments.length },
    'Comments retrieved successfully'
  );
});

/**
 * Get root comments (no parent)
 * GET /api/documents/:documentId/comments/root
 * Protected (requires document access)
 */
export const getRootComments = asyncHandler(async (req: Request, res: Response) => {
  const documentId = req.params.documentId as string;
  
  logger.info('Get root comments request', { documentId });
  
  const comments = await commentRepository.findTopLevelComments(documentId);
  
  return successResponse(
    res,
    { comments, count: comments.length },
    'Root comments retrieved successfully'
  );
});

/**
 * Get comment by ID
 * GET /api/documents/:documentId/comments/:commentId
 * Protected (requires document access)
 */
export const getCommentById = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  
  logger.info('Get comment request', { commentId });
  
  const comment = await commentRepository.findById(commentId);
  
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  
  return successResponse(res, { comment }, 'Comment retrieved successfully');
});

/**
 * Get replies to a comment
 * GET /api/documents/:documentId/comments/:commentId/replies
 * Protected (requires document access)
 */
export const getCommentReplies = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  
  logger.info('Get comment replies request', { commentId });
  
  const replies = await commentRepository.findReplies(commentId);
  
  return successResponse(
    res,
    { replies, count: replies.length },
    'Replies retrieved successfully'
  );
});

/**
 * Update comment
 * PUT /api/documents/:documentId/comments/:commentId
 * Protected (comment owner only)
 */
export const updateComment = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  const { content } = req.body;
  
  logger.info('Update comment request', { commentId });
  
  const comment = await commentRepository.update(commentId, { content });
  
  return successResponse(res, { comment }, 'Comment updated successfully');
});

/**
 * Mark comment as resolved
 * PUT /api/documents/:documentId/comments/:commentId/resolve
 * Protected (requires document access)
 */
export const resolveComment = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  
  logger.info('Resolve comment request', { commentId });
  
  const comment = await commentRepository.markAsResolved(commentId);
  
  return successResponse(res, { comment }, 'Comment marked as resolved');
});

/**
 * Mark comment as unresolved
 * PUT /api/documents/:documentId/comments/:commentId/unresolve
 * Protected (requires document access)
 */
export const unresolveComment = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  
  logger.info('Unresolve comment request', { commentId });
  
  const comment = await commentRepository.markAsUnresolved(commentId);
  
  return successResponse(res, { comment }, 'Comment marked as unresolved');
});

/**
 * Delete comment
 * DELETE /api/documents/:documentId/comments/:commentId
 * Protected (comment owner only)
 */
export const deleteComment = asyncHandler(async (req: Request, res: Response) => {
  const commentId = req.params.commentId as string;
  
  logger.info('Delete comment request', { commentId });
  
  // This will also delete all replies (cascade)
  await commentRepository.deleteWithReplies(commentId);
  
  return noContentResponse(res);
});

/**
 * Get user's comments
 * GET /api/comments/my-comments
 * Protected
 */
export const getUserComments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  logger.info('Get user comments request', { userId });
  
  const comments = await commentRepository.findByUser(userId);
  
  return successResponse(
    res,
    { comments, count: comments.length },
    'Comments retrieved successfully'
  );
});

export default {
  createComment,
  getDocumentComments,
  getRootComments,
  getCommentById,
  getCommentReplies,
  updateComment,
  resolveComment,
  unresolveComment,
  deleteComment,
  getUserComments,
};
