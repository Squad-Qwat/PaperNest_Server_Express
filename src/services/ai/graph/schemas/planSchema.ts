import { z } from 'zod'

/**
 * Zod schema for a single plan step produced by the LLM planner.
 * Used with `.withStructuredOutput()` to enforce type-safe planning.
 */
export const PlanStepSchema = z.object({
    id: z.string().describe('Unique step ID, e.g. "1", "2"'),
    description: z
        .string()
        .max(200)
        .describe('Clear description (max 200 chars) of what this step accomplishes'),
    tool: z
        .enum(['read_document', 'search_text_lines', 'replace_lines', 'apply_diff_edit', 'compile_latex', 'insert_content'])
        .optional()
        .describe('Suggested tool: read_document, search_text_lines, replace_lines, apply_diff_edit, compile_latex, or insert_content'),
    acceptanceCriteria: z
        .string()
        .max(150)
        .optional()
        .describe('How to verify succeeded (max 150 chars)'),
    confidence: z
        .number()
        .min(0)
        .max(1)
        .default(0.9)
        .describe('Planner confidence that this step is necessary (0-1)'),
    // Use z.enum instead of z.literal to avoid 'const' keyword in JSON Schema
    // Gemini API does not support 'const' in response_schema
    status: z
        .enum(['pending', 'active', 'completed', 'failed'])
        .default('pending')
        .describe('Initial status — always pending'),
})

export const PlanSchema = z.object({
    steps: z
        .array(PlanStepSchema)
        .min(1)
        .describe('Ordered list of steps to accomplish the task'),
    reasoning: z
        .string()
        .optional()
        .describe('Brief explanation of the planning approach'),
})

export type PlanStep = z.infer<typeof PlanStepSchema>
export type Plan = z.infer<typeof PlanSchema>
