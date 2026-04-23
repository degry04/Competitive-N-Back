"use client";

import { ArrowLeft, History, Trophy } from "lucide-react";
import Link from "next/link";
import { createAuthClient } from "better-auth/react";
import { trpc } from "@/trpc/client";
import { TournamentTable } from "../game-client";

const authClient = createAuthClient();

export default function HistoryClient() {
  const { data: session } = authClient.useSession();
  const myHistory = trpc.game.myHistory.useQuery(undefined, {
    enabled: Boolean(session),
    refetchInterval: 2500
  });
  const tournaments = trpc.game.tournaments.useQuery(undefined, {
    enabled: Boolean(session),
    refetchInterval: 2500
  });

  if (!session) {
    return (
      <main className="shell">
        <section className="history-panel standalone-panel">
          <div className="history-head">
            <h1>История игр</h1>
            <Link className="secondary link-button" href="/">
              <ArrowLeft size={18} /> Назад
            </Link>
          </div>
          <p className="notice">Войдите в аккаунт, чтобы увидеть личную историю игр.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="history-panel standalone-panel">
        <div className="history-head">
          <div className="panel-title">
            <History size={22} />
            <h1>История игр</h1>
          </div>
          <Link className="secondary link-button" href="/">
            <ArrowLeft size={18} /> В лобби
          </Link>
        </div>

        <div className="history-panel">
          <h2>Мои игры</h2>
          {myHistory.data?.length ? (
            myHistory.data.map((round) => <TournamentTable key={round.id} round={round} currentUserId={session.user.id} />)
          ) : (
            <p className="notice">У вас пока нет завершенных игр.</p>
          )}
        </div>

        <div className="history-panel">
          <div className="panel-title">
            <Trophy size={18} />
            <h2>Все завершенные турниры</h2>
          </div>
          {tournaments.data?.length ? (
            tournaments.data.map((round) => <TournamentTable key={round.id} round={round} currentUserId={session.user.id} />)
          ) : (
            <p className="notice">Завершенных турниров пока нет.</p>
          )}
        </div>
      </section>
    </main>
  );
}
