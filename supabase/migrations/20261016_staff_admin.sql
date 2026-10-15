-- Managing who has access, from Settings → People with access (needs 20261016_lock_down.sql).
-- Only staff can call these. The person needs a Supabase account first (Authentication → Users → Add user);
-- creating accounts needs the admin key, which must never be in the website.
-- Run once in Supabase → SQL Editor. Safe to run again.

create or replace function public.list_staff()
returns table (user_id uuid, email text, added_at timestamptz, last_sign_in_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  return query
    select s.user_id, coalesce(u.email, s.email)::text, s.added_at, u.last_sign_in_at, s.user_id = auth.uid()
    from public.staff s left join auth.users u on u.id = s.user_id
    order by s.added_at;
end;
$$;

create or replace function public.add_staff(p_email text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
  found_email text;
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  select id, email into uid, found_email from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'There’s no Supabase account for % yet. Create it first: Supabase → Authentication → Users → Add user.', trim(p_email);
  end if;
  if exists (select 1 from public.staff where user_id = uid) then
    raise exception '% already has access.', found_email;
  end if;
  insert into public.staff (user_id, email) values (uid, found_email);
  return found_email;
end;
$$;

create or replace function public.remove_staff(p_user_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare gone text;
begin
  if not public.is_staff() then raise exception 'Not allowed.' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'You can’t remove your own access.'; end if;
  if (select count(*) from public.staff) <= 1 then raise exception 'At least one person must keep access.'; end if;
  delete from public.staff where user_id = p_user_id returning email into gone;
  if gone is null then raise exception 'This person no longer has access.'; end if;
  return gone;
end;
$$;

revoke all on function public.list_staff(), public.add_staff(text), public.remove_staff(uuid) from public, anon;
grant execute on function public.list_staff(), public.add_staff(text), public.remove_staff(uuid) to authenticated;
