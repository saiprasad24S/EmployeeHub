import React, { useState } from 'react'
import { X, Building, Briefcase, Hash, Check, Copy, MessageSquare, ShieldCheck } from 'lucide-react'
import { TeamsAvatar, TeamsPresenceBadge } from './TeamsPresence'
import type { EmployeeSearchResult } from './chatTypes'

interface ColleagueProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  employee: EmployeeSearchResult | null
}

export const ColleagueProfileDrawer: React.FC<ColleagueProfileDrawerProps> = ({
  isOpen,
  onClose,
  employee,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!isOpen || !employee) return null

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const isOnline = employee.is_online
  const presenceStatus = isOnline ? 'available' : 'offline'

  return (
    <div className="teams-sheet-overlay" onClick={onClose}>
      <div className="teams-sheet-panel" onClick={(e) => e.stopPropagation()}>
        {/* Mobile Drag Handle */}
        <div className="teams-sheet-handle" />

        <div className="teams-sheet-header">
          <span className="teams-sheet-title">Profile</span>
          <button
            type="button"
            className="teams-sheet-close-btn"
            onClick={onClose}
            aria-label="Close profile"
          >
            <X size={20} />
          </button>
        </div>

        <div className="teams-sheet-body">
          {/* Avatar & Hero Information */}
          <div className="teams-profile-hero">
            <div className="teams-profile-avatar-wrap">
              <TeamsAvatar
                name={employee.name}
                photo={employee.profile_photo}
                presence={presenceStatus}
                size={76}
                showPresence={true}
              />
            </div>

            <h3 className="teams-profile-name">{employee.name}</h3>
            <p className="teams-profile-role">{employee.designation || 'Staff Member'}</p>
            <p className="teams-profile-dept">{employee.department || 'Healthcare Operations'}</p>

            <div className="teams-presence-status-chip">
              <TeamsPresenceBadge status={presenceStatus} size={13} />
              <span>{isOnline ? 'Available' : 'Offline'}</span>
              <span className="teams-divider-dot">•</span>
              <span className="teams-verified-tag">
                <ShieldCheck size={13} />
                <span>Verified</span>
              </span>
            </div>
          </div>

          {/* Teams Actions Row */}
          <div className="teams-actions-row">
            <button
              type="button"
              className="teams-action-circle-item"
              onClick={onClose}
            >
              <div className="teams-action-circle purple">
                <MessageSquare size={19} />
              </div>
              <span className="teams-action-label">Chat</span>
            </button>
          </div>

          {/* Teams Details Section */}
          <div className="teams-details-card">
            <h4 className="teams-card-section-title">Employee Information</h4>

            <div className="teams-detail-row">
              <div className="teams-detail-icon">
                <Hash size={17} />
              </div>
              <div className="teams-detail-content">
                <span className="teams-detail-label">Employee ID</span>
                <span className="teams-detail-val">{employee.employee_id}</span>
              </div>
              <button
                type="button"
                className="teams-copy-icon-btn"
                onClick={() => handleCopy(employee.employee_id, 'id')}
                title="Copy Employee ID"
              >
                {copiedField === 'id' ? <Check size={15} color="#237B4B" /> : <Copy size={15} />}
              </button>
            </div>

            <div className="teams-detail-row">
              <div className="teams-detail-icon">
                <Building size={17} />
              </div>
              <div className="teams-detail-content">
                <span className="teams-detail-label">Department</span>
                <span className="teams-detail-val">{employee.department || 'General'}</span>
              </div>
            </div>

            <div className="teams-detail-row">
              <div className="teams-detail-icon">
                <Briefcase size={17} />
              </div>
              <div className="teams-detail-content">
                <span className="teams-detail-label">Designation</span>
                <span className="teams-detail-val">{employee.designation || 'Healthcare Professional'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
