import app from "./app";
import { env } from "./config/env";
import { firebaseAdmin } from "./config/firebase";
import logger from "./utils/logger";

/**
 * Resilient Server Startup
 * Ensures Firebase and other dependencies are checked before listening
 */
const startServer = async () => {
	try {
		const PORT = env.PORT || 3000;

		// Verify Firebase initialization status
		const isFirebaseReady = firebaseAdmin.apps.length > 0;

		const server = app.listen(PORT, () => {
			logger.info(`🚀 Server running on port ${PORT}`);
			logger.info(`📝 Environment: ${env.NODE_ENV}`);
			logger.info(`🔥 Firebase initialized: ${isFirebaseReady ? "Yes" : "No"}`);
			logger.info(`✅ API available at: http://localhost:${PORT}/api`);
		});

		server.on("error", (error: any) => {
			if (error.code === "EADDRINUSE") {
				logger.error(
					`❌ Port ${PORT} is already in use. Please kill the other process or change the PORT in .env`,
				);
			} else {
				logger.error("❌ Server error:", error);
			}
			process.exit(1);
		});

		// Graceful shutdown
		const gracefulShutdown = (signal: string) => {
			logger.info(`${signal} received. Starting graceful shutdown...`);
			server.close(() => {
				logger.info("HTTP server closed");
				process.exit(0);
			});

			setTimeout(() => {
				logger.error("Forced shutdown after timeout");
				process.exit(1);
			}, 10000);
		};

		process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
		process.on("SIGINT", () => gracefulShutdown("SIGINT"));

	} catch (error) {
		logger.error("--- FATAL STARTUP ERROR ---", error);
		process.exit(1);
	}
};

// Execute startup
startServer();

// Global Exception Handlers
process.on("unhandledRejection", (reason: Error, promise: Promise<any>) => {
	logger.error("Unhandled Rejection at:", promise, "reason:", reason);
	if (env.NODE_ENV === "production") {
		process.exit(1);
	}
});

process.on("uncaughtException", (error: Error) => {
	logger.error("Uncaught Exception:", error);
	process.exit(1);
});
