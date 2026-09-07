-- Schema do Painel de Assessorias (SENAI) no Supabase
-- Rode este arquivo inteiro em: Supabase > SQL Editor > New query > Run

-- Tudo abaixo roda como uma única transação: se qualquer statement falhar no
-- meio, o Postgres desfaz tudo (nenhuma tabela/função/policy fica alterada
-- pela metade). Reexecutar o arquivo inteiro continua seguro e idempotente.
begin;

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
  programa text check (programa in ('BP','MOVER')),
  carga_contratada integer,
  data_maxima_atendimento date,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assessorias_owner_idx on public.assessorias (owner_id);

-- ============================================================
-- Programa (B+P / MOVER Hands-On) — colunas pra instalações que já tinham a
-- tabela antes de o MOVER existir. programa NULL == B+P (compatibilidade
-- histórica, sem exigir migração das linhas existentes).
-- ============================================================
alter table public.assessorias add column if not exists programa text;
alter table public.assessorias add column if not exists carga_contratada integer;
alter table public.assessorias add column if not exists data_maxima_atendimento date;

-- drop + add (em vez de "add constraint if not exists", que o Postgres não
-- tem) reaplica a constraint com segurança a cada reexecução deste arquivo —
-- mesmo padrão já usado nas policies abaixo (drop policy if exists + create).
alter table public.assessorias drop constraint if exists assessorias_programa_check;
alter table public.assessorias add constraint assessorias_programa_check
  check (programa is null or programa in ('BP','MOVER'));

-- carga_contratada: NULL fora do MOVER, obrigatoriamente 200/400/600 no MOVER.
-- coalesce(programa,'BP') normaliza programa NULL pra 'BP' antes de comparar,
-- pra nunca comparar contra NULL (o que faria a expressão toda avaliar NULL
-- em vez de FALSE — e o Postgres trata resultado NULL de CHECK como
-- aprovado, só FALSE rejeita). Sem essa normalização, uma linha com
-- programa NULL e carga_contratada preenchida por engano passaria batido.
alter table public.assessorias drop constraint if exists assessorias_carga_contratada_check;
alter table public.assessorias add constraint assessorias_carga_contratada_check
  check (
    (coalesce(programa,'BP') <> 'MOVER' and carga_contratada is null)
    or (coalesce(programa,'BP') = 'MOVER' and carga_contratada is not null and carga_contratada in (200,400,600))
  );

-- MOVER: as duas datas manuais são obrigatórias (nenhum cálculo automático
-- as substitui) e a data máxima nunca pode ser anterior à contratação.
alter table public.assessorias drop constraint if exists assessorias_mover_datas_obrigatorias_check;
alter table public.assessorias add constraint assessorias_mover_datas_obrigatorias_check
  check (
    programa is distinct from 'MOVER'
    or (data_contratacao is not null and data_maxima_atendimento is not null)
  );

alter table public.assessorias drop constraint if exists assessorias_mover_datas_ordem_check;
alter table public.assessorias add constraint assessorias_mover_datas_ordem_check
  check (
    programa is distinct from 'MOVER'
    or data_maxima_atendimento >= data_contratacao
  );

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
-- Consultores adicionais vinculados a uma assessoria (leitura completa,
-- sem edição). Antes era "assessoria_clientes" (acesso por e-mail pra
-- cliente externo); renomeado e ligado a um usuário real do sistema.
-- ============================================================
do $$
begin
  if to_regclass('public.assessoria_clientes') is not null
     and to_regclass('public.assessoria_colaboradores') is null then
    alter table public.assessoria_clientes rename to assessoria_colaboradores;
  end if;
end $$;

create table if not exists public.assessoria_colaboradores (
  id uuid primary key default gen_random_uuid(),
  assessoria_id uuid not null references public.assessorias(id) on delete cascade,
  email text,
  colaborador_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assessoria_id, email)
);

-- Colunas/constraints pra instalações que já tinham a tabela antes (o rename
-- acima só troca o nome, não traz coluna nova nem afrouxa a antiga sozinho).
alter table public.assessoria_colaboradores
  add column if not exists colaborador_id uuid references auth.users(id) on delete cascade;
alter table public.assessoria_colaboradores
  alter column email drop not null;

create index if not exists assessoria_colaboradores_assessoria_idx on public.assessoria_colaboradores (assessoria_id);

