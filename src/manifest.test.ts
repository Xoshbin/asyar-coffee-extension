import { describe, expect, it } from 'vitest';
import manifest from '../manifest.json';

describe('manifest SDK compatibility', () => {
  it('is published under the Asyar identity', () => {
    expect(manifest.author).toBe('Asyar');
  });

  it('requires SDK ^4.17.0', () => {
    expect(manifest.asyarSdk).toBe('^4.17.0');
  });
});
