import { authRouter } from "./routers/auth";
import { gameRouter } from "./routers/game";
import { socialRouter } from "./routers/social";
import { statsRouter } from "./routers/stats";
import { router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  game: gameRouter,
  social: socialRouter,
  stats: statsRouter
});
export type AppRouter = typeof appRouter;
