begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  username text,
  full_name text,
  phone text,
  user_code text,
  referral_code text,
  referred_by uuid references public.profiles(id),
  role text not null default 'user',
  status text not null default 'active',
  balance numeric(18,2) not null default 0,
  frozen_balance numeric(18,2) not null default 0,
  total_deposit numeric(18,2) not null default 0,
  total_withdrawal numeric(18,2) not null default 0,
  total_bonus numeric(18,2) not null default 0,
  last_login_at timestamptz,
  device_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_status_check check (status in ('active','suspended','flagged'))
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists user_code text;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists balance numeric(18,2) not null default 0;
alter table public.profiles add column if not exists frozen_balance numeric(18,2) not null default 0;
alter table public.profiles add column if not exists total_deposit numeric(18,2) not null default 0;
alter table public.profiles add column if not exists total_withdrawal numeric(18,2) not null default 0;
alter table public.profiles add column if not exists total_bonus numeric(18,2) not null default 0;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists device_info text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_created_at_idx on public.profiles(created_at desc);
create index if not exists profiles_referred_by_idx on public.profiles(referred_by);

do $$
declare item record; candidate text;
begin
  for item in select p.id from public.profiles p where p.user_code is null or p.user_code !~ '^[0-9]{8}$' or exists (select 1 from public.profiles duplicate where duplicate.user_code = p.user_code and duplicate.id < p.id) loop
    loop
      candidate := lpad((floor(10000000 + random() * 90000000))::bigint::text,8,'0');
      exit when not exists (select 1 from public.profiles p where p.user_code = candidate);
    end loop;
    update public.profiles set user_code=candidate, referral_code=coalesce(nullif(referral_code,''),candidate) where id=item.id;
  end loop;
end $$;
create unique index if not exists profiles_user_code_unique on public.profiles(user_code) where user_code is not null;

create or replace function public.handle_admin_profile_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
declare proposed_uid text; invite text; referrer uuid;
begin
  invite := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code','')));
  select p.id into referrer from public.profiles p where upper(p.referral_code) = invite limit 1;
  loop
    proposed_uid := coalesce(nullif(new.raw_user_meta_data ->> 'public_uid',''), lpad((floor(10000000 + random() * 90000000))::bigint::text,8,'0'));
    exit when proposed_uid ~ '^[0-9]{8}$' and not exists (select 1 from public.profiles p where p.user_code = proposed_uid);
  end loop;
  insert into public.profiles(id,email,phone,role,status,balance,user_code,referral_code,referred_by,created_at,updated_at)
    values (new.id, coalesce(new.email, new.phone || '@phone.local'), new.phone, 'user','active',0,proposed_uid,proposed_uid,referrer,coalesce(new.created_at,now()),now())
    on conflict (id) do update set
      user_code = case when public.profiles.user_code ~ '^[0-9]{8}$' then public.profiles.user_code else excluded.user_code end,
      referral_code = case when public.profiles.referral_code ~ '^[0-9]{8}$' then public.profiles.referral_code else excluded.referral_code end,
      phone = coalesce(public.profiles.phone, excluded.phone),
      updated_at = now();
  return new;
end;
$$;
revoke all on function public.handle_admin_profile_signup() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_admin_dashboard on auth.users;
create trigger on_auth_user_created_admin_dashboard after insert on auth.users
  for each row execute function public.handle_admin_profile_signup();

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','sub_admin','super_admin')),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

do $$
declare item record; candidate text;
begin
  for item in select u.id,u.email,u.phone,u.created_at from auth.users u left join public.profiles p on p.id=u.id where p.id is null loop
    loop
      candidate := lpad((floor(10000000 + random() * 90000000))::bigint::text,8,'0');
      exit when not exists (select 1 from public.profiles p where p.user_code=candidate);
    end loop;
    insert into public.profiles(id,email,phone,role,status,balance,user_code,referral_code,created_at,updated_at)
      values(item.id,coalesce(item.email,item.phone||'@phone.local'),item.phone,'user','active',0,candidate,candidate,coalesce(item.created_at,now()),now()) on conflict(id) do nothing;
  end loop;
end $$;

insert into public.user_roles(user_id,role)
select p.id, case p.role when 'super_admin' then 'super_admin' when 'admin' then 'admin' when 'sub_admin' then 'sub_admin' else null end
from public.profiles p where p.role in ('super_admin','admin','sub_admin')
on conflict (user_id,role) do nothing;

