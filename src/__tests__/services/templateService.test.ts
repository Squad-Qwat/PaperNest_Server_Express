import {
	describe,
	expect,
	it,
	jest,
	beforeEach,
} from "@jest/globals";
import fs from "fs/promises";
import path from "path";
import { templateService } from "../../services/templateService";

// Mock fs/promises
jest.mock("fs/promises");
const mockedFs = fs as jest.Mocked<typeof fs>;

describe("TemplateService", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("listTemplates", () => {
		it("should return a list of templates when meta.json exists", async () => {
			// Mock folders in templates directory
			mockedFs.readdir.mockResolvedValue(["template1", "template2"] as any);

			// Mock stat for meta.json
			mockedFs.stat.mockResolvedValue({ isFile: () => true } as any);

			// Mock content for meta.json
			const mockMeta = {
				name: "Test Template",
				description: "A test template",
				mainFile: "main.tex",
			};
			mockedFs.readFile.mockResolvedValue(JSON.stringify(mockMeta));

			const templates = await templateService.listTemplates();

			expect(templates).toHaveLength(2);
			expect(templates[0]).toEqual({
				id: "template1",
				...mockMeta,
			});
			expect(mockedFs.readdir).toHaveBeenCalled();
		});

		it("should skip folders without meta.json", async () => {
			mockedFs.readdir.mockResolvedValue(["template1"] as any);
			mockedFs.stat.mockRejectedValue(new Error("File not found"));

			const templates = await templateService.listTemplates();

			expect(templates).toHaveLength(0);
		});

		it("should return empty array on error", async () => {
			mockedFs.readdir.mockRejectedValue(new Error("Disk error"));

			const templates = await templateService.listTemplates();

			expect(templates).toEqual([]);
		});
	});

	describe("getTemplateContent", () => {
		it("should return file content when template exists", async () => {
			// Mock listTemplates behavior
			mockedFs.readdir.mockResolvedValue(["template1"] as any);
			mockedFs.stat.mockResolvedValue({ isFile: () => true } as any);
			mockedFs.readFile.mockResolvedValueOnce(JSON.stringify({
				name: "Test",
				mainFile: "main.tex"
			}));
			// Second call to readFile for the main file content
			mockedFs.readFile.mockResolvedValueOnce("LaTeX content");

			const content = await templateService.getTemplateContent("template1");

			expect(content).toBe("LaTeX content");
			expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
		});

		it("should throw error if template does not exist", async () => {
			mockedFs.readdir.mockResolvedValue([] as any);

			await expect(templateService.getTemplateContent("invalid")).rejects.toThrow(
				"Template with id invalid not found",
			);
		});
	});
});
