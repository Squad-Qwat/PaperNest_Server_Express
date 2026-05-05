import Joi from "joi";

/**
 * Validation schema for creating a comment
 */
export const createCommentSchema = Joi.object({
	content: Joi.string().min(1).max(5000).required().messages({
		"string.min": "Comment cannot be empty",
		"string.max": "Comment cannot exceed 5000 characters",
		"any.required": "Content is required",
	}),
	textSelection: Joi.object({
		start: Joi.number().integer().min(0).required().messages({
			"number.base": "Start position must be a number",
			"number.integer": "Start position must be an integer",
			"number.min": "Start position cannot be negative",
		}),
		end: Joi.number().integer().min(0).required().messages({
			"number.base": "End position must be a number",
			"number.integer": "End position must be an integer",
			"number.min": "End position cannot be negative",
		}),
		text: Joi.string().required().messages({
			"any.required": "Selected text is required",
		}),
	})
		.allow(null)
		.default(null),
	parentCommentId: Joi.string().allow(null).default(null).messages({
		"string.base": "Parent comment ID must be a string",
	}),
});

/**
 * Validation schema for updating a comment
 */
export const updateCommentSchema = Joi.object({
	content: Joi.string().min(1).max(5000).required().messages({
		"string.min": "Comment cannot be empty",
		"string.max": "Comment cannot exceed 5000 characters",
		"any.required": "Content is required",
	}),
});

/**
 * Validation schema for filtering comments by resolved status
 */
export const filterCommentResolvedSchema = Joi.object({
	resolved: Joi.boolean().required().messages({
		"any.required": "Resolved filter is required",
		"boolean.base": "Resolved must be true or false",
	}),
});
