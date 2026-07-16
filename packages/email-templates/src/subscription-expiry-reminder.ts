export interface SubscriptionExpiryReminderProps {
  planName: string;
  // Human-readable time left, e.g. "7 days", "3 days", "24 hours".
  timeLeft: string;
  // When the plan drops back to Starter, e.g. "July 22, 2026".
  expiresOn: string;
  // Absolute URL to the pricing / upgrade page.
  upgradeUrl: string;
}

// Plain-HTML email (matches the reset-password template's black/white style).
// Sent by the worker's daily reminder cron at 7d / 3d / 24h before an
// admin-granted plan expires and auto-downgrades to Starter.
export function generateSubscriptionExpiryReminderEmail({
  planName,
  timeLeft,
  expiresOn,
  upgradeUrl,
}: SubscriptionExpiryReminderProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your plan expires soon • Creator AI</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" style="padding:40px 20px;background:#f7f7f7;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #000;border-radius:6px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#000;color:#fff;padding:28px 20px;text-align:center;font-size:22px;font-weight:700;letter-spacing:1.5px;">
              PLAN EXPIRING SOON
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 18px;color:#222;font-size:16px;line-height:1.6;">Hello there,</p>
              <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.6;">
                Your <strong>${planName}</strong> plan on <strong>Creator AI</strong> ends in
                <strong>${timeLeft}</strong> — on <strong>${expiresOn}</strong>. When it does, your
                account will automatically drop back to the free <strong>Starter</strong> plan and your
                monthly credit allowance will decrease.
              </p>
              <p style="margin:0 0 32px;color:#333;font-size:16px;line-height:1.6;">
                To keep your current credits and throughput, renew or upgrade before then.
              </p>

              <table role="presentation" width="100%">
                <tr>
                  <td align="center" style="padding:6px 0 8px;">
                    <a href="${upgradeUrl}"
                      style="display:inline-block;background:#000;color:#fff;text-decoration:none;border-radius:26px;padding:14px 34px;font-size:15px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;">
                      Upgrade my plan
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;color:#888;font-size:13px;line-height:1.6;">
                If the button doesn't work, copy this link into your browser:<br>
                <span style="color:#555;word-break:break-all;">${upgradeUrl}</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;border-top:1px solid #000;padding:20px 32px;text-align:center;color:#888;font-size:12px;">
              You're receiving this because your Creator AI plan is about to expire.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
