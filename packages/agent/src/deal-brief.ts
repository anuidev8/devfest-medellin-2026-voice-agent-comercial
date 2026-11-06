/**
 * The Deal Brief: one record of the sale, filled by the live conversation or by
 * a meeting transcript. Fit rules live in code so the route is predictable.
 */
export type DealBrief = {
  trigger: string;
  currentState: string;
  cost: string;
  tried: string;
  scope: string;
  targetResult: string;
  budget: string;
  timing: string;
  decisionMaker: string;
};

/** meeting: book a call · email: send the proposal · nurture: free resource or event. */
export type FitRoute = "meeting" | "email" | "nurture";
export type Fit = { route: FitRoute; reasons: string[] };

const NO_BUDGET = /(sin presupuesto|no tengo presupuesto|no hay presupuesto|no tenemos presupuesto|cero presupuesto|\bgratis\b)/i;
const NOT_SOON = /(sin prisa|no hay prisa|no tengo prisa|m[aá]s adelante|alg[uú]n d[ií]a|el pr[oó]ximo a[nñ]o|sin fecha)/i;
const UNKNOWN = /^(no s[eé]|por confirmar|n\/a|ninguno)?\.?$/i;

const known = (value: string) => !UNKNOWN.test(value.trim());

/** BANT, because NoShy's deals are small and simple. */
export function assessFit(brief: DealBrief): Fit {
  if (!known(brief.currentState) || !known(brief.targetResult)) {
    return { route: "nurture", reasons: ["Aún no hay un problema y un resultado claros"] };
  }
  if (NO_BUDGET.test(brief.budget)) return { route: "nurture", reasons: ["Sin presupuesto por ahora"] };

  const reasons: string[] = [];
  if (!known(brief.budget)) reasons.push("Falta presupuesto");
  if (!known(brief.decisionMaker)) reasons.push("Falta saber quién decide");
  if (!known(brief.timing) || NOT_SOON.test(brief.timing)) reasons.push("Sin fecha cercana");
  return reasons.length ? { route: "email", reasons } : { route: "meeting", reasons: ["Necesidad, presupuesto, plazo y decisor claros"] };
}

/** One text the brain, the seller and the deal record can all read. */
export function briefSummary(brief: DealBrief): string {
  const rows: [string, string][] = [
    ["Por qué ahora", brief.trigger],
    ["Situación", brief.currentState],
    ["Costo de no actuar", brief.cost],
    ["Ya probó", brief.tried],
    ["Alcance", brief.scope],
    ["Resultado buscado", brief.targetResult],
    ["Presupuesto", brief.budget],
    ["Plazo", brief.timing],
    ["Decide", brief.decisionMaker],
  ];
  return rows
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value.trim().replace(/\.+$/, "")}`)
    .join(". ");
}
