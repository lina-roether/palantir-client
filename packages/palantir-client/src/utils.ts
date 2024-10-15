export type TypedEventListener<E extends Event> = (evt: E) => void;

export class TypedEvent<T extends string> extends Event {
	constructor(public type: T) {
		super(type);
	}
}

export class TypedEventTarget<EventMap> {
	private target: EventTarget;

	constructor() {
		this.target = new EventTarget();
	}

	public dispatchEvent<K extends keyof EventMap & string>(event: EventMap[K] & TypedEvent<K>): boolean {
		return this.target.dispatchEvent(event);
	}

	public addEventListener<K extends keyof EventMap & string>(type: K, callback: TypedEventListener<EventMap[K] & TypedEvent<K>>, options?: AddEventListenerOptions | boolean): void {
		this.target.addEventListener(type, callback as EventListener, options);
	}
}
