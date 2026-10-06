const preset = require("../oneworld-shell/tailwind-preset.cjs");

/**
 * THE CONTENT GLOB MUST INCLUDE THE SHELL PACKAGE.
 * Without that second line every class the chrome uses is tree-shaken out of this build and the
 * header, drawer and tab bar render completely unstyled — with no error, because Tailwind is
 * doing exactly what it was told.
 */
module.exports = {
  presets: [preset],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../oneworld-shell/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* shadcn semantic tokens the ported OneEvent screens speak, mapped to CSS vars the
           product defines (oneevent.css) in its OWN hue. The shell's palette stays untouched. */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      boxShadow: { card: "0 1px 3px rgba(11,15,26,.06), 0 8px 24px rgba(11,15,26,.05)" },
    },
  },
};
