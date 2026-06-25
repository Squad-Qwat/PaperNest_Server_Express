import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { semanticScholarService } from "../../SemanticScholarService";

export const semanticScholarTool = tool(
	async ({ query, limit = 5, yearRange, fieldsOfStudy }) => {
		console.log(
			`[SemanticScholarTool] Searching for: "${query}" (limit: ${limit})`,
		);

		try {
			const results = await semanticScholarService.searchPapers(query, limit);

			if (results.data.length === 0) {
				return "No papers found for the given search query.";
			}

			const formattedResults = results.data
				.map((paper, idx) => {
					const authors =
						paper.authors?.map((a) => a.name).join(", ") || "Unknown Authors";
					const year = paper.year ? `(${paper.year})` : "(No Date)";
					const pdfLink = paper.openAccessPdf?.url
						? `\nPDF: ${paper.openAccessPdf.url}`
						: "";
					const abstract = paper.abstract
						? `\nAbstract: ${paper.abstract.substring(0, 300)}...`
						: "";

					return `[Result ${idx + 1}]\nTitle: ${paper.title}\nAuthors: ${authors} ${year}\nVenue: ${paper.venue}\nCitation Count: ${paper.citationCount}${pdfLink}${abstract}\nURL: ${paper.url}\n`;
				})
				.join("\n---\n\n");

			return `Relevant academic papers found:\n\n${formattedResults}`;
		} catch (error) {
			console.error("[SemanticScholarTool] Search failed:", error);
			return "Error searching academic database. Please check the network connectivity or try a different query.";
		}
	},
	{
		name: "search_semantic_scholar",
		description:
			"Search for academic papers, preprints, and books by title, keywords, or identifiers (DOI, arXiv ID, PMID, PMCID, ISBN). Wrap the title query in double quotes for a precise/exact title search. Returns matching paper titles, authors, years, and PDF links.",
		schema: z.object({
			query: z
				.string()
				.describe(
					"The search query, keywords, or identifier (e.g. arXiv ID, DOI, PMID, PMCID, ISBN)",
				),
			limit: z
				.number()
				.optional()
				.default(5)
				.describe("Maximum number of relevant papers to return (max 10)"),
			yearRange: z
				.string()
				.optional()
				.describe(
					"Filter results by publication year or range (e.g., '2019-2021')",
				),
			fieldsOfStudy: z
				.string()
				.optional()
				.describe(
					"Filter by fields of study (e.g., 'Computer Science, Medicine')",
				),
		}),
	},
);
