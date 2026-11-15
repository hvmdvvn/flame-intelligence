"""Pydantic contracts shared by routes and tests."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

AnswerMode = Literal["grounded", "extractive", "insufficient", "passages_only"]
Grade = Literal["reported", "interpretation", "insufficient"]
Comparability = Literal["comparable", "comparable_with_caveat", "not_comparable"]


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    paper_id: str | None = None
    max_passages: int = Field(default=5, ge=1, le=8)


class CompareIn(BaseModel):
    left_study_id: str = Field(min_length=3)
    right_study_id: str = Field(min_length=3)
    measurement_family: str | None = None


class ReportedClaim(BaseModel):
    claim_id: str
    text: str
    chunk_id: str
    paper_id: str
    title: str
    page_number: int
    official_url: str
    quote: str
    evidence_class: Literal["documented_conclusion"] = "documented_conclusion"


class Interpretation(BaseModel):
    claim_id: str
    text: str
    based_on_claim_ids: list[str]
    evidence_class: Literal["hypothesis_or_interpretation"] = "hypothesis_or_interpretation"


class Passage(BaseModel):
    chunk_id: str
    paper_id: str
    title: str
    page_number: int
    official_url: str
    text: str
    rank: int


class AskOut(BaseModel):
    request_id: str
    corpus_version: str
    answer_mode: AnswerMode
    grade: Grade
    question: str
    reported: list[ReportedClaim]
    interpretation: list[Interpretation]
    passages: list[Passage]
    insufficient_reason: str | None
    notice: str | None
    retrieval: str
    method_version: str = "extractive-rag-2.0.0"
    model: str | None = None
    limitations: list[str] = Field(default_factory=lambda: ["Quoted publication text is not independently validated experimental data.", "Lexical retrieval may miss relevant evidence and does not resolve contradictions."])


class Reason(BaseModel):
    code: str
    message: str


class ChartPoint(BaseModel):
    study_id: str
    label: str
    value: float
    unit: str
    uncertainty: str | None
    page_number: int | None
    provenance: str


class CompareOut(BaseModel):
    corpus_version: str
    comparability: Comparability
    chart_allowed: bool
    matched_measurement_family: str | None
    reasons: list[Reason]
    caveats: list[Reason]
    missing_fields: list[str]
    left: dict
    right: dict
    left_fingerprint: dict
    right_fingerprint: dict
    points: list[ChartPoint]
