# Data dictionary

Verified rows were read from extracted page text of NASA/TM-20210011385, *Burning and Suppression of Solids–II (BASS-II) Summary Report* (`ntrs:20210011385`). No other paper contributed a charted number.

| Field | Meaning |
| --- | --- |
| `fuel_family` | `pmma` when the page names polymethylmethacrylate. |
| `gravity_regime` | `microgravity` for the ISS test. `normal_gravity` only where the page says 1g. |
| `platform` | `iss` for the glovebox test. `other` for a computational result. |
| `oxygen_mole_fraction` | Fraction, only when the same sentence states the percent. Empty if the paragraph does not. |
| `value` / `unit` | Copied from the page. Not converted. |
| `verification_status` | `verified` after the sentence was found on the stated page of the extract. |
| `flame_spread_rate` | A stated steady spread rate. |
| `extinction_velocity` | A stated extinction velocity. Not plotted against a spread rate. |

Checked sentences:

- Page 31: a 100 µm PMMA sample reached a steady spread rate of 2.2 mm/s before the flow was cut off.
- Page 34: a quiescent 1g model reports 2.8 mm/s for a 100 µm sheet at 21 percent oxygen. Thicker-sheet values in that sentence are not separate rows.
- Page 34, figure 2.12 discussion: computational extinction velocity of 1.5 cm/s at 21 percent oxygen and 3.5 cm/s at 16 percent oxygen for a 100 µm PMMA sheet.

Missing oxygen on the 2.2 mm/s row stays null. It is not stored as zero and not filled from a different sentence on page 30.
