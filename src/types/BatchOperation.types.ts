/**
 * Batch Operation Types
 * Defines the structure for atomic batch operations on documents
 */

export type OperationType = 'save-content' | 'update-metadata' | 'create-checkpoint';

export interface SaveContentPayload {
	content: string;
	contentChecksum?: string; // SHA256 hash for conflict detection
}

export interface UpdateMetadataPayload {
	title?: string;
	defaultFont?: string;
	defaultFontSize?: string;
	paperSize?: string;
	theme?: string;
}

export interface CreateCheckpointPayload {
	message: string;
	userId: string;
}

export interface BatchOperation {
	operationType: OperationType;
	payload: SaveContentPayload | UpdateMetadataPayload | CreateCheckpointPayload;
}

export interface BatchOperationRequest {
	operations: BatchOperation[];
	transactionId?: string; // For idempotency - generated server-side if not provided
}

export interface OperationResult {
	operationType: OperationType;
	success: boolean;
	data?: any; // Operation-specific result data
	error?: string; // Error message if failed
	duration: number; // Execution time in ms
}

export interface BatchOperationResponse {
	transactionId: string;
	documentId: string;
	results: OperationResult[];
	allSucceeded: boolean;
	timestamp: number;
	totalDuration: number;
}

export interface BatchOperationError {
	code: string;
	message: string;
	operationIndex?: number; // Which operation in the batch failed
	details?: any;
}
