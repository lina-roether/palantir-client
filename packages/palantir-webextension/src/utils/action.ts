import { z } from "zod";
import * as msgpack from "@msgpack/msgpack";

export const ActionParamsSchema = z.object({
	action: z.literal("join"),
	server: z.string(),
	roomId: z.string()
});

export type ActionParams = z.infer<typeof ActionParamsSchema>;

export function encodeActionParams(params: ActionParams): string {
	const bytes = msgpack.encode(params);
	const binString = Array.from(bytes, String.fromCharCode).join("");
	const base64 = btoa(binString);
	return base64;
}

export function decodeActionParams(base64: string): ActionParams {
	const binString = atob(base64);
	const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
	const deserialized = msgpack.decode(bytes);
	const params = ActionParamsSchema.parse(deserialized);
	return params;
}

const ACTION_SCHEMA = "ext+palantir:";

export function createActionUrl(params: ActionParams): URL {
	return new URL(`${ACTION_SCHEMA}${encodeActionParams(params)}`);
}
