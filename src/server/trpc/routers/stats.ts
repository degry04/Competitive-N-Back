import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { ratingHistory, user } from "@/server/db/schema";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const statsRouter = router({
  getRating: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().optional()
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const targetUserId = input?.userId ?? ctx.session.user.id;
      const [profile] = await db
        .select({
          id: user.id,
          name: user.name,
          rating: user.rating,
          rank: user.rank
        })
        .from(user)
        .where(eq(user.id, targetUserId))
        .limit(1);

      if (!profile) {
        throw new Error("Пользователь не найден.");
      }

      const history = await db
        .select({
          id: ratingHistory.id,
          roundId: ratingHistory.roundId,
          oldRating: ratingHistory.oldRating,
          newRating: ratingHistory.newRating,
          change: ratingHistory.change,
          createdAt: ratingHistory.createdAt
        })
        .from(ratingHistory)
        .where(eq(ratingHistory.userId, targetUserId))
        .orderBy(desc(ratingHistory.createdAt))
        .limit(20);

      return {
        ...profile,
        history: history.map((entry) => ({
          ...entry,
          createdAt: entry.createdAt.toISOString()
        }))
      };
    }),

  getLeaderboard: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(20)
        })
        .optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 20;
      const leaderboard = await db
        .select({
          id: user.id,
          name: user.name,
          rating: user.rating,
          rank: user.rank
        })
        .from(user)
        .orderBy(desc(user.rating), user.name)
        .limit(limit);

      return leaderboard.map((entry, index) => ({
        place: index + 1,
        ...entry
      }));
    })
});
