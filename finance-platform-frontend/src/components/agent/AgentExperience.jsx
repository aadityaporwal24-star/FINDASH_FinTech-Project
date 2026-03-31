import { CameraControls, ContactShadows, Environment } from '@react-three/drei'
import { useEffect, useRef } from 'react'
import { AgentAvatar } from './AgentAvatar'

export function AgentExperience({ speaking, latestAssistantText, zoomed }) {
  const cameraControls = useRef(null)

  useEffect(() => {
    if (!cameraControls.current) return
    cameraControls.current.setLookAt(0, 2.2, 4.8, 0, 1.15, 0)
  }, [])

  useEffect(() => {
    if (!cameraControls.current) return
    if (zoomed) {
      cameraControls.current.setLookAt(0, 1.45, 1.6, 0, 1.35, 0, true)
    } else {
      cameraControls.current.setLookAt(0, 2.2, 4.8, 0, 1.15, 0, true)
    }
  }, [zoomed])

  return (
    <>
      <CameraControls ref={cameraControls} />
      <Environment preset="sunset" />
      <AgentAvatar latestAssistantText={latestAssistantText} speaking={speaking} />
      <ContactShadows opacity={0.7} blur={2.5} />
    </>
  )
}
