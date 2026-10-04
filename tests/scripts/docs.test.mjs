// @vitest-environment node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { extractLocalLinks, validateReadme } from '../../scripts/check-docs.mjs';

const readme = await readFile(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../README.md'),
  'utf8',
);

describe('документационный gate', () => {
  it('принимает текущий README.md и его локальные ссылки', () => {
    expect(validateReadme(readme, { localLinkExists: () => true })).toEqual([]);
  });

  it('требует обязательные разделы README.md в заданном порядке', () => {
    const errors = validateReadme('# a11y-lens\n\n## Usage\n\n## Features');

    expect(errors).toContain('README.md is missing the ## TL;DR section.');
    expect(errors).toContain('README.md sections are out of order near ## Usage.');
  });

  it('отклоняет отсутствующие локальные ссылки и игнорирует внешние', () => {
    const markdown = [
      '# a11y-lens',
      ...['TL;DR', 'Features', 'Installation', 'Usage', 'Architecture / Stack'].map(
        (section) => `## ${section}`,
      ),
      '[missing](docs/missing.md)',
      '[external](https://example.com)',
      '[anchor](#usage)',
    ].join('\n');

    expect(extractLocalLinks(markdown)).toEqual(['docs/missing.md']);
    expect(validateReadme(markdown, { localLinkExists: () => false })).toContain(
      'README.md references missing file: docs/missing.md.',
    );
  });
});
