import { ImageResponse } from "next/og";
import { siteConfig } from "./seo";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export function renderOgImage({
  title,
  eyebrow = siteConfig.name,
}: {
  title: string;
  eyebrow?: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #4c1d95 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #a855f7, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
              fontWeight: 700,
            }}
          >
            C
          </div>
          <span style={{ fontSize: "32px", fontWeight: 700 }}>
            {siteConfig.name}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "2px",
              color: "#c4b5fd",
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: "1000px",
            }}
          >
            {title}
          </span>
        </div>

        <span style={{ fontSize: "26px", color: "#cbd5e1" }}>
          {siteConfig.url.replace(/^https?:\/\//, "")}
        </span>
      </div>
    ),
    { ...OG_SIZE }
  );
}
