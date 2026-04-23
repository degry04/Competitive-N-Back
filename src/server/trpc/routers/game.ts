import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  closeGameLobby,
  createGameRound,
  createNextGameRound,
  finishGameRound,
  joinGameRound,
  listActiveRounds,
  listUserGameHistory,
  listTournamentResults,
  startGameRound,
  submitGameResponse
} from "@/server/game/store";
import { protectedProcedure, router } from "../trpc";

function userName(user: { name?: string | null; email?: string | null }) {
  return user.name?.trim() || user.email?.split("@")[0] || "Player";
}

async function unwrapGameAction<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Game action failed."
    });
  }
}

export const gameRouter = router({
  list: protectedProcedure.query(() => listActiveRounds()),

  tournaments: protectedProcedure.query(() => listTournamentResults()),

  myTournaments: protectedProcedure.query(({ ctx }) => listTournamentResults(ctx.session.user.id)),

  myHistory: protectedProcedure.query(({ ctx }) => listUserGameHistory(ctx.session.user.id)),

  create: protectedProcedure
    .input(
      z.object({
        n: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2),
        mode: z.enum(["classic", "recent-5"]).default("classic"),
        tournament: z.boolean().default(false),
        length: z.number().int().min(12).max(120).default(30),
        baseIntervalMs: z.number().int().min(450).max(4000).default(1600),
        botAccuracy: z.number().min(0.1).max(0.99).nullable().default(null)
      })
    )
    .mutation(({ ctx, input }) =>
      unwrapGameAction(() =>
        createGameRound({
          ownerId: ctx.session.user.id,
          ownerName: userName(ctx.session.user),
          ...input
        })
      )
    ),

  join: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => joinGameRound(input.roundId, ctx.session.user.id, userName(ctx.session.user)))
  ),

  start: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => startGameRound(input.roundId, ctx.session.user.id))
  ),

  submit: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => submitGameResponse(input.roundId, ctx.session.user.id))
  ),

  finish: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => finishGameRound(input.roundId, ctx.session.user.id))
  ),

  next: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => createNextGameRound(input.roundId, ctx.session.user.id))
  ),

  close: protectedProcedure.input(z.object({ roundId: z.string().uuid() })).mutation(({ ctx, input }) =>
    unwrapGameAction(() => closeGameLobby(input.roundId, ctx.session.user.id))
  )
});
