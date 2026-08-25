import { useT } from "@/i18n";

/** Four segments, one per step. Labelled for screen readers, not colour alone. */
export function Progress({ current, total }: { current: number; total: number }) {
  const t = useT();
  return (
    <div
      className="r17-progress"
      role="progressbar"
      aria-label={t("join.progressLabel")}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(current, total)}
      aria-valuetext={t("join.stepCounter", { current: Math.min(current, total), total })}
    >
      {Array.from({ length: total }, (_, index) => {
        const step = index + 1;
        const state = step < current ? "done" : step === current ? "now" : "todo";
        return <div className="r17-progress-seg" data-state={state} key={step}><i /></div>;
      })}
    </div>
  );
}
