import Joi from 'joi';

/**
 * Validation schema for save-content operation
 */
const saveContentPayloadSchema = Joi.object({
	content: Joi.string()
		.required()
		.allow('', null)
		.messages({
			'any.required': 'Content is required for save-content operation',
		}),
	contentChecksum: Joi.string()
		.optional()
		.allow('', null)
		.messages({
			'string.base': 'Content checksum must be a string',
		}),
});

/**
 * Validation schema for update-metadata operation
 */
const updateMetadataPayloadSchema = Joi.object({
	title: Joi.string()
		.min(1)
		.max(500)
		.optional()
		.messages({
			'string.min': 'Title cannot be empty',
			'string.max': 'Title cannot exceed 500 characters',
		}),
	defaultFont: Joi.string().max(100).optional().allow('', null),
	defaultFontSize: Joi.string().max(20).optional().allow('', null),
	paperSize: Joi.string().max(20).optional().allow('', null),
	theme: Joi.string().max(50).optional().allow('', null),
}).min(1);

/**
 * Validation schema for create-checkpoint operation
 */
const createCheckpointPayloadSchema = Joi.object({
	message: Joi.string()
		.min(1)
		.max(500)
		.optional()
		.default('Auto-save checkpoint')
		.messages({
			'string.min': 'Version message cannot be empty',
			'string.max': 'Version message cannot exceed 500 characters',
		}),
	userId: Joi.string().optional().messages({
		'string.base': 'userId must be a string',
	}),
});

/**
 * Validation schema for a single batch operation
 */
const batchOperationSchema = Joi.object({
	operationType: Joi.string()
		.valid('save-content', 'update-metadata', 'create-checkpoint')
		.required()
		.messages({
			'any.only': 'operationType must be one of: save-content, update-metadata, create-checkpoint',
			'any.required': 'operationType is required',
		}),
	payload: Joi.when('operationType', {
		switch: [
			{
				is: 'save-content',
				then: saveContentPayloadSchema,
			},
			{
				is: 'update-metadata',
				then: updateMetadataPayloadSchema,
			},
			{
				is: 'create-checkpoint',
				then: createCheckpointPayloadSchema,
			},
		],
	}),
});

/**
 * Validation schema for batch operation request
 */
export const batchOperationRequestSchema = Joi.object({
	operations: Joi.array()
		.items(batchOperationSchema)
		.min(1)
		.max(10)
		.required()
		.messages({
			'array.min': 'Batch must contain at least 1 operation',
			'array.max': 'Batch cannot contain more than 10 operations',
			'any.required': 'operations array is required',
		}),
	transactionId: Joi.string().optional().messages({
		'string.base': 'transactionId must be a string',
	}),
});
