/**
 * Content shapes shared by the /tools pages and the /features pages.
 *
 * These started life in lib/free-tools.ts as ToolStep/ToolSection/ToolFaq. The
 * product feature registry needs the same three shapes for its landing pages,
 * and importing them out of the free-tools registry would make the list of what
 * the product does depend on the list of free marketing tools, which is
 * backwards. They live here instead; free-tools.ts re-exports the original
 * names as aliases, so nothing that already imported them had to change.
 *
 * Data only, no React: scripts/generate-llms.mts imports the registries from
 * plain node, which resolves neither the "@/" alias nor JSX.
 */

/** One numbered step in a "how it works" list. */
export interface ContentStep {
  title: string;
  description: string;
}

/**
 * One long-form body section. `body` holds one entry per paragraph and may use
 * `**bold**`, `*italic*` and `[label](/href)` — the only inline formatting the
 * RichText parser in components/tools/ToolPageShell.tsx understands.
 */
export interface ContentSection {
  heading: string;
  body: string[];
}

export interface ContentFaq {
  question: string;
  answer: string;
}
