import { auth } from "@/server/auth";

export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await auth.api.getSession({
    headers: opts.headers
  });

  return {
    session
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
