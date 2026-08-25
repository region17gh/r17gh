import { Button, Field, Input, Textarea } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";
import { INTENT_MAX_LENGTH } from "@/lib/join/options";

import { TAP_CONTROL, type StepProps } from "./shared";

export interface StepNeedBringProps extends StepProps {
  onBack: () => void;
  onContinue: () => void;
}

/** Entirely skippable. Both routes forward land on the Compact. */
export function StepNeedBring({ draft, update, onBack, onContinue }: StepNeedBringProps) {
  const t = useT();

  const counter = (value: string) => (
    <p className="r17-count" data-over={value.length > INTENT_MAX_LENGTH - 10 ? "true" : "false"}>
      {t("join.step3.count", { used: value.length, max: INTENT_MAX_LENGTH })}
    </p>
  );

  return (
    <>
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <div>
          <Field label={t("join.step3.askLabel")}>
            <Textarea
              value={draft.ask}
              maxLength={INTENT_MAX_LENGTH}
              placeholder={t("join.step3.askPlaceholder")}
              onChange={(e) => update({ ask: e.target.value })}
            />
          </Field>
          {counter(draft.ask)}
        </div>

        <div>
          <Field label={t("join.step3.offerLabel")}>
            <Textarea
              value={draft.offer}
              maxLength={INTENT_MAX_LENGTH}
              placeholder={t("join.step3.offerPlaceholder")}
              onChange={(e) => update({ offer: e.target.value })}
            />
          </Field>
          {counter(draft.offer)}
        </div>

        <div className="r17-field-grid">
          <Field
            label={
              <>
                {t("join.step3.roleLabel")}
                <span className="r17-optional">{t("common.optional")}</span>
              </>
            }
            hint={t("join.step3.roleHint")}
          >
            <Input
              value={draft.role}
              placeholder={t("join.step3.rolePlaceholder")}
              style={TAP_CONTROL}
              onChange={(e) => update({ role: e.target.value })}
            />
          </Field>
          <Field
            label={
              <>
                {t("join.step3.orgLabel")}
                <span className="r17-optional">{t("common.optional")}</span>
              </>
            }
          >
            <Input
              value={draft.organization}
              placeholder={t("join.step3.orgPlaceholder")}
              style={TAP_CONTROL}
              onChange={(e) => update({ organization: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="r17-step-nav">
        <Button size="lg" variant="secondary" onClick={onBack}>
          {t("common.back")}
        </Button>
        <div className="r17-step-nav-end">
          <Button size="lg" variant="ghost" onClick={onContinue}>
            {t("join.step3.skip")}
          </Button>
          <Button size="lg" onClick={onContinue}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </>
  );
}
