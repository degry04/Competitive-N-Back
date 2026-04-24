import { TRPCError } from "@trpc/server";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { chatMembers, chatMessages, chatRooms, friendships, user } from "@/server/db/schema";
import { protectedProcedure, router } from "../trpc";

const GLOBAL_ROOM_ID = "global";

export const socialRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image
      })
      .from(user)
      .where(eq(user.id, ctx.session.user.id))
      .limit(1);

    if (!profile) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Профиль не найден." });
    }

    return profile;
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        image: z.string().trim().max(500).optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const image = input.image?.trim() || null;
      await db.update(user).set({ image, updatedAt: new Date() }).where(eq(user.id, ctx.session.user.id));
      return { image };
    }),

  rooms: protectedProcedure.query(async ({ ctx }) => {
    await ensureGlobalRoom();

    const memberships = await db
      .select({
        roomId: chatRooms.id,
        name: chatRooms.name,
        type: chatRooms.type,
        joinedAt: chatMembers.joinedAt
      })
      .from(chatMembers)
      .innerJoin(chatRooms, eq(chatRooms.id, chatMembers.roomId))
      .where(eq(chatMembers.userId, ctx.session.user.id))
      .orderBy(desc(chatMembers.joinedAt));

    const joinedIds = new Set(memberships.map((room) => room.roomId));
    const allRooms = await db
      .select({
        roomId: chatRooms.id,
        name: chatRooms.name,
        type: chatRooms.type
      })
      .from(chatRooms)
      .where(ne(chatRooms.type, "direct"))
      .orderBy(chatRooms.name);

    return {
      joined: memberships.map((room) => ({ ...room, joined: true })),
      available: allRooms.filter((room) => !joinedIds.has(room.roomId)).map((room) => ({ ...room, joined: false }))
    };
  }),

  createRoom: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(40) }))
    .mutation(async ({ ctx, input }) => {
      const roomId = randomUUID();
      const now = new Date();

      await db.insert(chatRooms).values({
        id: roomId,
        name: input.name.trim(),
        type: "room",
        ownerId: ctx.session.user.id,
        createdAt: now
      });
      await addMember(roomId, ctx.session.user.id, now);

      return { roomId };
    }),

  joinRoom: protectedProcedure.input(z.object({ roomId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await ensureGlobalRoom();
    const room = await getRoom(input.roomId);
    if (room.type === "direct") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "В приватную комнату можно войти только через список друзей." });
    }

    await addMember(room.id, ctx.session.user.id);
    return { roomId: room.id };
  }),

  leaveRoom: protectedProcedure.input(z.object({ roomId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await db.delete(chatMembers).where(and(eq(chatMembers.roomId, input.roomId), eq(chatMembers.userId, ctx.session.user.id)));
    return { roomId: input.roomId };
  }),

  messages: protectedProcedure.input(z.object({ roomId: z.string().min(1) })).query(async ({ ctx, input }) => {
    await assertMember(input.roomId, ctx.session.user.id);

    const messages = await db
      .select({
        id: chatMessages.id,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        userId: user.id,
        authorName: user.name,
        authorImage: user.image
      })
      .from(chatMessages)
      .innerJoin(user, eq(user.id, chatMessages.userId))
      .where(eq(chatMessages.roomId, input.roomId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);

    return messages.reverse().map((message) => ({
      ...message,
      mine: message.userId === ctx.session.user.id,
      createdAt: message.createdAt.toISOString()
    }));
  }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        body: z.string().trim().min(1).max(500)
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(input.roomId, ctx.session.user.id);

      await db.insert(chatMessages).values({
        id: randomUUID(),
        roomId: input.roomId,
        userId: ctx.session.user.id,
        body: input.body.trim(),
        createdAt: new Date()
      });

      return { ok: true };
    }),

  friends: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: friendships.id,
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
        requesterName: user.name,
        requesterEmail: user.email,
        requesterImage: user.image
      })
      .from(friendships)
      .innerJoin(user, eq(user.id, friendships.requesterId))
      .where(and(eq(friendships.addresseeId, ctx.session.user.id), eq(friendships.status, "accepted")));

    const reverseRows = await db
      .select({
        id: friendships.id,
        addresseeId: friendships.addresseeId,
        addresseeName: user.name,
        addresseeEmail: user.email,
        addresseeImage: user.image
      })
      .from(friendships)
      .innerJoin(user, eq(user.id, friendships.addresseeId))
      .where(and(eq(friendships.requesterId, ctx.session.user.id), eq(friendships.status, "accepted")));

    return [
      ...rows.map((entry) => ({
        id: entry.id,
        friendId: entry.requesterId,
        name: entry.requesterName,
        email: entry.requesterEmail,
        image: entry.requesterImage
      })),
      ...reverseRows.map((entry) => ({
        id: entry.id,
        friendId: entry.addresseeId,
        name: entry.addresseeName,
        email: entry.addresseeEmail,
        image: entry.addresseeImage
      }))
    ].sort((a, b) => a.name.localeCompare(b.name));
  }),

  addFriend: protectedProcedure.input(z.object({ identifier: z.string().trim().min(1).max(120) })).mutation(async ({ ctx, input }) => {
    const identifier = input.identifier.trim();
    const [target] = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(identifier.includes("@") ? eq(user.email, identifier) : eq(user.name, identifier))
      .limit(1);

    if (!target) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Пользователь не найден." });
    }
    if (target.id === ctx.session.user.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя добавить самого себя." });
    }

    const [existing] = await db
      .select({ id: friendships.id })
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, ctx.session.user.id), eq(friendships.addresseeId, target.id)),
          and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, ctx.session.user.id))
        )
      )
      .limit(1);

    if (existing) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Заявка уже отправлена или пользователь уже в друзьях." });
    }

    await db.insert(friendships).values({
      id: randomUUID(),
      requesterId: ctx.session.user.id,
      addresseeId: target.id,
      status: "pending",
      createdAt: new Date()
    });

    return { friendId: target.id };
  }),

  friendRequests: protectedProcedure.query(async ({ ctx }) => {
    const incoming = await db
      .select({
        id: friendships.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: friendships.createdAt
      })
      .from(friendships)
      .innerJoin(user, eq(user.id, friendships.requesterId))
      .where(and(eq(friendships.addresseeId, ctx.session.user.id), eq(friendships.status, "pending")))
      .orderBy(desc(friendships.createdAt));

    const outgoing = await db
      .select({
        id: friendships.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        createdAt: friendships.createdAt
      })
      .from(friendships)
      .innerJoin(user, eq(user.id, friendships.addresseeId))
      .where(and(eq(friendships.requesterId, ctx.session.user.id), eq(friendships.status, "pending")))
      .orderBy(desc(friendships.createdAt));

    return {
      incoming: incoming.map((request) => ({ ...request, createdAt: request.createdAt.toISOString() })),
      outgoing: outgoing.map((request) => ({ ...request, createdAt: request.createdAt.toISOString() }))
    };
  }),

  acceptFriend: protectedProcedure.input(z.object({ requestId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const [request] = await db
      .select({ id: friendships.id, requesterId: friendships.requesterId })
      .from(friendships)
      .where(and(eq(friendships.id, input.requestId), eq(friendships.addresseeId, ctx.session.user.id), eq(friendships.status, "pending")))
      .limit(1);

    if (!request) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Заявка не найдена." });
    }

    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, request.id));
    return { friendId: request.requesterId };
  }),

  rejectFriend: protectedProcedure.input(z.object({ requestId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await db
      .delete(friendships)
      .where(and(eq(friendships.id, input.requestId), eq(friendships.addresseeId, ctx.session.user.id), eq(friendships.status, "pending")));

    return { requestId: input.requestId };
  }),

  cancelFriendRequest: protectedProcedure.input(z.object({ requestId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await db
      .delete(friendships)
      .where(and(eq(friendships.id, input.requestId), eq(friendships.requesterId, ctx.session.user.id), eq(friendships.status, "pending")));

    return { requestId: input.requestId };
  }),

  removeFriend: protectedProcedure.input(z.object({ friendId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await db
      .delete(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, ctx.session.user.id), eq(friendships.addresseeId, input.friendId)),
          and(eq(friendships.requesterId, input.friendId), eq(friendships.addresseeId, ctx.session.user.id))
        )
      );

    return { friendId: input.friendId };
  }),

  openDirectRoom: protectedProcedure.input(z.object({ friendId: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    await assertFriend(ctx.session.user.id, input.friendId);

    const directRoomId = getDirectRoomId(ctx.session.user.id, input.friendId);
    const [existing] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.id, directRoomId)).limit(1);
    const now = new Date();

    if (!existing) {
      await db.insert(chatRooms).values({
        id: directRoomId,
        name: "Личные сообщения",
        type: "direct",
        ownerId: ctx.session.user.id,
        createdAt: now
      });
    }

    await addMember(directRoomId, ctx.session.user.id, now);
    await addMember(directRoomId, input.friendId, now);
    return { roomId: directRoomId };
  })
});

