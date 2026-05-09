export interface ApiErrorBody {
	error: {
		code: string;
		message: string;
	};
}

/**
 * constructor(public readonly status: number)

is equivalent to:

public readonly status: number;
constructor(status: number) {
	this.status = status;
}
 */
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function jsonError(
	status: number,
	code: string,
	message: string,
): Response {
	return Response.json(
		{
			error: {
				code,
				message,
			},
		} satisfies ApiErrorBody,
		{ status },
	);
}

export async function readJsonObject(
	request: Request,
): Promise<Record<string, unknown>> {
	const text = await request.text();

	if (!text.trim()) {
		return {};
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(text);
	} catch {
		throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON.");
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			"Request body must be a JSON object.",
		);
	}

	return parsed as Record<string, unknown>;
}

export function handleApiError(error: unknown): Response {
	if (error instanceof ApiError) {
		return jsonError(error.status, error.code, error.message);
	}

	console.error(error);
	return jsonError(500, "INTERNAL_SERVER_ERROR", "Something went wrong.");
}
