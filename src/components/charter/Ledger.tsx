import { useI18n } from "@/i18n";
import { CHARTER_IMAGES, fallbackSrc } from "@/lib/charter/assets";
import { CHARTER_REGIONS } from "@/lib/charter/regions";

/**
 * The ledger: Ghana counts sixteen regions at home, and then the seventeenth.
 *
 * Cells light in sequence as the track is scrolled, and the seventeenth lands
 * as a navy band once they are all lit. The lighting is written by the page's
 * scroll loop; everything here is structure and copy.
 *
 * The prototype ran an adinkra pattern behind this grid. It is omitted:
 * traditional motifs are not decoration and need named Ghanaian cultural
 * review. The hook is left in place, documented in `useCharterStage` and in
 * `lib/charter/assets.ts`, so reinstating it after review is not a rebuild.
 */
export function Ledger() {
  const { t } = useI18n();

  return (
    <div className="charter-ledger" data-charter-ledger>
      <div className="charter-ledger-stage">
        {CHARTER_IMAGES.ledgerPattern.licensed ? (
          <div
            className="charter-ledger-pattern"
            aria-hidden="true"
            style={{ backgroundImage: `url(${fallbackSrc(CHARTER_IMAGES.ledgerPattern)})` }}
          />
        ) : null}
        <div className="charter-ledger-head">
          <p className="charter-eyebrow">{t("charter.ledger.eyebrow")}</p>
          <h2 className="charter-ledger-lede">
            {t("charter.ledger.ledeHome")}
            <br />
            <span className="charter-gold-ink">{t("charter.ledger.ledeUs")}</span>
          </h2>
        </div>

        <ul className="charter-grid16">
          {CHARTER_REGIONS.map((region) => (
            <li
              key={region.slug}
              className="charter-cell"
              data-charter-cell
              // Region ink carries the type and the underline. The fill never
              // goes behind text, so the cell ground stays plain paper.
              style={{ "--charter-region-ink": region.ink } as React.CSSProperties}
            >
              <span className="charter-cell-code">{region.code}</span>
              <span className="charter-cell-name">{region.name}</span>
              <i aria-hidden="true" />
            </li>
          ))}
        </ul>

        <p className="charter-seventeenth" data-charter-seventeenth>
          <span className="charter-cell-code">{t("charter.ledger.seventeenthCode")}</span>
          <span className="charter-seventeenth-name">
            {t("charter.ledger.seventeenthName")} <em>{t("charter.ledger.seventeenthYou")}</em>
          </span>
          <span className="charter-aside">{t("charter.ledger.aside")}</span>
        </p>
      </div>
    </div>
  );
}
