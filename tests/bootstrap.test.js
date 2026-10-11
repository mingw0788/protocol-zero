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
});
