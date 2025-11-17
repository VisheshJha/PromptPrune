/**
 * Make element draggable
 */

export function makeDraggable(element: HTMLElement): void {
  let isDragging = false
  let currentX = 0
  let currentY = 0
  let initialX = 0
  let initialY = 0

  element.style.cursor = 'move'
  element.style.userSelect = 'none'

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return // Only left mouse button
    
    isDragging = true
    initialX = e.clientX
    initialY = e.clientY

    const rect = element.getBoundingClientRect()
    currentX = rect.left
    currentY = rect.top

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    e.preventDefault()
  }

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const deltaX = e.clientX - initialX
    const deltaY = e.clientY - initialY

    element.style.left = `${currentX + deltaX}px`
    element.style.top = `${currentY + deltaY}px`
    element.style.right = 'auto'
    element.style.bottom = 'auto'
  }

  const onMouseUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  element.addEventListener('mousedown', onMouseDown)
}

