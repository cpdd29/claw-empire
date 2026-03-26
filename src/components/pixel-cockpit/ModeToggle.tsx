import React from 'react';
import './ModeToggle.css';

interface ModeToggleProps {
  mode: 'day' | 'night';
  onToggle: () => void;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({ mode, onToggle }) => {
  return (
    <button 
      className="pixel-mode-toggle" 
      onClick={onToggle}
      style={{
        background: 'rgba(26, 28, 44, 0.9)',
        border: '4px solid #0a0a0a',
        boxShadow: 'inset 2px 2px 0 #ffffff, 4px 4px 0 rgba(0, 0, 0, 0.5)',
        color: '#f5f5f5',
        cursor: 'pointer',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div className={`toggle-icon ${mode}`} style={{ fontSize: '24px' }}>
        {mode === 'day' ? '☀️' : '🌙'}
      </div>
      <div className="toggle-label" style={{ fontFamily: 'VT323, monospace', fontSize: '16px' }}>
        {mode === 'day' ? '明亮模式' : '暗黑模式'}
      </div>
    </button>
  );
};
