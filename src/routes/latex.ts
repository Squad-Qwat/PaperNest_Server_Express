import { Router } from 'express';
import { compileLatex } from '../controllers/latexController';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validation';
import Joi from 'joi';

const router = Router();

// Validation schema for LaTeX compilation
const compileSchema = Joi.object({
  content: Joi.string().required(),
  mainFileName: Joi.string(),
  assets: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    url: Joi.string().required()
  }))
});

/**
 * @route   POST /api/latex/compile
 * @desc    Compile LaTeX to PDF on the server using Tectonic
 * @access  Protected
 */
router.post(
  '/compile',
  authenticate,
  validate({ body: compileSchema }),
  compileLatex as any
);

export default router;
