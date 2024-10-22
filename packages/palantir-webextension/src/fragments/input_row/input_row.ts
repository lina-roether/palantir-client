import { baseLogger } from "../../logger";
import { initComponent } from "../../utils/component";
import { assertTypedElement } from "../../utils/query";

const logger = baseLogger.sub("components", "row");

function init(elem: HTMLElement) {
	const input = elem.querySelector("input");
	if (input) {
		const error = assertTypedElement(".js_palantir-input-row__error", HTMLElement, elem);

		updateErrorMessage();

		function updateErrorMessage() {
			// queueing a microtask solves many issues here; we don't want this code to fire
			// before the code that owns the input has had a chance to update its state
			setTimeout(() => error.innerText = input?.validationMessage ?? "");
		}

		input.addEventListener("change", () => {
			updateErrorMessage();
		});

		input.addEventListener("input", () => {
			updateErrorMessage();
		});

		input.addEventListener("invalid", () => {
			updateErrorMessage();
		});
	}
}

initComponent(logger, ".js_palantir-input-row", HTMLElement, init);
