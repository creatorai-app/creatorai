import { resolveMergeTags } from '@repo/email-templates';

// The substitution logic is shared by the send worker and the dashboard preview,
// so a break here means wrong emails go out. Covers a fully-populated recipient
// and one with missing fields (fallbacks) — the case action_required emails hit.
describe('resolveMergeTags', () => {
  it('substitutes present values', () => {
    const html = 'Hi {{firstName}}, your {{planTier}} plan on {{channelName}} ({{email}})';
    const out = resolveMergeTags(html, {
      email: 'a@b.com',
      fullName: 'Ada Lovelace',
      planTier: 'Creator',
      channelConnected: true,
      channelName: 'Ada Codes',
    });
    expect(out).toBe('Hi Ada, your Creator plan on Ada Codes (a@b.com)');
  });

  it('falls back when fields are missing/disconnected', () => {
    const html = 'Hi {{firstName}}, connect {{channelName}} on your {{planTier}} plan';
    const out = resolveMergeTags(html, {
      email: 'x@y.com',
      fullName: null,
      planTier: null,
      channelConnected: false,
      channelName: null,
    });
    expect(out).toBe('Hi there, connect your channel on your Starter plan');
  });

  it('leaves unknown tags untouched so typos are visible', () => {
    const out = resolveMergeTags('Hello {{nope}}', {
      email: 'x@y.com',
      fullName: 'Grace',
      planTier: 'Pro',
      channelConnected: true,
      channelName: 'G',
    });
    expect(out).toBe('Hello {{nope}}');
  });
});
