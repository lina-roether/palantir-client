import { RoomConnectionStatus } from "palantir-client";
import z from "zod";

export const OptionsChangedMessageSchema = z.object({
	type: z.literal("options_changed")
});

export const CreateRoomMessageSchema = z.object({
	type: z.literal("create_room"),
	name: z.string(),
	password: z.string()
});

export const JoinRoomMessageSchema = z.object({
	type: z.literal("join_room"),
	id: z.string(),
	password: z.string()
});

export const LeaveRoomMessageSchema = z.object({
	type: z.literal("leave_room")
});

export const GetSessionStateMessageSchema = z.object({
	type: z.literal("get_session_state")
});

export const SessionStateMessageSchema = z.object({
	type: z.literal("session_state"),
	roomConnectionStatus: z.nativeEnum(RoomConnectionStatus),
	roomPermissions: z.object({
		role: z.enum(["host", "guest", "spectator"]),
		permissions: z.object({
			can_host: z.boolean(),
			can_close: z.boolean(),
			can_set_roles: z.boolean(),
			can_kick: z.boolean()
		})
	}).optional(),
	roomData: z.object({
		id: z.string(),
		name: z.string(),
		password: z.string(),
		users: z.array(z.object({
			id: z.string(),
			name: z.string(),
			role: z.enum(["host", "guest"])
		}))
	}).optional()
});

export const SessionErrorMessageSchema = z.object({
	type: z.literal("session_error"),
	message: z.string()
});

export const SessionInfoMessageSchema = z.object({
	type: z.literal("session_info"),
	message: z.string()
});

export const MessageSchema = z.discriminatedUnion("type", [
	OptionsChangedMessageSchema,
	CreateRoomMessageSchema,
	JoinRoomMessageSchema,
	LeaveRoomMessageSchema,
	GetSessionStateMessageSchema,
	SessionStateMessageSchema,
	SessionErrorMessageSchema,
	SessionInfoMessageSchema
]);

export type Message = z.infer<typeof MessageSchema>;
