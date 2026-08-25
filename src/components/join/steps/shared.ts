import type { CSSProperties } from "react";

import type { JoinDraft } from "@/lib/join/draft";

export interface StepProps {
  draft: JoinDraft;
  update: (patch: Partial<JoinDraft>) => void;
}

/**
 * Controls a member taps are 48px, not the design system's 40px default.
 * `--control-md` is pointer-only dense UI; the join flow is neither.
 */
export const TAP_CONTROL: CSSProperties = { height: "var(--control-lg)" };

export const STEP_TOTAL = 4;
