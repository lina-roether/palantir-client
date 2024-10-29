import type { Logger } from "@just-log/core";

export function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return JSON.stringify(error);
}

export function runPromise(logger: Logger, promise: Promise<unknown>, errorMessage: string): void {
	promise.catch((err: unknown) => { logger.error(errorMessage, err); });
}
