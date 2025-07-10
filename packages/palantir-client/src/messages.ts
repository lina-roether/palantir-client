import * as z from "zod";
import * as msgpack from "@msgpack/msgpack";
import { TypedEvent, TypedEventTarget } from "./utils";
import { baseLogger } from "./logger";

const logger = baseLogger.sub("messages");

const ConnectionLoginMsgBodyV1Schema = z.object({
	username: z.string(),
	api_key: z.string().optional(),
});

export type ConnectionLoginMsgBodyV1 = z.infer<typeof ConnectionLoginMsgBodyV1Schema>;

const ConnectionClientErrorMsgBodyV1Schema = z.object({
	message: z.string(),
});
export type ConnectionClientErrorMsgBodyV1 = z.infer<typeof ConnectionClientErrorMsgBodyV1Schema>;

const ConnectionClosedReasonV1Schema = z.enum([
	"unauthorized",
	"server_error",
	"room_closed",
	"timeout",
	"unknown",
]);
export type ConnectionClosedReasonV1 = z.infer<typeof ConnectionClosedReasonV1Schema>;

const ConnectionClosedMsgBodyV1Schema = z.object({
	reason: ConnectionClosedReasonV1Schema,
	message: z.string(),
});
export type ConnectionClosedMsgBodyV1 = z.infer<typeof ConnectionClosedMsgBodyV1Schema>;

const RoomCreateMsgBodyV1Schema = z.object({
	name: z.string(),
	password: z.string(),
});
export type RoomCreateMsgBodyV1 = z.infer<typeof RoomCreateMsgBodyV1Schema>;

const RoomJoinMsgBodyV1Schema = z.object({
	id: z.instanceof(Uint8Array),
	password: z.string(),
});
export type RoomJoinMsgBodyV1 = z.infer<typeof RoomJoinMsgBodyV1Schema>;

const RoomUserRoleV1Schema = z.enum([
	"host",
	"guest",
	"spectator"
]);
export type RoomUserRoleV1 = z.infer<typeof RoomUserRoleV1Schema>;

const RoomUserPermissionsV1Schema = z.object({
	can_host: z.boolean(),
	can_close: z.boolean(),
	can_set_roles: z.boolean(),
	can_kick: z.boolean(),
})
export type RoomUserPermsissionsV1 = z.infer<typeof RoomUserPermissionsV1Schema>;

const RoomUserV1Schema = z.object({
	id: z.instanceof(Uint8Array),
	name: z.string(),
	role: RoomUserRoleV1Schema
});
export type RoomUserV1 = z.infer<typeof RoomUserV1Schema>;

const RoomStateMsgBodyV1Schema = z.object({
	id: z.instanceof(Uint8Array),
	name: z.string(),
	password: z.string(),
	users: z.array(RoomUserV1Schema),
});
export type RoomStateMsgBodyV1 = z.infer<typeof RoomStateMsgBodyV1Schema>;

const RoomPermissionsMsgBodyV1Schema = z.object({
	role: RoomUserRoleV1Schema,
	permissions: RoomUserPermissionsV1Schema
});
export type RoomPermissionsMsgBodyV1 = z.infer<typeof RoomPermissionsMsgBodyV1Schema>;

const RoomDisconnectedReasonV1Schema = z.enum(["closed_by_host", "unauthorized", "server_error"]);
export type RoomDisconnectedReasonV1 = z.infer<typeof RoomDisconnectedReasonV1Schema>;

const RoomDisconnectedMsgBodyV1Schema = z.object({
	reason: RoomDisconnectedReasonV1Schema,
});
export type RoomDisconnectedMsgBodyV1 = z.infer<typeof RoomDisconnectedMsgBodyV1Schema>;

const RoomKickUserMsgBodyV1Schema = z.object({
	user_id: z.instanceof(Uint8Array)
});
export type RoomKickUserMsgBodyV1 = z.infer<typeof RoomKickUserMsgBodyV1Schema>;

const EmptyMessageBodySchema = z.object({});

