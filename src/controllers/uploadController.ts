import axios from "axios";
import type { Request, Response } from "express";
import { FileManagementService } from "../services/FileManagementService";
import { StorageService } from "../services/StorageService";
import { errorResponse, successResponse } from "../utils/responseFormatter";
import logger from "../utils/logger";

export const getPresignedUrl = async (
	req: Request,
	res: Response,
): Promise<any> => {
	try {
		const { filename, contentType, folder } = req.body;

		if (!filename || !contentType) {
			return errorResponse(res, "Filename and contentType are required", 400);
		}

		// Default to 'latex-assets' if folder isn't provided
		const targetFolder = folder || "latex-assets";

		// Jika upload avatar baru, hapus avatar lama di R2 agar ditimpa dan hemat space
		if (targetFolder.startsWith("avatars/")) {
			try {
				const prefix = targetFolder.endsWith("/") ? targetFolder : `${targetFolder}/`;
				await StorageService.deleteFilesByPrefix(prefix);
			} catch (deleteError) {
				logger.warn(`Failed to cleanup older avatar files under prefix ${targetFolder}:`, deleteError);
			}
		}

		const result = await StorageService.generatePresignedUrl(
			filename,
			contentType,
			targetFolder,
		);

		return successResponse(
			res,
			result,
			"Pre-signed URL generated successfully",
		);
	} catch (error: any) {
		return errorResponse(
			res,
			error.message || "Failed to generate pre-signed URL",
			500,
		);
	}
};

/**
 * Generates a presigned PUT URL that targets an EXISTING R2 key so the file
 * is overwritten in-place instead of creating an orphan object.
 * Body: { r2Key: string, contentType: string }
 */
export const getOverwritePresignedUrl = async (
	req: Request,
	res: Response,
): Promise<any> => {
	try {
		const { r2Key, contentType } = req.body;

		if (!r2Key || !contentType) {
			return errorResponse(res, "r2Key and contentType are required", 400);
		}

		// Security: r2Key must not contain path traversal sequences
		if (r2Key.includes("..") || r2Key.startsWith("/")) {
			return errorResponse(res, "Invalid r2Key", 400);
		}

		const result = await StorageService.generateOverwritePresignedUrl(
			r2Key,
			contentType,
		);

		return successResponse(res, result, "Overwrite URL generated successfully");
	} catch (error: any) {
		return errorResponse(
			res,
			error.message || "Failed to generate overwrite URL",
			500,
		);
	}
};

export const proxyDownload = async (
	req: Request,
	res: Response,
): Promise<any> => {
	try {
		const url = req.query.url as string;
		if (!url) {
			return errorResponse(res, "URL is required", 400);
		}

		console.log(`[ProxyDownload] Request: ${url}`);

		let urlObj: URL;
		try {
			urlObj = new URL(url);
		} catch {
			return errorResponse(res, "Invalid URL format", 400);
		}

		// Check if it's an R2 asset (belongs to our public domain)
		const publicDomain = process.env.R2_PUBLIC_DOMAIN || "assets.papernest.com";
		if (urlObj.hostname === publicDomain) {
			try {
				// Extract the key from the URL
				let key = urlObj.pathname;
				if (key.startsWith("/")) key = key.substring(1);

				console.log(`[ProxyDownload] Authenticated R2 Fetch - Key: ${key}`);
				const response = await StorageService.getObject(key);

				if (response.Body) {
					const contentType =
						response.ContentType || "application/octet-stream";
					res.setHeader("Content-Type", contentType);
					res.setHeader(
						"Cache-Control",
						"no-store, no-cache, must-revalidate, proxy-revalidate",
					);
					res.setHeader("Pragma", "no-cache");
					res.setHeader("Expires", "0");

					const body = response.Body as any;
					const buffer = Buffer.from(await body.transformToByteArray());
					res.send(buffer);
					return;
				}
			} catch (r2Error: any) {
				console.error(
					`[ProxyDownload] Authenticated R2 Fetch failed for ${url}:`,
					r2Error.message,
				);
				// Fallback to public fetch if authenticated fails (just in case)
			}
		}

		const { isSafeUrl } = await import("../utils/ssrfFilter");
		if (!(await isSafeUrl(url))) {
			return errorResponse(
				res,
				"Access to the requested URL is forbidden (SSRF Blocked)",
				403,
			);
		}

		// Fallback: Generic fetch with axios (useful for non-R2 assets or if R2 fetch failed)
		console.log(`[ProxyDownload] Generic Axios Fetch: ${url}`);
		const response = await axios.get(url, {
			responseType: "arraybuffer",
			timeout: 15000,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
			},
		});

		const contentType =
			response.headers["content-type"] || "application/octet-stream";
		res.setHeader("Content-Type", contentType);
		res.setHeader(
			"Cache-Control",
			"no-store, no-cache, must-revalidate, proxy-revalidate",
		);
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");
		res.send(Buffer.from(response.data));
	} catch (error: any) {
		const status = error.response?.status || 500;
		const message = error.response?.data?.toString() || error.message;
		console.error(`[ProxyDownload] Error ${status}:`, message);

		return errorResponse(
			res,
			`Failed to proxy asset download: ${message}`,
			status,
			[{ upstreamStatus: status }],
		);
	}
};

export const deleteFile = async (req: Request, res: Response): Promise<any> => {
	try {
		const documentId = req.params.documentId as string;
		const fileId = req.params.fileId as string;

		if (!documentId || !fileId) {
			return errorResponse(res, "Document ID and File ID are required", 400);
		}

		console.log(
			`[DeleteFile] Request to delete file ${fileId} from document ${documentId}`,
		);

		// 1. Get file metadata & delete from Firestore using Service
		const result = await FileManagementService.deleteFileMetadata(
			documentId,
			fileId,
		);
		const r2Key = result.r2Key;

		if (r2Key) {
			// 2. Delete from R2
			try {
				await StorageService.deleteObject(r2Key);
			} catch (r2Error) {
				console.error(
					`[DeleteFile] Failed to delete from R2 (Key: ${r2Key}):`,
					r2Error,
				);
			}
		}

		return successResponse(
			res,
			null,
			"File deleted successfully from R2 and Firestore",
		);
	} catch (error: any) {
		console.error(`[DeleteFile] Error:`, error.message);
		return errorResponse(res, "Failed to delete file", 500);
	}
};

export const renameFile = async (req: Request, res: Response): Promise<any> => {
	try {
		const documentId = req.params.documentId as string;
		const fileId = req.params.fileId as string;
		const { newName } = req.body;

		if (!documentId || !fileId || !newName) {
			return errorResponse(
				res,
				"Document ID, File ID, and New Name are required",
				400,
			);
		}

		const sDocId = String(documentId).replace(/[\r\n]/g, " ");
		const sFileId = String(fileId).replace(/[\r\n]/g, " ");
		const sNewName = String(newName).replace(/[\r\n]/g, " ");

		console.log(
			`[RenameFile] Request to rename file ${sFileId} in document ${sDocId} to ${sNewName}`,
		);

		await FileManagementService.updateFileName(documentId, fileId, newName);

		return successResponse(res, null, "File renamed successfully");
	} catch (error: any) {
		console.error(`[RenameFile] Error:`, error.message);
		return errorResponse(res, "Failed to rename file", 500);
	}
};
