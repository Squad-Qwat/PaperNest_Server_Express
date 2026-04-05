import { Request, Response } from 'express';
import { WebhookHandler } from '@liveblocks/node';
import { asyncHandler } from '../middlewares/errorHandler';
import { successResponse } from '../utils/responseFormatter';
import { BadRequestError } from '../utils/errorTypes';
import { env } from '../config/env';
import liveblocksWebhookService from '../services/liveblocksWebhookService';
import logger from '../utils/logger';

const WEBHOOK_SECRET = env.LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  logger.error('LIVEBLOCKS_USER_LEFT_WEBHOOK_SECRET not configured');
}

const webhookHandler = new WebhookHandler(WEBHOOK_SECRET);

export const handleLiveblocksWebhook = asyncHandler(async (req: Request, res: Response) => {
  let event;
  try {
    event = webhookHandler.verifyRequest({
      headers: req.headers as any,
      rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    });
  } catch (error) {
    logger.error('Webhook verification failed:', error);
    throw new BadRequestError('Could not verify webhook call');
  }

  logger.info(`Verified webhook event: ${event.type}`);

  if (event.type === 'userLeft') {
    const roomId = event.data?.roomId;
    
    if (!roomId) {
      throw new BadRequestError('Missing roomId');
    }

    logger.info('User left event received', {
      roomId,
      userId: event.data?.userId,
      connectionId: event.data?.connectionId,
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const cleanupResult = await liveblocksWebhookService.checkAndCleanupRoom(roomId);
    
    logger.info('Cleanup result:', cleanupResult);
    
    return successResponse(res, cleanupResult, 'Webhook processed successfully');
  }

  if (event.type === 'userEntered') {
    logger.info('User entered room', {
      roomId: event.data?.roomId,
      userId: event.data?.userId,
      connectionId: event.data?.connectionId,
    });
    
    return successResponse(res, null, 'Webhook processed successfully');
  }

  logger.info(`Unhandled webhook type: ${event.type}`);
  return successResponse(res, null, 'Webhook processed successfully');
});

export const webhookHealthCheck = asyncHandler(async (req: Request, res: Response) => {
  return successResponse(
    res,
    {
      message: 'Liveblocks Webhook Endpoint',
      status: 'active',
      timestamp: new Date().toISOString(),
    },
    'Webhook endpoint is active'
  );
});
