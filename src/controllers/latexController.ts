import type { NextFunction, Request, Response } from "express";
import { latexService } from "../services/latexService";
import logger from "../utils/logger";

/**
 * Controller to handle LaTeX-related requests.
 */
export const compileLatex = async (
	req: Request,
	res: Response,
	NextFunction: NextFunction,
) => {
	const { content, mainFileName, assets, engine } = req.body;

	if (!content) {
		return res.status(400).json({ error: "LaTeX content is required" });
	}

	try {
		logger.info(
			`[LatexController] Compilation request received for: ${mainFileName || "main.tex"}`,
		);

		const result = await latexService.compile({
			content,
			mainFileName,
			assets,
			engine,
		});

		if (result.pdf) {
			// Stream PDF back to client
			res.setHeader("Content-Type", "application/pdf");
			res.setHeader("X-Compilation-Status", result.status.toString());
			// We also send the log in a custom header (base64 encoded as it might contain newlines/special chars)
			// Actually, standard practice for complex results is to send a JSON with the base64 PDF or Use a multipart response.
			// But here, since the user wants a simple PDF buffer, we'll send the PDF as the body.
			// If we need the logs, we can include them in headers or send a JSON.

			// Let's send a JSON response to handle both PDF and Logs in a structured way.
			// This is better for the frontend to handle potential errors and showing logs.
			return res.json({
				pdf: result.pdf.toString("base64"),
				log: result.log,
				status: result.status,
			});
		} else {
			// Compilation failed to produce a PDF, but we still return logs
			return res.status(422).json({
				error: "Compilation failed",
				log: result.log,
				status: result.status,
			});
		}
	} catch (error: any) {
		logger.error(
			`[LatexController] Error during compilation: ${error.message}`,
		);
		return res.status(500).json({ error: "Internal Server Error" });
	}
};
