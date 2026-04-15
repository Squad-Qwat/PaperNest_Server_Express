import { Router } from 'express';
import * as workspaceController from '../controllers/workspaceController';
import { validate } from '../middlewares/validation';
import { authenticate } from '../middlewares/auth';
import {
  updateInvitationStatusSchema,
} from '../models/validators/workspaceValidator';

const router: Router = Router();

/**
 * @route   GET /api/invitations
 * @desc    Get pending invitations for current user
 * @access  Protected
 */
router.get(
  '/',
  authenticate,
  workspaceController.getPendingInvitations
);

/**
 * @route   PUT /api/invitations/:userWorkspaceId
 * @desc    Accept or decline invitation
 * @access  Protected
 */
router.put(
  '/:userWorkspaceId',
  authenticate,
  validate({ body: updateInvitationStatusSchema }),
  workspaceController.updateInvitationStatus
);

export default router;
