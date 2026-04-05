import {
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import documentBodyRepository from "../../repositories/documentBodyRepository";
import documentRepository from "../../repositories/documentRepository";
import {
	mockDocument,
	mockDocumentBody,
	mockDocuments,
} from "../../tests/fixtures";
import {
	mockAuthRequest,
	mockNext,
	mockResponse,
} from "../../tests/mocks/express.mocks";
import { NotFoundError } from "../../utils/errorTypes";

jest.mock("firebase-admin", () => require("../../../__mocks__/firebase-admin"));
jest.mock("../../repositories/documentRepository");
jest.mock("../../repositories/documentBodyRepository");
jest.mock("../../utils/logger", () => ({
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
}));
jest.mock("../../services/permissionService");
jest.mock("../../services/liveblocksWebhookService");

let documentController: typeof import("../../controllers/documentController");

beforeAll(() => {
	documentController = require("../../controllers/documentController");
});

describe("DocumentController", () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		jest.clearAllMocks();
		res = mockResponse();
		next = mockNext();
	});

	describe("createDocument", () => {
		it("should create a document with initial version successfully", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
				body: {
					title: "New Document",
					content: "Initial content",
				},
			});

			jest.mocked(documentRepository.create).mockResolvedValue(mockDocument);
			jest
				.mocked(documentBodyRepository.create)
				.mockResolvedValue(mockDocumentBody);
			jest
				.mocked(documentRepository.updateContent)
				.mockResolvedValue(mockDocument);

			await documentController.createDocument(
				req as Request,
				res as Response,
				next,
			);

			expect(next).not.toHaveBeenCalled(); // Should not call next with error
			expect(documentRepository.create).toHaveBeenCalledWith({
				workspaceId: "workspace-123",
				title: "New Document",
				savedContent: "Initial content",
				currentVersionId: "",
				createdBy: "user-123",
			});
			expect(documentBodyRepository.create).toHaveBeenCalled();
			expect(documentRepository.updateContent).toHaveBeenCalled();
			expect(res.status).toHaveBeenCalledWith(201);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Document created successfully",
				data: { document: mockDocument, initialVersion: mockDocumentBody },
				meta: undefined,
			});
		});
	});

	describe("getWorkspaceDocuments", () => {
		it("should get all documents in workspace", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
			});

			jest
				.mocked(documentRepository.findByWorkspace)
				.mockResolvedValue(mockDocuments);

			await documentController.getWorkspaceDocuments(
				req as Request,
				res as Response,
				next,
			);

			expect(documentRepository.findByWorkspace).toHaveBeenCalledWith(
				"workspace-123",
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Documents retrieved successfully",
				data: { documents: mockDocuments, count: mockDocuments.length },
			});
		});
	});

	describe("getDocumentById", () => {
		it("should get document with current version", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123" },
			});

			jest.mocked(documentRepository.findById).mockResolvedValue(mockDocument);
			jest
				.mocked(documentBodyRepository.findById)
				.mockResolvedValue(mockDocumentBody);

			await documentController.getDocumentById(
				req as Request,
				res as Response,
				next,
			);

			expect(next).not.toHaveBeenCalled(); // Should not call next with error
			expect(documentRepository.findById).toHaveBeenCalledWith("doc-123");
			expect(documentBodyRepository.findById).toHaveBeenCalledWith(
				mockDocument.currentVersionId,
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Document retrieved successfully",
				data: { document: mockDocument, currentVersion: mockDocumentBody },
				meta: undefined,
			});
		});

		it("should throw NotFoundError when document does not exist", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "non-existent" },
			});

			jest.mocked(documentRepository.findById).mockResolvedValue(null);

			await documentController.getDocumentById(
				req as Request,
				res as Response,
				next,
			);

			expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
		});
	});

	describe("updateDocument", () => {
		it("should update document title successfully", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123" },
				body: { title: "Updated Title" },
			});

			const updatedDocument = { ...mockDocument, title: "Updated Title" };
			jest.mocked(documentRepository.update).mockResolvedValue(updatedDocument);

			await documentController.updateDocument(
				req as Request,
				res as Response,
				next,
			);

			expect(documentRepository.update).toHaveBeenCalledWith("doc-123", {
				title: "Updated Title",
			});
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Document updated successfully",
				data: { document: updatedDocument },
			});
		});
	});

	describe("updateDocumentContent", () => {
		it("should create new version when updating content", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123" },
				body: { content: "Updated content" },
			});

			const newVersion = { ...mockDocumentBody, versionNumber: 2 };
			jest
				.mocked(documentBodyRepository.getLatestVersionNumber)
				.mockResolvedValue(1);
			jest
				.mocked(documentBodyRepository.setAllVersionsNotCurrent)
				.mockResolvedValue(undefined);
			jest.mocked(documentBodyRepository.create).mockResolvedValue(newVersion);
			jest
				.mocked(documentRepository.updateContent)
				.mockResolvedValue(mockDocument);
			jest
				.mocked(documentBodyRepository.findById)
				.mockResolvedValue(newVersion);

			await documentController.updateDocumentContent(
				req as Request,
				res as Response,
				next,
			);

			expect(next).not.toHaveBeenCalled(); // Should not call next with error
			expect(documentBodyRepository.create).toHaveBeenCalledWith({
				documentId: "doc-123",
				userId: "user-123",
				content: "Updated content",
				message: expect.any(String),
				isCurrentVersion: true,
				versionNumber: expect.any(Number),
			});
			expect(res.status).toHaveBeenCalledWith(200);
		});
	});

	describe("deleteDocument", () => {
		it("should delete document successfully", async () => {
			req = mockAuthRequest("user-123", {
				params: { documentId: "doc-123" },
			});

			jest.mocked(documentRepository.delete).mockResolvedValue(undefined);

			await documentController.deleteDocument(
				req as Request,
				res as Response,
				next,
			);

			expect(documentRepository.delete).toHaveBeenCalledWith("doc-123");
			expect(res.status).toHaveBeenCalledWith(204);
		});
	});

	describe("searchDocuments", () => {
		it("should search documents by title", async () => {
			req = mockAuthRequest("user-123", {
				params: { workspaceId: "workspace-123" },
				query: { q: "research" },
			});

			const searchResults = [mockDocument];
			jest
				.mocked(documentRepository.searchByTitle)
				.mockResolvedValue(searchResults);

			await documentController.searchDocuments(
				req as Request,
				res as Response,
				next,
			);

			expect(documentRepository.searchByTitle).toHaveBeenCalledWith(
				"workspace-123",
				"research",
			);
			expect(res.status).toHaveBeenCalledWith(200);
			expect(res.json).toHaveBeenCalledWith({
				success: true,
				message: "Documents retrieved successfully",
				data: { documents: searchResults, count: 1 },
				meta: undefined,
			});
		});
	});

	describe("getUserDocuments", () => {
		it("should get all documents for a user across workspaces", async () => {
			req = mockAuthRequest("user-123");

			jest
				.mocked(documentRepository.findByCreator)
				.mockResolvedValue(mockDocuments);

			await documentController.getUserDocuments(
				req as Request,
				res as Response,
				next,
			);

			expect(documentRepository.findByCreator).toHaveBeenCalledWith("user-123");
			expect(res.status).toHaveBeenCalledWith(200);
		});
	});
});
