import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Challenge, type ChallengeHandle } from "@/components/join/Challenge";
import { Confetti } from "@/components/join/Confetti";
import { Issued } from "@/components/join/Issued";
import { Progress } from "@/components/join/Progress";
import { RegisterCard } from "@/components/join/RegisterCard";
import { useHandleAvailability } from "@/components/join/useHandleAvailability";
import { useHeadingFocus } from "@/components/join/useHeadingFocus";
import { StepCompact } from "@/components/join/steps/StepCompact";
import { StepConfirmEmail } from "@/components/join/steps/StepConfirmEmail";
import { StepHowYouConnect } from "@/components/join/steps/StepHowYouConnect";
import { StepNeedBring } from "@/components/join/steps/StepNeedBring";
import { StepWhereYouLive, type Country } from "@/components/join/steps/StepWhereYouLive";
import { StepWhoYouAre } from "@/components/join/steps/StepWhoYouAre";
import { STEP_TOTAL } from "@/components/join/steps/shared";
import { Button, PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { clearLinkError, currentLinkError, type LinkProblem } from "@/lib/auth/linkError";
import { checkAge } from "@/lib/join/age";
import type { ChallengeProblem } from "@/lib/security/turnstile";
import { SUPPORT_EMAIL } from "@/lib/support";
import {
  clearDraft,
  emptyDraft,
  loadDraft,
  savePendingHandle,
  saveDraft,
  type JoinDraft,
} from "@/lib/join/draft";
import { checkHandle, suggestHandle, type HandleProblem } from "@/lib/join/handle";
import { CONNECTIONS } from "@/lib/join/options";
import {
  loadPolicyVersions,
  registerMember,
  writeMembershipRecords,
  type PolicyVersions,
} from "@/lib/join/registration";
import { REGIONS_ALPHABETICAL } from "@/lib/regions";
import { fetchCurrentMember, fetchFoundingCutoff, isHandleReserved } from "@/lib/member/membership";
import { ensureReservation, type LapseReason } from "@/server/membership";

type StepValue = 1 | 2 | 3 | 4 | "issued";

/**
 * Step 1 is three screens, not one: who you are, the code, then where you live.
 * The code is asked for on its own screen because it is only ever requested
 * once the answers on the first screen have passed the age gate.
 */
type StageValue = "identity" | "code" | "details";

interface JoinSearch {
  step: StepValue;
  stage?: StageValue;
}

function parseStep(raw: unknown): StepValue {
  if (raw === "issued") return "issued";
  const value = Number(raw);
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

function parseStage(raw: unknown): StageValue {
  return raw === "code" || raw === "details" ? raw : "identity";
}

export const Route = createFileRoute("/$locale/join")({
  // The step lives in the URL so the browser back button moves between steps
  // instead of leaving the flow. Nothing personal is ever put here.
  validateSearch: (search: Record<string, unknown>): JoinSearch => {
    const step = parseStep(search["step"]);
    const stage = parseStage(search["stage"]);
    // Left out of the URL entirely when it is the default, so the address a
    // member sees at the start of the flow stays /join.
    return stage === "identity" ? { step } : { step, stage };
  },
  head: () => ({
    meta: [
      { title: "Join Region 17" },
      {
        name: "description",
        content:
          "Membership is free, permanent, and open to the global African diaspora, to Ghanaians at home, and to allies.",
      },
    ],
  }),
  component: JoinPage,
});

interface IssuedRecord {
  memberNumber: number;
  credentialId: string;
  foundingMember: boolean;
  classYear: number;
  firstName: string;
  handle: string;
  incomplete: string[];
}

function JoinPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { step, stage: requestedStage = "identity" } = Route.useSearch();

  const [draft, setDraft] = useState<JoinDraft>(() => emptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [lapse, setLapse] = useState<LapseReason | null>(null);
  const [challengeProblem, setChallengeProblem] = useState<ChallengeProblem | null>(null);
  /** Consecutive failures, so a member stuck for reasons of their own gets a way out. */
  const [challengeAttempts, setChallengeAttempts] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [affirmed, setAffirmed] = useState(false);
  const [handleProblem, setHandleProblem] = useState<HandleProblem | "taken" | "reserved" | null>(
    null,
  );
  const [showConnectionRequired, setShowConnectionRequired] = useState(false);
  const [showAffirmRequired, setShowAffirmRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedRecord | null>(null);
  const [refused, setRefused] = useState(false);
  const [linkProblem, setLinkProblem] = useState<LinkProblem | null>(null);
  const [cutoff, setCutoff] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const versionsRef = useRef<PolicyVersions | null>(null);
  const challengeRef = useRef<ChallengeHandle | null>(null);

  /**
   * The screen actually shown for step 1.
   *
   * A confirmed address always lands on the last screen: there is nothing left
   * to do on the first two. The code screen holds through a reload, because the
   * address is in the draft by then and the code is already in their inbox.
   */
  const stage: StageValue = emailConfirmed
    ? "details"
    : requestedStage === "code" && (!hydrated || draft.email.trim())
      ? "code"
      : "identity";

  const headingRef = useHeadingFocus<HTMLHeadingElement>(`${String(step)}:${stage}`);
  const underage = checkAge(draft.birthMonth, draft.birthYear) === "under";

  const goToStep = useCallback(
    (next: StepValue) => {
      void navigate({ to: ".", search: { step: next } });
    },
    [navigate],
  );

  const goToStage = useCallback(
    (next: StageValue) => {
      void navigate({ to: ".", search: { step: 1, stage: next } });
    },
    [navigate],
  );

  /**
   * Records a challenge problem and counts it, so a member who keeps failing
   * through no fault of their own is offered a way out rather than left to
   * keep hitting the same disabled Continue button. Passing null clears the
   * problem but never the count: the count exists to notice a losing streak,
   * and a widget that briefly clears between failures is still a member
   * stuck on this screen.
   */
  const reportChallengeProblem = useCallback((problem: ChallengeProblem | null) => {
    setChallengeProblem(problem);
    if (problem) setChallengeAttempts((n) => n + 1);
  }, []);

  /**
   * Claims or re-checks the member number. Also catches an account that already
   * joined.
   *
   * The challenge token is fetched before the call and thrown away after it,
   * whatever the answer was: Turnstile tokens are single-use, so a token that
   * has been sent once is spent whether or not it was accepted. The server is
   * the thing that decides; this only carries the answer.
   */
  const syncReservation = useCallback(
    async (current: JoinDraft) => {
      setReserving(true);
      try {
        const challengeToken = (await challengeRef.current?.token()) ?? null;
        const result = await ensureReservation({
          data: {
            heldNumber: current.reservation?.memberNumber ?? null,
            challengeToken,
          },
        });
        challengeRef.current?.reset();

        if (result.status === "already_member") {
          void navigate({ to: localePath(locale, "/home") });
          return null;
        }
        if (result.status === "challenge_refused") {
          // Nothing was reserved, which is the point. The member is told what
          // happened and given the check again, not a raw error.
          reportChallengeProblem(result.problem);
          return null;
        }
        setChallengeProblem(null);
        setChallengeAttempts(0);
        if (result.status === "reissued") setLapse(result.reason ?? "unknown");
        else setLapse(null);

        const reservation = {
          memberNumber: result.memberNumber,
          credentialId: result.credentialId,
          expiresAt: result.expiresAt,
        };
        setDraft((prev) => ({ ...prev, reservation }));
        return reservation;
      } catch {
        setSubmitError(t("common.errorGeneric"));
        return null;
      } finally {
        setReserving(false);
      }
    },
    [locale, navigate, reportChallengeProblem, t],
  );

  /** The member asking for the check again after it would not complete. */
  const retryChallenge = useCallback(() => {
    setChallengeProblem(null);
    challengeRef.current?.reset();
    void syncReservation(draft);
  }, [draft, syncReservation]);

  // A dead confirmation link sends the member back here carrying the reason in
  // the URL fragment. It is read once, answered on the screen, and taken back
  // out of the address bar.
  useEffect(() => {
    const failure = currentLinkError();
    if (!failure) return;
    setLinkProblem(failure.problem);
    clearLinkError();
  }, []);

  // Restore the draft, then work out where this browser actually stands: signed
  // in with a record (go home), signed in without one (resume), or neither.
  useEffect(() => {
    const stored = loadDraft();
    setDraft(stored);
    setHydrated(true);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;

      const member = await fetchCurrentMember().catch(() => null);
      if (member) {
        void navigate({ to: localePath(locale, "/home") });
        return;
      }

      // An abandoned registration leaves an auth account with no member row.
      // The address is already proven, so the member picks up where they left off.
      if (user.email && user.email_confirmed_at) {
        setEmailConfirmed(true);
        if (stored.email.trim().toLowerCase() !== user.email.toLowerCase()) {
          setDraft((prev) => ({ ...prev, email: user.email ?? prev.email }));
        }
        if (stored.firstName || stored.connections.length > 0) setResumed(true);
        await syncReservation(stored);
      }
    })();
    // Runs once: this is the page's own restore step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("countries").select("code, name").order("name");
      setCountries(data ?? []);
    })();
    void fetchFoundingCutoff().then(setCutoff);
  }, []);

  // The draft is never written while the age gate is failing, and never again
  // after a refusal, so an under-18 answer cannot be left behind in storage.
  useEffect(() => {
    if (!hydrated || underage || refused) return;
    saveDraft(draft);
  }, [draft, hydrated, underage, refused]);

  // On reaching the Compact, offer an address derived from the member's name.
  useEffect(() => {
    if (step !== 4) return;
    setDraft((prev) =>
      prev.handle ? prev : { ...prev, handle: suggestHandle(prev.firstName, prev.lastName) },
    );
  }, [step]);

  /**
   * Availability, checked while the address is being chosen rather than at the
   * end of the flow.
   *
   * Collision is expected to be the highest-volume case at launch: African and
   * diaspora naming means many members want the same first name. Discovering it
   * at /verify, after the whole flow, is the wrong place to find out. Only
   * asked on the Compact, which is the only screen with an address on it, so no
   * request is spent on a member who has not reached it.
   *
   * This does not replace the `handle_taken` check at /verify. The address is
   * committed there, so it can still be taken in between; that race is now rare
   * rather than routine.
   */
  const {
    checking: handleChecking,
    free: handleFree,
    suggestions: handleSuggestions,
  } = useHandleAvailability({
    handle: draft.handle,
    firstName: draft.firstName,
    lastName: draft.lastName,
    enabled: step === 4,
    onResult: setHandleProblem,
  });

  // Landing on the credential without one in hand: read it back off the record.
  useEffect(() => {
    if (step !== "issued" || issued) return;
    void (async () => {
      const member = await fetchCurrentMember().catch(() => null);
      if (!member) {
        goToStep(1);
        return;
      }
      setIssued({
        memberNumber: member.member_number,
        credentialId: member.credential_id,
        foundingMember: member.founding_member,
        classYear: member.class_year,
        firstName: member.first_name ?? "",
        handle: member.handle ?? draft.handle,
        incomplete: [],
      });
    })();
  }, [step, issued, goToStep, draft.handle]);

  const update = useCallback((patch: Partial<JoinDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  /**
   * The refusal.
   *
   * `submitIdentity` has already returned without keeping the address or
   * sending anything. This clears what the earlier screens had stored, empties
   * what is held in memory, and leaves the screen showing the refusal and
   * nothing else. Storage is not written again after this point.
   */
  const onUnderage = useCallback(() => {
    clearDraft();
    setDraft(emptyDraft());
    setResumed(false);
    setLapse(null);
    setChallengeProblem(null);
    setRefused(true);
  }, []);

  const submit = async () => {
    if (!affirmed) {
      setShowAffirmRequired(true);
      return;
    }
    const problem = checkHandle(draft.handle);
    if (problem) {
      setHandleProblem(problem);
      return;
    }
    setHandleProblem(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      if (await isHandleReserved(draft.handle)) {
        setHandleProblem("reserved");
        return;
      }

      if (!versionsRef.current) versionsRef.current = await loadPolicyVersions();
      const versions = versionsRef.current;
      const outcome = await registerMember(draft, versions);

      switch (outcome.status) {
        case "registered": {
          // The handle outlives the draft: it is committed at /verify, not here.
          savePendingHandle(draft.handle);
          clearDraft();
          // Founding standing and class year are read back off the record, where
          // the database froze them. Recomputing either here would let a later
          // change to the cutoff rewrite what this member was told they hold.
          const record = await fetchCurrentMember().catch(() => null);
          setIssued({
            memberNumber: outcome.memberNumber,
            credentialId: outcome.credentialId,
            foundingMember: record?.founding_member ?? false,
            classYear: record?.class_year ?? new Date().getFullYear(),
            firstName: draft.firstName,
            handle: draft.handle,
            incomplete: outcome.incomplete,
          });
          // The check already did its job: a number would not exist otherwise.
          // Anything it reported earlier, including a background refresh that
          // failed after the token it produced was already spent, is stale the
          // moment a credential is in hand.
          setChallengeProblem(null);
          setChallengeAttempts(0);
          goToStep("issued");
          break;
        }
        case "already_member":
          void navigate({ to: localePath(locale, "/home") });
          break;
        case "reservation_lapsed":
          // A new number, the reason said plainly, and everything they entered kept.
          await syncReservation(draft);
          break;
        case "signed_out":
          setEmailConfirmed(false);
          goToStep(1);
          break;
        case "underage":
          onUnderage();
          goToStep(1);
          break;
        default:
          setSubmitError(outcome.message);
      }
    } catch {
      setSubmitError(t("common.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  const retryRecords = async () => {
    if (!issued) return;
    setRetrying(true);
    try {
      const member = await fetchCurrentMember();
      if (!member) return;
      if (!versionsRef.current) versionsRef.current = await loadPolicyVersions();
      const incomplete = await writeMembershipRecords(member.id, draft, versionsRef.current);
      setIssued({ ...issued, incomplete });
    } catch {
      setSubmitError(t("common.errorGeneric"));
    } finally {
      setRetrying(false);
    }
  };

  const cardValues = useMemo(() => {
    const name = [draft.firstName.trim(), draft.lastName.trim()].filter(Boolean).join(" ");
    const countryName = countries.find((c) => c.code === draft.country)?.name ?? "";
    const location = [draft.city.trim(), draft.subdivision.trim(), countryName]
      .filter(Boolean)
      .join(", ");

    const chosen = CONNECTIONS.filter((c) => draft.connections.includes(c.value)).map((c) =>
      t(`join.connections.${c.key}`),
    );
    const connection =
      chosen.length === 0
        ? ""
        : chosen.length === 1
          ? (chosen[0] as string)
          : t("card.connectionMore", { first: chosen[0] as string, count: chosen.length - 1 });

    const regionNames = REGIONS_ALPHABETICAL.filter((r) => draft.regions.includes(r.slug)).map((r) => r.name);
    const following =
      regionNames.length === 0
        ? ""
        : regionNames.length > 2
          ? t("card.regionsCount", { count: regionNames.length })
          : regionNames.join(", ");

    // Before registration this is a preview drawn from the published cutoff.
    // Once the record exists it is the record's own frozen flag, never a guess.
    const founding = issued ? issued.foundingMember : cutoff !== null && new Date() <= cutoff;
    const standing = (step === "issued" || step === 4) && founding ? t("join.issued.founding") : "";

    return { name, location, connection, following, standing };
  }, [draft, countries, step, cutoff, issued, t]);

  /** One screen, one heading and one lede, including the three that make step 1. */
  const stepCopy = ((): { heading: string; lede: string } => {
    if (step === "issued") return { heading: t("join.issued.eyebrow"), lede: "" };
    if (step !== 1) {
      return { heading: t(`join.step${step}.heading`), lede: t(`join.step${step}.lede`) };
    }
    if (refused) return { heading: t("join.step1.underageHeading"), lede: "" };
    if (stage === "code") {
      return { heading: t("join.step1.codeHeading"), lede: t("join.step1.codeLede") };
    }
    if (stage === "details") {
      return { heading: t("join.step1.detailsHeading"), lede: t("join.step1.detailsLede") };
    }
    return { heading: t("join.step1.heading"), lede: t("join.step1.lede") };
  })();

  return (
    <div style={{ minHeight: "100vh" }}>
      <PanBand />
      <Confetti fire={step === "issued" && issued !== null} />

      <div className="r17-join-shell">
        <aside className="r17-join-aside">
          <RegisterCard
            memberNumber={issued?.memberNumber ?? draft.reservation?.memberNumber ?? null}
            name={cardValues.name}
            location={cardValues.location}
            connection={cardValues.connection}
            following={cardValues.following}
            standing={cardValues.standing}
            stamped={step === "issued"}
          />
        </aside>

        <main>
          <header style={{ marginBottom: "var(--space-6)" }}>
            <p className="r17-eyebrow" style={{ color: "var(--gold-700)" }}>
              {t("join.eyebrow")}
            </p>
            <h1
              style={{
                font: "var(--type-display)",
                letterSpacing: "var(--tracking-display)",
                marginTop: "var(--space-3)",
              }}
            >
              {t("join.headlineOne")}
              <br />
              <em style={{ color: "var(--navy-600)" }}>{t("join.headlineTwo")}</em>
            </h1>
            <p
              style={{
                marginTop: "var(--space-3)",
                color: "var(--text-muted)",
                maxWidth: "var(--measure-narrow)",
              }}
            >
              {t("join.sub")}
            </p>
            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-body-sm)" }}>
              {t("join.alreadyMember")}{" "}
              <Link to={localePath(locale, "/signin")}>{t("nav.signIn")}</Link>
            </p>
          </header>

          {step !== "issued" ? <Progress current={step} total={STEP_TOTAL} /> : null}

          <section className="r17-step" key={`${String(step)}:${stage}`}>
            {step !== "issued" ? (
              <p className="r17-cite" style={{ color: "var(--gold-700)" }}>
                {t("join.stepCounter", { current: step, total: STEP_TOTAL })}
              </p>
            ) : null}

            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{ font: "var(--type-title)", marginTop: "var(--space-2)" }}
            >
              {stepCopy.heading}
              {step === 3 ? <span className="r17-optional">{t("common.optional")}</span> : null}
            </h2>

            {stepCopy.lede ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "var(--text-body-sm)",
                  maxWidth: "var(--measure-narrow)",
                  margin: "var(--space-2) 0 var(--space-8)",
                }}
              >
                {stepCopy.lede}
              </p>
            ) : null}

            {resumed && step === 1 && !refused ? (
              <p className="r17-notice" role="status">
                {t("join.resumed")}
              </p>
            ) : null}

            {linkProblem && !refused ? (
              <div className="r17-notice" role="status">
                <p>{t(`authLink.${linkProblem}Body`)}</p>
                <p style={{ marginTop: "var(--space-2)" }}>{t("authLink.joinAgain")}</p>
              </div>
            ) : null}

            {lapse && draft.reservation ? (
              <div className="r17-notice" role="status">
                <p>{t(`join.recovery.${lapse}`)}</p>
                <p style={{ marginTop: "var(--space-2)" }}>
                  {t("join.recovery.newNumber", { number: draft.reservation.memberNumber })}
                </p>
              </div>
            ) : null}

            {/*
              The check that stands in front of a member number. Mounted for the
              whole flow, not one screen: a number is claimed at three separate
              moments and each of them needs a token. Invisible unless
              Cloudflare wants a person to do something.
            */}
            {step !== "issued" && !refused ? (
              <Challenge handle={challengeRef} onProblem={reportChallengeProblem} />
            ) : null}

            {challengeProblem && !refused && step !== "issued" ? (
              <div className="r17-notice" data-tone="alert" role="alert">
                <p>{t(`join.challenge.${challengeProblem}`)}</p>
                <p style={{ marginTop: "var(--space-2)" }}>{t("join.challenge.kept")}</p>
                <p style={{ marginTop: "var(--space-3)" }}>
                  <Button size="lg" onClick={retryChallenge} disabled={reserving}>
                    {reserving ? t("join.challenge.retrying") : t("join.challenge.retry")}
                  </Button>
                </p>
                {challengeAttempts >= 2 ? (
                  <p style={{ marginTop: "var(--space-3)" }}>
                    {t("join.challenge.stillStuck")}{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}`}>
                      {t("join.challenge.contactSupport", { email: SUPPORT_EMAIL })}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}

            {submitError ? (
              <p className="r17-notice" data-tone="alert" role="alert">
                {submitError}
              </p>
            ) : null}

            {step === 1 && refused ? (
              <div className="r17-notice" data-tone="alert" role="alert">
                {t("join.step1.underage")}
              </div>
            ) : null}

            {step === 1 && !refused && stage === "identity" ? (
              <StepWhoYouAre
                draft={draft}
                update={update}
                onUnderage={onUnderage}
                onCodeSent={() => goToStage("code")}
              />
            ) : null}

            {step === 1 && !refused && stage === "code" ? (
              <StepConfirmEmail
                email={draft.email.trim()}
                onConfirmed={() => {
                  setEmailConfirmed(true);
                  void syncReservation(draft);
                  goToStage("details");
                }}
                onChangeEmail={() => goToStage("identity")}
              />
            ) : null}

            {step === 1 && !refused && stage === "details" ? (
              <StepWhereYouLive
                draft={draft}
                update={update}
                countries={countries}
                reserving={reserving}
                onContinue={() => goToStep(2)}
              />
            ) : null}

            {step === 2 ? (
              <StepHowYouConnect
                draft={draft}
                update={update}
                showRequired={showConnectionRequired}
                onBack={() => goToStep(1)}
                onContinue={() => {
                  if (draft.connections.length === 0) {
                    setShowConnectionRequired(true);
                    return;
                  }
                  setShowConnectionRequired(false);
                  goToStep(3);
                }}
              />
            ) : null}

            {step === 3 ? (
              <StepNeedBring
                draft={draft}
                update={update}
                onBack={() => goToStep(2)}
                onContinue={() => goToStep(4)}
              />
            ) : null}

            {step === 4 ? (
              <StepCompact
                draft={draft}
                update={update}
                affirmed={affirmed}
                onAffirm={(value) => {
                  setAffirmed(value);
                  if (value) setShowAffirmRequired(false);
                }}
                showAffirmRequired={showAffirmRequired}
                handleProblem={handleProblem}
                handleChecking={handleChecking}
                handleFree={handleFree}
                handleSuggestions={handleSuggestions}
                onPickHandle={(handle) => update({ handle })}
                submitting={submitting}
                onBack={() => goToStep(3)}
                onSubmit={() => void submit()}
              />
            ) : null}

            {step === "issued" && issued ? (
              <Issued
                firstName={issued.firstName}
                memberNumber={issued.memberNumber}
                credentialId={issued.credentialId}
                foundingMember={issued.foundingMember}
                classYear={issued.classYear}
                cutoff={cutoff}
                handle={issued.handle}
                incomplete={issued.incomplete}
                onRetry={() => void retryRecords()}
                retrying={retrying}
              />
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}
