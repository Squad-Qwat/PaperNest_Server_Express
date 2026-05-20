import type { Readable } from "stream";
import { StorageService } from "../../StorageService";
import { extractPDFChunks } from "./pdf.extractor";
import ragRepository from "./rag.repository";
import { generateEmbeddingsWithFailover } from "../providers/gemini-rotator";
import documentRepository from "../../../repositories/documentRepository";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class RAGService {
	async indexPDF(documentId: string, fileKey: string): Promise<void> {
		console.log(`[RAGService] Starting vector indexing: document ${documentId}`);

		try {
			const document = await documentRepository.findById(documentId);
			if (!document) {
				throw new Error(`Document with ID ${documentId} not found`);
			}

			const workspaceId = document.workspaceId;

			const response = await StorageService.getObject(fileKey);

			if (!response.Body) {
				throw new Error("Retrieved empty body from storage");
			}

			const buffer = await this.streamToBuffer(response.Body as Readable);
			const chunks = await extractPDFChunks(buffer);

			const batchSize = 50;
			const embeddings: number[][] = [];

			for (let i = 0; i < chunks.length; i += batchSize) {
				const chunkBatch = chunks.slice(i, i + batchSize).map((c) => c.text);
				const vectors = await generateEmbeddingsWithFailover(chunkBatch);
				embeddings.push(...vectors);

				if (i + batchSize < chunks.length) {
					await delay(1500);
				}
			}

			await ragRepository.saveChunks(workspaceId, documentId, fileKey, chunks, embeddings);

			console.log(`[RAGService] Vector indexing complete: ${fileKey}`);
		} catch (error) {
			console.error(`[RAGService] Vector indexing failed for ${fileKey}:`, error);
			throw error;
		}
	}

	private async streamToBuffer(stream: Readable): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: any[] = [];
			stream.on("data", (chunk) => chunks.push(chunk));
			stream.on("error", reject);
			stream.on("end", () => resolve(Buffer.concat(chunks)));
		});
	}

	async search(documentId: string, query: string, limit: number = 5) {
		const queryEmbeddings = await generateEmbeddingsWithFailover([query]);
		return await ragRepository.searchVector(documentId, queryEmbeddings[0], limit);
	}

	async searchWorkspace(workspaceId: string, query: string, limit: number = 5) {
		const queryEmbeddings = await generateEmbeddingsWithFailover([query]);
		return await ragRepository.searchWorkspaceVector(workspaceId, queryEmbeddings[0], limit);
	}
}

export const ragService = new RAGService();
