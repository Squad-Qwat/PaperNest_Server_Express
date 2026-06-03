import { Router } from "express";
import Joi from "joi";
import { compileLatex } from "../controllers/latexController";
import { syncToCode, syncToPdf } from "../controllers/latexSyncController";
import { authenticate } from "../middlewares/auth";
import { checkQuota } from "../middlewares/quotaLimiter";
import { validate } from "../middlewares/validation";

const router: Router = Router();

// Validation schema for LaTeX compilation
const compileSchema = Joi.object({
	content: Joi.string().required(),
	mainFileName: Joi.string(),
	documentId: Joi.string(),
	assets: Joi.array().items(
		Joi.object({
			name: Joi.string().required(),
			url: Joi.string().required(),
		}),
	),
	engine: Joi.string().valid("tectonic", "pdflatex").optional(),
});

/**
 * @route   POST /api/latex/compile
 * @desc    Compile LaTeX to PDF on the server using Tectonic
 * @access  Protected
 */
router.post(
	"/compile",
	authenticate,
	checkQuota("latex"),
	validate({ body: compileSchema }),
	compileLatex as any,
);

/**
 * @route   GET /api/latex/sync/code
 * @desc    Sync PDF coordinates to source code coordinates
 * @access  Protected
 */
router.get("/sync/code", authenticate, syncToCode as any);

/**
 * @route   GET /api/latex/sync/pdf
 * @desc    Sync source code coordinates to PDF coordinates
 * @access  Protected
 */
router.get("/sync/pdf", authenticate, syncToPdf as any);

export default router;
