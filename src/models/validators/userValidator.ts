import Joi from 'joi';

/**
 * Validation schema for updating user profile
 */
export const updateUserSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
    }),
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
    }),
  photoURL: Joi.string()
    .uri()
    .allow(null)
    .messages({
      'string.uri': 'Photo URL must be a valid URL',
    }),
}).min(1);

/**
 * Validation schema for user search
 */
export const searchUserSchema = Joi.object({
  q: Joi.string()
    .min(1)
    .required()
    .messages({
      'any.required': 'Search query is required',
      'string.min': 'Search query cannot be empty',
    }),
});
