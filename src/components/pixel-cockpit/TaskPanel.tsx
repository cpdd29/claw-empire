import React from 'react';
import type { Task } from './types';
import './TaskPanel.css';

interface TaskPanelProps {
  tasks: Task[];
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ tasks }) => {
  const activeTasks = tasks.filter(t => t.status === 'in_progress').slice(0, 5);

  return (
    <div 
      className="pixel-task-panel pixel-perfect"
      style={{
        background: 'rgba(26, 28, 44, 0.9)',
        border: '4px solid #0a0a0a',
        boxShadow: 'inset 2px 2px 0 #ffffff, 4px 4px 0 rgba(0, 0, 0, 0.5)',
        color: '#f5f5f5',
      }}
    >
      <div className="panel-header">
        <span className="panel-icon">📋</span>
        <span className="panel-title">当前任务 x{activeTasks.length}</span>
      </div>
      
      <div className="panel-divider" />
      
      <div className="task-list">
        {activeTasks.map((task) => (
          <div key={task.id} className="task-item">
            <div className="task-title">{task.title || task.description || '未命名任务'}</div>
            <div className="pixel-progress">
              <div 
                className="pixel-progress-bar" 
                style={{ width: `${task.progress || 50}%` }}
              >
                {Array.from({ length: Math.floor((task.progress || 50) / 10) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="pixel-block"
                    style={{ animationDelay: `${i * 50}ms` }}
                  />
                ))}
              </div>
            </div>
            <div className="task-progress-text">{task.progress || 50}%</div>
          </div>
        ))}
        
        {activeTasks.length === 0 && (
          <div className="no-tasks">
            <span>✨ 暂无进行中的任务</span>
          </div>
        )}
      </div>
    </div>
  );
};
