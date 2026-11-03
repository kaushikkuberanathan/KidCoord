# Regulatory Considerations

> **PLANNING RESEARCH NOTES — NOT LEGAL ADVICE.** Validate with a privacy attorney before any launch. Soft invent none: items marked **Unknown** were not verified from primary sources in the 2026-11-02 scan.
>
> **Planned launch:** Georgia only (for now).  
> **As of:** 2026-11-02 (America/New_York).  
> **Product status when written:** PARKED (docs-only carve).

## 1. Product context

KidCoord is a parent-facing coordination app for:

1. **Morning** school drop-off (need a ride / offer a ride) — MVP  
2. **Evening** activity carpool — Later  
3. **Playdate** scheduling — Later  

Parents hold accounts. Children do **not** have logins in the current design; parents enter child details (typically first name + last initial, school/route/stop). Architecture intent is privacy-first, thin client (UX only), with rules/state on a middleware backend + API/events. The shell for that client is locked: fully native React Native 0.73. A hybrid WebView shell is rejected. A PWA is not the handoff system of record. See [CLIENT_SHELL.md](./CLIENT_SHELL.md).

This document maps privacy and kids-PII regimes to that scope and records product guardrails. It does not authorize feature work.

## 2. Regime summary (GA-first)

| Regime | Applies to GA-first launch? | Priority |
|---|---|---|
| **COPPA** (federal; 16 CFR 312) | Likely **not** while parent-only; **high risk** if any child-facing input/login/tracking | Highest watch |
| **Georgia** omnibus consumer privacy | **No** such law enacted (SB 111 privacy text stripped) | Watch 2027 session |
| **GA breach notification** (O.C.G.A. §10-1-910–912) | Likely **N/A** (narrow entity/data triggers) | Best-practice plan anyway |
| **GA Student Data Privacy** (O.C.G.A. §20-2-660 et seq.) | **N/A** unless designed/marketed for K-12 school purposes | Watch if school-partnered |
| **GA SB 351** (social media / under-16) | **N/A** while kids have no accounts | Watch if kid accounts added |
| **CalOPPA** | **N/A** until one CA resident uses the service; cheapest to satisfy early | Watch / comply early |
| **CCPA/CPRA** | **N/A** pre-threshold / GA-first | Design-forward only |
| **FERPA** | **N/A** unless schools are data sources/partners | Watch if school-partnered |
| **FTC Act §5** | **Yes** — privacy promises are enforceable | Always |
| **GDPR / UK GDPR** | **N/A** for GA-only (no EU/UK targeting) | Revisit if marketing abroad |

### 2.1 COPPA (highest-priority watch)

- Amended Rule: effective June 23, 2025; general compliance date **April 22, 2026** ([Federal Register 2025-05904](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule); [eCFR 16 CFR Part 312](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312)).
- Triggers on operators of services directed to children under 13, or with actual knowledge of collecting personal information **from** a child.
- **KidCoord nuance:** parent-entered child data is generally treated differently from collection *from* a child (FTC FAQ page fetch failed in the 2026-11-02 scan — treat as **Unknown** pending counsel). Any child login, typed input (e.g. child entering a handoff code), kid profile, photo/voice, or kid-device location can flip COPPA on in full.
- If triggered: parental notice, verifiable parental consent, parent review/delete, written information-security program, written retention policy (no indefinite retention), separate consent for non-integral third-party disclosure.

### 2.2 Georgia

