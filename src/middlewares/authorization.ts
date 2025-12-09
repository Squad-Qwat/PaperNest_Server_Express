import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/errorTypes';
import userWorkspaceRepository from '../repositories/userWorkspaceRepository';
import workspaceRepository from '../repositories/workspaceRepository';
import documentRepository from '../repositories/documentRepository';
import commentRepository from '../repositories/commentRepository';
import reviewRepository from '../repositories/reviewRepository';
import logger from '../utils/logger';

/**
 * Check if user has access to a workspace with minimum role requirement
 */
export const authorizeWorkspace = (minRole?: 'owner' | 'editor' | 'viewer' | 'reviewer') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = req.params.workspaceId;
      const userId = req.userId;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!workspaceId) {
        throw new Error('Workspace ID is required');
      }

      // Check if workspace exists
      const workspaceExists = await workspaceRepository.exists(workspaceId);
      if (!workspaceExists) {
        throw new NotFoundError('Workspace not found');
      }

      // Check if user has access
      const hasAccess = await userWorkspaceRepository.hasAccess(userId, workspaceId);
      if (!hasAccess) {
        throw new ForbiddenError('You do not have access to this workspace');
      }

      // If minimum role is specified, check role hierarchy
      if (minRole) {
        const userRole = await userWorkspaceRepository.getUserRole(userId, workspaceId);
        
        const roleHierarchy = {
          owner: 4,
          editor: 3,
          reviewer: 2,
          viewer: 1,
        };

        const userRoleLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
        const minRoleLevel = roleHierarchy[minRole] || 0;

        if (userRoleLevel < minRoleLevel) {
          throw new ForbiddenError(`This action requires ${minRole} role or higher`);
        }

        // Attach role to request for further use
        req.user = { ...req.user, workspaceRole: userRole } as any;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user is the workspace owner
 */
export const authorizeWorkspaceOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!workspaceId) {
      throw new Error('Workspace ID is required');
    }

    const workspace = await workspaceRepository.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('Only workspace owner can perform this action');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has access to a document through workspace membership
 */
export const authorizeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    // Get document to find workspace
    const document = await documentRepository.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Check workspace access
    const hasAccess = await userWorkspaceRepository.hasAccess(userId, document.workspaceId);
    if (!hasAccess) {
      throw new ForbiddenError('You do not have access to this document');
    }

    // Attach document and workspace info to request
    (req as any).document = document;
    (req as any).workspaceId = document.workspaceId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user can edit a document (must be editor or owner, or document creator)
 */
export const authorizeDocumentEdit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const documentId = req.params.documentId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!documentId) {
      throw new Error('Document ID is required');
    }

    const document = await documentRepository.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Get user's role in workspace
    const userRole = await userWorkspaceRepository.getUserRole(userId, document.workspaceId);

    // Check if user can edit (owner, editor, or document creator)
    const canEdit = userRole === 'owner' || userRole === 'editor' || document.createdBy === userId;

    if (!canEdit) {
      throw new ForbiddenError('You do not have permission to edit this document');
    }

    (req as any).document = document;
    (req as any).workspaceId = document.workspaceId;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user owns a comment
 */
export const authorizeCommentOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!commentId) {
      throw new Error('Comment ID is required');
    }

    const comment = await commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenError('You can only edit or delete your own comments');
    }

    (req as any).comment = comment;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is a lecturer (for review operations)
 */
export const authorizeLecturer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!req.user) {
      throw new Error('User information not found in request');
    }

    if (req.user.role !== 'Lecturer') {
      throw new ForbiddenError('Only lecturers can perform this action');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is involved in a review (as lecturer or student)
 */
export const authorizeReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewId = req.params.reviewId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!reviewId) {
      throw new Error('Review ID is required');
    }

    const review = await reviewRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Check if user is either the lecturer or student involved
    const isInvolved = review.lecturerUserId === userId || review.studentUserId === userId;

    if (!isInvolved) {
      throw new ForbiddenError('You do not have access to this review');
    }

    (req as any).review = review;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is the assigned lecturer for a review
 */
export const authorizeReviewLecturer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewId = req.params.reviewId;
    const userId = req.userId;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!reviewId) {
      throw new Error('Review ID is required');
    }

    const review = await reviewRepository.findById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }

    if (review.lecturerUserId !== userId) {
      throw new ForbiddenError('Only the assigned lecturer can perform this action');
    }

    (req as any).review = review;

    next();
  } catch (error) {
    next(error);
  }
};

export default {
  authorizeWorkspace,
  authorizeWorkspaceOwner,
  authorizeDocument,
  authorizeDocumentEdit,
  authorizeCommentOwner,
  authorizeLecturer,
  authorizeReview,
  authorizeReviewLecturer,
};
