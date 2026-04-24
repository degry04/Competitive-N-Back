import { authRouter } from "./routers/auth";
import { gameRouter } from "./routers/game";
import { statsRouter } from "./routers/stats";
import { router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  game: gameRouter,
  stats: statsRouter
});
export type AppRouter = typeof appRouter;
