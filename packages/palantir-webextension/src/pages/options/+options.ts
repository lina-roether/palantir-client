import log from "@just-log/core";
import { getConfig, setConfig } from "../../config";
import { assertTypedElement } from "../../utils/query";
import { FormMode, initForm } from "../../utils/form";

const cancelButton = assertTypedElement("#options__cancel", HTMLButtonElement);
const useApiKeyInput = assertTypedElement("#options__use-api-key", HTMLInputElement);
const apiKeyInput = assertTypedElement("#options__api-key", HTMLInputElement);

const form = initForm({
	query: "#options__form",
	mode: FormMode.EDIT,
	onSubmit,
	fields: {
		serverUrl: {
			value: async () => (await getConfig()).serverUrl ?? "",
			validate: validateServerUrl
		},
		useApiKey: {
			value: async () => (await getConfig()).apiKey !== undefined,
		},
		apiKey: {
			value: async () => (await getConfig()).apiKey ?? "",
			validate: validateApiKey
		}
	}
})

cancelButton.addEventListener("click", (evt) => {
	evt.preventDefault();
	void form.reset();
});


function updateApiKeyInput() {
	apiKeyInput.disabled = !useApiKeyInput.checked;
}

function validateServerUrl(value: FormDataEntryValue | null) {
	if (typeof value !== "string") {
		return "Only text input is allowed";
	}
	const url = URL.parse(value);
	if (!url) {
		return "Please enter a valid URL";
	}
	if (!["ws:", "wss:"].includes(url.protocol)) {
		return "Please enter a websocket url (wss://)";
	}
}

function validateApiKey(value: FormDataEntryValue | null) {
	if (typeof value !== "string") {
		return "Only text input is allowed";
	}
	if (!value) return "Please enter an API key";
	return "";
}

function onSubmit(data: FormData) {
	const serverUrl = (data.get("serverUrl") ?? "") as string;
	const useApiKey = !!data.get("useApiKey");
	const apiKey = (data.get("apiKey") ?? "") as string;


	setConfig({ serverUrl, apiKey: useApiKey ? apiKey : undefined })
		.catch((err: unknown) => { log.error(`Failed to set config: ${err?.toString() ?? "unknown error"}`); });
}

useApiKeyInput.addEventListener("change", () => {
	updateApiKeyInput();
})

updateApiKeyInput();
