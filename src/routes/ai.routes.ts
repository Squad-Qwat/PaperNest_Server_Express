import { Router } from "express";
import { streamAIResponse } from "../controllers/ai.controller";
import { indexPDF } from "../controllers/rag.controller";
import { authenticate } from "../middlewares/auth";
import { checkQuota } from "../middlewares/quotaLimiter";
import { aiRateLimiter } from "../middlewares/rateLimiter";

const router: Router = Router();

// POST /stream
// Handles AI agent processing and streams Server-Sent Events (SSE)
router.post(
	"/stream",
	authenticate,
	aiRateLimiter,
	checkQuota("ai"),
	streamAIResponse,
);

// POST /rag/index
// Triggers PDF indexing for RAG context
router.post("/rag/index", authenticate, aiRateLimiter, indexPDF);

export default router;
