import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { localePath, useI18n } from "@/i18n";
import { cutoffDateTime, formatCutoff } from "@/lib/foundingWindow";
import { fetchFoundingCutoff } from "@/lib/member/membership";

/**
 * The persistent close date and the one CTA that follows the reader down.
 *
 * The date is read from `app_config.founding_member_cutoff`, never written
 * here. Until it arrives the bar carries the CTA alone rather than a guess: a
 * wrong close date on a scarcity bar is worse than no date.
 *
 * The bar is fixed but does not trap focus. It is the last thing in the
 * document, so tabbing off the coda reaches it and tabbing on leaves the page.
 */
export function DeadlineBar() {
  const { locale, t } = useI18n();
  const [cutoff, setCutoff] = useState<Date | null>(null);

  useEffect(() => {
    let live = true;
    void fetchFoundingCutoff()
      .then((value) => {
        if (live) setCutoff(value);
      })
      // A marketing page never shows a database error. It shows the CTA.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="charter-deadline" data-charter-deadline>
      {cutoff ? (
        <p>
          {t("charter.deadline.label")}{" "}
          <b>
            <time dateTime={cutoffDateTime(cutoff)}>{formatCutoff(cutoff, locale)}</time>
          </b>
        </p>
      ) : (
        <p />
      )}
      <Link to={localePath(locale, "/join/register")}>{t("charter.deadline.cta")}</Link>
    </div>
  );
}
