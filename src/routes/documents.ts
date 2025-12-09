import { Router } from 'express';
import * as documentController from '../controllers/documentController';
import * as versionController from '../controllers/versionController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  authorizeWorkspace,
  authorizeDocument,
  authorizeDocumentEdit,
} from '../middlewares/authorization';
import {
  createDocumentSchema,
  updateDocumentSchema,
  updateDocumentContentSchema,
  searchDocumentSchema,
} from '../models/validators/documentValidator';
import {
  createVersionSchema,
  versionNumberSchema,
} from '../models/validators/versionValidator';

const router = Router();

/**
 * @route   GET /api/documents/my-documents
 * @desc    Get user's documents across all workspaces
 * @access  Protected
 */
router.get(
  '/my-documents',
  authenticate,
  documentController.getUserDocuments
);

/**
 * Workspace-specific document routes
 */

/**
 * @route   POST /api/workspaces/:workspaceId/documents
 * @desc    Create a new document in workspace
 * @access  Protected (requires editor role or higher)
 */
router.post(
  '/workspaces/:workspaceId/documents',
  authenticate,
  authorizeWorkspace('editor'),
  validate({ body: createDocumentSchema }),
  documentController.createDocument
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents/search?q=query
 * @desc    Search documents in workspace
 * @access  Protected (requires workspace access)
 */
router.get(
  '/workspaces/:workspaceId/documents/search',
  authenticate,
  authorizeWorkspace(),
  validate({ query: searchDocumentSchema }),
  documentController.searchDocuments
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents
 * @desc    Get all documents in workspace
 * @access  Protected (requires workspace access)
 */
router.get(
  '/workspaces/:workspaceId/documents',
  authenticate,
  authorizeWorkspace(),
  documentController.getWorkspaceDocuments
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents/:documentId
 * @desc    Get document by ID
 * @access  Protected (requires workspace access)
 */
router.get(
  '/workspaces/:workspaceId/documents/:documentId',
  authenticate,
  authorizeDocument,
  documentController.getDocumentById
);

/**
 * @route   PUT /api/workspaces/:workspaceId/documents/:documentId
 * @desc    Update document metadata
 * @access  Protected (requires edit permission)
 */
router.put(
  '/workspaces/:workspaceId/documents/:documentId',
  authenticate,
  authorizeDocumentEdit,
  validate({ body: updateDocumentSchema }),
  documentController.updateDocument
);

/**
 * @route   PUT /api/workspaces/:workspaceId/documents/:documentId/content
 * @desc    Update document content (creates new version)
 * @access  Protected (requires edit permission)
 */
router.put(
  '/workspaces/:workspaceId/documents/:documentId/content',
  authenticate,
  authorizeDocumentEdit,
  validate({ body: updateDocumentContentSchema }),
  documentController.updateDocumentContent
);

/**
 * @route   DELETE /api/workspaces/:workspaceId/documents/:documentId
 * @desc    Delete document
 * @access  Protected (requires edit permission)
 */
router.delete(
  '/workspaces/:workspaceId/documents/:documentId',
  authenticate,
  authorizeDocumentEdit,
  documentController.deleteDocument
);

/**
 * Document version routes (non-nested)
 */

/**
 * @route   GET /api/documents/:documentId/versions
 * @desc    Get all versions of a document
 * @access  Protected (requires document access)
 */
router.get(
  '/documents/:documentId/versions',
  authenticate,
  authorizeDocument,
  versionController.getDocumentVersions
);

/**
 * @route   GET /api/documents/:documentId/versions/current
 * @desc    Get current version of a document
 * @access  Protected (requires document access)
 */
router.get(
  '/documents/:documentId/versions/current',
  authenticate,
  authorizeDocument,
  versionController.getCurrentVersion
);

/**
 * @route   POST /api/documents/:documentId/versions
 * @desc    Create a new version
 * @access  Protected (requires edit permission)
 */
router.post(
  '/documents/:documentId/versions',
  authenticate,
  authorizeDocumentEdit,
  validate({ body: createVersionSchema }),
  versionController.createVersion
);

/**
 * @route   GET /api/documents/:documentId/versions/:versionNumber
 * @desc    Get specific version by number
 * @access  Protected (requires document access)
 */
router.get(
  '/documents/:documentId/versions/:versionNumber',
  authenticate,
  authorizeDocument,
  versionController.getVersionByNumber
);

/**
 * @route   POST /api/documents/:documentId/versions/:versionNumber/revert
 * @desc    Revert document to a specific version
 * @access  Protected (requires edit permission)
 */
router.post(
  '/documents/:documentId/versions/:versionNumber/revert',
  authenticate,
  authorizeDocumentEdit,
  versionController.revertToVersion
);

export default router;
