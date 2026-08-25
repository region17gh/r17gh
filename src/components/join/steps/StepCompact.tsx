import { Button, Checkbox } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";
import { normaliseHandle, type HandleProblem } from "@/lib/join/handle";
import { CONSENTS, type ConsentType } from "@/lib/join/options";

import type { StepProps } from "./shared";

export interface StepCompactProps extends StepProps {
  affirmed: boolean;
  onAffirm: (value: boolean) => void;
  handleProblem: HandleProblem | "taken" | "reserved" | null;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
  showAffirmRequired: boolean;
}

/**
 * The Compact, on a screen of its own.
 *
 * The full text is present and readable before anything is affirmed: this is
 * not a terms tickbox at the bottom of a form. The consents below it are
 * separate from the affirmation, and separate again from visibility. Granting
 * `directory_visibility` records a consent; it does not publish anything.
 */
export function StepCompact({
  draft,
  update,
  affirmed,
  onAffirm,
  handleProblem,
  onBack,
  onSubmit,
  submitting,
  showAffirmRequired,
}: StepCompactProps) {
  const t = useT();

  const toggleConsent = (value: ConsentType, on: boolean) => {
    update({
      consents: on
        ? [...draft.consents.filter((c) => c !== value), value]
        : draft.consents.filter((c) => c !== value),
    });
  };

  const renderConsents = (group: "record" | "contact") =>
    CONSENTS.filter((consent) => consent.group === group).map((consent) => (
      // A div, not a label: Checkbox renders its own label, and nesting one
      // label inside another is invalid and toggles twice on a click.
      <div className="r17-consent" key={consent.value}>
        <Checkbox
          label={t(`join.consents.${consent.key}`)}
          description={t(`join.consents.${consent.key}Note`)}
          checked={draft.consents.includes(consent.value)}
          onChange={(on) => toggleConsent(consent.value, on)}
        />
      </div>
    ));

  return (
    <>
      <div className="r17-compact">
        <h3
          style={{
            font: "var(--type-title)",
            marginBottom: "var(--space-5)",
          }}
        >
          {t("join.step4.compactTitle")}
        </h3>
        <p>{t("join.step4.compactOne")}</p>
        <p>{t("join.step4.compactTwo")}</p>
        <p>{t("join.step4.compactThree")}</p>
        <p>{t("join.step4.compactFour")}</p>
        <p className="r17-compact-small">{t("join.step4.compactSmall")}</p>
      </div>

      {/* Safety control, not decoration. Its wording is fixed. */}
      <p
        className="r17-cite"
        style={{
          fontFamily: "var(--font-sans)",
          color: "var(--text-muted)",
          marginBottom: "var(--space-6)",
        }}
      >
        {t("legal.notAGovernmentDocument")}
      </p>

      <div className="r17-affirm-block">
        <div className="r17-affirm">
          <Checkbox
            label={t("join.step4.affirm")}
            checked={affirmed}
            onChange={(value) => onAffirm(value)}
          />
        </div>
        {showAffirmRequired && !affirmed ? (
          <p className="r17-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
            {t("join.step4.affirmRequired")}
          </p>
        ) : null}
      </div>

      <section>
        <h3 className="r17-consent-group">{t("join.step4.consentsRecord")}</h3>
        <p
          className="r17-cite"
          style={{ color: "var(--text-cite)", marginBottom: "var(--space-3)" }}
        >
          {t("join.step4.consentsRecordHint")}
        </p>
        {renderConsents("record")}

        <h3 className="r17-consent-group">{t("join.step4.consentsContact")}</h3>
        {renderConsents("contact")}
      </section>

      <section style={{ marginTop: "var(--space-8)" }}>
        <h3
          style={{
            font: "var(--type-meta)",
            color: "var(--text-strong)",
            marginBottom: "var(--space-2)",
          }}
        >
          {t("join.step4.handleLabel")}
        </h3>
        <div className="r17-handle-row">
          <span className="r17-handle-prefix">{t("join.step4.handlePrefix")}</span>
          <input
            id="r17-handle"
            value={draft.handle}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={t("join.step4.handleLabel")}
            aria-invalid={handleProblem ? true : undefined}
            placeholder={t("join.step4.handlePlaceholder")}
            onChange={(e) => update({ handle: normaliseHandle(e.target.value) })}
          />
        </div>
        {handleProblem ? (
          <p className="r17-error" role="alert" style={{ marginTop: "var(--space-2)" }}>
            {t(`join.handleErrors.${handleProblem}`)}
          </p>
        ) : (
          <p className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}>
            {t("join.step4.handleHint")} {t("join.step4.handleLive")}
          </p>
        )}
      </section>

      <div className="r17-step-nav">
        <Button size="lg" variant="secondary" onClick={onBack} disabled={submitting}>
          {t("common.back")}
        </Button>
        <div className="r17-step-nav-end">
          <Button size="lg" variant="gold" onClick={onSubmit} disabled={!affirmed || submitting}>
            {submitting ? t("join.step4.submitting") : t("join.step4.submit")}
          </Button>
        </div>
      </div>
      <p
        className="r17-cite"
        style={{ color: "var(--text-cite)", marginTop: "var(--space-4)", textAlign: "right" }}
      >
        {t("join.step4.footnote")}
      </p>
    </>
  );
}
