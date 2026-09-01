import { useI18n } from "@/i18n";
import { fallbackSrc, srcSet, type CharterImage } from "@/lib/charter/assets";

/**
 * A framed photograph, or the space one will occupy.
 *
 * While `licensed` is false the slot renders as plain paper carrying the same
 * alternative text, at the same aspect ratio, and makes no network request.
 * That is the skeleton the spec asks for: paper, never a spinner, and never a
 * layout that moves when the real file lands.
 */
export function Media({
  image,
  className,
  effect,
}: {
  image: CharterImage;
  className?: string;
  /** Named scroll-stage effect. "ken-burns" adds a slow, continuous zoom-in. */
  effect?: "ken-burns";
}) {

  const { t } = useI18n();
  const alt = t(image.altKey);

  if (!image.licensed) {
    return (
      <div
        className={`charter-media-pending ${className ?? ""}`.trim()}
        role="img"
        aria-label={alt}
        data-blocked-by={image.blockedBy}
      />
    );
  }

  return (
    <img
      className={`charter-media ${className ?? ""}`.trim()}
      src={fallbackSrc(image)}
      srcSet={srcSet(image)}
      sizes={image.sizes}
      alt={alt}
      // Every slot is object-fit: cover, so this is the part of the picture
      // that survives every viewport. It is per-slot, not a page default.
      style={{ objectPosition: image.focus }}
      // Only a real photograph gets the Ken Burns breath and the parallax; the
      // placeholder has nothing to move.
      data-charter-parallax=""
      data-charter-effect={effect}
      // Everything below the opening screen waits until it is near the viewport.

      loading={image.eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={image.eager ? "high" : "auto"}
    />
  );
}

/**
 * The plate: a 16:9 photograph with its credit sitting on a text-shadow rather
 * than on a gradient bar, so nothing dims the image to make type legible.
 */
export function Plate({ image, index }: { image: CharterImage; index: number }) {
  const { t } = useI18n();

  return (
    <figure
      className="charter-plate charter-plate-wide charter-fade"
      style={{ "--charter-i": index } as React.CSSProperties}
    >
      <Media image={image} />
      {image.creditKey ? (
        <figcaption className="charter-cred">{t(image.creditKey)}</figcaption>
      ) : null}
    </figure>
  );
}