const MessageBodySchema = z.discriminatedUnion("m", [
	ConnectionLoginMsgBodyV1Schema.extend({ m: z.literal("connection::login/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::login_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::ping/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::pong/v1") }),
	ConnectionClientErrorMsgBodyV1Schema.extend({ m: z.literal("connection::client_error/v1") }),
	ConnectionClosedMsgBodyV1Schema.extend({ m: z.literal("connection::closed/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::keepalive/v1") }),
	RoomCreateMsgBodyV1Schema.extend({ m: z.literal("room::create/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::create_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::close/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::close_ack/v1") }),
	RoomJoinMsgBodyV1Schema.extend({ m: z.literal("room::join/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::join_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::leave/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::leave_ack/v1") }),
	RoomDisconnectedMsgBodyV1Schema.extend({ m: z.literal("room::disconnected/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::request_state/v1") }),
	RoomStateMsgBodyV1Schema.extend({ m: z.literal("room::state/v1") }),
	RoomKickUserMsgBodyV1Schema.extend({ m: z.literal("room::kick_user/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::request_permissions/v1") }),
	RoomPermissionsMsgBodyV1Schema.extend({ m: z.literal("room::permissions/v1") }),
]);
export type MessageBody = z.infer<typeof MessageBodySchema>;

const MessageMetaSchema = z.object({
	t: z.number(),
});

const MessageSchema = MessageMetaSchema.and(MessageBodySchema);
export type Message = z.infer<typeof MessageSchema>;

export class MessageEvent extends TypedEvent<"message"> {
	constructor(public message: Message) {
		super("message");
	}
}

export interface MessageChannelEventMap {
	"closed": TypedEvent<"closed">,
	"open": TypedEvent<"open">,
	"message": MessageEvent
}

export class MessageChannel extends TypedEventTarget<MessageChannelEventMap> {
	private ws: WebSocket;

	constructor(url: URL | string) {
		super();
		this.ws = new WebSocket(url);
		this.ws.addEventListener("message", (evt) => {
			this.onMessage(evt.data)
				.catch((err: unknown) => { logger.error("Failed to handle message", err); });
		});
		this.ws.addEventListener("error", () => {
			logger.error(`Websocket disconnected from ${this.getUrl()} due to an error.`);
			this.onClosed();
		});
		this.ws.addEventListener("open", () => {
			logger.debug(`Websocket connected to ${this.getUrl()}`);
			this.onOpen();
		});
		this.ws.addEventListener("close", () => {
			logger.debug(`Websocket disconnected from ${this.getUrl()}`);
			this.onClosed();
		});
	}

	public close() {
		this.ws.close();
	}

	private onOpen() {
		this.dispatchEvent(new TypedEvent("open"));
	}

	private onClosed() {
		this.dispatchEvent(new TypedEvent("closed"));
	}

	public send(body: MessageBody): void {
		logger.debug(`Sending message: ${JSON.stringify(body)}`);
		try {
			this.ws.send(this.encodeMessage(body));
		} catch (e) {
			logger.error(`Failed to send message`, e);
		}
	}

	public getUrl(): string {
		return this.ws.url;
	}

	private async onMessage(data: unknown) {
		try {
			let dataBuffer;
			if (data instanceof Uint8Array) {
				dataBuffer = data;
			} else if (data instanceof Blob) {
				dataBuffer = new Uint8Array(await data.arrayBuffer());
			} else {
				logger.error(`Received data of unexpected type ${data?.constructor?.name ?? typeof data}`);
				return;
			}

			const message = this.decodeMessage(dataBuffer);
			this.dispatchEvent(new MessageEvent(message));
		} catch (e) {
			logger.error(`Failed to decode received message`, e);
		}
	}

	private encodeMessage(body: MessageBody): Uint8Array {
		const message: Message = {
			t: Date.now(),
			...body,
		};
		return msgpack.encode(message);
	}

	private decodeMessage(data: Uint8Array): Message {
		const decoded = msgpack.decode(data);
		const message = MessageSchema.parse(decoded);
		return message;
	}
}
