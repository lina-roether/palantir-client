import log from "log";

const logger = log.get("utils");

export function assertElement(query: string, rootElem: Element = document.body): Element {
	const elem = rootElem.querySelector(query);
	if (!elem) {
		throw new Error(`Missing expected element '${query}'`);
	}
	return elem;
}

export function assertTypedElement<E extends Element>(query: string, runtimeType: new () => E, rootElem: Element = document.body): E {
	const elem = assertElement(query, rootElem);
	if (!(elem instanceof runtimeType)) {
		const expectedTypeName = runtimeType.name;
		const receivedTypeName = elem.constructor.name;
		throw new Error(`Expected element ${query} to be of type ${expectedTypeName}, but found ${receivedTypeName}`);
	}
	return elem;
}

export function initComponent<E extends Element>(query: string, runtimeType: new () => E, handler: (elem: E) => void, cleanup?: (elem: E) => void) {
	const initialElems = document.querySelectorAll(query);
	for (const elem of initialElems) {
		if (!(elem instanceof runtimeType)) {
			logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
			continue;
		}
		handler(elem);
	}

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const addedNode of record.addedNodes) {
				if (!(addedNode instanceof Element)) continue;
				if (!addedNode.matches(query)) continue;
				if (!(addedNode instanceof runtimeType)) {
					logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
					continue;
				}
				handler(addedNode);
			}
			if (!cleanup) return;
			for (const removedNode of record.removedNodes) {
				if (!(removedNode instanceof Element)) continue;
				if (!removedNode.matches(query)) continue;
				if (!(removedNode instanceof Element)) continue;
				if (!removedNode.matches(query)) continue;
				if (!(removedNode instanceof runtimeType)) {
					logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
					continue;
				}
				cleanup(removedNode);
			}
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });
}
