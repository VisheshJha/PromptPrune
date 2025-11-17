/**
 * Design System - Border Radius Tokens
 * Defines consistent border radius values
 */

export const radius = {
  none: '0',
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  full: '9999px',
} as const

export type Radius = keyof typeof radius

