import * as z from "zod";
import initLogWriter from "@just-log/browser";
import { Session, type SessionOptions } from "palantir-client";
import { getConfig, invalidateCachedConfig } from "./config";
import { baseLogger } from "./logger";

initLogWriter();

const logger = baseLogger.sub("background");

logger.info("Background script started");

type SessionStatus =
| { status: "active", session: Session }
| { status: "inactive" }
| { status: "error", message: string };

let sessionStatus: SessionStatus = { status: "inactive" };

function startSession(config: SessionOptions) {
	logger.info("Starting new session");
	stopSession("Superseded by another session");
	const session = new Session(config);
	sessionStatus = { status: "active", session };
}

function stopSession(message: string) {
	if (sessionStatus.status == "active") {
		logger.info(`Stopping current session: ${message}`);
		sessionStatus.session.close(message);
	}
}

async function startSessionFromConfig() {
	const config = await getConfig();

	if (!config.username || !config.serverUrl) {
		logger.error("Failed to start session: Config is incomplete");
		sessionStatus = {
			status: "error",
			message: "Incomplete configuration. Please use the extension settings and make you have a valid server URL and username set."
		};
		return;
	}

	startSession({
		username: config.username,
		url: config.serverUrl,
		apiKey: config.apiKey
	})
}


const ConfigChangedRequestSchema = z.object({
	type: z.literal("config_changed")
});

const SessionStatusRequestSchema = z.object({
	type: z.literal("session_status")
});

const StartSessionRequestSchema = z.object({
	type: z.literal("start_session"),
	reason: z.string()
});

const StopSessionRequestSchema = z.object({
	type: z.literal("stop_session"),
	reason: z.string()
});

const RequestSchema = z.union([ConfigChangedRequestSchema, StartSessionRequestSchema, SessionStatusRequestSchema, StopSessionRequestSchema]);

browser.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
	let message;
	try {
		message = RequestSchema.parse(rawMsg);
	} catch(e) {
		logger.error(`Received invalid message: ${e?.toString() ?? "Unknown error"}`);
		return;
	}
	logger.debug(`Received message: ${JSON.stringify(message)}`)
	switch (message.type) {
		case "config_changed":
			invalidateCachedConfig();
			break;
		case "start_session":
			void startSessionFromConfig();
			break;
		case "session_status":
			sendResponse(sessionStatus);
			break;
		case "stop_session":
			stopSession(message.reason)
	}
})
