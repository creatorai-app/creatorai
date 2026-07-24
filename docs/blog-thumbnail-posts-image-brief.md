# Image brief — 3 thumbnail-tool blog posts (Jul 2026)

Every image referenced by the three new posts in `apps/web/lib/blog-data.ts`.
All new files go in `apps/web/public/blog/` so the markdown paths resolve.
**Until these files exist the posts render with broken images.**

Two buckets:

- **Bucket A — real screenshots (18 files).** These show third-party product UI.
  Do **not** AI-generate these. A generated "Canva interface" is a fabricated
  screenshot of a real company's product: it misleads readers and is a legal and
  trust risk. Capture them yourself from a live session, or pull from each
  vendor's official press/brand kit.
- **Bucket B — AI-generated originals (10 files).** Heroes, diagrams, concept
  illustrations. Prompts below.

Reference pattern copied from the source articles: one hero, one method/criteria
diagram, one screenshot per tool, one concept illustration per major strategy
section. Roughly one image every 250–300 words.

---

## Global specs

**Every image in these posts is 1600×900 (16:9).** That is deliberate. The blog
renders images as `<img class="w-full">` with no `width`/`height` attributes
([page.tsx:170](../apps/web/app/blog/[id]/page.tsx#L170)), so the browser cannot
reserve space before the file loads. One shared aspect ratio keeps the layout
shift identical and predictable on every post. Do not ship a 4:3 or portrait file
into a slot below — pad it onto a 1600×900 canvas instead.

| Property | Value |
|---|---|
| **Every inline image** | **1600×900 px (16:9)** |
| Article column at desktop | ~880 px, so 1600 px source ≈ 1.8× DPR — sharp on retina |
| OG / social crop of the hero | 1200×630 — keep the subject inside the middle 60% |
| Format | PNG for screenshots and diagrams, WebP acceptable for photographic heroes |
| Max file size | 250 KB after compression (Squoosh or `sharp`) |
| Colour mode | sRGB |
| Dark mode | Blog renders on both — avoid pure white, use `#0F1115`–`#F7F8FA` neutrals |
| Naming | fixed by the markdown paths below — do not rename |

### Portrait and non-16:9 sources

Two slots have sources that are not natively 16:9:

- `/blog/tool-picsart-thumbnail.png` — mobile UI. Capture the phone at 1170×2532,
  then centre it on a 1600×900 canvas with a flat `#12141A` background.
- `/blog/tool-gimp-software.png` — GIMP's multi-window layout is wider than 16:9.
  Capture at 1920×1080 and crop to the toolbox + canvas + layers panel.

Alt text is already written into each post and carries the focus keyword. If you
swap an image, keep the alt text.

---

## Bucket A — screenshots to capture (18 files)

Capture at 1600×900 or 2× retina, crop to the working area, hide personal data
(account name, email, credit balance). Add a subtle 8px rounded corner + soft
shadow so all 18 look like one set.

### Post 1 — `best-ai-thumbnail-maker-tools-that-boost-youtube-ctr-2026`

| File | Size | What to capture | Source |
|---|---|---|---|
| `/blog/tool-canva-ai-thumbnail.png` | 1600×900 | Canva editor, YouTube Thumbnail 1280×720 preset open, Magic Media panel visible | canva.com (free account) |
| `/blog/tool-pikzels-thumbnail.png` | 1600×900 | Pikzels generation screen with a face-model result grid | pikzels.com |
| `/blog/tool-vidiq-thumbnail.png` | 1600×900 | vidIQ dashboard showing CTR / outlier data, not the generator | vidiq.com |
| `/blog/tool-thumbmagic-thumbnail.png` | 1600×900 | Batch-generation view with multiple variants in a grid | thumbmagic.ai |
| `/blog/tool-adobe-express-thumbnail.png` | 1600×900 | Adobe Express with the Brand Kit panel open | adobe.com/express |
| `/blog/tool-playground-thumbnail.png` | 1600×900 | Playground canvas with a concept-art generation | playground.com |

### Post 2 — `best-ai-thumbnail-design-tools-for-youtube-video-covers-2026`

| File | Size | What to capture | Source |
|---|---|---|---|
| `/blog/tool-canva-magic-studio.png` | 1600×900 | Magic Studio landing/editor, 16:9 preset visible | canva.com |
| `/blog/tool-capcut-thumbnail.png` | 1600×900 | CapCut editor with the cover/thumbnail panel open on a timeline | capcut.com |
| `/blog/tool-fotor-thumbnail.png` | 1600×900 | Fotor YouTube-thumbnail template gallery | fotor.com |
| `/blog/tool-leonardo-thumbnail.png` | 1600×900 | Leonardo.Ai generation screen, model selector visible | leonardo.ai |
| `/blog/tool-clipdrop-thumbnail.png` | 1600×900 | Clipdrop remove-background before/after on a person | clipdrop.co |
| `/blog/tool-picsart-thumbnail.png` | 1600×900 | Picsart mobile UI (phone frame) with AI generator open | picsart.com |

### Post 3 — `best-youtube-thumbnail-software-ranked-and-tested-for-creators-2026`

| File | Size | What to capture | Source |
|---|---|---|---|
| `/blog/tool-canva-software.png` | 1600×900 | Canva editor, 1280×720 canvas with rulers/safe zone | canva.com |
| `/blog/tool-photoshop-software.png` | 1600×900 | Photoshop with a thumbnail PSD, layers panel visible | Adobe |
| `/blog/tool-figma-software.png` | 1600×900 | Figma file with thumbnail component variants in the assets panel | figma.com |
| `/blog/tool-snappa-software.png` | 1600×900 | Snappa template picker / editor | snappa.com |
| `/blog/tool-pixlr-software.png` | 1600×900 | Pixlr E in-browser with layers panel | pixlr.com |
| `/blog/tool-gimp-software.png` | 1600×900 | GIMP with a thumbnail open, layers + toolbox visible | gimp.org |

### Already in the repo — reuse, do not regenerate

`/thumbnail page.png` (Creator AI thumbnail dashboard) is used once in each of
the three posts. If you have a fresher capture of the thumbnail screen showing a
generated 1280×720 result, replace that single file and all three posts update.

---

## Bucket B — AI image prompts (10 files)

Each prompt below is written to be pasted whole. They are deliberately long:
diffusion models drop or invent elements when a prompt is vague, and every one of
these images has to communicate one specific argument from the post. Where a
prompt fixes a position ("left third", "upper-right quadrant"), keep it — the
layout is carrying meaning, not decoration.

**Append the STYLE BLOCK and NEGATIVE to every prompt, verbatim.**

> **STYLE BLOCK:** modern editorial technology illustration in a flat vector
> style with subtle dimensional depth. Clean geometric construction, precise
> shapes, generous negative space, strong compositional hierarchy where exactly
> one element is clearly dominant. Background is a deep matte navy (#12141A),
> evenly lit with no vignette. Colour is strictly limited: one warm accent
> (#FF5A36) reserved only for the single most important element in the frame, one
> cool accent (#4C8DFF) for connective lines, structure and secondary detail, and
> a neutral slate range (#2A2F3A through #8A93A3) for everything else. Soft
> ambient occlusion shadows beneath raised elements only, short and diffuse, never
> dramatic. No gradient stronger than 15% value shift. Crisp uniform 2px stroke
> weight on all outlines. Shapes have 8px rounded corners unless stated otherwise.
> Rendered to stay legible when downscaled to 400px wide. Professional SaaS
> marketing aesthetic, closer to a Stripe or Linear illustration than to stock
> clip-art. Balanced 16:9 composition with at least 8% padding on every edge.
>
> **NEGATIVE:** no text, no lettering, no numerals, no words, no captions, no
> logos, no brand marks, no watermarks, no signatures. No UI chrome that imitates
> a real existing product. No photorealistic or stock-photo human faces. No hands.
> No distorted or extra limbs. No clutter or background noise. No lens flare, no
> bloom, no glow, no neon, no cyberpunk palette, no gradient mesh, no 3D render,
> no glassmorphism, no drop-shadow stacking, no isometric grid floors, no
> confetti, no sparkles, no arrows drawn as hand-sketched doodles.

**Why "no text" is non-negotiable.** Diffusion models still garble lettering, and
garbled text inside a hero image reads as low quality to human readers and gives
Google's helpful-content systems a reason to discount the page. Every prompt below
reserves blank space where labels go. Add those labels afterwards in Figma or
Canva with a real font — which also means you can localise the set later without
regenerating a single image.

**A note on iteration.** Expect three to six generations per image. The most
common failure is the model adding decorative elements you did not ask for; when
that happens, re-run with the offending element appended to the NEGATIVE block
rather than rewriting the prompt.

---

### 1. `/blog/ai-thumbnail-maker-hero.png` — Post 1 hero

**Size:** 1600×900 px (16:9)
**Placement:** directly under the opening answer blockquote
**Alt in post:** "Best AI thumbnail maker tools compared for YouTube CTR in 2026"

**Prompt:**
> A wide editorial illustration depicting an abstract video-recommendation feed as
> a field of seven blank 16:9 rectangles arranged in a loose, staggered grid
> across the frame, floating at four clearly different depth planes so the
> composition reads as dimensional rather than flat. The rectangles are empty
> slate-grey cards with 8px rounded corners and thin 2px outlines; they carry no
> imagery, no text and no interface elements, only subtle interior tone variation
> to suggest content. Rectangles sitting on the furthest depth plane are smaller,
> slightly desaturated and softly de-emphasised; those nearer the viewer are
> larger, crisper and higher in contrast. One single rectangle positioned at the
> optical centre, very slightly right of true centre and marginally above the
> horizontal midline, is decisively dominant: roughly forty percent larger than
> any other card, lifted onto the frontmost plane, outlined in a clean warm orange
> 3px border with no glow whatsoever, and carrying a short soft ambient shadow
> beneath it to sell the elevation. This is the thumbnail that won the click and
> it must be unmistakably the focal point at a glance. A simple geometric cursor
> arrow, flat warm orange, sits at the lower-right corner of that dominant
> rectangle, angled naturally as if it has just arrived there. In the left third
> of the frame, a compact cluster of small connected nodes and circles renders an
> abstract generative system; from that cluster, thin 2px cool-blue connective
> lines fan outward with gentle organic curves, one line terminating cleanly at
> the edge of each of the seven rectangles, describing an automated process
> feeding the entire feed. The lines pass behind rectangles rather than over them,
> reinforcing depth. Lighting is even and ambient with no directional source and
> no cast highlights. The upper eighth of the frame and the outer margins are left
> deliberately empty and uncluttered as headline safe area. Overall visual motion
> flows left to right, from system to result.
> *(append STYLE BLOCK + NEGATIVE)*

**Composition map:** node cluster in the left third; the six supporting
rectangles spread across the middle and right; the dominant orange-edged
rectangle centred horizontally between 40% and 65% of the frame width.

**Crop safety:** this is the image Google Discover, X and LinkedIn will crop to
1200×630. Everything that carries the argument — the dominant rectangle and the
cursor — must sit inside the central 60% horizontally and the central 70%
vertically, or the comparison is lost the moment it is shared.

---

### 2. `/blog/ai-thumbnail-maker-testing-method.png` — Post 1 methodology

**Size:** 1600×900 px (16:9)
**Placement:** at the end of the "How We Tested" section
**Alt in post:** "How we tested each AI thumbnail maker across five real YouTube uploads"

**Prompt:**
> A clean horizontal five-stage process diagram reading strictly left to right
> across the full width of the frame, composed of five evenly spaced rounded
> rectangular panels of identical size, each with a 2px slate outline and 8px
> corner radius, connected by four thin 2px cool-blue arrows with simple flat
> triangular heads that sit precisely on the shared horizontal centreline. The
> panels are vertically centred with a large empty band above and a smaller empty
> band below. Panel one contains five small identical video cards stacked in a
> shallow overlapping fan, representing a fixed sample of test videos. Panel two
> contains a single small document glyph on the left from which seven thin
> cool-blue lines radiate rightward and terminate in seven tiny dots, describing
> one identical brief distributed to seven tools. Panel three contains seven
> miniature 16:9 rectangles arranged in a tidy single row, uniform in size and
> spacing, each with a marginally different interior tone so they read as distinct
> outputs. Panel four contains a simple two-axis line chart with a clean upward
> trending polyline drawn in warm orange, four plotted points, thin slate axis
> lines and no gridlines or numerals. Panel five contains a single circular badge
> enclosing a bold geometric checkmark, the badge filled warm orange as the
> terminal state of the process. Only panels four and five carry the warm accent;
> panels one through three stay entirely in the slate and cool-blue range so the
> eye travels naturally toward the result. Beneath each of the five panels sits an
> empty horizontal strip of clear background, at least 60px tall, reserved for a
> caption to be typeset later. Spacing between panels is uniform and generous.
> Absolutely no numerals inside the panels.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** this diagram exists to make the methodology feel rigorous
rather than anecdotal, which is the E-E-A-T signal the section is carrying. Keep
it austere. Any decoration undermines the point.

---

### 3. `/blog/ai-thumbnail-maker-mistakes.png` — Post 1 mistakes section

**Size:** 1600×900 px (16:9)
**Placement:** after the five numbered mistakes
**Alt in post:** "Five common AI thumbnail maker mistakes shown side by side"

**Prompt:**
> A comparison strip of five abstract 16:9 thumbnail mockups arranged in one
> straight horizontal row, identical in size, evenly spaced with clean 24px
> gutters, vertically centred in the frame with generous empty margin above and
> below. Each mockup is a rounded rectangle with a 2px slate outline containing
> only abstract geometry, never text or faces, and each illustrates one specific
> failure mode with unmistakable visual clarity. Mockup one is visibly
> over-cluttered: nine to twelve overlapping shapes of competing sizes crammed
> edge to edge with no breathing room and no clear focal point. Mockup two is
> washed out and low contrast: its interior shapes sit only a few percent apart in
> value from its own background, so the composition nearly dissolves and the panel
> reads almost empty from a distance. Mockup three is choked with dense horizontal
> bars of uniform height stacked in tight parallel rows, an abstract stand-in for
> far too much copy, filling roughly eighty percent of the panel. Mockup four
> contains five small near-identical miniature compositions repeated in a rigid
> grid with only trivial variation between them, communicating template fatigue.
> Mockup five is a chaotic scatter of eight unrelated shapes at random rotations,
> sizes and positions with no alignment or grid logic at all. Each of the five
> panels carries one small circular badge pinned to its upper-right corner,
> containing a bold geometric X, filled warm orange, identical in size and
> placement across all five so they read as a consistent system of annotation.
> The warm accent appears nowhere else in the image. The five panels themselves
> stay strictly within the slate and cool-blue range so the orange badges are the
> only thing the eye catches first. Alignment across the row is exact.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** each panel must be diagnosable in under a second at 400px
wide. If you cannot tell mockup two from mockup five when the image is shrunk,
push the contrast difference harder and regenerate.

---

### 4. `/blog/ai-thumbnail-maker-workflow.png` — Post 1 seven-step workflow

**Size:** 1600×900 px (16:9)
**Placement:** after the numbered workflow list
**Alt in post:** "Seven-step AI thumbnail maker workflow from hook to upload"

**Prompt:**
> A seven-step workflow illustration built around one single continuous cool-blue
> path, 3px wide, that enters at the mid-left edge of the frame and travels
> rightward in a smooth gentle S-curve, rising and falling shallowly so the
> composition fills the frame vertically without ever becoming steep or chaotic.
> Seated directly on that path at even intervals are seven circular nodes of
> identical diameter, each a filled slate circle with a 2px outline. Six nodes are
> slate; the seventh and final node is filled warm orange, marking completion, and
> is the only warm element on the path. Beside each node, alternating above and
> below the path to create rhythm and to keep the composition balanced, sits one
> small flat abstract glyph rendered in clean geometry at consistent scale: beside
> node one a simple quill or pen nib for writing the hook; beside node two three
> small stacked rounded word-blocks representing a three-word headline; beside
> node three three miniature 16:9 rectangles fanned slightly apart representing
> generated concepts; beside node four a magnifying glass positioned over a
> deliberately shrunken rectangle, representing the squint test at small size;
> beside node five a 16:9 frame with four corner brackets and one shaded
> lower-right corner block representing the duration-stamp safe zone; beside node
> six an upward arrow rising into a simple cloud shape representing upload; beside
> node seven a small tidy grid of cells representing a results log. Every glyph is
> outline-only or lightly filled slate, never warm orange. Adjacent to each node,
> on the opposite side from its glyph, leave a clear empty rectangular area at
> least 140px wide and 50px tall for a step label to be typeset later. The path
> never crosses over itself, never doubles back, and maintains consistent stroke
> weight along its full length. Margins on all four edges stay clear.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** the single unbroken path is the whole idea — it says these
seven steps are one loop rather than seven chores. If a generation breaks the
path into segments, discard it.

---

### 5. `/blog/ai-thumbnail-design-hero.png` — Post 2 hero

**Size:** 1600×900 px (16:9)
**Placement:** directly under the opening answer blockquote
**Alt in post:** "AI thumbnail design tools compared for YouTube video covers in 2026"

**Prompt:**
> A wide editorial illustration of seven abstract 16:9 video cover cards fanned
> out in a shallow, elegant arc across the centre of the frame, overlapping one
> another slightly like a held hand of cards, with the arc rising gently toward
> the middle and settling symmetrically at both ends. Each card is a rounded
> rectangle with a 2px outline, and critically each one carries a visibly
> different abstract interior composition so the set reads as seven genuinely
> distinct design approaches rather than seven copies: one card holds a simple
> centred head-and-shoulders silhouette in flat slate, one holds a single bold
> oversized geometric shape bleeding off its own edge, one holds a small ascending
> bar chart, one holds a flat two-tone colour block split on a diagonal, one holds
> three stacked horizontal bars of differing lengths, one holds a circular shape
> offset to one side with concentric rings, and one holds a minimal grid of four
> squares. None of the cards contain text, faces with features, or interface
> elements. The fourth card counting from the left is the clear hero of the
> composition: pulled forward out of the arc onto the frontmost depth plane,
> rendered roughly thirty percent larger than its neighbours, outlined in a clean
> warm orange 3px border, and grounded by a short soft ambient shadow. Its
> interior composition is the cleanest and most balanced of the seven, quietly
> making the argument that it is the best-designed cover. Overlaying two of the
> non-hero cards, thin 2px cool-blue measurement guides, corner brackets and a
> slim dimension line run along one edge, evoking specification and precision
> without resembling any real design application's interface. The arc is
> horizontally centred with balanced weight on both sides. The upper third of the
> frame stays open and empty for a headline overlay, and all four margins remain
> clear.
> *(append STYLE BLOCK + NEGATIVE)*

**Crop safety:** the fourth card must survive a 1200×630 centre crop. Position
the arc so cards three, four and five occupy the central 55% of the width.

**Why the fourth card:** it mirrors Creator AI's rank in the post. Readers will
not consciously register it, but the hero should not contradict the article.

---

### 6. `/blog/ai-thumbnail-design-criteria.png` — Post 2 scoring criteria

**Size:** 1600×900 px (16:9)
**Placement:** at the end of the "How We Scored" section
**Alt in post:** "Five scoring criteria used to rank AI thumbnail design tools"

**Prompt:**
> A radial scoring diagram, precisely symmetrical and centred in the frame,
> constructed as five evenly spaced spokes radiating at exact 72-degree intervals
> from a central rounded square. The central square is filled a slightly lighter
> slate than the background, outlined at 2px, and contains one simple 16:9 frame
> glyph with four corner brackets. Each of the five spokes is a thin 2px cool-blue
> line terminating in a small rounded panel of identical size and corner radius,
> and each panel holds exactly one flat abstract glyph rendered at consistent
> scale and stroke weight: an arrow exiting the boundary of a rectangle for export
> accuracy; a set of three left-aligned horizontal bars of descending length for
> text control; a simple featureless head-and-shoulders silhouette for subject
> quality; a plain circular stopwatch with a single hand and no numerals for
> iteration speed; and three interlocking rings for workflow fit. Connecting the
> five outer panels, a translucent warm-orange polygon is filled at roughly
> twenty-five percent opacity, its five vertices sitting at approximately eighty
> percent of the distance from centre to each panel, reading unmistakably as a
> filled radar or spider chart. Its edges are drawn at 2px in solid warm orange.
> Faint concentric guide pentagons in low-contrast slate sit behind the filled
> polygon at twenty-five, fifty and seventy-five percent extension to imply a
> measurement scale, drawn thin and deliberately subordinate. Outside each panel,
> facing away from the centre, leave a clear empty area at least 120px wide for a
> criterion label to be typeset later. Composition is balanced, generously
> padded, and mathematically even. No numerals anywhere.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** the polygon should look deliberately uneven at its vertices —
a perfect pentagon reads as a decorative shape, a lopsided one reads as data.

---

### 7. `/blog/ai-thumbnail-design-principles.png` — Post 2 strategy section

**Size:** 1600×900 px (16:9)
**Placement:** at the end of the "Smart Strategies" section
**Alt in post:** "High-click thumbnail design principles illustrated side by side"

**Prompt:**
> A four-quadrant instructional illustration filling the frame, divided by one
> thin 2px cool-blue vertical hairline and one thin 2px cool-blue horizontal
> hairline that cross precisely at the centre, creating four equal panels with
> generous internal padding so no quadrant feels crowded. Each quadrant carries
> equal visual weight and one clear idea. The upper-left quadrant shows a single
> abstract 16:9 composition rendered twice side by side at identical size, once in
> full colour and once converted to flat greyscale, with the greyscale version
> showing its subject still clearly separated from its background, demonstrating
> luminance contrast surviving desaturation. The upper-right quadrant shows the
> same base composition repeated three times in a neat horizontal row where
> exactly one element differs in each iteration — a shape's position in the first,
> its size in the second, its tone in the third — with the changed element in each
> picked out in warm orange to make single-variable testing legible at a glance.
> The lower-left quadrant shows one 16:9 cover card positioned in the upper half
> of the quadrant with, directly beneath it, a small two-axis line chart whose
> polyline drops sharply and early before flattening, the two connected by a
> single thin vertical warm-orange arrow pointing downward from card to chart,
> illustrating an over-promising cover destroying retention. The lower-right
> quadrant shows six small cover cards in a tidy three-by-two grid, all sharing an
> identical layout skeleton and identical corner radius with only their interior
> tones varying, communicating brand consistency across a channel. Warm orange
> appears only in the upper-right changed elements and the lower-left arrow;
> everywhere else stays slate and cool blue. The dividing hairlines are subtle
> and thin, never heavy borders.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** four quadrants is four chances to be muddy. If any single
quadrant needs a caption to be understood, the geometry in it has failed —
simplify that quadrant and regenerate.

---

### 8. `/blog/youtube-thumbnail-software-hero.png` — Post 3 hero

**Size:** 1600×900 px (16:9)
**Placement:** directly under the opening answer blockquote
**Alt in post:** "The best YouTube thumbnail software tools ranked and tested in 2026"

**Prompt:**
> A wide editorial illustration presenting seven abstract software windows
> arranged as a staggered ranking leaderboard across the frame, the tallest window
> at the left and each subsequent window stepping down slightly in height toward
> the right, producing a clean descending stair-step silhouette that reads
> instantly as a ranked list. Every window is a deliberately generic application
> frame: a rounded rectangle with a 2px outline, a slim title bar along its top
> containing three small evenly spaced circles at the left, and an entirely empty
> canvas area below carrying no interface elements, no menus, no toolbars, no
> icons and no text. The chrome must resemble no real existing software product.
> Beneath each window sits a small five-segment horizontal rating bar of identical
> construction, each bar filled to a visibly different level between three and
> five segments, the filled segments in slate and the empty segments as hollow
> outlines. One window, the fifth counting from the left, breaks the rhythm
> deliberately: it is lifted vertically out of the descending row onto the
> frontmost depth plane, rendered slightly larger than its neighbours, outlined in
> a clean warm orange 3px border, grounded with a short soft ambient shadow, and
> its rating bar alone is filled in warm orange. Every other window and bar stays
> strictly slate and cool blue. The perspective is flat and frontal with only the
> mildest suggestion of depth through scale and shadow, never a true isometric
> projection and never a receding grid floor. Windows are evenly spaced with
> consistent gutters. The upper portion of the frame stays open for a headline,
> and all four margins remain clear.
> *(append STYLE BLOCK + NEGATIVE)*

**Legal note:** generic chrome is a hard requirement, not an aesthetic
preference. A window that reads as a recognisable real application turns an
illustration into an implied screenshot of a product we are ranking.

**Crop safety:** the fifth window must fall inside the central 60% horizontally.

---

### 9. `/blog/youtube-thumbnail-software-criteria.png` — Post 3 evaluation criteria

**Size:** 1600×900 px (16:9)
**Placement:** at the end of the "How We Evaluated" section
**Alt in post:** "Five evaluation criteria used to rank YouTube thumbnail software"

**Prompt:**
> Five rounded rectangular cards arranged in a single evenly spaced horizontal
> row, identical in width, height and corner radius, vertically centred in the
> frame with a generous empty band above and a shorter clear band below, separated
> by consistent 32px gutters. Each card carries a 2px slate outline, a subtly
> lighter interior fill than the background, and contains exactly one flat
> abstract glyph centred within it, all five glyphs drawn at matching scale and
> stroke weight so the row reads as one coherent system. Card one holds a stack of
> three offset layered rectangles representing design power. Card two holds a
> smooth upward-curving arrow with a gentle ease, representing ease of use. Card
> three holds a tidy three-by-three grid of small squares representing template
> quality. Card four holds a 16:9 frame with four corner brackets and a downward
> arrow exiting its lower edge, representing export accuracy. Card five holds a
> simple balance scale with two level pans, representing value. Directly beneath
> each card, separated by consistent spacing, sits a five-segment horizontal
> progress bar of identical construction across all five, each filled to a
> different level between two and five segments; filled segments are warm orange
> and unfilled segments are hollow slate outlines. The warm accent appears only in
> those filled bar segments and nowhere else in the image, so the row of bars
> becomes the only place the eye registers colour. Beneath each progress bar,
> leave a clear empty strip at least 50px tall for a criterion label. Alignment
> across the row is exact: all five cards share a common top edge and a common
> baseline, and all five bars share one horizontal axis.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** the varying fill levels are the point. Five identically filled
bars turn a scorecard into wallpaper.

---

### 10. `/blog/youtube-thumbnail-software-decision.png` — Post 3 decision guide

**Size:** 1600×900 px (16:9)
**Placement:** at the end of the "Choosing by Where You Are" section
**Alt in post:** "Choosing YouTube thumbnail software based on channel stage"

**Prompt:**
> A branching decision-tree illustration flowing cleanly from left to right across
> the full width of the frame. One single cool-blue path, 3px wide, enters at the
> vertical centre of the left edge, travels rightward a short distance, and then
> divides through a series of smooth rounded branch points into five separate
> terminal branches that fan out vertically and settle at even intervals along the
> right side of the frame. Branches split with soft radiused corners rather than
> sharp angles, never cross one another, and maintain consistent stroke weight
> throughout. Each of the five branches terminates in a rounded rectangular panel
> of identical size and corner radius, and each panel contains exactly one flat
> abstract glyph at consistent scale: a small seedling with two leaves for
> beginners; a two-axis line chart with a conspicuously flat horizontal polyline
> for plateaued creators; a repeating calendar-style grid of uniform cells for
> weekly publishers; three simple linked head-and-shoulders silhouettes for teams;
> and a globe with three concentric latitude rings for multilingual scaling. The
> third branch counting from the top is highlighted throughout: its path segment
> is drawn in warm orange along its entire length from the first branch point to
> its panel, and its terminal panel carries a warm orange 3px outline. All other
> paths and panels remain strictly cool blue and slate. To the right of each
> terminal panel, leave a clear empty rectangular area at least 200px wide for a
> label to be typeset later, and keep the right margin generous enough that those
> labels will not crowd the frame edge. Vertical spacing between the five terminal
> panels is even, and the overall branching structure is visually balanced above
> and below the horizontal centreline.
> *(append STYLE BLOCK + NEGATIVE)*

**Art direction:** highlight exactly one branch. Highlighting two makes the
diagram a menu instead of a recommendation.

---

## Post-generation checklist

1. Export at 1600×900, then compress to ≤ 250 KB (`sharp`, Squoosh, or
   `pnpm dlx @squoosh/cli`).
2. Drop into `apps/web/public/blog/` with the exact filenames above.
3. Verify each post renders: `pnpm --filter web dev` → `/blog/<slug>`.
4. Re-run `pnpm --filter web seo:audit` (alt text carries the focus keyword, so
   don't edit alts casually).
5. Re-run `pnpm --filter web llms:generate` if any post copy changed.

## Recommended generators

- **Diagrams (2, 4, 6, 9, 10):** honestly faster and cleaner in Figma by hand
  than in any model. The prompts are there if you want a starting point.
- **Heroes and concept panels (1, 3, 5, 7, 8):** Midjourney v7 or Ideogram 3
  (Ideogram if you decide you do want baked-in text after all).
- **Consistency trick:** generate image 1 first, then pass it as a style
  reference (`--sref` in Midjourney) for the other four so the set matches.
