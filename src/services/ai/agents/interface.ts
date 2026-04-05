import type { AgentStreamParams, StreamEvent } from "../types/agent.types";

/**
 * Interface for AI Agent Providers
 * Allows for multiple implementations (Manual LangGraph, DeepAgent, etc.)
 */
export interface IAgentProvider {
	readonly id: string;
	stream(params: AgentStreamParams): AsyncGenerator<StreamEvent>;
}
