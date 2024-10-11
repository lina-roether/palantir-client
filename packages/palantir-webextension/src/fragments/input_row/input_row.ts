import { assertTypedElement, initComponent } from "../../utils";

function init(elem: HTMLElement) {
	const input = elem.querySelector("input");
	if (input) {
		const error = assertTypedElement(".js_palantir-input-row__error", HTMLElement, elem);
		
		updateErrorMessage();
		
		function updateErrorMessage() {
			error.innerText = input.validationMessage;
		}

		input.addEventListener("change", () => {
			setTimeout(() => { updateErrorMessage() });
		});

		input.addEventListener("input", () => {
			setTimeout(() => { updateErrorMessage() });
		});
	}
}

initComponent(".js_palantir-input-row", HTMLElement, init);
