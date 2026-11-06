"""Slim commercial helpers used by voice tools (no ADK)."""

from __future__ import annotations

import re
from typing import Literal, TypedDict

Track = Literal["builder", "company"]
FitRoute = Literal["meeting", "email", "nurture"]

NO_BUDGET = re.compile(
    r"(sin presupuesto|no tengo presupuesto|no hay presupuesto|no tenemos presupuesto|cero presupuesto|\bgratis\b)",
    re.I,
)
NOT_SOON = re.compile(
    r"(sin prisa|no hay prisa|no tengo prisa|m[aá]s adelante|alg[uú]n d[ií]a|el pr[oó]ximo a[nñ]o|sin fecha)",
    re.I,
)
UNKNOWN = re.compile(r"^(no s[eé]|por confirmar|n/a|ninguno)?\.?$", re.I)

OPEN_QUESTIONS_BUILDER = [
    {"id": "porque_ahora", "label": "Por qué ahora", "question": "¿Qué te hizo buscarnos justo ahora?"},
    {
        "id": "dolor",
        "label": "Dolor principal",
        "question": "¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?",
    },
    {
        "id": "situacion_actual",
        "label": "Qué ha probado",
        "question": "¿Qué has probado y por qué no funcionó del todo?",
    },
    {
        "id": "proyecto",
        "label": "Tu proyecto",
        "question": "¿Qué construyes, para quién, y ya tienes clientes que pagan?",
    },
    {
        "id": "exito",
        "label": "Cómo miden el éxito",
        "question": "¿Qué número o señal te diría que valió la pena?",
    },
    {
        "id": "cierre",
        "label": "Plazo, presupuesto y decisión",
        "question": "¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?",
    },
]

OPEN_QUESTIONS_COMPANY = [
    {"id": "porque_ahora", "label": "Por qué ahora", "question": "¿Qué te hizo buscarnos justo ahora?"},
    {
        "id": "dolor",
        "label": "Dolor principal",
        "question": "¿Qué te frena hoy, y qué te cuesta si sigue igual 3 meses más?",
    },
    {
        "id": "situacion_actual",
        "label": "Qué ha probado",
        "question": "¿Qué has probado y por qué no funcionó del todo?",
    },
    {
        "id": "ayuda",
        "label": "Ayuda que necesitas",
        "question": "¿Qué skills o tipo de ayuda son obligatorios?",
    },
    {
        "id": "exito",
        "label": "Cómo miden el éxito",
        "question": "¿Qué número o señal te diría que valió la pena?",
    },
    {
        "id": "cierre",
        "label": "Plazo, presupuesto y decisión",
        "question": "¿Para cuándo lo necesitas, qué presupuesto tienes en mente y decides tú o alguien más?",
    },
]


class DealBrief(TypedDict):
    trigger: str
    currentState: str
    cost: str
    tried: str
    scope: str
    targetResult: str
    budget: str
    timing: str
    decisionMaker: str


class Fit(TypedDict):
    route: FitRoute
    reasons: list[str]


def _known(value: str) -> bool:
    return not UNKNOWN.match(value.strip() or "")


def infer_track(*, persona: str = "", text: str = "", track: str = "") -> Track:
    if track in ("company", "builder"):
        return track  # type: ignore[return-value]
    p = persona.lower()
    if any(x in p for x in ("company", "empresa", "sponsor", "growth")):
        return "company"
    t = text.lower()
    if re.search(r"(empresa|contrat|talento|freelancer|agencia|sponsor|visibilidad|leads)", t):
        return "company"
    return "builder"


def open_questions(track: Track) -> list[dict[str, str]]:
    return OPEN_QUESTIONS_COMPANY if track == "company" else OPEN_QUESTIONS_BUILDER


def assess_fit(brief: DealBrief) -> Fit:
    if not _known(brief["currentState"]) or not _known(brief["targetResult"]):
        return {"route": "nurture", "reasons": ["Aún no hay un problema y un resultado claros"]}
    if NO_BUDGET.search(brief["budget"]):
        return {"route": "nurture", "reasons": ["Sin presupuesto por ahora"]}

    reasons: list[str] = []
    if not _known(brief["budget"]):
        reasons.append("Falta presupuesto")
    if not _known(brief["decisionMaker"]):
        reasons.append("Falta saber quién decide")
    if not _known(brief["timing"]) or NOT_SOON.search(brief["timing"]):
        reasons.append("Sin fecha cercana")
    if reasons:
        return {"route": "email", "reasons": reasons}
    return {"route": "meeting", "reasons": ["Necesidad, presupuesto, plazo y decisor claros"]}


def brief_summary(brief: DealBrief) -> str:
    rows = [
        ("Por qué ahora", brief["trigger"]),
        ("Situación", brief["currentState"]),
        ("Costo de no actuar", brief["cost"]),
        ("Ya probó", brief["tried"]),
        ("Alcance", brief["scope"]),
        ("Resultado buscado", brief["targetResult"]),
        ("Presupuesto", brief["budget"]),
        ("Plazo", brief["timing"]),
        ("Decide", brief["decisionMaker"]),
    ]
    parts = [
        f"{label}: {value.strip().rstrip('.')}"
        for label, value in rows
        if value.strip()
    ]
    return ". ".join(parts)
