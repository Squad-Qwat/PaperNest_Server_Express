import Joi from "joi";

export const sendInvitationsSchema = Joi.object({
	emails: Joi.array().items(Joi.string().email()).min(1).required().messages({
		"array.min": "At least one email is required",
		"string.email": "Invalid email format",
	}),
	role: Joi.string()
		.valid("editor", "viewer", "reviewer")
		.default("viewer")
		.messages({
			"any.only": "Role must be either editor, viewer, or reviewer",
		}),
});

export const acceptInvitationSchema = Joi.object({
	token: Joi.string().required().messages({
		"any.required": "Token is required",
	}),
});
