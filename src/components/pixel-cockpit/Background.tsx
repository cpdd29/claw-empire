import React from 'react';
import { Cloud, Bird } from './types';
import './Background.css';

interface BackgroundProps {
  mode: 'day' | 'night';
  clouds: Cloud[];
  birds: Bird[];
}

export const Background: React.FC<BackgroundProps> = ({ mode, clouds, birds }) => {
  return (
    <div className={`pixel-background ${mode}-mode mode-transition`}>
      {/* 天空渐变背景 */}
      <div 
        className="sky-gradient" 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: mode === 'day' 
            ? 'linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)'
            : 'linear-gradient(180deg, #0f0c29 0%, #302b63 100%)',
          transition: 'background 800ms ease-in-out',
        }}
      />
      
      {/* 云朵层 - 视差滚动 */}
      <div className="cloud-layer" style={{ '--parallax-speed': 0.2 } as React.CSSProperties}>
        {clouds.map((cloud) => (
          <CloudComponent key={cloud.id} cloud={cloud} />
        ))}
      </div>
      
      {/* 鸟儿层 */}
      <div className="bird-layer">
        {birds.map((bird) => (
          <BirdComponent key={bird.id} bird={bird} />
        ))}
      </div>
      
      {/* 背景大厦群 - 左侧远景 */}
      <div className="background-buildings left">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i} 
            className="bg-building"
            style={{
              height: `${40 + Math.random() * 60}%`,
              width: `${60 + Math.random() * 40}px`,
              left: `${i * 80}px`,
            }}
          />
        ))}
      </div>
      
      {/* 背景大厦群 - 右侧中景 */}
      <div className="background-buildings right">
        {Array.from({ length: 6 }).map((_, i) => (
          <div 
            key={i} 
            className="bg-building"
            style={{
              height: `${50 + Math.random() * 80}%`,
              width: `${70 + Math.random() * 50}px`,
              right: `${i * 90}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface CloudComponentProps {
  cloud: Cloud;
}

const CloudComponent: React.FC<CloudComponentProps> = ({ cloud }) => {
  return (
    <div
      className="pixel-cloud animate-pixel-move-slow"
      style={{
        position: 'absolute',
        left: `${cloud.position.x}%`,
        top: `${cloud.position.y}%`,
        transform: `scale(${cloud.scale})`,
        animationDuration: `${cloud.speed}s`,
      }}
    >
      {/* 像素云朵形状 */}
      <div className="cloud-shape">
        <div className="cloud-block cloud-block-1" />
        <div className="cloud-block cloud-block-2" />
        <div className="cloud-block cloud-block-3" />
        <div className="cloud-block cloud-block-4" />
      </div>
    </div>
  );
};

interface BirdComponentProps {
  bird: Bird;
}

const BirdComponent: React.FC<BirdComponentProps> = ({ bird }) => {
  return (
    <div
      className="pixel-bird"
      style={{
        position: 'absolute',
        left: `${bird.position.x}%`,
        top: `${bird.position.y}%`,
        animation: `bird-flight ${bird.speed}s ease-in-out infinite`,
      }}
    >
      {/* V 字形像素鸟 */}
      <div className={`bird-shape wing-phase-${bird.wingPhase % 2}`}>
        <div className="bird-wing-left" />
        <div className="bird-body" />
        <div className="bird-wing-right" />
      </div>
    </div>
  );
};
