import { Router } from "express";
import Joi from "joi";
import { compileLatex } from "../controllers/latexController";
import { authenticate } from "../middlewares/auth";
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
	validate({ body: compileSchema }),
	compileLatex as any,
);

export default router;
