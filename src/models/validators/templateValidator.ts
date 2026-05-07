import Joi from "joi";

export const templateValidator = {
	getTemplateById: {
		params: Joi.object({
			templateId: Joi.string()
				.required()
				.pattern(/^[a-zA-Z0-9_-]+$/)
				.min(1)
				.max(50),
		}),
	},
};
