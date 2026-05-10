import type { Request, Response } from "express";
import { asyncHandler } from "../middlewares/errorHandler";
import userRepository from "../repositories/userRepository";
import { ConflictError, NotFoundError } from "../utils/errorTypes";
import logger from "../utils/logger";
import { notFoundResponse, successResponse } from "../utils/responseFormatter";

/**
 * Get user by ID
 * GET /api/users/:userId
 * Protected
 */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
	const userId = req.params.userId as string;

	logger.info("Get user request", { userId });

	const user = await userRepository.findById(userId);

	if (!user) {
		throw new NotFoundError("User not found");
	}

	return successResponse(res, { user }, "User retrieved successfully");
});

/**
 * Search users by name or email
 * GET /api/users/search?q=query
 * Protected
 */
export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
	const { q } = req.query as { q: string };

	logger.info("Search users request", { query: q });

	const users = await userRepository.search(q);

	return successResponse(
		res,
		{ users, count: users.length },
		"Users retrieved successfully",
	);
});

/**
 * Update user profile
 * PUT /api/users/:userId
 * Protected (own profile only)
 */
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
	const { userId } = req.params;
	const updates = req.body;

	// Users can only update their own profile
	if (req.userId !== userId) {
		throw new NotFoundError("You can only update your own profile");
	}

	logger.info("Update user request", { userId, updates });

	// Check if username is being updated and is unique
	if (updates.username) {
		const existingUser = await userRepository.findByUsername(updates.username);
		if (existingUser && existingUser.userId !== userId) {
			throw new ConflictError("Username already taken");
		}
	}

	const user = await userRepository.update(userId, updates);

	return successResponse(res, { user }, "User updated successfully");
});

/**
 * Delete user account
 * DELETE /api/users/:userId
 * Protected (own account only)
 */
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
	const { userId } = req.params;

	if (req.userId !== userId) {
		throw new NotFoundError("You can only delete your own account");
	}

	logger.info("Delete user request", { userId });

	await userRepository.delete(userId);

	return successResponse(res, null, "User deleted successfully");
});

export default {
	getUserById,
	searchUsers,
	updateUser,
	deleteUser,
};
