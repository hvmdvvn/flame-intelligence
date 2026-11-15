# Scientific methodology

## Evidence categories

The assistant's exact source quotations are **documented conclusions**, including publication descriptions, and do not imply independent confirmation. The publication-value analytics explicitly label **directly observed results** and **reported model predictions**. Operator imports require `measurement_kind` (`direct_observation` or `reported_model`). Descriptive statistics and deterministic scores are **derived analysis**. Optional generated text is always **hypothesis or interpretation** requiring validation. Missing sources, conditions, models and measurements produce **insufficient evidence** states.

## Measurement validation

CSV/TSV/JSON imports require a reviewed measurement definition, compatible units, nonnegative finite values, run identifier, gravity regime and source location. Absolute pressure and temperature must be positive. Oxygen requires an explicit mole/volume/mass fraction or partial-pressure basis with appropriate units. Partial pressure cannot exceed total pressure. Inconsistent conditions within one run, duplicate sample keys and nonmonotonic timestamps fail the whole import and quarantine the input. Raw strings/files and original units remain available. Scale conversions use versioned SI factors; fraction bases are never interconverted.

Missing calibration/conditions/uncertainty are recorded as limitations. Structural validation does not establish instrument accuracy or scientific peer review. Inspect the import report before using measurements.

## Comparisons and analytics

The existing study comparison gate requires matching fuel family, gravity, verified measurement definition and compatible documented units; ambiguity locks the chart. Computational and observed results cannot be plotted as directly comparable measurements. Missing conditions, different oxygen and pressure, and published-model status produce visible caveats. Catalog investigation comparisons are qualitative metadata comparisons and do not assert experimental equivalence.

Imported descriptive groups remain separate by dataset, run, measurement definition, evidence class and normalized unit. Arithmetic means are sample summaries, not independent replicate statistics. No causal relationship, regression, statistical significance or suppression effectiveness is inferred from the available four manually transcribed publication values.

## Mission relevance

`relevance-1.0.0` computes 100 × weighted sum(component) / sum(weights). Topic uses question-token overlap against source-backed investigation metadata with a small disclosed vocabulary expansion. Gravity credit requires exact regime match; lunar/Mars defaults use partial gravity. Oxygen similarity is max(0, 1−abs(delta)/0.1); total-pressure similarity uses 50 kPa. Missing or unspecified conditions receive zero supported similarity. Quantitative availability requires validated imported observations; provenance credit requires resolvable sources. These are research exploration heuristics, not physical equivalence thresholds or probabilities of fire. A mission selects a gravity default and does not establish validated habitat applicability.

All weights, components, limitations, missing fields, method version and source records are included in exported JSON. The report SHA-256 covers its scientific payload serialized with sorted keys. It supports reproducibility checks, not authenticity certification.
