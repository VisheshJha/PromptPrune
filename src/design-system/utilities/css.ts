/**
 * Design System - CSS Utilities
 * Helper functions for generating CSS
 */

/**
 * Inject styles into a shadow root or document head
 */
export function injectStyles(
  styles: string,
  target: ShadowRoot | Document | HTMLElement = document,
  id?: string
): void {
  const styleElement = document.createElement('style')
  if (id) {
    styleElement.id = id
  }
  styleElement.textContent = styles

  if (target instanceof ShadowRoot) {
    // Remove existing style if present
    const existing = target.querySelector(`style${id ? `#${id}` : ''}`)
    if (existing) {
      existing.remove()
    }
    target.appendChild(styleElement)
  } else if (target === document || target === document.head || target === document.body) {
    // Remove existing style if present
    if (id) {
      const existing = document.head.querySelector(`#${id}`)
      if (existing) {
        existing.remove()
      }
    }
    document.head.appendChild(styleElement)
  } else {
    // Append to specific element
    target.appendChild(styleElement)
  }
}

/**
 * Create a style element with design system styles
 */
export function createDesignSystemStyles(): HTMLStyleElement {
  const style = document.createElement('style')
  style.id = 'promptprune-design-system'
  style.textContent = `
    ${getAllComponentStyles()}
  `
  return style
}

/**
 * Get all component styles combined
 */
function getAllComponentStyles(): string {
  // Import styles from components
  const buttonStyles = `
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

  const cardStyles = `
    .pp-card {
      background: white;
      border-radius: var(--radius-lg);
      font-family: var(--font-sans);
      overflow: hidden;
    }

    .pp-card-default {
      box-shadow: var(--shadow-md);
    }

    .pp-card-elevated {
      box-shadow: var(--shadow-xl);
    }

    .pp-card-outlined {
      border: 1px solid var(--color-gray-200);
      box-shadow: none;
    }

    .pp-card-header {
      padding: var(--space-4) var(--space-6);
      border-bottom: 1px solid var(--color-gray-200);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-gray-900);
    }

    .pp-card-content {
      padding: var(--space-6);
    }

    .pp-card-footer {
      padding: var(--space-4) var(--space-6);
      border-top: 1px solid var(--color-gray-200);
      background: var(--color-gray-50);
    }
  `

  const badgeStyles = `
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

  return `
    ${buttonStyles}
    ${cardStyles}
    ${badgeStyles}
  `
}

/**
 * Apply design system CSS variables to an element
 */
export function applyDesignSystem(element: HTMLElement): void {
  // Design system styles are applied globally via design-system.css
  // This function can be used for element-specific overrides if needed
  element.classList.add('pp-design-system')
}

