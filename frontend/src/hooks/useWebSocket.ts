import { useEffect } from 'react'
import { wsClient } from '../services/websocket'
import type { WsMessage } from '../types'

export function useWebSocket(handler: (msg: WsMessage) => void) {
  useEffect(() => {
    const unsub = wsClient.subscribe(handler)
    return unsub
  }, [handler])
}
