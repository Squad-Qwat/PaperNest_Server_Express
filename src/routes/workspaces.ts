import { Router } from 'express';
import * as workspaceController from '../controllers/workspaceController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  authorizeWorkspace,
  authorizeWorkspaceOwner,
} from '../middlewares/authorization';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateInvitationStatusSchema,
} from '../models/validators/workspaceValidator';

const router = Router();

/**
 * @route   POST /api/workspaces
 * @desc    Create a new workspace
 * @access  Protected
 */
router.post(
  '/',
  authenticate,
  validate({ body: createWorkspaceSchema }),
  workspaceController.createWorkspace
);

/**
 * @route   GET /api/workspaces
 * @desc    Get all workspaces for current user
 * @access  Protected
 */
router.get(
  '/',
  authenticate,
  workspaceController.getUserWorkspaces
);

/**
 * @route   GET /api/workspaces/:workspaceId
 * @desc    Get workspace by ID
 * @access  Protected (requires workspace access)
 */
router.get(
  '/:workspaceId',
  authenticate,
  authorizeWorkspace(),
  workspaceController.getWorkspaceById
);

/**
 * @route   PUT /api/workspaces/:workspaceId
 * @desc    Update workspace
 * @access  Protected (requires editor role or higher)
 */
router.put(
  '/:workspaceId',
  authenticate,
  authorizeWorkspace('editor'),
  validate({ body: updateWorkspaceSchema }),
  workspaceController.updateWorkspace
);

/**
 * @route   DELETE /api/workspaces/:workspaceId
 * @desc    Delete workspace
 * @access  Protected (owner only)
 */
router.delete(
  '/:workspaceId',
  authenticate,
  authorizeWorkspaceOwner,
  workspaceController.deleteWorkspace
);

/**
 * @route   GET /api/workspaces/:workspaceId/members
 * @desc    Get workspace members
 * @access  Protected (requires workspace access)
 */
router.get(
  '/:workspaceId/members',
  authenticate,
  authorizeWorkspace(),
  workspaceController.getWorkspaceMembers
);

/**
 * @route   POST /api/workspaces/:workspaceId/members
 * @desc    Invite member to workspace
 * @access  Protected (requires editor role or higher)
 */
router.post(
  '/:workspaceId/members',
  authenticate,
  authorizeWorkspace('editor'),
  validate({ body: inviteMemberSchema }),
  workspaceController.inviteMember
);

/**
 * @route   PUT /api/workspaces/:workspaceId/members/:userWorkspaceId
 * @desc    Update member role
 * @access  Protected (owner only)
 */
router.put(
  '/:workspaceId/members/:userWorkspaceId',
  authenticate,
  authorizeWorkspaceOwner,
  validate({ body: updateMemberRoleSchema }),
  workspaceController.updateMemberRole
);

/**
 * @route   DELETE /api/workspaces/:workspaceId/members/:userWorkspaceId
 * @desc    Remove member from workspace
 * @access  Protected (owner only, or user removing themselves)
 */
router.delete(
  '/:workspaceId/members/:userWorkspaceId',
  authenticate,
  authorizeWorkspace(),
  workspaceController.removeMember
);

export default router;
