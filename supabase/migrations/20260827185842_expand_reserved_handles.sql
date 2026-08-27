-- O-027. Reserved vocabulary.
-- Deliberately excluded: personal and family names. Mahama, Akufo, Kufuor, Rawlings,
-- Mills, Atta, Nana, Nii, Naa, Osei and Togbe are borne by ordinary Ghanaians, and
-- D-021 says identity is verified and belonging is never questioned. Individual
-- impersonation is handled by identity verification and the Code of Conduct ladder,
-- not by forbidding people their own name.

-- Ghanaian state, offices and institutions
insert into public.reserved_handles (handle, reason) values
  ('presidency','institutional'),('vicepresident','institutional'),('vicepresidency','institutional'),
  ('parliament','institutional'),('parliamentofghana','institutional'),('speaker','institutional'),
  ('flagstaff','institutional'),('flagstaffhouse','institutional'),('jubileehouse','institutional'),
  ('cabinet','institutional'),('attorneygeneral','institutional'),('judiciary','institutional'),
  ('supremecourt','institutional'),('chiefjustice','institutional'),
  ('police','institutional'),('ghanapolice','institutional'),('army','institutional'),
  ('military','institutional'),('immigration','institutional'),('customs','institutional'),
  ('nia','institutional'),('ghanacard','institutional'),('passport','institutional'),
  ('passports','institutional'),('visa','institutional'),('visas','institutional'),
  ('citizenship','institutional'),('abode','institutional'),('rightofabode','institutional'),
  ('interior','institutional'),('foreignaffairs','institutional'),('finance','institutional'),
  ('bankofghana','institutional'),('electoralcommission','institutional'),
  ('daoop','institutional'),('diasporaaffairs','institutional'),('diaspora','institutional'),
  ('consulate','institutional'),('highcommission','institutional'),('ambassador','institutional'),
  ('asantehene','institutional'),('otumfuo','institutional'),('houseofchiefs','institutional'),
  ('africanunion','institutional'),('unitednations','institutional')
on conflict (handle) do nothing;

-- Region 17's own vocabulary. These carry institutional meaning and must not be claimable.
insert into public.reserved_handles (handle, reason) values
  ('verified','institutional'),('region17verified','institutional'),('r17verified','institutional'),
  ('skillsexchange','institutional'),('exchange','institutional'),('credential','institutional'),
  ('credentials','institutional'),('fellow','institutional'),('fellows','institutional'),
  ('faculty','institutional'),('foundingfaculty','institutional'),('assessor','institutional'),
  ('assessors','institutional'),('spotlight','institutional'),('regionalspotlight','institutional'),
  ('townhalls','institutional'),('advisorycouncil','institutional'),('governance','institutional'),
  ('registry','institutional'),('foundation','institutional'),('services','institutional'),
  ('partner','institutional'),('partners','institutional'),('sponsor','institutional'),
  ('sponsors','institutional'),('donate','institutional'),('giving','institutional')
on conflict (handle) do nothing;

-- Roles and routing words. Anything that could be mistaken for the platform speaking.
insert into public.reserved_handles (handle, reason) values
  ('moderator','institutional'),('mod','institutional'),('owner','institutional'),
  ('superuser','institutional'),('sysadmin','institutional'),('webmaster','institutional'),
  ('postmaster','institutional'),('hostmaster','institutional'),('abuse','institutional'),
  ('noreply','institutional'),('donotreply','institutional'),('hello','institutional'),
  ('info','institutional'),('careers','institutional'),('jobs','institutional'),
  ('media','institutional'),('blog','institutional'),('docs','institutional'),
  ('status','institutional'),('assets','institutional'),('static','institutional'),
  ('files','institutional'),('download','institutional'),('app','institutional'),
  ('oauth','institutional'),('sso','institutional'),('token','institutional'),
  ('session','institutional'),('callback','institutional'),('webhook','institutional'),
  ('webhooks','institutional'),('graphql','institutional'),('health','institutional'),
  ('test','institutional'),('demo','institutional'),('example','institutional'),
  ('sample','institutional'),('null','institutional'),('undefined','institutional'),
  ('none','institutional'),('new','institutional'),('create','institutional'),
  ('edit','institutional'),('update','institutional'),('delete','institutional'),
  ('search','institutional'),('explore','institutional'),('discover','institutional'),
  ('browse','institutional'),('index','institutional'),('feed','institutional'),
  ('notifications','institutional'),('messages','institutional'),('inbox','institutional'),
  ('connect','institutional'),('connections','institutional'),('invite','institutional'),
  ('invites','institutional'),('referral','institutional'),('regions','institutional')
on conflict (handle) do nothing;

-- The sixteen Ghanaian regions, read live from ghana_regions rather than duplicated.
insert into public.reserved_handles (handle, reason)
select g.slug::citext, 'region' from public.ghana_regions g
on conflict (handle) do nothing;

-- Chapter-leader addresses, held for assignment rather than claim.
insert into public.reserved_handles (handle, reason)
select (g.slug || '-chapter')::citext, 'chapter' from public.ghana_regions g
on conflict (handle) do nothing;

insert into public.reserved_handles (handle, reason)
select c.slug::citext, 'chapter' from public.chapters c
on conflict (handle) do nothing;

insert into public.reserved_handles (handle, reason)
select (c.slug || '-chapter')::citext, 'chapter' from public.chapters c
on conflict (handle) do nothing;

-- Keep chapter reservations current as chapters are created or renamed.
create or replace function public.reserve_chapter_slug()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'extensions'
as $function$
BEGIN
  INSERT INTO public.reserved_handles (handle, reason)
  VALUES (NEW.slug::citext, 'chapter'), ((NEW.slug || '-chapter')::citext, 'chapter')
  ON CONFLICT (handle) DO NOTHING;
  RETURN NULL;
END; $function$;

drop trigger if exists chapters_reserve_slug on public.chapters;
create trigger chapters_reserve_slug
  after insert or update of slug on public.chapters
  for each row execute function public.reserve_chapter_slug();

-- Prohibited terms. Seed set only: unambiguous English-language racial and ethnic
-- slurs. Normalization means leetspeak and spaced variants are caught automatically.
-- This list is English-heavy and incomplete by construction. It is a starting point,
-- not a solution, and should be replaced with a maintained multilingual wordlist.
-- Deliberately narrow: an over-broad list blocks legitimate Twi, Ga and Ewe names,
-- which for this institution is a worse failure than an occasional miss.
insert into public.reserved_handles (handle, reason) values
  ('nigger','prohibited'),('nigga','prohibited'),('coon','prohibited'),
  ('kike','prohibited'),('spic','prohibited'),('chink','prohibited'),
  ('gook','prohibited'),('wetback','prohibited'),('paki','prohibited'),
  ('faggot','prohibited'),('tranny','prohibited'),('retard','prohibited'),
  ('nazi','prohibited'),('hitler','prohibited'),('kkk','prohibited'),
  ('whitepower','prohibited'),('slaver','prohibited')
on conflict (handle) do nothing;
