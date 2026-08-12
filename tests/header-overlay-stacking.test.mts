import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const mainCss = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8');
const headerCss = readFileSync(resolve(root, 'src/styles/header.css'), 'utf8');

describe('header overlay stacking', () => {
  it('keeps header-owned popovers above the pinned map layer', () => {
    assert.match(mainCss, /\.map-section\.pinned\s*\{[\s\S]*?z-index:\s*100;/);
    assert.match(mainCss, /\.header\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*200;/);
    assert.match(mainCss, /\.pizzint-panel\s*\{[\s\S]*?z-index:\s*1200;/);
    assert.match(mainCss, /\.intel-findings-dropdown\s*\{[\s\S]*?z-index:\s*1200;/);
  });

  it('does not create a separate header-right stacking context for the findings popover', () => {
    assert.doesNotMatch(headerCss, /\.header-right\s*\{[\s\S]*?(?:z-index|isolation|transform)\s*:/);
  });
});
