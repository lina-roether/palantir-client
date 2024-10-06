export type TypedEventListener<E extends Event> = (evt: E) => void;

export class TypedEventTarget<EventMap> {
	private target: EventTarget;

	constructor() {
		this.target = new EventTarget();
	}

	public dispatchEvent(event: EventMap[keyof EventMap] & Event): boolean {
		return this.target.dispatchEvent(event);
	}

	public addEventListener<K extends keyof EventMap & string>(type: K, callback: TypedEventListener<EventMap[K] & Event>, options?: AddEventListenerOptions | boolean): void {
		this.target.addEventListener(type, callback as EventListener, options);
	}
}
