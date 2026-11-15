export type Source = {
  source_id: string; name: string; organization?: string; original_url?: string; url?: string;
  identifier?: string | null; document_id?: string | null; doi?: string | null; publication_date?: string | null;
  update_date?: string | null; access_date?: string | null; retrieved_at?: string | null;
  dataset_version?: string | null; license?: string | null; usage_restrictions?: string | null;
  checksum?: string | null; checksum_sha256?: string | null; sha256?: string | null; retrieval_status?: string; content_type?: string;
  trust_classification?: string; extraction_method?: string; processing_history?: unknown[]; source_section?: string | null; passage?: string | null;
  file_checksums?: unknown[];
};
export type Dataset = { dataset_id: string; name?: string; filename?: string; source_id?: string; checksum?: string; format?: string; status?: string; measurement_count?: number; download_available?: boolean; [key: string]: unknown };
export type Investigation = {
  investigation_id: string; name: string; full_name?: string; category?: string; objective?: string;
  summary?: string; gravity_regime?: string | null; source_ids: string[]; conditions?: Record<string, unknown>;
  limitations: string[]; datasets: Dataset[]; measurement_count: number; source_count?: number;
  metadata_only?: boolean; publications?: {paper_id?: string; url?: string; name?: string}[]; sources?: Source[]; measurements?: unknown[];
  available_files?: {name?: string; url?: string; retrieval_status?: string}[];
  runs?: unknown[]; [key: string]: unknown;
};
export type InvestigationList = { investigations: Investigation[]; total: number; limit: number; offset: number };
export type RankingRequest = {
  question: string; mission: string; oxygen_fraction?: number; pressure_kpa?: number; gravity?: string;
  weights: { topic: number; gravity: number; conditions: number; quantitative: number; provenance: number };
};
export type Ranking = {
  investigation_id: string; name: string; score: number;
  components: { dimension: string; weight: number; value: number; reason: string }[];
  missing_fields: string[]; limitations: string[]; source_ids: string[];
};
export type RankingResponse = { method_version: string; rankings: Ranking[]; gaps: string[]; assumptions: string[]; [key: string]: unknown };
export type AnalyticsGroup = {
  measurement_family: string; unit: string; count: number; min: number; max: number; mean: number;
  evidence_classification?: string; evidence_class?: string; values: { value: number; run_id?: string; dataset_id?: string; source_id?: string; study_id?: string; evidence_classification?: string; evidence_class?: string; [key: string]: unknown }[];
};
export type PublishedValue = { measurement_id: string; value: number; unit: string; paper_id: string; label?: string; method?: string; evidence_class: string; training_eligible: boolean; provenance: { page_number?: number; location?: string }; limitation?: string };
export type Analytics = { groups: AnalyticsGroup[]; published_values?: PublishedValue[]; exclusions: unknown[]; limitations: string[]; [key: string]: unknown };
export type ModelStatus = { status: string; reason?: string; limitations?: string[]; requirements?: string[]; required?: string[]; [key: string]: unknown };
export type ContextEntry = {
  id?: string; name?: string; title?: string; date?: string; event_date?: string; publication_date?: string; type?: string;
  classification?: string; description?: string; summary?: string; lessons?: string[]; limitations?: string[];
  source_ids?: string[]; source_id?: string; url?: string; [key: string]: unknown;
};
export type ResearchContext = { incidents: ContextEntry[]; earth_applications: ContextEntry[]; education: ContextEntry[] };
