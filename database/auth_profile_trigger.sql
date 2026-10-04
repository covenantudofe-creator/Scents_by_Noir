-- Keep one profile per Supabase Auth user. Applies to email/password and OAuth sign-ups.
-- Safe to re-run; the trigger is replaced rather than duplicated.

create or replace function public.handle_new_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(new.email, '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(
      nullif(excluded.full_name, ''),
      public.profiles.full_name
    ),
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_created on auth.users;

create trigger on_auth_user_profile_created
after insert or update of raw_user_meta_data, email on auth.users
for each row execute function public.handle_new_auth_profile();

-- Keep profile self-service fields editable without letting a user promote their own role.
revoke update on table public.profiles from public, anon, authenticated;
grant update (full_name, phone, address, city, state, email)
on table public.profiles to authenticated;
