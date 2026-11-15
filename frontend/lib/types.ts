export type Paper = {
  paper_id: string;
  source: string;
  source_record_id: string;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
  official_url: string;
  pdf_url: string | null;
  pdf_status: string;
  topics: string[];
  extraction_status: string;
  extraction_notes: string;
  synthetic: boolean;
  center: string | null;
  sti_type: string | null;
  page_count?: number;
  study_ids?: string[];
};

export type Stats = {
  corpus_version: string;
  built_at: string | null;
  papers: number;
  papers_with_text: number;
  chunks: number;
  studies: number;
  verified_measurements: number;
  synthetic_papers: number;
  by_source: Record<string, number>;
  by_pdf_status: Record<string, number>;
  by_center: Record<string, number>;
  by_year: { year: number; papers: number }[];
  coverage: { term: string; papers: number }[];
  limitations: string[];
};

export type Claim = {
  claim_id: string;
  text: string;
  chunk_id: string;
  paper_id: string;
  title: string;
  page_number: number;
  official_url: string;
  quote: string;
  evidence_class?: "documented_conclusion";
};

export type AskResponse = {
  request_id: string;
  corpus_version: string;
  answer_mode: "grounded" | "extractive" | "insufficient" | "passages_only";
  grade: string;
  question: string;
  reported: Claim[];
  interpretation: { claim_id: string; text: string; based_on_claim_ids: string[] }[];
  passages: {
    chunk_id: string;
    paper_id: string;
    title: string;
    page_number: number;
    official_url: string;
    text: string;
    rank: number;
  }[];
  insufficient_reason: string | null;
  notice: string | null;
  retrieval: string;
  method_version?: string;
  model?: string | null;
  limitations?: string[];
};

export type Measurement = {
  measurement_id: string;
  study_id: string;
  paper_id: string;
  measurement_as_reported: string;
  measurement_family: string;
  value: number | null;
  unit: string | null;
  uncertainty: string | null;
  verification_status: string;
  provenance: { page_number?: number | null; location?: string };
  synthetic?: boolean;
};

export type Study = {
  study_id: string;
  paper_id: string;
  label: string;
  fuel_as_reported: string | null;
  fuel_family: string;
  gravity_regime: string;
  platform: string;
  oxygen_mole_fraction: number | null;
  oxygen_as_reported: string | null;
  pressure_kpa: number | null;
  pressure_as_reported: string | null;
  method: string | null;
  limitations: string[];
  provenance: { page_number?: number | null; location?: string };
  measurements: Measurement[];
};

export type CompareResponse = {
  corpus_version: string;
  comparability: "comparable" | "comparable_with_caveat" | "not_comparable";
  chart_allowed: boolean;
  matched_measurement_family: string | null;
  reasons: { code: string; message: string }[];
  caveats: { code: string; message: string }[];
  missing_fields: string[];
  left: Study;
  right: Study;
  left_fingerprint: Record<string, unknown>;
  right_fingerprint: Record<string, unknown>;
  points: {
    study_id: string;
    label: string;
    value: number;
    unit: string;
    uncertainty: string | null;
    page_number: number | null;
    provenance: string;
  }[];
};

export type Evidence = {
  chunk_id: string;
  paper_id: string;
  title: string;
  page_number: number;
  official_url: string;
  text: string;
  corpus_version: string;
};

export type PageText = {
  paper_id: string;
  title: string;
  official_url: string;
  page_number: number;
  text: string;
  quality_flags: string[];
};
