import type { Logger } from "@just-log/core";

interface ElementConstructor<E extends Element> {
	prototype: E;
	new(): E;
}

export function assertElement<E extends Element>(
	logger: Logger,
	query: string,
	elementConstructor: ElementConstructor<E>,
	rootElem: Element = document.body
): E {
	const elem = rootElem.querySelector(query);
	if (!elem) {
		logger.error(`Missing required element \`${query}\``);
		return document.createElement(elementConstructor.prototype.tagName) as unknown as E;
	}
	if (!(elem instanceof elementConstructor)) {
		const expectedTypeName = elementConstructor.name;
		const receivedTypeName = elem.constructor.name;
		logger.error(`Expected element ${query} to be of type ${expectedTypeName}, but found ${receivedTypeName}`);
		return document.createElement(elementConstructor.prototype.tagName) as unknown as E;
	}
	return elem;
}
