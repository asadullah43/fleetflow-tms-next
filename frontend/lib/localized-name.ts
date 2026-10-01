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

/**
 * Same picking logic as `localizedName`, but for the denormalized
 * `xNameAr` fields the backend attaches to a *different* entity's joined
 * display name (e.g. a Trip's `customerName`/`customerNameAr`, an
 * Invoice's `customerName`/`customerNameAr`) rather than an entity's own
 * `name`/`nameAr` pair. Takes the two strings directly since the field
 * names vary per join.
 */
export function localizedJoinedName(name: string | undefined, nameAr: string | undefined, language: Language): string | undefined {
  if (language === 'ar') return nameAr?.trim() ? nameAr : name;
  return name;
}
