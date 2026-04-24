import { BrainCircuit, Timer, Users } from "lucide-react";
import GameClient from "./game-client";
import ThemeToggle from "./theme-toggle";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Cognitive Arena</h1>
          <p>Соревновательные когнитивные тренажеры для 2-4 игроков</p>
        </div>
        <div className="metrics">
          <span>
            <BrainCircuit size={18} /> Серверная логика
          </span>
          <span>
            <Users size={18} /> 2-4 игрока
          </span>
          <span>
            <Timer size={18} /> Общая скорость раунда
          </span>
        </div>
        <ThemeToggle />
      </header>
      <GameClient />
    </main>
  );
}
