import { baseLogger } from "../../logger";
import { getOptions } from "../../options";
import { runPromise } from "../../utils/error";
import { decodeJoinUrl, type JoinUrlData } from "../../utils/join_url";
import { assertElement } from "../../utils/query";
import { initStateContainer, type StateHandler } from "../../utils/state";

const logger = baseLogger.sub("pages", "join");

const enum State {
	ERROR = "error",
	JOIN_ROOM = "join_room"
}

interface ErrorProps {
	message: string
}

const initError: StateHandler<ErrorProps> = (elem, { message }) => {
	const messageElem = assertElement(logger, ".js_join__error-message", HTMLElement, elem);
	messageElem.innerText = message;
}

interface JoinRoomProps {
	roomId: string,
}

const initJoinRoom: StateHandler<JoinRoomProps> = (elem, { roomId }) => {
	// TODO
}

const stateController = initStateContainer(logger, "#join__content", {
	[State.ERROR]: {
		template: "#join__template-error",
		handler: initError
	},
	[State.JOIN_ROOM]: {
		template: "#join__template-join-room",
		handler: initJoinRoom
	}
})

function getUrl(): URL {
	if (!location.hash.startsWith("#"))
		throw new Error("Missing join parameter string");
	return new URL(decodeURIComponent(location.hash.substring(1)));
}

function sendError(message: string) {
	logger.error(message);
	stateController.setState(State.ERROR, {
		message: `Invalid palantir URL: ${message}`
	});
}

function getJoinData(): JoinUrlData {
	const url = getUrl();
	const data = decodeJoinUrl(url);
	return data;
}

async function setInitialState() {
	const options = await getOptions();
	try {
		const data = getJoinData();
		logger.debug(`Join data: ${JSON.stringify(data)}`)
		if (data.server.toString() !== options.serverUrl) {
			throw new Error("This room is on a different server!");
		}
		stateController.setState(State.JOIN_ROOM, {
			roomId: data.roomId
		})
	} catch (err) {
		sendError(err?.toString() ?? "Unknown error");
	}
}

runPromise(logger, setInitialState(), "Failed to set initial state");
