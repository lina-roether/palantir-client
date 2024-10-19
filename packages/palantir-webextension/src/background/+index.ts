import { Session, type RoomInit, type SessionOptions, type SessionState } from "palantir-client";
import { getOptions, invalidateCachedOptions } from "../options";
import { backgroundLogger } from "./logger";
import { MessageSchema, type Message } from "../messages";
import "../log_writer";

const logger = backgroundLogger;

logger.info("Background script started");

let session: Session | null = null;

const events = new EventTarget();

function startSession(options: SessionOptions) {
	logger.info("Starting new session");
	stopSession("Superseded by another session");
	session = new Session(options);
	session.addEventListener("update", onSessionUpdate);
}

function stopSession(message: string) {
	if (!session) return;
	logger.info(`Stopping current session: ${message}`);
	session.close(message);
}

function onSessionUpdate() {
	events.dispatchEvent(new Event("update"));
}

function sendError(message: string) {
	logger.error(`Session error: ${message}`);
	events.dispatchEvent(new CustomEvent("error", {
		detail: message
	}))
}

async function startSessionFromOptions() {
	const options = await getOptions();

	if (!options.username || !options.serverUrl) {
		logger.error("Failed to start session: Options is incomplete");
		sendError("Incomplete options. Please use the extension options page to make sure you have a valid server URL and username set.");
		return;
	}

	startSession({
		username: options.username,
		url: options.serverUrl,
		apiKey: options.apiKey
	})
}

const SESSION_OPEN_TIMEOUT = 3000;

function waitForSessionOpen() {
	if (!session) return;
	if (session.open) return;
	return new Promise((res, rej) => {
		if (!session) {
			rej(new Error("Session died while waiting for it to open"));
			return;
		}
		setTimeout(() => {
			rej(new Error("Timed out waiting for session to open"));
			return;
		}, SESSION_OPEN_TIMEOUT);
		session.addEventListener("open", () => { res(undefined); });
	});
}

async function tryEnsureSession() {
	try {
		if (!session) {
			logger.info("No active session; starting...");
			await startSessionFromOptions();
		}
		if (!session?.open) {
			logger.info("Session not open, waiting...");
			await waitForSessionOpen();
		}
	} catch (e) {
		logger.error(`Failed to ensure session: ${e?.toString() ?? "unknown error"}`);
		session?.close("Client error");
		session = null;
	}
}

function getSessionState(): SessionState {
	if (!session) return { inRoom: false };
	return session.getState();
}

async function createRoom(init: RoomInit) {
	logger.debug(`Requesting to create room with name ${init.name}`);
	await tryEnsureSession();
	if (!session) return;

	try {
		session.createRoom(init);
	} catch (e) {
		sendError(`Failed to create room: ${e?.toString() ?? "unknown error"}`);
		session = null;
	}
}

async function joinRoom(id: string, password: string) {
	logger.debug(`Requesting to join room with id ${id}`);
	await tryEnsureSession();
	if (!session) return;

	try {
		session.joinRoom(id, password);
	} catch (e) {
		sendError(`Failed to join room: ${e?.toString() ?? "unknown error"}`);
		session = null;
	}
}

function leaveRoom() {
	try {
		session?.leaveRoom();
	} catch (e) {
		sendError(`Failed to leave room: ${e?.toString() ?? "unknown error"}`);
		session = null;
	}
}

function postSessionState(port: browser.runtime.Port) {
	port.postMessage({ type: "session_state", ...getSessionState() } as Message);
}

function postSessionError(port: browser.runtime.Port, message: string) {
	port.postMessage({ type: "session_error", message } as Message);

}

browser.runtime.onConnect.addListener((port) => {
	logger.debug(`Received port connection: '${port.name}'`);

	const updateListener = () => {
		postSessionState(port);
	}
	const errorListener = (evt: CustomEvent) => {
		postSessionError(port, evt.detail as string);
	};
	events.addEventListener("update", updateListener);
	events.addEventListener("error", errorListener as EventListener);


	port.onDisconnect.addListener(() => {
		logger.debug(`Port '${port.name}' disconnected`);
		events.removeEventListener("update", updateListener);
		events.removeEventListener("error", errorListener as EventListener);
	});

	port.onMessage.addListener((rawMsg) => {
		let message;
		try {
			message = MessageSchema.parse(rawMsg);
		} catch (e) {
			logger.error(`Received invalid message from port '${port.name}': ${e?.toString() ?? "Unknown error"}`);
			return;
		}
		logger.debug(`Received message from port '${port.name}': ${JSON.stringify(message)}`)
		switch (message.type) {
			case "join_room":
				void joinRoom(message.id, message.password);
				break;
			case "create_room":
				void createRoom({
					name: message.name,
					password: message.password
				});
				break;
			case "leave_room":
				leaveRoom();
				break;
			default:
				logger.warning(`Received unexpected message from port '${port.name}': ${message.type}`);
		}
	})
})

browser.runtime.onMessage.addListener((rawMsg) => {
	let message;
	try {
		message = MessageSchema.parse(rawMsg);
	} catch (e) {
		logger.error(`Received invalid message: ${e?.toString() ?? "Unknown error"}`);
		return;
	}
	logger.debug(`Received message: ${JSON.stringify(message)}`)
	switch (message.type) {
		case "options_changed":
			invalidateCachedOptions();
			break;
		default:
			logger.warning(`Recieved unexpected message: ${message.type}`);
	}
})
