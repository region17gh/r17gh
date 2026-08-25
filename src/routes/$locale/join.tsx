import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Confetti } from "@/components/join/Confetti";
import { Issued } from "@/components/join/Issued";
import { Progress } from "@/components/join/Progress";
import { RegisterCard } from "@/components/join/RegisterCard";
import { useHeadingFocus } from "@/components/join/useHeadingFocus";
import { StepCompact } from "@/components/join/steps/StepCompact";
import { StepHowYouConnect } from "@/components/join/steps/StepHowYouConnect";
import { StepNeedBring } from "@/components/join/steps/StepNeedBring";
import { StepWhoYouAre, type Country } from "@/components/join/steps/StepWhoYouAre";
import { STEP_TOTAL } from "@/components/join/steps/shared";
import { PanBand } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { REGIONS } from "@/design-system/region-17-ghana-design-system-e3e62f/design-system/region17/data/regions";
import { localePath, useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { checkAge } from "@/lib/join/age";
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
import { fetchCurrentMember, fetchFoundingCutoff, isHandleReserved } from "@/lib/member/membership";
import { ensureReservation, type LapseReason } from "@/server/membership";

type StepValue = 1 | 2 | 3 | 4 | "issued";

interface JoinSearch {
  step: StepValue;
}

function parseStep(raw: unknown): StepValue {
  if (raw === "issued") return "issued";
  const value = Number(raw);
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

export const Route = createFileRoute("/$locale/join")({
  // The step lives in the URL so the browser back button moves between steps
  // instead of leaving the flow. Nothing personal is ever put here.
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    step: parseStep(search["step"]),
  }),
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
  const { step } = Route.useSearch();

  const [draft, setDraft] = useState<JoinDraft>(() => emptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [lapse, setLapse] = useState<LapseReason | null>(null);
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
  const [cutoff, setCutoff] = useState<Date | null>(null);
  const [retrying, setRetrying] = useState(false);
  const versionsRef = useRef<PolicyVersions | null>(null);

  const headingRef = useHeadingFocus<HTMLHeadingElement>(step);
  const underage = checkAge(draft.birthMonth, draft.birthYear) === "under";

  const goToStep = useCallback(
    (next: StepValue) => {
      void navigate({ to: ".", search: { step: next } });
    },
    [navigate],
  );

  /** Claims or re-checks the member number. Also catches an account that already joined. */
  const syncReservation = useCallback(
    async (current: JoinDraft) => {
      setReserving(true);
      try {
        const result = await ensureReservation({
          data: { heldNumber: current.reservation?.memberNumber ?? null },
        });
        if (result.status === "already_member") {
          void navigate({ to: localePath(locale, "/home") });
          return null;
        }
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
    [locale, navigate, t],
  );

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

  // The draft is never written while the age gate is failing, so an under-18
  // answer cannot be left behind in storage.
  useEffect(() => {
    if (!hydrated || underage) return;
    saveDraft(draft);
  }, [draft, hydrated, underage]);

  // On reaching the Compact, offer an address derived from the member's name.
  useEffect(() => {
    if (step !== 4) return;
    setDraft((prev) =>
      prev.handle ? prev : { ...prev, handle: suggestHandle(prev.firstName, prev.lastName) },
    );
  }, [step]);

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

  const onUnderage = useCallback(() => {
    // No email was ever captured on this screen, and anything already stored goes.
    clearDraft();
    setResumed(false);
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
          clearDraft();
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
    const location = [draft.city.trim(), countryName].filter(Boolean).join(", ");

    const chosen = CONNECTIONS.filter((c) => draft.connections.includes(c.value)).map((c) =>
      t(`join.connections.${c.key}`),
    );
    const connection =
      chosen.length === 0
        ? ""
        : chosen.length === 1
          ? (chosen[0] as string)
          : t("card.connectionMore", { first: chosen[0] as string, count: chosen.length - 1 });

    const regionNames = REGIONS.filter((r) => draft.regions.includes(r.slug)).map((r) => r.name);
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

  const stepHeading =
    step === "issued"
      ? t("join.issued.eyebrow")
      : t(`join.step${step}.heading`);

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

          <section className="r17-step" key={String(step)}>
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
              {stepHeading}
              {step === 3 ? <span className="r17-optional">{t("common.optional")}</span> : null}
            </h2>

            {step !== "issued" ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "var(--text-body-sm)",
                  maxWidth: "var(--measure-narrow)",
                  margin: "var(--space-2) 0 var(--space-8)",
                }}
              >
                {t(`join.step${step}.lede`)}
              </p>
            ) : null}

            {resumed && step === 1 ? (
              <p className="r17-notice" role="status">
                {t("join.resumed")}
              </p>
            ) : null}

            {lapse && draft.reservation ? (
              <div className="r17-notice" role="status">
                <p>{t(`join.recovery.${lapse}`)}</p>
                <p style={{ marginTop: "var(--space-2)" }}>
                  {t("join.recovery.newNumber", { number: draft.reservation.memberNumber })}
                </p>
              </div>
            ) : null}

            {submitError ? (
              <p className="r17-notice" data-tone="alert" role="alert">
                {submitError}
              </p>
            ) : null}

            {step === 1 ? (
              <StepWhoYouAre
                draft={draft}
                update={update}
                countries={countries}
                emailConfirmed={emailConfirmed}
                reserving={reserving}
                onEmailConfirmed={() => {
                  setEmailConfirmed(true);
                  void syncReservation(draft);
                }}
                onUnderage={onUnderage}
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
