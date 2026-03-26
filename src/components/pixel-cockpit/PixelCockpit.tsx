import React, { useState, useMemo, useCallback } from 'react';
import { TaskPanel } from './TaskPanel';
import { Skyscraper } from './Skyscraper';
import { ModeToggle } from './ModeToggle';
import { Background } from './Background';
import { GroundScene } from './GroundScene';
import { CockpitState, FloorData, Task, Vehicle, Cloud, Bird } from './types';
import './styles/pixels.css';
import './PixelCockpit.css';

interface PixelCockpitProps {
  tasks?: Task[];
}

export const PixelCockpit: React.FC<PixelCockpitProps> = ({ tasks = [] }) => {
  // 状态管理
  const [mode, setMode] = useState<'day' | 'night'>('day');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);

  // 模拟楼层数据
  const floors: FloorData[] = useMemo(() => [
    { id: 1, name: '大堂', department: '接待处', employees: 5, status: 'active' },
    { id: 2, name: '2F', department: '人力资源部', employees: 8, status: 'active' },
    { id: 3, name: '3F', department: '技术部', employees: 12, status: 'busy' },
    { id: 4, name: '4F', department: '技术部', employees: 15, status: 'busy' },
    { id: 5, name: '5F', department: '产品部', employees: 10, status: 'active' },
    { id: 6, name: '6F', department: '设计部', employees: 8, status: 'active' },
    { id: 7, name: '7F', department: '市场部', employees: 6, status: 'idle' },
    { id: 8, name: '8F', department: '运营部', employees: 7, status: 'active' },
    { id: 9, name: '9F', department: '财务部', employees: 5, status: 'idle' },
    { id: 10, name: '10F', department: 'CEO 办公室', employees: 3, status: 'active' },
  ], []);

  // 模拟车辆数据
  const vehicles: Vehicle[] = useMemo(() => [
    { id: 'v1', type: 'car', color: '#e53e3e', position: 10, speed: 8, direction: 'right' },
    { id: 'v2', type: 'truck', color: '#4299e1', position: 60, speed: 12, direction: 'left' },
    { id: 'v3', type: 'car', color: '#ecc94b', position: 30, speed: 10, direction: 'right' },
  ], []);

  // 模拟云朵数据
  const clouds: Cloud[] = useMemo(() => [
    { id: 'c1', position: { x: 10, y: 20 }, speed: 30, scale: 1, shape: 1 },
    { id: 'c2', position: { x: 40, y: 30 }, speed: 35, scale: 1.2, shape: 2 },
    { id: 'c3', position: { x: 70, y: 25 }, speed: 28, scale: 0.9, shape: 1 },
  ], []);

  // 模拟鸟儿数据
  const birds: Bird[] = useMemo(() => [
    { id: 'b1', position: { x: 20, y: 15 }, speed: 12, wingPhase: 0 },
    { id: 'b2', position: { x: 50, y: 20 }, speed: 10, wingPhase: 1 },
  ], []);

  // 模式切换
  const handleToggleMode = useCallback(() => {
    setMode(prev => prev === 'day' ? 'night' : 'day');
  }, []);

  // 楼层点击
  const handleFloorClick = useCallback((floorId: number) => {
    setSelectedFloor(floorId === selectedFloor ? null : floorId);
    console.log('点击楼层:', floorId);
    // TODO: 切换到部门详情页
  }, [selectedFloor]);

  // 楼层悬停
  const handleFloorHover = useCallback((floorId: number | null) => {
    setHoveredFloor(floorId);
  }, []);

  return (
    <div className={`pixel-cockpit-container ${mode}-mode mode-transition`}>
      {/* 背景层 */}
      <Background mode={mode} clouds={clouds} birds={birds} />
      
      {/* 左上角任务面板 */}
      <TaskPanel tasks={tasks} />
      
      {/* 右上角模式切换 */}
      <ModeToggle mode={mode} onToggle={handleToggleMode} />
      
      {/* 摩天大厦主体 */}
      <div className="cockpit-main-content">
        <Skyscraper
          mode={mode}
          floors={floors}
          selectedFloor={selectedFloor}
          onFloorClick={handleFloorClick}
          onFloorHover={handleFloorHover}
        />
      </div>
      
      {/* 底部场景 */}
      <GroundScene vehicles={vehicles} />
      
      {/* 工具提示 */}
      {hoveredFloor && (
        <div className="pixel-tooltip" style={{
          position: 'absolute',
          left: '50%',
          top: '40%',
          transform: 'translateX(-50%)',
        }}>
          <div className="tooltip-title">L{hoveredFloor} - {floors[hoveredFloor - 1]?.department}</div>
          <div className="tooltip-info">👥 {floors[hoveredFloor - 1]?.employees}人</div>
          <div className="tooltip-status">
            {floors[hoveredFloor - 1]?.status === 'active' && '🟢 活跃'}
            {floors[hoveredFloor - 1]?.status === 'busy' && '🔴 忙碌'}
            {floors[hoveredFloor - 1]?.status === 'idle' && '⚪ 空闲'}
          </div>
        </div>
      )}
    </div>
  );
};
