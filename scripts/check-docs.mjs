import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readmePath = path.join(projectRoot, 'README.md');
const requiredSections = ['TL;DR', 'Features', 'Installation', 'Usage', 'Architecture / Stack'];
const markdownLinkPattern = /\[[^\]]+\]\(([^)\n]+)\)/g;

function normalizeLinkTarget(rawTarget) {
  const target = rawTarget.trim();
  if (target.startsWith('<')) {
    const closingBracket = target.indexOf('>');
    return closingBracket === -1 ? target : target.slice(1, closingBracket);
  }
  return target.split(/\s+/, 1)[0];
}

export function extractLocalLinks(markdown) {
  const links = [];
  let inCodeFence = false;

  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    for (const match of line.matchAll(markdownLinkPattern)) {
      const target = normalizeLinkTarget(match[1]);
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
      const withoutFragment = target.split(/[?#]/, 1)[0];
      if (withoutFragment) {
        try {
          links.push(decodeURIComponent(withoutFragment));
        } catch {
          links.push(withoutFragment);
        }
      }
    }
  }

  return links;
}

export function validateReadme(markdown, { localLinkExists = () => true } = {}) {
  const errors = [];
  if (!markdown.trim()) return ['README.md is empty.'];
  if (!/^\uFEFF?#\s+a11y-lens\s*$/u.test(markdown.split('\n', 1)[0])) {
    errors.push('README.md must start with the # a11y-lens heading.');
  }

  const headings = [...markdown.matchAll(/^##\s+(.+?)\s*$/gm)].map((match) => match[1]);
  let previousIndex = -1;
  for (const section of requiredSections) {
    const currentIndex = headings.indexOf(section);
    if (currentIndex === -1) {
      errors.push(`README.md is missing the ## ${section} section.`);
    } else if (currentIndex < previousIndex) {
      errors.push(`README.md sections are out of order near ## ${section}.`);
    } else {
      previousIndex = currentIndex;
    }
  }

  for (const target of extractLocalLinks(markdown)) {
    if (!localLinkExists(target)) errors.push(`README.md references missing file: ${target}.`);
  }
  return errors;
}

async function localLinkExists(target) {
  const resolvedPath = path.resolve(projectRoot, target);
  const relativePath = path.relative(projectRoot, resolvedPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;

  try {
    return (await stat(resolvedPath)).isFile();
  } catch {
    return false;
  }
}

export async function checkDocumentation({ readFileImpl = readFile, logger = console } = {}) {
  logger.log('[DOCS] Проверяем структуру README.md и локальные ссылки.');
  try {
    const markdown = await readFileImpl(readmePath, 'utf8');
    const errors = validateReadme(markdown, { localLinkExists });
    if (errors.length > 0) throw new Error(errors.join(' '));
    logger.log('[DOCS] README.md и локальные ссылки прошли проверку.');
    return 0;
  } catch (error) {
    logger.error(`[DOCS] ${error instanceof Error ? error.message : 'Проверка не выполнена.'}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await checkDocumentation();
}
