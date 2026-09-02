# Requirements

SK7 (상균7데이즈) is a Talos chronic-disease lifestyle challenge service. It provides a versioned hypertension-risk screening signal and seven days of home measurement records. It is not diagnosis or treatment.

| ID | Priority | Actor | Contract | Exception / acceptance |
|---|---|---|---|---|
| FR-01 | High | User | Submit baseline demographic and lifestyle inputs for a versioned risk assessment. | Reject missing, out-of-range, or unit-ambiguous inputs. |
| FR-02 | High | System | Return risk band, score, model version, and input completeness. | No diagnosis, prescription, or causal language. |
| FR-03 | High | User | Record morning/evening systolic and diastolic values with a measurement checklist. | Reject implausible ranges; retain no device export. |
| FR-04 | High | User | Select one seven-day walking, sleep, or low-sodium challenge. | Change allowed only before the first check-in. |
| FR-05 | High | System | Show assessment, measurement, and adherence as separate series. | Re-score labels changed inputs; it never claims challenge effect. |
| FR-06 | Medium | User | Submit structured result feedback. | Review queue only; no online retraining. |
| NFR-01 | High | System | Published API load profile converges below P95 3 s. | Versioned performance evidence. |
| NFR-02 | High | System | Equal normalized input plus model version returns equal output. | Repeated-input test. |
| NFR-03 | High | Team | Training and validation remain disjoint; compare two models and two metrics. | Split digest and experiment manifest. |
| NFR-04 | High | System | JWT and RLS isolate each user's records. | Authorization integration test. |
| NFR-05 | High | Team | Real PHI is out of scope. | Synthetic seed data; request bodies absent from logs. |

| Evaluation area | Evidence |
|---|---|
| Planning | this file, UX flow, architecture |
| AI | model card, split manifest, repeated-input test |
| API | OpenAPI, integration tests, P95 report |
| Collaboration | Issues, PRs, Actions, release tags |