create table if not exists public.sub_admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  permissions jsonb not null default '{"users.read":true,"transactions.review":true,"audit.read":true}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payout_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null,
  account_name text not null,
  account_number text not null,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  linked_at timestamptz not null default now(),
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit','withdrawal')),
  amount numeric(18,2) not null check (amount > 0),
  method text not null,
  sender_account text,
  sender_name text,
  receiver_account text,
  recipient_name text,
  recipient_account text,
  slip_last5 text,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','completed','failed')),
  reason text,
  transfer_reference text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transaction_requests add column if not exists sender_name text;

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdrawal','bet','win','bonus','commission','vault','withdrawal_hold','withdrawal_release','adjustment')),
  amount numeric(18,2) not null,
  detail text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id text not null,
  market_id text not null,
  duration_seconds integer not null check (duration_seconds in (30,60,180,300)),
  side text not null check (side in ('up','down')),
  amount numeric(18,2) not null check (amount > 0),
  result text check (result in ('up','down')),
  status text not null default 'pending' check (status in ('pending','won','lost')),
  payout numeric(18,2) not null default 0,
  profit_loss numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.bets add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bets add column if not exists round_id text not null default '';
alter table public.bets add column if not exists market_id text not null default '';
alter table public.bets add column if not exists duration_seconds integer not null default 60;
alter table public.bets add column if not exists side text not null default 'up';
alter table public.bets add column if not exists amount numeric(18,2) not null default 0;
alter table public.bets add column if not exists result text;
alter table public.bets add column if not exists status text not null default 'pending';
alter table public.bets add column if not exists payout numeric(18,2) not null default 0;
alter table public.bets add column if not exists profit_loss numeric(18,2) not null default 0;
alter table public.bets add column if not exists created_at timestamptz not null default now();
alter table public.bets add column if not exists settled_at timestamptz;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references auth.users(id),
  staff_email text not null default '',
  action_type text not null,
  target_id text,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  login_at timestamptz not null default now(),
  logout_at timestamptz,
  device text,
  ip_address inet,
  status text not null default 'success' check (status in ('success','failed')),
  risk_flag text
);

create index if not exists requests_created_idx on public.transaction_requests(created_at desc);
create index if not exists requests_user_idx on public.transaction_requests(user_id, created_at desc);
create index if not exists wallet_transactions_user_idx on public.wallet_transactions(user_id, created_at desc);
create index if not exists bets_user_idx on public.bets(user_id, created_at desc);
create index if not exists login_history_user_idx on public.login_history(user_id, login_at desc);
create index if not exists audit_logs_created_idx on public.admin_audit_logs(created_at desc);

create or replace function public.has_admin_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid())
      and r.role in ('admin','sub_admin','super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'super_admin'
  );
$$;

create or replace function public.ensure_my_public_id()
returns table(user_code text, referral_code text) language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid; current_code text; current_referral text; candidate text;
begin
  current_user_id := (select auth.uid());
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select p.user_code,p.referral_code into current_code,current_referral from public.profiles p where p.id=current_user_id for update;
  if current_code is null or current_code !~ '^[0-9]{8}$' then
    loop
      candidate := lpad((floor(10000000 + random() * 90000000))::bigint::text,8,'0');
      exit when not exists (select 1 from public.profiles p where p.user_code=candidate);
    end loop;
    current_code := candidate;
  end if;
  current_referral := coalesce(nullif(current_referral,''),current_code);
  update public.profiles set user_code=current_code, referral_code=current_referral, updated_at=now() where id=current_user_id;
  return query select current_code,current_referral;
end;
$$;

revoke all on function public.has_admin_access() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.ensure_my_public_id() from public;
grant execute on function public.has_admin_access() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.ensure_my_public_id() to authenticated;

-- Remove prior policies on these admin data tables before installing the scoped policy set.
do $$
declare t text; p record;
begin
  foreach t in array array['profiles','user_roles','sub_admin_access','payout_accounts','transaction_requests','wallet_transactions','bets','admin_audit_logs','login_history'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sub_admin_access enable row level security;
alter table public.payout_accounts enable row level security;
alter table public.transaction_requests enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.bets enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.login_history enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.has_admin_access()));
create policy profiles_update_self_safe on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy user_roles_read_self_or_admin on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy sub_admin_access_read_self_or_admin on public.sub_admin_access for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy payout_accounts_read_owner_or_admin on public.payout_accounts for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy payout_accounts_insert_owner on public.payout_accounts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy payout_accounts_update_owner on public.payout_accounts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transaction_requests_read_owner_or_admin on public.transaction_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy transaction_requests_insert_owner on public.transaction_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and type = 'deposit' and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy wallet_transactions_read_owner_or_admin on public.wallet_transactions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy bets_read_owner_or_admin on public.bets for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy login_history_read_owner_or_admin on public.login_history for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_admin_access()));
create policy login_history_insert_self on public.login_history for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy admin_audit_read_admin on public.admin_audit_logs for select to authenticated
  using ((select public.has_admin_access()));

