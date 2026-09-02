import { useEffect, useState } from "react";

import { Badge, Button, Card, Field, Icon, Input, Textarea } from "@/design-system/region-17-ghana-design-system-e3e62f";
import { useI18n } from "@/i18n";
import {
  MOCK_FEED,
  MOCK_SERVICE,
  MOCK_STORIES,
  type MockFeedItem,
  type MockStory,
} from "@/lib/region/voltaMockContent";

import { PhotoSlot } from "./PhotoSlot";

/**
 * Events, programmes, resources and stories, plus the two sheets they open.
 *
 * ALL OF IT IS MOCK. `offerings` exists in the schema and `surface_offerings()`
 * is the call that will fill this section; nothing here reads either yet. See
 * the header of `voltaMockContent.ts` for why the placeholder rows are here at
 * all and what has to happen before this page is public.
 */

const FILTERS = ["all", "events", "programmes", "resources", "stories"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_CATEGORY: Record<Exclude<Filter, "all">, MockFeedItem["category"]> = {
  events: "EVENT",
  programmes: "PROGRAMME",
  resources: "RESOURCE",
  stories: "STORY",
};

type Sheet = { kind: "story"; id: string } | { kind: "service" } | null;

export function RegionFeed({ regionName }: { regionName: string }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheet, setSheet] = useState<Sheet>(null);

  const cards = MOCK_FEED.filter(
    (f) => filter === "all" || f.category === FILTER_CATEGORY[filter as Exclude<Filter, "all">],
  );

  return (
    <section
      id="happening"
      aria-labelledby="happening-heading"
      style={{ borderTop: "1px solid var(--border-hairline)", padding: "var(--space-16) 0 var(--space-20)" }}
    >
      <div className="r17-region-width" style={{ padding: "0 var(--gutter-lg)" }}>
        <span
          className="r17-eyebrow"
          style={{ color: "var(--gold-700)", display: "inline-flex", alignItems: "center", gap: "10px" }}
        >
          <span style={{ width: "28px", height: "2px", background: "var(--gold-500)", display: "inline-block" }} />
          {t("region.feed.eyebrow", { region: regionName })}
        </span>
        <h2
          id="happening-heading"
          style={{ font: "var(--type-section)", fontSize: "44px", color: "var(--text-strong)", margin: "14px 0 0" }}
        >
          {t("region.feed.heading")}
        </h2>
        <div
          role="group"
          aria-label={t("region.feed.filterLabel")}
          style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-6)" }}
        >
          {FILTERS.map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f)}
                style={{
                  font: "var(--type-ui)",
                  fontSize: "var(--text-body-sm)",
                  fontWeight: "var(--weight-medium)",
                  minHeight: "var(--control-lg)",
                  padding: "0 20px",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  background: on ? "var(--navy-700)" : "var(--surface-card)",
                  color: on ? "var(--paper-000)" : "var(--text-body)",
                  border: `1px solid ${on ? "var(--navy-700)" : "var(--border-default)"}`,
                }}
              >
                {t(`region.feed.filter.${f}`)}
              </button>
            );
          })}
        </div>
      </div>

      <ul
        style={{
          display: "flex",
          gap: "var(--space-6)",
          overflowX: "auto",
          padding: "var(--space-8) var(--gutter-lg) var(--space-4)",
          margin: 0,
          listStyle: "none",
          scrollPaddingLeft: "var(--gutter-lg)",
        }}
      >
        {cards.map((card) => (
          <li key={card.id} style={{ flex: "none", width: "320px" }}>
            <FeedCard
              card={card}
              onOpen={
                card.sheet === "story"
                  ? () => setSheet({ kind: "story", id: card.id })
                  : card.sheet === "service"
                    ? () => setSheet({ kind: "service" })
                    : undefined
              }
            />
          </li>
        ))}
      </ul>

      {sheet?.kind === "story" ? (
        <StorySheet story={MOCK_STORIES[sheet.id] ?? MOCK_STORIES["looms"]!} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === "service" ? <ServiceSheet onClose={() => setSheet(null)} /> : null}
    </section>
  );
}

