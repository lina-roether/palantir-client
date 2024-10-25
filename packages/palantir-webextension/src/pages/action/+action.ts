import { baseLogger } from "../../logger";
import { decodeActionParams, type ActionParams } from "../../utils/action";
import { assertElement } from "../../utils/query";

const logger = baseLogger.sub("pages", "action");

const errorElem = assertElement(logger, "#action__error", HTMLElement);

function getParamString(): string {
	if (!location.hash.startsWith("#"))
		throw new Error("Missing action parameter string");
	return location.hash.substring(1);
}

function sendError(message: string) {
	logger.error(message);
	errorElem.innerText = `Invalid palantir URL: ${message}`;
}

function getActionParams(): ActionParams {
	const paramString = getParamString();
	const params = decodeActionParams(paramString);
	return params;
}
