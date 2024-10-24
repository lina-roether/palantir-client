import { baseLogger } from "../../logger"
import { assertElement } from "../../utils/query";

const logger = baseLogger.sub("components", "snackbar");
const snackbar = assertElement(logger, ".js_palantir-snackbar", HTMLDialogElement);
const snackbarContent = assertElement(logger, ".js_palantir-snackbar__content", HTMLElement, snackbar);

export const enum SnackbarType {
	INFO,
	ERROR
}

const TYPE_CLASSES: Record<SnackbarType, string> = {
	[SnackbarType.INFO]: "snackbar--info",
	[SnackbarType.ERROR]: "snackbar--error"
}

function setSnackbarType(type: SnackbarType) {
	for (const typeClass of Object.values(TYPE_CLASSES)) {
		snackbar.classList.remove(typeClass);
	}
	snackbar.classList.add(TYPE_CLASSES[type]);
}

function setSnackbarContent(message: string) {
	snackbarContent.innerText = message;
}

function showSnackbar(init: SnackbarInit) {
	setSnackbarType(init.type);
	setSnackbarContent(init.message);
	snackbar.show();
}

function hideSnackbar() {
	snackbar.close();
}

export interface SnackbarInit {
	type: SnackbarType,
	message: string
}

const snackbarQueue: SnackbarInit[] = [];
let queueActive = false;

const SNACKBAR_SHOW_DURATION = 5000;
const SNACKBAR_SHOW_DELAY = 500;

function showQueuedSnackbar() {
	if (queueActive) return;
	const init = snackbarQueue.shift();
	if (!init) {
		queueActive = false;
		return;
	}
	queueActive = true;
	showSnackbar(init);
	setTimeout(hideQueuedSnackbar, SNACKBAR_SHOW_DURATION);
}

function hideQueuedSnackbar() {
	hideSnackbar();
	setTimeout(showQueuedSnackbar, SNACKBAR_SHOW_DELAY);
}

export function queueSnackbar(init: SnackbarInit) {
	snackbarQueue.push(init);
	showQueuedSnackbar();
}
