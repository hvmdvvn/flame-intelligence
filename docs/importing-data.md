# Authorized offline import

1. Find the investigation in [NASA PSI](https://psi.nasa.gov/physci/repo/search?q=combustion). Follow its documented download/access workflow; do not infer an undocumented API. [NASA's large-download process](https://science.nasa.gov/uncategorized/new-file-download-process-for-large-requestspsi-new-file-download-process/) describes email delivery for requests above 1 GB. Respect source-specific rights and access restrictions.
2. Preserve the original download and documentation externally. Prepare an explicitly mapped CSV/TSV or JSON array with the importer's supported schema. If converting from another format, record the original checksum, software and mapping in source notes; do not claim a transformed CSV is the untouched instrument file.
3. Provide a separate metadata JSON object. These are schema placeholders, **not an actual dataset**:

```json
{
  "investigation_id": "BASS-II",
  "source_id": "psi-psi-25",
  "source_name": "Burning and Suppression of Solids II",
  "source_url": "https://psi.nasa.gov/physci/repo/data/investigations/PSI-25",
  "organization": "NASA PSI",
  "dataset_version": "REPLACE_WITH_DOWNLOADED_VERSION",
  "license": "REPLACE_WITH_ACTUAL_SOURCE_TERMS",
  "authorized": true,
  "redistribution_allowed": false,
  "source_type": "psi"
}
```

`authorized` is operator attestation, not source authentication. Set redistribution only after checking rights. Optionally include `expected_sha256`, `doi`, `access_date` and `notes`. Do not put credentials or personal information in metadata exposed through the registry/report.

Required measurement columns: `run_id`, `measurement_name`, `measurement_kind`, `value`, `unit`, `source_location`, `gravity_regime`. Kinds: `direct_observation` and `reported_model`. Source location identifies the original file/table/row/page. Supported definitions and exact scale conversions are in `backend/app/import_data.py` (`DEFINITIONS`, `UNITS`). Unknown definitions fail rather than being silently coerced.

Optional columns: `fuel`, `oxygen_value`, `oxygen_basis`, `oxygen_unit`, `pressure_value`, `pressure_unit`, `airflow_value`, `airflow_unit`, `uncertainty`, `time_s`, `calibration`. Blank optional CSV cells become null. Oxygen basis must identify `mole_fraction`, `volume_fraction`, `mass_fraction`, or `partial_pressure`; a bare percent is ambiguous and fails. Pressure and airflow require declared units. Keep calibration traceable rather than writing unsupported assurances.

```powershell
cd backend
..\.venv\Scripts\python.exe -m app.import_data ingest path/to/authorized.csv --metadata path/to/source.json
..\.venv\Scripts\python.exe -m app.import_data jobs
```

Imports are bounded to 50 MiB and 100,000 rows and run outside browser requests. Jobs persist status, errors and validation warnings. Identical file and metadata converge on the same dataset; changed metadata/files create a version. Whole-file validation precedes atomic database commit. Failed content and errors are quarantined and cannot partially enter analytics. Retrying is idempotent; the offline adapter needs no external download retry.

The importer retains content-addressed raw bytes. SQLite preserves validated original and normalized measurements in separate columns, including processing versions and conversion factors. A manually mapped file is raw **input to this importer**, not necessarily original instrument output. Measurement integrity, scientific comparability and calibration still require research review. Structurally valid model outputs remain model outputs. Missing conditions/calibration/uncertainty exclude a row from training eligibility, which is still not approval to train a safety model.

Local imports and raw files are not committed automatically. Back up database and artifacts together. Inspect `/api/investigations/{id}`, `/api/analytics` and permitted downloads after import. Job inspection over HTTP requires an operator token; CLI inspection stays local. There is no public upload or remote-file fetch API.
