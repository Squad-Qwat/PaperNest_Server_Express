import { Router } from "express";
import * as semanticScholarController from "../controllers/semanticScholarController";
import { authenticate } from "../middlewares/auth";

const router: Router = Router();

/**
 * @route   GET /api/semantic-scholar/search
 * @desc    Search papers on Semantic Scholar
 * @access  Protected
 */
router.get("/search", authenticate, semanticScholarController.searchPapers);

/**
 * @route   GET /api/semantic-scholar/paper/:id
 * @desc    Get paper details by ID
 * @access  Protected
 */
router.get(
	"/paper/:id",
	authenticate,
	semanticScholarController.getPaperDetails,
);

export default router;
