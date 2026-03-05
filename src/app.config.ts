export type AppTheme = 'light' | 'dark';

type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    success: string;
    successForeground: string;
    warning: string;
    warningForeground: string;
    ring: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  spacing: {
    containerPaddingX: string;
  };
};

export const appConfig = {
  site: {
    name: 'Jukumu',
    description: 'Jukumu - Savings & Investment Groups Management Platform',
    url: 'https://jukumu.netlify.app',
    locale: 'sw',
  },
  brand: {
    social: {
      twitterHandle: '@jukumu',
    },
  },
  tokens: {
    light: {
      colors: {
        background: '#ffffff',
        foreground: '#0a0a0a',
        card: '#ffffff',
        cardForeground: '#0a0a0a',
        muted: '#f4f4f5',
        mutedForeground: '#71717a',
        border: '#e4e4e7',
        input: '#e4e4e7',
        primary: '#ea580c',       // orange-600
        primaryForeground: '#ffffff',
        secondary: '#f97316',     // orange-500
        secondaryForeground: '#ffffff',
        accent: '#fff7ed',        // orange-50
        accentForeground: '#9a3412', // orange-800
        destructive: '#dc2626',   // red-600
        destructiveForeground: '#ffffff',
        success: '#16a34a',       // green-600
        successForeground: '#ffffff',
        warning: '#ca8a04',       // yellow-600
        warningForeground: '#ffffff',
        ring: '#ea580c',          // orange-600
      },
      radius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      spacing: {
        containerPaddingX: '1rem',
      },
    } satisfies ThemeTokens,
    dark: {
      colors: {
        background: '#0a0a0a',
        foreground: '#fafafa',
        card: '#18181b',
        cardForeground: '#fafafa',
        muted: '#27272a',
        mutedForeground: '#a1a1aa',
        border: '#3f3f46',
        input: '#3f3f46',
        primary: '#f97316',       // orange-500
        primaryForeground: '#ffffff',
        secondary: '#ea580c',     // orange-600
        secondaryForeground: '#ffffff',
        accent: '#431407',        // orange-950
        accentForeground: '#fed7aa', // orange-200
        destructive: '#ef4444',   // red-500
        destructiveForeground: '#ffffff',
        success: '#22c55e',       // green-500
        successForeground: '#ffffff',
        warning: '#eab308',       // yellow-500
        warningForeground: '#000000',
        ring: '#f97316',          // orange-500
      },
      radius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      spacing: {
        containerPaddingX: '1rem',
      },
    } satisfies ThemeTokens,
  },
} as const;

function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  return {
    '--ds-color-background': tokens.colors.background,
    '--ds-color-foreground': tokens.colors.foreground,
    '--ds-color-card': tokens.colors.card,
    '--ds-color-card-foreground': tokens.colors.cardForeground,
    '--ds-color-muted': tokens.colors.muted,
    '--ds-color-muted-foreground': tokens.colors.mutedForeground,
    '--ds-color-border': tokens.colors.border,
    '--ds-color-input': tokens.colors.input,
    '--ds-color-primary': tokens.colors.primary,
    '--ds-color-primary-foreground': tokens.colors.primaryForeground,
    '--ds-color-secondary': tokens.colors.secondary,
    '--ds-color-secondary-foreground': tokens.colors.secondaryForeground,
    '--ds-color-accent': tokens.colors.accent,
    '--ds-color-accent-foreground': tokens.colors.accentForeground,
    '--ds-color-destructive': tokens.colors.destructive,
    '--ds-color-destructive-foreground': tokens.colors.destructiveForeground,
    '--ds-color-success': tokens.colors.success,
    '--ds-color-success-foreground': tokens.colors.successForeground,
    '--ds-color-warning': tokens.colors.warning,
    '--ds-color-warning-foreground': tokens.colors.warningForeground,
    '--ds-color-ring': tokens.colors.ring,
    '--ds-radius-sm': tokens.radius.sm,
    '--ds-radius-md': tokens.radius.md,
    '--ds-radius-lg': tokens.radius.lg,
    '--ds-radius-xl': tokens.radius.xl,
    '--ds-space-container-px': tokens.spacing.containerPaddingX,
  };
}

function cssVarsToString(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}

export function getThemeCss(): string {
  const light = cssVarsToString(tokensToCssVars(appConfig.tokens.light));
  const dark = cssVarsToString(tokensToCssVars(appConfig.tokens.dark));
  return `:root { ${light} } :root.dark { ${dark} }`;
}
