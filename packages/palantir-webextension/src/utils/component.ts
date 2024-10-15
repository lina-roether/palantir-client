import log from "@just-log/core";

const logger = log.sub("utils", "component");

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
