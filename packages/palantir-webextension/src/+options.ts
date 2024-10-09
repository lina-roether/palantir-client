import log from "log";
import { getConfig, setConfig } from "./config";
import { assertTypedElement } from "./utils";

const form = assertTypedElement("#options_form", HTMLFormElement);
const cancelButton = assertTypedElement("#cancel", HTMLButtonElement);
const serverUrlInput = assertTypedElement("#server_url", HTMLInputElement);

function reset() {
	getConfig().then((config) => {
		serverUrlInput.value = config.serverUrl ?? "";
	}).catch((err: unknown) => { log.error(err); });
}

form.addEventListener("submit", (evt) => {
	evt.preventDefault();
	const data = new FormData(form);

	const formEntry = data.get("server_url");
	if (typeof formEntry != "string") {
		log.error(`Got unexpected server_url type %s`, typeof formEntry);
		return;
	}
	const serverUrl = formEntry || "";
	setConfig({ serverUrl }).catch((err: unknown) => { log.error(`Failed to set config: %s`, err); });
})

cancelButton.addEventListener("click", () => {
	reset();
});

reset();
