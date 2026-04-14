import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface SemanticScholarPaper {
  paperId: string;
  externalIds?: Record<string, string>;
  url?: string;
  title?: string;
  abstract?: string;
  venue?: string;
  year?: number;
  citationCount?: number;
  openAccessPdf?: {
    url: string;
    status: string;
  };
  authors?: Array<{
    authorId: string;
    name: string;
  }>;
  fieldsOfStudy?: string[];
}

class SemanticScholarService {
  private readonly baseUrl = 'https://api.semanticscholar.org/graph/v1';
  private readonly apiKey = env.SEMANTIC_SCHOLAR_API_KEY;

  private get headers() {
    return this.apiKey ? { 'x-api-key': this.apiKey } : {};
  }

  /**
   * Search for papers by query
   */
  async searchPapers(query: string, limit: number = 10, offset: number = 0): Promise<{ data: SemanticScholarPaper[], total: number }> {
    try {
      logger.info(`[SemanticScholarService] Searching for papers: "${query}" (limit: ${limit})`);
      
      const response = await axios.get(`${this.baseUrl}/paper/search`, {
        params: {
          query,
          limit,
          offset,
          fields: 'title,url,year,authors,abstract,openAccessPdf,citationCount,venue,externalIds,fieldsOfStudy'
        },
        headers: this.headers
      });

      return {
        data: response.data.data || [],
        total: response.data.total || 0
      };
    } catch (error: any) {
      logger.error('[SemanticScholarService] Search failed:', error.response?.data || error.message);
      throw new Error(`Semantic Scholar Search Error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get paper details by ID (SHA, DOI, ArXiv, etc.)
   */
  async getPaperDetails(paperId: string): Promise<SemanticScholarPaper> {
    try {
      logger.info(`[SemanticScholarService] Fetching paper details: ${paperId}`);
      
      const response = await axios.get(`${this.baseUrl}/paper/${paperId}`, {
        params: {
          fields: 'title,url,year,authors,abstract,openAccessPdf,citationCount,venue,externalIds,fieldsOfStudy'
        },
        headers: this.headers
      });

      return response.data;
    } catch (error: any) {
      logger.error('[SemanticScholarService] Get details failed:', error.response?.data || error.message);
      throw new Error(`Semantic Scholar Fetch Error: ${error.response?.data?.message || error.message}`);
    }
  }
}

export const semanticScholarService = new SemanticScholarService();
