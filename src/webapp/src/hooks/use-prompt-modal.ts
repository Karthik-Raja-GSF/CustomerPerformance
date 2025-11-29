import { useState, useCallback } from "react"

interface ModalState {
  isOpen: boolean
}

export function usePromptModal() {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
  })

  const open = useCallback(() => {
    setState({ isOpen: true })
  }, [])

  const close = useCallback(() => {
    setState({ isOpen: false })
  }, [])

  return {
    isOpen: state.isOpen,
    open,
    close,
  }
}
