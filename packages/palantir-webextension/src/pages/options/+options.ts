import log from "@just-log/core";
import { getConfig, setConfig, type Config } from "../../config";
import { assertTypedElement, FormMode, initForm } from "../../utils";

const cancelButton = assertTypedElement("#options__cancel", HTMLButtonElement);
const useApiKeyInput = assertTypedElement("#options__use-api-key", HTMLInputElement);
const apiKeyInput = assertTypedElement("#options__api-key", HTMLInputElement);

let cachedConfig: Config | null = null;

async function getCachedConfig(): Promise<Config> {
	if (!cachedConfig) cachedConfig = await getConfig();
	return cachedConfig;
}


initForm({
	query: "#options__form",
	mode: FormMode.EDIT,
	onSubmit,
	fields: {
		serverUrl: {
			value: async () => (await getCachedConfig()).serverUrl ?? "",
			validate: validateServerUrl
		},
		useApiKey: {
			value: async () => (await getCachedConfig()).apiKey !== undefined,
		},
		apiKey: {
			value: async () => (await getCachedConfig()).apiKey ?? ""
		}
	}
}).then((form) => {

	cancelButton.addEventListener("click", (evt) => {
		evt.preventDefault();
		void form.reset();
	});
}).catch((err: unknown) => {
	log.error(`Failed to initialize form: ${err?.toString() ?? "unknown error"}`);
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
