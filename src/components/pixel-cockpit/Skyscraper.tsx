import React, { useState, useMemo } from 'react';
import { FloorData, EmployeeStatus } from './types';
import './Skyscraper.css';

interface SkyscraperProps {
  mode: 'day' | 'night';
  floors: FloorData[];
  onFloorClick: (floorId: number) => void;
  onFloorHover: (floorId: number | null) => void;
  selectedFloor: number | null;
}

export const Skyscraper: React.FC<SkyscraperProps> = ({
  mode,
  floors,
  onFloorClick,
  onFloorHover,
  selectedFloor,
}) => {
  return (
    <div className={`pixel-skyscraper ${mode}-mode pixel-perfect`}>
      <div className="skyscraper-shell">
        {/* 中国尊曲线造型 - 顶部收缩 */}
        <div className="building-top">
          <div className="roof-decoration" />
        </div>
        
        {/* 中段外扩 - 玻璃幕墙 */}
        <div className="building-middle">
          {floors.map((floor, index) => (
            <Floor
              key={floor.id}
              floor={floor}
              floorIndex={index}
              mode={mode}
              isSelected={selectedFloor === floor.id}
              onClick={() => onFloorClick(floor.id)}
              onHover={onFloorHover}
            />
          ))}
        </div>
        
        {/* 底部收腰 */}
        <div className="building-bottom">
          <div className="base-decoration" />
        </div>
        
        {/* 右侧投影 */}
        <div className="building-shadow" />
      </div>
      
      {/* 楼层标识 */}
      <div className="floor-labels">
        {floors.map((floor, index) => (
          <div key={floor.id} className={`floor-label ${selectedFloor === floor.id ? 'active' : ''}`}>
            L{index + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

interface FloorProps {
  floor: FloorData;
  floorIndex: number;
  mode: 'day' | 'night';
  isSelected: boolean;
  onClick: () => void;
  onHover: (floorId: number | null) => void;
}

const Floor: React.FC<FloorProps> = ({
  floor,
  floorIndex,
  mode,
  isSelected,
  onClick,
  onHover,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const glassPanels = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      hasLight: Math.random() > 0.3,
      intensity: 0.3 + Math.random() * 0.4,
    }));
  }, []);

  return (
    <div
      className={`floor ${isSelected || isHovered ? 'highlighted' : ''}`}
      onClick={onClick}
      onMouseEnter={() => {
        setIsHovered(true);
        onHover(floor.id);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHover(null);
      }}
    >
      {/* 玻璃幕墙 */}
      <div 
        className="glass-wall" 
        style={{ 
          position: 'absolute', 
          top: '5%', 
          left: '5%', 
          right: '5%', 
          bottom: '5%',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '2px',
        }}
      >
        {glassPanels.map((panel) => (
          <div
            key={panel.id}
            className="glass-panel"
            style={{
              background: mode === 'day' ? '#60a5fa' : '#1e3a5f',
              opacity: panel.hasLight ? panel.intensity : 0.3,
              minHeight: '4px',
            }}
          />
        ))}
      </div>
      
      {/* 对角线高光条纹 */}
      <div className="glass-highlight" style={{ zIndex: 2 }} />
      
      {/* 员工状态指示器 */}
      {floor.employeeStatus && (
        <EmployeeIndicator 
          status={floor.employeeStatus} 
          mode={mode}
        />
      )}
      
      {/* 楼层边框发光 */}
      {(isSelected || isHovered) && (
        <div className="floor-glow" />
      )}
    </div>
  );
};

interface EmployeeIndicatorProps {
  status: EmployeeStatus;
  mode: 'day' | 'night';
}

const EmployeeIndicator: React.FC<EmployeeIndicatorProps> = ({ status, mode }) => {
  if (mode === 'day') {
    // 明亮模式 - 气泡对话框
    return (
      <div className="employee-bubble animate-pixel-float">
        <div className="bubble-icon">
          {status.state === 'coding' && '💻'}
          {status.state === 'meeting' && '👥'}
          {status.state === 'idle' && '☕'}
          {status.state === 'focused' && '🎯'}
        </div>
        <div className="bubble-text">
          {status.state === 'coding' && '编码中..'}
          {status.state === 'meeting' && '会议中..'}
          {status.state === 'idle' && '休息中..'}
          {status.state === 'focused' && '专注中..'}
        </div>
        <div className="bubble-tail" />
      </div>
    );
  } else {
    // 暗黑模式 - 灯光效果
    return (
      <div className="employee-light">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`light-block ${status.intensity > i * 0.25 ? 'on' : 'off'}`}
            style={{
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    );
  }
};
