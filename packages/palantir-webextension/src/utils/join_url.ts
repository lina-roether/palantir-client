export interface JoinUrlData {
	server: URL,
	roomId: string
}

const URL_SCHEMA = "ext+palantir:";

export function createJoinUrl(data: JoinUrlData): URL {
	return new URL(`${URL_SCHEMA}${data.server.origin}#${encodeURIComponent(data.roomId)}`);
}

export function decodeJoinUrl(url: URL): JoinUrlData {
	if (url.protocol != URL_SCHEMA) {
		throw new Error("Not a valid palantir join URL");
	}
	if (url.hash.length <= 1) {
		throw new Error("Missing room ID in join URL");
	}
	const server = new URL(url.pathname);
	const roomId = url.hash.substring(1);
	return { server, roomId }
}
