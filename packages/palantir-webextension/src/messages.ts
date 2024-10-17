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

export const SessionStateMessageSchema = z.object({
	type: z.literal("session_state"),
	inRoom: z.boolean(),
	userRole: z.enum(["host", "guest"]).optional(),
	roomData: z.object({
		id: z.string(),
		name: z.string(),
		password: z.string(),
		users: z.array(z.object({
			id: z.string(),
			name: z.string(),
			role: z.enum(["host", "guest"])
		}))
	})
});

export const SessionErrorMessageSchema = z.object({
	type: z.literal("session_error"),
	message: z.string()
})

export const MessageSchema = z.discriminatedUnion("type", [
	OptionsChangedMessageSchema,
	CreateRoomMessageSchema,
	JoinRoomMessageSchema,
	LeaveRoomMessageSchema,
	SessionStateMessageSchema,
	SessionErrorMessageSchema
]);

export type Message = z.infer<typeof MessageSchema>;
