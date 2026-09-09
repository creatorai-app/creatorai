import type { FeatureDemoVideo as FeatureDemoVideoData } from "@/lib/product-features"

/**
 * The ~1 minute product demo slot on a feature page.
 *
 * Renders NOTHING when the feature has no `demoVideo`, which is currently all
 * eight of them. That is deliberate: a visible "video coming soon" box on a live
 * marketing page is worse than no box, and an empty 16:9 grey rectangle is the
 * thing a visitor reads as broken. The placeholder is this interface, not a
 * rectangle — set `demoVideo` in the registry and the section appears, wired.
 *
 * Everything the recording needs is already decided here so the video PR is a
 * data change rather than a component change:
 *
 * - `aspect-video` wrapper reserves the box before the file loads, so playback
 *   costs zero CLS.
 * - `preload="none"` means a page that nobody plays downloads no video at all.
 *   On a throttled connection this is the difference between a fast page and a
 *   6MB one.
 * - `poster` is served from public/ so the first frame paints immediately.
 * - A `<track kind="captions">` is required, not optional — captions are an
 *   accessibility requirement, and `default` turns them on without a click.
 * - WebM is offered before MP4: browsers take the first `<source>` they can
 *   play, and the WebM is the smaller file.
 * - No autoplay, so nothing starts making noise at a reader. Native `controls`
 *   are keyboard operable for free, which a custom player would have to earn.
 * - No video library. A `<video>` element does all of the above already.
 *
 * The transcript renders as real text on the page because that is the part
 * search and answer engines can actually read — a video file is opaque to them.
 * It sits in a <details> so it does not push the rest of the page down; the
 * content inside is still in the HTML and still indexed.
 */
export default function FeatureDemoVideo({
  video,
  title,
}: {
  video?: FeatureDemoVideoData
  /** Feature name, for the accessible label and the transcript heading. */
  title: string
}) {
  if (!video) return null

  return (
    <figure className="mx-auto w-full max-w-3xl">
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm">
        <video
          className="h-full w-full"
          controls
          preload="none"
          playsInline
          poster={video.poster}
          aria-label={`${title} demo`}
        >
          {video.webm && <source src={video.webm} type="video/webm" />}
          <source src={video.mp4} type="video/mp4" />
          <track
            kind="captions"
            src={video.captions}
            srcLang="en"
            label="English"
            default
          />
          Your browser cannot play this video. The full transcript is below.
        </video>
      </div>

      {video.transcript.length > 0 && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-purple-700">
            Read the transcript
          </summary>
          <figcaption className="sr-only">{title} demo transcript</figcaption>
          <div className="mt-4 space-y-3">
            {video.transcript.map((paragraph, i) => (
              <p key={i} className="text-[0.98rem] leading-relaxed text-slate-600">
                {paragraph}
              </p>
            ))}
          </div>
        </details>
      )}
    </figure>
  )
}
