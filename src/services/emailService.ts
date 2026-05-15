import { resend } from "../config/resend";
import logger from "../utils/logger";

export class EmailService {
	static async sendOTPEmail(to: string, name: string, otp: string): Promise<void> {
		try {
			const { error } = await resend.emails.send({
				from: "PaperNest <noreply@papernest.abiyyufahri.my.id>",
				to,
				subject: "Verify your email - PaperNest",
				html: `
					<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff; color: #111827; margin: 0; padding: 40px 20px;">
						<div style="max-width: 480px; margin: 0 auto;">
							<div style="margin-bottom: 32px;">
								<h1 style="font-size: 24px; font-weight: 700; color: #009689; margin: 0; letter-spacing: -0.02em;">PaperNest</h1>
							</div>
							
							<div style="margin-bottom: 32px;">
								<h2 style="font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #111827;">Verify your email</h2>
								<p style="font-size: 15px; line-height: 24px; color: #4b5563; margin: 0;">
									Hi ${name},<br />
									Please use the following verification code to complete your registration.
								</p>
							</div>

							<div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
								<div style="font-size: 36px; font-weight: 700; letter-spacing: 0.25em; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">${otp}</div>
							</div>

							<div style="margin-bottom: 32px;">
								<p style="font-size: 13px; line-height: 20px; color: #6b7280; margin: 0;">
									This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.
								</p>
							</div>

							<div style="border-top: 1px solid #f3f4f6; padding-top: 24px; text-align: left;">
								<p style="font-size: 12px; color: #9ca3af; margin: 0;">
									&copy; ${new Date().getFullYear()} PaperNest. All rights reserved.
								</p>
							</div>
						</div>
					</div>
				`,
			});

			if (error) {
				logger.error("Resend API error", { error });
				throw new Error(error.message);
			}
		} catch (error: any) {
			logger.error("Failed to send OTP email", { error: error.message });
			throw new Error("Failed to send verification email: " + error.message);
		}
	}
}
