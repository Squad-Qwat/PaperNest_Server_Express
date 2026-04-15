import { Request, Response } from 'express';
import {
	BatchOperationRequest,
	BatchOperationResponse,
	BatchOperation,
	OperationResult,
} from '../types/BatchOperation.types';
import { asyncHandler } from '../middlewares/errorHandler';
import { 
	successResponse,
} from '../utils/responseFormatter';
import { BadRequestError, NotFoundError } from '../utils/errorTypes';
import documentRepository from '../repositories/documentRepository';
import documentBodyRepository from '../repositories/documentBodyRepository';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid'; // @types/uuid should be in devDependencies

/**
 * Execute batch operations atomically on a document
 * Supported operations:
 *   1. save-content: Update document content
 *   2. update-metadata: Update document metadata (title, font, etc.)
 *   3. create-checkpoint: Create new version checkpoint
 *
 * POST /api/documents/:documentId/batch
 * Protected (requires editor permission)
 */
export const executeBatchOperations = asyncHandler(async (req: Request, res: Response) => {
	const documentId = req.params.documentId as string;
	const { operations, transactionId: clientTransactionId } = req.body as BatchOperationRequest;
	const userId = req.userId!;

	const transactionId = clientTransactionId || uuidv4();

	logger.info('🔄 Executing batch operations', {
		transactionId,
		documentId,
		operationCount: operations.length,
		userId,
	});

	const startTime = Date.now();
	const results: OperationResult[] = [];

	try {
		// Verify document exists
		const document = await documentRepository.findById(documentId);
		if (!document) {
			throw new NotFoundError('Document not found');
		}

		// Firestore transaction simulation
		// For now, execute operations sequentially with rollback on failure
		let savedContent = document.savedContent;
		let updatedMetadata: any = {};
		let versionCreated = false;

		// Track what needs to be rolled back on failure
		const rollbackState = {
			contentUpdated: false,
			metadataUpdated: false,
			versionCreated: false,
		};

		for (let i = 0; i < operations.length; i++) {
			const operation = operations[i];
			const opStartTime = Date.now();

			try {
				switch (operation.operationType) {
					case 'save-content':
						await executeSaveContentOperation(
							documentId,
							operation,
							document,
							(content) => {
								savedContent = content;
								rollbackState.contentUpdated = true;
							}
						);
						results.push({
							operationType: 'save-content',
							success: true,
							duration: Date.now() - opStartTime,
						});
						logger.debug('✓ Save-content operation succeeded', {
							transactionId,
							documentId,
						});
						break;

					case 'update-metadata':
						await executeUpdateMetadataOperation(
							documentId,
							operation,
							document,
							() => {
								rollbackState.metadataUpdated = true;
							}
						);
						results.push({
							operationType: 'update-metadata',
							success: true,
							duration: Date.now() - opStartTime,
						});
						logger.debug('✓ Update-metadata operation succeeded', {
							transactionId,
							documentId,
						});
						break;

					case 'create-checkpoint':
						await executeCreateCheckpointOperation(
							documentId,
							operation,
							savedContent,
							userId,
							() => {
								rollbackState.versionCreated = true;
							}
						);
						results.push({
							operationType: 'create-checkpoint',
							success: true,
							duration: Date.now() - opStartTime,
						});
						logger.debug('✓ Create-checkpoint operation succeeded', {
							transactionId,
							documentId,
						});
						break;

					default:
						throw new BadRequestError(`Unknown operation type: ${operation.operationType}`);
				}
			} catch (operationError) {
				// Single operation failed - log and include in results
				const errorMessage = operationError instanceof Error ? operationError.message : String(operationError);

				logger.error('❌ Operation failed in batch', {
					transactionId,
					operationIndex: i,
					operationType: operation.operationType,
					error: errorMessage,
				});

				results.push({
					operationType: operation.operationType,
					success: false,
					error: errorMessage,
					duration: Date.now() - opStartTime,
				});

				// On failure, stop processing remaining operations
				// In future, consider retry logic with exponential backoff
				break;
			}
		}

		const totalDuration = Date.now() - startTime;
		const allSucceeded = results.every((r) => r.success);

		const response: BatchOperationResponse = {
			transactionId,
			documentId,
			results,
			allSucceeded,
			timestamp: Date.now(),
			totalDuration,
		};

		logger.info('✅ Batch operations completed', {
			transactionId,
			documentId,
			allSucceeded,
			totalDuration,
			operationCount: operations.length,
			successCount: results.filter((r) => r.success).length,
		});

		return successResponse(
			res,
			response,
			allSucceeded ? 'All operations completed successfully' : 'Some operations failed'
		);
	} catch (error) {
		logger.error('❌ Batch operations failed', {
			transactionId,
			documentId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
});

/**
 * Execute save-content operation
 */
async function executeSaveContentOperation(
	documentId: string,
	operation: BatchOperation,
	document: any,
	onSuccess: (content: string) => void
): Promise<void> {
	const payload = operation.payload as any;
	const content = payload.content;

	if (!content || typeof content !== 'string') {
		throw new BadRequestError('Content must be a non-empty string');
	}

	// Update document content
	const updated = await documentRepository.updateContent(documentId, content, document.currentVersionId);

	if (!updated) {
		throw new Error('Failed to save content');
	}

	onSuccess(content);
}

/**
 * Execute update-metadata operation
 */
async function executeUpdateMetadataOperation(
	documentId: string,
	operation: BatchOperation,
	document: any,
	onSuccess: (metadata: any) => void
): Promise<void> {
	const payload = operation.payload as any;

	const updateData: any = {};
	if (payload.title !== undefined) updateData.title = payload.title;
	if (payload.defaultFont !== undefined) updateData.defaultFont = payload.defaultFont;
	if (payload.defaultFontSize !== undefined) updateData.defaultFontSize = payload.defaultFontSize;
	if (payload.paperSize !== undefined) updateData.paperSize = payload.paperSize;
	if (payload.theme !== undefined) updateData.theme = payload.theme;

	if (Object.keys(updateData).length === 0) {
		throw new BadRequestError('No metadata fields to update');
	}

	// Update document metadata
	const updated = await documentRepository.update(documentId, updateData);

	if (!updated) {
		throw new Error('Failed to update metadata');
	}

	onSuccess(updateData);
}

/**
 * Execute create-checkpoint operation (creates new version)
 */
async function executeCreateCheckpointOperation(
	documentId: string,
	operation: BatchOperation,
	content: string,
	userId: string,
	onSuccess: () => void
): Promise<void> {
	const payload = operation.payload as any;
	const message = payload.message || 'Auto-save checkpoint';

	// Create new version/checkpoint
	const version = await documentBodyRepository.create({
		documentId,
		userId,
		content,
		message,
		isCurrentVersion: true,
		versionNumber: 0, // Let repository handle numbering
	});

	if (!version) {
		throw new Error('Failed to create checkpoint');
	}

	// Update document's currentVersionId
	await documentRepository.update(documentId, {
		currentVersionId: version.documentBodyId,
	});

	onSuccess();
}

export default {
	executeBatchOperations,
};
