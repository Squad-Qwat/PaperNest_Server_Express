import dotenv from "dotenv";

dotenv.config();

export const env = {
	NODE_ENV: process.env.NODE_ENV || "development",
	PORT: parseInt(process.env.PORT || "3000", 10),

	FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
	FIREBASE_PRIVATE_KEY:
		process.env.FIREBASE_PRIVATE_KEY
			?.replace(/\\n/g, "\n")
			.replace(/\\/g, "")
			.replace(/^['"]|['"]$/g, "") || "",
	FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
	FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || "",
	FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || "",
	FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || "",

	JWT_SECRET: process.env.JWT_SECRET || "your-secret-key-change-in-production",
	JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
	JWT_REFRESH_SECRET:
		process.env.JWT_REFRESH_SECRET ||
		"your-refresh-secret-change-in-production",
	JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",

	GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || "",

	LIVEBLOCKS_SECRET_KEY: process.env.LIVEBLOCKS_SECRET_KEY || "",
	LIVEBLOCKS_WEBHOOK_SECRET: process.env.LIVEBLOCKS_WEBHOOK_SECRET || "",
	LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET:
		process.env.LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET ||
		process.env.LIVEBLOCKS_WEBHOOK_SECRET ||
		"",

	SEMANTIC_SCHOLAR_API_KEY: process.env.SEMANTIC_SCHOLAR_API_KEY || "",
	PUBMED_API_KEY: process.env.PUBMED_API_KEY || "",

	RATE_LIMIT_WINDOW_MS: parseInt(
		process.env.RATE_LIMIT_WINDOW_MS || "900000",
		10,
	),
	RATE_LIMIT_MAX_REQUESTS: parseInt(
		process.env.RATE_LIMIT_MAX_REQUESTS || "100",
		10,
	),

	CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3001",
	CORS_ORIGIN_2: process.env.CORS_ORIGIN_2 || "http://localhost:3001",
	CORS_ORIGIN_3: process.env.CORS_ORIGIN_3 || "http://localhost:3001",
	FRONTEND_URL:
		process.env.FRONTEND_URL ||
		process.env.CORS_ORIGIN ||
		"http://localhost:3001",

	LOG_LEVEL: process.env.LOG_LEVEL || "info",

	R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || "",
	R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "",
	R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "",
	R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "papernest",
	R2_PUBLIC_DOMAIN: process.env.R2_PUBLIC_DOMAIN || "",

	UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
	UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
	RESEND_API_KEY: process.env.RESEND_API_KEY || "",
};

const requiredEnvVars = [
	"FIREBASE_PROJECT_ID",
	"FIREBASE_PRIVATE_KEY",
	"FIREBASE_CLIENT_EMAIL",
	"R2_ACCOUNT_ID",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
	"RESEND_API_KEY",
];

requiredEnvVars.forEach((varName) => {
	if (!process.env[varName]) {
		console.warn(`Warning: ${varName} is not set in environment variables`);
	}
});
