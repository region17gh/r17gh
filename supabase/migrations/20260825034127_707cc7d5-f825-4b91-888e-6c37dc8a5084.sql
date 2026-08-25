-- ============================================================
-- Region 17 Ghana — pass 1: membership register schema + RLS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- enums ----------
CREATE TYPE public.member_status AS ENUM ('pending_verification','active','dormant','suspended','revoked');
CREATE TYPE public.consent_type AS ENUM ('directory_visibility','institutional_discoverability','daoop_sharing','marketing','aggregate_research','townhall_invites','programme_updates');
CREATE TYPE public.standing_type AS ENUM ('founding_member','contributing_member','fellow','chapter_leader','honours');
CREATE TYPE public.visibility_level AS ENUM ('hidden','institutions','members','public');
CREATE TYPE public.connection_type AS ENUM ('ghanaian_abroad','ghanaian_heritage','african_diaspora','ghanaian_at_home','african_continental','ally');
CREATE TYPE public.been_to_ghana AS ENUM ('never','once','several_times','lived_there','live_there');
CREATE TYPE public.conduct_level AS ENUM ('note','warning','restriction','suspension','revocation');

-- ---------- shared trigger: updated_at ----------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- reference tables ----------
CREATE TABLE public.countries (
  code char(2) PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.ghana_regions (
  slug text PRIMARY KEY,
  name text NOT NULL,
  sort_order smallint NOT NULL
);

CREATE TABLE public.reserved_handles (
  handle citext PRIMARY KEY,
  reason text NOT NULL DEFAULT 'institutional'
);

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER app_config_touch BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT ON public.countries TO anon, authenticated;
GRANT SELECT ON public.ghana_regions TO anon, authenticated;
GRANT SELECT ON public.reserved_handles TO authenticated;
GRANT SELECT ON public.app_config TO anon, authenticated;
GRANT ALL ON public.countries, public.ghana_regions, public.reserved_handles, public.app_config TO service_role;

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghana_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "countries readable" ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "regions readable" ON public.ghana_regions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reserved handles readable to members" ON public.reserved_handles FOR SELECT TO authenticated USING (true);
CREATE POLICY "config readable" ON public.app_config FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.countries (code, name) VALUES
('AF','Afghanistan'),('AX','Åland Islands'),('AL','Albania'),('DZ','Algeria'),('AS','American Samoa'),('AD','Andorra'),('AO','Angola'),('AI','Anguilla'),('AQ','Antarctica'),('AG','Antigua & Barbuda'),('AR','Argentina'),('AM','Armenia'),('AW','Aruba'),('AU','Australia'),('AT','Austria'),('AZ','Azerbaijan'),('BS','Bahamas'),('BH','Bahrain'),('BD','Bangladesh'),('BB','Barbados'),('BY','Belarus'),('BE','Belgium'),('BZ','Belize'),('BJ','Benin'),('BM','Bermuda'),('BT','Bhutan'),('BO','Bolivia'),('BQ','Caribbean Netherlands'),('BA','Bosnia & Herzegovina'),('BW','Botswana'),('BV','Bouvet Island'),('BR','Brazil'),('IO','British Indian Ocean Territory'),('BN','Brunei'),('BG','Bulgaria'),('BF','Burkina Faso'),('BI','Burundi'),('CV','Cape Verde'),('KH','Cambodia'),('CM','Cameroon'),('CA','Canada'),('KY','Cayman Islands'),('CF','Central African Republic'),('TD','Chad'),('CL','Chile'),('CN','China'),('CX','Christmas Island'),('CC','Cocos (Keeling) Islands'),('CO','Colombia'),('KM','Comoros'),('CG','Congo - Brazzaville'),('CD','Congo - Kinshasa'),('CK','Cook Islands'),('CR','Costa Rica'),('CI','Côte d’Ivoire'),('HR','Croatia'),('CU','Cuba'),('CW','Curaçao'),('CY','Cyprus'),('CZ','Czechia'),('DK','Denmark'),('DJ','Djibouti'),('DM','Dominica'),('DO','Dominican Republic'),('EC','Ecuador'),('EG','Egypt'),('SV','El Salvador'),('GQ','Equatorial Guinea'),('ER','Eritrea'),('EE','Estonia'),('SZ','Eswatini'),('ET','Ethiopia'),('FK','Falkland Islands'),('FO','Faroe Islands'),('FJ','Fiji'),('FI','Finland'),('FR','France'),('GF','French Guiana'),('PF','French Polynesia'),('TF','French Southern Territories'),('GA','Gabon'),('GM','Gambia'),('GE','Georgia'),('DE','Germany'),('GH','Ghana'),('GI','Gibraltar'),('GR','Greece'),('GL','Greenland'),('GD','Grenada'),('GP','Guadeloupe'),('GU','Guam'),('GT','Guatemala'),('GG','Guernsey'),('GN','Guinea'),('GW','Guinea-Bissau'),('GY','Guyana'),('HT','Haiti'),('HM','Heard & McDonald Islands'),('VA','Vatican City'),('HN','Honduras'),('HK','Hong Kong SAR China'),('HU','Hungary'),('IS','Iceland'),('IN','India'),('ID','Indonesia'),('IR','Iran'),('IQ','Iraq'),('IE','Ireland'),('IM','Isle of Man'),('IL','Israel'),('IT','Italy'),('JM','Jamaica'),('JP','Japan'),('JE','Jersey'),('JO','Jordan'),('KZ','Kazakhstan'),('KE','Kenya'),('KI','Kiribati'),('KP','North Korea'),('KR','South Korea'),('KW','Kuwait'),('KG','Kyrgyzstan'),('LA','Laos'),('LV','Latvia'),('LB','Lebanon'),('LS','Lesotho'),('LR','Liberia'),('LY','Libya'),('LI','Liechtenstein'),('LT','Lithuania'),('LU','Luxembourg'),('MO','Macao SAR China'),('MG','Madagascar'),('MW','Malawi'),('MY','Malaysia'),('MV','Maldives'),('ML','Mali'),('MT','Malta'),('MH','Marshall Islands'),('MQ','Martinique'),('MR','Mauritania'),('MU','Mauritius'),('YT','Mayotte'),('MX','Mexico'),('FM','Micronesia'),('MD','Moldova'),('MC','Monaco'),('MN','Mongolia'),('ME','Montenegro'),('MS','Montserrat'),('MA','Morocco'),('MZ','Mozambique'),('MM','Myanmar (Burma)'),('NA','Namibia'),('NR','Nauru'),('NP','Nepal'),('NL','Netherlands'),('NC','New Caledonia'),('NZ','New Zealand'),('NI','Nicaragua'),('NE','Niger'),('NG','Nigeria'),('NU','Niue'),('NF','Norfolk Island'),('MK','North Macedonia'),('MP','Northern Mariana Islands'),('NO','Norway'),('OM','Oman'),('PK','Pakistan'),('PW','Palau'),('PS','Palestinian Territories'),('PA','Panama'),('PG','Papua New Guinea'),('PY','Paraguay'),('PE','Peru'),('PH','Philippines'),('PN','Pitcairn Islands'),('PL','Poland'),('PT','Portugal'),('PR','Puerto Rico'),('QA','Qatar'),('RE','Réunion'),('RO','Romania'),('RU','Russia'),('RW','Rwanda'),('BL','St. Barthélemy'),('SH','St. Helena'),('KN','St. Kitts & Nevis'),('LC','St. Lucia'),('MF','St. Martin'),('PM','St. Pierre & Miquelon'),('VC','St. Vincent & Grenadines'),('WS','Samoa'),('SM','San Marino'),('ST','São Tomé & Príncipe'),('SA','Saudi Arabia'),('SN','Senegal'),('RS','Serbia'),('SC','Seychelles'),('SL','Sierra Leone'),('SG','Singapore'),('SX','Sint Maarten'),('SK','Slovakia'),('SI','Slovenia'),('SB','Solomon Islands'),('SO','Somalia'),('ZA','South Africa'),('GS','South Georgia & South Sandwich Islands'),('SS','South Sudan'),('ES','Spain'),('LK','Sri Lanka'),('SD','Sudan'),('SR','Suriname'),('SJ','Svalbard & Jan Mayen'),('SE','Sweden'),('CH','Switzerland'),('SY','Syria'),('TW','Taiwan'),('TJ','Tajikistan'),('TZ','Tanzania'),('TH','Thailand'),('TL','Timor-Leste'),('TG','Togo'),('TK','Tokelau'),('TO','Tonga'),('TT','Trinidad & Tobago'),('TN','Tunisia'),('TR','Türkiye'),('TM','Turkmenistan'),('TC','Turks & Caicos Islands'),('TV','Tuvalu'),('UG','Uganda'),('UA','Ukraine'),('AE','United Arab Emirates'),('GB','United Kingdom'),('US','United States'),('UM','U.S. Outlying Islands'),('UY','Uruguay'),('UZ','Uzbekistan'),('VU','Vanuatu'),('VE','Venezuela'),('VN','Vietnam'),('VG','British Virgin Islands'),('VI','U.S. Virgin Islands'),('WF','Wallis & Futuna'),('EH','Western Sahara'),('YE','Yemen'),('ZM','Zambia'),('ZW','Zimbabwe');

INSERT INTO public.ghana_regions (slug, name, sort_order) VALUES
('ahafo','Ahafo',1),('ashanti','Ashanti',2),('bono','Bono',3),('bono-east','Bono East',4),
('central','Central',5),('eastern','Eastern',6),('greater-accra','Greater Accra',7),('north-east','North East',8),
('northern','Northern',9),('oti','Oti',10),('savannah','Savannah',11),('upper-east','Upper East',12),
('upper-west','Upper West',13),('volta','Volta',14),('western','Western',15),('western-north','Western North',16);

INSERT INTO public.reserved_handles (handle) VALUES
('admin'),('administrator'),('api'),('about'),('account'),('accounts'),('auth'),('billing'),('board'),
('chapter'),('chapters'),('compact'),('conduct'),('contact'),('council'),('dashboard'),('directory'),
('embassy'),('founder'),('founders'),('ghana'),('ghanagov'),('gov'),('government'),('help'),('home'),
('institution'),('institutions'),('join'),('legal'),('login'),('logout'),('m'),('mail'),('member'),
('members'),('minister'),('ministry'),('news'),('official'),('officials'),('press'),('president'),
('privacy'),('profile'),('register'),('region17'),('region-17'),('r17'),('root'),('secretariat'),
('security'),('settings'),('signin'),('signup'),('staff'),('support'),('system'),('team'),('terms'),
('townhall'),('town-halls'),('verify'),('vicepresident'),('www');

INSERT INTO public.app_config (key, value) VALUES
('founding_member_cutoff', '"2026-12-31T23:59:59Z"'::jsonb),
('compact_version', '"1.0"'::jsonb),
('conduct_version', '"1.0"'::jsonb),
('privacy_version', '"1.0"'::jsonb),
('credential_prefix', '"R17"'::jsonb),
('number_reservation_ttl_minutes', '60'::jsonb);

-- ---------- credential check character (Damm, mod 10, letter-encoded) ----------
CREATE OR REPLACE FUNCTION public.damm_digit(digits text)
RETURNS smallint LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  m int[][] := ARRAY[
    [0,3,1,7,5,9,8,6,4,2],
    [7,0,9,2,1,5,4,8,6,3],
    [4,2,0,6,8,7,1,3,5,9],
    [1,7,5,0,9,8,3,4,2,6],
    [6,1,2,3,0,4,5,9,7,8],
    [3,6,7,4,2,0,9,5,8,1],
    [5,8,6,9,7,2,0,1,3,4],
    [8,9,4,5,3,6,2,0,1,7],
    [9,4,3,8,6,1,7,2,0,5],
    [2,5,8,1,4,3,6,7,9,0]];
  interim int := 0;
  i int;
BEGIN
  IF digits !~ '^[0-9]+$' THEN RAISE EXCEPTION 'damm_digit expects digits only'; END IF;
  FOR i IN 1..length(digits) LOOP
    interim := m[interim + 1][substr(digits, i, 1)::int + 1];
  END LOOP;
  RETURN interim::smallint;
END; $$;

-- Damm digit 0-9 mapped to an unambiguous letter alphabet.
CREATE OR REPLACE FUNCTION public.credential_id(join_year int, member_number int)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  yy text := lpad((join_year % 100)::text, 2, '0');
  nnn text := lpad(member_number::text, 6, '0');
  letters text := 'ACDEFHJKMN';
BEGIN
  RETURN 'R17-' || yy || '-' || nnn || '-' || substr(letters, public.damm_digit(yy || nnn) + 1, 1);
END; $$;

-- ---------- member number sequence ----------
CREATE SEQUENCE public.member_number_seq AS integer START WITH 1 INCREMENT BY 1 NO CYCLE;

-- ---------- members ----------
CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  member_number integer NOT NULL UNIQUE,
  credential_id text NOT NULL UNIQUE,
  handle citext UNIQUE,
  handle_changed_at timestamptz,
  first_name text,
  last_name text,
  display_name text,
  email citext UNIQUE,
  email_verified_at timestamptz,
  birth_month smallint CHECK (birth_month BETWEEN 1 AND 12),
  birth_year smallint CHECK (birth_year BETWEEN 1900 AND 2100),
  country char(2) REFERENCES public.countries(code),
  city text,
  timezone text NOT NULL DEFAULT 'UTC',
  connection_types public.connection_type[] NOT NULL DEFAULT '{}',
  primary_connection public.connection_type,
  region_interests text[] NOT NULL DEFAULT '{}',
  joined_at timestamptz NOT NULL DEFAULT now(),
  class_year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  status public.member_status NOT NULL DEFAULT 'pending_verification',
  last_affirmed_at timestamptz,
  chapter_id uuid,
  pseudonymized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT members_handle_format CHECK (handle IS NULL OR handle ~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$')
);

CREATE INDEX members_status_idx ON public.members(status);
CREATE INDEX members_user_id_idx ON public.members(user_id);

CREATE TRIGGER members_touch BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- founding member is derived from config, never stored as free input
CREATE OR REPLACE FUNCTION public.is_founding_member(m public.members)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT m.joined_at <= ((SELECT value #>> '{}' FROM public.app_config WHERE key = 'founding_member_cutoff')::timestamptz);
$$;

-- age gate: 18+ using month and year only (conservative: last day of birth month)
CREATE OR REPLACE FUNCTION public.enforce_member_rules()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  earliest date;
BEGIN
  -- class year is derived from the join date, never free input
  NEW.class_year := EXTRACT(YEAR FROM NEW.joined_at)::integer;

  IF NEW.birth_year IS NOT NULL AND NEW.birth_month IS NOT NULL THEN
    earliest := (make_date(NEW.birth_year, NEW.birth_month, 1) + interval '1 month - 1 day')::date;
    IF earliest > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'Members must be 18 or older.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.handle IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.reserved_handles r WHERE r.handle = NEW.handle) THEN
      RAISE EXCEPTION 'That handle is reserved.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.handle IS DISTINCT FROM OLD.handle THEN
      IF OLD.handle IS NOT NULL AND OLD.handle_changed_at IS NOT NULL THEN
        RAISE EXCEPTION 'A handle may be changed once only.' USING ERRCODE = 'check_violation';
      END IF;
      IF OLD.handle IS NOT NULL THEN
        NEW.handle_changed_at := now();
      END IF;
    ELSE
      NEW.handle_changed_at := OLD.handle_changed_at;
    END IF;
    -- permanent identifiers are never reissued or edited
    IF NEW.member_number IS DISTINCT FROM OLD.member_number
       OR NEW.credential_id IS DISTINCT FROM OLD.credential_id THEN
      RAISE EXCEPTION 'Member number and credential ID are permanent.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER members_rules BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_rules();

-- region interests must be real Ghanaian region slugs
CREATE OR REPLACE FUNCTION public.check_region_slugs()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE bad text;
BEGIN
  SELECT s INTO bad FROM unnest(NEW.region_interests) AS s
   WHERE NOT EXISTS (SELECT 1 FROM public.ghana_regions g WHERE g.slug = s) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown region: %', bad USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER members_region_slugs BEFORE INSERT OR UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.check_region_slugs();

-- current member helper (security definer avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.members WHERE user_id = auth.uid();
$$;

GRANT SELECT, INSERT, UPDATE ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own" ON public.members
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members insert own" ON public.members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "members update own" ON public.members
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- no DELETE policy: erasure runs through pseudonymisation, not row deletion

-- ---------- number reservations ----------
CREATE TABLE public.number_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number integer NOT NULL UNIQUE,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  claimed_at timestamptz
);
CREATE INDEX number_reservations_expiry_idx ON public.number_reservations(expires_at) WHERE claimed_by IS NULL;

GRANT ALL ON public.number_reservations TO service_role;
ALTER TABLE public.number_reservations ENABLE ROW LEVEL SECURITY;
-- deliberately no policies: trusted server code only

-- reserve a number: sequence + unique constraint, never read-then-write
CREATE OR REPLACE FUNCTION public.reserve_member_number()
RETURNS TABLE (member_number integer, credential_id text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n integer;
  ttl integer := COALESCE((SELECT (value #>> '{}')::int FROM public.app_config WHERE key = 'number_reservation_ttl_minutes'), 60);
  exp timestamptz;
BEGIN
  n := nextval('public.member_number_seq')::integer;
  exp := now() + make_interval(mins => ttl);
  INSERT INTO public.number_reservations (member_number, expires_at) VALUES (n, exp);
  RETURN QUERY SELECT n, public.credential_id(EXTRACT(YEAR FROM now())::int, n), exp;
END; $$;

REVOKE ALL ON FUNCTION public.reserve_member_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_member_number() TO service_role;

-- ---------- member_consents (append-only, revoke only) ----------
CREATE TABLE public.member_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  consent_type public.consent_type NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  policy_version text NOT NULL,
  mechanism text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_consents_member_idx ON public.member_consents(member_id, consent_type);
CREATE UNIQUE INDEX member_consents_one_active ON public.member_consents(member_id, consent_type) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.consents_revoke_only()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Consent records are append-only and cannot be deleted.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.consent_type IS DISTINCT FROM OLD.consent_type
     OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
     OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
     OR NEW.mechanism IS DISTINCT FROM OLD.mechanism
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only revoked_at may be set on a consent record.' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
    RAISE EXCEPTION 'A withdrawn consent cannot be rewritten.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER member_consents_append_only BEFORE UPDATE OR DELETE ON public.member_consents
  FOR EACH ROW EXECUTE FUNCTION public.consents_revoke_only();

GRANT SELECT, INSERT, UPDATE ON public.member_consents TO authenticated;
GRANT ALL ON public.member_consents TO service_role;
ALTER TABLE public.member_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents read own" ON public.member_consents
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());
CREATE POLICY "consents insert own" ON public.member_consents
  FOR INSERT TO authenticated WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "consents withdraw own" ON public.member_consents
  FOR UPDATE TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- ---------- affirmations (strictly append-only) ----------
CREATE TABLE public.affirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  affirmed_at timestamptz NOT NULL DEFAULT now(),
  compact_version text NOT NULL,
  conduct_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX affirmations_member_idx ON public.affirmations(member_id, affirmed_at DESC);

CREATE OR REPLACE FUNCTION public.block_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '% records are append-only.', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END; $$;

CREATE TRIGGER affirmations_append_only BEFORE UPDATE OR DELETE ON public.affirmations
  FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

GRANT SELECT, INSERT ON public.affirmations TO authenticated;
GRANT ALL ON public.affirmations TO service_role;
ALTER TABLE public.affirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affirmations read own" ON public.affirmations
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());
CREATE POLICY "affirmations insert own" ON public.affirmations
  FOR INSERT TO authenticated WITH CHECK (member_id = public.current_member_id());

-- ---------- member_intent ----------
CREATE TABLE public.member_intent (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  why_here text[] NOT NULL DEFAULT '{}',
  current_ask text,
  ask_updated_at timestamptz,
  current_offer text,
  offer_updated_at timestamptz,
  open_to text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER member_intent_touch BEFORE UPDATE ON public.member_intent
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_intent TO authenticated;
GRANT ALL ON public.member_intent TO service_role;
ALTER TABLE public.member_intent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intent own" ON public.member_intent
  FOR ALL TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- ---------- member_profiles ----------
CREATE TABLE public.member_profiles (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  role text,
  organization text,
  sector text,
  years_experience smallint,
  skills text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  curious_about text,
  usually_asked_about text,
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  been_to_ghana public.been_to_ghana,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER member_profiles_touch BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_profiles TO authenticated;
GRANT ALL ON public.member_profiles TO service_role;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile own" ON public.member_profiles
  FOR ALL TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- ---------- member_standing ----------
CREATE TABLE public.member_standing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  standing_type public.standing_type NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  evidence text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_standing_member_idx ON public.member_standing(member_id);

GRANT SELECT ON public.member_standing TO authenticated;
GRANT ALL ON public.member_standing TO service_role;
ALTER TABLE public.member_standing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "standing read own" ON public.member_standing
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());
-- granted only by trusted server code

-- ---------- member_contributions ----------
CREATE TABLE public.member_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  type text NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_contributions_member_idx ON public.member_contributions(member_id);

GRANT SELECT ON public.member_contributions TO authenticated;
GRANT ALL ON public.member_contributions TO service_role;
ALTER TABLE public.member_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contributions read own" ON public.member_contributions
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());

-- ---------- member_settings ----------
CREATE TABLE public.member_settings (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER member_settings_touch BEFORE UPDATE ON public.member_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.member_settings TO authenticated;
GRANT ALL ON public.member_settings TO service_role;
ALTER TABLE public.member_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings own" ON public.member_settings
  FOR ALL TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- ---------- member_visibility (everything hidden by default) ----------
CREATE TABLE public.member_visibility (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  identity public.visibility_level NOT NULL DEFAULT 'hidden',
  location public.visibility_level NOT NULL DEFAULT 'hidden',
  connection public.visibility_level NOT NULL DEFAULT 'hidden',
  work public.visibility_level NOT NULL DEFAULT 'hidden',
  intent public.visibility_level NOT NULL DEFAULT 'hidden',
  standing public.visibility_level NOT NULL DEFAULT 'hidden',
  links public.visibility_level NOT NULL DEFAULT 'hidden',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER member_visibility_touch BEFORE UPDATE ON public.member_visibility
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.member_visibility TO authenticated;
GRANT ALL ON public.member_visibility TO service_role;
ALTER TABLE public.member_visibility ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visibility own" ON public.member_visibility
  FOR ALL TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- ---------- conduct actions ----------
CREATE TABLE public.conduct_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  level public.conduct_level NOT NULL,
  reason text NOT NULL,
  conduct_version text NOT NULL,
  actor_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  actor_note text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  appeal_opened_at timestamptz,
  appeal_outcome text,
  appeal_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conduct_actions_member_idx ON public.conduct_actions(member_id, effective_from DESC);

GRANT ALL ON public.conduct_actions TO service_role;
ALTER TABLE public.conduct_actions ENABLE ROW LEVEL SECURITY;
-- no member-facing policies in this pass: written and read by trusted server code

-- ---------- chapters (scaffold, no UI) ----------
CREATE TABLE public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  country char(2) REFERENCES public.countries(code),
  city text,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER chapters_touch BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.chapter_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (chapter_id, member_id, role)
);

ALTER TABLE public.members
  ADD CONSTRAINT members_chapter_fk FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE SET NULL;

GRANT SELECT ON public.chapters TO anon, authenticated;
GRANT ALL ON public.chapters TO service_role;
GRANT SELECT ON public.chapter_roles TO authenticated;
GRANT ALL ON public.chapter_roles TO service_role;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapters readable" ON public.chapters FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "chapter roles read own" ON public.chapter_roles
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());

-- ---------- right to erasure via pseudonymisation ----------
-- Consent and affirmation proof survives; the person does not remain identifiable.
CREATE OR REPLACE FUNCTION public.pseudonymize_member(target uuid, reason text DEFAULT 'member request')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.members SET
    user_id = NULL,
    handle = NULL,
    first_name = NULL,
    last_name = NULL,
    display_name = NULL,
    email = NULL,
    email_verified_at = NULL,
    birth_month = NULL,
    birth_year = NULL,
    country = NULL,
    city = NULL,
    timezone = 'UTC',
    connection_types = '{}',
    primary_connection = NULL,
    region_interests = '{}',
    status = 'revoked',
    pseudonymized_at = now()
  WHERE id = target;

  DELETE FROM public.member_profiles WHERE member_id = target;
  DELETE FROM public.member_intent WHERE member_id = target;
  DELETE FROM public.member_settings WHERE member_id = target;
  DELETE FROM public.member_visibility WHERE member_id = target;

  UPDATE public.member_consents SET revoked_at = now()
   WHERE member_id = target AND revoked_at IS NULL;

  INSERT INTO public.conduct_actions (member_id, level, reason, conduct_version)
  VALUES (target, 'note', 'Record pseudonymised: ' || reason,
          COALESCE((SELECT value #>> '{}' FROM public.app_config WHERE key = 'conduct_version'), '1.0'));
END; $$;

REVOKE ALL ON FUNCTION public.pseudonymize_member(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pseudonymize_member(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.is_founding_member(public.members) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_founding_member(public.members) TO authenticated, service_role;
GRANT USAGE ON SEQUENCE public.member_number_seq TO service_role;