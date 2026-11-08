/**
 * Navigation configuration, ported from js/navigation.js. Kept in one place so
 * the header, mobile menu and footer stay consistent.
 */
export interface NavLink {
  path: string;
  label: string;
  tone?: 'creative' | 'career';
}

export const BRAND = { mark: 'P', name: 'Prudhvi' } as const;

/** Homepage uses a compact PR monogram so the nav stays calm and minimal. */
export const HOME_BRAND = { mark: 'PR', name: 'Prudhvi Raj' } as const;

export const PRIMARY_LINKS: NavLink[] = [
  { path: '/', label: 'Home' },
  { path: '/career', label: 'Career', tone: 'career' },
  { path: '/creative', label: 'Creative', tone: 'creative' },
];

/** Homepage nav points straight at the two identity paths. */
export const HOME_LINKS: NavLink[] = [
  { path: '/', label: 'Home' },
  { path: '/career', label: 'About', tone: 'career' },
  { path: '/contact', label: 'Contact' },
];

export const FOOTER_LINKS: NavLink[] = [
  { path: '/', label: 'Home' },
  { path: '/career', label: 'Career' },
  { path: '/creative', label: 'Creative' },
  { path: '/contact', label: 'Contact' },
];
