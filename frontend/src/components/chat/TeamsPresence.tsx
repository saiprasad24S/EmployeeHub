import React from 'react'

export type TeamsPresenceStatus = 'available' | 'busy' | 'away' | 'offline'

interface TeamsPresenceBadgeProps {
  status: TeamsPresenceStatus
  size?: number
  className?: string
}

export const TeamsPresenceBadge: React.FC<TeamsPresenceBadgeProps> = ({
  status,
  size = 14,
  className = '',
}) => {
  if (status === 'available') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`teams-presence-badge ${className}`}
        aria-label="Available"
      >
        <circle cx="8" cy="8" r="8" fill="#237B4B" />
        <path
          d="M4.5 8.2L6.8 10.5L11.5 5.8"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (status === 'busy') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`teams-presence-badge ${className}`}
        aria-label="Busy"
      >
        <circle cx="8" cy="8" r="8" fill="#C4314B" />
        <circle cx="8" cy="8" r="3" fill="white" />
      </svg>
    )
  }

  if (status === 'away') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`teams-presence-badge ${className}`}
        aria-label="Away"
      >
        <circle cx="8" cy="8" r="8" fill="#FFBA08" />
        <path
          d="M8 4.5V8.2H11"
          stroke="#242424"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // Offline / Out of Office
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`teams-presence-badge ${className}`}
      aria-label="Offline"
    >
      <circle cx="8" cy="8" r="7" fill="white" stroke="#8A8886" strokeWidth="2" />
    </svg>
  )
}

// Teams Deterministic Palette
const TEAMS_AVATAR_COLORS = [
  '#5B5FC7', // Teams Purple
  '#0078D4', // Teams Blue
  '#008272', // Teams Teal
  '#B4009E', // Teams Magenta
  '#D83B01', // Teams Orange
  '#8E562E', // Teams Brown
  '#498205', // Teams Olive
  '#038387', // Teams Cyan
]

export function getTeamsAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % TEAMS_AVATAR_COLORS.length
  return TEAMS_AVATAR_COLORS[index]
}

export function getTeamsInitials(name: string): string {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface TeamsAvatarProps {
  name: string
  photo?: string | null
  presence?: TeamsPresenceStatus | null
  size?: number
  showPresence?: boolean
  className?: string
}

export const TeamsAvatar: React.FC<TeamsAvatarProps> = ({
  name,
  photo,
  presence,
  size = 40,
  showPresence = true,
  className = '',
}) => {
  const [imgError, setImgError] = React.useState(false)
  const bgColor = getTeamsAvatarColor(name || 'Staff')
  const initials = getTeamsInitials(name || 'Staff')
  const badgeSize = Math.max(12, Math.round(size * 0.34))

  return (
    <div
      className={`teams-avatar-container ${className}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {photo && !imgError ? (
        <img
          src={photo}
          alt={name}
          onError={() => setImgError(true)}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            backgroundColor: bgColor,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: Math.round(size * 0.38),
            letterSpacing: '0.02em',
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          {initials}
        </div>
      )}

      {showPresence && presence && (
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            lineHeight: 0,
            borderRadius: '50%',
            border: '2px solid #FFFFFF',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TeamsPresenceBadge status={presence} size={badgeSize} />
        </div>
      )}
    </div>
  )
}
