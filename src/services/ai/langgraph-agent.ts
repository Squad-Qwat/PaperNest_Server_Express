/**
 * LangGraph Agent Entry Point
 *
 * This file now serves as a wrapper/adapter for the new Graph-based implementation
 * located in src/lib/ai/graph/index.ts
 */

import { streamAgent as graphStreamAgent, ToolResult } from './graph'

/**
 * Re-export types if needed by consumers
 */
export type { ToolResult }

/**
 * Stream the agent using the new StateGraph implementation
 */
export const streamAgent = graphStreamAgent
