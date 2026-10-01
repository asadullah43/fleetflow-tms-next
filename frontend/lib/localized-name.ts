import type { Language } from './language-context';

/** Anything with the standard bilingual name-pair the backend stores
 *  (`name` = English, `nameAr` = Arabic, the latter optional). */
export interface Named {
  name: string;
  nameAr?: string;
}

/** Same idea for the handful of entities (Locations, Cargo Types) that
 *  also carry a bilingual free-text description. */
export interface Described {
  description?: string;
  descriptionAr?: string;
}

/**
 * Picks the display name for the active UI language: the Arabic name when
 * one was entered and the UI is in Arabic, otherwise the English name —
 * so a record only ever entered in one language still displays (falling
 * back rather than going blank) when the UI is switched to the other.
 */
export function localizedName(row: Named, language: Language): string {
  if (language === 'ar') return row.nameAr?.trim() ? row.nameAr : row.name;
  return row.name;
}

export function localizedDescription(row: Described, language: Language): string | undefined {
  if (language === 'ar') return row.descriptionAr?.trim() ? row.descriptionAr : row.description;
  return row.description;
}
