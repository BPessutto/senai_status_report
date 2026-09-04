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
  porte text check (porte in ('ME','EPP','DEMAIS')),
  data_contratacao date,
  prazo_encerramento_manual date,
  acao_educacional_realizada boolean not null default false,
  acao_educacional_data date,
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
  horas numeric not null default 8,
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
-- Perfis (papel de cada usuário: consultor ou gestor). O gestor enxerga e
-- pode editar as assessorias de todos os consultores, pra acompanhar quem
-- está em que empresa/compensando hoje.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  role text not null default 'consultor' check (role in ('consultor','gestor')),
  created_at timestamptz not null default now()
);

-- Cria automaticamente o perfil (papel "consultor") de todo novo usuário que se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, initcap(replace(split_part(new.email, '@', 1), '.', ' ')))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Preenche o perfil de quem já tinha conta antes dessa tabela existir.
insert into public.profiles (id, email, nome)
select id, email, initcap(replace(split_part(email, '@', 1), '.', ' '))
from auth.users
on conflict (id) do nothing;

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

-- O gestor tem papel 'gestor' na tabela profiles. Função SECURITY DEFINER
-- pelo mesmo motivo das duas acima: evita recursão na política de profiles.
create or replace function public.is_gestor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'gestor'
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.assessorias enable row level security;
alter table public.assessoria_clientes enable row level security;
alter table public.profiles enable row level security;

-- Cada usuário lê o próprio perfil; o gestor lê o perfil de todo mundo
-- (pra montar a lista de consultores no painel gerencial).
drop policy if exists "profiles: self read" on public.profiles;
create policy "profiles: self read"
  on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists "profiles: gestor read all" on public.profiles;
create policy "profiles: gestor read all"
  on public.profiles
  for select
  using (public.is_gestor());

-- Gestor tem acesso total (leitura e edição) às assessorias, compensações e
-- feriados de qualquer consultor — ele tem autonomia pra mexer se precisar.
drop policy if exists "assessorias: gestor full access" on public.assessorias;
create policy "assessorias: gestor full access"
  on public.assessorias
  for all
  using (public.is_gestor())
  with check (public.is_gestor());

drop policy if exists "compensacoes: gestor full access" on public.compensacoes;
create policy "compensacoes: gestor full access"
  on public.compensacoes
  for all
  using (public.is_gestor())
  with check (public.is_gestor());

drop policy if exists "feriados_municipais: gestor full access" on public.feriados_municipais;
create policy "feriados_municipais: gestor full access"
  on public.feriados_municipais
  for all
  using (public.is_gestor())
  with check (public.is_gestor());

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
--
-- Para promover alguém a gestor (acesso total a todos os consultores),
-- a pessoa precisa já ter uma conta criada em login.html. Depois rode:
-- update public.profiles set role = 'gestor' where email = 'email-do-gestor@exemplo.com';
