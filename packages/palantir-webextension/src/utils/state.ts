import { baseLogger } from "../logger";
import { assertTypedElement } from "./query";

const logger = baseLogger.sub("utils", "state");

export type StateHandler = (container: HTMLElement) => void;

export interface StateDefinition {
	template: string,
	handler?: StateHandler
}

export type StateMap<T extends string | number> = Record<T, string | StateDefinition>;

export class StateController<T extends string | number> {
	private container: HTMLElement;
	private state: T | null = null;
	private templates: Record<T, HTMLTemplateElement>;
	private handlers: Record<T, StateHandler | undefined>

	constructor(container: HTMLElement, templates: Record<T, HTMLTemplateElement>, handlers: Record<T, StateHandler | undefined>) {
		this.container = container;
		this.templates = templates;
		this.handlers = handlers;
	}

	public getState(): T | null {
		return this.state;
	}

	public setState(state: T) {
		logger.debug(`Setting page state to ${state.toString()}`)
		this.state = state;
		this.container.innerHTML = "";
		this.container.appendChild(this.templates[state].content.cloneNode(true));
		this.handlers[state]?.(this.container);
	}
}

export function initStateContainer<T extends string>(container: string, definitions: StateMap<T>) {
	const containerElement = assertTypedElement(container, HTMLElement);
	const templateElements: Partial<Record<T, HTMLTemplateElement>> = {};
	const stateHandlers: Partial<Record<T, StateHandler | undefined>> = {};
	for (const state in definitions) {
		const def = definitions[state];
		if (typeof def == "string") {
			templateElements[state] = assertTypedElement(def, HTMLTemplateElement);
		} else {
			templateElements[state] = assertTypedElement(def.template, HTMLTemplateElement);
			stateHandlers[state] = def.handler;
		}
	}
	return new StateController(
		containerElement,
		templateElements as Record<T, HTMLTemplateElement>,
		stateHandlers as Record<T, StateHandler | undefined>
	);
}
