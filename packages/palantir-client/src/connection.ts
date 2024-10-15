import log from "@just-log/core";
import { Message, MessageChannel } from "./messages";
import { TypedEvent, TypedEventTarget } from "./utils";

const logger = log.sub("connection");

export const enum ConnectionState {
	INITIAL,
	CONNECTED,
	AUTHENTICATED,
	DISCONNECTED
}

export class StateChangeEvent extends TypedEvent<"statechange"> {
	constructor(public readonly state: ConnectionState) {
		super("statechange");
	}
}

interface ConnectionEventMap {
	"statechange": StateChangeEvent
}

export class Connection extends TypedEventTarget<ConnectionEventMap> {
	private readonly channel: MessageChannel;
	private state: ConnectionState = ConnectionState.INITIAL;

	constructor(url: string | URL) {
		super();
		this.channel = new MessageChannel(url);
		this.channel.addEventListener("open", () => {
			this.onChannelOpen();
		});
		this.channel.addEventListener("closed", () => {
			this.onChannelClosed();
		});
		this.channel.addEventListener("message", (evt) => {
			this.onChannelMessage(evt.message);
		});
	}

	public getState(): ConnectionState {
		return this.state;
	}

	private setState(state: ConnectionState) {
		this.state = state;
		this.dispatchEvent(new StateChangeEvent(state));
	}

	private onChannelOpen() {
		this.setState(ConnectionState.CONNECTED);
	}

	private onChannelClosed() {
		this.setState(ConnectionState.DISCONNECTED);
	}

	private onChannelMessage(message: Message) {
		logger.debug(`Received message: ${JSON.stringify(message)}`);
	}
}
