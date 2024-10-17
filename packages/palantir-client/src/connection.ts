import {  ConnectionClosedReason, Message, MessageChannel } from "./messages";
import { TypedEvent, TypedEventTarget } from "./utils";
import { baseLogger } from "./logger";

const logger = baseLogger.sub("connection");

const enum ConnectionState {
	INITIAL,
	CONNECTED,
	AUTHENTICATING,
	AUTHENTICATED,
	DISCONNECTED
}

export class ClosedEvent extends TypedEvent<"closed"> {
	constructor(public reason: ConnectionClosedReason, public readonly message: string) {
		super("closed");
	}
}

export class ErrorEvent extends TypedEvent<"error"> {
	constructor(public readonly message: string) {
		super("error");
	}
}

interface ConnectionEventMap {
	"open": TypedEvent<"open">,
	"closed": ClosedEvent,
	"error": ErrorEvent,
}

export interface ConnectionOptions {
	url: string | URL,
	username: string,
	apiKey?: string
}

export class Connection extends TypedEventTarget<ConnectionEventMap> {
	private readonly channel: MessageChannel;
	private state: ConnectionState = ConnectionState.INITIAL;
	private readonly username: string;
	private readonly apiKey?: string;

	constructor(options: ConnectionOptions) {
		super();
		this.username = options.username;
		this.apiKey = options.apiKey;
		this.channel = new MessageChannel(options.url);
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

	public get open() {
		return this.state == ConnectionState.AUTHENTICATED;
	}

	public close(reason: ConnectionClosedReason, message: string) {
		this.channel.close();
		this.state = ConnectionState.DISCONNECTED;
		this.dispatchEvent(new ClosedEvent(reason, message));
	}

	private onChannelOpen() {
		this.state = ConnectionState.CONNECTED;
		this.authenticate();
	}

	private onChannelClosed() {
		if (this.state == ConnectionState.DISCONNECTED) return;
		this.close("unknown", "Connection lost");
	}

	private onChannelMessage(message: Message) {
		logger.debug(`Received message: ${JSON.stringify(message)}`);

		if (this.handleConnectionMessage(message)) return;

		switch (this.state) {
			case ConnectionState.INITIAL:
				logger.warning(`Received message ${message.m} while not yet connected! This shouldn't happen!`);
				break;
			case ConnectionState.CONNECTED:
				logger.warning(`Received unexpected message ${message.m} before authenticating`);
				break;
			case ConnectionState.AUTHENTICATING:
				this.expectAuthAck(message);
				break;
			case ConnectionState.AUTHENTICATED:
				this.handleMessage(message);
				break;
			case ConnectionState.DISCONNECTED:
				logger.warning(`Received message ${message.m} while disconnected! This shouldn't happen!`);
		}
	}

	private authenticate() {
		this.channel.send({
			m: "connection::login/v1",
			username: this.username,
			api_key: this.apiKey
		})
		this.state = ConnectionState.AUTHENTICATING;
	}

	private handleError(message: string) {
		this.dispatchEvent(new ErrorEvent(message));
	}

	private handleConnectionMessage(message: Message): boolean {
		switch (message.m) {
			case "connection::client_error/v1":
				this.handleError(message.message);
				return true;
			case "connection::ping/v1":
				this.channel.send({ m: "connection::pong/v1" });
				return true;
			case "connection::closed/v1":
				this.close(message.reason, message.message);
				return true;
			default:
				return false;
		}
	}

	private expectAuthAck(message: Message) {
		if (message.m == "connection::login_ack/v1") {
			logger.info(`Successfully logged in as ${this.username} on ${this.channel.getUrl()}`);
			this.state = ConnectionState.AUTHENTICATED;
			this.dispatchEvent(new TypedEvent("open"));
		} else {
			logger.warning(`Received unexpected message ${message.m}; expected connection::login_ack/v1`);
		}
	}

	private handleMessage(message: Message) {
		// TODO
	}
}
