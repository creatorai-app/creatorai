"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "./lib/utils";

/**
 * The app-wide "we can't reach the server" screen.
 *
 * Deliberately self-contained: no images, no motion library, no data fetching.
 * Everything it needs to paint is already in the document by the time it
 * renders. That matters, because the one situation it exists for is the one
 * where fetching anything else is likely to fail too. The illustration is
 * inline SVG rather than a file in /public for the same reason, and the
 * animation is CSS rather than `motion/react-m`, whose feature bundle arrives
 * through a dynamic import that an offline browser cannot complete.
 */

export interface ConnectionLostProps {
  /** Headline. Override when a surface needs to name what it lost. */
  title?: string;
  description?: string;
  /** Defaults to a full reload, which is the fix in almost every case. */
  onRetry?: () => void | Promise<void>;
  /** Secondary escape hatch, e.g. "/dashboard". Omit to hide it. */
  homeHref?: string;
  homeLabel?: string;
  /** false lays it out inside a panel instead of filling the viewport. */
  fullScreen?: boolean;
  className?: string;
}

/** Live browser connectivity. Starts optimistic so SSR and the first client
 *  paint agree, then corrects itself once mounted. */
function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}

function UnpluggedIllustration() {
  return (
    <svg
      viewBox="0 0 220 170"
      role="img"
      aria-label="An unplugged cable beside a blank screen"
      className="h-40 w-48 sm:h-48 sm:w-56"
    >
      {/* Ground shadow, so the panel reads as floating rather than pasted on. */}
      <ellipse
        cx="78"
        cy="150"
        rx="48"
        ry="7"
        className="fill-slate-900/[0.07] dark:fill-black/40"
      />

      <g className="animate-float">
        {/* Screen, tilted like a card that has been knocked loose. */}
        <g transform="rotate(-8 78 98)">
          <rect
            x="24"
            y="60"
            width="108"
            height="76"
            rx="12"
            className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
            strokeWidth="3"
          />
          <rect
            x="40"
            y="76"
            width="54"
            height="6"
            rx="3"
            className="fill-slate-200/80 dark:fill-slate-700"
          />
          <rect
            x="40"
            y="90"
            width="34"
            height="6"
            rx="3"
            className="fill-slate-200/60 dark:fill-slate-700/70"
          />
        </g>

        {/* Plug, pulled free and hanging clear of the screen. The cable curls
            away to the right so it never crosses the panel. */}
        <g
          className="stroke-purple-500 dark:stroke-purple-400"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M164 22v16" />
          <path d="M182 22v16" />
          <path
            d="M156 38h34v11a17 17 0 0 1-34 0z"
            className="fill-purple-100 dark:fill-purple-500/20"
          />
          <path d="M173 66v14c0 12 9 18 21 19" className="fill-none" />
        </g>

        {/* Disconnect sparks, thrown toward the gap the cable left behind. */}
        <g
          className="stroke-amber-500 dark:stroke-amber-400"
          strokeWidth="3.5"
          strokeLinecap="round"
        >
          <path d="M146 32l-11-8" />
          <path d="M143 50l-13-2" />
          <path d="M152 16l-5-11" />
        </g>
      </g>
    </svg>
  );
}

export function ConnectionLost({
  title = "Connection lost",
  description = "We can't reach Creator AI right now. Your work is safe. Reconnect and pick up where you left off.",
  onRetry,
  homeHref,
  homeLabel = "Go to dashboard",
  fullScreen = true,
  className,
}: ConnectionLostProps) {
  const online = useOnline();
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      if (onRetry) await onRetry();
      else window.location.reload();
    } finally {
      // A reload never gets here; a caller-supplied retry does.
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden px-4 py-12 sm:px-6",
        fullScreen && "min-h-screen bg-slate-50 dark:bg-slate-950",
        className,
      )}
    >
      {/* House signature: one soft purple bloom behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-[100px]"
      />

      <div className="relative z-10 w-full max-w-3xl rounded-[2rem] border border-white/50 bg-white/60 p-8 shadow-sm backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/60 sm:p-12">
        <div className="flex flex-col items-center gap-8 text-center sm:flex-row sm:gap-10 sm:text-left">
          <div className="shrink-0">
            <UnpluggedIllustration />
          </div>

          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                online
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  online ? "bg-emerald-500" : "bg-amber-500 animate-pulse",
                )}
              />
              {/* Online here means the browser has a network but we still
                  couldn't reach the API. Worth saying, because it tells the
                  user retrying is worthwhile and their wifi is not the fault. */}
              {online ? "Your network is fine, the server isn't responding" : "You appear to be offline"}
            </span>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
              {title}
            </h1>

            <p className="mt-3 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-400">
              {description}
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button
                onClick={handleRetry}
                disabled={retrying}
                size="lg"
                // autoFocus: this screen replaces whatever the user was doing,
                // so the one way forward should be the first thing they tab to.
                autoFocus
              >
                <RefreshCw className={cn(retrying && "animate-spin")} />
                {retrying ? "Reconnecting…" : "Try again"}
              </Button>

              {/* ghost has no colour of its own, so it inherits and vanishes
                  on a dark card. Every other ghost in the app pairs it with
                  explicit slate/purple text; this does the same. */}
              {homeHref && (
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="text-slate-600 hover:bg-purple-50 hover:text-purple-600 dark:text-slate-300 dark:hover:bg-purple-950/30 dark:hover:text-purple-300"
                >
                  <a href={homeHref}>{homeLabel}</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConnectionLost;
