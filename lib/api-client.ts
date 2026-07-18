import axios, { isAxiosError, isCancel } from "axios";

export const API_REQUEST_TIMEOUT_MS = 1000 * 60 * 60; // 1 hour

export const apiClient = axios.create({
	timeout: API_REQUEST_TIMEOUT_MS,
});

interface ApiErrorResponseBody {
	error?: {
		message?: unknown;
	};
}

interface ApiClientErrorOptions {
	timeoutMessage?: string;
}

export function getApiClientErrorMessage(
	error: unknown,
	options: ApiClientErrorOptions = {},
): string | null {
	if (isAxiosError(error)) {
		if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
			return options.timeoutMessage ?? "Request timed out.";
		}

		const responseMessage = getApiErrorMessage(error.response?.data);
		return responseMessage ?? error.message;
	}

	return error instanceof Error ? error.message : null;
}

export function isApiClientRequestCanceled(error: unknown): boolean {
	return (
		isCancel(error) ||
		(isAxiosError(error) && error.code === "ERR_CANCELED")
	);
}

export function getApiErrorMessage(value: unknown): string | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}

	const message = (value as ApiErrorResponseBody).error?.message;
	return typeof message === "string" ? message : null;
}
