import React from 'react'

export const TEAMS_EMOJIS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😆', label: 'Laugh' },
  { emoji: '😮', label: 'Surprised' },
  { emoji: '😢', label: 'Sad' },
  { emoji: '😠', label: 'Angry' },
]

interface TeamsReactionPickerProps {
  onSelectEmoji: (emoji: string) => void
  onClose?: () => void
  position?: 'top' | 'bottom'
  isSelf?: boolean
}

export const TeamsReactionPicker: React.FC<TeamsReactionPickerProps> = ({
  onSelectEmoji,
  onClose,
  position = 'top',
  isSelf = false,
}) => {
  return (
    <div
      className={`teams-reaction-popover ${position} ${isSelf ? 'align-right' : 'align-left'}`}
      onClick={(e) => e.stopPropagation()}
    >
      {TEAMS_EMOJIS.map(({ emoji, label }) => (
        <button
          key={emoji}
          type="button"
          className="teams-reaction-emoji-btn"
          title={label}
          onClick={() => {
            onSelectEmoji(emoji)
            onClose?.()
          }}
        >
          <span className="teams-emoji-glyph">{emoji}</span>
        </button>
      ))}
    </div>
  )
}
