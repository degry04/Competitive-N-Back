import { authRouter } from "./routers/auth";
import { gameRouter } from "./routers/game";
import { router } from "./trpc";

export const appRouter = router({
  auth: authRouter,
  game: gameRouter
});
export type AppRouter = typeof appRouter;
