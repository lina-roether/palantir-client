import { Session, type RoomInit, type SessionOptions, type SessionState, RoomConnectionStatus } from "palantir-client";
import { getOptions, invalidateCachedOptions } from "../options";
import { backgroundLogger } from "./logger";
import { MessageSchema, type Message } from "../messages";
import "../log_writer";
import { errorMessage, runPromise } from "../utils/error";

const logger = backgroundLogger;

logger.info("Background script started");

let session: Session | null = null;

const events = new EventTarget();

function startSession(options: SessionOptions) {
	logger.info("Starting new session");
	stopSession("Superseded by another session");
	session = new Session(options);
	session.addEventListener("error", (evt) => { sendError(evt.message); });
	session.addEventListener("update", onSessionUpdate);
	session.addEventListener("roomjoined", () => { sendInfo("Room joined"); });
	session.addEventListener("roomcreated", () => { sendInfo("Room created"); })
	session.addEventListener("roomleft", () => { sendInfo("Room left"); })
	session.addEventListener("closed", onSessionClosed);
}

function stopSession(message: string) {
	if (!session) return;
	logger.info(`Stopping current session: ${message}`);
	session.close(message);
}

function onSessionUpdate() {
	events.dispatchEvent(new Event("update"));
}

function onSessionClosed() {
	session = null;
	onSessionUpdate();
}

function sendInfo(message: string) {
	logger.info(`Session info: ${message}`);
	events.dispatchEvent(new CustomEvent("info", { detail: message }));
}

function sendError(message: string) {
	logger.error(`Session error: ${message}`);
	events.dispatchEvent(new CustomEvent("error", { detail: message }));
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
		logger.error(`Failed to ensure session`, e);
		session?.close("Client error");
		session = null;
	}
}

function getSessionState(): SessionState {
	if (!session) return { roomConnectionStatus: RoomConnectionStatus.NOT_IN_ROOM };
	return session.getState();
}

async function createRoom(init: RoomInit) {
	logger.debug(`Requesting to create room with name ${init.name}`);
	await tryEnsureSession();
	if (!session) return;

	try {
		session.createRoom(init);
	} catch (e) {
		sendError(`Failed to create room: ${errorMessage(e)}`);
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
		sendError(`Failed to join room: ${errorMessage(e)}`);
		session = null;
	}
}

const SESSION_CLOSE_TIMEOUT = 10000;

function closeSession() {
	session?.close("User left room");
	session = null;
}

function leaveRoom() {
	try {
		session?.leaveRoom();
		setTimeout(() => {
			if (!session?.isInRoom()) closeSession();
		}, SESSION_CLOSE_TIMEOUT);
	} catch (e) {
		sendError(`Failed to leave room: ${errorMessage(e)}`);
		session = null;
	}
}

function postSessionState(port: browser.runtime.Port) {
	port.postMessage({ type: "session_state", ...getSessionState() } as Message);
}

function postSessionError(port: browser.runtime.Port, message: string) {
	port.postMessage({ type: "session_error", message } as Message);
}

function postSessionInfo(port: browser.runtime.Port, message: string) {
	port.postMessage({ type: "session_info", message } as Message);
}

browser.runtime.onConnect.addListener((port) => {
	logger.debug(`Received port connection: '${port.name}'`);

	const updateListener = () => {
		postSessionState(port);
	};
	const infoListener = (evt: CustomEvent) => {
		postSessionInfo(port, evt.detail as string);
	}
	const errorListener = (evt: CustomEvent) => {
		postSessionError(port, evt.detail as string);
	};
	events.addEventListener("update", updateListener);
	events.addEventListener("info", infoListener as EventListener);
	events.addEventListener("error", errorListener as EventListener);


	port.onDisconnect.addListener(() => {
		logger.debug(`Port '${port.name}' disconnected`);
		events.removeEventListener("update", updateListener);
		events.removeEventListener("info", infoListener as EventListener);
		events.removeEventListener("error", errorListener as EventListener);
	});

	port.onMessage.addListener((rawMsg) => {
		let message;
		try {
			message = MessageSchema.parse(rawMsg);
		} catch (e) {
			logger.error(`Received invalid message from port '${port.name}'`, e);
			return;
		}
		logger.debug(`Received message from port '${port.name}': ${JSON.stringify(message)}`)
		switch (message.type) {
			case "join_room":
				runPromise(
					logger,
					joinRoom(message.id, message.password),
					"Failed to join room"
				);
				break;
			case "create_room":
				runPromise(
					logger,
					createRoom({
						name: message.name,
						password: message.password
					}),
					"Failed to create room"
				);
				break;
			case "leave_room":
				leaveRoom();
				break;
			case "get_session_state":
				postSessionState(port);
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
		logger.error(`Received invalid message`, e);
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
