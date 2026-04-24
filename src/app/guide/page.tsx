import { ArrowLeft, ShieldQuestion, Timer, TrafficCone, WholeWord } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export default function GuidePage() {
  return (
    <main className="shell">
      <section className="history-panel standalone-panel">
        <div className="history-head">
          <h1>Руководство по тренажерам</h1>
          <Link className="secondary link-button" href="/">
            <ArrowLeft size={18} /> В лобби
          </Link>
        </div>

        <GuideBlock
          icon={<ShieldQuestion size={20} />}
          title="N-back"
          items={[
            "Нажимайте, если текущая клетка совпадает с клеткой N ходов назад.",
            "В режиме Recent-5 нужно нажать, если клетка уже встречалась среди последних 5 стимулов.",
            "Лишние нажатия дают штраф и могут ускорить игру для всех."
          ]}
        />

        <GuideBlock
          icon={<TrafficCone size={20} />}
          title="Go / No-Go"
          items={[
            "Нажимайте только на стимулы GO.",
            "NO_GO нужно игнорировать: лишний клик считается false positive.",
            "Пропуск GO считается miss и тоже штрафуется."
          ]}
        />

        <GuideBlock
          icon={<Timer size={20} />}
          title="Reaction Time"
          items={[
            "Сначала идет случайная задержка от 1000 до 3000 мс.",
            "После сигнала нужно кликнуть как можно быстрее.",
            "Клик до появления сигнала считается фальстартом и приводит к штрафу.",
            "Очко за стимул получает самый быстрый корректный игрок."
          ]}
        />

        <GuideBlock
          icon={<WholeWord size={20} />}
          title="Stroop Test"
          items={[
            "На экране показывается слово, окрашенное в один из цветов.",
            "Отвечать нужно по цвету текста, а не по самому слову.",
            "На конфликтных стимулах слово и цвет различаются, именно они дают основную когнитивную нагрузку.",
            "Очко получает самый быстрый правильный ответ."
          ]}
        />
      </section>
    </main>
  );
}

function GuideBlock({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <section className="history-block">
      <div className="panel-title">
        {icon}
        <h2>{title}</h2>
      </div>
      <div className="how-to">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
