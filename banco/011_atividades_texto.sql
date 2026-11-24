-- 011: atividades de texto (ex.: construção de canteiro).
--
-- O que muda:
--   1. rpsq_atividades ganha a coluna "texto". Quando é verdadeira, a célula guarda um texto livre
--      (um item em "torres") no lugar de torres, sem total e sem aviso de conflito.
--      As atividades do tópico de construção de canteiro são marcadas (o nome do tópico tem "CANTEIRO").
--   2. O gatilho que confere os lançamentos não exige torre nessas atividades (só limita o tamanho).
--   3. A consulta rpsq_registros (uma linha por torre) deixa de fora as atividades de texto.
--
-- Pode rodar mais de uma vez sem estragar nada.

alter table public.rpsq_atividades add column if not exists texto boolean not null default false;

update public.rpsq_atividades set texto = true
 where nome_topico ilike '%CANTEIRO%' and not texto;

create or replace function public.rpsq_conferir_lancamento() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_trecho   text;
  v_texto    boolean;
  v_invalidas text[];
begin
  select a.trecho_id, a.texto into v_trecho, v_texto
    from public.rpsq_atividades a
    join public.rpsq_canteiros c on c.trecho_id = a.trecho_id
   where a.id = new.atividade_id and c.id = new.canteiro_id;
  if v_trecho is null then
    raise exception 'O canteiro % e a atividade % não são do mesmo trecho.', new.canteiro_id, new.atividade_id;
  end if;

  if tg_table_name = 'rpsq_celulas' then
    if v_texto then
      if cardinality(new.torres) > 1 or length(coalesce(new.torres[1], '')) > 300 then
        raise exception 'Nas atividades de texto, a célula aceita um texto só, de até 300 letras.';
      end if;
      return new;
    end if;
    select array_agg(x) into v_invalidas
      from unnest(new.torres) as x
     where not exists (select 1 from public.rpsq_torres t
                        where t.trecho_id = v_trecho and t.codigo = split_part(x, ':', 1))
        or (position(':' in x) > 0 and split_part(x, ':', 2) !~ '^(A|B|C|D|AB|AC|AD|BC|BD|CD|ABC|ABD|ACD|BCD)$');
    if v_invalidas is not null then
      raise exception 'Torres que não existem no trecho %: %', v_trecho, array_to_string(v_invalidas, ', ');
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.rpsq_conferir_lancamento() from public, anon;

-- Igual à do 006, sem as atividades de texto.
create or replace view public.rpsq_registros with (security_invoker = true) as
select c.semana,
       c.semana + (case c.tipo when 'E' then -7 when 'P1' then 0 else 7 end) + c.dia as data,
       a.trecho_id,
       a.codigo  as atividade_codigo,
       a.nome    as atividade_nome,
       a.unidade,
       split_part(t.torre, ':', 1) as torre,
       case c.tipo when 'E' then 'executado' else 'programado' end as situacao,
       c.tipo,
       k.nome    as canteiro,
       coalesce(l.encarregado, '') as encarregado,
       nullif(split_part(t.torre, ':', 2), '') as partes
  from public.rpsq_celulas c
  join public.rpsq_atividades a on a.id = c.atividade_id
  join public.rpsq_canteiros  k on k.id = c.canteiro_id
  left join public.rpsq_linhas l
         on l.semana = c.semana and l.canteiro_id = c.canteiro_id
        and l.atividade_id = c.atividade_id and l.tipo = c.tipo
  cross join lateral unnest(c.torres) as t (torre)
 where not a.texto;

-- Conferência: as atividades que passaram a ser de texto.
select trecho_id, codigo, nome, unidade from public.rpsq_atividades where texto order by trecho_id, codigo;
