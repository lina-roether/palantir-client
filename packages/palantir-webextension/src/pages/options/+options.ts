import log from "log";
import { getConfig, setConfig } from "../../config";
import { assertTypedElement } from "../../utils";

const form = assertTypedElement("#options_form", HTMLFormElement);
const submitButton = assertTypedElement("#options_submit", HTMLButtonElement);
const cancelButton = assertTypedElement("#options_cancel", HTMLButtonElement);
const serverUrlInput = assertTypedElement("#options_server-url", HTMLInputElement);
const useApiKeyInput = assertTypedElement("#options_use-api-key", HTMLInputElement);
const apiKeyInput = assertTypedElement("#options_api-key", HTMLInputElement);

updateFormState();

function updateFormState() {
	updateApiKeyInput();
	validateServerUrl();
	checkCanSave();
}

function checkCanSave() {
	const valid = form.checkValidity();
	const hasChanges = !!form.querySelector("input[changed]");
	submitButton.disabled = !valid || !hasChanges;
}

function updateApiKeyInput() {
	apiKeyInput.disabled = !useApiKeyInput.checked;
}

function validateServerUrl() {
	const url = URL.parse(serverUrlInput.value);
	if (!url) {
		serverUrlInput.setCustomValidity("Please enter a valid URL");
		return;
	}
	if (!["ws:", "wss:"].includes(url.protocol)) {
		serverUrlInput.setCustomValidity("Please enter a websocket url (wss://)");
		return;
	}
	serverUrlInput.setCustomValidity("");
}

function reset() {
	getConfig().then((config) => {
		serverUrlInput.value = config.serverUrl ?? "";
		serverUrlInput.dispatchEvent(new Event("change"));

		useApiKeyInput.checked = config.apiKey !== undefined;

		apiKeyInput.value = config.apiKey ?? "";
		apiKeyInput.dispatchEvent(new Event("change"));

		updateFormState();
	}).catch((err: unknown) => { log.error(err); });

	for (const elem of form.querySelectorAll("input[changed]")) {
		elem.removeAttribute("changed");
	}
}

form.addEventListener("submit", (evt) => {
	evt.preventDefault();
	const data = new FormData(form);

	const serverUrl = (data.get("serverUrl") ?? "") as string;
	const useApiKey = !!data.get("useApiKey");
	const apiKey = (data.get("apiKey") ?? "") as string;


	setConfig({ serverUrl, apiKey: useApiKey ? apiKey : undefined }).catch((err: unknown) => { log.error(`Failed to set config: %s`, err); });
})

serverUrlInput.addEventListener("input", () => {
	serverUrlInput.setAttribute("changed", "");
	validateServerUrl();
	checkCanSave();
})

useApiKeyInput.addEventListener("change", () => {
	useApiKeyInput.setAttribute("changed", "");
	updateApiKeyInput();
	checkCanSave();
})

apiKeyInput.addEventListener("input", () => {
	apiKeyInput.setAttribute("changed", "");
	checkCanSave();
})

cancelButton.addEventListener("click", (evt) => {
	evt.preventDefault();
	reset();
});

reset();
