import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  BOT_TOKEN: z.string(),
  CLIENT_ID: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(_env.error.issues, null, 2));
  process.exit(1);
}

export const env = _env.data;
