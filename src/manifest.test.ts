import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

describe('manifest SDK compatibility', () => {
  it('requires the SDK version that introduced status-bar titles', () => {
    expect(manifest.asyarSdk).toBe('^4.15.0');
  });
});
