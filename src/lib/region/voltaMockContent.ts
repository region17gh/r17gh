/**
 * MOCK CONTENT FOR THE VOLTA REGION PAGE. NOT REAL DATA. NOT DERIVED FROM ANY ROW.
 * ============================================================================
 *
 * Every value in this file is invented. It is here on a standing instruction:
 * the Volta page is being built to show what an actively-engaged region looks
 * like six months in, not what it looks like on launch day, and the design pass
 * that settled the page depends on these rows existing. Do not strip them as
 * part of another change; swapping them for real data is its own later pass and
 * this file is the whole of the swap.
 *
 * TWO THINGS IT CONTRADICTS, RECORDED HERE SO NOBODY HAS TO REDISCOVER THEM:
 *
 * 1. CLAUDE.md, Copy rules: "Never invent social proof. Ratings, attendance,
 *    download and member counts are derived from real rows by trigger. There is
 *    no field anywhere for typing one in." `registry` and `glanceMock` below
 *    are typed-in member counts. That is the rule this file breaks, knowingly,
 *    and it is the reason nothing here may reach production as-is.
 *
 * 2. `region_payload('volta').not_yet_backed` says, in the database's own
 *    words: "needs: needs table not built. Render the module empty, not with
 *    placeholder rows." `needs` below is placeholder rows.
 *
 * WHAT IS NOT MOCK, and must never be moved into this file: the district list,
 * their names, capitals, zones, summaries, url_paths and depths; the priority
 * sectors and their notes; every source citation and confidence flag attached
 * to those. All of it comes from `region_payload('volta')`, which is real.
 *
 * `page_built` is not mock either. It was mock in the design export
 * (`pageBuilt: true/false` per district) and is now a column on `public.places`
 * read through the payload.
 *
 * Keyed throughout by `places.slug`. The design export's short ids are retired.
 */

export interface MockNeed {
  /** `places.slug` of the district this need sits in, or null for region-wide. */
  place: string | null;
  placeLabel: string;
  sector: string;
  title: string;
  body: string;
  cost: string;
  jobs: string;
  jobsLabel: string;
  status: string;
  level: "verified" | "estimate" | "projected" | "disputed";
  cite: string;
}

export interface MockFeedItem {
  id: string;
  category: "EVENT" | "PROGRAMME" | "RESOURCE" | "STORY" | "SERVICE";
  title: string;
  meta: string;
  badge: string;
  price: string;
  cta: string;
  imageHint: string;
  sheet?: "story" | "service";
}

export type StoryBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "q"; text: string }
  | { kind: "img"; hint: string; caption: string }
  | { kind: "video"; embed: string; caption: string }
  | { kind: "link"; href: string; text: string; note: string };

export interface MockStory {
  imageHint: string;
  title: string;
  author: string;
  initials: string;
  authorHref: string;
  date: string;
  readTime: string;
  listenMins: number;
  footnote: string;
  blocks: StoryBlock[];
}

/**
 * Design placeholder depth per district, standing in for `places.depth_slug`.
 *
 * Production has all eighteen at `listed`. Ho Municipal and Ketu South
 * Municipal render as Partnered, and three more as Profiled, because the design
 * needs the three-state chip visible. `docs/volta-district-id-reconciliation.md`
 * records this as deliberate and says not to correct it here.
 */
export const MOCK_DEPTH: Record<string, "Listed" | "Profiled" | "Partnered"> = {
  "ho-municipal": "Partnered",
  "ketu-south-municipal": "Partnered",
  "agotime-ziope": "Profiled",
  "hohoe-municipal": "Profiled",
  "kpando-municipal": "Profiled",
};

/** "What is happening here", in the district spotlight sheet. */
export const MOCK_HAPPENINGS: Record<string, string[]> = {
  "ho-municipal": [
    "30 Jul 2026 · Sourced district profile published",
    "Returnee landing support runs from Ho, rolling cohort",
  ],
  "ketu-south-municipal": ["12 Aug 2026 · Assembly signed a district partnership"],
  "hohoe-municipal": [
    "18 Jul 2026 · District profile entered review",
    "Wli to Afadja visitor circuit surveyed, unfunded",
  ],
  "agotime-ziope": ["Kente finishing house documented in the district plan, $1.1M, unfunded"],
  anloga: ["Hogbetsotso, a guided homecoming · 7 Nov 2026"],
  "south-tongu": ["Cold-chain aggregation points costed in the RCC plan, $4.2M, unfunded"],
  "afadjato-south": ["Wli to Afadja visitor circuit surveyed, unfunded"],
};

