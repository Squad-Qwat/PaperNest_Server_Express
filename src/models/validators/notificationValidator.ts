import Joi from "joi";

/**
 * Validation schema for filtering notifications by type
 */
export const filterNotificationTypeSchema = Joi.object({
	type: Joi.string()
		.valid("invitation", "review_request", "review_completed", "comment")
		.required()
		.messages({
			"any.only":
				"Type must be invitation, review_request, review_completed, or comment",
			"any.required": "Type is required",
		}),
});

/**
 * Validation schema for filtering notifications by read status
 */
export const filterNotificationReadSchema = Joi.object({
	read: Joi.boolean().required().messages({
		"any.required": "Read filter is required",
		"boolean.base": "Read must be true or false",
	}),
});
