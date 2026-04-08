import { Router } from 'express'
import { streamAIResponse } from '../controllers/ai.controller'

const router = Router()

// POST /stream
// Handles AI agent processing and streams Server-Sent Events (SSE)
router.post('/stream', streamAIResponse)

export default router
