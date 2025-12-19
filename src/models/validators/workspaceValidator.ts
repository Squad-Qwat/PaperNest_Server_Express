import Joi from 'joi';

/**
 * Validation schema for creating a workspace
 */
export const createWorkspaceSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required',
    }),
  description: Joi.string()
    .allow('')
    .max(1000)
    .default('')
    .messages({
      'string.max': 'Description cannot exceed 1000 characters',
    }),
  icon: Joi.string()
    .allow('')
    .optional()
    .messages({
      'string.base': 'Icon must be a string',
    }),
});

/**
 * Validation schema for updating a workspace
 */
export const updateWorkspaceSchema = Joi.object({
  title: Joi.string()
    .min(1)
    .max(200)
    .messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 200 characters',
    }),
  description: Joi.string()
    .allow('')
    .max(1000)
    .messages({
      'string.max': 'Description cannot exceed 1000 characters',
    }),
  icon: Joi.string()
    .allow('')
    .optional()
    .messages({
      'string.base': 'Icon must be a string',
    }),
}).min(1);

/**
 * Validation schema for inviting a member to workspace
 */
export const inviteMemberSchema = Joi.object({
  userId: Joi.string()
    .required()
    .messages({
      'any.required': 'User ID is required',
    }),
  role: Joi.string()
    .valid('editor', 'viewer', 'reviewer')
    .default('viewer')
    .messages({
      'any.only': 'Role must be either editor, viewer, or reviewer',
    }),
});

/**
 * Validation schema for updating member role
 */
export const updateMemberRoleSchema = Joi.object({
  role: Joi.string()
    .valid('owner', 'editor', 'viewer', 'reviewer')
    .required()
    .messages({
      'any.only': 'Role must be owner, editor, viewer, or reviewer',
      'any.required': 'Role is required',
    }),
});

/**
 * Validation schema for accepting/declining invitation
 */
export const updateInvitationStatusSchema = Joi.object({
  status: Joi.string()
    .valid('accepted', 'declined')
    .required()
    .messages({
      'any.only': 'Status must be either accepted or declined',
      'any.required': 'Status is required',
    }),
});
