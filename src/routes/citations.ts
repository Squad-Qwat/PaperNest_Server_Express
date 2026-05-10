import { Router } from "express";
import * as citationController from "../controllers/citationController";
import { authenticate } from "../middlewares/auth";
import {
	authorizeDocument,
	authorizeDocumentEdit,
	authorizeWorkspace,
	authorizeCitation,
	authorizeCitationEdit,
} from "../middlewares/authorization";
import { validate } from "../middlewares/validation";
import {
	createCitationSchema,
	filterCitationTypeSchema,
	searchCitationSchema,
	updateCitationSchema,
} from "../models/validators/citationValidator";

const router: Router = Router();

/**
 * @route   POST /api/documents/:documentId/citations
 * @desc    Create a new citation
 * @access  Protected (requires edit permission)
 */
router.post(
	"/documents/:documentId/citations",
	authenticate,
	authorizeDocumentEdit,
	validate({ body: createCitationSchema }),
	citationController.createCitation,
);

/**
 * @route   GET /api/documents/:documentId/citations/search?q=query
 * @desc    Search citations by title or author
 * @access  Protected (requires document access)
 */
router.get(
	"/documents/:documentId/citations/search",
	authenticate,
	authorizeDocument,
	validate({ query: searchCitationSchema }),
	citationController.searchCitations,
);

/**
 * @route   GET /api/documents/:documentId/citations/doi/:doi
 * @desc    Find citation by DOI
 * @access  Protected (requires document access)
 */
router.get(
	"/documents/:documentId/citations/doi/:doi",
	authenticate,
	authorizeDocument,
	citationController.getCitationByDOI,
);

/**
 * @route   GET /api/documents/:documentId/citations
 * @desc    Get all citations for a document (can filter by type)
 * @access  Protected (requires document access)
 */
router.get(
	"/documents/:documentId/citations",
	authenticate,
	authorizeDocument,
	citationController.getDocumentCitations,
);

/**
 * @route   GET /api/documents/:documentId/citations/:citationId
 * @desc    Get citation by ID
 * @access  Protected (requires document access)
 */
router.get(
	"/documents/:documentId/citations/:citationId",
	authenticate,
	authorizeDocument,
	citationController.getCitationById,
);

/**
 * @route   PUT /api/documents/:documentId/citations/:citationId
 * @desc    Update citation
 * @access  Protected (requires edit permission)
 */
router.put(
	"/documents/:documentId/citations/:citationId",
	authenticate,
	authorizeDocumentEdit,
	validate({ body: updateCitationSchema }),
	citationController.updateCitation,
);

/**
 * @route   DELETE /api/documents/:documentId/citations/:citationId
 * @desc    Delete citation
 * @access  Protected (requires edit permission)
 */
router.delete(
	"/documents/:documentId/citations/:citationId",
	authenticate,
	authorizeDocumentEdit,
	citationController.deleteCitation,
);

/**
 * Workspace-specific citation routes
 */

/**
 * @route   GET /api/workspaces/:workspaceId/citations
 * @desc    Get all citations for a workspace
 * @access  Protected (requires workspace access)
 */
router.get(
	"/workspaces/:workspaceId/citations",
	authenticate,
	authorizeWorkspace(),
	citationController.getWorkspaceCitations,
);

/**
 * @route   POST /api/workspaces/:workspaceId/citations
 * @desc    Create a new citation in a workspace
 * @access  Protected (requires editor permission)
 */
router.post(
	"/workspaces/:workspaceId/citations",
	authenticate,
	authorizeWorkspace("editor"),
	validate({ body: createCitationSchema }),
	citationController.createCitation,
);

/**
 * Flat citation routes (no document/workspace prefix required)
 */

/**
 * @route   GET /api/citations/:citationId
 * @desc    Get citation by ID
 * @access  Protected
 */
router.get(
	"/citations/:citationId",
	authenticate,
	authorizeCitation,
	citationController.getCitationById,
);

/**
 * @route   PUT /api/citations/:citationId
 * @desc    Update citation
 * @access  Protected
 */
router.put(
	"/citations/:citationId",
	authenticate,
	authorizeCitationEdit,
	validate({ body: updateCitationSchema }),
	citationController.updateCitation,
);

/**
 * @route   DELETE /api/citations/:citationId
 * @desc    Delete citation
 * @access  Protected
 */
router.delete(
	"/citations/:citationId",
	authenticate,
	authorizeCitationEdit,
	citationController.deleteCitation,
);

export default router;
