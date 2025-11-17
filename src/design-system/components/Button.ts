/**
 * Design System - Button Component
 * Base button component for content scripts (non-React)
 */

export interface ButtonOptions {
  label: string
  icon?: string
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  className?: string
  tooltip?: string
}

export function createButton(options: ButtonOptions): HTMLElement {
  const {
    label,
    icon,
    variant = 'primary',
    size = 'md',
    onClick,
    disabled = false,
    className = '',
    tooltip,
  } = options

  const button = document.createElement('button')
  button.className = `pp-button pp-button-${variant} pp-button-${size} ${className}`.trim()
  button.setAttribute('aria-label', label)
  if (tooltip) {
    button.title = tooltip
  }
  button.disabled = disabled

  // Add icon if provided
  if (icon) {
    const iconSpan = document.createElement('span')
    iconSpan.className = 'pp-button-icon'
    iconSpan.textContent = icon
    button.appendChild(iconSpan)
  }

  // Add label
  const labelSpan = document.createElement('span')
  labelSpan.className = 'pp-button-label'
  labelSpan.textContent = label
  button.appendChild(labelSpan)

  // Add click handler
  if (onClick) {
    button.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        onClick()
      }
    })
  }

  return button
}

export function getButtonStyles(): string {
  return `
    .pp-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      border: none;
      border-radius: var(--radius-md);
      font-family: var(--font-sans);
      font-weight: var(--font-medium);
      cursor: pointer;
      transition: all var(--transition-base);
      pointer-events: auto;
      white-space: nowrap;
      user-select: none;
    }

    .pp-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pp-button-icon {
      display: inline-flex;
      align-items: center;
      font-size: 1em;
    }

    .pp-button-label {
      display: inline-block;
    }

    /* Sizes */
    .pp-button-sm {
      padding: var(--space-2) var(--space-3);
      font-size: var(--text-sm);
    }

    .pp-button-md {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-base);
    }

    .pp-button-lg {
      padding: var(--space-4) var(--space-6);
      font-size: var(--text-lg);
    }

    /* Variants */
    .pp-button-primary {
      background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
      color: white;
      box-shadow: var(--shadow-sm);
    }

    .pp-button-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .pp-button-primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }

    .pp-button-secondary {
      background: white;
      color: var(--color-gray-700);
      border: 1px solid var(--color-gray-300);
      box-shadow: var(--shadow-sm);
    }

    .pp-button-secondary:hover:not(:disabled) {
      background: var(--color-gray-50);
      border-color: var(--color-gray-400);
      box-shadow: var(--shadow-md);
    }

    .pp-button-danger {
      background: linear-gradient(135deg, var(--color-error) 0%, var(--color-error) 100%);
      color: white;
      box-shadow: var(--shadow-sm);
    }

    .pp-button-danger:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--color-error) 0%, #dc2626 100%);
      box-shadow: var(--shadow-md);
      transform: translateY(-1px);
    }

    .pp-button-ghost {
      background: transparent;
      color: var(--color-gray-700);
      border: none;
    }

    .pp-button-ghost:hover:not(:disabled) {
      background: var(--color-gray-100);
    }
  `
}

