import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import documentBodyRepository from "../repositories/documentBodyRepository";
import documentRepository from "../repositories/documentRepository";
import reviewRepository from "../repositories/reviewRepository";
import userRepository from "../repositories/userRepository";
import liveblocksWebhookService from "../services/liveblocksWebhookService";
import { BadRequestError, NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";
import { createdResponse, successResponse } from "../utils/responseFormatter";

/**
 * Get all versions of a document
 * GET /api/documents/:documentId/versions
 * Protected (requires document access)
 */
export const getDocumentVersions = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;

		logger.info("Get document versions request", { documentId });

		const versions = await documentBodyRepository.findByDocument(documentId);

		const userIds = versions.map((v) => v.userId);
		const users = await userRepository.findByIds(userIds);
		const userMap = new Map(users.map((u) => [u.userId, u]));
		const populatedVersions = versions.map((version) => ({
			...version,
			user: userMap.get(version.userId) || null,
		}));

		return successResponse(
			res,
			{ versions: populatedVersions, count: versions.length },
			"Versions retrieved successfully",
		);
	},
);

/**
 * Get current version of a document
 * GET /api/documents/:documentId/versions/current
 * Protected (requires document access)
 */
export const getCurrentVersion = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;

		logger.info("Get current version request", { documentId });

		const version = await documentBodyRepository.findCurrentVersion(documentId);

		if (!version) {
			throw new NotFoundError("No current version found");
		}

		return successResponse(
			res,
			{ version },
			"Current version retrieved successfully",
		);
	},
);

/**
 * Get specific version by version number
 * GET /api/documents/:documentId/versions/:versionNumber
 * Protected (requires document access)
 */
export const getVersionByNumber = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const versionNumber = req.params.versionNumber as string;
		const versionNum = parseInt(versionNumber);

		logger.info("Get version by number request", {
			documentId,
			versionNumber: versionNum,
		});

		if (isNaN(versionNum) || versionNum < 1) {
			throw new BadRequestError("Invalid version number");
		}

		const version = await documentBodyRepository.findByVersionNumber(
			documentId,
			versionNum,
		);

		if (!version) {
			throw new NotFoundError("Version not found");
		}

		return successResponse(res, { version }, "Version retrieved successfully");
	},
);

/**
 * Create a new version manually (alternative to updating document content)
 * POST /api/documents/:documentId/versions
 * Protected (requires edit permission)
 */
export const createVersion = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const { content, message } = req.body;
		const userId = req.userId!;

		logger.info("Create version request", { documentId, userId });

		// Get current highest version number
		const highestVersion =
			await documentBodyRepository.getLatestVersionNumber(documentId);
		const newVersionNumber = highestVersion + 1;

		// Mark all versions as not current
		await documentBodyRepository.setAllVersionsNotCurrent(documentId);

		// Create new version
		const version = await documentBodyRepository.create({
			documentId,
			userId,
			content,
			message: message || `Version ${newVersionNumber}`,
			isCurrentVersion: true,
			versionNumber: newVersionNumber,
		});

		// Update document with new content and version reference
		await documentRepository.updateContent(
			documentId,
			content,
			version.documentBodyId,
		);

		return createdResponse(res, { version }, "Version created successfully");
	},
);

/**
 * Revert document to a specific version
 * POST /api/documents/:documentId/versions/:versionNumber/revert
 * Protected (requires edit permission)
 */
export const revertToVersion = asyncHandler(
	async (req: Request, res: Response) => {
		const documentId = req.params.documentId as string;
		const versionNumber = req.params.versionNumber as string;
		const userId = req.userId!;
		const versionNum = parseInt(versionNumber);

		logger.info("Revert to version request", {
			documentId,
			versionNumber: versionNum,
			userId,
		});

		if (isNaN(versionNum) || versionNum < 1) {
			throw new BadRequestError("Invalid version number");
		}

		// Get the version to revert to
		const targetVersion = await documentBodyRepository.findByVersionNumber(
			documentId,
			versionNum,
		);

		if (!targetVersion) {
			throw new NotFoundError("Version not found");
		}

		// HARD RESET APPROACH
		// We delete all versions and their associated reviews that were created AFTER the target version.
		// Then we set the target version as the current version.

		// 1. Get all versions after the target version
		const futureVersions = await documentBodyRepository.getVersionsAfter(
			documentId,
			versionNum,
		);
		const futureVersionIds = futureVersions.map((v) => v.documentBodyId);

		// 2. Delete associated reviews for the future versions
		if (futureVersionIds.length > 0) {
			await reviewRepository.deleteByDocumentBodyIds(futureVersionIds);
		}

		// 3. Delete the future versions
		await documentBodyRepository.deleteVersionsAfter(documentId, versionNum);

		// 4. Set the target version as the active version (this also marks others as false)
		await documentBodyRepository.setVersionAsCurrent(
			targetVersion.documentBodyId,
		);

		// 5. Update the main document with the reverted content
		await documentRepository.updateContent(
			documentId,
			targetVersion.content,
			targetVersion.documentBodyId,
		);

		// 6. Delete the Liveblocks room to reset the Yjs CRDT state.
		// When the user is redirected back to the editor, a new room will be created
		// and it will seed the `initialContent` (which is now the reverted content) from Firestore.
		try {
			const roomId = `document:${documentId}`;
			await liveblocksWebhookService.deleteRoom(roomId);
			logger.info(`Deleted Liveblocks room ${roomId} during rollback`);
		} catch (error: any) {
			// Room might not exist or already be deleted, which is fine.
			logger.warn(
				`Failed to delete Liveblocks room during rollback: ${error.message}`,
			);
		}

		return successResponse(
			res,
			{ version: targetVersion, revertedFrom: null },
			`Document reverted to version ${versionNum} successfully`,
		);
	},
);

export default {
	getDocumentVersions,
	getCurrentVersion,
	getVersionByNumber,
	createVersion,
	revertToVersion,
};
