import * as z from "zod";
import { Session, type SessionOptions } from "palantir-client";
import { getConfig } from "./config";

type SessionStatus =
| { status: "active", session: Session }
| { status: "inactive" }
| { status: "error", message: string };

let sessionStatus: SessionStatus = { status: "inactive" };

function startSession(config: SessionOptions) {
	stopSession();
	const session = new Session(config);
	sessionStatus = { status: "active", session };
}

function stopSession() {
	if (sessionStatus.status == "active") sessionStatus.session.close("Superseded by another session");
}

async function startSessionFromConfig() {
	const config = await getConfig();

	if (!config.username || !config.serverUrl) {
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

browser.runtime.onStartup.addListener(() => {
	void startSessionFromConfig()
});


const ConfigChangedRequestSchema = z.object({
	type: z.literal("config_changed")
});

const SessionStatusRequestSchema = z.object({
	type: z.literal("session_status")
});

const StopSessionRequestSchema = z.object({
	type: z.literal("stop_session")
});

const RequestSchema = z.union([ConfigChangedRequestSchema, SessionStatusRequestSchema, StopSessionRequestSchema]);

browser.runtime.onMessage.addListener((rawMsg, _sender, sendResponse) => {
	const message = RequestSchema.parse(rawMsg);
	switch (message.type) {
		case "config_changed":
			void startSessionFromConfig()
			break;
		case "session_status":
			sendResponse(sessionStatus);
			break;
		case "stop_session":
			stopSession()
	}
})