/** The short need rows shown inside the district spotlight sheet. */
export const MOCK_DISTRICT_NEEDS: Record<
  string,
  { title: string; cost: string; status: string }[]
> = {
  "south-tongu": [
    { title: "Cold-chain aggregation points", cost: "$4.2M", status: "Costed, unfunded · estimate" },
  ],
  "agotime-ziope": [
    { title: "Kpetoe kente finishing house", cost: "$1.1M", status: "Documented · estimate" },
  ],
  "hohoe-municipal": [
    { title: "Wli to Afadja visitor circuit", cost: "$2.8M", status: "Concept, surveyed · projected" },
  ],
  "afadjato-south": [
    { title: "Wli to Afadja visitor circuit", cost: "$2.8M", status: "Concept, surveyed · projected" },
  ],
};

/** What each zone carries, in the spotlight sheet. Keyed by `places.zone`. */
export const MOCK_ZONE_CARRIES: Record<string, string> = {
  "southern-coastal":
    "Fishing and shallot farming on the sandbar soils, salt from the lagoon, and the border trade that moves through Aflao. The coast also carries the region's heritage sites and its erosion problem.",
  "capital-central":
    "Administration and services around Ho, agro-processing at the market towns, and the kente economy at Kpetoe. The middle belt is where the region's plans are written and costed.",
  "highland-border":
    "Cocoa and coffee on the ridge, the waterfall-and-mountain visitor country around Wli and Afadja, and the crossings into Togo. Ghana's highest ground, mostly unbuilt for visitors.",
};

/** The two invented figures in the at-a-glance band. The other four are real. */
export const MOCK_GLANCE = {
  membersWatching: "412",
  postingsOpen: "3",
  year: "2026",
};

/** The registry section: chart, counts, ledger. All invented. */
export const MOCK_REGISTRY = {
  chart: [
    { month: "Mar", value: 40 },
    { month: "Apr", value: 95 },
    { month: "May", value: 160 },
    { month: "Jun", value: 240 },
    { month: "Jul", value: 330 },
    { month: "Aug", value: 412 },
  ],
  stats: [
    { value: "38", label: "Declarations made" },
    { value: "2", label: "Districts partnered" },
  ],
  ledger: [
    {
      date: "12 Aug 2026",
      kind: "partnership",
      actor: "Ketu South Municipal",
      action: "Assembly signed a district partnership",
    },
    {
      date: "30 Jul 2026",
      kind: "brief",
      actor: "Ho Municipal",
      action: "Sourced district profile published",
    },
    {
      date: "18 Jul 2026",
      kind: "brief",
      actor: "Hohoe Municipal",
      action: "District profile entered review",
    },
    {
      date: "02 Jul 2026",
      kind: "visit",
      actor: "Region 17",
      action: "Working visit to the Regional Coordinating Council, Ho",
    },
  ],
  assembliesNote: "1 of 18 assemblies has posted directly. 2 are partnered.",
};

/** "What Volta needs". Placeholder rows; the needs table does not exist. */
export const MOCK_NEEDS: MockNeed[] = [
  {
    place: "south-tongu",
    placeLabel: "South Tongu",
    sector: "Agribusiness",
    title: "Cold-chain aggregation points",
    body: "Fish and vegetables lose more than a third of value between landing sites and Ho market. Six aggregation points with cold storage are costed; none are funded.",
    cost: "$4.2M",
    jobs: "240",
    jobsLabel: "Jobs",
    status: "Costed, unfunded",
    level: "estimate",
    cite: "Volta RCC medium-term development plan · unconfirmed with the region",
  },
  {
    place: "agotime-ziope",
    placeLabel: "Agotime-Ziope",
    sector: "Culture and heritage",
    title: "Kpetoe kente finishing house",
    body: "The looms are running; the finishing and export capacity is not. A shared dye house and finishing workshop at Kpetoe is documented in the district plan.",
    cost: "$1.1M",
    jobs: "180",
    jobsLabel: "Weavers served",
    status: "Documented",
    level: "estimate",
    cite: "Agotime-Ziope district plan · unconfirmed with the assembly",
  },
  {
    place: "hohoe-municipal",
    placeLabel: "Hohoe · Afadjato South",
    sector: "Tourism and hospitality",
    title: "Wli to Afadja visitor circuit",
    body: "Ghana's highest waterfall and its highest peak sit an hour apart. Trailheads, guides and lodge sites are surveyed; the circuit is unbuilt.",
    cost: "$2.8M",
    jobs: "120",
    jobsLabel: "Jobs",
    status: "Concept, surveyed",
    level: "projected",
    cite: "Ghana Tourism Authority site survey, 2024",
  },
  {
    place: "ho-municipal",
    placeLabel: "Ho Municipal",
    sector: "Health",
    title: "Diagnostic imaging at the regional referral hospital",
    body: "Ho Municipal's teaching hospital is the referral point for imaging across all eighteen districts, but its scanner is down more often than it runs. A second CT unit and a maintenance contract are budgeted in the district plan.",
    cost: "$3.4M",
    jobs: "60",
    jobsLabel: "Clinical and technical roles",
    status: "Posted by the assembly",
    level: "verified",
    cite: "Ho Municipal District Assembly · posted directly",
  },
];

