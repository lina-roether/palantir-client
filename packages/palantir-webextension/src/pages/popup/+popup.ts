import { getOptions } from "../../options";
import { baseLogger } from "../../logger";
import { initStateContainer } from "../../utils/state";
import type { Message } from "../../messages";
import { assertElement } from "../../utils/query";
import { runPromise } from "../../utils/error";
import { FormMode, initForm } from "../../utils/form";

const logger = baseLogger.sub("page", "popup");

const enum State {
	INCOMPLETE_OPTIONS = "incomplete_options",
	START_SESSION = "start_session"
}

function initOpenOptionsButton(button: HTMLButtonElement) {
	button.addEventListener("click", () => {
		logger.info("Opening options page...");
		runPromise(logger, browser.runtime.openOptionsPage(), "Failed to open options page");
		window.close();
	});
}

const port = browser.runtime.connect({ name: "popup" });

async function initStartSession(elem: HTMLElement) {
	const openOptionsButton = assertElement(logger, ".js_popup__open-options", HTMLButtonElement, elem);
	const startSessionButton = assertElement(logger, ".js_popup__start-session", HTMLButtonElement, elem);
	const serverUrlElem = assertElement(logger, ".js_popup__server-url", HTMLElement);
	const usernameElem = assertElement(logger, ".js_popup__username", HTMLElement);

	initOpenOptionsButton(openOptionsButton);
	startSessionButton.addEventListener("click", () => {
		logger.debug("Attempting to start session...");
		port.postMessage({ type: "create_room", name: "Test Room", password: "123" } as Message);
	});

	initForm(logger, {
		query: "#popup__start-session-form",
		mode: FormMode.SUBMIT,
		fields: {
			roomName: {
				value: "",
				validate: (value) => {
					if (!value) return "Please enter a room name";
					return "";
				}
			}
		}
	})

	const options = await getOptions();
	serverUrlElem.innerText = options.serverUrl ?? "<no url set>";
	usernameElem.innerText = options.username ?? "<no username set>";
}

function initIncompleteOptions(elem: HTMLElement) {
	const openOptionsButton = assertElement(logger, ".js_popup__open-options", HTMLButtonElement, elem);
	initOpenOptionsButton(openOptionsButton);
}


const stateController = initStateContainer(logger, "#popup__content", {
	[State.INCOMPLETE_OPTIONS]: {
		template: "#popup__template-options-incomplete",
		handler: initIncompleteOptions,
	},
	[State.START_SESSION]: {
		template: "#popup__template-start-session",
		handler: (elem) => { runPromise(logger, initStartSession(elem), "Failed to initialize page"); },
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

runPromise(logger, setInitialState(), "Failed to set initial state");

