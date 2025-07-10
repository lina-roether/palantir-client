import { ClosedEvent, Connection, ConnectionOptions, ErrorEvent } from "./connection";
import { baseLogger } from "./logger";
import { Message, RoomPermissionsMsgBodyV1, RoomStateMsgBodyV1 } from "./messages";
import { TypedEvent, TypedEventTarget } from "./utils";
import * as uuid from "uuid";

const logger = baseLogger.sub("session");

export interface UserPermissions {
	can_host: boolean,
	can_close: boolean,
	can_kick: boolean,
	can_set_roles: boolean
}

export interface RoomPermissions {
	role: UserRole,
	permissions: UserPermissions
}

export type UserRole = "host" | "guest" | "spectator";

export interface User {
	id: string,
	name: string,
	role: UserRole
}

export interface RoomData {
	id: string,
	name: string,
	password: string,
	users: User[]
}

export enum RoomConnectionStatus {
	NOT_IN_ROOM = "not_in_room",
	JOINING = "joining",
	IN_ROOM = "in_room",
	LEAVING = "leaving"
}

export interface SessionState {
	roomConnectionStatus: RoomConnectionStatus,
	roomData?: RoomData;
	roomPermissions?: RoomPermissions;
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
	"roomcreated": TypedEvent<"roomcreated">,
	"roomjoined": TypedEvent<"roomjoined">,
	"roomleft": TypedEvent<"roomleft">
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SessionOptions extends ConnectionOptions { }

export const enum State {
	INITIAL,
	JOINING,
	CREATING,
	JOINED,
	LEAVING,
	CLOSED,
}

export interface RoomInit {
	name: string,
	password: string
}

const ACK_TIMEOUT = 1000;

export class Session extends TypedEventTarget<SessionEventMap> {
	private readonly connection: Connection;
	private roomData: RoomData | null = null;
	private roomPermissions: RoomPermissions | null = null;
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

	public roomConnectionStatus(): RoomConnectionStatus {
		switch (this.state) {
			case State.INITIAL:
			case State.CLOSED:
				return RoomConnectionStatus.NOT_IN_ROOM;
			case State.JOINING:
			case State.CREATING:
				return RoomConnectionStatus.JOINING;
			case State.JOINED:
				return RoomConnectionStatus.IN_ROOM;
			case State.LEAVING:
				return RoomConnectionStatus.LEAVING;
		}
	}

	public isInRoom() {
		return this.roomConnectionStatus() == RoomConnectionStatus.IN_ROOM;
	}

	public getRoomData(): RoomData | null {
		return this.roomData;
	}

	public getState(): SessionState {
		const state = {
			roomConnectionStatus: this.roomConnectionStatus(),
			roomData: this.roomData ?? undefined,
			roomPermissions: this.roomPermissions ?? undefined
		}
		logger.debug(`Current session state is ${JSON.stringify(state)}`);
		return state;
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
				this.dispatchEvent(new ErrorEvent("Connection timed out"));
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
				this.dispatchEvent(new ErrorEvent("Connection timed out"));
			}
		}, ACK_TIMEOUT)
	}

	public leaveRoom() {
		if (!this.isInRoom()) return;
		logger.info(`Leaving current room...`);
		this.roomData = null;
		this.roomPermissions = null;
		this.connection.send({ m: "room::leave/v1" });
		this.state = State.LEAVING;
		setTimeout(() => {
			if (this.state == State.LEAVING) {
				this.state = State.INITIAL;
				logger.error(`Timed out while leaving room`);
				this.dispatchEvent(new ErrorEvent("Connection timed out"));
			}
		}, ACK_TIMEOUT)
	}

	public close(message: string) {
		if (!this.open) return;
		this.state = State.CLOSED;
		this.connection.close(message);
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

	private requestRoomPermissions() {
		this.connection.send({ m: "room::request_permissions/v1" });
	}

	private broadcastStateUpdate() {
		this.dispatchEvent(new UpdateEvent(this.getState()));
	}

	private onRoomJoined() {
		logger.info(`Successfully joined room`);
		this.state = State.JOINED;
		this.requestRoomState();
		this.requestRoomPermissions();
		this.dispatchEvent(new TypedEvent("roomjoined"));
		this.broadcastStateUpdate();
	}

	private onRoomLeft() {
		logger.info(`Successfully left room`);
		this.state = State.INITIAL;
		this.dispatchEvent(new TypedEvent("roomleft"));
		this.broadcastStateUpdate();
	}

	private onRoomDisconnected(reason: string) {
		logger.info(`Room disconnected: ${reason}`);
		this.state = State.INITIAL;
		this.dispatchEvent(new ErrorEvent("Room disconnected"));
		this.broadcastStateUpdate();
	}

	private updateRoomData(state: RoomStateMsgBodyV1) {
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

	private updateRoomPermissions(body: RoomPermissionsMsgBodyV1) {
		logger.debug(`Recieved room permissions: ${JSON.stringify(body)}`)
		this.roomPermissions = {
			role: body.role,
			permissions: body.permissions
		};
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
			case "room::permissions/v1":
				this.updateRoomPermissions(message);
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
					this.onRoomJoined();
					return;
				}
				break;
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
			this.broadcastStateUpdate();
		}
	}

	private onConnectionClosed(message: string) {
		if (this.state !== State.CLOSED) {
			this.dispatchEvent(new ErrorEvent("Server connection failed"));
			this.state = State.CLOSED;
			this.broadcastStateUpdate();
		}
		this.close(message);
	}
}
