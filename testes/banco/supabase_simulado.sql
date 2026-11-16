-- Imitação mínima do Supabase para testar os scripts de banco/ fora dele:
-- papéis anon e authenticated, auth.users, auth.uid() e a publicação de tempo real.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
-- Como no Supabase: tabelas e funções novas em public ficam abertas para anon e authenticated.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

create publication supabase_realtime;

-- Uma tabela do "outro app", para conferir que não é tocada.
create table public.cards (id int primary key, titulo text);
insert into public.cards values (1, 'nao mexer');

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a', 'admin@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000e', 'edita@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000c', 'consulta@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000f', 'fora@exemplo.com'),
  ('00000000-0000-0000-0000-00000000000b', 'novo@exemplo.com');
