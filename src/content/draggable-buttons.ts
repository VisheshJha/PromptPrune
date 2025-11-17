/**
 * Draggable buttons functionality
 * Makes P icon and field buttons draggable together as a group
 */

export interface DraggableGroup {
  iconButton: HTMLElement
  smartButton?: HTMLElement
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement
}

const draggableGroups = new WeakMap<HTMLTextAreaElement | HTMLDivElement | HTMLInputElement, DraggableGroup>()

let isDragging = false
let dragOffset = { x: 0, y: 0 }
let currentGroup: DraggableGroup | null = null

/**
 * Make buttons draggable as a group
 */
export function makeButtonsDraggable(
  textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement,
  iconButton: HTMLElement,
  smartButton?: HTMLElement
): void {
  // Store group reference
  const group: DraggableGroup = { iconButton, smartButton, textArea }
  draggableGroups.set(textArea, group)

  // Add drag handle to icon button
  const iconHost = iconButton.shadowRoot?.host as HTMLElement
  if (!iconHost) return

  // Make icon button draggable
  iconHost.style.cursor = "move"
  iconHost.setAttribute("draggable", "true")
  iconHost.setAttribute("title", "Drag to reposition buttons")

  // Mouse events for dragging
  iconHost.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return // Only left mouse button
    
    isDragging = true
    currentGroup = group
    
    const iconRect = iconHost.getBoundingClientRect()
    dragOffset.x = e.clientX - iconRect.left
    dragOffset.y = e.clientY - iconRect.top
    
    // Add dragging class for visual feedback
    iconHost.style.opacity = "0.8"
    iconHost.style.transform = "scale(1.1)"
    
    e.preventDefault()
    e.stopPropagation()
  })

  // Mouse move handler
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !currentGroup) return

    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y

    // Constrain to viewport
    const maxX = window.innerWidth - 50
    const maxY = window.innerHeight - 50
    const constrainedX = Math.max(0, Math.min(newX, maxX))
    const constrainedY = Math.max(0, Math.min(newY, maxY))

    // Update icon position
    const iconHost = currentGroup.iconButton.shadowRoot?.host as HTMLElement
    if (iconHost) {
      iconHost.style.left = `${constrainedX}px`
      iconHost.style.top = `${constrainedY}px`
      iconHost.style.right = "auto"
      iconHost.style.bottom = "auto"
    }

    // Update smart button position (relative to icon - always below)
    if (currentGroup.smartButton) {
      const smartHost = currentGroup.smartButton.shadowRoot?.host as HTMLElement
      if (smartHost) {
        const iconHeight = 28 // P icon height
        smartHost.style.left = `${constrainedX}px` // Same left as icon
        smartHost.style.top = `${constrainedY + iconHeight + 8}px` // Below icon with 8px gap
        smartHost.style.right = "auto"
        smartHost.style.bottom = "auto"
      }
    }
  }

  // Mouse up handler
  const handleMouseUp = () => {
    if (!isDragging) return

    isDragging = false
    const iconHost = currentGroup?.iconButton.shadowRoot?.host as HTMLElement
    
    if (iconHost) {
      iconHost.style.opacity = "1"
      iconHost.style.transform = "scale(1)"
    }

    // Save position to localStorage
    if (currentGroup) {
      const iconHost = currentGroup.iconButton.shadowRoot?.host as HTMLElement
      if (iconHost) {
        const rect = iconHost.getBoundingClientRect()
        const position = {
          x: rect.left,
          y: rect.top,
          textAreaId: textArea.id || textArea.getAttribute('data-id') || 'default'
        }
        sessionStorage.setItem('promptprune-button-position', JSON.stringify(position))
      }
    }

    currentGroup = null
  }

  // Add global event listeners
  document.addEventListener("mousemove", handleMouseMove)
  document.addEventListener("mouseup", handleMouseUp)

  // Load saved position
  try {
    const saved = sessionStorage.getItem('promptprune-button-position')
    if (saved) {
      const position = JSON.parse(saved)
      const iconHost = iconButton.shadowRoot?.host as HTMLElement
      
      if (iconHost && position.x && position.y) {
        iconHost.style.left = `${position.x}px`
        iconHost.style.top = `${position.y}px`
        iconHost.style.right = "auto"
        iconHost.style.bottom = "auto"
      }
      
      // Update smart button position relative to icon (below)
      if (smartButton) {
        const smartHost = smartButton.shadowRoot?.host as HTMLElement
        if (smartHost && position.x && position.y) {
          const iconHeight = 28
          smartHost.style.left = `${position.x}px`
          smartHost.style.top = `${position.y + iconHeight + 8}px`
          smartHost.style.right = "auto"
          smartHost.style.bottom = "auto"
        }
      }
    }
  } catch (e) {
    console.error("[PromptPrune] Error loading saved button position:", e)
  }
}

/**
 * Reset button positions to default (relative to textarea)
 */
export function resetButtonPositions(textArea: HTMLTextAreaElement | HTMLDivElement | HTMLInputElement): void {
  const group = draggableGroups.get(textArea)
  if (!group) return

  const iconHost = group.iconButton.shadowRoot?.host as HTMLElement
  const smartHost = group.smartButton?.shadowRoot?.host as HTMLElement

  if (iconHost) {
    iconHost.style.left = "auto"
    iconHost.style.top = "auto"
    iconHost.style.right = "auto"
    iconHost.style.bottom = "auto"
  }

  if (smartHost) {
    smartHost.style.left = "auto"
    smartHost.style.top = "auto"
    smartHost.style.right = "auto"
    smartHost.style.bottom = "auto"
  }

  sessionStorage.removeItem('promptprune-button-position')
}

