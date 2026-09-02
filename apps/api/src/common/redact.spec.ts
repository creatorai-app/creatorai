import { redact } from './all-exceptions.filter';

/**
 * Request bodies are now recorded for 4xx as well as 5xx, so this is the only
 * thing standing between an error log and a credential. Every case below is a
 * body a real endpoint accepts.
 */
describe('redact', () => {
  it('masks credentials, including the password-reset OTP', () => {
    expect(
      redact({ email: 'a@b.com', otp: '123456', newPassword: 'hunter2', accessToken: 'abc' }),
    ).toEqual({
      email: 'a@b.com',
      otp: '[redacted]',
      newPassword: '[redacted]',
      accessToken: '[redacted]',
    });
  });

  it('keeps the input that explains a domain 400', () => {
    expect(redact({ referralCode: 'ABC12345', userEmail: 'a@b.com' })).toEqual({
      referralCode: 'ABC12345',
      userEmail: 'a@b.com',
    });
  });

  it('collapses bulk values instead of storing them', () => {
    const out = redact({ videoTopic: 'x'.repeat(600), result: { nested: true } }) as Record<string, string>;
    expect(out.videoTopic).toBe('[string, 600 chars]');
    expect(out.result).toBe('[object]');
  });
});
