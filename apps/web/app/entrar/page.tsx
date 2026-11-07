"use client";

import { FormEvent, useEffect, useState } from "react";

export default function EntrarPage() {
  const [email, setEmail] = useState("devfest@noshy.dev");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [beat, setBeat] = useState<"hi" | "event" | "form">("hi");

  useEffect(() => {
    const event = window.setTimeout(() => setBeat("event"), 1800);
    const form = window.setTimeout(() => setBeat("form"), 4200);
    return () => {
      window.clearTimeout(event);
      window.clearTimeout(form);
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "No pude dejarte entrar.");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("No pude dejarte entrar.");
    } finally {
      setBusy(false);
    }
  }

  if (beat !== "form") {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center text-text" onClick={() => setBeat("form")}>
        <h1 className={beat === "hi" ? "text-[clamp(52px,12vw,140px)] leading-[0.95] font-medium tracking-[-0.05em]" : "whitespace-nowrap text-[clamp(17px,3.5vw,56px)] leading-none font-medium tracking-[-0.04em]"}>
          {beat === "hi" ? "Bienvenidos" : "DevFest Medellín 2026 · GDG"}
        </h1>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 text-text">
      <form onSubmit={onSubmit} className="tile w-full max-w-md p-8">
        <p className="eyebrow">NoShy</p>
        <h1 className="mt-2 text-3xl tracking-[-0.03em]">Entra al concierge</h1>
        <p className="mt-2 text-sm text-muted">Tu correo queda listo para la propuesta. La contraseña es la del equipo.</p>

        <label className="mt-8 block text-sm" htmlFor="gate-email">
          Correo
          <input
            id="gate-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            className="mt-2 w-full rounded-2xl bg-raise px-4 py-3 text-base text-text outline-none placeholder:text-muted/60 focus:shadow-[inset_0_0_0_2px_var(--signal)]"
          />
        </label>

        <label className="mt-4 block text-sm" htmlFor="gate-password">
          Contraseña
          <input
            id="gate-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-2xl bg-raise px-4 py-3 text-base text-text outline-none focus:shadow-[inset_0_0_0_2px_var(--signal)]"
          />
        </label>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
