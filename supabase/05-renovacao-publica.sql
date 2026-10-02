begin;
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
  if usage.anonymous <> guest or (stamp >= usage.window_start + interval '3 hours') then
    usage.used := 0; usage.window_start := stamp; usage.anonymous := guest;
  end if;
  permitted := usage.used < cap;
  if coalesce(p_consume,false) and permitted then usage.used := usage.used+1; end if;
  update public.chat_usage set used=usage.used,window_start=usage.window_start,anonymous=guest where user_id=uid;
  return jsonb_build_object('allowed',permitted,'remaining',greatest(0,cap-usage.used),'limit',cap,'anonymous',guest,
    'resetAt',usage.window_start+interval '3 hours');
end $$;
revoke all on function public.chat_quota(boolean) from public, anon;
grant execute on function public.chat_quota(boolean) to authenticated;


commit;
