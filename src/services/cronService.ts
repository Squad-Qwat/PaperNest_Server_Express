import logger from "../utils/logger";
import { semanticScholarService } from "./SemanticScholarService";

/**
 * Initializes background scheduled jobs
 */
export const initCronJobs = () => {
	logger.info("[CronService] Initializing scheduled jobs...");

	// Keep-alive job for Semantic Scholar API key
	const keepAliveSemanticScholar = async () => {
		try {
			const result = await semanticScholarService.searchPapers("XGBoost", 1);
			logger.info(
				`[CronService] Semantic Scholar keep-alive successful. Found ${result.total} papers.`,
			);
		} catch (error: any) {
			logger.error(
				`[CronService] Semantic Scholar keep-alive failed: ${error.message}`,
			);
		}
	};

	// Run once on startup
	setTimeout(() => {
		keepAliveSemanticScholar();
	}, 10000); // Wait 10 seconds after startup to not block initialization

	// Run every 24 hours (86,400,000 ms)
	const ONE_DAY_MS = 24 * 60 * 60 * 1000;
	setInterval(keepAliveSemanticScholar, ONE_DAY_MS);
};
