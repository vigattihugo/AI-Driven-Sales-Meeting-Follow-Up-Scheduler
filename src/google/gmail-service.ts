import { gmail_v1, google } from "googleapis";
import { config } from "../config.js";
import { createGoogleAuth } from "./auth.js";

export class GmailService {
  private readonly api: gmail_v1.Gmail;

  constructor() {
    this.api = google.gmail({ version: "v1", auth: createGoogleAuth() });
  }

  async hasConversationSince(email: string, since: Date): Promise<boolean> {
    const after = Math.floor(since.getTime() / 1000);
    const response = await this.api.users.threads.list({
      userId: config.GOOGLE_USER_EMAIL,
      maxResults: 1,
      q: `(from:${email} OR to:${email}) after:${after}`
    });

    return Boolean(response.data.threads?.length);
  }

  async sendApprovalEmail(input: {
    to: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const raw = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      input.message
    ].join("\n");

    await this.api.users.messages.send({
      userId: config.GOOGLE_USER_EMAIL,
      requestBody: {
        raw: Buffer.from(raw).toString("base64url")
      }
    });
  }
}
