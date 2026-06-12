import "dotenv/config";
import { z } from "zod";
const envSchema = z.object({
    PORT: z.coerce.number().default(3333),
    PUBLIC_BASE_URL: z.string().url().default("http://localhost:3333"),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GOOGLE_REFRESH_TOKEN: z.string().min(1),
    GOOGLE_CALENDAR_ID: z.string().default("primary"),
    GOOGLE_USER_EMAIL: z.string().default("me"),
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    APPROVAL_RECIPIENT_EMAIL: z.string().email(),
    TIMEZONE: z.string().default("America/Sao_Paulo"),
    DAILY_CRON: z.string().default("0 6 * * *"),
    LOOKBACK_START_DAYS: z.coerce.number().int().positive().default(4),
    LOOKBACK_END_DAYS: z.coerce.number().int().positive().default(2)
});
export const config = envSchema.parse(process.env);
