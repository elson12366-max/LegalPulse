// Central place for colors, spacing and typography so the app feels consistent.
export const theme = {
  colors: {
    bg: '#0f1b2d',          // deep legal navy (app background)
    surface: '#16263d',     // cards on navy
    card: '#ffffff',
    text: '#1a2233',        // primary text on light cards
    textOnDark: '#eef2f8',  // text on navy
    muted: '#7a8699',       // secondary text
    accent: '#c8a24a',      // gold accent (legal / prestige)
    accentDark: '#a5842f',
    line: '#e6e9f0',        // hairline separators
    tabBar: '#0b1524',
    tabInactive: '#66748c',
    danger: '#c0392b',
  },
  spacing: (n) => n * 8,
  radius: 14,
};
