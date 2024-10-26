import { baseLogger } from "../../logger";
import { getOptions } from "../../options";
import { decodeActionParams, type ActionParams } from "../../utils/action";
import { runPromise } from "../../utils/error";
import { assertElement } from "../../utils/query";
import { initStateContainer, type StateHandler } from "../../utils/state";

const logger = baseLogger.sub("pages", "action");

const enum State {
	ERROR = "error",
	JOIN_ROOM = "join_room"
}

interface ErrorProps {
	message: string
}

const initError: StateHandler<ErrorProps> = (elem, { message }) => {
	const messageElem = assertElement(logger, ".js_action__error-message", HTMLElement, elem);
	messageElem.innerText = message;
}

interface JoinRoomProps {
	roomId: string,
}

const initJoinRoom: StateHandler<JoinRoomProps> = (elem, { roomId }) => {
	// TODO
}

const stateController = initStateContainer(logger, "#action__content", {
	[State.ERROR]: {
		template: "#action__template-error",
		handler: initError
	},
	[State.JOIN_ROOM]: {
		template: "#action__template-join-room",
		handler: initJoinRoom
	}
})

function getParamString(): string {
	if (!location.hash.startsWith("#"))
		throw new Error("Missing action parameter string");
	const url = new URL(decodeURIComponent(location.hash.substring(1)));
	return url.pathname
}

function sendError(message: string) {
	logger.error(message);
	stateController.setState(State.ERROR, {
		message: `Invalid palantir URL: ${message}`
	});
}

function getActionParams(): ActionParams {
	const paramString = getParamString();
	const params = decodeActionParams(paramString);
	return params;
}

async function setInitialState() {
	const options = await getOptions();
	try {
		const params = getActionParams();
		if (params.server !== options.serverUrl) {
			throw new Error("This room is on a different server!");
		}
		stateController.setState(State.JOIN_ROOM, {
			roomId: params.roomId
		})
	} catch (err) {
		sendError(err?.toString() ?? "Unknown error");
	}
}

runPromise(logger, setInitialState(), "Failed to set initial state");