/** Icons for the priority sectors, keyed by the real `sectors.slug`. */
export const SECTOR_ICONS: Record<string, string> = {
  agribusiness: "sprout",
  "infrastructure-logistics": "truck",
  manufacturing: "factory",
  "tourism-hospitality": "compass",
  "culture-heritage": "landmark",
  energy: "zap",
};

/** "What the region holds for you". */
export const MOCK_RECIPROCAL = [
  {
    kind: "Learn",
    title: "Kente at Kpetoe",
    body: "Sit with a weaver for a week and leave with a strip you made yourself.",
    action: "Learn the cloth",
    hint: "Kente being woven at Kpetoe",
  },
  {
    kind: "Visit",
    title: "Wli Falls",
    body: "A guided trail to Ghana's tallest waterfall, run by the community that lives beside it.",
    action: "Plan a visit",
    hint: "Wli Falls from the trail",
  },
  {
    kind: "Exchange",
    title: "Hogbetsotso",
    body: "The Anlo homecoming festival, in November. Come stand in the procession, not just watch it.",
    action: "Join the homecoming",
    hint: "Hogbetsotso festival, Anloga",
  },
  {
    kind: "Volunteer",
    title: "The Keta heritage coast",
    body: "A season on the sea-defence and shoreline crews protecting Fort Prinzenstein from erosion.",
    action: "Give a season",
    hint: "Keta lagoon and coast",
  },
];

/** The events, programmes, resources and stories feed. */
export const MOCK_FEED: MockFeedItem[] = [
  {
    id: "briefing",
    category: "EVENT",
    title: "Volta investor briefing",
    meta: "12 Dec 2026 · Virtual · 90 minutes",
    badge: "Free to members",
    price: "Non-members $25",
    cta: "RSVP",
    imageHint: "Briefing photo, 800×500",
  },
  {
    id: "hogbetsotso",
    category: "EVENT",
    title: "Hogbetsotso, a guided homecoming",
    meta: "7 Nov 2026 · Anloga · 3 days",
    badge: "Members $120",
    price: "Non-members $180",
    cta: "RSVP",
    imageHint: "Festival photo, 800×500",
  },
  {
    id: "returnee",
    category: "PROGRAMME",
    title: "Returnee landing support, Ho",
    meta: "Rolling cohort · In person",
    badge: "Members $95",
    price: "Non-members $150",
    cta: "Learn more",
    imageHint: "Programme photo, 800×500",
  },
  {
    id: "profiles",
    category: "RESOURCE",
    title: "District profiles, the 18-district set",
    meta: "PDF · Updated as districts are profiled",
    badge: "Members only",
    price: "Not sold separately",
    cta: "Access",
    imageHint: "Resource cover, 800×500",
  },
  {
    id: "looms",
    category: "STORY",
    title: "The looms at Kpetoe",
    meta: "6 minute read · 9 minute listen",
    badge: "",
    price: "",
    cta: "Read the story",
    imageHint: "Loom photo, 800×500",
    sheet: "story",
  },
  {
    id: "diligence",
    category: "SERVICE",
    title: "Land due diligence, Volta corridor",
    meta: "Partner service · Book online or in person",
    badge: "Members $250",
    price: "Non-members $350",
    cta: "Get in touch",
    imageHint: "Service photo, 800×500",
    sheet: "service",
  },
  {
    id: "gipc",
    category: "RESOURCE",
    title: "GIPC roadmap, the Volta pages",
    meta: "PDF excerpt · 2025",
    badge: "Free",
    price: "",
    cta: "Download",
    imageHint: "Document cover, 800×500",
  },
  {
    id: "keta-story",
    category: "STORY",
    title: "Keta, the sea and the wall",
    meta: "3 minute read · 4 minute listen",
    badge: "",
    price: "",
    cta: "Read the story",
    imageHint: "Coast photo, 800×500",
    sheet: "story",
  },
];

