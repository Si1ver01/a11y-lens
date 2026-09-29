import type { AuditCategory } from './types';

export const AXE_RULES: Readonly<Partial<Record<AuditCategory, readonly string[]>>> = {
  'accessible-names': [
    'aria-command-name',
    'aria-input-field-name',
    'button-name',
    'image-alt',
    'input-button-name',
    'label',
    'link-name',
  ],
  contrast: ['color-contrast', 'color-contrast-enhanced'],
};

export function axeRulesForCategories(categories: readonly AuditCategory[]): readonly string[] {
  const rules = new Set<string>();
  for (const category of categories) {
    for (const rule of AXE_RULES[category] ?? []) rules.add(rule);
  }
  return [...rules];
}

export function categoryForAxeRule(ruleId: string): AuditCategory | undefined {
  for (const [category, rules] of Object.entries(AXE_RULES) as [
    AuditCategory,
    readonly string[],
  ][]) {
    if (rules.includes(ruleId)) return category;
  }
  return undefined;
}
