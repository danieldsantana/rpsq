-- Teste dos scripts de banco/, rodado por testes/banco/rodar_banco.py num Postgres local descartável.
-- Dados FICTÍCIOS. Usuários simulados pelo e-mail @exemplo.com.
\set ON_ERROR_STOP 1
\pset footer off

-- Ajudante: roda um comando que DEVE falhar e devolve a mensagem de erro.
create schema teste;
grant usage on schema teste to anon, authenticated;
create function teste.falha(cmd text) returns text language plpgsql as $$
begin
  execute cmd;
  raise exception 'NAO FALHOU: %', cmd;
exception when others then
  if sqlerrm like 'NAO FALHOU%' then raise; end if;
  return sqlerrm;
end $$;
grant execute on function teste.falha(text) to anon, authenticated;

-- ===== Carga fictícia (como superusuário, como o script 002 fará) =====
insert into rpsq_config values ('contratante', 'CONTRATANTE EXEMPLO');
insert into rpsq_trechos values ('X1', 'AAA-BBB', 'LT EXEMPLO 1', 1), ('X2', 'CCC-DDD', 'LT EXEMPLO 2', 2);
insert into rpsq_canteiros (trecho_id, nome, ordem) values ('X1', 'Norte', 1), ('X1', 'Sul', 2), ('X2', 'Norte', 1);
insert into rpsq_torres values
  ('X1', 1, '0/1', 'E', 'EX2', 400), ('X1', 2, '0/2', 'E', 'EX2', 450), ('X1', 3, '7/1A', 'A', 'EX1', 500),
  ('X1', 4, '7/1', 'E', 'EX2', 300), ('X2', 1, '0/1', 'E', 'EX2', 410), ('X2', 2, '1/1', 'E', 'EX2', 420);
insert into rpsq_atividades (trecho_id, codigo, nome, unidade, topico, nome_topico) values
  ('X1', '4.1.1', 'ATIV A', 'TORRE', '4.1', 'TOPICO 4.1'),
  ('X1', '4.1.2', 'ATIV B', 'KM', '4.1', 'TOPICO 4.1'),
  ('X1', '4.1.10', 'ATIV C', 'TORRE', '4.1', 'TOPICO 4.1'),
  ('X2', '4.1.1', 'ATIV A', 'TORRE', '4.1', 'TOPICO 4.1');
insert into rpsq_usuarios values
  ('00000000-0000-0000-0000-00000000000a', 'ADMIN', 'admin', true),
  ('00000000-0000-0000-0000-00000000000e', 'EDITA', 'edita', true),
  ('00000000-0000-0000-0000-00000000000c', 'CONSULTA', 'consulta', true);

\echo '===== 1. Anonimo (sem login): nada'
set role anon;
select teste.falha('select * from rpsq_celulas') as anon_celulas;
select teste.falha('select * from rpsq_usuarios') as anon_usuarios;
select teste.falha('select * from rpsq_config') as anon_config;
select teste.falha('select * from rpsq_registros') as anon_registros;
select teste.falha('select rpsq_papel()') as anon_funcao;
select teste.falha($$select rpsq_abrir_semana('2026-11-16')$$) as anon_abrir;
reset role;

\echo '===== 2. Login de fora da lista do RPSQ: tudo vazio, nada gravado'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000f';
do $$ begin
  assert rpsq_papel() is null, 'papel deveria ser nulo';
  assert (select count(*) from rpsq_trechos) = 0, 'leu trechos';
  assert (select count(*) from rpsq_torres) = 0, 'leu torres';
  assert (select count(*) from rpsq_config) = 0, 'leu config';
  assert (select count(*) from rpsq_usuarios) = 0, 'leu usuarios';
  assert (select count(*) from rpsq_atividades) = 0, 'leu atividades';
end $$;
select teste.falha($$insert into rpsq_semanas (inicio) values ('2026-11-16')$$) as fora_semana;
select teste.falha($$select rpsq_criar_avulsa('X1','4.1','X','TORRE')$$) as fora_avulsa;
reset role;

