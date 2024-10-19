import { ClosedEvent, Connection, ConnectionOptions, ErrorEvent } from "./connection";
import { baseLogger } from "./logger";
import { Message, RoomStateMsgBody } from "./messages";
import { TypedEvent, TypedEventTarget } from "./utils";
import * as uuid from "uuid";

const logger = baseLogger.sub("session");

export type UserRole = "host" | "guest";

export interface User {
	id: string,
	name: string,
	role: UserRole,
}

export interface RoomData {
	id: string,
	name: string,
	password: string,
	users: User[]
}

export interface SessionState {
	inRoom: boolean;
	userRole?: UserRole;
	roomData?: RoomData;
}

export class UpdateEvent extends TypedEvent<"update"> {
	constructor(public readonly state: SessionState) {
		super("update");
	}
}

export interface SessionEventMap {
	"open": TypedEvent<"open">,
	"update": UpdateEvent,
	"closed": ClosedEvent,
	"error": ErrorEvent,
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SessionOptions extends ConnectionOptions { }

export const enum State {
	INITIAL,
	JOINING,
	CREATING,
	CREATED,
	JOINED,
	LEAVING
}

export interface RoomInit {
	name: string,
	password: string
}

const ACK_TIMEOUT = 1000;

export class Session extends TypedEventTarget<SessionEventMap> {
	private readonly connection: Connection;
	private roomData: RoomData | null = null;
	private state: State = State.INITIAL;

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

	public isInRoom() {
		return this.state == State.JOINED || this.state == State.CREATED;
	}

	public getUserRole(): UserRole | undefined {
		switch (this.state) {
			case State.JOINING:
			case State.JOINED:
				return "guest";
			case State.CREATING:
			case State.CREATED:
				return "host";
			default:
				return undefined;
		}
	}

	public getRoomData(): RoomData | null {
		return this.roomData;
	}

	public getState(): SessionState {
		return {
			inRoom: this.isInRoom(),
			userRole: this.getUserRole(),
			roomData: this.roomData ?? undefined
		}
	}

	public createRoom(init: RoomInit) {
		logger.info(`Creating new room with name ${init.name}...`);
		if (this.state != State.INITIAL) {
			throw new Error("Already in a room");
		}
		this.connection.send({
			m: "room::create/v1",
			name: init.name,
			password: init.password
		})
		this.state = State.CREATING;
		setTimeout(() => {
			if (this.state == State.CREATING) {
				this.state = State.INITIAL;
				logger.error(`Timed out while creating room`);
			}
		}, ACK_TIMEOUT)
	}

	public joinRoom(id: string, password: string) {
		logger.info(`Joining room with id ${id}...`);
		if (this.state != State.INITIAL) {
			throw new Error("Already in a room");
		}
		this.connection.send({ m: "room::join/v1", id: uuid.parse(id), password });
		this.state = State.JOINING;
		setTimeout(() => {
			if (this.state == State.JOINING) {
				this.state = State.INITIAL;
				logger.error(`Timed out while joining room`);
			}
		}, ACK_TIMEOUT)
	}

	public leaveRoom() {
		if (!this.isInRoom()) return;
		logger.info(`Leaving current room...`);
		this.roomData = null;
		this.connection.send({ m: "room::leave/v1" });
		this.state = State.LEAVING;
		setTimeout(() => {
			if (this.state == State.LEAVING) {
				this.state = State.INITIAL;
				logger.error(`Timed out while leaving room`);
			}
		}, ACK_TIMEOUT)
	}

	public close(message: string) {
		if (!this.open) return;
		logger.info(`Session closed: ${message}`);
		this.dispatchEvent(new ClosedEvent(message));
	}

	private onConnectionOpen() {
		logger.info(`Session opened at ${this.connection.serverUrl}`);
		this.dispatchEvent(new TypedEvent("open"));
	}

	private requestRoomState() {
		this.connection.send({ m: "room::request_state/v1" });
	}

	private broadcastStateUpdate() {
		this.dispatchEvent(new UpdateEvent(this.getState()));
	}

	private onRoomJoined() {
		logger.info(`Successfully joined room`);
		this.state = State.JOINED;
		this.broadcastStateUpdate();
	}

	private onRoomCreated() {
		logger.info(`Successfully created room`);
		this.state = State.CREATED;
		this.requestRoomState();
		this.broadcastStateUpdate();
	}

	private onRoomLeft() {
		logger.info(`Successfully left room`);
		this.state = State.INITIAL;
		this.broadcastStateUpdate();
	}

	private onRoomDisconnected(reason: string) {
		logger.info(`Room disconnected: ${reason}`);
		this.state = State.INITIAL;
		this.dispatchEvent(new ErrorEvent("Room disconnected"));
		this.broadcastStateUpdate();
	}

	private updateRoomData(state: RoomStateMsgBody) {
		this.roomData = {
			id: uuid.stringify(state.id),
			name: state.name,
			password: state.password,
			users: state.users.map((user) => ({
				id: uuid.stringify(user.id),
				name: user.name,
				role: user.role
			}))
		}
		this.broadcastStateUpdate();
	}

	private onRoomMessage(message: Message) {
		switch (message.m) {
			case "room::disconnected/v1":
				this.onRoomDisconnected(message.reason);
				break;
			case "room::state/v1":
				this.updateRoomData(message);
				break;
			default:
				logger.warning(`Recieved unexpected room message '${message.m}'`);
		}
	}

	private onConnectionMessage(message: Message) {
		switch (this.state) {
			case State.INITIAL:
				break;
			case State.JOINING:
				if (message.m == "room::join_ack/v1") {
					this.onRoomJoined();
					return;
				}
				break;
			case State.CREATING:
				if (message.m == "room::create_ack/v1") {
					this.onRoomCreated();
					return;
				}
				break;
			case State.CREATED:
			case State.JOINED:
				this.onRoomMessage(message);
				return;
			case State.LEAVING:
				if (message.m == "room::leave_ack/v1") {
					this.onRoomLeft();
					return;
				}
		}
		logger.warning(`Recieved unexpected message '${message.m}'`);
	}

	private onConnectionError(message: string) {
		logger.error(`Got error message from server: ${message}`);
		this.dispatchEvent(new ErrorEvent(message));

		// Interpret error as failing the pending operation
		if (this.state == State.JOINING || this.state == State.CREATING || this.state == State.LEAVING) {
			this.state = State.INITIAL;
		}
	}

	private onConnectionClosed(message: string) {
		this.close(message);
	}
}
