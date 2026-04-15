import { Router } from 'express';
import * as citationController from '../controllers/citationController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  authorizeDocument,
  authorizeDocumentEdit,
} from '../middlewares/authorization';
import {
  createCitationSchema,
  updateCitationSchema,
  searchCitationSchema,
  filterCitationTypeSchema,
} from '../models/validators/citationValidator';

const router: Router = Router();

/**
 * @route   POST /api/documents/:documentId/citations
 * @desc    Create a new citation
 * @access  Protected (requires edit permission)
 */
router.post(
  '/:documentId/citations',
  authenticate,
  authorizeDocumentEdit,
  validate({ body: createCitationSchema }),
  citationController.createCitation
);

/**
 * @route   GET /api/documents/:documentId/citations/search?q=query
 * @desc    Search citations by title or author
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/citations/search',
  authenticate,
  authorizeDocument,
  validate({ query: searchCitationSchema }),
  citationController.searchCitations
);

/**
 * @route   GET /api/documents/:documentId/citations/doi/:doi
 * @desc    Find citation by DOI
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/citations/doi/:doi',
  authenticate,
  authorizeDocument,
  citationController.getCitationByDOI
);

/**
 * @route   GET /api/documents/:documentId/citations
 * @desc    Get all citations for a document (can filter by type)
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/citations',
  authenticate,
  authorizeDocument,
  citationController.getDocumentCitations
);

/**
 * @route   GET /api/documents/:documentId/citations/:citationId
 * @desc    Get citation by ID
 * @access  Protected (requires document access)
 */
router.get(
  '/:documentId/citations/:citationId',
  authenticate,
  authorizeDocument,
  citationController.getCitationById
);

/**
 * @route   PUT /api/documents/:documentId/citations/:citationId
 * @desc    Update citation
 * @access  Protected (requires edit permission)
 */
router.put(
  '/:documentId/citations/:citationId',
  authenticate,
  authorizeDocumentEdit,
  validate({ body: updateCitationSchema }),
  citationController.updateCitation
);

/**
 * @route   DELETE /api/documents/:documentId/citations/:citationId
 * @desc    Delete citation
 * @access  Protected (requires edit permission)
 */
router.delete(
  '/:documentId/citations/:citationId',
  authenticate,
  authorizeDocumentEdit,
  citationController.deleteCitation
);

export default router;
