import { Button } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { REGIONS, regionColor } from "@/design-system/region-17-ghana-design-system-e3e62f/design-system/region17/data/regions";
import { useT } from "@/i18n";
import { CONNECTIONS, type ConnectionType } from "@/lib/join/options";

import type { StepProps } from "./shared";

export interface StepHowYouConnectProps extends StepProps {
  onBack: () => void;
  onContinue: () => void;
  showRequired: boolean;
}

/**
 * Six ways of belonging, presented flat.
 *
 * Nothing here sorts, weights or marks a preferred answer, and no option is
 * described by what the member lacks in another. Choosing several is ordinary.
 */
export function StepHowYouConnect({
  draft,
  update,
  onBack,
  onContinue,
  showRequired,
}: StepHowYouConnectProps) {
  const t = useT();

  const toggleConnection = (value: ConnectionType) => {
    const chosen = draft.connections.includes(value)
      ? draft.connections.filter((v) => v !== value)
      : [...draft.connections, value];
    update({ connections: chosen });
  };

  const toggleRegion = (slug: string) => {
    const chosen = draft.regions.includes(slug)
      ? draft.regions.filter((v) => v !== slug)
      : [...draft.regions, slug];
    update({ regions: chosen });
  };

  return (
    <>
      <div className="r17-chips">
        {CONNECTIONS.map((connection) => {
          const pressed = draft.connections.includes(connection.value);
          return (
            <button
              type="button"
              key={connection.value}
              className="r17-chip"
              aria-pressed={pressed}
              onClick={() => toggleConnection(connection.value)}
            >
              {t(`join.connections.${connection.key}`)}
              <small>{t(`join.connections.${connection.key}Note`)}</small>
            </button>
          );
        })}
      </div>
      {showRequired && draft.connections.length === 0 ? (
        <p className="r17-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
          {t("join.step2.required")}
        </p>
      ) : null}

      <div style={{ marginTop: "var(--space-8)" }}>
        <h3
          style={{
            font: "var(--type-meta)",
            color: "var(--text-strong)",
            marginBottom: "var(--space-2)",
          }}
        >
          {t("join.step2.regionsLabel")}
          <span className="r17-optional">{t("common.optional")}</span>
        </h3>
        <p
          className="r17-cite"
          style={{ color: "var(--text-cite)", marginBottom: "var(--space-3)" }}
        >
          {t("join.step2.regionsHint")}
        </p>
        <div className="r17-regions">
          {REGIONS.map((region) => {
            const pressed = draft.regions.includes(region.slug);
            return (
              <button
                type="button"
                key={region.slug}
                className="r17-region-chip"
                aria-pressed={pressed}
                onClick={() => toggleRegion(region.slug)}
              >
                {/* Colour is never the carrier: the region name is always present. */}
                <span
                  className="r17-region-dot"
                  aria-hidden="true"
                  style={{ background: regionColor(region.slug) }}
                />
                {region.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="r17-step-nav">
        <Button size="lg" variant="secondary" onClick={onBack}>
          {t("common.back")}
        </Button>
        <div className="r17-step-nav-end">
          <Button size="lg" onClick={onContinue}>
            {t("common.continue")}
          </Button>
        </div>
      </div>
    </>
  );
}
