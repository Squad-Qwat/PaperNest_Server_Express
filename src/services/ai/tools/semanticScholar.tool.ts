import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { semanticScholarService } from '../../SemanticScholarService'

/**
 * Semantic Scholar Search Tool for AI Agents
 * Allows agents to search for academic papers to support writing or citations
 */
export const semanticScholarTool = tool(
    async ({ query, limit = 5, yearRange, fieldsOfStudy }) => {
        console.log(`[SemanticScholarTool] Searching for: "${query}" (limit: ${limit})`)
        
        try {
            const results = await semanticScholarService.searchPapers(query, limit)
            
            if (results.data.length === 0) {
                return "No papers found for the given search query on Semantic Scholar."
            }

            const formattedResults = results.data.map((paper, idx) => {
                const authors = paper.authors?.map(a => a.name).join(', ') || 'Unknown Authors'
                const year = paper.year ? `(${paper.year})` : '(No Date)'
                const pdfLink = paper.openAccessPdf?.url ? `\nPDF: ${paper.openAccessPdf.url}` : ''
                const abstract = paper.abstract ? `\nAbstract: ${paper.abstract.substring(0, 300)}...` : ''
                
                return `[Result ${idx + 1}]\nTitle: ${paper.title}\nAuthors: ${authors} ${year}\nVenue: ${paper.venue}\nCitation Count: ${paper.citationCount}${pdfLink}${abstract}\nURL: ${paper.url}\n`
            }).join('\n---\n\n')

            return `Relevant academic papers found on Semantic Scholar:\n\n${formattedResults}`
        } catch (error) {
            console.error('[SemanticScholarTool] Search failed:', error)
            return "Error searching Semantic Scholar. Please check the network connectivity or try a different query."
        }
    },
    {
        name: "search_semantic_scholar",
        description: "Search for academic papers and research articles on Semantic Scholar. Use this when the user needs to find references, citations, or verify scientific claims. Returns paper titles, authors, years, and direct PDF links if available.",
        schema: z.object({
            query: z.string().describe("The search query or keywords to look for in academic literature"),
            limit: z.number().optional().default(5).describe("Maximum number of relevant papers to return (max 10)"),
            yearRange: z.string().optional().describe("Filter results by publication year or range (e.g., '2019-2021')"),
            fieldsOfStudy: z.string().optional().describe("Filter by fields of study (e.g., 'Computer Science, Medicine')")
        })
    }
)
