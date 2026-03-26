import React from 'react';
import { Vehicle } from './types';
import './GroundScene.css';

interface GroundSceneProps {
  vehicles: Vehicle[];
}

export const GroundScene: React.FC<GroundSceneProps> = ({ vehicles }) => {
  return (
    <div className="pixel-ground-scene">
      {/* 天空层 - 云朵 */}
      <div className="ground-sky">
        {Array.from({ length: 3 }).map((_, i) => (
          <div 
            key={i} 
            className="mini-cloud"
            style={{
              left: `${20 + i * 30}%`,
              animationDelay: `${i * 10}s`,
            }}
          />
        ))}
      </div>
      
      {/* 远景建筑轮廓 */}
      <div className="ground-buildings">
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i} 
            className="mini-building"
            style={{
              left: `${i * 12.5}%`,
              height: `${20 + Math.random() * 30}px`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>
      
      {/* 绿化带 */}
      <div className="ground-grass-layer">
        {Array.from({ length: 20 }).map((_, i) => (
          <div 
            key={i} 
            className="pixel-tree"
            style={{
              left: `${i * 5}%`,
              animationDelay: `${i * 0.2}s`,
            }}
          >
            <div className="tree-trunk" />
            <div className="tree-top" />
          </div>
        ))}
      </div>
      
      {/* 道路 */}
      <div className="ground-road">
        {/* 道路标线 */}
        <div className="road-markings">
          {Array.from({ length: 15 }).map((_, i) => (
            <div 
              key={i} 
              className="road-dash"
              style={{ left: `${i * 6.66}%` }}
            />
          ))}
        </div>
        
        {/* 车辆 */}
        {vehicles.map((vehicle) => (
          <VehicleComponent key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
      
      {/* 人行道 */}
      <div className="ground-sidewalk" />
    </div>
  );
};

interface VehicleComponentProps {
  vehicle: Vehicle;
}

const VehicleComponent: React.FC<VehicleComponentProps> = ({ vehicle }) => {
  return (
    <div
      className={`pixel-vehicle vehicle-${vehicle.type}`}
      style={{
        '--vehicle-color': vehicle.color,
        '--vehicle-direction': vehicle.direction === 'left' ? '-1' : '1',
      } as React.CSSProperties}
    >
      {/* 车身 */}
      <div className="vehicle-body">
        {vehicle.type === 'car' ? (
          <>
            <div className="car-top" />
            <div className="car-bottom" />
          </>
        ) : (
          <>
            <div className="truck-cab" />
            <div className="truck-cargo" />
          </>
        )}
      </div>
      
      {/* 车轮 */}
      <div className="vehicle-wheels">
        <div className="wheel wheel-front" />
        <div className="wheel wheel-back" />
      </div>
      
      {/* 车灯 */}
      <div className="vehicle-lights">
        <div className="light front" />
        <div className="light back" />
      </div>
    </div>
  );
};
