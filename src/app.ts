import cors from "cors";
import express, { type Application } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { RATE_LIMIT_CONFIG } from "./config/constants";
import { env } from "./config/env";
import templateController from "./controllers/templateController";
import { authenticate } from "./middlewares/auth";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { globalRateLimiter } from "./middlewares/rateLimiter";
import { sanitize, validate } from "./middlewares/validation";
import { templateValidator } from "./models/validators/templateValidator";
import aiRoutes from "./routes/ai.routes";
import authRoutes from "./routes/auth";
import citationRoutes from "./routes/citations";
import commentRoutes from "./routes/comments";
import documentRoutes from "./routes/documents";
import invitationRoutes from "./routes/invitations";
import latexRoutes from "./routes/latex";
import notificationRoutes from "./routes/notifications";
import reviewRoutes from "./routes/reviews";
import semanticScholarRoutes from "./routes/semanticScholar";
import uploadRoutes from "./routes/uploadRoutes";
import userRoutes from "./routes/users";
import webhookRoutes from "./routes/webhooks";
import workspaceRoutes from "./routes/workspaces";
import logger from "./utils/logger";
import { successResponse } from "./utils/responseFormatter";




const app: Application = express();
app.set("trust proxy", 1);

app.use(helmet());
app.use(
	cors({
		origin: [env.CORS_ORIGIN, env.CORS_ORIGIN_2, env.CORS_ORIGIN_3],
		credentials: true,
	}),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (env.NODE_ENV === "development") {
	app.use(morgan("dev"));
} else {
	app.use(
		morgan("combined", {
			stream: {
				write: (message: string) => logger.info(message.trim()),
			},
		}),
	);
}

app.use(sanitize);

app.use("/api/webhooks", webhookRoutes);

app.get("/health", (_req, res) => {
	return successResponse(
		res,
		{
			status: "ok",
			timestamp: new Date().toISOString(),
			environment: env.NODE_ENV,
		},
		"Service is healthy",
	);
});


app.get("/api", (_req, res) => {
	return successResponse(
		res,
		{
			message: "PaperNest API",
			version: "1.0.0",
			docs: "/api/docs",
		},
		"API information retrieved",
	);
});


app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

const templateLimiter = rateLimit(RATE_LIMIT_CONFIG.templates);
app.get(
	"/api/templates",
	authenticate,
	templateLimiter,
	templateController.getTemplates,
);
app.get(
	"/api/templates/:templateId",
	authenticate,
	templateLimiter,
	validate({ params: templateValidator.getTemplateById.params }),
	templateController.getTemplateById,
);

app.use("/api/workspaces", workspaceRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api", documentRoutes);
app.use("/api/documents", citationRoutes);
app.use("/api", commentRoutes);
app.use("/api", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/latex", latexRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/semantic-scholar", semanticScholarRoutes);

app.all("/socket.io/", (req, res) => {
	logger.info(`[SocketDiagnostic] Request received from ${req.ip}`);
	logger.info(`[SocketDiagnostic] User-Agent: ${req.get("User-Agent")}`);
	logger.info(`[SocketDiagnostic] Method: ${req.method}`);
	logger.info(`[SocketDiagnostic] Query: ${JSON.stringify(req.query)}`);

	return successResponse(
		res,
		{
			sid: "diagnostic-session",
			upgrades: [],
			pingInterval: 25000,
			pingTimeout: 5000,
		},
		"Socket.IO diagnostic info",
	);
});


// Handle 404
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
