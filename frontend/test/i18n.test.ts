import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AR_STRINGS, localizeDigits, localizeStatValue, translate } from '../lib/i18n/dictionary';
import { localizedDescription, localizedJoinedName, localizedName } from '../lib/localized-name';

const ROOT = path.resolve(import.meta.dirname, '..');

test('translate: Arabic when available, English fallback otherwise', () => {
  assert.equal(translate('Dashboard', 'ar'), AR_STRINGS.Dashboard);
  assert.equal(translate('Dashboard', 'en'), 'Dashboard');
  assert.equal(translate('Some string nobody translated', 'ar'), 'Some string nobody translated');
});

test('digits become Arabic-Indic only in Arabic, other characters untouched', () => {
  assert.equal(localizeDigits(2026, 'ar'), '٢٠٢٦');
  assert.equal(localizeDigits('12 · 450', 'ar'), '١٢ · ٤٥٠');
  assert.equal(localizeDigits(2026, 'en'), '2026');
  assert.equal(localizeStatValue('12 · 450 SAR', 'ar'), `١٢ · ٤٥٠ ${AR_STRINGS.SAR}`);
  assert.equal(localizeStatValue('12 · 450 SAR', 'en'), '12 · 450 SAR');
});

test('bilingual names fall back to whichever language exists', () => {
  assert.equal(localizedName({ name: 'Riyadh', nameAr: 'الرياض' }, 'ar'), 'الرياض');
  assert.equal(localizedName({ name: 'Riyadh', nameAr: '  ' }, 'ar'), 'Riyadh');
  assert.equal(localizedName({ name: 'Riyadh', nameAr: 'الرياض' }, 'en'), 'Riyadh');
  assert.equal(localizedDescription({ description: 'Port', descriptionAr: undefined }, 'ar'), 'Port');
  assert.equal(localizedJoinedName('Acme', 'أكمي', 'ar'), 'أكمي');
  assert.equal(localizedJoinedName('Acme', undefined, 'ar'), 'Acme');
  assert.equal(localizedJoinedName(undefined, undefined, 'en'), undefined);
});

/**
 * Every literal passed to t('...'), and every title/label/header/... prop
 * literal that shared components translate, must have an Arabic entry —
 * otherwise it silently stays English in Arabic mode.
 */
test('every translated UI literal has an Arabic dictionary entry', () => {
  const IGNORED = new Set(['FleetFlow TMS', 'Transport Management System', 'Some English label', 'empty', 'Language', 'EN', 'عربي', 'useAuth must be used within SessionProvider', 'useLanguage must be used within LanguageProvider']);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.next', 'generated'].includes(entry.name)) walk(full);
      } else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };
  ['app', 'components', 'lib', 'features', 'providers'].forEach((d) => walk(path.join(ROOT, d)));

  const missing = new Set<string>();
  const check = (text: string, file: string) => {
    if (/[A-Za-z]/.test(text) && !IGNORED.has(text) && !(text in AR_STRINGS)) missing.add(`${JSON.stringify(text)} (${path.relative(ROOT, file)})`);
  };
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*[,)]/g)) check((m[1] ?? m[2]).replace(/\\'/g, "'"), file);
    for (const m of src.matchAll(/\b(?:title|subtitle|description|addLabel|emptyLabel|searchPlaceholder|label|header|hint)\s*[:=]\s*(?:\{\s*)?'((?:[^'\\]|\\.)*)'/g)) check(m[1].replace(/\\'/g, "'"), file);
    for (const m of src.matchAll(/\b(?:title|subtitle|description|addLabel|emptyLabel|searchPlaceholder|label|header|hint)\s*=\s*"([^"]*)"/g)) check(m[1], file);
    // Messages produced in view models and shown through t(): fallbacks, validation errors, form errors.
    for (const m of src.matchAll(/errorMessage\([^()]*?,\s*'((?:[^'\\]|\\.)*)'\)/g)) check(m[1].replace(/\\'/g, "'"), file);
    for (const m of src.matchAll(/(?:setFormError|new Error)\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g)) check(m[1].replace(/\\'/g, "'"), file);
    for (const m of src.matchAll(/(?:errors|problems)(?:\[[\w.]+\]|\.\w+)\s*=\s*'((?:[^'\\]|\\.)*)'/g)) check(m[1].replace(/\\'/g, "'"), file);
    for (const m of src.matchAll(/emptyLabel=\{[^}]*?\? '([^']*)' : '([^']*)'\}/g)) [m[1], m[2]].forEach((text) => check(text, file));
  }
  assert.deepEqual([...missing], [], `Missing Arabic translations:\n${[...missing].join('\n')}`);
});
