import React from "react";
import sealSrc from "../assets/region17-seal.png";

export interface SealProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Rendered square size in px. Never below 48 — the seal loses legibility. */
  size?: number;
  alt?: string;
}

/**
 * The ceremonial seal. Certificates, formal correspondence, ceremonial contexts.
 * It is NOT the app icon, NOT the nav logo and never a UI affordance — use
 * Not for product chrome.
 */
export const Seal = React.forwardRef<HTMLImageElement, SealProps>(function Seal(
  { size = 64, alt = "Seal of the 17th Region of Ghana", style, ...rest },
  ref,
) {
  return (
    <img
      ref={ref}
      src={sealSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ width: size, height: size, objectFit: "contain", ...style }}
      {...rest}
    />
  );
});
