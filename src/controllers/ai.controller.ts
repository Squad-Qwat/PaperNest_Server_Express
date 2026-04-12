import { Request, Response } from 'express'
import { agentFactory } from '../services/ai/agents/agent.factory'
import { validateAICredentials } from '../services/ai/config'
import { ToolResult } from '../services/ai/types/agent.types'

export const streamAIResponse = async (req: Request, res: Response): Promise<void> => {
	try {
		const {
			message,
			documentContent = '',
			documentHTML = '',
			conversationHistory = [],
			toolResults,
			documentId,
			plan,
			threadId: bodyThreadId,
			reasoningEnabled = false,
			providerId,
			modelId,
			agentId = 'manual_graph', // New parameter
		} = req.body

		const credentialsCheck = validateAICredentials(providerId)
		if (!credentialsCheck.valid) {
			res.status(500).json({ error: 'AI service not configured', details: credentialsCheck.error })
			return
		}

		if (!message || typeof message !== 'string') {
			res.status(400).json({ error: 'Message is required' })
			return
		}

		// Set headers for Server-Sent Events (SSE)
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no', // Disable proxy buffering
			'X-Content-Type-Options': 'nosniff'
		})

		// CRITICAL: Disable Node.js default timeout for this long-running SSE stream
		res.setTimeout(0)

		res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)

		const threadId = bodyThreadId || Date.now().toString()
		let isDisconnected = false
		let keepAliveInterval: any

		try {
			// res.on('close') is the standard way to detect client disconnect in Node.js
			res.on('close', () => {
				isDisconnected = true
				if (keepAliveInterval) clearInterval(keepAliveInterval)
				console.log(`[AI Stream] Client disconnected from response stream (${agentId})`)
			})

			// Helper to keep connection alive if LLM is slow
			keepAliveInterval = setInterval(() => {
				if (!isDisconnected) {
					res.write(': ping\n\n') // SSE comment to keep connection active
				}
			}, 15000)

			// Resolve Agent and Stream
			const agent = agentFactory.getAgent(agentId)
			console.log(`[AI Controller] Invoking agent: ${agentId}`)

			for await (const chunk of agent.stream({
				message,
				documentContent,
				documentHTML,
				threadId,
				conversationHistory,
				toolResults: toolResults as ToolResult[] | undefined,
				documentId,
				initialPlan: plan,
				reasoningEnabled,
				providerId,
				modelId
			})) {
				// Check if client is still connected
				if (isDisconnected) break

				// Write chunk to Express response
				res.write(`data: ${JSON.stringify(chunk)}\n\n`)
				
				// Optional: flush if using compression/buffers
				if (typeof (res as any).flush === 'function') {
					(res as any).flush()
				}
				
				await new Promise(resolve => setTimeout(resolve, 5))
			}

			if (!isDisconnected) {
				res.write(`data: ${JSON.stringify({ type: 'stream_end', timestamp: Date.now() })}\n\n`)
			}
		} finally {
			if (keepAliveInterval) clearInterval(keepAliveInterval)
			if (!res.writableEnded) res.end()
		}
	} catch (error) {
		console.error('[AI Stream] Fatal error:', error)
		if (!res.headersSent) {
			res.status(500).json({
				error: 'Failed to initialize streaming',
				details: error instanceof Error ? error.message : 'Unknown error',
			})
		} else if (!res.writableEnded && res.writable) {
			try {
				res.write(`data: ${JSON.stringify({
					type: 'error',
					error: error instanceof Error ? error.message : 'Unknown error',
				})}\n\n`)
				res.end()
			} catch (writeError) {
				console.error('[AI Stream] Failed to write error to response:', writeError)
			}
		}
	}
}
