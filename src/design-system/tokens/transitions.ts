/**
 * Design System - Transition Tokens
 * Defines animation timing and easing
 */

export const transitions = {
  duration: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  default: '200ms ease-out',
  fast: '150ms ease-out',
  slow: '300ms ease-out',
} as const

export type TransitionDuration = keyof typeof transitions.duration
export type TransitionEasing = keyof typeof transitions.easing

