export function assertElement(query: string): Element {
	const elem = document.querySelector(query);
	if (!elem) {
		throw new Error(`Missing expected element '${query}'`);
	}
	return elem;
}

export function assertTypedElement<E extends Element>(query: string, runtimeType: new () => E): E {
	const elem = assertElement(query);
	if (!(elem instanceof runtimeType)) {
		const expectedTypeName = runtimeType.name;
		const receivedTypeName = elem.constructor.name;
		throw new Error(`Expected element ${query} to be of type ${expectedTypeName}, but found ${receivedTypeName}`);
	}
	return elem;
}
