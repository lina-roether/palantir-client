import { getOptions } from "../../options";
import { baseLogger } from "../../logger";
import { initStateContainer } from "../../utils/state";
import type { Message } from "../../messages";
import { assertTypedElement } from "../../utils/query";

const logger = baseLogger.sub("page", "popup");

const enum State {
	INCOMPLETE_OPTIONS = "incomplete_options",
	START_SESSION = "start_session"
}

function initOpenOptionsButton(button: HTMLButtonElement) {
	button.addEventListener("click", () => {
		logger.info("Opening options page...");
		void browser.runtime.openOptionsPage();
		window.close();
	});
}

const port = browser.runtime.connect({ name: "popup" });

async function initStartSession(elem: HTMLElement) {
	const openOptionsButton = assertTypedElement(".js_popup__open-options", HTMLButtonElement, elem);
	const startSessionButton = assertTypedElement(".js_popup__start-session", HTMLButtonElement, elem);
	const serverUrlElem = assertTypedElement(".js_popup__server-url", HTMLElement);
	const usernameElem = assertTypedElement(".js_popup__username", HTMLElement);

	initOpenOptionsButton(openOptionsButton);
	startSessionButton.addEventListener("click", () => {
		logger.debug("Attempting to start session...");
		port.postMessage({ type: "create_room", name: "Test Room", password: "123" } as Message);
	});

	const options = await getOptions();
	serverUrlElem.innerText = options.serverUrl ?? "<no url set>";
	usernameElem.innerText = options.username ?? "<no username set>";
}

function initIncompleteOptions(elem: HTMLElement) {
	const openOptionsButton = assertTypedElement(".js_popup__open-options", HTMLButtonElement, elem);
	initOpenOptionsButton(openOptionsButton);
}


const stateController = initStateContainer(logger, "#popup__content", {
	[State.INCOMPLETE_OPTIONS]: {
		template: "#popup__template-options-incomplete",
		handler: initIncompleteOptions,
	},
	[State.START_SESSION]: {
		template: "#popup__template-start-session",
		handler: () => void initStartSession,
	}
});

async function setInitialState() {
	const options = await getOptions();
	if (!options.username || !options.username) {
		stateController.setState(State.INCOMPLETE_OPTIONS);
	} else {
		stateController.setState(State.START_SESSION)
	}
}

void setInitialState();

