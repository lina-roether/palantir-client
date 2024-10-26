import { getOptions } from "../../options";
import { baseLogger } from "../../logger";
import { initStateContainer, type StateHandler, } from "../../utils/state";
import { MessageSchema, type Message } from "../../messages";
import { assertElement } from "../../utils/query";
import { runPromise } from "../../utils/error";
import { FormMode, initForm } from "../../utils/form";
import { RoomConnectionStatus, type SessionState } from "palantir-client";
import { snackbar } from "../../fragments/components";

const logger = baseLogger.sub("page", "popup");

const enum State {
	LOADING = "loading",
	INCOMPLETE_OPTIONS = "incomplete_options",
	CREATE_ROOM = "start_session",
	IN_ROOM = "in_room",
}

function initOpenOptionsButton(button: HTMLButtonElement) {
	button.addEventListener("click", () => {
		logger.info("Opening options page...");
		runPromise(logger, browser.runtime.openOptionsPage(), "Failed to open options page");
		window.close();
	});
}

const port = browser.runtime.connect({ name: "popup" });

port.onMessage.addListener((obj) => {
	const message = MessageSchema.parse(obj);
	switch (message.type) {
		case "session_state":
			onSessionStateUpdate(message);
			break;
		case "session_info":
			onSessionInfo(message.message);
			break;
		case "session_error":
			onSessionError(message.message);
	}
});
port.postMessage({ type: "get_session_state" } satisfies Message);


function onSessionInfo(message: string) {
	snackbar.queueSnackbar({
		type: snackbar.SnackbarType.INFO,
		message
	});
}

function onSessionError(message: string) {
	snackbar.queueSnackbar({
		type: snackbar.SnackbarType.ERROR,
		message
	});
}

function onSessionStateUpdate(state: SessionState) {
	logger.debug(`Received session state update: ${JSON.stringify(state)}`);
	switch (state.roomConnectionStatus) {
		case RoomConnectionStatus.NOT_IN_ROOM:
			stateController.setState(State.CREATE_ROOM);
			break;
		case RoomConnectionStatus.IN_ROOM:
			stateController.setState(State.IN_ROOM, state);
			break;
		case RoomConnectionStatus.JOINING:
		case RoomConnectionStatus.LEAVING:
			stateController.setState(State.LOADING);
	}
}

const initInRoom: StateHandler<SessionState> = (elem, sessionState) => {
	const roomInfo = assertElement(logger, ".js_popup__room-info", HTMLElement, elem);
	const roomInfoPre = document.createElement("pre");
	roomInfoPre.innerText = JSON.stringify(sessionState, null, 3);
	roomInfo.appendChild(roomInfoPre);

	const leaveRoomButton = assertElement(logger, ".js_popup__leave-room", HTMLButtonElement, elem);
	leaveRoomButton.addEventListener("click", () => {
		port.postMessage({ type: "leave_room" } satisfies Message);
		stateController.setState(State.LOADING);
	});
}

const initStartSession: StateHandler = async (elem) => {
	const openOptionsButton = assertElement(logger, ".js_popup__open-options", HTMLButtonElement, elem);
	const serverUrlElem = assertElement(logger, ".js_popup__server-url", HTMLElement, elem);
	const usernameElem = assertElement(logger, ".js_popup__username", HTMLElement, elem);

	initOpenOptionsButton(openOptionsButton);

	initForm(logger, {
		query: "#popup__start-session-form",
		mode: FormMode.SUBMIT,
		fields: {
			roomName: {
				value: "",
				validate: (value) => {
					if (!value) return "Please enter a room name";
					if (typeof value !== "string") return "Only text values are allowed";
					return "";
				}
			},
			roomPassword: {
				value: "",
				validate: (value) => {
					if (!value) return "Please enter a room password";
					if (typeof value !== "string") return "Only text values are allowed";
					if (value.length < 5) return "Password must be at least 5 characters";
					return "";
				}
			}
		},
		onSubmit(data) {
			const roomName = data.get("roomName");
			const roomPassword = data.get("roomPassword");

			if (typeof roomName !== "string" || typeof roomPassword !== "string") return;

			port.postMessage({
				type: "create_room",
				name: roomName,
				password: roomPassword
			} satisfies Message);
			stateController.setState(State.LOADING);
		}
	})

	const options = await getOptions();
	serverUrlElem.innerText = options.serverUrl ?? "<no url set>";
	usernameElem.innerText = options.username ?? "<no username set>";
}

const initIncompleteOptions: StateHandler = (elem) => {
	const openOptionsButton = assertElement(logger, ".js_popup__open-options", HTMLButtonElement, elem);
	initOpenOptionsButton(openOptionsButton);
}

const stateController = initStateContainer(logger, "#popup__content", {
	[State.LOADING]: {
		template: "#popup__template-loading",
	},
	[State.INCOMPLETE_OPTIONS]: {
		template: "#popup__template-options-incomplete",
		handler: initIncompleteOptions,
	},
	[State.CREATE_ROOM]: {
		template: "#popup__template-create-room",
		handler: initStartSession
	},
	[State.IN_ROOM]: {
		template: "#popup__template-in-room",
		handler: initInRoom
	}
});

async function setInitialState() {
	const options = await getOptions();
	if (!options.username || !options.username) {
		stateController.setState(State.INCOMPLETE_OPTIONS);
	} else {
		stateController.setState(State.CREATE_ROOM)
	}
}

runPromise(logger, setInitialState(), "Failed to set initial state");

