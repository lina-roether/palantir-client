export function errorMessage(error: unknown): string {
	return error?.toString() ?? "Unknown error";
}
