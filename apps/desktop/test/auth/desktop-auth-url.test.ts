import { describe, expect, it } from 'vitest';
import {
  buildDesktopCallbackTarget,
  createLoopbackOriginMatchers,
  normalizeLoopbackUrl,
} from '../../src/main/auth/desktop-auth-url';

describe('desktop auth url helpers', () => {
  it('creates loopback origin matchers for localhost and 127.0.0.1', () => {
    expect(createLoopbackOriginMatchers('http://127.0.0.1:3000')).toEqual([
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]);
  });

  it('normalizes localhost callback urls to the preferred loopback origin', () => {
    expect(
      normalizeLoopbackUrl(
        'http://localhost:3000/workspace?id=123',
        'http://127.0.0.1:3000',
      ),
    ).toBe('http://127.0.0.1:3000/workspace?id=123');
  });

  it('preserves non-loopback urls as-is', () => {
    expect(
      normalizeLoopbackUrl(
        'https://ownlab.app/lab/workspaces',
        'http://127.0.0.1:3000',
      ),
    ).toBe('https://ownlab.app/lab/workspaces');
  });

  it('falls back to the desktop workspace route when callback is missing', () => {
    expect(buildDesktopCallbackTarget(null, 'http://127.0.0.1:3000')).toBe(
      'http://127.0.0.1:3000/lab/workspaces',
    );
  });
});
