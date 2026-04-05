import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from '../utils/responseFormatter';
import { NotFoundError } from '../utils/errorTypes';
import documentRepository from '../repositories/documentRepository';
import documentBodyRepository from '../repositories/documentBodyRepository';
import permissionService from '../services/permissionService';
import liveblocksWebhookService from '../services/liveblocksWebhookService';
import logger from '../utils/logger';

/**
 * Create a new document in workspace
 * POST /api/workspaces/:workspaceId/documents
 * Protected (requires editor role or higher)
 */
export const createDocument = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { title, description, content, message } = req.body;
  const userId = req.userId!;
  
  logger.info('Create document request', { workspaceId, title, userId });
  
  // Create document
  const document = await documentRepository.create({
    workspaceId,
    title,
    description,
    savedContent: content || '',
    currentVersionId: '',
    createdBy: userId,
  });
  
  // Create initial version
  const version = await documentBodyRepository.create({
    documentId: document.documentId,
    userId,
    content: content || '',
    message: message || 'Initial version',
    isCurrentVersion: true,
    versionNumber: 1,
  });
  
  // Update document with version reference
  const updatedDocument = await documentRepository.updateContent(
    document.documentId,
    content || '',
    version.documentBodyId
  );

  // Initialize document permissions (grant creator 'admin' permission)
  try {
    await permissionService.initializeDefaultDocumentPermissions(
      document.documentId,
      workspaceId,
      userId
    );
    logger.info('Document permissions initialized', { documentId: document.documentId, userId });
  } catch (permissionError) {
    logger.error('Failed to initialize document permissions:', permissionError);
    // Don't fail document creation if permission initialization fails
    // This is a non-critical operation
  }
  
  return createdResponse(
    res,
    { document: updatedDocument, initialVersion: version },
    'Document created successfully'
  );
});

/**
 * Get all documents in workspace
 * GET /api/workspaces/:workspaceId/documents
 * Protected (requires workspace access)
 */
export const getWorkspaceDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  
  logger.info('Get workspace documents request', { workspaceId });
  
  const documents = await documentRepository.findByWorkspace(workspaceId);
  
  return successResponse(
    res,
    { documents, count: documents.length },
    'Documents retrieved successfully'
  );
});

/**
 * Get document by ID
 * GET /api/workspaces/:workspaceId/documents/:documentId
 * Protected (requires workspace access)
 */
export const getDocumentById = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  
  logger.info('Get document request', { documentId });
  
  const document = await documentRepository.findById(documentId);
  
  if (!document) {
    throw new NotFoundError('Document not found');
  }
  
  // Get current version details
  let currentVersion = null;
  if (document.currentVersionId) {
    currentVersion = await documentBodyRepository.findById(document.currentVersionId);
  }
  
  return successResponse(
    res,
    { document, currentVersion },
    'Document retrieved successfully'
  );
});

/**
 * Get document with room state and active users (Consolidated endpoint)
 * GET /api/documents/:documentId/with-room-state
 * Protected (requires workspace access)
 * Returns: document + currentVersion + liveblocks room metadata in single call
 * Optimization: Reduces double-fetch pattern from client-side loading
 */
export const getDocumentWithRoomState = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  
  logger.info('Get document with room state', { documentId });
  
  const document = await documentRepository.findById(documentId);
  
  if (!document) {
    throw new NotFoundError('Document not found');
  }
  
  // Get current version details
  let currentVersion = null;
  if (document.currentVersionId) {
    currentVersion = await documentBodyRepository.findById(document.currentVersionId);
  }
  
  // Get Liveblocks room information
  // Room ID format: document:${documentId} (matching Liveblocks room naming convention)
  const roomId = `document:${documentId}`;
  let roomInfo: { id: string; activeUsers: number; status: 'active' | 'inactive' } = {
    id: roomId,
    activeUsers: 0,
    status: 'active',
  };
  
  try {
    // Fetch active users from Liveblocks API
    const activeUsers = await liveblocksWebhookService.getActiveUsers(roomId);
    roomInfo.activeUsers = activeUsers.length;
    logger.info(`Room ${roomId} has ${activeUsers.length} active users`);
  } catch (error: any) {
    // Room not found is expected for new documents - not an error condition
    if (error.message?.includes('Room not found')) {
      logger.info(`Room ${roomId} not found - document may be newly created`);
      roomInfo.status = 'inactive';
    } else {
      // Log other errors but don't fail the request
      logger.warn(`Could not fetch room info for ${roomId}:`, error);
    }
  }
  
  return successResponse(
    res,
    {
      document,
      currentVersion,
      room: roomInfo,
    },
    'Document with room state retrieved successfully'
  );
});

/**
 * Update document metadata (title only)
 * PUT /api/workspaces/:workspaceId/documents/:documentId
 * Protected (requires edit permission)
 */
export const updateDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const updates = req.body;
  
  logger.info('Update document request', { documentId, updates });
  
  const document = await documentRepository.update(documentId, updates);
  
  return successResponse(res, { document }, 'Document updated successfully');
});

/**
 * Update document content (creates new version)
 * PUT /api/workspaces/:workspaceId/documents/:documentId/content
 * Protected (requires edit permission)
 */
export const updateDocumentContent = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { content, message } = req.body;
  const userId = req.userId!;
  
  logger.info('Update document content request', { documentId, userId });
  
  // Get current highest version number
  const highestVersion = await documentBodyRepository.getLatestVersionNumber(documentId);
  const newVersionNumber = highestVersion + 1;
  
  // Mark all versions as not current
  await documentBodyRepository.setAllVersionsNotCurrent(documentId);
  
  // Create new version
  const version = await documentBodyRepository.create({
    documentId,
    userId,
    content,
    message: message || `Version ${newVersionNumber}`,
    isCurrentVersion: true,
    versionNumber: newVersionNumber,
  });
  
  // Update document with new content and version reference
  const document = await documentRepository.updateContent(
    documentId,
    content,
    version.documentBodyId
  );
  
  return successResponse(
    res,
    { document, version },
    'Document content updated successfully'
  );
});

/**
 * Delete document
 * DELETE /api/workspaces/:workspaceId/documents/:documentId
 * Protected (requires edit permission)
 */
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  
  logger.info('Delete document request', { documentId });
  
  // TODO: Implement cascade delete for versions, citations, comments, reviews
  await documentRepository.delete(documentId);
  
  return noContentResponse(res);
});

/**
 * Search documents in workspace
 * GET /api/workspaces/:workspaceId/documents/search?q=query
 * Protected (requires workspace access)
 */
export const searchDocuments = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { q } = req.query as { q: string };
  
  logger.info('Search documents request', { workspaceId, query: q });
  
  const documents = await documentRepository.searchByTitle(workspaceId, q);
  
  return successResponse(
    res,
    { documents, count: documents.length },
    'Documents retrieved successfully'
  );
});

/**
 * Get user's documents across all workspaces
 * GET /api/documents/my-documents
 * Protected
 */
export const getUserDocuments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!;
  
  logger.info('Get user documents request', { userId });
  
  const documents = await documentRepository.findByCreator(userId);
  
  return successResponse(
    res,
    { documents, count: documents.length },
    'Documents retrieved successfully'
  );
});

export default {
  createDocument,
  getWorkspaceDocuments,
  getDocumentById,
  getDocumentWithRoomState,
  updateDocument,
  updateDocumentContent,
  deleteDocument,
  searchDocuments,
  getUserDocuments,
};
