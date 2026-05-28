import { Router } from "express";
import { streamAIResponse } from "../controllers/ai.controller";
import { indexPDF } from "../controllers/rag.controller";
import { authenticate } from "../middlewares/auth";
import { checkQuota } from "../middlewares/quotaLimiter";

const router: Router = Router();

// POST /stream
// Handles AI agent processing and streams Server-Sent Events (SSE)
router.post("/stream", authenticate, checkQuota("ai"), streamAIResponse);

// POST /rag/index
// Triggers PDF indexing for RAG context
router.post("/rag/index", authenticate, indexPDF);

export default router;
