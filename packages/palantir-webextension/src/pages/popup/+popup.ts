import { baseLogger } from "../../logger";
import { initComponent } from "../../utils/component";
import { assertTypedElement } from "../../utils/query";

const logger = baseLogger.sub("page", "popup");

const content = assertTypedElement("#popup__content", HTMLElement);
const incompleteConfigTemplate = assertTypedElement("#popup__template-options-incomplete", HTMLTemplateElement);
const startSessionTemplate = assertTypedElement("#popup__template-start-session", HTMLTemplateElement);

const enum State {
	INCOMPLETE_CONFIG,
	START_SESSION
}

function setState(state: State) {
	let template;
	switch (state) {
		case State.INCOMPLETE_CONFIG:
			template = incompleteConfigTemplate;
			break;
		case State.START_SESSION:
			template = startSessionTemplate;
	}
	content.innerHTML = "";
	content.append(template.content.cloneNode(true));
}


initComponent(".js_popup-open-options", HTMLButtonElement, (button) => {
	button.addEventListener("click", () => {
		void browser.runtime.openOptionsPage();
	});
});

initComponent(".js_popup-start-session", HTMLButtonElement, (button) => {
	button.addEventListener("click", () => {
		logger.debug("Attempting to start session...");
		void browser.runtime.sendMessage({ type: "start_session" });
	});
});
