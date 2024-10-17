import * as z from "zod";
import initLogWriter from "@just-log/browser";
import { Session, type SessionOptions } from "palantir-client";
import { getOptions, invalidateCachedOptions } from "../options";
import { backgroundLogger } from "./logger";

initLogWriter();

const logger = backgroundLogger;

logger.info("Background script started");

type SessionStatus =
	| { status: "active", session: Session }
	| { status: "inactive" }
	| { status: "error", message: string };

let sessionStatus: SessionStatus = { status: "inactive" };

function startSession(options: SessionOptions) {
	logger.info("Starting new session");
	stopSession("Superseded by another session");
	const session = new Session(options);
	sessionStatus = { status: "active", session };
}

function stopSession(message: string) {
	if (sessionStatus.status == "active") {
		logger.info(`Stopping current session: ${message}`);
		sessionStatus.session.close(message);
	}
}

async function startSessionFromOptions() {
	const options = await getOptions();

	if (!options.username || !options.serverUrl) {
		logger.error("Failed to start session: Options is incomplete");
		sessionStatus = {
			status: "error",
			message: "Incomplete options. Please use the extension options page to make sure you have a valid server URL and username set."
		};
		return;
	}

	startSession({
		username: options.username,
		url: options.serverUrl,
		apiKey: options.apiKey
	})
}


const OptionsChangedRequestSchema = z.object({
	type: z.literal("options_changed")
});

const SessionStatusRequestSchema = z.object({
	type: z.literal("session_status")
});

const StartSessionRequestSchema = z.object({
	type: z.literal("start_session")
});

const StopSessionRequestSchema = z.object({
	type: z.literal("stop_session"),
	reason: z.string()
});

const RequestSchema = z.union([OptionsChangedRequestSchema, StartSessionRequestSchema, SessionStatusRequestSchema, StopSessionRequestSchema]);

browser.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
	let message;
	try {
		message = RequestSchema.parse(rawMsg);
	} catch (e) {
		logger.error(`Received invalid message: ${e?.toString() ?? "Unknown error"}`);
		return;
	}
	logger.debug(`Received message: ${JSON.stringify(message)}`)
	switch (message.type) {
		case "options_changed":
			invalidateCachedOptions();
			break;
		case "start_session":
			void startSessionFromOptions();
			break;
		case "session_status":
			sendResponse(sessionStatus);
			break;
		case "stop_session":
			stopSession(message.reason)
	}
})
