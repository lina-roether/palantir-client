import type { Logger } from "@just-log/core";

export function errorMessage(error: unknown): string {
	return error?.toString() ?? "Unknown error";
}

export function runPromise(logger: Logger, promise: Promise<unknown>, errorMessage: string): void {
	promise.catch((err: unknown) => { logger.error(errorMessage, err); });
}
