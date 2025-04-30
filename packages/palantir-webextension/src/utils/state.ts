import type { Logger } from "@just-log/core";
import { assertElement } from "./query";
import { runPromise } from "./error";

export type StateHandler<P = undefined> = (elem: HTMLElement, props: P) => void | Promise<void>;

export interface StateDefinition<P> {
	template: string,
	handler?: StateHandler<P>
}

export type StateDefinitions = Record<string, StateDefinition<never>>;
export type StateTypeMap<D extends StateDefinitions> = { [S in keyof D]: D[S]["handler"] extends StateHandler<infer P> ? P : undefined }

type StateTemplates<M> = Record<keyof M, HTMLTemplateElement>;
type StateHandlers<M> = { [S in keyof M]: StateHandler<M[S]> | undefined };

type ProplessStates<M> = keyof { [S in keyof M as M[S] extends undefined ? S : never]: undefined };

export class StateController<M> {
	private logger: Logger;
	private container: HTMLElement;
	private state: keyof M | null = null;
	private templates: StateTemplates<M>;
	private handlers: StateHandlers<M>;

	constructor(logger: Logger, container: HTMLElement, templates: StateTemplates<M>, handlers: StateHandlers<M>) {
		this.logger = logger;
		this.container = container;
		this.templates = templates;
		this.handlers = handlers;
	}

	public getState(): keyof M | null {
		return this.state;
	}

	public setState(state: ProplessStates<M>): void
	public setState<S extends keyof M>(state: S, props: M[S]): void
	public setState<S extends keyof M>(state: S, props?: M[S]): void {
		this.logger.debug(`Setting page state to ${state.toString()}`)
		this.state = state;
		this.container.innerHTML = "";
		this.container.appendChild(this.templates[state].content.cloneNode(true));
		const promiseOrVoid = this.handlers[state]?.(
			this.container,
			props as never
		);
		if (promiseOrVoid instanceof Promise)
			runPromise(this.logger, promiseOrVoid, "Failed to run state handler");
	}
}

export function initStateContainer<D extends StateDefinitions>(logger: Logger, container: string, definitions: D): StateController<StateTypeMap<D>> {
	const containerElement = assertElement(logger, container, HTMLElement);
	const templateElements: Partial<StateTemplates<StateTypeMap<D>>> = {};
	const stateHandlers: Partial<StateHandlers<StateTypeMap<D>>> = {};
	for (const state in definitions) {
		const def = definitions[state];
		if (typeof def == "string") {
			templateElements[state] = assertElement(logger, def, HTMLTemplateElement);
		} else {
			templateElements[state] = assertElement(logger, def.template, HTMLTemplateElement);
			stateHandlers[state] = def.handler as never;
		}
	}
	return new StateController(
		logger,
		containerElement,
		templateElements as StateTemplates<StateTypeMap<D>>,
		stateHandlers as StateHandlers<StateTypeMap<D>>
	);
}
