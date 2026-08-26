import { Button, Field, Input, Select } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useT } from "@/i18n";
import { subdivisionConfig } from "@/lib/join/subdivisions";

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
 * Country, broadest to narrowest, down to city. Asked after confirmation
 * because none of it is worth collecting from an address that turns out not
 * to exist.
 *
 * The middle tier -- state, province, prefecture, county, region -- only
 * exists once a country is chosen: it needs the country to know what to call
 * itself and whether to ask at all. `subdivisionConfig` decides both, and a
 * country change that makes the answer stale (a city-state chosen after a
 * state was typed) clears it rather than submitting a leftover value for a
 * country that has no such tier.
 */
export function StepWhereYouLive({
  draft,
  update,
  countries,
  onContinue,
  reserving,
}: StepWhereYouLiveProps) {
  const t = useT();
  const subdivision = subdivisionConfig(draft.country);

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
        <div style={{ display: "grid", gap: "var(--space-5)" }}>
          <Field label={t("join.step1.countryLabel")}>
            <Select
              autoComplete="country"
              value={draft.country}
              style={{ ...TAP_CONTROL, maxWidth: "var(--measure-narrow)" }}
              onChange={(e) => {
                const country = e.target.value;
                const stillApplies = subdivisionConfig(country) !== null;
                update({ country, subdivision: stillApplies ? draft.subdivision : "" });
              }}
            >
              <option value="">{t("join.step1.countryPlaceholder")}</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="r17-field-grid">
            {subdivision ? (
              <Field
                label={t(`join.subdivisionLabels.${subdivision.labelKey}`)}
                required={subdivision.required}
              >
                <Input
                  autoComplete="address-level1"
                  placeholder={t("join.step1.subdivisionPlaceholder")}
                  value={draft.subdivision}
                  style={TAP_CONTROL}
                  onChange={(e) => update({ subdivision: e.target.value })}
                />
              </Field>
            ) : null}
            <Field label={t("join.step1.cityLabel")}>
              <Input
                autoComplete="address-level2"
                placeholder={t("join.step1.cityPlaceholder")}
                value={draft.city}
                style={TAP_CONTROL}
                onChange={(e) => update({ city: e.target.value })}
              />
            </Field>
          </div>
        </div>
        <p className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "var(--space-2)" }}>
          {t("join.step1.locationHint")}
        </p>
      </fieldset>

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
