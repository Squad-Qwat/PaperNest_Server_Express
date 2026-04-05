import Joi from "joi";

/**
 * Validation schema for creating a new document version
 */
export const createVersionSchema = Joi.object({
	content: Joi.string().required().messages({
		"any.required": "Content is required",
		"string.base": "Content must be a string",
	}),
	message: Joi.string().min(1).max(500).required().messages({
		"string.min": "Version message cannot be empty",
		"string.max": "Version message cannot exceed 500 characters",
		"any.required": "Version message is required",
	}),
});

/**
 * Validation schema for version number parameter
 */
export const versionNumberSchema = Joi.object({
	versionNumber: Joi.number().integer().min(1).required().messages({
		"number.base": "Version number must be a number",
		"number.integer": "Version number must be an integer",
		"number.min": "Version number must be at least 1",
		"any.required": "Version number is required",
	}),
});
