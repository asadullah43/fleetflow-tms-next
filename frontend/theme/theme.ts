import { createTheme, MantineColorsTuple, rem } from '@mantine/core';

/** Route-marker orange — the one brand accent; index 6 is the primary shade. */
const brand: MantineColorsTuple = ['#fff1e6', '#ffe0cc', '#fcc09c', '#f79f6a', '#f1854a', '#ee7a3d', '#e8743d', '#d4622e', '#b85225', '#9c431c'];

/** Warm neutral ramp, so surfaces read as paper rather than blue-grey. */
const sand: MantineColorsTuple = ['#faf8f4', '#f6f4ef', '#ece8de', '#e6e1d6', '#c9c4b8', '#9ba0ad', '#6b7180', '#4a4f5c', '#22262f', '#171b26'];

/** The fixed dark navigation rail. Not themeable by colour scheme: it stays dark in both. */
export const rail = {
  bg: '#0f1420',
  raised: '#161d2c',
  border: '#1f2738',
  text: '#c6cbd8',
  muted: '#7b8299',
  active: '#1b2335',
} as const;

export const surface = {
  page: '#f6f4ef',
  card: '#ffffff',
  raised: '#faf8f4',
  border: '#e6e1d6',
} as const;

const SANS = "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

/**
 * The whole visual language lives here; screens style themselves with
 * Mantine props (c, bg, p, fw, ...) against these tokens rather than
 * with stylesheets.
 */
export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand, sand },
  fontFamily: SANS,
  fontFamilyMonospace: MONO,
  headings: { fontFamily: SANS, fontWeight: '600' },
  defaultRadius: 'md',
  radius: { xs: rem(4), sm: rem(7), md: rem(10), lg: rem(14), xl: rem(18) },
  fontSizes: { xs: rem(12), sm: rem(13.5), md: rem(14.5), lg: rem(16), xl: rem(19) },
  black: '#22262f',
  cursorType: 'pointer',
  components: {
    Paper: { defaultProps: { withBorder: true, radius: 'lg', shadow: 'none' } },
    Table: { defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md', highlightOnHover: true } },
    Modal: { defaultProps: { centered: true, radius: 'lg', overlayProps: { backgroundOpacity: 0.45, blur: 2 } } },
    Button: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { variant: 'light', radius: 'sm' } },
    TextInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm' } },
  },
});
