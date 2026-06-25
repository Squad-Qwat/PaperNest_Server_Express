import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";
import type { SemanticScholarPaper } from "../types/semanticScholar.types";

import logger from "../utils/logger";

const generateSecureRandomString = (): string => {
	return crypto.randomBytes(4).toString("hex");
};

const isAffiliation = (name: string): boolean => {
	const lower = name.toLowerCase();
	const keywords = [
		"university",
		"institute",
		"sciences",
		"centre",
		"center",
		"school",
		"department",
		"laboratory",
		"association",
		"society",
		"foundation",
		"group",
		"consortium",
		"committee",
		"collaboration",
		"commission",
		"organization",
		"clinic",
		"hospital",
		"south africa",
	];
	return keywords.some((kw) => lower.includes(kw)) || name.length > 40;
};

const mapGoogleBookToPaper = (item: any, isbnCleaned: string): SemanticScholarPaper => {
	const info = item.volumeInfo || {};
	const yearStr = info.publishedDate ? info.publishedDate.substring(0, 4) : "";
	const yearNum = yearStr ? parseInt(yearStr, 10) : undefined;
	return {
		paperId: `isbn-${isbnCleaned}-${item.id || generateSecureRandomString()}`,
		title: info.title || "",
		externalIds: { ISBN: isbnCleaned },
		year: yearNum && !isNaN(yearNum) ? yearNum : undefined,
		url: info.infoLink || "",
		venue: info.publisher || "",
		authors: info.authors?.map((name: string) => ({ authorId: "", name })) || [],
		type: "book",
	};
};

const mapCrossRefWorkToPaper = (msg: any, query: string): SemanticScholarPaper => {
	const mappedAuthors =
		msg.author
			?.map((a: any) => {
				if (a.given || a.family) {
					return { authorId: "", name: `${a.given || ""} ${a.family || ""}`.trim() };
				}
				if (a.name && !isAffiliation(a.name)) {
					return { authorId: "", name: a.name.trim() };
				}
				return null;
			})
			.filter((a: any): a is { authorId: string; name: string } => a !== null) || [];

	const yearParts =
		msg.issued?.["date-parts"]?.[0]?.[0] ||
		msg["published-print"]?.["date-parts"]?.[0]?.[0] ||
		msg["published-online"]?.["date-parts"]?.[0]?.[0] ||
		undefined;
	const yearNum = yearParts ? parseInt(String(yearParts), 10) : undefined;

	return {
		paperId: `crossref-${msg.DOI || generateSecureRandomString()}`,
		title: msg.title?.[0] || "",
		externalIds: msg.DOI ? { DOI: msg.DOI } : undefined,
		year: yearNum && !isNaN(yearNum) ? yearNum : undefined,
		url: msg.URL || "",
		venue: msg["container-title"]?.[0] || "",
		authors: mappedAuthors,
		crossRefType: msg.type,
		type: msg.type,
	};
};

const parseArxivXml = (xml: string, arxivId: string): SemanticScholarPaper | null => {
	const entryStart = xml.indexOf("<entry>");
	if (entryStart === -1) return null;
	const entryXml = xml.substring(entryStart);

	const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
	const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

	const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
	const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";

	const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
	const yearStr = updatedMatch ? updatedMatch[1].substring(0, 4) : "";
	const yearNum = yearStr ? parseInt(yearStr, 10) : undefined;

	const authors = [];
	const authorRegex = /<author>([\s\S]*?)<\/author>/g;
	let authorMatch;
	while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
		const nameMatch = authorMatch[1].match(/<name>([^<]+)<\/name>/);
		if (nameMatch) {
			authors.push({
				authorId: "",
				name: nameMatch[1].trim()
			});
		}
	}

	const doiMatch = entryXml.match(/<arxiv:doi>([^<]+)<\/arxiv:doi>/);
	const doi = doiMatch ? doiMatch[1].trim() : undefined;

	const pdfMatch = entryXml.match(/<link title="pdf" href="([^"]+)"/);
	const pdfUrl = pdfMatch ? pdfMatch[1].trim() : `https://arxiv.org/pdf/${arxivId}.pdf`;

	const externalIds: Record<string, string> = { ArXiv: arxivId };
	if (doi) {
		externalIds.DOI = doi;
	}

	return {
		paperId: `arxiv-${arxivId}`,
		title,
		abstract,
		externalIds,
		year: yearNum && !isNaN(yearNum) ? yearNum : undefined,
		url: `https://arxiv.org/abs/${arxivId}`,
		openAccessPdf: {
			url: pdfUrl,
			status: "OPEN"
		},
		authors,
		venue: "arXiv preprint"
	};
};

