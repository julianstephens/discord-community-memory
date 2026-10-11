import type { ApiErrorResponse } from "schemas";

export const toStandardErrorResponse = (
  status_code: number,
  message: string,
  details?: Record<string, unknown>,
): ApiErrorResponse => {
  const response: ApiErrorResponse = {
    status_code,
    success: false,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
};

export const toRequestErrorResponse = (
  status_code: number,
  message: string,
  req: { method: string; url: string },
  details?: Record<string, unknown>,
): ApiErrorResponse =>
  toStandardErrorResponse(status_code, message, {
    ...details,
    method: req.method,
    url: req.url,
  });
