import Joi from 'joi';

/**
 * Validation schema for creating a document
 */
export const createDocumentSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 500 characters',
      'any.required': 'Title is required',
    }),
  description: Joi.string()
    .max(2000)
    .allow('', null)
    .messages({
      'string.max': 'Description cannot exceed 2000 characters',
    }),
  content: Joi.any()
    .default('')
    .messages({
      'any.base': 'Content must be a valid value',
    }),
  message: Joi.string()
    .max(500)
    .default('Initial version')
    .messages({
      'string.max': 'Version message cannot exceed 500 characters',
    }),
});

/**
 * Validation schema for updating a document
 */
export const updateDocumentSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(500)
    .messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 500 characters',
    }),
  description: Joi.string()
    .max(2000)
    .allow('', null)
    .messages({
      'string.max': 'Description cannot exceed 2000 characters',
    }),
}).min(1);

/**
 * Validation schema for updating document content (creates new version)
 */
export const updateDocumentContentSchema = Joi.object({
  content: Joi.any()
    .required()
    .messages({
      'any.required': 'Content is required',
    }),
  message: Joi.string()
    .max(500)
    .default('Updated content')
    .messages({
      'string.max': 'Version message cannot exceed 500 characters',
    }),
});

/**
 * Validation schema for searching documents
 */
export const searchDocumentSchema = Joi.object({
  q: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'Search query is required',
      'string.min': 'Search query cannot be empty',
    }),
});