- **No comprehensive consumer privacy statute** as of the 2026-11-02 scan (SB 111 privacy content replaced before signing; signed Act concerns rural hospital tax credit eligibility — see [SB 111](https://www.legis.ga.gov/legislation/69990)).
- Breach law is narrower than many states (information brokers / certain government data collectors; covered PI combinations). Adopt an incident plan as best practice even if statute is likely N/A.
- Student-data operator rules apply when a service is used for **K-12 school purposes** and designed/marketed for them — parent-to-parent carpool is likely outside; school partnership would reopen this.
- SB 351 social-media age rules: likely N/A without kid accounts (litigation posture can change — watch).

### 2.3 CalOPPA (watch item)

- Applies to commercial online services that collect PII about **California consumers** ([Cal. Bus. & Prof. Code §§22575–22579](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=8.&chapter=22.)).
- No size threshold. A single CA-resident parent signup can trigger it (app stores are national).
- Core ask: conspicuously posted privacy policy with required contents (categories, third parties, change process, effective date, Do-Not-Track response, etc.).
- **Recommendation:** publish a CalOPPA-ready privacy policy before or at GA launch even if no CA marketing.

### 2.4 CCPA/CPRA, FERPA, GDPR

- **CCPA/CPRA:** for-profit thresholds + CA residents ([CA AG CCPA](https://oag.ca.gov/privacy/ccpa)). Pre-revenue / GA-first → N/A for now. Design-forward: no sale/share for cross-context ads; treat precise geolocation as sensitive.
- **FERPA:** school education records / funded schools. N/A until school data partnerships. (ed.gov page timed out in scan — specifics **Unknown**.)
- **GDPR/UK GDPR:** N/A for GA-only without EU/UK establishment or targeting.

### 2.5 FTC Act §5

Privacy promises in docs/marketing (“privacy-first,” stop-level location, encryption) become enforceable representations. Do not claim controls that are unchecked or unimplemented.

## 3. Requirements × KidCoord scope (main @ 6a01463 as of 2026-11-02 scan)

Status legend: **Met** / **Partial** / **Gap** / **N/A-GA-now** / **Unknown**

| # | Requirement | Regime | GA-now? | Status | Note |
|---|---|---|---|---|---|
| 1 | No child-facing collection (no kid accounts/inputs) | COPPA scope gate | Yes (design) | **Met (as built)** | Keep; any kid surface flips COPPA |
| 2 | Posted privacy policy | CalOPPA / COPPA / FTC §5 | Best practice | **Gap** | None in repo |
| 3 | Direct parental notice + VPC | COPPA | If kid surface | N/A-GA-now / Unknown | |
| 4 | Separate consent for 3rd-party disclosure of kid data | COPPA | If triggered | **Unknown** | Circle sharing — counsel |
| 5 | Parent review/delete/refuse | COPPA; good practice | Advisable | **Partial** | FE removeChild; no server delete/export API |
| 6 | Data minimization | COPPA; product intent | Yes | **Partial** | first+last initial in docs; precise ride geo in schema |
| 7 | Written retention policy | COPPA §312.10 | Advisable | **Gap** | Append-only events, no TTL documented |
| 8 | Written infosec program | COPPA §312.8 | Advisable | **Gap** | Intent only; encryption validation unchecked |
| 9 | Encryption at rest (sensitive columns) | Breach / promises | Yes | **Partial** | phone hashed; column encrypt unverified |
| 10 | No kid PII on device as source of truth | Security / thin-client | Yes | **Gap** | AsyncStorage persists children/schools |
| 11 | Household-scoped access; no stranger directory | Safety / FTC §5 | Yes | **Partial** | RBAC designed; discovery scope Unknown |
| 12 | Breach response plan | GA / FTC | Advisable | **Gap** | |
| 13 | No sale / targeted ads on kid data | CCPA / COPPA / policy | Yes (policy) | **Unknown** | Not stated |
| 14 | CA consumer rights | CCPA | No | **N/A-GA-now** | |
| 15 | School-partner contract / 45-day delete | GA SDPA / FERPA | No | **N/A-GA-now** | If school partnership |
| 16 | Age verification for <16 accounts | GA SB 351 | No | **N/A-GA-now** | No kid accounts |
| 17 | GA omnibus privacy | — | No law | **N/A** | Watch 2027 |
| 18 | GDPR/UK | — | No | **N/A** | |

## 4. Product guardrails (planning)

1. **Parent-only accounts** — no child logins or typed child inputs. Handoff codes are shown/spoken via parent devices.
2. **Minimize kid data** — first name + last initial; no DOB/photo/school ID unless counsel-approved need.
3. **Location** — no continuous kid tracking; stop-level or none on ride events; short documented TTL for any precise geo; align schema with docs.
4. **Trusted circle only** — invite-based; no school/route stranger directory.
5. **Retention + deletion** — written schedule; server-side delete household/child + export; cascade vendors.
6. **Thin client** — no kid domain PII in AsyncStorage; server views enforce RBAC/audit/deletion.
7. **Infosec program-lite** — owner, annual risk review, vendor DPAs (mirrors COPPA even if not strictly triggered).
8. **One privacy policy** — CalOPPA-ready + children’s/parental-role section.
9. **No ads / no sale / no third-party tracking SDKs** for kid-adjacent data.

## 5. In-app Legal section recommendations

Serve Legal content from the **backend** (or CMS) so the thin client only presents it. Suggested Settings → **Legal** (also link from first-run onboarding):

| Block | Purpose | Supports |
|---|---|---|
| **Privacy Policy** (full text or link) | Categories of PII, third parties, changes, effective date, DNT response | CalOPPA; FTC §5; COPPA online notice if ever triggered |
| **Terms of Use** | Acceptable use, parent responsibility, circle trust | Contract / product |
| **Children’s Privacy / Parental Role** | “Parents create accounts; children do not. Parents enter child details. We do not knowingly collect from children under 13.” | COPPA avoidance + transparency |
| **What we collect about children** | First name + last initial; school/route/stop as needed for coordination; no photos/DOB by default | Minimization; CalOPPA categories |
| **How circle sharing works** | Who in a trusted circle can see which child fields; invite-only | Disclosure transparency; counsel on COPPA “integral” |
| **Location practices** | Stop-level intent; no live kid GPS tracking in product policy; retention window | FTC §5; sensitive location |
| **Your choices** | Request access, correction, deletion, export (email or in-app ticket → server fulfills) | COPPA parent rights hygiene; future CCPA |
| **Security overview** | High-level (TLS, access control) — no unverifiable claims | FTC §5 |
| **Contact** | Privacy contact email | CalOPPA / COPPA notice |
| **Effective date / updates** | Version + how users are notified of material changes | CalOPPA |

**Onboarding:** checkbox/acknowledge “I am a parent/guardian…” + link to Privacy + Terms before creating a household. Soft invent none on legal wording — counsel drafts final copy.

**Do not put in Legal as product claims until true:** column encryption validated; precise geo purged; formal written infosec/retention docs exist.

## 6. Unknowns for counsel

- Whether parent-entered child data + circle sharing could still be deemed COPPA collection or “directed to children.”
- Whether sharing kid first name/school/stop to circle members is “disclosure” needing separate consent.
- Current COPPA civil penalty amounts; GA FBPA application; FERPA details (page fetch failed in scan).
- Whether carpool logistics could become “K-12 school purposes” under GA SDPA if schools promote the app.

## 7. Sources (2026-11-02 scan)

Primary / official-leaning URLs opened or status-checked in the privacy scan (see scout memo for fetch status):

- https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312  
- https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule  
- https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=8.&chapter=22.  
- https://oag.ca.gov/privacy/ccpa  
- https://www.legis.ga.gov/legislation/69990  
- Georgia statute text via Justia hosts for O.C.G.A. breach and student-data sections (secondary host)

Internal research memo (not in-repo): scout `privacy-regulatory-2026-11-02.md`.
