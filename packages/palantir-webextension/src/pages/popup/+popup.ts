import { getConfig } from "../../config";
import { baseLogger } from "../../logger";
import { initComponent } from "../../utils/component";
import { initStateContainer } from "../../utils/state";

const logger = baseLogger.sub("page", "popup");

const enum State {
	INCOMPLETE_CONFIG,
	START_SESSION
}

const stateController = initStateContainer("#popup__content", {
	[State.INCOMPLETE_CONFIG]: "#popup__template-options-incomplete",
	[State.START_SESSION]: "#popup__template-start-session"
});

async function setInitialState() {
	const config = await getConfig();
	if (!config.username || !config.username) {
		stateController.setState(State.INCOMPLETE_CONFIG);
	} else {
		stateController.setState(State.START_SESSION)
	}
}

void setInitialState();


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
		void browser.runtime.sendMessage({ type: "start_session" });
	});
});
