import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('Visual polish contracts', () => {
  it('preserves visible keyboard focus, responsive layouts, and reduced-motion support', () => {
    expect(css).toMatch(/button:focus-visible\s*\{/);
    expect(css).toMatch(/@container\s*\(max-width:\s*700px\)/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(css).toMatch(/backdrop-filter:\s*blur/);
  });

  it('keeps existing Chinese menu, HUD, Boss, upgrade, pause, and result semantics', () => {
    expect(html).toContain('<html lang="zh-CN">');
    for (const text of ['开始游戏', '生命', '首领状态', '战斗已暂停', '选择一项升级', '任务结果']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });
});
