import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2CommandOutput,
	PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { r2 } from "../config/r2";

export class StorageService {
	/**
	 * Fetches an object directly from R2 using the S3 client
	 * @param key The key of the object in the bucket
	 */
	static async getObject(key: string) {
		const command = new GetObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: key,
		});

		try {
			return await r2.send(command);
		} catch (error) {
			console.error("Error fetching object from R2:", error);
			throw error;
		}
	}

	/**
	 * Deletes an object from R2
	 * @param key The key of the object in the bucket
	 */
	static async deleteObject(key: string) {
		const command = new DeleteObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: key,
		});

		try {
			await r2.send(command);
			console.log(`[StorageService] Object deleted from R2: ${key}`);
		} catch (error) {
			console.error("Error deleting object from R2:", error);
			throw error;
		}
	}

	/**
	 * Deletes all files with a certain prefix from R2
	 * @param prefix The prefix to match
	 */
	static async deleteFilesByPrefix(prefix: string) {
		const { ListObjectsV2Command, DeleteObjectsCommand } = await import(
			"@aws-sdk/client-s3"
		);

		try {
			let isTruncated = true;
			let continuationToken: string | undefined;

			while (isTruncated) {
				const listCommand: any = new ListObjectsV2Command({
					Bucket: process.env.R2_BUCKET_NAME,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				});

				const listResponse = (await r2.send(
					listCommand,
				)) as ListObjectsV2CommandOutput;

				if (listResponse.Contents && listResponse.Contents.length > 0) {
					const deleteCommand = new DeleteObjectsCommand({
						Bucket: process.env.R2_BUCKET_NAME,
						Delete: {
							Objects: listResponse.Contents.map((content) => ({
								Key: content.Key,
							})),
						},
					});

					await r2.send(deleteCommand);
					console.log(
						`[StorageService] Deleted ${listResponse.Contents.length} objects with prefix: ${prefix}`,
					);
				}

				isTruncated = !!listResponse.IsTruncated;
				continuationToken = listResponse.NextContinuationToken;
			}
		} catch (error) {
			console.error("Error deleting objects by prefix from R2:", error);
			throw error;
		}
	}

	/**
	 * Generates a pre-signed URL for direct frontend uploads to R2
	 * @param filename Original filename
	 * @param contentType MIME type of the file
	 * @param folder Destination folder in bucket (e.g. 'images', 'bibFiles')
	 * @returns Pre-signed URL and the final public accessible URL
	 */
	static async generatePresignedUrl(
		filename: string,
		contentType: string,
		folder: string = "uploads",
	) {
		// Generate a unique file name to prevent collisions
		const fileExtension = filename.split(".").pop() || "";
		const uniqueFilename = `${folder}/${crypto.randomUUID()}-${Date.now()}.${fileExtension}`;

		const command = new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: uniqueFilename,
			ContentType: contentType,
		});

		try {
			// URL expires in 15 minutes
			const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

			const publicUrl = `https://${process.env.R2_PUBLIC_DOMAIN}/${uniqueFilename}`;

			return {
				presignedUrl,
				publicUrl,
				key: uniqueFilename,
			};
		} catch (error) {
			console.error("Error generating pre-signed URL:", error);
			throw new Error("Could not generate pre-signed URL");
		}
	}

	/**
	 * Uploads a buffer directly to R2
	 * @param buffer The file content as a Buffer
	 * @param key The destination key in the bucket
	 * @param contentType MIME type of the file
	 * @returns The final public URL of the uploaded object
	 */
	static async uploadBuffer(buffer: Buffer, key: string, contentType: string) {
		const command = new PutObjectCommand({
			Bucket: process.env.R2_BUCKET_NAME,
			Key: key,
			Body: buffer,
			ContentType: contentType,
		});

		try {
			await r2.send(command);
			const publicUrl = `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
			console.log(`[StorageService] Buffer uploaded to R2: ${key}`);
			return publicUrl;
		} catch (error) {
			console.error("Error uploading buffer to R2:", error);
			throw error;
		}
	}
}
