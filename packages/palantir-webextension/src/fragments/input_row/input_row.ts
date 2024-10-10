import { assertTypedElement, initComponent } from "../../utils";

function init(elem: HTMLElement) {
	const input = elem.querySelector("input");
	if (input) {
		const error = assertTypedElement(".js_palantir-input-row__error", HTMLElement, elem);
		error.innerText = input.validationMessage;
		input.addEventListener("input", () => {
			error.innerText = input.validationMessage;
		});
	}
}

initComponent(".js_palantir-input-row", HTMLElement, init);
