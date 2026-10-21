"use client";

import { useEffect, useState } from "react";

interface Day {
  date: string;
  precipitation: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shade(mm: number): string {
  if (mm < 0.1) return "rgba(56, 45, 73, 0.07)";
  if (mm < 1) return "rgba(76, 127, 230, 0.22)";
  if (mm < 5) return "rgba(76, 127, 230, 0.5)";
  if (mm < 10) return "rgba(58, 92, 186, 0.8)";
  return "#382d49";
}

export function RainHeatmap() {
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history", { cache: "no-store" })
      .then((res) => res.json())
      .then((body: { days?: Day[] }) => {
        if (!cancelled) setDays(body.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!days || days.length === 0) return null;

  // Weeks as columns (Mon-first), days as rows.
  const first = new Date(`${days[0].date}T00:00:00`);
  const offset = (first.getDay() + 6) % 7;
  const cells: (Day | null)[] = [...Array<null>(offset).fill(null), ...days];
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const rainy = days.filter((d) => d.precipitation >= 1);
  const perMonth = Array<number>(12).fill(0);
  rainy.forEach((d) => {
    perMonth[Number(d.date.slice(5, 7)) - 1] += 1;
  });
  const peak = Math.max(...perMonth, 1);
  const wettest = MONTHS[perMonth.indexOf(Math.max(...perMonth))];

  return (
    <section className="ops-card p-6 md:p-8">
      <p className="kicker">Rain history</p>
      <h2 className="mt-2 text-2xl">A year of rain in Puno</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/75">
        Each square is one day of the last {days.length}. Darker means more precipitation. The model learns
        from this pattern: {rainy.length} rainy days (1.0 mm or more), most of them in {wettest}.
      </p>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="flex gap-[3px]" role="img" aria-label="Daily precipitation heat map for the last year">
          {weeks.map((week, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {week.map((day, d) =>
                day ? (
                  <span
                    key={day.date}
                    title={`${day.date}: ${day.precipitation.toFixed(1)} mm`}
                    className={`heat-cell h-3 w-3 rounded-[3px]${day.precipitation >= 1 ? " heat-cell-wet" : ""}`}
                    style={{ background: shade(day.precipitation), ["--heat-delay" as string]: `${Math.min(w, 52) * 18}ms` }}
                  />
                ) : (
                  <span key={d} className="h-3 w-3" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink/60">
        <span>Dry</span>
        {[0, 0.5, 3, 7, 12].map((v) => (
          <span key={v} className="h-3 w-3 rounded-[3px]" style={{ background: shade(v) }} />
        ))}
        <span>Heavy rain</span>
      </div>

      <h3 className="mt-8 text-lg">Rainy days by month</h3>
      <div className="mt-4 flex h-28 items-end gap-2">
        {perMonth.map((count, i) => (
          <div key={MONTHS[i]} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="month-bar w-full rounded-t-md bg-lake/70"
              style={{
                height: `${Math.max((count / peak) * 88, count > 0 ? 6 : 2)}px`,
                opacity: count > 0 ? 1 : 0.3,
                animationDelay: `${i * 55}ms`,
              }}
              title={`${MONTHS[i]}: ${count} rainy days`}
            />
            <span className="text-[11px] text-ink/60">{MONTHS[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
