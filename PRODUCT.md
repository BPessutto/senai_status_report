# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are SENAI consultants who run consultancy engagements ("assessorias") under the B+P (Brasil Mais Produtivo) program. Today the tool is used solo by one consultant; it is built to be rolled out to a team of consultants plus a manager ("gestor") role, though that rollout hasn't happened yet. A third audience is the external client company being consulted: one person per assessoria, invited by email, with read-only access to their own assessoria's progress and report.

## Product Purpose

Tracks a consultancy engagement end-to-end: the 4-phase B+P structure (diagnóstico/implementação/resultados/encerramento), deliverables per phase, realized and planned visit logging, hour totals against porte-based (ME/EPP/DEMAIS) allocations, and projected phase-completion dates. Produces a printable status report per assessoria. For a gestor, it aggregates occupancy vs. target and banco de horas across all consultants without ever writing back to the data.

## Positioning

Replaces the original single-file HTML + browser-localStorage tracker built for one pilot engagement ("Projeto B+P — VR Painéis") with a shared, multi-consultant, Supabase-backed system — while staying a zero-build static app that any consultant can run by opening it in a browser, not a hosted SaaS product.

## Operating Context

Consultants log visits and hours both in the field (on-site at the client, on mobile/tablet) and back at their desk (desktop/laptop) when preparing reports and planning. Work is paced by B+P program deadlines (apontamento and encerramento windows) and porte-based hour budgets — these are compliance facts of the program, not adjustable business rules. Clients receive a read-only invite by email to view their own assessoria's progress and print/export the report. A gestor reviews cross-consultant load and progress but never edits underlying records.

## Capabilities and Constraints

- No backend code in this repo: Supabase (Postgres + Auth + PostgREST + RLS) is the entire backend; the app is static HTML/CSS/vanilla JS ES modules with no build step, bundler, or test suite.
- Three roles enforced via Postgres RLS, not just UI: `consultor` (full read/write on own assessorias), `gestor` (full read/write across all consultants' assessorias, but the gestor UI itself never writes), `client` (read-only, scoped to exactly the one assessoria they were invited to).
- All UI text and code comments are Portuguese (pt-BR).
- Phase auto-completion is computed independently in two places (dashboard.html on write, gestor.html on read) and both must be kept in agreement — see CLAUDE.md.
- Must remain deployable by static hosting alone (Netlify drag-and-drop, Vercel, GitHub Pages) with no server process.

## Brand Commitments

SENAI's institutional logo (`assets/logo-senai.png`) and the B+P program logo (`assets/logo-bp.png`) are mandatory identity elements and must be preserved in any redesign. `assets/logo-vr.png` belongs to "VR," the original pilot client, and is specific to that one assessoria's seed data/report — not a general brand constraint for the app.

## Evidence on Hand

- `assets/logo-senai.png`, `assets/logo-bp.png` — institutional/program branding (binding, see above).
- `assets/logo-vr.png` and `supabase/seed_vr_paineis_backup.json` — real data and branding from the original pilot engagement ("Projeto B+P — VR Painéis"), used to seed/import a first assessoria.
- `SETUP.md` — the actual non-technical onboarding walkthrough given to the end user; reflects real setup steps and current single-consultant framing.
- No customer testimonials, press, or case studies exist beyond the one pilot engagement; do not fabricate additional ones.

## Product Principles

1. Stay zero-build and framework-free — deployability by dragging a folder to static hosting is a constraint, not a preference.
2. Design for the field: primary visit-logging and calendar views must hold up on mobile/tablet, not just desktop, since consultants use both.
3. Respect the three-tier trust boundary (consultor / gestor / client) in every surface — gestor stays strictly read-only in the UI even though its DB role can write, and client views must never leak other assessorias.
4. Treat B+P program rules (deadlines, porte-based hour allocation, 4-phase structure) as fixed compliance facts to surface clearly, never as adjustable design parameters.
5. SENAI and B+P branding is a fixed identity layer beneath any visual redesign; client-specific artifacts (like the VR pilot data/logo) are not.

## Accessibility & Inclusion

No formal accessibility standard has been established. Field/mobile usability (see Operating Context) is a confirmed product-level need; specific WCAG or assistive-technology requirements have not been raised.
