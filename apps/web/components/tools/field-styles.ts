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
 * A hairline border with a soft resting shadow, lifting on hover and blooming
 * into a purple halo on focus. The focus state is drawn with box-shadow rather
 * than Tailwind's `ring-*`, because the base component already sets a ring and
 * an offset and layering a second one fought it; one shadow also lets the
 * border and glow animate together.
 */
export const TOOL_FIELD =
  // Hairline border rather than the default 1px slate, so the shadow does the
  // work of separating the field from the card instead of a hard outline.
  "rounded-xl border border-slate-200/70 bg-white px-4 py-3 text-slate-900 " +
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_1px_rgba(15,23,42,0.03)] " +
  "transition-[box-shadow,border-color,transform] duration-200 ease-out " +
  "placeholder:text-slate-400 " +
  "hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] " +
  "focus-visible:border-purple-300 focus-visible:shadow-[0_0_0_4px_rgba(168,85,247,0.12),0_4px_14px_rgba(168,85,247,0.10)] " +
  "focus-visible:ring-0 focus-visible:ring-offset-0 " +
  "dark:border-slate-700/70 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"

/** Same treatment for a multi-line field. */
export const TOOL_FIELD_TEXTAREA = `${TOOL_FIELD} resize-none leading-relaxed`
