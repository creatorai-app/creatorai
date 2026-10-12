import { renderEmailLayout, paragraph, footnote, button, COLORS, BRAND_NAME, BRAND_URL, FONT_STACK } from './layout';
import { firstNameOf } from './merge-tags';

export interface WelcomeEmailProps {
  fullName: string | null;
  email?: string;
}

export const WELCOME_EMAIL_SUBJECT = `Welcome to ${BRAND_NAME}!`;

const STEPS = [
  {
    title: 'Connect your YouTube channel',
    text: 'Creator AI reads your public videos and channel stats. Nothing is ever posted to your channel.',
  },
  {
    title: 'Build AI memory',
    text: 'Pick three to five videos that sound most like you. In a few minutes it learns your tone, pacing and vocabulary.',
  },
  {
    title: 'Create in your own voice',
    text: 'Every script, idea and story structure arrives sounding like your channel, not like an AI.',
  },
];

const FEATURES = [
  { name: 'Scripts', path: '/dashboard/scripts', text: 'A real hook, sections that re-hook, and a closing CTA.' },
  { name: 'Ideation', path: '/dashboard/research', text: 'Video ideas scored for opportunity in your niche.' },
  { name: 'Story Builder', path: '/dashboard/story-builder', text: 'A story structure with a retention score before you film.' },
  { name: 'Thumbnails', path: '/dashboard/thumbnails', text: 'Thumbnails that are yours to use, with no watermark.' },
  { name: 'Subtitles', path: '/dashboard/subtitles', text: 'Subtitles in 70+ languages, exported as SRT or VTT.' },
  { name: 'Audio Dubbing', path: '/dashboard/dubbing', text: 'Dub finished videos into 90+ languages in your own cloned voice.' },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sectionHeading = (text: string) =>
  `<h2 style="margin:36px 0 6px;font-family:${FONT_STACK};font-size:17px;line-height:1.4;color:${COLORS.heading};">${text}</h2>`;

const stepsBlock = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px;background:#f6f4ff;border-radius:10px;">
                <tr><td style="padding:10px 20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${STEPS.map(
  (s, i) => `
                    <tr>
                      <td width="38" valign="top" style="padding:12px 0;">
                        <div style="width:26px;height:26px;border-radius:13px;background:${COLORS.accent};color:#ffffff;font-family:${FONT_STACK};font-size:13px;font-weight:700;line-height:26px;text-align:center;">${i + 1}</div>
                      </td>
                      <td valign="top" style="padding:12px 0;font-family:${FONT_STACK};">
                        <div style="color:${COLORS.heading};font-size:15px;font-weight:600;line-height:1.5;">${s.title}</div>
                        <div style="color:${COLORS.body};font-size:14px;line-height:1.6;">${s.text}</div>
                      </td>
                    </tr>`,
).join('')}
                  </table>
                </td></tr>
              </table>`;

const featuresBlock = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
${FEATURES.map(
  (f) => `
                <tr>
                  <td style="padding:13px 0;border-bottom:1px solid #ececf3;font-family:${FONT_STACK};">
                    <a href="${BRAND_URL}${f.path}" style="color:${COLORS.accent};font-size:15px;font-weight:600;text-decoration:none;">${f.name} &rarr;</a>
                    <div style="margin-top:2px;color:${COLORS.body};font-size:14px;line-height:1.6;">${f.text}</div>
                  </td>
                </tr>`,
).join('')}
              </table>`;

/** Sent once by the web auth callback after a new user's first sign-in. */
export function generateWelcomeEmail({ fullName, email }: WelcomeEmailProps): string {
  const firstName = firstNameOf(fullName);
  const heading =
    firstName === 'there' ? `Welcome to ${BRAND_NAME}` : `Welcome to ${BRAND_NAME}, ${escapeHtml(firstName)}`;

  return renderEmailLayout({
    title: `Welcome • ${BRAND_NAME}`,
    preheader: 'Your account is ready, with 500 free credits every month. Here is how to get your first script.',
    heading,
    bodyHtml: [
      paragraph(
        'Your account is ready. The Starter plan gives you <strong>500 free credits every month</strong>, no card needed.',
      ),
      paragraph('Creator AI does its best work once it has watched your videos. Here is the quickest way to get there:', 10),
      stepsBlock,
      button('Set up my AI', `${BRAND_URL}/dashboard`),
      sectionHeading('What you can make'),
      featuresBlock,
    ],
    footnoteHtml: [
      footnote('Already have a finished video? Subtitles and dubbing work without connecting a channel.'),
      footnote('Questions or stuck on something? Just reply to this email and our team will help.'),
    ],
    footerText: email ? `${BRAND_NAME} &middot; Sent to ${escapeHtml(email)}` : undefined,
  });
}
