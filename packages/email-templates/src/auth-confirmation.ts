import { renderEmailLayout, paragraph, footnote, COLORS, BRAND_NAME } from './layout';

export interface AuthConfirmationEmailProps {
  /** Where the confirm button points. */
  confirmationUrl: string;
  /** Shown in the footer so the recipient can see which address was signed up. */
  email?: string;
}

export const AUTH_CONFIRMATION_SUBJECT = `Confirm your email for ${BRAND_NAME}`;

/**
 * Signup confirmation — the first email a new user ever receives.
 *
 * Supabase Auth sends this one (the app calls supabase.auth.signUp), so it is
 * normally rendered with Go template placeholders rather than real values;
 * see scripts/render-supabase-templates.ts.
 */
export function generateAuthConfirmationEmail({
  confirmationUrl,
  email,
}: AuthConfirmationEmailProps): string {
  return renderEmailLayout({
    title: `Confirm your email • ${BRAND_NAME}`,
    preheader: `Confirm your address and your ${BRAND_NAME} account is ready.`,
    heading: 'Confirm your email',
    bodyHtml: [
      paragraph(
        `Welcome to ${BRAND_NAME}. Confirm your email address and your account is ready — 500 free credits every month, no card required.`,
      ),
      paragraph('This link expires in 24 hours.', 28),
    ],
    cta: { label: 'Confirm my email', url: confirmationUrl },
    footnoteHtml: [
      footnote(
        `If the button doesn't work, paste this into your browser:<br><span style="color:${COLORS.accent};word-break:break-all;">${confirmationUrl}</span>`,
      ),
      footnote(`Didn't sign up for ${BRAND_NAME}? You can safely ignore this email.`),
    ],
    footerText: email ? `${BRAND_NAME} &middot; Sent to ${email}` : undefined,
  });
}