function FeedCard({ card, onOpen }: { card: MockFeedItem; onOpen?: () => void }) {
  const { t } = useI18n();
  return (
    <Card elevation={0} padding="none" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PhotoSlot brief={card.imageHint} style={{ height: "180px", border: "none" }} />
      <div
        style={{
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          flex: 1,
        }}
      >
        <span className="r17-eyebrow" style={{ color: "var(--gold-700)" }}>
          {t(`region.feed.category.${card.category.toLowerCase()}`)}
        </span>
        <h3 style={{ font: "var(--type-title)", fontSize: "21px", color: "var(--text-strong)", margin: 0 }}>
          {card.title}
        </h3>
        <p className="r17-cite" style={{ color: "var(--text-cite)", margin: 0 }}>
          {card.meta}
        </p>
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {card.badge ? (
            <span style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Badge tone="gold">{card.badge}</Badge>
              {card.price ? (
                <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
                  {card.price}
                </span>
              ) : null}
            </span>
          ) : null}
          {onOpen ? (
            <Button size="lg" variant="secondary" fullWidth iconAfter="arrow-right" onClick={onOpen}>
              {card.cta}
            </Button>
          ) : (
            <Button size="lg" variant="secondary" fullWidth iconAfter="arrow-right" disabled>
              {card.cta}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** The right-hand sheet both the story and the service render inside. */
function Sheet({
  label,
  eyebrow,
  width,
  background,
  onClose,
  children,
}: {
  label: string;
  eyebrow: string;
  width: string;
  background: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <button
        type="button"
        aria-label={t("region.sheet.closeBackdrop")}
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "rgba(9,19,35,0.5)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          background,
          boxShadow: "var(--shadow-4)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 20px",
            borderBottom: "1px solid var(--border-hairline)",
            flexShrink: 0,
            background: "var(--surface-card)",
          }}
        >
          <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
            {eyebrow}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("region.sheet.close")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              display: "inline-flex",
              padding: "14px",
              margin: "-6px -8px",
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function StorySheet({ story, onClose }: { story: MockStory; onClose: () => void }) {
  const { t } = useI18n();
  const [listening, setListening] = useState(false);

  return (
    <Sheet
      label={story.title}
      eyebrow={t("region.story.eyebrow")}
      width="min(720px,96vw)"
      background="var(--surface-page)"
      onClose={onClose}
    >
      <div style={{ height: "200px", position: "relative", flexShrink: 0 }}>
        <PhotoSlot brief={story.imageHint} style={{ position: "absolute", inset: 0, border: "none" }} />
        <span
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            padding: "4px 10px",
            borderRadius: "999px",
            background: "rgba(9,19,35,0.55)",
            color: "var(--paper-050)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.04em",
          }}
        >
          {story.date}
        </span>
      </div>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "var(--surface-page)",
          borderBottom: "1px solid var(--gold-300)",
        }}
      >
        <div
          style={{
            maxWidth: "600px",
            margin: "0 auto",
            boxSizing: "border-box",
            padding: "10px var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "21px",
              lineHeight: 1.2,
              letterSpacing: "-0.018em",
              color: "var(--text-strong)",
              margin: 0,
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {story.title}
          </h2>
          <button
            type="button"
            aria-pressed={listening}
            onClick={() => setListening((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 12px",
              minHeight: "40px",
              border: "1px solid var(--border-default)",
              borderRadius: "999px",
              background: "var(--surface-card)",
              color: "var(--navy-700)",
              cursor: "pointer",
              font: "var(--type-ui)",
              fontWeight: 600,
              fontSize: "12px",
              flexShrink: 0,
            }}
          >
            <Icon name={listening ? "pause" : "play"} size={13} />
            {listening
              ? t("region.story.pause")
              : t("region.story.listen", { minutes: story.listenMins })}
          </button>
          <span className="r17-cite" style={{ color: "var(--text-cite)", flexShrink: 0 }}>
            {story.readTime}
          </span>
        </div>
        {listening ? (
          <div
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              boxSizing: "border-box",
              padding: "0 var(--space-6) 10px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span
              style={{
                flex: 1,
                height: "3px",
                borderRadius: "2px",
                background: "var(--border-hairline)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "18%",
                  background: "var(--gold-500)",
                }}
              />
            </span>
            <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
              {t("region.story.progress", { minutes: story.listenMins })}
            </span>
          </div>
        ) : null}
      </div>

      <article style={{ maxWidth: "600px", margin: "0 auto", padding: "var(--space-2) var(--space-6) var(--space-16)" }}>
        {story.blocks.map((block, i) => {
          const key = `${block.kind}-${i}`;
          if (block.kind === "h") {
            return (
              <h3
                key={key}
                style={{ font: "var(--type-title)", fontSize: "23px", color: "var(--text-strong)", margin: "44px 0 0" }}
              >
                {block.text}
              </h3>
            );
          }
          if (block.kind === "q") {
            return (
              <blockquote
                key={key}
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "25px",
                  lineHeight: 1.4,
                  color: "var(--navy-700)",
                  borderLeft: "3px solid var(--gold-500)",
                  paddingLeft: "22px",
                  margin: "40px 0 0",
                }}
              >
                {block.text}
              </blockquote>
            );
          }
          if (block.kind === "img") {
            return (
              <figure key={key} style={{ margin: "40px 0 0" }}>
                <PhotoSlot
                  brief={block.hint}
                  style={{ height: "320px", borderRadius: "var(--radius-card)", border: "none" }}
                />
                <figcaption className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "10px" }}>
                  {block.caption}
                </figcaption>
              </figure>
            );
          }
          if (block.kind === "video") {
            return (
              <figure key={key} style={{ margin: "40px 0 0" }}>
                <div
                  style={{
                    aspectRatio: "16/9",
                    borderRadius: "var(--radius-card)",
                    overflow: "hidden",
                    background: "var(--navy-900)",
                  }}
                >
                  <iframe
                    src={block.embed}
                    title={block.caption}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                  />
                </div>
                <figcaption className="r17-cite" style={{ color: "var(--text-cite)", marginTop: "10px" }}>
                  {block.caption}
                </figcaption>
              </figure>
            );
          }
          if (block.kind === "link") {
            return (
              <a
                key={key}
                href={block.href}
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  margin: "40px 0 0",
                  padding: "16px 18px",
                  border: "1px solid var(--border-hairline)",
                  borderRadius: "var(--radius-card)",
                  background: "var(--surface-card)",
                  textDecoration: "none",
                }}
              >
                <span style={{ color: "var(--gold-600)", display: "inline-flex", flexShrink: 0 }}>
                  <Icon name="link" size={14} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      font: "var(--type-ui)",
                      fontWeight: 600,
                      fontSize: "14.5px",
                      color: "var(--text-strong)",
                    }}
                  >
                    {block.text}
                  </span>
                  <span className="r17-cite" style={{ color: "var(--text-cite)", display: "block", marginTop: "2px" }}>
                    {block.note}
                  </span>
                </span>
                <span style={{ color: "var(--navy-700)", display: "inline-flex", flexShrink: 0 }}>
                  <Icon name="arrow-right" size={14} />
                </span>
              </a>
            );
          }
          return (
            <p
              key={key}
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "18.5px",
                lineHeight: 1.8,
                color: "var(--ink-700)",
                margin: "26px 0 0",
              }}
            >
              {block.text}
            </p>
          );
        })}

        <div style={{ borderTop: "1px solid var(--border-hairline)", marginTop: "var(--space-12)", paddingTop: "var(--space-5)" }}>
          <p className="r17-cite" style={{ color: "var(--text-cite)", margin: 0 }}>
            {story.footnote}
          </p>
        </div>

        <footer
          style={{
            borderTop: "1px solid var(--gold-300)",
            marginTop: "var(--space-6)",
            paddingTop: "var(--space-5)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "var(--navy-700)",
              color: "var(--paper-050)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sans)",
              fontSize: "11.5px",
              fontWeight: 600,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {story.initials}
          </span>
          <a
            href={story.authorHref}
            style={{
              font: "var(--type-ui)",
              fontWeight: 600,
              fontSize: "13.5px",
              color: "var(--text-strong)",
              textDecoration: "none",
              borderBottom: "1px solid var(--gold-500)",
              whiteSpace: "nowrap",
            }}
          >
            {story.author}
          </a>
        </footer>
      </article>
    </Sheet>
  );
}

function ServiceSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [submitted, setSubmitted] = useState(false);

  return (
    <Sheet
      label={MOCK_SERVICE.title}
      eyebrow={t("region.service.eyebrow")}
      width="min(560px,96vw)"
      background="var(--surface-card)"
      onClose={onClose}
    >
      <PhotoSlot brief={MOCK_SERVICE.imageHint} style={{ height: "200px", border: "none" }} />
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: "var(--surface-card)",
          borderBottom: "1px solid var(--gold-300)",
        }}
      >
        <div style={{ maxWidth: "480px", margin: "0 auto", boxSizing: "border-box", padding: "12px var(--space-6)" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "21px",
              lineHeight: 1.2,
              letterSpacing: "-0.018em",
              color: "var(--text-strong)",
              margin: 0,
            }}
          >
            {MOCK_SERVICE.title}
          </h2>
        </div>
      </div>

      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
          padding: "var(--space-6) var(--space-6) var(--space-12)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <p style={{ font: "var(--type-body)", fontSize: "15px", color: "var(--text-body)", margin: 0 }}>
          {MOCK_SERVICE.body}
        </p>
        <div>
          <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
            {t("region.service.receiveHeading")}
          </span>
          <ul
            style={{
              margin: "var(--space-3) 0 0",
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {MOCK_SERVICE.receives.map((line) => (
              <li
                key={line}
                style={{
                  font: "var(--type-body)",
                  fontSize: "14.5px",
                  color: "var(--text-body)",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: "var(--navy-700)",
                    marginTop: "9px",
                    flexShrink: 0,
                  }}
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            alignItems: "flex-start",
            borderTop: "1px solid var(--border-hairline)",
            paddingTop: "var(--space-5)",
          }}
        >
          <span className="r17-cite" style={{ color: "var(--text-cite)" }}>
            {MOCK_SERVICE.price}
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "var(--space-5)" }}>
          <span className="r17-eyebrow" style={{ color: "var(--text-muted)" }}>
            {t("region.service.contactHeading")}
          </span>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}
          >
            <Field label={t("region.service.email")}>
              <Input type="email" placeholder="you@example.com" autoComplete="email" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <Field label={t("region.service.firstName")}>
                <Input autoComplete="given-name" />
              </Field>
              <Field label={t("region.service.lastName")}>
                <Input autoComplete="family-name" />
              </Field>
            </div>
            <Field label={t("region.service.location")}>
              <Input placeholder={t("region.service.locationPlaceholder")} />
            </Field>
            <Field label={t("region.service.message")}>
              <Textarea rows={4} placeholder={t("region.service.messagePlaceholder")} />
            </Field>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <Button type="submit" size="lg" iconAfter="arrow-right">
                {t("region.service.send")}
              </Button>
              {/*
                No enquiry endpoint exists. The design confirmed "Sent. We reply
                within 72 hours." on submit, which is a promise made to a real
                person by a form that sends nothing. Mock counts are one thing;
                this is another. Wire it to a real destination before the page
                is public, and this string goes away.
              */}
              <span className="r17-cite" role="status" style={{ color: "var(--text-cite)" }}>
                {submitted ? t("region.service.notConnected") : t("region.service.replyNote")}
              </span>
            </div>
          </form>
        </div>
      </div>
    </Sheet>
  );
}
