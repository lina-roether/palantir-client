import { getOptions } from "../../options";
import { baseLogger } from "../../logger";
import { initComponent } from "../../utils/component";
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

function initStartSession(elem: HTMLElement) {
	const openOptionsButton = assertTypedElement(".js_popup__open-options", HTMLButtonElement, elem);
	const startSessionButton = assertTypedElement(".js_popup__start-session", HTMLButtonElement, elem);
	initOpenOptionsButton(openOptionsButton);
	startSessionButton.addEventListener("click", () => {
		logger.debug("Attempting to start session...");
		port.postMessage({ type: "create_room", name: "Test Room", password: "123" } as Message);
	});
}

function initIncompleteOptions(elem: HTMLElement) {
	const openOptionsButton = assertTypedElement(".js_popup__open-options", HTMLButtonElement, elem);
	initOpenOptionsButton(openOptionsButton);
}


const stateController = initStateContainer("#popup__content", {
	[State.INCOMPLETE_OPTIONS]: {
		template: "#popup__template-options-incomplete",
		handler: initIncompleteOptions,
	},
	[State.START_SESSION]: {
		template: "#popup__template-start-session",
		handler: initStartSession,
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

