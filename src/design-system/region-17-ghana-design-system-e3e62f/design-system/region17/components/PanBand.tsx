import React from "react";

export interface PanBandProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rule height in px. 3–4 is the institutional default. */
  height?: number;
  /** Token names, in order. */
  order?: string[];
}

/**
 * Pan-African band: red / gold / green / black. The system's one piece of pure
 * ornament. A 3–4px rule at the top of official surfaces — never a background.
 */
export const PanBand = React.forwardRef<HTMLDivElement, PanBandProps>(function PanBand(
  { height = 4, order = ["--pan-red", "--gold-500", "--pan-green", "--pan-black"], style, ...rest },
  ref,
) {
  return (
    <div ref={ref} aria-hidden="true" style={{ display: "flex", height, width: "100%", ...style }} {...rest}>
      {order.map((token) => (
        <span key={token} style={{ flex: 1, background: `var(${token})` }} />
      ))}
    </div>
  );
});
