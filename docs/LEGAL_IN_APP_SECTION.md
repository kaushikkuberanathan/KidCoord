# Legal in-app section — implementation recommendations

> Companion to `docs/REGULATORY_CONSIDERATIONS.md`. Planning only — **not legal advice**. Final copy by counsel. Thin-client rule: FE presents server-served Legal payloads; no business logic in the app.

## Placement

- **Settings → Legal** (always available)
- **Onboarding** before household creation: acknowledge parent/guardian role + links to Privacy + Terms
- Optional: footer link on auth screens

## Server contract (suggested)

`GET /api/v2/legal` (or `/legal/documents`) returns versioned documents:

- `privacyPolicy` { version, effectiveDate, htmlOrMarkdown, updatedAt }
- `termsOfUse` { … }
- `childrensPrivacy` { … }
- `dataPracticesSummary` { childFields[], locationPolicy, circleSharingSummary, retentionSummary }
- `contact` { privacyEmail }

Commands (not FE-local):

- `POST /api/v2/legal/privacy-request` — type: access | delete | export | correct — server opens ticket / fulfills

## Checklist for compliance hygiene (GA-first)

1. [ ] Publish Privacy Policy (CalOPPA contents) before or at launch  
2. [ ] Children’s / parental-role notice (parent-only accounts)  
3. [ ] Clear child data categories (minimized)  
4. [ ] Circle-sharing explanation  
5. [ ] Location practices (no live kid tracking; stop-level / TTL)  
6. [ ] In-app or emailed delete/export path that hits the **server**  
7. [ ] Privacy contact  
8. [ ] Effective date + change notice process  
9. [ ] Onboarding parent/guardian acknowledgment  
10. [ ] Do not claim encryption/geo controls until verified  

## Out of scope for Legal UI alone

Written infosec program, retention schedule ops, breach runbooks, VPC flows (only if COPPA triggered) — document operationally; surface summaries in Legal only when accurate.
