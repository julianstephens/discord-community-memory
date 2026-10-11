import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default("3000")
    .transform((val) => parseInt(val, 10)),
  SESSION_SECRET: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:");
  console.error(JSON.stringify(_env.error.issues, null, 2));
  process.exit(1);
}

export const env = _env.data;
