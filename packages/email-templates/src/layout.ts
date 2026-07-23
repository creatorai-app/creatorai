// The shared shell every Creator AI email renders into, so branding lives in one
// place instead of being copy-pasted per template. Table-based and inline-styled
// on purpose: Outlook ignores <style> blocks, flexbox and most modern CSS.

export const BRAND_NAME = 'Creator AI';
export const BRAND_URL = 'https://tryscriptai.com';

// Transparent-background PNG, so it sits on the dark header band without the
// black box the old asset had.
export const LOGO_URL = 'https://tryscriptai.com/lighter%20email%20logo.png';

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export const COLORS = {
  band: '#0f0a29',
  bandText: '#ffffff',
  bandMuted: '#9c93c7',
  page: '#f5f5f7',
  card: '#ffffff',
  heading: '#111111',
  body: '#333333',
  muted: '#777777',
  accent: '#4f2fd6',
} as const;

export interface EmailLayoutProps {
  /** Browser/client tab title. */
  title: string;
  /** The big line at the top of the card. */
  heading: string;
  /** Body HTML — a paragraph, or several to be joined. */
  bodyHtml: string | string[];
  cta?: { label: string; url: string };
  /** Small print under the CTA (fallback links, "ignore this" notes). */
  footnoteHtml?: string | string[];
  /** Centered line in the dark footer band. */
  footerText?: string;
  /**
   * Inbox preview line. Without it clients show the first body text, which is
   * usually the heading again.
   */
  preheader?: string;
}

export function renderEmailLayout({
  title,
  heading,
  bodyHtml,
  cta,
  footnoteHtml,
  footerText,
  preheader,
}: EmailLayoutProps): string {
  const join = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v.join('\n') : (v ?? '');

  // The logo carries alt="" because the wordmark beside it already says the
  // name — otherwise blocked images render "Creator AI" twice.
  const header = `
      <tr>
        <td style="background:${COLORS.band};padding:20px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">
                <img src="${LOGO_URL}" width="37" height="36" alt="" style="display:block;border:0;width:37px;height:36px;">
              </td>
              <td style="vertical-align:middle;color:${COLORS.bandText};font-family:${FONT_STACK};font-size:19px;font-weight:700;letter-spacing:.4px;line-height:1;">
                ${BRAND_NAME}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const ctaBlock = cta
    ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;">
            <tr>
              <td style="background:${COLORS.accent};border-radius:26px;">
                <a href="${cta.url}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-family:${FONT_STACK};font-size:15px;font-weight:600;">${cta.label}</a>
              </td>
            </tr>
          </table>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT_STACK};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;background:${COLORS.page};">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${COLORS.card};border-radius:12px;overflow:hidden;box-shadow:0 2px 14px rgba(0,0,0,.06);">
${header}
          <tr>
            <td style="padding:36px 32px;">
              <h1 style="margin:0 0 18px;font-family:${FONT_STACK};font-size:22px;line-height:1.3;color:${COLORS.heading};">${heading}</h1>
              ${join(bodyHtml)}
${ctaBlock}
              ${join(footnoteHtml)}
            </td>
          </tr>
          <tr>
            <td style="background:${COLORS.band};color:${COLORS.bandMuted};padding:22px 32px;text-align:center;font-family:${FONT_STACK};font-size:12px;line-height:1.6;">
              ${footerText ?? `${BRAND_NAME} &middot; <a href="${BRAND_URL}" style="color:${COLORS.bandMuted};">${BRAND_URL.replace('https://', '')}</a>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Standard body paragraph, so spacing stays consistent between templates. */
export function paragraph(html: string, marginBottom = 18): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT_STACK};color:${COLORS.body};font-size:15px;line-height:1.7;">${html}</p>`;
}

/** Small print — fallback URLs, "ignore this email" notes. */
export function footnote(html: string): string {
  return `<p style="margin:28px 0 0;font-family:${FONT_STACK};color:${COLORS.muted};font-size:13px;line-height:1.7;">${html}</p>`;
}
