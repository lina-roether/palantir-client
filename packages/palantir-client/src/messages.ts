import * as z from "zod";
import * as msgpack from "@msgpack/msgpack";
import { TypedEvent, TypedEventTarget } from "./utils";
import { baseLogger } from "./logger";

const logger = baseLogger.sub("messages");

const ConnectionLoginMsgBodySchema = z.object({
	username: z.string(),
	api_key: z.string().optional(),
});

export type ConnectionLoginMsgBody = z.infer<typeof ConnectionLoginMsgBodySchema>;

const ConnectionClientErrorMsgBodySchema = z.object({
	message: z.string(),
});
export type ConnectionClientErrorMsgBody = z.infer<typeof ConnectionClientErrorMsgBodySchema>;

const ConnectionClosedReasonSchema = z.enum([
	"unauthorized",
	"server_error",
	"room_closed",
	"timeout",
	"unknown",
]);
export type ConnectionClosedReason = z.infer<typeof ConnectionClosedReasonSchema>;

const ConnectionClosedMsgBodySchema = z.object({
	reason: ConnectionClosedReasonSchema,
	message: z.string(),
});
export type ConnectionClosedMsgBody = z.infer<typeof ConnectionClosedMsgBodySchema>;

const RoomCreateMsgBodySchema = z.object({
	name: z.string(),
	password: z.string(),
});
export type RoomCreateMsgBody = z.infer<typeof RoomCreateMsgBodySchema>;

const RoomJoinMsgBodySchema = z.object({
	id: z.instanceof(Uint8Array),
	password: z.string(),
});
export type RoomJoinMsgBody = z.infer<typeof RoomJoinMsgBodySchema>;

const RoomUserRoleSchema = z.enum(["host", "guest"]);
export type RoomUserRole = z.infer<typeof RoomUserRoleSchema>;

const RoomUserSchema = z.object({
	id: z.instanceof(Uint8Array),
	name: z.string(),
	role: RoomUserRoleSchema,
});
export type RoomUser = z.infer<typeof RoomUserSchema>;

const RoomStateMsgBodySchema = z.object({
	id: z.instanceof(Uint8Array),
	name: z.string(),
	password: z.string(),
	users: z.array(RoomUserSchema),
});
export type RoomStateMsgBody = z.infer<typeof RoomStateMsgBodySchema>;

const RoomDisconnectedReason = z.enum(["closed_by_host", "unauthorized", "server_error"]);
export type RoomDisconnected = z.infer<typeof RoomDisconnectedReason>;

const RoomDisconnectedMsgBodySchema = z.object({
	reason: RoomDisconnectedReason,
});
export type RoomDisconnectedMsgBody = z.infer<typeof RoomDisconnectedMsgBodySchema>;

const EmptyMessageBodySchema = z.object({});

const MessageBodySchema = z.discriminatedUnion("m", [
	ConnectionLoginMsgBodySchema.extend({ m: z.literal("connection::login/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::login_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::ping/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::pong/v1") }),
	ConnectionClientErrorMsgBodySchema.extend({ m: z.literal("connection::client_error/v1") }),
	ConnectionClosedMsgBodySchema.extend({ m: z.literal("connection::closed/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("connection::keepalive/v1") }),
	RoomCreateMsgBodySchema.extend({ m: z.literal("room::create/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::create_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::close/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::close_ack/v1") }),
	RoomJoinMsgBodySchema.extend({ m: z.literal("room::join/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::join_ack/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::leave/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::leave_ack/v1") }),
	RoomDisconnectedMsgBodySchema.extend({ m: z.literal("room::disconnected/v1") }),
	EmptyMessageBodySchema.extend({ m: z.literal("room::request_state/v1") }),
	RoomStateMsgBodySchema.extend({ m: z.literal("room::state/v1") }),
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
			void this.onMessage(evt.data);
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
			logger.error(`Failed to send message: ${e?.toString() ?? "unknown error"}`);
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
			logger.error(`Failed to decode received message: ${e?.toString() ?? "unknown error"}`);
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
