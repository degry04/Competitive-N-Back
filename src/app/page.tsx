import { BrainCircuit, Timer, Users } from "lucide-react";
import GameClient from "./game-client";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>N-back Arena</h1>
          <p>Соревновательный тренажер рабочей памяти для 2-4 игроков</p>
        </div>
        <div className="metrics">
          <span>
            <BrainCircuit size={18} /> Серверная последовательность
          </span>
          <span>
            <Users size={18} /> 2-4 игрока
          </span>
          <span>
            <Timer size={18} /> Ошибки ускоряют всех
          </span>
        </div>
      </header>
      <GameClient />
    </main>
  );
}
