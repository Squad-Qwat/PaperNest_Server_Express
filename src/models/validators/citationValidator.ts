import Joi from "joi";

/**
 * Validation schema for creating a citation
 */
export const createCitationSchema = Joi.object({
	type: Joi.string().required().messages({
		"any.required": "Citation type is required",
	}),
	title: Joi.string().min(1).max(1000).required().messages({
		"string.min": "Title cannot be empty",
		"string.max": "Title cannot exceed 1000 characters",
		"any.required": "Title is required",
	}),
	author: Joi.string().min(1).max(500).required().messages({
		"string.min": "Author cannot be empty",
		"string.max": "Author cannot exceed 500 characters",
		"any.required": "Author is required",
	}),
	publicationInfo: Joi.string().allow("").max(1000).default("").messages({
		"string.max": "Publication info cannot exceed 1000 characters",
	}),
	doi: Joi.string().allow(null, "").messages({
		"string.base": "DOI must be a string",
	}),
	accessDate: Joi.string().allow("").default("").messages({
		"string.base": "Access date must be a string",
	}),
	publicationDate: Joi.string().allow("").default("").messages({
		"string.base": "Publication date must be a string",
	}),
	url: Joi.string().uri().allow(null, "").messages({
		"string.uri": "URL must be valid",
	}),
	cslJson: Joi.object().default({}).messages({
		"object.base": "CSL JSON must be an object",
	}),
});

/**
 * Validation schema for updating a citation
 */
export const updateCitationSchema = Joi.object({
	type: Joi.string(),
	title: Joi.string().min(1).max(1000).messages({
		"string.min": "Title cannot be empty",
		"string.max": "Title cannot exceed 1000 characters",
	}),
	author: Joi.string().min(1).max(500).messages({
		"string.min": "Author cannot be empty",
		"string.max": "Author cannot exceed 500 characters",
	}),
	publicationInfo: Joi.string().allow("").max(1000).messages({
		"string.max": "Publication info cannot exceed 1000 characters",
	}),
	doi: Joi.string().allow(null, ""),
	accessDate: Joi.string().allow(""),
	publicationDate: Joi.string().allow(""),
	url: Joi.string().uri().allow(null, "").messages({
		"string.uri": "URL must be valid",
	}),
	cslJson: Joi.object(),
}).min(1);

/**
 * Validation schema for searching citations
 */
export const searchCitationSchema = Joi.object({
	q: Joi.string().min(1).required().messages({
		"any.required": "Search query is required",
		"string.min": "Search query cannot be empty",
	}),
});

/**
 * Validation schema for filtering citations by type
 */
export const filterCitationTypeSchema = Joi.object({
	type: Joi.string().required().messages({
		"any.required": "Citation type is required",
	}),
});
