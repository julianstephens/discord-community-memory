import { z } from "zod";

export const ApiErrorResponseSchema = z.object({
  status_code: z.number().min(100, "Status code is required"),
  success: z.literal(false),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const ApiResponseSchema = z.object({
  message: z.string().optional(),
  data: z.any(),
});
export type ApiResponse = z.infer<typeof ApiResponseSchema>;
