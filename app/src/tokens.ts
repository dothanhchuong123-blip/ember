// CSS is the source of truth. Use these references in SVG and inline styles.
export const tokens = {
  color: {
    background: 'var(--bg)',
    backgroundAlt: 'var(--bg-2)',
    panel: 'var(--panel)',
    raised: 'var(--panel-2)',
    plot: 'var(--plot-bg)',
    line: 'var(--line)',
    lineStrong: 'var(--line-strong)',
    text: 'var(--text)',
    muted: 'var(--muted)',
    // Chrome accent: blue in the space theme, amber in the Earth theme, dark ink on paper.
    accent: 'var(--accent)',
    accentSoft: 'var(--accent-soft)',
    accentInk: 'var(--accent-ink)',
    emberBlue: 'var(--ember-blue)',
    paper: 'var(--paper)',
    flame: 'var(--flame)',
    amber: 'var(--sustained)',
    orange: 'var(--flame-orange)',
    red: 'var(--flame-red)',
    extinguished: 'var(--extinguished)',
    unknown: 'var(--unknown)',
    focus: 'var(--focus)',
  },
  space: {
    4: 'var(--space-4)', 8: 'var(--space-8)', 12: 'var(--space-12)', 16: 'var(--space-16)',
    24: 'var(--space-24)', 32: 'var(--space-32)', 40: 'var(--space-40)', 48: 'var(--space-48)',
    64: 'var(--space-64)', 80: 'var(--space-80)',
  },
  font: { display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)' },
  type: {
    display: 'var(--type-display)', h1: 'var(--type-h1)', h2: 'var(--type-h2)',
    h3: 'var(--type-h3)', body: 'var(--type-body)', small: 'var(--type-small)', caption: 'var(--type-caption)',
  },
  radius: { small: 'var(--radius-small)', panel: 'var(--radius-panel)' },
  elevation: { overlay: 'var(--elevation-overlay)', glow: 'var(--elevation-glow)' },
  // Motion takes seconds and a cubic Bézier tuple. Keep shared CSS durations in sync with index.css.
  motion: {
    fast: 0.14,
    normal: 0.28,
    slow: 0.44,
    idle: 2.4,
    easeOut: [.2, .8, .2, 1] as [number, number, number, number],
  },
} as const
