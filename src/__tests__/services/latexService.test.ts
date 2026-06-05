import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { LatexService } from "../../services/latexService";

jest.mock("child_process");
jest.mock("fs/promises");
jest.mock("../../config/firebase", () => ({
	db: {},
}));

describe("LatexService", () => {
	let latexService: LatexService;

	beforeEach(() => {
		jest.clearAllMocks();
		latexService = new LatexService();
		process.env.USE_DOCKER_SANDBOX = "false";
		process.env.LATEX_COMPILE_TIMEOUT = "2000";
	});

	describe("Security Validation", () => {
		it("should block compilation locally if malicious commands are present", async () => {
			const result = await latexService.compile({
				content: "Hello \\write18{malicious command} World",
			});

			expect(result.pdf).toBeUndefined();
			expect(result.log).toContain("Security Error");
			expect(result.status).toBe(-1);
		});

		it("should allow compilation locally if content is safe", async () => {
			jest.mocked(fs.mkdir).mockResolvedValue(undefined);
			jest.mocked(fs.writeFile).mockResolvedValue(undefined);
			jest.mocked(fs.readFile).mockResolvedValue(Buffer.from("mock pdf"));
			jest.mocked(fs.rm).mockResolvedValue(undefined);

			const mockProcess = {
				stdout: {
					on: jest.fn((event: string, cb: any) => {
						if (event === "data") cb(Buffer.from("compiled"));
					}),
				},
				stderr: { on: jest.fn() },
				on: jest.fn((event: string, cb: any) => {
					if (event === "close") cb(0);
				}),
				kill: jest.fn(),
			};
			jest.mocked(spawn).mockReturnValue(mockProcess as any);

			const result = await latexService.compile({
				content: "Hello World",
			});

			expect(result.pdf).toBeDefined();
			expect(result.status).toBe(0);
		});
	});

	describe("Docker Sandboxing", () => {
		it("should invoke docker run when USE_DOCKER_SANDBOX is enabled", async () => {
			process.env.USE_DOCKER_SANDBOX = "true";

			jest.mocked(fs.mkdir).mockResolvedValue(undefined);
			jest.mocked(fs.writeFile).mockResolvedValue(undefined);
			jest.mocked(fs.readFile).mockResolvedValue(Buffer.from("mock pdf"));
			jest.mocked(fs.rm).mockResolvedValue(undefined);

			const mockProcess = {
				stdout: { on: jest.fn() },
				stderr: { on: jest.fn() },
				on: jest.fn((event: string, cb: any) => {
					if (event === "close") cb(0);
				}),
				kill: jest.fn(),
			};
			jest.mocked(spawn).mockReturnValue(mockProcess as any);

			await latexService.compile({
				content: "Hello \\write18{inside docker is ok} World",
				engine: "pdflatex",
			});

			expect(spawn).toHaveBeenCalledWith(
				"docker",
				expect.arrayContaining(["run", "--rm", "--network", "none", "-v"]),
				expect.any(Object),
			);
		});
	});
});
