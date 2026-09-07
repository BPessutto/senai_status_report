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

Role is stored in `public.profiles.role` (`consultor` | `gestor`), checked via the `is_gestor()` SQL function used in RLS policies. A gestor has full read/write access to every consultant's `assessorias`/`compensacoes`/`feriados_municipais` rows (not just aggregation).

An assessoria can also have other consultants linked to it via `public.assessoria_colaboradores` (checked via `has_collaborator_access()`, selected in the Nova/Editar assessoria modal from `list_consultores()`). A linked consultant gets read-only access to that one assessoria — they can never edit it, its deliverables, or its planning. This is not a separate app-level role: the UI never labels it as anything but "Consultor"/"Consultores", showing "Modo de visualização" for whoever isn't the assessoria's `owner_id` (the owner remains the sole write authority). There used to be a similar mechanism for inviting an external client by e-mail (`assessoria_clientes`/`has_client_access()`); it was fully replaced by this consultant-to-consultant model, external client access no longer exists.

`consultor_ocupado_em()` is a narrow-scope `SECURITY DEFINER` function, called from `dashboard.html` when planning a visit with participantes (see below): it answers "is this consultant already committed elsewhere on this date" — checking their own and collaborated-on assessorias plus compensações/feriados, without exposing which other assessoria/client that commitment belongs to. It only works between consultants already linked to the same origin assessoria — it is not a general cross-user schedule lookup. It only warns (via a confirm dialog); it never blocks planning outright, and it's only wired into new-entry planning, not into reagendamento or the visit-registration form.

**Personal metrics are computed twice, independently, same pattern as phase auto-completion below.** `painel.html` (banco de horas, calendário consolidado) and `gestor.html` (ocupação, "hoje", banco de horas per consultant) each have their own copy of the "owner OR linked collaborator, and only *my* slice of `participantes[]`" logic (`minhaFatia`/`souParticipanteDaVisita` in `painel.html`; `fatiaDoConsultor`/`souParticipanteDaVisita` in `gestor.html`). They're not shared code, so when the attribution rule changes, update both — same caveat as the phase-completion duplication.

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

Both `visitas` and `visitasPlanejadas` entries can carry an optional `participantes: [{consultorId, nome, horas}]` array — who worked that date and how many hours each, when the assessoria has consultants linked via `assessoria_colaboradores` (see below). `nome` is a snapshot taken at the time, not a live join, so history stays accurate even if someone's profile name changes or they're later unlinked. The top-level `horasNoDia`/`horas` is always the assessoria-wide total (= `sum(participantes[].horas)` when the array is present) and every phase-consumption calculation (`computeFasePrevisoes`, `etapaSnapshots`, the timeline/archive/print report) reads only that total — `participantes` is a second, independent breakdown of the same total by person, never consulted by those. **Entries without `participantes` (all pre-existing data, and any assessoria with no linked consultants) are implicitly 100% the assessoria owner's** — every reader that cares about per-person attribution (personal calendar, banco de horas, gestor.html's per-consultant metrics) must apply that fallback explicitly; there's no migration that backfills it.

Everything else about an assessoria (owner, client company name, município, porte, active flag, contract/closure dates, ação educacional fields) is a plain relational column on `public.assessorias`, not inside the JSON blob — those columns exist specifically so RLS policies and cross-consultant queries (used by `gestor.html`) don't need to parse JSONB.

**Phase auto-completion is computed twice, independently.** `dashboard.html` has `aplicarConclusaoAutomatica()`, which marks a phase `'Concluído'` in the database once its required deliverables are done and `real >= prev` hours — but this write only happens when the consultant actually opens that specific assessoria, so the persisted `status` can lag behind reality. `gestor.html` never writes to the database, so instead of trusting the possibly-stale `status`, it recomputes the same condition on read via `etapaConcluidaEfetiva()`. When changing the completion rule, update both places, since they must agree without either one being the source of truth for the other's page.

## Visual language

`js/shared.css` holds the design tokens shared across pages (`--navy`, `--blue`, `--green`, `--amber`, `--danger`, `--purple`, `--comp`, `--card`, `--border`, `--muted`, `--shadow`, `--radius`). Established color convention: blue = planejado (planned), green = registrado/concluído (logged/completed), amber/red = alerta, purple = read-only viewer badge (`role-badge.readonly` in `dashboard.html`) and the "Aguardando cliente" visit status (waiting on the actual client company, unrelated to app access), `--comp`/`--compbg` = compensação de horas (a distinct violet, kept separate from `--purple` so the two meanings stay visually distinguishable). Follow this convention rather than introducing new colors for the same semantics.

`dashboard.html` does not link `js/shared.css` — it carries its own inline copy of the same `:root` tokens and several shared classes (`.field label`, `.badge`, etc.). When changing a shared token or class in `js/shared.css`, mirror the change in `dashboard.html`'s local `<style>` block too, or the pages will drift apart.