const mapPubMedToPaper = (msg: any, pmid: string): SemanticScholarPaper => {
	const mappedAuthors =
		msg.authors
			?.map((a: any) => ({
				authorId: "",
				name: a.name.trim()
			})) || [];

	const yearStr = msg.pubdate ? msg.pubdate.substring(0, 4) : "";
	const yearNum = yearStr ? parseInt(yearStr, 10) : undefined;

	return {
		paperId: `pmid-${pmid}`,
		title: msg.title || "",
		externalIds: { PMID: pmid },
		year: yearNum && !isNaN(yearNum) ? yearNum : undefined,
		url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}`,
		venue: msg.source || "",
		authors: mappedAuthors,
	};
};

class SemanticScholarService {
	private readonly baseUrl = "https://api.semanticscholar.org/graph/v1";
	private readonly apiKey = env.SEMANTIC_SCHOLAR_API_KEY;

	private get headers() {
		return this.apiKey ? { "x-api-key": this.apiKey } : {};
	}

	async searchPapers(
		query: string,
		limit: number = 10,
		offset: number = 0,
	): Promise<{ data: SemanticScholarPaper[]; total: number }> {
		const trimmedQuery = query.trim();

		let directId: string | null = null;
		let isArxivId = false;
		let isPmid = false;
		let isPmcid = false;
		let resolvedArxivId = "";
		let resolvedPmid = "";
		let resolvedPmcid = "";

		const arxivMatch = trimmedQuery.match(/^arxiv:(.+)$/i);
		const isRawArxiv = /^\d{4}\.\d{4,5}(v\d+)?$/.test(trimmedQuery);
		if (arxivMatch) {
			isArxivId = true;
			resolvedArxivId = arxivMatch[1].trim();
			directId = `ARXIV:${resolvedArxivId}`;
		} else if (isRawArxiv) {
			isArxivId = true;
			resolvedArxivId = trimmedQuery;
			directId = `ARXIV:${resolvedArxivId}`;
		}

		const pmidMatch = trimmedQuery.match(/^pmid:(\d+)$/i);
		const isRawPmid = /^\d{8}$/.test(trimmedQuery);
		if (pmidMatch) {
			isPmid = true;
			resolvedPmid = pmidMatch[1].trim();
			directId = `PMID:${resolvedPmid}`;
		} else if (isRawPmid) {
			isPmid = true;
			resolvedPmid = trimmedQuery;
			directId = `PMID:${resolvedPmid}`;
		}

		const pmcidMatch = trimmedQuery.match(/^(pmcid:)?(PMC\d+)$/i);
		if (pmcidMatch) {
			isPmcid = true;
			resolvedPmcid = pmcidMatch[2].trim();
			directId = `PMCID:${resolvedPmcid}`;
		}

		if (directId) {
			try {
				logger.info(`[SemanticScholarService] Query matched identifier "${trimmedQuery}", executing direct lookup for "${directId}"`);
				const paper = await this.getPaperDetails(directId);
				if (paper) {
					return {
						data: [paper],
						total: 1,
					};
				}
			} catch (error: any) {
				logger.error(
					`[SemanticScholarService] Direct identifier lookup for "${directId}" failed, trying official API fallback:`,
					error.message,
				);

				if (isArxivId && resolvedArxivId) {
					try {
						logger.info(`[SemanticScholarService] Querying official arXiv API for "${resolvedArxivId}"`);
						const response = await axios.get(`http://export.arxiv.org/api/query?id_list=${resolvedArxivId}`);
						const parsedPaper = parseArxivXml(response.data, resolvedArxivId);
						if (parsedPaper && parsedPaper.title) {
							return {
								data: [parsedPaper],
								total: 1,
							};
						}
					} catch (arxivError: any) {
						logger.error(`[SemanticScholarService] Official arXiv API query failed:`, arxivError.message);
					}
				}

				if (isPmid && resolvedPmid) {
					try {
						logger.info(`[SemanticScholarService] Querying official PubMed API for "${resolvedPmid}"`);
						const response = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${resolvedPmid}&retmode=json`);
						const rawPaper = response.data?.result?.[resolvedPmid];
						if (rawPaper && rawPaper.title) {
							const parsedPaper = mapPubMedToPaper(rawPaper, resolvedPmid);
							return {
								data: [parsedPaper],
								total: 1,
							};
						}
					} catch (pmidError: any) {
						logger.error(`[SemanticScholarService] Official PubMed API query failed:`, pmidError.message);
					}
				}

				if (isPmcid && resolvedPmcid) {
					try {
						logger.info(`[SemanticScholarService] Resolving PMCID "${resolvedPmcid}" via NCBI ID Converter`);
						const response = await axios.get(`https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${resolvedPmcid}&format=json&tool=PaperNest&email=support@papernest.com`);
						const record = response.data?.records?.[0];
						if (record && record.pmid) {
							const resolvedPmidStr = String(record.pmid);
							logger.info(`[SemanticScholarService] PMCID resolved to PMID "${resolvedPmidStr}", querying PubMed API`);
							const pubMedResponse = await axios.get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${resolvedPmidStr}&retmode=json`);
							const rawPaper = pubMedResponse.data?.result?.[resolvedPmidStr];
							if (rawPaper && rawPaper.title) {
								const parsedPaper = mapPubMedToPaper(rawPaper, resolvedPmidStr);
								return {
									data: [parsedPaper],
									total: 1,
								};
							}
						}
					} catch (pmcidError: any) {
						logger.error(`[SemanticScholarService] PMCID resolution or PubMed API query failed:`, pmcidError.message);
					}
				}

				return { data: [], total: 0 };
			}
		}

		const isbnCleaned = trimmedQuery.replace(/[- ]/g, "");
		const isIsbn = /^(978|979)?\d{9}[\dX]$/i.test(isbnCleaned);

		if (isIsbn) {
			try {
				logger.info(`[SemanticScholarService] Query is ISBN, searching Google Books: ${isbnCleaned}`);
				const response = await axios.get("https://www.googleapis.com/books/v1/volumes", {
					params: { q: `isbn:${isbnCleaned}` }
				});
				const bookData = response.data;
				if (bookData?.items && bookData.items.length > 0) {
					const mappedBooks = bookData.items.map((item: any) => mapGoogleBookToPaper(item, isbnCleaned));
					return {
						data: mappedBooks,
						total: mappedBooks.length,
					};
				}
			} catch (gbError: any) {
				logger.error("[SemanticScholarService] Google Books search failed, falling back to standard search:", gbError.message);
			}
		}

		let doiQuery = trimmedQuery;
		const doiPrefixMatch = trimmedQuery.match(/^doi:(.+)$/i);
		if (doiPrefixMatch) {
			doiQuery = doiPrefixMatch[1].trim();
		}
		const isDoi = doiQuery.startsWith("10.") && doiQuery.includes("/");

		if (isDoi) {
			const crossRefHeaders = {
				"User-Agent": "PaperNestAcademicSearch/1.0 (mailto:support@papernest.com)"
			};
			try {
				logger.info(`[SemanticScholarService] Query is DOI, prioritizing CrossRef lookup: ${doiQuery}`);
				const response = await axios.get(
					`https://api.crossref.org/works/${encodeURIComponent(doiQuery)}`,
					{ headers: crossRefHeaders }
				);
				const crossRefData = response.data;
				if (crossRefData?.message) {
					const simulatedPaper = mapCrossRefWorkToPaper(crossRefData.message, doiQuery);
					return {
						data: [simulatedPaper],
						total: 1,
					};
				}
			} catch (crError: any) {
				logger.error(
					"[SemanticScholarService] Prioritized CrossRef DOI lookup failed, falling back to Semantic Scholar:",
					crError.response?.data || crError.message,
				);
			}
		}

		let isPreciseTitle = false;
		let coreTitle = trimmedQuery;

		if (trimmedQuery.toLowerCase().startsWith("title:")) {
			isPreciseTitle = true;
			coreTitle = trimmedQuery.substring(6).trim();
		} else if (trimmedQuery.startsWith('"') && trimmedQuery.endsWith('"') && trimmedQuery.length > 2) {
			isPreciseTitle = true;
			coreTitle = trimmedQuery.substring(1, trimmedQuery.length - 1).trim();
		}

		if (isPreciseTitle && coreTitle.startsWith('"') && coreTitle.endsWith('"') && coreTitle.length > 2) {
			coreTitle = coreTitle.substring(1, coreTitle.length - 1).trim();
		}

		const searchQuery = isPreciseTitle ? `"${coreTitle}"` : query;

		let papers: SemanticScholarPaper[] = [];
		let total = 0;
		let searchFailed = false;

		try {
			logger.info(
				`[SemanticScholarService] Searching for papers on Semantic Scholar: "${searchQuery}" (limit: ${limit})`,
			);

			const response = await axios.get(`${this.baseUrl}/paper/search`, {
				params: {
					query: searchQuery,
					limit,
					offset,
					fields:
						"title,url,year,authors,abstract,openAccessPdf,citationCount,venue,externalIds,fieldsOfStudy",
				},
				headers: this.headers,
			});

			papers = response.data.data || [];
			total = response.data.total || 0;

			if (isPreciseTitle && papers.length > 0) {
				const cleanCore = coreTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
				papers = papers.filter(
					(p) => p.title && p.title.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanCore
				);
				total = papers.length;
			}
		} catch (error: any) {
			logger.error(
				"[SemanticScholarService] Semantic Scholar search failed, will attempt fallback:",
				error.response?.data || error.message,
			);
			searchFailed = true;
		}

		if ((papers.length === 0 || searchFailed) && !isDoi) {
			const crossRefHeaders = {
				"User-Agent": "PaperNestAcademicSearch/1.0 (mailto:support@papernest.com)"
			};

			try {
				const crossRefQuery = isPreciseTitle ? coreTitle : query;
				logger.info(`[SemanticScholarService] Fallback to CrossRef: Searching works by keyword for "${crossRefQuery}"`);
				const response = await axios.get(
					"https://api.crossref.org/works",
					{
						params: {
							query: crossRefQuery,
							rows: limit,
							offset,
						},
						headers: crossRefHeaders,
					}
				);
				const crossRefData = response.data;
				if (crossRefData?.message?.items && crossRefData.message.items.length > 0) {
					let mappedPapers: SemanticScholarPaper[] = crossRefData.message.items.map((item: any) =>
						mapCrossRefWorkToPaper(item, query)
					);
					if (isPreciseTitle) {
						const cleanCore = coreTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
						mappedPapers = mappedPapers.filter(
							(p: SemanticScholarPaper) => p.title && p.title.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanCore
						);
					}
					if (mappedPapers.length > 0) {
						return {
							data: mappedPapers,
							total: isPreciseTitle ? mappedPapers.length : (crossRefData.message["total-results"] || mappedPapers.length),
						};
					} else if (!isPreciseTitle) {
						return {
							data: [],
							total: 0
						};
					}
				}
			} catch (crError: any) {
				logger.error(
					"[SemanticScholarService] CrossRef fallback keyword search failed:",
					crError.response?.data || crError.message,
				);
			}
		}

		if (isPreciseTitle && papers.length === 0) {
			try {
				logger.info(`[SemanticScholarService] Precise title search got 0 results, attempting hybrid arXiv search fallback for "${coreTitle}"`);
				const searchUrl = `https://arxiv.org/search/?query=${encodeURIComponent(coreTitle)}&searchtype=title`;
				const response = await axios.get(searchUrl, { timeout: 10000 });
				const match = response.data.match(/\/abs\/(\d{4}\.\d{4,5}(v\d+)?)/);
				if (match) {
					const arxivId = match[1];
					logger.info(`[SemanticScholarService] Hybrid arXiv search resolved ID: ${arxivId}, fetching metadata`);
					const apiResponse = await axios.get(`https://export.arxiv.org/api/query?id_list=${arxivId}`, { timeout: 5000 });
					const parsedPaper = parseArxivXml(apiResponse.data, arxivId);
					if (parsedPaper && parsedPaper.title) {
						const cleanCore = coreTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
						if (parsedPaper.title.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanCore) {
							return {
								data: [parsedPaper],
								total: 1
							};
						}
					}
				}
			} catch (arxivSearchError: any) {
				logger.error("[SemanticScholarService] Hybrid arXiv search fallback failed:", arxivSearchError.message);
			}
		}

		return { data: papers, total };
	}

	async getPaperDetails(paperId: string): Promise<SemanticScholarPaper> {
		try {
			logger.info(
				`[SemanticScholarService] Fetching paper details: ${paperId}`,
			);

			const response = await axios.get(`${this.baseUrl}/paper/${paperId}`, {
				params: {
					fields:
						"title,url,year,authors,abstract,openAccessPdf,citationCount,venue,externalIds,fieldsOfStudy",
				},
				headers: this.headers,
			});

			return response.data;
		} catch (error: any) {
			logger.error(
				"[SemanticScholarService] Get details failed:",
				error.response?.data || error.message,
			);
			throw new Error(
				`Semantic Scholar Fetch Error: ${error.response?.data?.message || error.message}`,
			);
		}
	}
}

export const semanticScholarService = new SemanticScholarService();
