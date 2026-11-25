jest.mock('@/features/admin/admin-api', () => ({ invokeFunction: jest.fn() }));

import { parseInviteCode } from '@/features/admin/invite-api';

const CODE = 'Ab3_-xYz0123456789ABCD';

describe('parseInviteCode', () => {
  it('accepts a bare code', () => {
    expect(parseInviteCode(`  ${CODE} `)).toBe(CODE);
  });

  it('extracts the code from web, app and Expo Go links', () => {
    expect(parseInviteCode(`https://comethical.expo.app/invite/${CODE}`)).toBe(CODE);
    expect(parseInviteCode(`comethical://invite/${CODE}`)).toBe(CODE);
    expect(parseInviteCode(`exp://192.168.1.5:8081/--/invite/${CODE}?x=1`)).toBe(CODE);
  });

  it('rejects anything else', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('hello')).toBeNull();
    expect(parseInviteCode(CODE.slice(1))).toBeNull();
    expect(parseInviteCode(`https://x.app/invite/${CODE}extra`)).toBeNull();
  });
});
