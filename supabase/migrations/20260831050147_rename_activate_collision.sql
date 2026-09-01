-- activate_membership(p_handle) already existed as part of the registration
-- flow. Adding a second overload under the same name left PostgREST with two
-- functions doing unrelated things. The declaration one is renamed; the
-- original is untouched.

alter function public.activate_membership(text[],text,text,text,text,text,text,text,integer,text)
  rename to activate_with_declaration;

comment on function public.activate_with_declaration(text[],text,text,text,text,text,text,text,integer,text) is
  'Post-sign-in. Takes only what charter registration did not already collect: a first declaration and consent to be matched on it. Distinct from activate_membership(p_handle), which belongs to the registration flow.';

-- account_state routes on activation, so make explicit which sense is meant.
comment on function public.member_is_activated(uuid) is
  'Holds at least one live declaration. This is platform activation, not registration activation: a member can be active in members.status and still be invisible to the engine.';
