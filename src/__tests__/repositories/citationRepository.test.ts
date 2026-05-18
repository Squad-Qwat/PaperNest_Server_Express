import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { __mockFirestore } from "../../../__mocks__/firebase-admin";
import citationRepository from "../../repositories/citationRepository";
import { mockCitation, mockCitations } from "../../tests/fixtures";

jest.mock("../../config/firebase", () => ({
	db: require("../../../__mocks__/firebase-admin").__mockFirestore,
}));

describe("CitationRepository", () => {
	let mockCollection: any;
	const mockUserId = "user-123";

	beforeEach(() => {
		jest.clearAllMocks();
		mockCollection = __mockFirestore.collection("citations");
	});

	describe("createGlobalCitation", () => {
		it("should create a new user citation successfully", async () => {
			const citationData = {
				type: "article-journal",
				title: "Test Article",
				author: "Smith, J.",
				publicationInfo: "Journal of Testing, 2023",
				doi: null,
				accessDate: "2024-01-01",
				publicationDate: "2023-12-01",
				url: null,
				cslJson: { type: "article-journal", title: "Test Article" },
			};

			mockCollection.doc = jest.fn().mockReturnValue({
				id: "citation-123",
				set: (jest.fn() as any).mockResolvedValue(undefined),
			});

			const result = await citationRepository.createGlobalCitation(mockUserId, citationData);

			expect(result).toMatchObject(citationData);
			expect(result.citationId).toBeDefined();
			expect(result.userId).toBe(mockUserId);
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(mockCollection.doc).toHaveBeenCalled();
		});
	});

	describe("findUserCitationById", () => {
		it("should return citation when found and owned by user", async () => {
			const citationId = "citation-123";
			const mockDoc = {
				exists: true,
				data: () => ({ ...mockCitation, userId: mockUserId }),
			};

			mockCollection.doc = jest.fn().mockReturnValue({
				get: (jest.fn() as any).mockResolvedValue(mockDoc),
			});

			const result = await citationRepository.findUserCitationById(mockUserId, citationId);

			expect(result).toBeDefined();
			expect(result?.userId).toBe(mockUserId);
		});

		it("should return null when citation not found", async () => {
			const citationId = "non-existent";
			const mockDoc = {
				exists: false,
			};

			mockCollection.doc = jest.fn().mockReturnValue({
				get: (jest.fn() as any).mockResolvedValue(mockDoc),
			});

			const result = await citationRepository.findUserCitationById(mockUserId, citationId);

			expect(result).toBeNull();
		});

		it("should return null when citation owned by different user", async () => {
			const citationId = "citation-123";
			const mockDoc = {
				exists: true,
				data: () => ({ ...mockCitation, userId: "different-user" }),
			};

			mockCollection.doc = jest.fn().mockReturnValue({
				get: (jest.fn() as any).mockResolvedValue(mockDoc),
			});

			const result = await citationRepository.findUserCitationById(mockUserId, citationId);

			expect(result).toBeNull();
		});
	});

	describe("findCitationsByUser", () => {
		it("should return all citations for a user", async () => {
			const whereSpy = jest.spyOn(mockCollection, "where");

			mockCollection.setMockDocs(mockCitations.map(c => ({...c, userId: mockUserId})));

			const result = await citationRepository.findCitationsByUser(mockUserId);

			expect(result.length).toBeGreaterThan(0);
			expect(whereSpy).toHaveBeenCalledWith("userId", "==", mockUserId);
		});
	});

	describe("getAllByPagination", () => {
		it("should paginate correctly", async () => {
			mockCollection.setMockDocs(mockCitations);
			
			// Mock count to avoid overriding get
			const countSpy = jest.spyOn(mockCollection, 'count').mockReturnValue({
				get: async () => ({ data: () => ({ count: 10 }) })
			} as any);

			const result = await citationRepository.getAllByPagination(mockUserId, 1, 5);

			expect(result.total).toBe(10);
			expect(result.totalPages).toBe(2);
			expect(result.data).toBeDefined();
			
			countSpy.mockRestore();
		});
	});

	describe("findByName", () => {
		it("should return citation by exact title", async () => {
			const titleName = "Test Article";

			mockCollection.setMockDocs([mockCitation]);

			const result = await citationRepository.findByName(mockUserId, titleName);

			expect(result).toEqual(mockCitation);
		});
	});

	describe("findUserCitationByDoi", () => {
		it("should return citation when found by DOI", async () => {
			const doi = "10.1234/example.doi";

			mockCollection.setMockDocs([mockCitation]);

			const result = await citationRepository.findUserCitationByDoi(mockUserId, doi);

			expect(result).toEqual(mockCitation);
		});
	});

	describe("updateUserCitation", () => {
		it("should update citation successfully when owned by user", async () => {
			const citationId = "citation-123";
			const updates = { title: "Updated Title" };

			// Mock findUserCitationById behavior internally
			jest.spyOn(citationRepository, 'findUserCitationById')
				.mockResolvedValueOnce({ ...mockCitation, userId: mockUserId }) // For initial check
				.mockResolvedValueOnce({ ...mockCitation, ...updates, userId: mockUserId }); // For returning updated

			mockCollection.doc = jest.fn().mockReturnValue({
				update: (jest.fn() as any).mockResolvedValue(undefined),
			});

			const result = await citationRepository.updateUserCitation(mockUserId, citationId, updates);

			expect(result).toMatchObject(updates);
			expect(mockCollection.doc).toHaveBeenCalledWith(citationId);
		});
	});

	describe("deleteUserCitation", () => {
		it("should delete citation successfully when owned by user", async () => {
			const citationId = "citation-123";

			jest.spyOn(citationRepository, 'findUserCitationById')
				.mockResolvedValueOnce({ ...mockCitation, userId: mockUserId });

			mockCollection.doc = jest.fn().mockReturnValue({
				delete: (jest.fn() as any).mockResolvedValue(undefined),
			});

			const result = await citationRepository.deleteUserCitation(mockUserId, citationId);

			expect(result).toBe(true);
			expect(mockCollection.doc).toHaveBeenCalledWith(citationId);
		});
	});
});