create unique index if not exists assessoria_colaboradores_assessoria_colab_idx
  on public.assessoria_colaboradores (assessoria_id, colaborador_id)
  where colaborador_id is not null;

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
-- As políticas de assessorias e assessoria_colaboradores precisam se checar
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

-- A policy antiga "assessorias: client read access" ainda referencia essa
-- função numa instalação já existente. Sem removê-la primeiro, o DROP
-- FUNCTION abaixo falharia por dependência — removida aqui, explicitamente,
-- em vez de usar CASCADE (que apagaria qualquer coisa que dependesse da
-- função, prevista ou não). A policy nova equivalente é recriada mais abaixo,
-- na seção de RLS, já sem depender mais dessa função antiga.
drop policy if exists "assessorias: client read access" on public.assessorias;
drop function if exists public.has_client_access(uuid);

create or replace function public.has_collaborator_access(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.assessoria_colaboradores ac
    where ac.assessoria_id = target_id
      and ac.colaborador_id = auth.uid()
  );
$$;

-- Só quem já está autenticado tem uso legítimo pra essa checagem; anon não
-- precisa (e não deve) conseguir chamá-la.
revoke execute on function public.has_collaborator_access(uuid) from public;
grant execute on function public.has_collaborator_access(uuid) to authenticated;

