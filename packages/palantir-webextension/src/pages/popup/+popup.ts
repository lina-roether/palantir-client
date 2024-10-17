import { getOptions } from "../../options";
import { baseLogger } from "../../logger";
import { initComponent } from "../../utils/component";
import { initStateContainer } from "../../utils/state";
import type { Message } from "../../messages";

const logger = baseLogger.sub("page", "popup");

const enum State {
	INCOMPLETE_OPTIONS,
	START_SESSION
}

const stateController = initStateContainer("#popup__content", {
	[State.INCOMPLETE_OPTIONS]: "#popup__template-options-incomplete",
	[State.START_SESSION]: "#popup__template-start-session"
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

const port = browser.runtime.connect({ name: "popup" });

initComponent(".js_popup__open-options", HTMLButtonElement, (button) => {
	button.addEventListener("click", () => {
		logger.info("Opening options page...");
		void browser.runtime.openOptionsPage();
		window.close();
	});
});

initComponent(".js_popup__start-session", HTMLButtonElement, (button) => {
	button.addEventListener("click", () => {
		logger.debug("Attempting to start session...");
		port.postMessage({ type: "create_room", name: "Test Room", password: "123" } as Message);
	});
});
