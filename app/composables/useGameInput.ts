import { onBeforeUnmount, onMounted } from 'vue'
import { getDirectionFromKey } from '../../game/input'
import type { Direction } from '../../game/types'

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

export function useGameInput(onDirection: (direction: Direction) => void) {
  function onKeydown(event: KeyboardEvent) {
    if (isTextEntry(event.target)) return

    const direction = getDirectionFromKey(event.key, event.repeat)
    if (!direction) return

    event.preventDefault()
    onDirection(direction)
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
