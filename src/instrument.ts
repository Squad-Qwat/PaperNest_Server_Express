import * as Sentry from "@sentry/node";
import { env } from "./config/env";

const isProduction = env.NODE_ENV === "production";
const hasValidDsn = env.SENTRY_DSN?.startsWith("http");

if (hasValidDsn) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		environment: env.NODE_ENV,
		tracesSampleRate: 1.0,
		sendDefaultPii: true,
	});
} else if (isProduction) {
	console.error(
		"❌ Sentry is disabled in production because SENTRY_DSN is missing or invalid.",
	);
} else {
	console.log("ℹ️ Sentry is disabled in development (no SENTRY_DSN provided).");
}
