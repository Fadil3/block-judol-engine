import React from "react"

interface SettingsProps {
  threshold: number
  onThresholdChange: (value: number) => void
  onBack: () => void
}

export function SettingsPage({
  threshold,
  onThresholdChange,
  onBack
}: SettingsProps) {
  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={onBack} className="back-button">
          &larr; Back
        </button>
        <h2>Settings</h2>
      </div>
      <div className="control-group">
        <label htmlFor="threshold">
          Detection Threshold: {Math.round(threshold * 100)}%
        </label>
        <input
          type="range"
          id="threshold"
          min="0"
          max="1"
          step="0.1"
          value={threshold}
          onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}
