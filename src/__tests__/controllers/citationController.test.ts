import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import * as citationController from "../../controllers/citationController";
import citationRepository from "../../repositories/citationRepository";
import { mockCitation, mockCitations } from "../../tests/fixtures";
import {
	mockNext,
	mockRequest,
	mockResponse,
} from "../../tests/mocks/express.mocks";
import { NotFoundError } from "../../utils/errorTypes";

// Mock dependencies
jest.mock("firebase-admin", () => require("../../../__mocks__/firebase-admin"));
jest.mock("../../repositories/citationRepository");
jest.mock("../../utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));

describe("CitationController", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;
	const mockUserId = "user-123";

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("createCitation", () => {
		it("should create a global citation successfully", async () => {
			req = mockRequest({
				userId: mockUserId,
				body: {
					type: "article-journal",
					title: "Test Article",
					author: "Smith, J.",
					publicationDate: "2023",
					cslJson: {},
				},
			});

			jest.mocked(citationRepository.createGlobalCitation).mockResolvedValue(mockCitation);

			await citationController.createCitation(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.createGlobalCitation).toHaveBeenCalledWith(
				mockUserId,
				expect.objectContaining({
					type: "article-journal",
					title: "Test Article",
					author: "Smith, J.",
					publicationDate: "2023",
				}),
			);
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Citation created successfully in library",
				data: { citation: mockCitation },
			});
		});
	});

	describe("getCitations", () => {
		it("should get all citations for a user with pagination", async () => {
			req = mockRequest({
				userId: mockUserId,
				query: { page: "1", limit: "10" },
			});

			const mockResult = { data: mockCitations, total: 2, totalPages: 1 };
			jest
				.mocked(citationRepository.getAllByPagination)
				.mockResolvedValue(mockResult);

			await citationController.getCitations(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.getAllByPagination).toHaveBeenCalledWith(mockUserId, 1, 10);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Citations retrieved successfully",
				data: mockResult,
			});
		});
	});

	describe("getCitationById", () => {
		it("should get user citation by id successfully", async () => {
			req = mockRequest({
				userId: mockUserId,
				params: { citationId: "citation-123" },
			});

			jest.mocked(citationRepository.findUserCitationById).mockResolvedValue(mockCitation);

			await citationController.getCitationById(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.findUserCitationById).toHaveBeenCalledWith(mockUserId, "citation-123");
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Citation retrieved successfully",
				data: { citation: mockCitation },
			});
		});

		it("should throw NotFoundError when citation does not exist or unauthorized", async () => {
			req = mockRequest({
				userId: mockUserId,
				params: { citationId: "non-existent" },
			});

			jest.mocked(citationRepository.findUserCitationById).mockResolvedValue(null);

			await citationController.getCitationById(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
		});
	});

	describe("updateCitation", () => {
		it("should update user citation successfully", async () => {
			req = mockRequest({
				userId: mockUserId,
				params: { citationId: "citation-123" },
				body: { title: "Updated Title" },
			});

			const updatedCitation = { ...mockCitation, title: "Updated Title" };
			jest.mocked(citationRepository.updateUserCitation).mockResolvedValue(updatedCitation);

			await citationController.updateCitation(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.updateUserCitation).toHaveBeenCalledWith(
				mockUserId,
				"citation-123",
				expect.objectContaining({
					title: "Updated Title",
				}),
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Citation updated successfully",
				data: { citation: updatedCitation },
			});
		});
	});

	describe("deleteCitation", () => {
		it("should delete user citation successfully", async () => {
			req = mockRequest({
				userId: mockUserId,
				params: { citationId: "citation-123" },
			});

			jest.mocked(citationRepository.deleteUserCitation).mockResolvedValue(true);

			await citationController.deleteCitation(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.deleteUserCitation).toHaveBeenCalledWith(mockUserId, "citation-123");
			expect(res.status).toHaveBeenCalledWith(204);
		});
	});

	describe("searchCitations", () => {
		it("should search user citations by title and author", async () => {
			req = mockRequest({
				userId: mockUserId,
				query: { q: "machine learning", limit: "5" },
			});

			const searchResults = [mockCitation];
			jest.mocked(citationRepository.searchCitationsByUser).mockResolvedValue(searchResults);

			await citationController.searchCitations(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.searchCitationsByUser).toHaveBeenCalledWith(
				mockUserId,
				"machine learning",
				5
			);
			expect(res.status).toHaveBeenCalledWith(200);
		});
	});

	describe("getCitationByDOI", () => {
		it("should find user citation by DOI successfully", async () => {
			req = mockRequest({
				userId: mockUserId,
				params: { doi: "10.1234/example" },
			});

			jest.mocked(citationRepository.findUserCitationByDoi).mockResolvedValue(mockCitation);

			await citationController.getCitationByDOI(
				req as Request,
				res as Response,
				next,
			);

			expect(citationRepository.findUserCitationByDoi).toHaveBeenCalledWith(
				mockUserId,
				"10.1234/example",
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Citation retrieved successfully",
				data: { citation: mockCitation },
				meta: undefined,
			});
		});
	});
});
