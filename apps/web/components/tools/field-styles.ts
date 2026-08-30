/**
 * Field styling for the public tool generators.
 *
 * The base Input/Textarea are stock shadcn: `rounded-md`, a neutral
 * `border-input`, and a `ring-ring` + `ring-offset-2` focus ring that lands as
 * a hard black outline in the light theme. The dashboard forms all override
 * that with the purple accent (see components/dashboard/scripts/FormStep1),
 * so these do the same and go a little further, since on a marketing page the
 * field is the thing the visitor is meant to look at.
 *
 * Softer resting border, no offset ring, and a purple glow on focus instead of
 * the black outline. Focus is carried by the ring alone: a
 * `focus-visible:border-*` was tried first and lost to the base component's
 * `border-input` for reasons that were not worth chasing, and two competing
 * focus signals would have been noise anyway.
 */
export const TOOL_FIELD =
  "rounded-xl border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm transition-colors duration-200 " +
  "placeholder:text-slate-400 " +
  "hover:border-slate-300 " +
  "focus-visible:ring-4 focus-visible:ring-purple-500/20 focus-visible:ring-offset-0 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"

/** Same treatment for a multi-line field. */
export const TOOL_FIELD_TEXTAREA = `${TOOL_FIELD} resize-none leading-relaxed`
