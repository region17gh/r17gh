import { useI18n } from "@/i18n";

/** Lead-in before the first character, then one character every 70ms. */
const LEAD_MS = 250;
const PER_CHARACTER_MS = 70;

/**
 * The last line, typed in a character at a time.
 *
 * Split into spans for the effect, and given an aria-label so that assistive
 * technology reads the greeting rather than spelling it. Under
 * prefers-reduced-motion the stylesheet shows every character at once, so the
 * delays here simply never come into play.
 */
export function Coda() {
  const { t } = useI18n();
  const text = t("charter.coda");
  const characters = Array.from(text);

  return (
    <p
      className="charter-coda charter-fade"
      style={{ "--charter-i": 4 } as React.CSSProperties}
      aria-label={text}
    >
      {characters.map((character, index) => (
        <span
          // Characters repeat, so the index is the only stable key here.
          key={`${index}-${character}`}
          aria-hidden="true"
          style={
            {
              "--charter-char-delay": `${index * PER_CHARACTER_MS + LEAD_MS}ms`,
            } as React.CSSProperties
          }
        >
          {character === " " ? " " : character}
        </span>
      ))}
    </p>
  );
}
