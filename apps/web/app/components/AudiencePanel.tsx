"use client";

import { useEffect, useState } from "react";
import { useConcierge } from "./concierge";

type Summary = { total: number; persona: [string, number][]; product: [string, number][]; objection: [string, number][] };

const GROUP_LABEL = { persona: "Quiénes son", product: "Qué buscan", objection: "Objeción" } as const;

export function AudiencePanel() {
  const { send } = useConcierge();
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/audience").then((r) => r.json()).then(setData).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  const inject = () => {
    if (!data?.total) return;
    const top = (arr: [string, number][]) => arr[0]?.[0] ?? "—";
    void send(
      `Contexto del público: somos un equipo (${top(data.persona)}), buscamos ${top(data.product)} y nuestra objeción principal es "${top(data.objection)}". Recomiéndanos un plan y responde a la objeción.`,
    );
  };

  return (
    <section className="tile p-5" aria-label="Público en vivo">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg">Público en vivo</h2>
        <span className="pill h-7 text-xs tabular-nums">{data?.total ?? 0} votos</span>
      </div>
      {!data?.total ? (
        <p className="mt-3 text-sm text-muted">
          Sin votos aún. Comparte{" "}
          <a href="/audience" target="_blank" className="text-signal underline underline-offset-2">
            /audience
          </a>{" "}
          con un QR.
        </p>
      ) : (
        <>
          {(["persona", "product", "objection"] as const).map((key) => (
            <div key={key} className="mt-4">
              <p className="eyebrow">{GROUP_LABEL[key]}</p>
              <div className="mt-1.5 grid gap-1.5">
                {data[key].map(([label, count]) => {
                  const pct = Math.round((count / data.total) * 100);
                  return (
                    <div key={label} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm">
                      <span className="truncate">{label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-raise">
                        <span className="block h-full rounded-full bg-signal transition-[width] duration-[900ms]" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-right font-mono text-xs text-muted tabular-nums">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={inject} className="btn btn-primary mt-5 w-full">
            Enviar al agente
          </button>
          <a href="/audience" target="_blank" className="mt-2 block text-center text-xs text-muted underline underline-offset-2 hover:text-text">
            Abrir /audience (QR)
          </a>
        </>
      )}
    </section>
  );
}
