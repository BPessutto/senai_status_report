-- Schema do Painel de Assessorias (SENAI) no Supabase
-- Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run

create extension if not exists pgcrypto;

-- ============================================================
-- Tabela principal: uma linha por assessoria/projeto
-- ============================================================
create table if not exists public.assessorias (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  cliente_nome text,
  municipio text,
  proposta text,
  logo_url text,
  mostra_logo_bp boolean not null default true,
  ativo boolean not null default true,
  porte text not null default 'DEMAIS' check (porte in ('ME','EPP','DEMAIS')),
  data_contratacao date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessorias_owner_idx on public.assessorias (owner_id);

-- ============================================================
-- Dias de compensacao do consultor (bloqueio pessoal no calendario,
-- nao pertence a nenhuma assessoria especifica)
-- ============================================================
create table if not exists public.compensacoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  data_iso date not null,
  motivo text,
  created_at timestamptz not null default now(),
  unique (owner_id, data_iso)
);

create index if not exists compensacoes_owner_idx on public.compensacoes (owner_id);

alter table public.compensacoes enable row level security;

drop policy if exists "compensacoes: owner full access" on public.compensacoes;
create policy "compensacoes: owner full access"
  on public.compensacoes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- Feriados municipais marcados manualmente pelo consultor (feriados
-- nacionais sao calculados no proprio app, nao precisam de tabela)
-- ============================================================
create table if not exists public.feriados_municipais (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  data_iso date not null,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, data_iso)
);

create index if not exists feriados_municipais_owner_idx on public.feriados_municipais (owner_id);

alter table public.feriados_municipais enable row level security;

drop policy if exists "feriados_municipais: owner full access" on public.feriados_municipais;
create policy "feriados_municipais: owner full access"
  on public.feriados_municipais
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- E-mails de clientes autorizados a ver (somente leitura) uma assessoria
-- ============================================================
create table if not exists public.assessoria_clientes (
  id uuid primary key default gen_random_uuid(),
  assessoria_id uuid not null references public.assessorias(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  unique (assessoria_id, email)
);

create index if not exists assessoria_clientes_assessoria_idx on public.assessoria_clientes (assessoria_id);

-- ============================================================
-- updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assessorias_set_updated_at on public.assessorias;
create trigger assessorias_set_updated_at
before update on public.assessorias
for each row execute function public.set_updated_at();

-- ============================================================
-- Funções auxiliares (SECURITY DEFINER)
-- ============================================================
-- As políticas de assessorias e assessoria_clientes precisam se checar
-- mutuamente. Se isso for feito com subqueries diretas dentro das próprias
-- políticas, o Postgres entra em recursão infinita (a política de uma
-- tabela consulta a outra, que consulta a primeira de novo, sem parar).
-- Encapsular a checagem em funções SECURITY DEFINER quebra esse loop: a
-- função roda com o privilégio de quem a criou (dono das tabelas), então a
-- consulta interna não reaciona o RLS.
create or replace function public.is_assessoria_owner(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.assessorias a
    where a.id = target_id and a.owner_id = auth.uid()
  );
$$;

create or replace function public.has_client_access(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.assessoria_clientes ac
    where ac.assessoria_id = target_id
      and lower(ac.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.assessorias enable row level security;
alter table public.assessoria_clientes enable row level security;

-- Dono (consultor) tem acesso total às suas próprias assessorias
drop policy if exists "assessorias: owner full access" on public.assessorias;
create policy "assessorias: owner full access"
  on public.assessorias
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Cliente autorizado (e-mail cadastrado em assessoria_clientes) só pode LER a assessoria dele
drop policy if exists "assessorias: client read access" on public.assessorias;
create policy "assessorias: client read access"
  on public.assessorias
  for select
  using (public.has_client_access(id));

-- Só o dono da assessoria pode gerenciar quem tem acesso de cliente a ela
drop policy if exists "assessoria_clientes: owner manage" on public.assessoria_clientes;
create policy "assessoria_clientes: owner manage"
  on public.assessoria_clientes
  for all
  using (public.is_assessoria_owner(assessoria_id))
  with check (public.is_assessoria_owner(assessoria_id));

-- Fim do schema.
-- Depois de rodar: vá em Authentication > Providers e confirme que "Email" está habilitado.
-- Para agilizar o cadastro de clientes hoje, considere desligar temporariamente a confirmação
-- por e-mail em Authentication > Settings (Email confirmations).
