export interface ResetPasswordEmailProps {
  otp: string;
  expiresInMinutes?: number;
}

export function generateResetPasswordEmail({
  otp,
  expiresInMinutes = 10,
}: ResetPasswordEmailProps): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Password Reset OTP • Creator AI</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" style="padding:40px 20px;background:#f7f7f7;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #000;border-radius:6px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:#000;color:#fff;padding:28px 20px;text-align:center;font-size:22px;font-weight:700;letter-spacing:1.5px;">
              PASSWORD RESET
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 32px;">
              <p style="margin:0 0 18px;color:#222;font-size:16px;line-height:1.6;">Hello there,</p>
              <p style="margin:0 0 28px;color:#333;font-size:16px;line-height:1.6;">
                We received a request to reset your password for your <strong>Creator AI</strong> account.
                Use the OTP code below to verify your identity:
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" style="border:1px solid #000;border-radius:6px;overflow:hidden;margin:38px 0;">
                <tr>
                  <td style="background:#fafafa;padding:18px;text-align:center;border-bottom:1px solid #000;">
                    <p style="margin:0;color:#666;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.6px;">
                      Your Verification Code
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 20px 26px;text-align:center;background:#fff;">
                    <span style="display:inline-block;padding:16px 14px 16px 24px;background:#000;color:#fff;border-radius:8px;font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:36px;font-weight:700;letter-spacing:10px;line-height:1;-webkit-user-select:all;user-select:all;">${otp}</span>
                    <p style="margin:16px 0 0;color:#666;font-size:13px;line-height:1.5;">
                      Tap and hold (or double-click) the code to copy it.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#fafafa;padding:14px;text-align:center;border-top:1px solid #000;">
                    <p style="margin:0;color:#333;font-size:12px;font-weight:600;">
                      This code expires in ${expiresInMinutes} minutes
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:26px 0 30px;color:#555;font-size:14px;line-height:1.6;">
                Enter this code on the password reset page to verify your identity and create a new password.
              </p>

              <!-- Security Notice -->
              <table role="presentation" width="100%" style="border:1px solid #000;border-radius:6px;overflow:hidden;margin-top:40px;">
                <tr>
                  <td style="background:#000;color:#fff;padding:14px;text-align:center;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                    Security Notice
                  </td>
                </tr>
                <tr>
                  <td style="background:#fff;padding:22px;">
                    <p style="margin:0 0 10px;color:#333;font-size:13px;line-height:1.6;">
                      If you didn't request a password reset, please ignore this email. Your account remains secure.
                    </p>
                    <p style="margin:0;color:#666;font-size:12px;line-height:1.5;">
                      This is an automated email. Please do not reply to this message.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#000;color:#fff;padding:20px;text-align:center;font-size:11px;letter-spacing:1px;">
              © ${new Date().getFullYear()} Creator AI. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}