\echo '===== 3. Admin abre a primeira semana'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select teste.falha($$select rpsq_abrir_semana('2026-11-17')$$) as nao_segunda;
select rpsq_abrir_semana('2026-11-16');
select teste.falha($$select rpsq_abrir_semana('2026-11-16')$$) as ja_existe;
select teste.falha($$select rpsq_abrir_semana('2026-11-30')$$) as pulou_semana;
do $$ begin
  assert (select count(*) from rpsq_usuarios) = 3, 'admin deveria ver todos os usuarios';
  assert (select criada_por from rpsq_semanas) = '00000000-0000-0000-0000-00000000000a', 'criada_por';
end $$;
reset role;

\echo '===== 4. Edita lanca na semana atual'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
insert into rpsq_planilha (semana, canteiro_id, atividade_id) values ('2026-11-16', 1, 1), ('2026-11-16', 1, 2);
insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres, comentario) values
  ('2026-11-16', 1, 1, 'P1', 0, '{0/1,0/2}', ''),
  ('2026-11-16', 1, 1, 'P1', 1, '{}', 'so comentario'),
  ('2026-11-16', 1, 1, 'P1', 2, '{}', ''),
  ('2026-11-16', 1, 1, 'P2', 3, '{7/1A}', 'coment p2'),
  ('2026-11-16', 1, 1, 'E', 4, '{7/1}', '');
insert into rpsq_linhas (semana, canteiro_id, atividade_id, tipo, encarregado) values
  ('2026-11-16', 1, 1, 'P1', 'ENCARREGADO A'), ('2026-11-16', 1, 1, 'P2', 'ENCARREGADO B'),
  ('2026-11-16', 1, 1, 'E', 'ENCARREGADO C');
insert into rpsq_controle values ('2026-11-16', 1, 100, 40);
-- upsert, como o app fará
insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P1', 0, '{0/1,0/2,7/1A}')
  on conflict (semana, canteiro_id, atividade_id, tipo, dia) do update set torres = excluded.torres;
do $$ begin
  assert (select alterado_por from rpsq_celulas where tipo='P1' and dia=0) = '00000000-0000-0000-0000-00000000000e', 'auditoria alterado_por';
  assert (select alterado_em from rpsq_celulas where tipo='P1' and dia=0) is not null, 'auditoria alterado_em';
  assert (select count(*) from rpsq_usuarios) = 1, 'edita so ve a propria linha de usuario';
end $$;
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P1', 5, '{0/1,99/9}')$$) as torre_inexistente;
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 3, 1, 'P1', 5, '{0/1}')$$) as trecho_trocado;
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P1', 7, '{0/1}')$$) as dia_invalido;
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P3', 1, '{0/1}')$$) as tipo_invalido;
update rpsq_semanas set revisao = 1;
do $$ begin assert (select revisao from rpsq_semanas) = 0, 'edita mudou a revisao'; end $$;
select teste.falha($$insert into rpsq_atividades (trecho_id, codigo, nome, unidade, topico) values ('X1','9.9.9','X','TORRE','9.9')$$) as edita_cria_nao_avulsa;
select teste.falha($$select rpsq_listar_usuarios()$$) as edita_lista_usuarios;
select teste.falha($$select rpsq_abrir_semana('2026-11-23')$$) as edita_abre_semana;
select teste.falha($$insert into rpsq_trechos values ('X9','A','B',9)$$) as edita_grava_trecho;
-- Avulsa: próximo número depois de 4.1.10 é 4.1.11 (comparação numérica, não de texto)
select codigo, nome, unidade, avulsa, nome_topico from rpsq_criar_avulsa('X1', '4.1', ' nova atividade ', 'km');
select codigo from rpsq_criar_avulsa('X1', '4.1', 'outra', 'TORRE');
select teste.falha($$select rpsq_criar_avulsa('X1','8.8','X','TORRE')$$) as topico_inexistente;
select teste.falha($$select rpsq_criar_avulsa('X1','4.1','  ','TORRE')$$) as nome_vazio;
reset role;

