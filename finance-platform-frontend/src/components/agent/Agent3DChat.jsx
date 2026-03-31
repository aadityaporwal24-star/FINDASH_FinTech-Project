import { Canvas } from '@react-three/fiber'
import { Loader } from '@react-three/drei'
import { AgentExperience } from './AgentExperience'

export function Agent3DChat({
  title,
  subtitle,
  messages,
  chatInput,
  onChatInputChange,
  onChatSubmit,
  chatPlaceholder,
  sendLabel,
  zoomed,
  onToggleZoom,
  loading,
}) {
  const latestAssistantText = [...messages].reverse().find((m) => m.role === 'assistant')?.text || ''

  return (
    <section className="card agent-chat-card">
      <Loader />
      <div className="agent-chat-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button type="button" className="soft" onClick={onToggleZoom}>
          {zoomed ? 'Zoom Out' : 'Zoom In'}
        </button>
      </div>

      <div className="agent-stage">
        <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }}>
          <AgentExperience speaking={loading} latestAssistantText={latestAssistantText} zoomed={zoomed} />
        </Canvas>
      </div>

      <div className="agent-transcript">
        {messages.slice(-8).map((message, idx) => (
          <div key={idx} className={`bubble ${message.role}`}>
            {message.text}
          </div>
        ))}
      </div>

      <form onSubmit={onChatSubmit} className="chat-form">
        <input value={chatInput} onChange={onChatInputChange} placeholder={chatPlaceholder} />
        <button type="submit" disabled={loading}>{loading ? '...' : sendLabel}</button>
      </form>
    </section>
  )
}
