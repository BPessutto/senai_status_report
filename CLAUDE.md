# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Painel de Assessorias — a static, no-build multi-page app (vanilla HTML/CSS/JS with ES modules) used by SENAI consultants to track consultancies for the B+P (Brasil Mais Produtivo) program. Backend is Supabase (Postgres + Auth + PostgREST + RLS); there is no server-side code in this repo. All UI text and code comments are in Portuguese (pt-BR) — keep new user-facing text and comments in Portuguese too, consistent with the rest of the codebase.

## Running locally

There is no build step, package.json, or test suite. Since the pages use ES modules, they must be served over HTTP (not opened via `file://`):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. `index.html` just redirects to `painel.html` (logged in) or `login.html` (logged out) based on the current Supabase session.

Verifying a change: there's no linter or test runner. The practical checks used in this repo are (a) opening the affected page in a browser and clicking through the golden path, and (b) for `<script type="module">` blocks, extracting the script and running `node --input-type=module --check` on it to catch syntax errors before committing.

## Supabase setup

`js/supabase-config.js` holds `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` and **is committed to the repo** (not gitignored/secret) — cloning the repo is enough to get a working app pointed at the existing project. `supabase/schema.sql` is the full schema (run once in the Supabase SQL editor to provision a new project); `supabase/seed_vr_paineis_backup.json` is a one-off data import for the original pilot project. See `SETUP.md` for the full non-technical walkthrough (in Portuguese) given to the end user.

## Pages and roles

- `login.html` — Supabase email/password auth.
- `painel.html` — "Minhas Assessorias" / calendário geral: a consultant's list of their own assessorias plus a consolidated calendar view across all of them.
- `dashboard.html` — the per-assessoria workspace: stages/deliverables, visit logging (realized + planned), the assessoria's own calendar, printable report. This is the largest and most complex page.
- `gestor.html` — manager ("gestor") dashboard: cross-consultant overview (occupancy vs. target, banco de horas, active assessorias per consultant). Read-only aggregation — it never writes back to the database.

Role is stored in `public.profiles.role` (`consultor` | `gestor`), checked via the `is_gestor()` SQL function used in RLS policies. A gestor has full read/write access to every consultant's `assessorias`/`compensacoes`/`feriados_municipais` rows (not just aggregation); a client (external email listed in `assessoria_clientes`) gets read-only access to exactly the one assessoria they were invited to.

## Shared modules (`js/`)

- `supabase-client.js` — the single `sb` client instance, built from `window.SUPABASE_URL`/`SUPABASE_ANON_KEY` (set by `supabase-config.js`) and the UMD `js/vendor/supabase.js` script, both loaded as plain `<script>` tags before the page's module script.
- `session.js` — `requireSession()` (redirects to `login.html` if unauthenticated) and `logout()`. Called at the top of every module script on protected pages.
- `stage-template.js` — the business rules for a consultancy's 4-phase structure (`STAGE_DEFINITIONS`, `defaultState()`), the porte-based (ME/EPP/DEMAIS) hour allocation (`PORTE_HOURS`, `applyPorteHours`), the B+P deadline constants (`PRAZO_APONTAMENTO_DIAS`, `PRAZO_ENCERRAMENTO_DIAS`), and `computeFasePrevisoes()` which walks planned-but-not-yet-realized visits in date order to estimate when each phase will finish. Shared between `dashboard.html` and `gestor.html`.
- `calendar-utils.js` — pure date/calendar helpers (ISO date math done in UTC to avoid timezone drift), Brazilian national holiday calculation (fixed + Easter-relative, computed algorithmically rather than looked up), and the stable per-assessoria color palette used in consolidated calendar views.
- `action-panel.js` — a dependency-free slide-in side panel (`showActionPanel()`) used everywhere in place of the browser's `confirm()`/`prompt()`, for calendar click actions (log a visit, plan a visit, etc.).

## Data model

Almost all assessoria state lives in one JSONB column, `assessorias.data`, shaped as:

```
{ schemaVersion, totalPrevisto, etapas: [...], visitas: [...], visitasPlanejadas: [...], printSettings }
```

- `etapas` — the 4 phases (diagnóstico/implementação/resultados/encerramento), each with `prev`/`real` hours, `status`, and an `entregaveis` (deliverables) checklist.
- `visitas` — realized visits (`dataISO`, `horasNoDia`, ...).
- `visitasPlanejadas` — planned-but-not-yet-realized visits, consumed by `computeFasePrevisoes()` to project phase completion dates.

Everything else about an assessoria (owner, client company name, município, porte, active flag, contract/closure dates, ação educacional fields) is a plain relational column on `public.assessorias`, not inside the JSON blob — those columns exist specifically so RLS policies and cross-consultant queries (used by `gestor.html`) don't need to parse JSONB.

**Phase auto-completion is computed twice, independently.** `dashboard.html` has `aplicarConclusaoAutomatica()`, which marks a phase `'Concluído'` in the database once its required deliverables are done and `real >= prev` hours — but this write only happens when the consultant actually opens that specific assessoria, so the persisted `status` can lag behind reality. `gestor.html` never writes to the database, so instead of trusting the possibly-stale `status`, it recomputes the same condition on read via `etapaConcluidaEfetiva()`. When changing the completion rule, update both places, since they must agree without either one being the source of truth for the other's page.

## Visual language

`js/shared.css` holds the design tokens shared across pages (`--navy`, `--blue`, `--green`, `--amber`, `--danger`, `--purple`, `--card`, `--border`, `--muted`, `--shadow`, `--radius`). Established color convention: blue = planejado (planned), green = registrado/concluído (logged/completed), amber/red = alerta. Follow this convention rather than introducing new colors for the same semantics.
