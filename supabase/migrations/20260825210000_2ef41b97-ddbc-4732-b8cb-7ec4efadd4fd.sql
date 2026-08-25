-- ============================================================
-- Region 17 Ghana — the welcome email is sent once, and the record says so
--
-- The welcome email goes out on activation, not on registration, so an account
-- that never confirms its address never receives it. Activation is
-- `activate_membership()`, which is deliberately a no-op that succeeds when it
-- is run against a record that is already active: a double submit is not an
-- error. That is the right behaviour for activation and the wrong behaviour for
-- a send, because it means the caller cannot tell a transition from a repeat.
--
-- So the record carries the fact. The sender claims it with
--
--   UPDATE public.members
--      SET welcome_email_sent_at = now()
--    WHERE id = $1 AND welcome_email_sent_at IS NULL AND status = 'active'
--   RETURNING ...
--
-- which is one statement, so it is atomic. Two concurrent activations race for
-- the row lock, one updates a row and sends, the other matches zero rows and
-- does nothing. The claim is taken BEFORE the send rather than after it: a
-- crash between the two costs one member their welcome email, which is
-- recoverable by hand, where the other order costs an unknown number of members
-- a duplicate, which is not.
--
-- Grants: 20260825190000 revoked table-wide UPDATE on members from
-- authenticated and replaced it with a column list. This column is not on that
-- list and must never be added to it, so a member cannot stamp their own row to
-- suppress the send, nor clear it to make the register send again. service_role
-- holds GRANT ALL from pass 1 and is the only writer. No RLS change: the
-- existing policies on members already scope every row to its owner, and this
-- column adds no new read surface beyond a timestamp the member's own record
-- already implies.
--
-- Erasure deliberately does not clear this. `pseudonymize_member()` nulls the
-- fields that identify a person; this one identifies nobody, it records that a
-- message was sent to an address that has since been removed. Clearing it would
-- arm the sender to write to a record whose email is now null.
-- ============================================================

ALTER TABLE public.members ADD COLUMN welcome_email_sent_at timestamptz;

COMMENT ON COLUMN public.members.welcome_email_sent_at IS
'Stamped by the welcome-email sender, as service_role, in the same statement that claims the send: UPDATE ... WHERE welcome_email_sent_at IS NULL. Deliberately absent from the authenticated UPDATE column grant in 20260825190000, so a member can neither suppress their own welcome email nor cause it to be sent again. Not cleared by pseudonymize_member(): it identifies nobody, and clearing it would re-arm the sender against a record with no address.';
