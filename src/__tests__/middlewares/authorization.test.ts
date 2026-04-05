import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import {
	authorizeDocument,
	authorizeWorkspace,
} from "../../middlewares/authorization";
import userWorkspaceRepository from "../../repositories/userWorkspaceRepository";
import workspaceRepository from "../../repositories/workspaceRepository";
import {
	mockAuthRequest,
	mockNext,
	mockRequest,
	mockResponse,
} from "../../tests/mocks/express.mocks";
import { ForbiddenError, UnauthorizedError } from "../../utils/errorTypes";

jest.mock("../../repositories/userWorkspaceRepository");
jest.mock("../../repositories/workspaceRepository");
jest.mock("../../utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

describe("Authorization Middleware", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("authorizeWorkspace", () => {
		it("should allow access when user has editor role", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
			});

			jest.mocked(workspaceRepository.exists).mockResolvedValue(true);
			jest.mocked(userWorkspaceRepository.hasAccess).mockResolvedValue(true);
			jest
				.mocked(userWorkspaceRepository.getUserRole)
				.mockResolvedValue("editor");

			const middleware = authorizeWorkspace("editor");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalled();
		});

		it("should throw UnauthorizedError when user not authenticated", async () => {
			req = mockRequest({
				params: { workspaceId: "workspace-123" },
			});

			const middleware = authorizeWorkspace();
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
		});

		it("should throw ForbiddenError when user does not have access", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
			});

			jest.mocked(workspaceRepository.exists).mockResolvedValue(true);
			jest.mocked(userWorkspaceRepository.hasAccess).mockResolvedValue(false);

			const middleware = authorizeWorkspace();
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});

		it("should throw ForbiddenError when user role is insufficient", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
			});

			jest.mocked(workspaceRepository.exists).mockResolvedValue(true);
			jest.mocked(userWorkspaceRepository.hasAccess).mockResolvedValue(true);
			jest
				.mocked(userWorkspaceRepository.getUserRole)
				.mockResolvedValue("viewer");

			const middleware = authorizeWorkspace("editor");
			await middleware(req as Request, res as Response, next);

			expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
		});
	});
});
