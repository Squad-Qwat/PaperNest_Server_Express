import { Router } from "express";
import * as documentController from "../controllers/documentController";
import * as versionController from "../controllers/versionController";
import { authenticate } from "../middlewares/auth";
import {
	authorizeDocument,
	authorizeDocumentEdit,
	authorizeDocumentPermission,
	authorizeWorkspace,
} from "../middlewares/authorization";
import { validate } from "../middlewares/validation";
import { batchOperationRequestSchema } from "../models/validators/batchOperationValidator";
import {
	createDocumentSchema,
	searchDocumentSchema,
	updateDocumentContentSchema,
	updateDocumentSchema,
} from "../models/validators/documentValidator";
import {
	createVersionSchema,
} from "../models/validators/versionValidator";

const router: Router = Router();

/**
 * @route   GET /api/documents/my-documents
 */
router.get(
	"/documents/my-documents",
	authenticate,
	documentController.getUserDocuments,
);

/**
 * @route   GET /api/documents/:documentId/with-room-state
 */
router.get(
	"/documents/:documentId/with-room-state",
	authenticate,
	authorizeDocument,
	documentController.getDocumentWithRoomState,
);

/**
 * Workspace-specific document routes
 */

/**
 * @route   POST /api/workspaces/:workspaceId/documents
 */
router.post(
	"/workspaces/:workspaceId/documents",
	authenticate,
	authorizeWorkspace("editor"),
	validate({ body: createDocumentSchema }),
	documentController.createDocument,
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents/search
 */
router.get(
	"/workspaces/:workspaceId/documents/search",
	authenticate,
	authorizeWorkspace(),
	validate({ query: searchDocumentSchema }),
	documentController.searchDocuments,
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents
 */
router.get(
	"/workspaces/:workspaceId/documents",
	authenticate,
	authorizeWorkspace(),
	documentController.getWorkspaceDocuments,
);

/**
 * @route   GET /api/workspaces/:workspaceId/documents/:documentId
 */
router.get(
	"/workspaces/:workspaceId/documents/:documentId",
	authenticate,
	authorizeDocument,
	documentController.getDocumentById,
);

/**
 * @route   PUT /api/workspaces/:workspaceId/documents/:documentId
 */
router.put(
	"/workspaces/:workspaceId/documents/:documentId",
	authenticate,
	authorizeDocumentEdit,
	validate({ body: updateDocumentSchema }),
	documentController.updateDocument,
);

/**
 * @route   PUT /api/workspaces/:workspaceId/documents/:documentId/content
 */
router.put(
	"/workspaces/:workspaceId/documents/:documentId/content",
	authenticate,
	authorizeDocumentEdit,
	validate({ body: updateDocumentContentSchema }),
	documentController.updateDocumentContent,
);

/**
 * @route   DELETE /api/workspaces/:workspaceId/documents/:documentId
 */
router.delete(
	"/workspaces/:workspaceId/documents/:documentId",
	authenticate,
	authorizeDocumentEdit,
	documentController.deleteDocument,
);

/**
 * Document version routes
 */

/**
 * @route   GET /api/documents/:documentId/versions
 */
router.get(
	"/documents/:documentId/versions",
	authenticate,
	authorizeDocument,
	versionController.getDocumentVersions,
);

/**
 * @route   GET /api/documents/:documentId/versions/current
 */
router.get(
	"/documents/:documentId/versions/current",
	authenticate,
	authorizeDocument,
	versionController.getCurrentVersion,
);

/**
 * @route   POST /api/documents/:documentId/versions
 */
router.post(
	"/documents/:documentId/versions",
	authenticate,
	authorizeDocumentEdit,
	validate({ body: createVersionSchema }),
	versionController.createVersion,
);

/**
 * @route   GET /api/documents/:documentId/versions/:versionNumber
 */
router.get(
	"/documents/:documentId/versions/:versionNumber",
	authenticate,
	authorizeDocument,
	versionController.getVersionByNumber,
);

/**
 * @route   POST /api/documents/:documentId/versions/:versionNumber/revert
 */
router.post(
	"/documents/:documentId/versions/:versionNumber/revert",
	authenticate,
	authorizeDocumentEdit,
	versionController.revertToVersion,
);

/**
 * @route   POST /api/documents/:documentId/batch
 * @desc    Execute atomic batch operations
 * @access  Protected (requires editor permission on document)
 * 
 * IMPLEMENTATION: Uses lazy loading for the batch controller to prevent 
 * startup dependency cycles.
 */
router.post(
	"/documents/:documentId/batch",
	authenticate,
	authorizeDocumentPermission("editor"),
	validate({ body: batchOperationRequestSchema }),
	async (req, res, next) => {
		try {
			// Dynamic import to break dependency cycle and heavy load at startup
			const batchController = await import("../controllers/batchOperationController");
			// Since it's a default export of an object in the original file
			const controller = (batchController as any).default || batchController;
			return controller.executeBatchOperations(req, res, next);
		} catch (error) {
			next(error);
		}
	},
);

export default router;
