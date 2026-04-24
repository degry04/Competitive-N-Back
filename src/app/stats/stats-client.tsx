"use client";

import { ArrowLeft, Shield, Trophy } from "lucide-react";
import Link from "next/link";
import { createAuthClient } from "better-auth/react";
import { trpc } from "@/trpc/client";

const authClient = createAuthClient();

export default function StatsClient() {
  const { data: session } = authClient.useSession();
  const myRating = trpc.stats.getRating.useQuery(undefined, {
    enabled: Boolean(session)
  });
  const leaderboard = trpc.stats.getLeaderboard.useQuery(
    { limit: 10 },
    {
      enabled: true
    }
  );

  if (!session) {
    return (
      <main className="shell">
        <section className="history-panel standalone-panel">
          <div className="history-head">
            <h1>Рейтинг и успехи</h1>
            <Link className="secondary link-button" href="/">
              <ArrowLeft size={18} /> Назад
            </Link>
          </div>
          <p className="notice">Войдите в аккаунт, чтобы увидеть свой ELO, ранг и историю рейтинга.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="history-panel standalone-panel">
        <div className="history-head">
          <div className="panel-title">
            <Shield size={22} />
            <h1>Рейтинг и успехи</h1>
          </div>
          <Link className="secondary link-button" href="/">
            <ArrowLeft size={18} /> В лобби
          </Link>
        </div>

        <div className="history-panel">
          <h2>Мой рейтинг</h2>
          {myRating.data ? (
            <div className="history-block">
              <div className="history-head">
                <strong>{myRating.data.name}</strong>
                <span>
                  {rankLabel(myRating.data.rank)} · {myRating.data.rating} ELO
                </span>
              </div>
              <p className="notice">Рейтинг обновляется только после завершения рейтингового матча.</p>
              <div className="history-table tournament-table">
                <span>Изменение</span>
                <span>Раунд</span>
                <span>Было</span>
                <span>Стало</span>
                <span>Дата</span>
                {myRating.data.history.map((entry) => (
                  <RatingHistoryRow
                    key={entry.id}
                    entry={{
                      change: entry.change,
                      roundId: entry.roundId,
                      oldRating: entry.oldRating,
                      newRating: entry.newRating,
                      createdAt: entry.createdAt
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="notice">Рейтинг пока недоступен.</p>
          )}
        </div>

        <div className="history-panel">
          <div className="panel-title">
            <Trophy size={18} />
            <h2>Таблица лидеров</h2>
          </div>
          {leaderboard.data?.length ? (
            <div className="history-block">
              <div className="history-table tournament-table">
                <span>Место</span>
                <span>Игрок</span>
                <span>ELO</span>
                <span>Ранг</span>
                <span>ID</span>
                {leaderboard.data.map((entry) => (
                  <LeaderboardRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ) : (
            <p className="notice">Таблица лидеров пока пуста.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function RatingHistoryRow({
  entry
}: {
  entry: { change: number; roundId: string; oldRating: number; newRating: number; createdAt: string };
}) {
  return (
    <>
      <span>{entry.change >= 0 ? `+${entry.change}` : entry.change}</span>
      <span>{entry.roundId.slice(0, 8)}</span>
      <span>{entry.oldRating}</span>
      <span>{entry.newRating}</span>
      <span>{new Date(entry.createdAt).toLocaleDateString("ru-RU")}</span>
    </>
  );
}

function LeaderboardRow({
  entry
}: {
  entry: { place: number; id: string; name: string; rating: number; rank: string };
}) {
  return (
    <>
      <span>{entry.place}</span>
      <span>{entry.name}</span>
      <span>{entry.rating}</span>
      <span>{rankLabel(entry.rank)}</span>
      <span>{entry.id.slice(0, 8)}</span>
    </>
  );
}

function rankLabel(rank: string) {
  switch (rank) {
    case "Bronze":
      return "Бронза";
    case "Silver":
      return "Серебро";
    case "Gold":
      return "Золото";
    case "Platinum":
      return "Платина";
    case "Diamond":
      return "Алмаз";
    case "Master":
      return "Мастер";
    default:
      return rank;
  }
}
