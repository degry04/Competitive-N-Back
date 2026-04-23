import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { publicProcedure, router } from "../trpc";

export const authRouter = router({
  resolveLoginIdentifier: publicProcedure
    .input(z.object({ identifier: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      const identifier = input.identifier.trim();

      if (identifier.includes("@")) {
        return { email: identifier };
      }

      const [matchedUser] = await db.select({ email: user.email }).from(user).where(eq(user.name, identifier)).limit(1);

      return { email: matchedUser?.email ?? identifier };
    })
});
