import archiver from "archiver";
import type { Request, Response } from "express";
import documentFileRepository from "../repositories/documentFileRepository";
import documentRepository from "../repositories/documentRepository";
import permissionService from "../services/permissionService";
import { StorageService } from "../services/StorageService";
import { NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";

/**
 * GET /api/documents/:documentId/export-zip
 *
 * Packages the document's main.tex (from Firestore savedContent) and all
 * auxiliary files (from R2) into a ZIP archive and streams it to the client.
 *
 * Access: viewer or higher on the document's workspace.
 */
export const exportDocumentZip = async (
	req: Request,
	res: Response,
): Promise<void> => {
	const { documentId } = req.params;
	const docId = Array.isArray(documentId) ? documentId[0] : documentId;
	const userId = req.userId!;

	try {
		// 1. Fetch document
		const document = await documentRepository.findById(docId);
		if (!document) throw new NotFoundError("Document not found");

		// 2. Permission check
		const hasAccess = await permissionService.hasMinimumPermission(
			userId,
			docId,
			document.workspaceId,
			"viewer",
		);
		if (!hasAccess) {
			res.status(403).json({ success: false, error: "Access forbidden" });
			return;
		}

		// 3. Fetch auxiliary file metadata from Firestore
		const files = await documentFileRepository.findByDocument(docId);

		const safeName = (document.title || "document")
			.replace(/[^a-z0-9_\-. ]/gi, "_")
			.trim() || "document";

		// 4. Stream ZIP response
		res.setHeader("Content-Type", "application/zip");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${safeName}.zip"`,
		);
		res.setHeader("Cache-Control", "no-store");

		const archive = archiver("zip", { zlib: { level: 6 } });

		archive.on("error", (err: Error) => {
			logger.error("[ExportZip] Archive error:", err);
			if (!res.headersSent) {
				res
					.status(500)
					.json({ success: false, error: "Failed to create ZIP archive" });
			}
		});

		archive.pipe(res);

		// 5. Add main.tex from Firestore savedContent
		const mainTexContent =
			typeof document.savedContent === "string"
				? document.savedContent
				: "";
		archive.append(Buffer.from(mainTexContent, "utf-8"), {
			name: "main.tex",
		});

		// 6. Add each auxiliary file from R2
		for (const file of files) {
			if (!file.r2Key) continue;
			try {
				const r2Object = await StorageService.getObject(file.r2Key);
				if (!r2Object.Body) continue;

				const body = r2Object.Body as any;
				const buffer = Buffer.from(await body.transformToByteArray());

				// Use the virtual path (file.name) as the path inside the ZIP
				archive.append(buffer, { name: file.name });
			} catch (fileErr) {
				logger.warn(
					`[ExportZip] Could not fetch file ${file.r2Key} — skipping:`,
					fileErr,
				);
			}
		}

		await archive.finalize();
		logger.info(
			`[ExportZip] Document ${documentId} exported by user ${userId}`,
		);
	} catch (err: any) {
		logger.error("[ExportZip] Error:", err);
		if (!res.headersSent) {
			const status = err.statusCode || 500;
			res
				.status(status)
				.json({ success: false, error: err.message || "Export failed" });
		}
	}
};
