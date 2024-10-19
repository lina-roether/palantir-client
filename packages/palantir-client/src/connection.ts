import { Message, MessageBody, MessageChannel, MessageEvent } from "./messages";
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
	constructor(public readonly message: string) {
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
	"message": MessageEvent

}

export interface ConnectionOptions {
	url: string | URL,
	username: string,
	apiKey?: string,
}

const KEEPALIVE_INTERVAL = 10000;

export class Connection extends TypedEventTarget<ConnectionEventMap> {
	private readonly channel: MessageChannel;
	private state: ConnectionState = ConnectionState.INITIAL;
	private readonly username: string;
	private readonly apiKey?: string;
	private keepaliveInterval?: number;

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

	public get serverUrl() {
		return this.channel.getUrl();
	}

	public send(message: MessageBody) {
		this.channel.send(message);
	}

	public close(message: string) {
		this.channel.close();
		this.state = ConnectionState.DISCONNECTED;
		this.dispatchEvent(new ClosedEvent(message));
	}

	private stopKeepalive() {
		if (this.keepaliveInterval === undefined) return;
		clearInterval(this.keepaliveInterval);
	}

	private startKeepalive() {
		this.stopKeepalive();
		this.keepaliveInterval = setInterval(() => {
			this.send({ m: "connection::keepalive/v1" });
		}, KEEPALIVE_INTERVAL);
	}

	private onChannelOpen() {
		this.state = ConnectionState.CONNECTED;
		this.authenticate();
	}

	private onAuthenticated() {
		this.dispatchEvent(new TypedEvent("open"));
		this.startKeepalive();
	}

	private onChannelClosed() {
		if (this.state == ConnectionState.DISCONNECTED) return;
		this.stopKeepalive();
		this.close("Connection lost");
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
				this.close(message.message);
				return true;
			default:
				return false;
		}
	}

	private expectAuthAck(message: Message) {
		if (message.m == "connection::login_ack/v1") {
			logger.info(`Successfully logged in as ${this.username} on ${this.channel.getUrl()}`);
			this.state = ConnectionState.AUTHENTICATED;
		} else {
			logger.warning(`Received unexpected message ${message.m}; expected connection::login_ack/v1`);
		}
	}

	private handleMessage(message: Message) {
		if (message.m.startsWith("connection::")) return;
		this.dispatchEvent(new MessageEvent(message));
	}
}
