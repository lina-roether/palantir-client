import type { Logger } from "@just-log/core";

const mutationHandlers: MutationCallback[] = [];
const observer = new MutationObserver((records, observer) => {
	for (const handler of mutationHandlers) handler(records, observer);
})
observer.observe(document.body, { childList: true, subtree: true });

export function initComponent<E extends Element>(
	logger: Logger,
	query: string,
	runtimeType: new () => E,
	handler: (elem: E) => void,
	cleanup?: (elem: E) => void
) {
	const initialElems = document.querySelectorAll(query);
	for (const elem of initialElems) {
		if (!(elem instanceof runtimeType)) {
			logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
			continue;
		}
		handler(elem);
	}

	const mutationCallback: MutationCallback = (records) => {
		for (const record of records) {
			for (const addedNode of record.addedNodes) {
				if (!(addedNode instanceof Element)) continue;

				const addedComponents = addedNode.querySelectorAll(query);
				for (const addedComponent of addedComponents) {
					if (!(addedComponent instanceof runtimeType)) {
						logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
						continue;
					}
					handler(addedComponent);
				}
			}
			if (!cleanup) continue;
			for (const removedNode of record.removedNodes) {
				if (!(removedNode instanceof Element)) continue;

				const removedComponents = removedNode.querySelectorAll(query);
				for (const removedComponent of removedComponents) {
					if (!(removedComponent instanceof Element)) continue;
					if (!(removedComponent instanceof runtimeType)) {
						logger.error(`Component query '${query}' matched element not of expected type ${runtimeType.name}`);
						continue;
					}
					cleanup(removedComponent);
				}
			}
		}
	};
	mutationHandlers.push(mutationCallback);
}
