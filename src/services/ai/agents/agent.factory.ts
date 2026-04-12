import { IAgentProvider } from './interface'
import { ManualGraphProvider } from './implementations/manual-graph.provider'
import { DeepAgentProvider } from './implementations/deep-agent.provider'

/**
 * Registry and Factory for AI Agents
 */
class AgentFactory {
    private providers: Map<string, IAgentProvider> = new Map()
    private initialized = false

    private ensureInitialized() {
        if (this.initialized) return

        this.register(new ManualGraphProvider())
        this.register(new DeepAgentProvider())
        this.initialized = true
    }

    /**
     * Register a new agent provider
     */
    register(provider: IAgentProvider) {
        this.providers.set(provider.id, provider)
    }

    /**
     * Resolve an agent provider by ID
     */
    getAgent(id: string): IAgentProvider {
        this.ensureInitialized()
        const provider = this.providers.get(id)
        if (!provider) {
            console.warn(`[AgentFactory] Provider "${id}" not found, falling back to manual_graph`)
            return this.providers.get('manual_graph')!
        }
        return provider
    }

    /**
     * List all registered agent IDs
     */
    getAvailableAgents(): string[] {
        return Array.from(this.providers.keys())
    }
}

export const agentFactory = new AgentFactory()
