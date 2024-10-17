import { baseLogger } from "../logger";
import { assertTypedElement } from "./query";

const logger = baseLogger.sub("utils", "state");

export type StateMap<T extends string | number> = Record<T, string>;

export class StateController<T extends string | number> {
	private container: HTMLElement;
	private state: T | null = null;
	private templates: Record<T, HTMLTemplateElement>;

	constructor(container: HTMLElement, templates: Record<T, HTMLTemplateElement>) {
		this.container = container;
		this.templates = templates;
	}

	public getState(): T | null {
		return this.state;
	}

	public setState(state: T) {
		logger.debug(`Setting page state to ${state.toString()}`)
		this.state = state;
		this.container.innerHTML = "";
		this.container.appendChild(this.templates[state].content.cloneNode(true));
	}
}

export function initStateContainer<T extends string | number>(container: string, templates: StateMap<T>) {
	const containerElement = assertTypedElement(container, HTMLElement);
	const templateElements: Partial<Record<T, HTMLTemplateElement>> = {};
	for (const state in templates) {
		templateElements[state] = assertTypedElement(templates[state], HTMLTemplateElement);
	}
	return new StateController(containerElement, templateElements as Record<T, HTMLTemplateElement>);
}
