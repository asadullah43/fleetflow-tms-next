export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return value === 'en' || value === 'ar';
}

/**
 * Maps a bilingual write payload into Prisma write data. Direct port of
 * the legacy backend's language.util.ts.
 *
 * Every bilingual create/update payload carries an optional `language` tag
 * ('en' | 'ar', defaults to 'en'). The typed value lives in the existing
 * `name` / `description` fields; this helper routes it to the matching
 * language column so one language is never overwritten by the other:
 *
 * - language 'ar': value goes to `nameAr` / `descriptionAr`. On UPDATE the
 *   base `name` / `description` columns (English) are left untouched. On
 *   CREATE the Arabic value also fills the base columns so the NOT NULL
 *   constraint holds and the record has a fallback display value.
 * - language 'en': value stays in `name` / `description`; `nameAr` untouched.
 */
export function buildLocalizedWriteData(input: Record<string, unknown>, isCreate: boolean): Record<string, unknown> {
  const language = isSupportedLanguage(input.language) ? input.language : 'en';

  const data: Record<string, unknown> = { ...input };
  delete data.language;

  if (language === 'ar') {
    if (data.name !== undefined) {
      data.nameAr = data.name;
      if (!isCreate) delete data.name;
    }
    if (data.description !== undefined) {
      data.descriptionAr = data.description;
      if (!isCreate) delete data.description;
    }
  }

  return data;
}
