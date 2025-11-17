/**
 * Design System - Badge Component
 * Badge component for labels, counts, and status indicators
 */

export interface BadgeOptions {
  label: string | number
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  className?: string
}

export function createBadge(options: BadgeOptions): HTMLElement {
  const {
    label,
    variant = 'default',
    size = 'md',
    className = '',
  } = options

  const badge = document.createElement('span')
  badge.className = `pp-badge pp-badge-${variant} pp-badge-${size} ${className}`.trim()
  badge.textContent = String(label)

  return badge
}

export function getBadgeStyles(): string {
  return `
    .pp-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-full);
      font-family: var(--font-sans);
      font-weight: var(--font-medium);
      white-space: nowrap;
    }

    .pp-badge-sm {
      padding: var(--space-1) var(--space-2);
      font-size: var(--text-xs);
    }

    .pp-badge-md {
      padding: var(--space-1) var(--space-3);
      font-size: var(--text-sm);
    }

    .pp-badge-default {
      background: var(--color-gray-100);
      color: var(--color-gray-700);
    }

    .pp-badge-success {
      background: var(--color-success-light);
      color: var(--color-success);
    }

    .pp-badge-warning {
      background: var(--color-warning-light);
      color: var(--color-warning);
    }

    .pp-badge-error {
      background: var(--color-error-light);
      color: var(--color-error);
    }

    .pp-badge-info {
      background: var(--color-info-light);
      color: var(--color-info);
    }
  `
}

