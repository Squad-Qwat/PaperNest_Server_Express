import {
	DeleteObjectCommand,
	GetObjectCommand,
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
}