async function ensureGlobalRoom() {
  const [existing] = await db.select({ id: chatRooms.id }).from(chatRooms).where(eq(chatRooms.id, GLOBAL_ROOM_ID)).limit(1);
  if (!existing) {
    await db.insert(chatRooms).values({
      id: GLOBAL_ROOM_ID,
      name: "Общий чат",
      type: "global",
      ownerId: null,
      createdAt: new Date()
    });
  }
}

async function getRoom(roomId: string) {
  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.id, roomId)).limit(1);
  if (!room) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Комната не найдена." });
  }
  return room;
}

async function addMember(roomId: string, userId: string, joinedAt = new Date()) {
  const [existing] = await db
    .select({ id: chatMembers.id })
    .from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)))
    .limit(1);

  if (!existing) {
    await db.insert(chatMembers).values({
      id: `${roomId}:${userId}`,
      roomId,
      userId,
      joinedAt
    });
  }
}

async function assertMember(roomId: string, userId: string) {
  const [member] = await db
    .select({ id: chatMembers.id })
    .from(chatMembers)
    .where(and(eq(chatMembers.roomId, roomId), eq(chatMembers.userId, userId)))
    .limit(1);

  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Сначала войдите в эту комнату." });
  }
}

async function assertFriend(userId: string, friendId: string) {
  const [friendship] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId), eq(friendships.status, "accepted")),
        and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId), eq(friendships.status, "accepted"))
      )
    )
    .limit(1);

  if (!friendship) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Сначала добавьте пользователя в друзья." });
  }
}

function getDirectRoomId(left: string, right: string) {
  return `direct:${[left, right].sort().join(":")}`;
}
