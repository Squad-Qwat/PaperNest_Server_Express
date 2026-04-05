import Joi from 'joi';
import { USER_ROLES } from '../../config/constants';

/**
 * Validation schema for user registration
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required',
    }),
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required',
    }),
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'Username must contain only alphanumeric characters',
      'string.min': 'Username must be at least 3 characters long',
      'string.max': 'Username cannot exceed 30 characters',
      'any.required': 'Username is required',
    }),
  role: Joi.string()
    .valid(USER_ROLES.STUDENT, USER_ROLES.LECTURER)
    .required()
    .messages({
      'any.only': `Role must be either ${USER_ROLES.STUDENT} or ${USER_ROLES.LECTURER}`,
      'any.required': 'Role is required',
    }),
  workspaceData: Joi.object({
    mode: Joi.string().valid('create', 'join').required(),
    title: Joi.string()
      .min(3)
      .when('mode', { is: 'create', then: Joi.required(), otherwise: Joi.optional().allow('') })
      .messages({
        'string.min': 'Workspace title must be at least 3 characters long',
        'any.required': 'Workspace title is required when creating a new workspace',
      }),
    description: Joi.string().allow('').optional(),
    icon: Joi.string().allow('').optional(),
    invitationCode: Joi.string()
      .when('mode', { is: 'join', then: Joi.required(), otherwise: Joi.optional().allow('') })
      .messages({
        'any.required': 'Invitation code is required when joining a workspace',
      }),
  }).optional(),
});

/**
 * Validation schema for login with Firebase token
 */
export const loginSchema = Joi.object({
  firebaseToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Firebase token is required',
    }),
  accessToken: Joi.string()
    .optional(),
});

/**
 * Validation schema for login with email and password
 */
export const loginWithEmailPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required',
    }),
});

/**
 * Validation schema for refresh token
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Refresh token is required',
    }),
});

/**
 * Validation schema for verifying Firebase token
 */
export const verifyTokenSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Token is required',
    }),
});

/**
 * Validation schema for updating user email
 */
export const updateEmailSchema = Joi.object({
  newEmail: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'New email is required',
    }),
});

/**
 * Validation schema for password reset request
 */
export const passwordResetSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});

/**
 * Validation schema for finalizing registration
 */
export const finalizeRegistrationSchema = Joi.object({
  firebaseToken: Joi.string()
    .required()
    .messages({
      'any.required': 'Firebase token is required',
    }),
});

/**
 * Validation schema for checking email availability
 */
export const checkEmailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required',
    }),
});
