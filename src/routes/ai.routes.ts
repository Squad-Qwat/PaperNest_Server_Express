import { Router } from 'express'
import { streamAIResponse } from '../controllers/ai.controller'
import { indexPDF } from '../controllers/rag.controller'

const router = Router()

// POST /stream
// Handles AI agent processing and streams Server-Sent Events (SSE)
router.post('/stream', streamAIResponse)

// POST /rag/index
// Triggers PDF indexing for RAG context
router.post('/rag/index', indexPDF)

export default router
