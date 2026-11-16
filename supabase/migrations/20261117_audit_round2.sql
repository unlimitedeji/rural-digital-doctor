-- Landu security audit, round 2 (2026-11-17). Applied as migration audit_round2_2026_11_17.

-- 1. Partners (pharmacies, labs) get a contact snapshot on each order instead of the patient's whole profile.
alter table public.prescriptions add column if not exists partner_contact jsonb;
alter table public.lab_orders   add column if not exists partner_contact jsonb;

create or replace function public.send_to_partner(p_kind text, p_id uuid, p_partner uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pk text; c jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select kind into pk from public.partners where id = p_partner and active;
  if pk is null then raise exception 'Partner not found'; end if;
  select jsonb_build_object('name', p.full_name, 'phone', p.phone) into c from public.profiles p where p.id = uid;
  if p_kind = 'prescription' then
    if pk <> 'pharmacy' then raise exception 'Choose a pharmacy'; end if;
    -- A pharmacy needs allergies to dispense safely.
    select c || jsonb_build_object('allergies', p.allergies) into c from public.profiles p where p.id = uid;
    update public.prescriptions set partner_id = p_partner, fulfilment_status = 'sent', partner_contact = c
     where id = p_id and patient_id = uid and fulfilment_status in ('not_sent','sent');
  elsif p_kind = 'lab' then
    if pk <> 'lab' then raise exception 'Choose a lab'; end if;
    update public.lab_orders set partner_id = p_partner, status = 'sent', updated_at = now(), partner_contact = c
     where id = p_id and patient_id = uid and status in ('ordered','sent');
  else
    raise exception 'Unknown order type';
  end if;
  if not found then raise exception 'Order not found or already being handled'; end if;
end $$;

-- Fill the snapshot for orders already sent, then remove partner access to profiles.
update public.prescriptions r set partner_contact = jsonb_build_object('name', p.full_name, 'phone', p.phone, 'allergies', p.allergies)
  from public.profiles p where p.id = r.patient_id and r.partner_id is not null and r.partner_contact is null;
update public.lab_orders r set partner_contact = jsonb_build_object('name', p.full_name, 'phone', p.phone)
  from public.profiles p where p.id = r.patient_id and r.partner_id is not null and r.partner_contact is null;
drop policy if exists "partner sees own customers" on public.profiles;
drop function if exists private.is_partner_customer(uuid);

-- 2. A no-show releases the held fee to the doctor, who kept the slot free.
create or replace function public.doctor_update_visit(p_appointment uuid, p_status public.appointment_status) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); a public.appointments%rowtype;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into a from public.appointments where id = p_appointment and doctor_id = uid for update;
  if not found then raise exception 'Visit not found'; end if;
  if not ((a.status = 'confirmed' and p_status in ('in_progress','no_show'))
       or (a.status = 'in_progress' and p_status = 'completed')) then
    raise exception 'That change is not allowed';
  end if;
  if p_status = 'no_show' and a.starts_at > now() then raise exception 'You can mark a no-show only after the visit time'; end if;
  update public.appointments set status = p_status where id = a.id;
  if p_status in ('completed','no_show') then
    update public.payments set status = 'released', updated_at = now() where appointment_id = a.id and status = 'held';
  end if;
end $$;

-- 3. Admin powers need two-step sign-in (an authenticator code in this session).
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

-- 4. Account deletion requests, reviewed by an admin.
create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text check (char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending','done','rejected')),
  review_note text check (char_length(review_note) <= 500),
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists deletion_one_pending on public.deletion_requests(user_id) where status = 'pending';
create index if not exists deletion_status_idx on public.deletion_requests(status);
alter table public.deletion_requests enable row level security;
create policy "user asks for own deletion" on public.deletion_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user or admin reads" on public.deletion_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
revoke all on public.deletion_requests from anon, authenticated;
grant select on public.deletion_requests to authenticated;
grant insert (user_id, reason) on public.deletion_requests to authenticated;

-- Admin carries out a request: personal details are erased; clinical records the law may require are kept.
create or replace function public.review_deletion(p_id uuid, p_approve boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.deletion_requests%rowtype;
begin
  if not private.is_admin() then raise exception 'Not allowed'; end if;
  select * into r from public.deletion_requests where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  if r.status <> 'pending' then raise exception 'Already handled'; end if;
  if p_approve then
    update public.profiles set full_name = 'Deleted account', phone = null, address = null, date_of_birth = null,
           town = null, state = null, allergies = null, conditions = null, past_surgeries = null
     where id = r.user_id;
    delete from public.vitals where patient_id = r.user_id;
    delete from public.identity_verifications where user_id = r.user_id;
    -- The identity photos themselves are removed by the app (storage API) just before this call.
  end if;
  update public.deletion_requests
     set status = case when p_approve then 'done' else 'rejected' end,
         review_note = left(p_note, 500), handled_by = auth.uid(), handled_at = now()
   where id = p_id;
end $$;
revoke all on function public.review_deletion(uuid, boolean, text) from public, anon;
grant execute on function public.review_deletion(uuid, boolean, text) to authenticated;

-- Admins may remove identity photos when carrying out a deletion request.
create policy "admin deletes identity files" on storage.objects for delete to authenticated
  using (bucket_id = 'identity' and private.is_admin());
