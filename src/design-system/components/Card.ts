/**
 * Design System - Card Component
 * Base card component for content scripts
 */

export interface CardOptions {
  title?: string
  content: HTMLElement | string
  footer?: HTMLElement | string
  className?: string
  variant?: 'default' | 'elevated' | 'outlined'
}

export function createCard(options: CardOptions): HTMLElement {
  const {
    title,
    content,
    footer,
    className = '',
    variant = 'default',
  } = options

  const card = document.createElement('div')
  card.className = `pp-card pp-card-${variant} ${className}`.trim()

  // Header
  if (title) {
    const header = document.createElement('div')
    header.className = 'pp-card-header'
    header.textContent = title
    card.appendChild(header)
  }

  // Content
  const contentDiv = document.createElement('div')
  contentDiv.className = 'pp-card-content'
  if (typeof content === 'string') {
    contentDiv.textContent = content
  } else {
    contentDiv.appendChild(content)
  }
  card.appendChild(contentDiv)

  // Footer
  if (footer) {
    const footerDiv = document.createElement('div')
    footerDiv.className = 'pp-card-footer'
    if (typeof footer === 'string') {
      footerDiv.textContent = footer
    } else {
      footerDiv.appendChild(footer)
    }
    card.appendChild(footerDiv)
  }

  return card
}

export function getCardStyles(): string {
  return `
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
}