\echo '===== 5. Consulta le tudo e nao grava nada'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from rpsq_celulas) = 5, 'consulta deveria ler as celulas';
  assert (select count(*) from rpsq_torres) = 6, 'consulta deveria ler as torres';
end $$;
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P1', 6, '{0/1}')$$) as consulta_grava;
update rpsq_celulas set torres = '{}' ;
do $$ begin assert (select count(*) from rpsq_celulas where cardinality(torres) > 0) = 3, 'consulta conseguiu alterar'; end $$;
select teste.falha($$select rpsq_criar_avulsa('X1','4.1','X','TORRE')$$) as consulta_avulsa;
reset role;

\echo '===== 6. Visao rpsq_registros (datas)'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select tipo, data, torre, situacao, canteiro, encarregado from rpsq_registros order by data, torre;
reset role;

\echo '===== 7. Admin abre a semana seguinte'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update rpsq_semanas set revisao = 2, elaborado_por = 'SUPERVISOR X' where inicio = '2026-11-16';
select rpsq_abrir_semana('2026-11-23');
select tipo, dia, torres, comentario, a_confirmar from rpsq_celulas where semana = '2026-11-23' order by tipo, dia;
select tipo, encarregado from rpsq_linhas where semana = '2026-11-23' order by tipo;
do $$ begin
  assert (select count(*) from rpsq_planilha where semana = '2026-11-23') = 2, 'planilha copiada';
  assert (select previsto from rpsq_controle where semana = '2026-11-23') = 100, 'controle copiado';
  assert (select revisao from rpsq_semanas where inicio = '2026-11-23') = 0, 'revisao da nova = 0';
  assert not exists (select 1 from rpsq_celulas where semana = '2026-11-23' and tipo = 'P2'), 'P2 nova deveria nascer vazia';
  assert (select count(*) from rpsq_celulas where semana = '2026-11-23' and tipo = 'E' and dia = 2) = 0, 'celula vazia nao deveria ser copiada';
end $$;
select * from rpsq_listar_usuarios();
select rpsq_gravar_usuario('NOVO@exemplo.com', ' PESSOA NOVA ', 'edita', true) is not null as incluiu_novo;
select teste.falha($$select rpsq_gravar_usuario('naoexiste@exemplo.com','X','edita',true)$$) as email_sem_login;
select teste.falha($$select rpsq_gravar_usuario('admin@exemplo.com','ADMIN','edita',true)$$) as admin_se_rebaixa;
reset role;

\echo '===== 8. Semana anterior ficou so para consulta'
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select teste.falha($$insert into rpsq_celulas (semana, canteiro_id, atividade_id, tipo, dia, torres) values ('2026-11-16', 1, 1, 'P1', 6, '{0/1}')$$) as grava_semana_velha;
update rpsq_celulas set torres = '{}' where semana = '2026-11-16';
do $$ begin assert (select count(*) from rpsq_celulas where semana = '2026-11-16' and cardinality(torres) > 0) = 3, 'alterou semana velha'; end $$;
-- confirmar uma amarela na semana nova
update rpsq_celulas set a_confirmar = false where semana = '2026-11-23' and tipo = 'E' and dia = 0;
do $$ begin assert (select a_confirmar from rpsq_celulas where semana = '2026-11-23' and tipo = 'E' and dia = 0) = false, 'nao confirmou'; end $$;
reset role;

\echo '===== 9. Usuario inativo perde acesso'
update rpsq_usuarios set ativo = false where papel = 'consulta';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin assert (select count(*) from rpsq_celulas) = 0, 'inativo ainda le'; end $$;
reset role;

\echo '===== 10. Tabela do outro app intacta e publicacao'
select * from public.cards;
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;

\echo 'TODOS OS TESTES DO BANCO PASSARAM'
