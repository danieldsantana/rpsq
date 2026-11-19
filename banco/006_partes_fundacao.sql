-- 006: partes das fundações (pés e estais A, B, C e D).
--
-- O que muda:
--   1. rpsq_atividades ganha a coluna "partes", que diz como a atividade é lançada:
--        'pes'    -> por pé (A a D), em qualquer torre;
--        'estais' -> por estai (A a D), só em torres estaiadas;
--        'mastro' -> torre inteira, só em torres estaiadas;
--        vazio    -> como antes.
--      As atividades do tópico 2.1 são marcadas pelo nome.
--   2. A célula passa a aceitar a torre com as partes lançadas: '20/1:AB' = pés (ou estais) A e B.
--      A torre sem partes continua valendo a torre inteira, então nada do que já foi lançado muda.
--   3. A consulta rpsq_registros mostra a torre sem as partes e ganha a coluna "partes"
--      (vazia quando a torre inteira foi lançada).
--
-- Pode rodar mais de uma vez sem estragar nada.

alter table public.rpsq_atividades add column if not exists partes text;
alter table public.rpsq_atividades drop constraint if exists rpsq_atividades_partes_check;
alter table public.rpsq_atividades add constraint rpsq_atividades_partes_check
  check (partes in ('pes', 'estais', 'mastro'));

update public.rpsq_atividades set partes = 'pes'
 where topico = '2.1' and nome like '%- FUNDAÇÃO ESTAI / PÉ';
update public.rpsq_atividades set partes = 'estais'
 where topico = '2.1' and nome like '%- FUNDAÇÃO ESTAI';
update public.rpsq_atividades set partes = 'mastro'
 where topico = '2.1' and nome like '%- FUNDAÇÃO MASTRO%';

-- Confere que canteiro e atividade são do mesmo trecho e, nas células, que todas as torres
-- existem nesse trecho. A torre pode vir com as partes: '20/1:AB' (letras A a D, em ordem).
create or replace function public.rpsq_conferir_lancamento() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_trecho   text;
  v_invalidas text[];
begin
  select a.trecho_id into v_trecho
    from public.rpsq_atividades a
    join public.rpsq_canteiros c on c.trecho_id = a.trecho_id
   where a.id = new.atividade_id and c.id = new.canteiro_id;
  if v_trecho is null then
    raise exception 'O canteiro % e a atividade % não são do mesmo trecho.', new.canteiro_id, new.atividade_id;
  end if;

  if tg_table_name = 'rpsq_celulas' then
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

-- Uma linha por torre lançada. "torre" sai sem as partes; "partes" vem vazia quando a torre
-- inteira foi lançada, ou com as letras (ex.: 'AB') quando foram só algumas partes.
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
  cross join lateral unnest(c.torres) as t (torre);

-- Conferência: quantas atividades ficaram em cada tipo de lançamento, por trecho.
select trecho_id, coalesce(partes, '(torre inteira)') as lancamento, count(*) as atividades
  from public.rpsq_atividades
 where topico = '2.1'
 group by 1, 2
 order by 1, 2;
