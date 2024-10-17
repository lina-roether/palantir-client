import { ClosedEvent, Connection, ConnectionOptions, ErrorEvent } from "./connection";
import { baseLogger } from "./logger";
import { Message } from "./messages";
import { TypedEvent, TypedEventTarget } from "./utils";

const logger = baseLogger.sub("session");

export interface SessionEventMap {
	"open": TypedEvent<"open">,
	"closed": ClosedEvent,
	"error": ErrorEvent,
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SessionOptions extends ConnectionOptions {}

export class Session extends TypedEventTarget<SessionEventMap> {
	private readonly connection: Connection;

	constructor(options: SessionOptions) {
		super();
		this.connection = new Connection(options);
		this.connection.addEventListener("open", () => {
			this.onConnectionOpen();
		});
		this.connection.addEventListener("message", (evt) => {
			this.onConnectionMessage(evt.message);
		})
		this.connection.addEventListener("error", (evt) => {
			this.onConnectionError(evt.message);
		})
		this.connection.addEventListener("closed", (evt) => {
			this.onConnectionClosed(evt.message);
		})
	}

	public get open() {
		return this.connection.open;
	}

	public close(message: string) {
		logger.info(`Session closed: ${message}`);
		this.dispatchEvent(new ClosedEvent(message));
	}

	private onConnectionOpen() {
		logger.info(`Session opened at ${this.connection.serverUrl}`);
		this.dispatchEvent(new TypedEvent("open"));
	}

	private onConnectionMessage(message: Message) {
		logger.debug(`Got session message: ${JSON.stringify(message)}`);
	}

	private onConnectionError(message: string) {
		logger.error(`Got error message from server: ${message}`);
		this.dispatchEvent(new ErrorEvent(message));
	}

	private onConnectionClosed(message: string) {
		this.close(message);
	}
}