revoke all on public.user_roles, public.sub_admin_access, public.admin_audit_logs, public.wallet_transactions, public.bets from anon, authenticated;
revoke all on public.profiles, public.payout_accounts, public.transaction_requests, public.login_history from anon, authenticated;
grant select on public.user_roles, public.sub_admin_access, public.admin_audit_logs, public.wallet_transactions, public.bets to authenticated;
grant select on public.profiles, public.payout_accounts, public.transaction_requests, public.login_history to authenticated;
grant insert (user_id, type, amount, method, sender_account, sender_name, receiver_account, slip_last5, receipt_url) on public.transaction_requests to authenticated;
grant insert (user_id, method, account_name, account_number) on public.payout_accounts to authenticated;
grant update (method, account_name, account_number) on public.payout_accounts to authenticated;
grant insert (user_id, device, status) on public.login_history to authenticated;
grant update (username, full_name) on public.profiles to authenticated;

create or replace function public.assign_sub_admin(p_identifier text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not (select public.is_super_admin()) then raise exception 'Only a super admin can manage sub-admin access'; end if;
  select p.id into target from public.profiles p
    where lower(p.email) = lower(trim(p_identifier)) or p.user_code = trim(p_identifier) limit 1;
  if target is null then raise exception 'User not found'; end if;
  insert into public.user_roles(user_id, role, granted_by) values (target, 'sub_admin', (select auth.uid()))
    on conflict (user_id, role) do nothing;
  insert into public.sub_admin_access(user_id,granted_by) values (target,(select auth.uid()))
    on conflict (user_id) do update set granted_by=excluded.granted_by;
  insert into public.admin_audit_logs(staff_id, staff_email, action_type, target_id, reason)
    values ((select auth.uid()), coalesce((select u.email from auth.users u where u.id = (select auth.uid())), ''), 'role.assign_sub_admin', target::text, 'Granted by super admin');
  return target;
end;
$$;

create or replace function public.remove_sub_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare old_email text;
begin
  if not (select public.is_super_admin()) then raise exception 'Only a super admin can manage sub-admin access'; end if;
  select p.email into old_email from public.profiles p where p.id = p_user_id;
  delete from public.user_roles where user_id = p_user_id and role = 'sub_admin';
  delete from public.sub_admin_access where user_id = p_user_id;
  insert into public.admin_audit_logs(staff_id, staff_email, action_type, target_id, reason)
    values ((select auth.uid()), coalesce((select u.email from auth.users u where u.id = (select auth.uid())), ''), 'role.remove_sub_admin', p_user_id::text, 'Revoked by super admin');
end;
$$;

create or replace function public.admin_update_user_status(p_user_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_status text;
begin
  if not (select public.has_admin_access()) then raise exception 'Admin access required'; end if;
  if p_status not in ('active','suspended','flagged') or length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Valid status and reason are required'; end if;
  select status into old_status from public.profiles where id = p_user_id for update;
  if old_status is null then raise exception 'User not found'; end if;
  update public.profiles set status = p_status, updated_at = now() where id = p_user_id;
  insert into public.admin_audit_logs(staff_id, staff_email, action_type, target_id, reason, metadata)
    values ((select auth.uid()), coalesce((select u.email from auth.users u where u.id = (select auth.uid())), ''), 'user.status_change', p_user_id::text, trim(p_reason), jsonb_build_object('before', old_status, 'after', p_status));
end;
$$;

create or replace function public.record_admin_audit(p_action_type text, p_target_id text, p_reason text, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.has_admin_access()) then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'Audit reason is required'; end if;
  insert into public.admin_audit_logs(staff_id,staff_email,action_type,target_id,reason,metadata)
    values ((select auth.uid()),coalesce((select u.email from auth.users u where u.id=(select auth.uid())),''),p_action_type,p_target_id,trim(p_reason),coalesce(p_metadata,'{}'::jsonb));
end;
$$;

create or replace function public.request_withdrawal(p_amount numeric, p_method text, p_recipient text, p_account text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare request_id uuid; current_balance numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select balance into current_balance from public.profiles where id = (select auth.uid()) for update;
  if current_balance < p_amount then raise exception 'Insufficient available balance'; end if;
  update public.profiles set balance = balance - p_amount, frozen_balance = frozen_balance + p_amount where id = (select auth.uid());
  insert into public.transaction_requests(user_id,type,amount,method,recipient_name,recipient_account,status)
    values ((select auth.uid()),'withdrawal',p_amount,p_method,p_recipient,p_account,'pending') returning id into request_id;
  insert into public.wallet_transactions(user_id,kind,amount,detail,reference_id)
    values ((select auth.uid()),'withdrawal_hold',-p_amount,'Withdrawal amount held',request_id);
  return request_id;
end;
$$;

create or replace function public.review_transaction_request(p_request_id uuid, p_action text, p_reason text default null, p_reference text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare req public.transaction_requests%rowtype; staff_email text;
begin
  if not (select public.has_admin_access()) then raise exception 'Admin access required'; end if;
  select * into req from public.transaction_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Transaction request not found'; end if;
  staff_email := coalesce((select u.email from auth.users u where u.id = (select auth.uid())), '');
  if req.type = 'deposit' and req.status = 'pending' then
    if p_action = 'complete' then
      update public.profiles set balance = balance + req.amount, total_deposit = total_deposit + req.amount where id = req.user_id;
      insert into public.wallet_transactions(user_id,kind,amount,detail,reference_id) values (req.user_id,'deposit',req.amount,req.method || ' deposit',req.id);
      update public.transaction_requests set status='completed', reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now() where id=req.id;
    elsif p_action = 'reject' and length(trim(coalesce(p_reason,''))) >= 3 then
      update public.transaction_requests set status='failed', reason=trim(p_reason), reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now() where id=req.id;
    else raise exception 'Invalid deposit review action'; end if;
  elsif req.type = 'withdrawal' then
    if p_action = 'approve' and req.status = 'pending' then
      update public.transaction_requests set status='approved', reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now() where id=req.id;
    elsif p_action = 'reject' and req.status in ('pending','approved') and length(trim(coalesce(p_reason,''))) >= 3 then
      update public.profiles set balance=balance+req.amount, frozen_balance=greatest(0,frozen_balance-req.amount) where id=req.user_id;
      insert into public.wallet_transactions(user_id,kind,amount,detail,reference_id) values (req.user_id,'withdrawal_release',req.amount,'Withdrawal rejected · funds released',req.id);
      update public.transaction_requests set status='rejected', reason=trim(p_reason), reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now() where id=req.id;
    elsif p_action = 'complete' and req.status = 'approved' and length(trim(coalesce(p_reference,''))) >= 3 then
      update public.profiles set frozen_balance=greatest(0,frozen_balance-req.amount), total_withdrawal=total_withdrawal+req.amount where id=req.user_id;
      insert into public.wallet_transactions(user_id,kind,amount,detail,reference_id) values (req.user_id,'withdrawal',-req.amount,'Withdrawal completed · ' || req.method,req.id);
      update public.transaction_requests set status='completed', transfer_reference=trim(p_reference), reviewed_by=(select auth.uid()), reviewed_at=now(), updated_at=now() where id=req.id;
    else raise exception 'Invalid withdrawal review action'; end if;
  else raise exception 'Request is already resolved'; end if;
  insert into public.admin_audit_logs(staff_id,staff_email,action_type,target_id,reason,metadata)
    values ((select auth.uid()),staff_email,'transaction.' || p_action,req.id::text,coalesce(nullif(trim(p_reason),''),coalesce(trim(p_reference),''),'Reviewed'),jsonb_build_object('type',req.type,'amount',req.amount,'status_before',req.status));
end;
$$;

create or replace function public.record_login_event(p_device text default null, p_ip inet default null, p_status text default 'success')
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  insert into public.login_history(user_id,device,ip_address,status) values ((select auth.uid()),p_device,p_ip,p_status) returning id into event_id;
  update public.profiles set last_login_at=now(), device_info=p_device where id=(select auth.uid());
  return event_id;
end;
$$;

create or replace function public.record_logout_event()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return; end if;
  update public.login_history set logout_at=now()
    where id=(select h.id from public.login_history h where h.user_id=(select auth.uid()) and h.logout_at is null order by h.login_at desc limit 1);
end;
$$;

revoke all on function public.assign_sub_admin(text) from public;
revoke all on function public.remove_sub_admin(uuid) from public;
revoke all on function public.admin_update_user_status(uuid,text,text) from public;
revoke all on function public.record_admin_audit(text,text,text,jsonb) from public;
revoke all on function public.request_withdrawal(numeric,text,text,text) from public;
revoke all on function public.review_transaction_request(uuid,text,text,text) from public;
revoke all on function public.record_login_event(text,inet,text) from public;
revoke all on function public.record_logout_event() from public;
grant execute on function public.assign_sub_admin(text), public.remove_sub_admin(uuid), public.admin_update_user_status(uuid,text,text), public.record_admin_audit(text,text,text,jsonb), public.request_withdrawal(numeric,text,text,text), public.review_transaction_request(uuid,text,text,text), public.record_login_event(text,inet,text), public.record_logout_event() to authenticated;

insert into public.user_roles(user_id,role)
select u.id,'super_admin' from auth.users u where lower(u.email)='acagaming75@gmail.com'
on conflict (user_id,role) do nothing;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['profiles','user_roles','sub_admin_access','transaction_requests','payout_accounts','wallet_transactions','bets','admin_audit_logs','login_history'] loop
      if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

commit;
