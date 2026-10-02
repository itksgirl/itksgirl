-- Execute no SQL Editor antes de publicar o código.
begin;
create table if not exists public.chat_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used integer not null default 0 check (used >= 0),
  window_start timestamptz not null default now(),
  anonymous boolean not null
);
alter table public.chat_usage enable row level security;
revoke all on public.chat_usage from public, anon, authenticated;

-- Não aceita ID, contagem nem horário enviados pelo cliente.
-- O bloqueio da linha serializa pedidos concorrentes de uma mesma conta.
create or replace function public.chat_quota(p_consume boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  guest boolean;
  cap integer;
  usage public.chat_usage%rowtype;
  stamp timestamptz := clock_timestamp();
  permitted boolean;
begin
  if uid is null then raise exception 'Autenticação necessária'; end if;
  select is_anonymous into guest from auth.users where id=uid;
  if not found then raise exception 'Usuário inválido'; end if;
  guest := coalesce(guest,false);
  cap := case when guest then 10 else 30 end;
  insert into public.chat_usage(user_id,anonymous) values(uid,guest)
    on conflict(user_id) do nothing;
  select * into usage from public.chat_usage where user_id=uid for update;
  -- Uma conta que deixou de ser anônima começa sua própria janela.
  if usage.anonymous <> guest or (not guest and stamp >= usage.window_start + interval '3 hours') then
    usage.used := 0; usage.window_start := stamp; usage.anonymous := guest;
  end if;
  permitted := usage.used < cap;
  if coalesce(p_consume,false) and permitted then usage.used := usage.used+1; end if;
  update public.chat_usage set used=usage.used,window_start=usage.window_start,anonymous=guest where user_id=uid;
  return jsonb_build_object('allowed',permitted,'remaining',greatest(0,cap-usage.used),'limit',cap,'anonymous',guest,
    'resetAt',case when guest then null else usage.window_start+interval '3 hours' end);
end $$;
revoke all on function public.chat_quota(boolean) from public, anon;
grant execute on function public.chat_quota(boolean) to authenticated;

-- Usuários anônimos também usam o papel authenticated no Supabase.
-- Acrescenta uma condição restritiva sem substituir as políticas de propriedade existentes.
do $$ declare target text; begin
  foreach target in array array['study_items','conversations','messages','profiles'] loop
    if to_regclass('public.' || target) is not null then
      execute format('alter table public.%I enable row level security',target);
      if not exists(select 1 from pg_policies where schemaname='public' and tablename=target and policyname='registered_accounts_only') then
        execute format('create policy registered_accounts_only on public.%I as restrictive for all to authenticated using ((auth.jwt()->>''is_anonymous'') is distinct from ''true'') with check ((auth.jwt()->>''is_anonymous'') is distinct from ''true'')',target);
      end if;
    end if;
  end loop;
end $$;
commit;