/**
 * Long-form story bodies, ported from the design export.
 *
 * Deliberately not `t()` keys. These stand in for rows a `stories` table will
 * hold: article bodies by a named author, which arrive already written in a
 * language and are not translated by the locale dictionary any more than a
 * member's declaration headline is. Every piece of UI chrome around them is a
 * `t()` key.
 *
 * Note for the copy owner: these carry em dashes as sentence punctuation,
 * which CLAUDE.md bans in Region 17's own voice. Ported verbatim rather than
 * rewritten, because rewriting a bylined author's prose is a bigger call than
 * this pass gets to make. Flagged, not fixed.
 */
export const MOCK_STORIES: Record<string, MockStory> = {
  looms: {
    imageHint: "Loom photo, 1600×700",
    title: "The looms at Kpetoe",
    author: "Selorm Agbeko",
    initials: "SA",
    authorHref: "#author-selorm-agbeko",
    date: "August 2026",
    readTime: "6 minute read",
    listenMins: 9,
    footnote:
      "Reported in Kpetoe in July 2026. Figures from the Agotime-Ziope district plan are estimates until the assembly confirms them. The finishing house appears under What Volta needs.",
    blocks: [
      {
        kind: "p",
        text: "You hear Kpetoe before you see it. The road in from Ho runs flat through maize and cassava, and then, half a kilometre out, a sound starts under the engine noise: a dry, even clack, hundreds of times a minute, from every direction at once. It is the sound of shuttles. Kpetoe does not have a weaving quarter. Kpetoe is a weaving quarter with a town attached.",
      },
      {
        kind: "p",
        text: "The looms sit in open-sided sheds, in courtyards, under mango trees. Each one is a narrow wooden frame about the length of a man lying down, strung with warp threads that run out the front of the shed, across the yard, and end tied to a stone or a post twenty metres away. The weaver sits inside the frame, works the heddles with cords held between his toes, and throws the shuttle with a flick that looks casual and is not. A strip of cloth four inches wide grows toward him at something like a hand-span an hour.",
      },
      {
        kind: "p",
        text: "This is agotime kente, and the people who make it want you to know it is not Asante kente. The patterns are older here, they will tell you, and came across the Togo border with the Agotime people; the weave is denser; the names are different. A cloth is not a design but a sentence. There is a pattern for a proverb about patience, one for a disputed chieftaincy, one woven for the 1992 constitution. When a weaver finishes a strip he reads it back the way you would read a ledger.",
      },
      {
        kind: "img",
        hint: "Weaver at the loom, Kpetoe, 1200×700",
        caption:
          "A weaver works the heddles in an open-sided shed at Kpetoe. The warp threads run twenty metres across the yard.",
      },
      { kind: "h", text: "Two hundred years, sixteen strips" },
      {
        kind: "p",
        text: "A full men's cloth takes sixteen to twenty-four strips, sewn edge to edge. At current pace that is three to five weeks of one man's labour, and the arithmetic of the trade sits right there. A finished cloth sells in Kpetoe for between eight hundred and two thousand cedis depending on the pattern and the buyer's patience. The same cloth in an Accra boutique sells for three times that. The same cloth in Washington or London, when it gets there at all, sells for ten times that, and none of the difference comes back down the road to the shed.",
      },
      {
        kind: "p",
        text: "The weavers know this precisely. Nobody in Kpetoe needs a development consultant to explain value chains; they can quote you the Accra markup to the cedi. What the town does not have is the capacity to capture it: a shared dye house, so colours stop depending on what the chemical seller in Ho has in stock; a finishing workshop, so strips become sewn, pressed, labelled cloth in Kpetoe rather than in a middleman's back room; and a way to sell direct to the person abroad who wanted the cloth in the first place.",
      },
      {
        kind: "q",
        text: "Nobody in Kpetoe needs a consultant to explain value chains. They can quote you the Accra markup to the cedi.",
      },
      {
        kind: "link",
        href: "#needs",
        text: "Kpetoe kente finishing house — the documented need",
        note: "Agotime-Ziope district plan · $1.1M, unfunded · under What Volta needs",
      },
      {
        kind: "p",
        text: "The district assembly has done its part of the paperwork. The Agotime-Ziope district plan documents a kente finishing house: a dye house, a finishing and export workshop, training places for young weavers, at a costed 1.1 million dollars, serving about a hundred and eighty weavers. The figure is an estimate and the page says so. It has been documented for three years. It is not funded.",
      },
      {
        kind: "video",
        embed: "https://www.youtube.com/embed/qix9EBFq3os",
        caption: "At the loom: the shuttle crossing at full working pace.",
      },
      { kind: "h", text: "What a visitor changes" },
      {
        kind: "p",
        text: "The Agbozume cloth market runs every four days, and Kpetoe's weavers carry strips there before dawn. Watch the market for an hour and you see the problem restated: the buyers are traders, the traders know the sheds have no other outlet, and the price finds its level accordingly. A weaver who sells direct — to a visitor standing in the shed, to a diaspora order placed through someone he trusts — keeps the whole difference. It happens now in ones and twos, on WhatsApp, when a cousin abroad vouches for a stranger.",
      },
      {
        kind: "p",
        text: "That is the honest scale of it today: ones and twos. A festival visitor who comes for Agbamevoza, the kente festival in September, and leaves with two cloths bought at the loom has moved more money into a weaving household than that household clears in a normal month. A teacher who spends a season helping the weavers' cooperative put its patterns and prices online has moved more than that. None of this requires the finishing house. All of it is easier if the finishing house exists.",
      },
      {
        kind: "p",
        text: "The oldest weaver I spoke to — he asked to be named as a Kpetoe man, nothing more — learned the craft from his grandfather, who learned it from his. He has two sons. One weaves. One is in Hamburg, and sends money home the way six hundred thousand Ghanaians abroad do, which is to say faithfully, and into consumption. “The boy sends money for the roof,” he said, working the heddles while he talked, the strip growing under his hands. “I would rather he sent an order.”",
      },
      {
        kind: "p",
        text: "That sentence is the whole page you are reading, said better. The looms are running. They have been running for two hundred years. What Kpetoe is short of has never been skill, and it is not, in the end, even money. It is a door — a way for the person abroad who already loves this cloth to become a customer, a backer, a partner, at the loom's end of the road instead of the boutique's.",
      },
    ],
  },
  "keta-story": {
    imageHint: "Coast photo, 1600×700",
    title: "Keta, the sea and the wall",
    author: "Selorm Agbeko",
    initials: "SA",
    authorHref: "#author-selorm-agbeko",
    date: "August 2026",
    readTime: "3 minute read",
    listenMins: 4,
    footnote:
      "Reported in Keta in July 2026. Erosion figures are from published coastal surveys and are estimates until the municipal assembly confirms them.",
    blocks: [
      {
        kind: "p",
        text: "Keta is a town on a sandbar, a few hundred metres of land between the Atlantic and the largest lagoon in Ghana, and for a century the sea has been taking it back. Ask anyone over fifty to show you where they were born and there is a fair chance they will point at water. The old commercial street, the cinema, whole quarters of the town: under the surf, some of it visible at low tide.",
      },
      {
        kind: "p",
        text: "Fort Prinzenstein still stands at the water's edge, half of it gone to the sea. The Danes built it in 1784 for the slave trade, and it held people whose descendants are now in Cuba, Brazil, the Caribbean and the American South. It is one of the few forts on this coast where the record connects specific shipments to specific destinations, which makes it, for some visitors, the most precise address their family history has.",
      },
      {
        kind: "p",
        text: "The sea defence built in the 2000s saved the town's core: seven groynes and a revetment, and behind them Keta has stopped retreating. But the defence ends at Hlorve, and east of its last groyne the erosion accelerated. Anloga and Ketu South lose metres of shore in a bad year. The engineering is understood, the extension is designed, and it is not funded. People in Keta describe the situation without drama, the way you describe weather.",
      },
      {
        kind: "p",
        text: "What Keta asks of a visitor is mostly that they come. The fort needs conservation it has waited decades for. The lagoon-side guesthouses are family businesses that fill for Hogbetsotso in November and sit near-empty otherwise. A heritage coast that ran from Fort Prinzenstein along the sandbar to Anloga — surveyed, guided, honest about what the sea has taken — is the kind of project a district assembly could post and a diaspora could answer. The wall bought Keta time. What the town does with the time is the open question, and it is not the sea that will answer it.",
      },
    ],
  },
};

/** The service sheet behind the "Land due diligence" feed card. */
export const MOCK_SERVICE = {
  title: "Land due diligence, Volta corridor",
  imageHint: "Service photo, 1600×700",
  body: "Before money moves, someone has to stand on the parcel. This service verifies a specific piece of land: who holds it, what encumbers it, and what it would actually take to build on it.",
  receives: [
    "Title and registry search at the Lands Commission",
    "A physical site visit with photographs and boundaries walked",
    "Chieftaincy and family-claim inquiry in the community",
    "A written report with a clear go, caution or stop",
  ],
  price: "Members $250 · Non-members $350",
};
