-- 007: histórico de edições.
--
-- O que muda:
--   1. Tabela rpsq_historico: uma linha para cada campo alterado, com quem, quando, o valor de
--      antes e o de depois. Vale para:
--        rpsq_celulas  -> torres, comentário e confirmação da célula amarela;
--        rpsq_linhas   -> encarregado;
--        rpsq_controle -> total previsto e acumulado.
--   2. Quem grava o histórico é o próprio banco (gatilho), a cada gravação. O app só lê.
--      Ninguém altera nem apaga o histórico pelo app.
--   3. Abrir semana nova não gera histórico: as células copiadas da semana anterior entram sem registro.
--
-- O histórico começa a contar depois que este script roda; as edições anteriores não ficam registradas.
-- Pode rodar mais de uma vez sem estragar nada.

create table if not exists public.rpsq_historico (
  id           bigint generated always as identity primary key,
  semana       date not null references public.rpsq_semanas (inicio) on delete cascade,
  canteiro_id  bigint references public.rpsq_canteiros (id),   -- vazio no previsto e no acumulado
  atividade_id bigint not null references public.rpsq_atividades (id),
  tipo         text,                                             -- 'E', 'P1', 'P2'; vazio no previsto e no acumulado
  dia          smallint,                                         -- 0 a 6; vazio no encarregado, previsto e acumulado
  campo        text not null check (campo in ('torres', 'comentario', 'a_confirmar', 'encarregado', 'previsto', 'acumulado')),
  antes        jsonb,
  depois       jsonb,
  por          uuid,
  por_nome     text not null default '',
  em           timestamptz not null default now()
);
create index if not exists rpsq_historico_atividade on public.rpsq_historico (semana, atividade_id);

-- Compara o registro antes e depois da gravação e anota cada campo que mudou.
-- security definer: grava na tabela de histórico, que o app não pode alterar.
create or replace function public.rpsq_registrar_historico() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_antes  jsonb;
  v_depois jsonb := to_jsonb(new);
  v_campos text[];
  v_nome   text;
  k        text;
begin
  if coalesce(current_setting('rpsq.sem_historico', true), '') = 'sim' then
    return null;
  end if;
  v_campos := case tg_table_name
    when 'rpsq_celulas' then array['torres', 'comentario', 'a_confirmar']
    when 'rpsq_linhas'  then array['encarregado']
    else array['previsto', 'acumulado'] end;
  if tg_op = 'UPDATE' then
    v_antes := to_jsonb(old);
  else
    v_antes := case tg_table_name
      when 'rpsq_celulas' then '{"torres": [], "comentario": "", "a_confirmar": false}'
      when 'rpsq_linhas'  then '{"encarregado": ""}'
      else '{"previsto": null, "acumulado": null}' end::jsonb;
  end if;
  select nome into v_nome from public.rpsq_usuarios where user_id = auth.uid();
  foreach k in array v_campos loop
    if coalesce(v_antes -> k, 'null') is distinct from coalesce(v_depois -> k, 'null') then
      insert into public.rpsq_historico (semana, canteiro_id, atividade_id, tipo, dia, campo, antes, depois, por, por_nome)
      values (new.semana, (v_depois ->> 'canteiro_id')::bigint, new.atividade_id, v_depois ->> 'tipo',
              (v_depois ->> 'dia')::smallint, k, v_antes -> k, v_depois -> k, auth.uid(), coalesce(v_nome, ''));
    end if;
  end loop;
  return null;
end
$$;

drop trigger if exists rpsq_historico on public.rpsq_celulas;
drop trigger if exists rpsq_historico on public.rpsq_linhas;
drop trigger if exists rpsq_historico on public.rpsq_controle;
create trigger rpsq_historico after insert or update on public.rpsq_celulas
  for each row execute function public.rpsq_registrar_historico();
create trigger rpsq_historico after insert or update on public.rpsq_linhas
  for each row execute function public.rpsq_registrar_historico();
create trigger rpsq_historico after insert or update on public.rpsq_controle
  for each row execute function public.rpsq_registrar_historico();

-- Abrir semana: igual ao do 001, mas as cópias da semana anterior não entram no histórico.
create or replace function public.rpsq_abrir_semana(p_nova date) returns void
language plpgsql set search_path = ''
as $$
declare
  v_anterior date;
begin
  if public.rpsq_papel() is distinct from 'admin' then
    raise exception 'Só o administrador pode abrir semana.';
  end if;
  if extract(isodow from p_nova) <> 1 then
    raise exception 'A semana tem de começar numa segunda-feira; % não é.', to_char(p_nova, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from public.rpsq_semanas where inicio = p_nova) then
    raise exception 'A semana de % já existe.', to_char(p_nova, 'DD/MM/YYYY');
  end if;

  v_anterior := public.rpsq_semana_atual();
  if v_anterior is not null and p_nova <> v_anterior + 7 then
    raise exception 'A semana nova tem de ser a seguinte à mais recente: %.', to_char(v_anterior + 7, 'DD/MM/YYYY');
  end if;

  insert into public.rpsq_semanas (inicio) values (p_nova);
  if v_anterior is null then
    return;
  end if;

  -- só até o fim desta chamada
  perform set_config('rpsq.sem_historico', 'sim', true);

  insert into public.rpsq_planilha (semana, canteiro_id, atividade_id, visivel)
  select p_nova, canteiro_id, atividade_id, visivel
    from public.rpsq_planilha where semana = v_anterior;

  insert into public.rpsq_controle (semana, atividade_id, previsto, acumulado)
  select p_nova, atividade_id, previsto, acumulado
    from public.rpsq_controle where semana = v_anterior;

  insert into public.rpsq_linhas (semana, canteiro_id, atividade_id, tipo, encarregado)
  select p_nova, canteiro_id, atividade_id, case tipo when 'P1' then 'E' else 'P1' end, encarregado
    from public.rpsq_linhas
   where semana = v_anterior and tipo in ('P1', 'P2') and encarregado <> '';

  insert into public.rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres, comentario, a_confirmar)
  select p_nova, canteiro_id, atividade_id, case tipo when 'P1' then 'E' else 'P1' end, dia,
         torres, comentario, tipo = 'P1' and cardinality(torres) > 0
    from public.rpsq_celulas
   where semana = v_anterior and tipo in ('P1', 'P2')
     and (cardinality(torres) > 0 or comentario <> '');

  perform set_config('rpsq.sem_historico', '', true);
end
$$;

-- Acesso: todos com papel leem; ninguém grava pelo app (só o gatilho).
alter table public.rpsq_historico enable row level security;
drop policy if exists rpsq_ler on public.rpsq_historico;
create policy rpsq_ler on public.rpsq_historico for select to authenticated
  using ((select public.rpsq_papel()) is not null);
revoke all on public.rpsq_historico from anon, authenticated;
grant select on public.rpsq_historico to authenticated;
revoke all on function public.rpsq_registrar_historico() from public, anon, authenticated;
revoke all on function public.rpsq_abrir_semana(date) from public, anon;
grant execute on function public.rpsq_abrir_semana(date) to authenticated;

-- Conferência: a tabela existe e os três gatilhos estão ligados.
select (select count(*) from public.rpsq_historico) as registros_no_historico,
       (select count(*) from pg_trigger where tgname = 'rpsq_historico') as gatilhos_ligados;
