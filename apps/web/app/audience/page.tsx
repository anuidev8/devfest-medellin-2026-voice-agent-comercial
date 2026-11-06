"use client";

import { useState } from "react";
import { VoiceOrb } from "../components/VoiceOrb";

const PERSONAS = [
  { id: "individual (1-5)", label: "Individual / equipo pequeño (1–5)" },
  { id: "equipo (6-25)", label: "Equipo (6–25)" },
  { id: "empresa (26+)", label: "Empresa (26+)" },
];
const PRODUCTS = [
  { id: "automatización de soporte", label: "Automatización de soporte" },
  { id: "CRM / ventas", label: "CRM / ventas" },
  { id: "workflows internos", label: "Workflows internos" },
];
const OBJECTIONS = ["es costoso", "no tenemos tiempo", "ya usamos otra herramienta", "seguridad / compliance"];

function Group({ step, title, options, value, set }: { step: number; title: string; options: { id: string; label: string }[] | string[]; value: string; set: (v: string) => void }) {
  return (
    <fieldset className="mt-7">
      <legend className="flex items-baseline gap-2 text-lg font-medium tracking-[-0.01em]">
        <span className="text-xs text-muted tabular-nums">{step}/3</span>
        {title}
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map((o) => {
          const id = typeof o === "string" ? o : o.id;
          const label = typeof o === "string" ? o : o.label;
          const on = value === id;
          return (
            <button
              key={id}
              onClick={() => set(id)}
              aria-pressed={on}
              className={`rounded-full px-5 py-3.5 text-left transition-colors duration-[160ms] ${on ? "bg-primary text-primary-ink" : "bg-raise text-text"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function AudiencePage() {
  const [persona, setPersona] = useState("");
  const [product, setProduct] = useState("");
  const [objection, setObjection] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    await fetch("/api/audience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona, product, objection }),
    });
    setSent(true);
  };

  if (sent)
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-5 py-12 text-center">
        <VoiceOrb state="speaking" size={140} />
        <h1 className="mt-8 text-3xl tracking-[-0.03em]">¡Gracias!</h1>
        <p className="mt-2 text-muted">Tu voto ya está en la pantalla del presentador. Mira cómo el agente responde a tu objeción.</p>
        <button onClick={() => setSent(false)} className="btn btn-quiet mt-6">
          Votar de nuevo
        </button>
      </main>
    );

  return (
    <main className="mx-auto max-w-md px-5 py-8">
      <div className="flex items-center gap-4">
        <VoiceOrb state="idle" size={64} />
        <div>
          <h1 className="text-2xl tracking-[-0.03em]">Co-crea la demo</h1>
          <p className="text-sm text-muted">Elige tu escenario y el agente comercial responderá en vivo.</p>
        </div>
      </div>
      <Group step={1} title="¿Quién eres?" options={PERSONAS} value={persona} set={setPersona} />
      <Group step={2} title="¿Qué buscas?" options={PRODUCTS} value={product} set={setProduct} />
      <Group step={3} title="Tu objeción principal" options={OBJECTIONS} value={objection} set={setObjection} />
      <button
        disabled={!persona || !product}
        onClick={submit}
        className="btn btn-blue sticky bottom-4 mt-8 w-full py-4"
      >
        Enviar mi voto
      </button>
    </main>
  );
}
