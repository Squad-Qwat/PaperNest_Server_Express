import type { NextFunction, Request, Response } from 'express'
import axios from 'axios'
import { HTTP_STATUS } from '../config/constants'
import logger from '../utils/logger'
import { errorResponse, forbiddenResponse } from '../utils/responseFormatter'

export const validateTurnstile = async (
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> => {
	const turnstileToken = req.headers['x-turnstile-token'] || req.body.turnstileToken

	if (!turnstileToken) {
		errorResponse(res, 'Turnstile token is required', HTTP_STATUS.BAD_REQUEST)
		return
	}

	try {
		const secretKey = process.env.TURNSTILE_SECRET_KEY
		const remoteIp = req.ip || req.socket.remoteAddress

		const response = await axios.post(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				secret: secretKey,
				response: turnstileToken,
				remoteip: remoteIp,
			}
		)

		if (response.data.success) {
			next()
		} else {
			logger.warn('Turnstile validation failed', {
				errorCodes: response.data['error-codes'],
				remoteIp,
			})
			forbiddenResponse(res, 'Invalid captcha verification')
		}
	} catch (error) {
		logger.error('Turnstile validation error', { error })
		errorResponse(res, 'Error validating captcha', HTTP_STATUS.INTERNAL_SERVER_ERROR)
	}
}
