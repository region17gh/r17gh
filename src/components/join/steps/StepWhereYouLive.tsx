import { Button, Field, Input, Select } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";
import { GENDERS, type GenderIdentity } from "@/lib/join/options";

import { TAP_CONTROL, type StepProps } from "./shared";

export interface Country {
  code: string;
  name: string;
}

export interface StepWhereYouLiveProps extends StepProps {
  countries: Country[];
  onContinue: () => void;
  /** A member number is being claimed: continuing waits for it. */
  reserving: boolean;
}

/**
 * The rest of step 1, once the address is confirmed.
 *
 * Location is city-level and gender is optional and never shown to anyone. Both
 * are asked after confirmation because neither is worth collecting from an
 * address that turns out not to exist.
 */
export function StepWhereYouLive({
  draft,
  update,
  countries,
  onContinue,
  reserving,
}: StepWhereYouLiveProps) {
  const t = useT();

  return (
    <>
      <p className="r17-notice" role="status">
        {t("join.step1.emailConfirmed")}
      </p>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend
          style={{
            font: "var(--type-meta)",
            color: "var(--text-strong)",
            padding: 0,
            marginBottom: "var(--space-2)",
          }}
        >
          {t("join.step1.locationLabel")}
        </legend>
        <div className="r17-field-grid">
          <Field label={t("join.step1.cityLabel")}>
            <Input
              autoComplete="address-level2"
              placeholder={t("join.step1.cityPlaceholder")}
              value={draft.city}
              style={TAP_CONTROL}
              onChange={(e) => update({ city: e.target.value })}
            />
          </Field>
          <Field label={t("join.step1.countryLabel")}>
            <Select
              autoComplete="country"
              value={draft.country}
              style={TAP_CONTROL}
              onChange={(e) => update({ country: e.target.value })}
            >
              <option value="">{t("join.step1.countryPlaceholder")}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}>
          {t("join.step1.locationHint")}
        </p>
      </fieldset>

      <Field
        label={
          <>
            {t("join.step1.genderLabel")}
            <span className="r17-optional">{t("common.optional")}</span>
          </>
        }
        hint={t("join.step1.genderHint")}
        style={{ marginTop: "var(--space-5)" }}
      >
        <Select
          value={draft.gender}
          style={{ ...TAP_CONTROL, maxWidth: "var(--measure-narrow)" }}
          onChange={(e) => update({ gender: e.target.value as GenderIdentity })}
        >
          {GENDERS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(`join.genders.${option.key}`)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="r17-step-nav">
        <span />
        <div className="r17-step-nav-end">
          <Button size="lg" onClick={onContinue} disabled={reserving || !draft.reservation}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </>
  );
}
