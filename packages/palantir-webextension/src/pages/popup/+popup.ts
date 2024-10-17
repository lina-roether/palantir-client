import { baseLogger } from "../../logger";
import { assertTypedElement } from "../../utils/query";

const logger = baseLogger.sub("page", "popup");

const startSessionButton = assertTypedElement("#popup__start-session-button", HTMLButtonElement);

startSessionButton.addEventListener("click", () => {
	logger.debug("Attempting to start session...");
	void browser.runtime.sendMessage({ type: "start_session" });
})
