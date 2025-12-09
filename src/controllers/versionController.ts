import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse, createdResponse } from '../utils/responseFormatter';
import { NotFoundError, BadRequestError } from '../utils/errorTypes';
import documentBodyRepository from '../repositories/documentBodyRepository';
import documentRepository from '../repositories/documentRepository';
import logger from '../utils/logger';

/**
 * Get all versions of a document
 * GET /api/documents/:documentId/versions
 * Protected (requires document access)
 */
export const getDocumentVersions = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  
  logger.info('Get document versions request', { documentId });
  
  const versions = await documentBodyRepository.findByDocument(documentId);
  
  return successResponse(
    res,
    { versions, count: versions.length },
    'Versions retrieved successfully'
  );
});

/**
 * Get current version of a document
 * GET /api/documents/:documentId/versions/current
 * Protected (requires document access)
 */
export const getCurrentVersion = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  
  logger.info('Get current version request', { documentId });
  
  const version = await documentBodyRepository.findCurrentVersion(documentId);
  
  if (!version) {
    throw new NotFoundError('No current version found');
  }
  
  return successResponse(res, { version }, 'Current version retrieved successfully');
});

/**
 * Get specific version by version number
 * GET /api/documents/:documentId/versions/:versionNumber
 * Protected (requires document access)
 */
export const getVersionByNumber = asyncHandler(async (req: Request, res: Response) => {
  const { documentId, versionNumber } = req.params;
  const versionNum = parseInt(versionNumber);
  
  logger.info('Get version by number request', { documentId, versionNumber: versionNum });
  
  if (isNaN(versionNum) || versionNum < 1) {
    throw new BadRequestError('Invalid version number');
  }
  
  const version = await documentBodyRepository.findByVersionNumber(documentId, versionNum);
  
  if (!version) {
    throw new NotFoundError('Version not found');
  }
  
  return successResponse(res, { version }, 'Version retrieved successfully');
});

/**
 * Create a new version manually (alternative to updating document content)
 * POST /api/documents/:documentId/versions
 * Protected (requires edit permission)
 */
export const createVersion = asyncHandler(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { content, message } = req.body;
  const userId = req.userId!;
  
  logger.info('Create version request', { documentId, userId });
  
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
  await documentRepository.updateContent(documentId, content, version.documentBodyId);
  
  return createdResponse(res, { version }, 'Version created successfully');
});

/**
 * Revert document to a specific version
 * POST /api/documents/:documentId/versions/:versionNumber/revert
 * Protected (requires edit permission)
 */
export const revertToVersion = asyncHandler(async (req: Request, res: Response) => {
  const { documentId, versionNumber } = req.params;
  const userId = req.userId!;
  const versionNum = parseInt(versionNumber);
  
  logger.info('Revert to version request', { documentId, versionNumber: versionNum, userId });
  
  if (isNaN(versionNum) || versionNum < 1) {
    throw new BadRequestError('Invalid version number');
  }
  
  // Get the version to revert to
  const targetVersion = await documentBodyRepository.findByVersionNumber(documentId, versionNum);
  
  if (!targetVersion) {
    throw new NotFoundError('Version not found');
  }
  
  // Get current highest version number
  const highestVersion = await documentBodyRepository.getLatestVersionNumber(documentId);
  const newVersionNumber = highestVersion + 1;
  
  // Mark all versions as not current
  await documentBodyRepository.setAllVersionsNotCurrent(documentId);
  
  // Create new version with content from target version
  const newVersion = await documentBodyRepository.create({
    documentId,
    userId,
    content: targetVersion.content,
    message: `Reverted to version ${versionNum}`,
    isCurrentVersion: true,
    versionNumber: newVersionNumber,
  });
  
  // Update document with reverted content
  await documentRepository.updateContent(
    documentId,
    targetVersion.content,
    newVersion.documentBodyId
  );
  
  return successResponse(
    res,
    { version: newVersion, revertedFrom: targetVersion },
    `Document reverted to version ${versionNum} successfully`
  );
});

export default {
  getDocumentVersions,
  getCurrentVersion,
  getVersionByNumber,
  createVersion,
  revertToVersion,
};
