import Joi from "joi";

/**
 * Validation schema for creating a review request
 */
export const createReviewSchema = Joi.object({
	lecturerUserId: Joi.string().required().messages({
		"any.required": "Lecturer user ID is required",
	}),
	message: Joi.string().allow("").max(2000).default("").messages({
		"string.max": "Message cannot exceed 2000 characters",
	}),
});

/**
 * Validation schema for updating review message
 */
export const updateReviewSchema = Joi.object({
	message: Joi.string().min(1).max(2000).required().messages({
		"string.min": "Message cannot be empty",
		"string.max": "Message cannot exceed 2000 characters",
		"any.required": "Message is required",
	}),
});

/**
 * Validation schema for updating review status
 */
export const updateReviewStatusSchema = Joi.object({
	status: Joi.string()
		.valid("approved", "revision_required", "rejected")
		.required()
		.messages({
			"any.only": "Status must be approved, revision_required, or rejected",
			"any.required": "Status is required",
		}),
	message: Joi.string().allow("").max(2000).default("").messages({
		"string.max": "Message cannot exceed 2000 characters",
	}),
});

/**
 * Validation schema for filtering reviews by status
 */
export const filterReviewStatusSchema = Joi.object({
	status: Joi.string()
		.valid("pending", "approved", "revision_required", "rejected")
		.required()
		.messages({
			"any.only":
				"Status must be pending, approved, revision_required, or rejected",
			"any.required": "Status is required",
		}),
});
