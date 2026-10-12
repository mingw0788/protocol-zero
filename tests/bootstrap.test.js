import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('starter browser shell', () => {
  it('defines a Canvas and loads the module entry', () => {
    const htmlPath = resolve(process.cwd(), 'index.html');
    const mainEntryPath = resolve(process.cwd(), 'src/main.js');

    expect(existsSync(htmlPath)).toBe(true);
    if (!existsSync(htmlPath)) return;

    const html = readFileSync(htmlPath, 'utf8');
    expect(html).toMatch(/<canvas\b[^>]*id="game-canvas"/);
    expect(html).toMatch(/<script\b[^>]*type="module"[^>]*src="\/src\/main.js"/);
    expect(html).toMatch(/<link\b[^>]*rel="icon"[^>]*href="data:,"/);
    expect(existsSync(mainEntryPath)).toBe(true);
  });

  it('provides the UI mount and screen controls used by the presentation layer', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    for (const id of [
      'game-ui', 'main-menu-panel', 'help-panel', 'game-hud', 'pause-panel',
      'start-game-button', 'show-help-button', 'hide-help-button', 'sound-toggle-button',
      'resume-game-button', 'return-menu-button', 'return-menu-dialog',
      'cancel-return-button', 'confirm-return-button',
      'boss-hud', 'boss-name', 'boss-health-value', 'boss-health-bar',
    ]) {
      expect(html).toContain('id="' + id + '"');
    }
    expect(html).toMatch(/<dialog\b[^>]*id="return-menu-dialog"/);
  });
});
