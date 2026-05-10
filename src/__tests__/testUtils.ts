import { jest } from "@jest/globals";

/**
 * Creates standardized mock Request, Response, and Next function for controller tests.
 * Reduces duplication reported in Sonar/Biome.
 */
export const createMockExpress = (initialReq: any = {}) => {
	const mockReq = {
		body: {},
		params: {},
		query: {},
		userId: "user-123",
		...initialReq,
	};

	const mockRes = {
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
		send: jest.fn().mockReturnThis(),
	};

	const next = jest.fn();

	return { mockReq, mockRes, next };
};