-- Lista mínima de consultores cadastrados, pra escolher quem convidar pra uma
-- assessoria. Expõe só id/nome/email de quem tem role='consultor' (nunca
-- gestor), e nunca o próprio usuário que está chamando.
create or replace function public.list_consultores()
returns table(id uuid, nome text, email text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.nome, p.email
  from public.profiles p
  where p.role = 'consultor' and p.id <> auth.uid()
  order by p.nome;
$$;

-- Sem uso legítimo por anon (retornaria vazio mesmo, já que auth.uid() seria
-- null ali dentro, mas não custa fechar a porta em vez de confiar só nisso).
revoke execute on function public.list_consultores() from public;
grant execute on function public.list_consultores() to authenticated;

-- Responde só "esse consultor está disponível nessa data?", sem expor nada
-- da assessoria/cliente onde ele estiver ocupado. Quem chama precisa ser
-- dono (ou gestor) da assessoria de origem, e o consultor perguntado precisa
-- estar vinculado a essa mesma assessoria de origem (dono ou colaborador) —
-- isso impede consultar a agenda de qualquer usuário do sistema à vontade.
create or replace function public.consultor_ocupado_em(
  assessoria_origem_id uuid,
  consultor_id uuid,
  data_consulta date,
  ignorar_assessoria_id uuid default null
)
returns table(ocupado boolean, horas numeric, tipo text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  pode_consultar boolean;
  esta_vinculado boolean;
  data_iso text := data_consulta::text;
  horas_realizadas numeric := 0;
  horas_planejadas numeric := 0;
  horas_compensacao numeric := 0;
begin
  select (a.owner_id = auth.uid()) or public.is_gestor()
    into pode_consultar
    from public.assessorias a
    where a.id = assessoria_origem_id;

  if pode_consultar is not true then
    raise exception 'not authorized to check schedule from this assessoria';
  end if;

  select
    exists (select 1 from public.assessorias a where a.id = assessoria_origem_id and a.owner_id = consultor_id)
    or exists (
      select 1 from public.assessoria_colaboradores ac
      where ac.assessoria_id = assessoria_origem_id and ac.colaborador_id = consultor_id
    )
    into esta_vinculado;

  if esta_vinculado is not true then
    raise exception 'consultor is not linked to origin assessoria';
  end if;

  -- Todas as assessorias onde esse consultor participa (dono ou colaborador),
  -- exceto a que está sendo editada agora (pra não acusar conflito consigo mesma).
  with assessorias_do_consultor as (
    select a.id, a.owner_id, a.data
    from public.assessorias a
    where (
      a.owner_id = consultor_id
      or exists (
        select 1 from public.assessoria_colaboradores ac
        where ac.assessoria_id = a.id and ac.colaborador_id = consultor_id
      )
    )
    and (ignorar_assessoria_id is null or a.id <> ignorar_assessoria_id)
  ),
  visitas_no_dia as (
    select adc.owner_id, elem
    from assessorias_do_consultor adc,
         jsonb_array_elements(coalesce(adc.data->'visitas', '[]'::jsonb)) elem
    where elem->>'dataISO' = data_iso
  ),
  planejadas_no_dia as (
    select adc.owner_id, elem
    from assessorias_do_consultor adc,
         jsonb_array_elements(coalesce(adc.data->'visitasPlanejadas', '[]'::jsonb)) elem
    where elem->>'dataISO' = data_iso
  )
  select coalesce(sum(
    case
      when jsonb_array_length(coalesce(v.elem->'participantes', '[]'::jsonb)) > 0 then coalesce((
        select (part->>'horas')::numeric
        from jsonb_array_elements(v.elem->'participantes') part
        where part->>'consultorId' = consultor_id::text
        limit 1
      ), 0)
      when v.owner_id = consultor_id then coalesce((v.elem->>'horasNoDia')::numeric, 0)
      else 0
    end
  ), 0)
  into horas_realizadas
  from visitas_no_dia v;

  select coalesce(sum(
    case
      when jsonb_array_length(coalesce(p.elem->'participantes', '[]'::jsonb)) > 0 then coalesce((
        select (part->>'horas')::numeric
        from jsonb_array_elements(p.elem->'participantes') part
        where part->>'consultorId' = consultor_id::text
        limit 1
      ), 0)
      when p.owner_id = consultor_id then coalesce((p.elem->>'horas')::numeric, 0)
      else 0
    end
  ), 0)
  into horas_planejadas
  from planejadas_no_dia p;

  select coalesce(sum(c.horas), 0)
    into horas_compensacao
    from public.compensacoes c
    where c.owner_id = consultor_id and c.data_iso = data_consulta;

  if horas_compensacao > 0 then
    return query select true, horas_compensacao, 'compensacao';
  elsif exists (
    select 1 from public.feriados_municipais f
    where f.owner_id = consultor_id and f.data_iso = data_consulta
  ) then
    return query select true, 0::numeric, 'feriado';
  elsif horas_realizadas > 0 then
    return query select true, horas_realizadas, 'realizada';
  elsif horas_planejadas > 0 then
    return query select true, horas_planejadas, 'planejada';
  else
    return query select false, 0::numeric, null::text;
  end if;
end;
$$;

-- Mesmo com as validações internas (dono/gestor da origem + consultor
-- vinculado à mesma origem), fechar a porta de quem pode nem tentar chamar.
revoke execute on function public.consultor_ocupado_em(uuid, uuid, date, uuid) from public;
grant execute on function public.consultor_ocupado_em(uuid, uuid, date, uuid) to authenticated;

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
alter table public.assessoria_colaboradores enable row level security;
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

-- Faltava: sem isso o gestor não enxerga quem colabora com quem (necessário
-- pra métricas pessoais corretas em gestor.html — Passo 7).
drop policy if exists "assessoria_colaboradores: gestor full access" on public.assessoria_colaboradores;
create policy "assessoria_colaboradores: gestor full access"
  on public.assessoria_colaboradores
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

-- Consultor vinculado como colaborador só pode LER a assessoria (nunca editar).
-- A policy antiga já foi removida lá em cima, antes do DROP FUNCTION da
-- has_client_access; aqui só recriamos a nova, apontando pra função nova.
drop policy if exists "assessorias: collaborator read access" on public.assessorias;
create policy "assessorias: collaborator read access"
  on public.assessorias
  for select
  using (public.has_collaborator_access(id));

-- Só o dono da assessoria pode gerenciar quem está vinculado como colaborador
drop policy if exists "assessoria_clientes: owner manage" on public.assessoria_colaboradores;
drop policy if exists "assessoria_colaboradores: owner manage" on public.assessoria_colaboradores;
create policy "assessoria_colaboradores: owner manage"
  on public.assessoria_colaboradores
  for all
  using (public.is_assessoria_owner(assessoria_id))
  with check (public.is_assessoria_owner(assessoria_id));

-- Dono e qualquer colaborador vinculado podem LER a lista de colaboradores da
-- mesma assessoria (necessário pra UI mostrar "quem mais está nessa assessoria").
drop policy if exists "assessoria_colaboradores: participant read" on public.assessoria_colaboradores;
create policy "assessoria_colaboradores: participant read"
  on public.assessoria_colaboradores
  for select
  using (public.is_assessoria_owner(assessoria_id) or public.has_collaborator_access(assessoria_id));

commit;

-- Fim do schema.
-- Depois de rodar: vá em Authentication > Providers e confirme que "Email" está habilitado.
--
-- Para promover alguém a gestor (acesso total a todos os consultores),
-- a pessoa precisa já ter uma conta criada em login.html. Depois rode:
-- update public.profiles set role = 'gestor' where email = 'email-do-gestor@exemplo.com';
