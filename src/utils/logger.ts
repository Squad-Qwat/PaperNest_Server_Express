import winston from "winston";
import { env } from "../config/env";

// Define log format
const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json(),
);

// Console format for development
const consoleFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.printf(({ timestamp, level, message, ...meta }) => {
		let msg = `${timestamp} [${level}]: ${message}`;

		if (Object.keys(meta).length > 0) {
			msg += ` ${JSON.stringify(meta)}`;
		}

		return msg;
	}),
);

// Create logger instance
const logger = winston.createLogger({
	level: env.LOG_LEVEL,
	format: logFormat,
	defaultMeta: { service: "papernest-api" },
	transports: [
		// Write all logs to console
		new winston.transports.Console({
			format: env.NODE_ENV === "development" ? consoleFormat : logFormat,
		}),

		// Write all logs with level 'error' and below to error.log
		new winston.transports.File({
			filename: "logs/error.log",
			level: "error",
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),

		// Write all logs to combined.log
		new winston.transports.File({
			filename: "logs/combined.log",
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		}),
	],
	exceptionHandlers: [
		new winston.transports.File({ filename: "logs/exceptions.log" }),
	],
	rejectionHandlers: [
		new winston.transports.File({ filename: "logs/rejections.log" }),
	],
});

// If we're not in production, log to the console with colors
if (env.NODE_ENV !== "production") {
	logger.add(
		new winston.transports.Console({
			format: consoleFormat,
		}),
	);
}

export default logger;
