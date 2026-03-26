import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Sprite, Container, Graphics, Texture, AnimatedSprite } from 'pixi.js';
import { Task } from './types';
import { TaskPanel } from './TaskPanel';
import { ModeToggle } from './ModeToggle';
import './PixelCockpitPixi.css';

interface PixelCockpitPixiProps {
  tasks?: Task[];
}

export const PixelCockpitPixi: React.FC<PixelCockpitPixiProps> = ({ tasks = [] }) => {
  const pixiRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const officeContainerRef = useRef<Container | null>(null);
  
  const [mode, setMode] = useState<'day' | 'night'>('day');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  // 办公楼配置
  const FLOORS = 3; // 3 层办公室
  const FLOOR_HEIGHT = 160; // 每层高度（像素）
  const ROOM_WIDTH = 200; // 房间宽度
  const WALL_THICKNESS = 8; // 墙壁厚度

  // 初始化 PixiJS 应用
  useEffect(() => {
    if (!pixiRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      
      await app.init({
        width: 1200,
        height: 800,
        backgroundColor: mode === 'day' ? 0x87CEEB : 0x0f0c29,
        antialias: false, // 像素风格不需要抗锯齿
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (pixiRef.current) {
        pixiRef.current.appendChild(app.canvas);
      }
      appRef.current = app;

      // 创建办公楼容器
      const officeContainer = new Container();
      officeContainer.x = 100;
      officeContainer.y = 100;
      app.stage.addChild(officeContainer);
      officeContainerRef.current = officeContainer;

      // 构建办公楼
      buildOfficeBuilding(officeContainer, FLOORS, FLOOR_HEIGHT, ROOM_WIDTH, WALL_THICKNESS, mode);

      // 添加像素人物
      addPixelCharacters(officeContainer, FLOORS, FLOOR_HEIGHT, ROOM_WIDTH);

      // 添加家具
      addFurniture(officeContainer, FLOORS, FLOOR_HEIGHT, ROOM_WIDTH);

      // 清理函数
      return () => {
        app.destroy(true, { children: true });
      };
    };
    
    initPixi();
  }, []);

  // 模式切换时更新背景色
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.background.color = mode === 'day' ? 0x87CEEB : 0x0f0c29;
    }
  }, [mode]);

  // 模式切换处理
  const handleToggleMode = useCallback(() => {
    setMode(prev => prev === 'day' ? 'night' : 'day');
  }, []);

  // 楼层点击处理
  const handleFloorClick = useCallback((floorId: number) => {
    setSelectedFloor(floorId === selectedFloor ? null : floorId);
    console.log('点击楼层:', floorId);
  }, [selectedFloor]);

  return (
    <div className="pixel-cockpit-pixi-container">
      {/* PixiJS 画布容器 */}
      <div ref={pixiRef} className="pixi-canvas-container" />
      
      {/* UI 覆盖层 */}
      <TaskPanel tasks={tasks} />
      <ModeToggle mode={mode} onToggle={handleToggleMode} />
      
      {/* 楼层信息提示 */}
      {selectedFloor !== null && (
        <div className="floor-info-overlay">
          <div className="floor-info-content">
            <h3>L{selectedFloor} - 办公区</h3>
            <p>点击空白处关闭</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 构建办公楼剖面
 */
function buildOfficeBuilding(
  container: Container,
  floors: number,
  floorHeight: number,
  roomWidth: number,
  wallThickness: number,
  mode: 'day' | 'night'
) {
  const totalHeight = floors * floorHeight;
  const wallColor = mode === 'day' ? 0x8B7355 : 0x2C3E50; // 棕色墙壁 / 深蓝灰墙壁
  const floorColor = mode === 'day' ? 0xD2B48C : 0x34495E; // 浅棕地板 / 深灰地板
  const bgColor = mode === 'day' ? 0xF5F5DC : 0x2C3E50; // 米色背景 / 深蓝灰

  // 绘制墙壁和楼层（从下往上）
  for (let floor = 0; floor < floors; floor++) {
    const y = totalHeight - (floor + 1) * floorHeight; // 从底部开始向上绘制
    
    // 楼层地板（在楼层底部）
    const floorGraphics = new Graphics();
    floorGraphics.beginFill(floorColor);
    floorGraphics.drawRect(0, y + floorHeight - wallThickness, roomWidth * 2, wallThickness);
    floorGraphics.endFill();
    container.addChild(floorGraphics);

    // 左侧墙壁
    const leftWall = new Graphics();
    leftWall.beginFill(wallColor);
    leftWall.drawRect(0, y, wallThickness, floorHeight);
    leftWall.endFill();
    container.addChild(leftWall);

    // 右侧墙壁
    const rightWall = new Graphics();
    rightWall.beginFill(wallColor);
    rightWall.drawRect(roomWidth * 2, y, wallThickness, floorHeight);
    rightWall.endFill();
    container.addChild(rightWall);

    // 房间背景
    const roomBg = new Graphics();
    roomBg.beginFill(bgColor);
    roomBg.drawRect(wallThickness, y, roomWidth * 2 - wallThickness * 2, floorHeight - wallThickness);
    roomBg.endFill();
    container.addChild(roomBg);

    // 房间分隔墙
    const dividerWall = new Graphics();
    dividerWall.beginFill(wallColor);
    dividerWall.drawRect(roomWidth, y, wallThickness, floorHeight);
    dividerWall.endFill();
    container.addChild(dividerWall);
  }

  // 屋顶（在最顶部）
  const roof = new Graphics();
  roof.beginFill(wallColor);
  roof.drawRect(0, -wallThickness, roomWidth * 2 + wallThickness * 2, wallThickness);
  roof.endFill();
  container.addChild(roof);
  
  // 调整整个建筑的位置，使其底部对齐
  container.y = container.y + wallThickness;
}

/**
 * 添加像素人物角色
 */
function addPixelCharacters(container: Container, floors: number, floorHeight: number, roomWidth: number) {
  // 尝试加载精灵图
  const spriteNames = [
    '1-D-1', '1-D-2', '1-D-3',
    '2-D-1', '2-D-2', '2-D-3',
    '3-D-1', '3-D-2', '3-D-3',
  ];

  let spriteIndex = 0;

  for (let floor = 0; floor < floors; floor++) {
    const y = (floors - floor) * floorHeight - 40; // 站在地板上，减去人物高度
    
    // 每个楼层添加 2 个人物
    for (let i = 0; i < 2; i++) {
      const x = roomWidth * 0.3 + i * roomWidth + 40; // 居中一些
      
      try {
        const spriteName = spriteNames[spriteIndex % spriteNames.length];
        const texture = Texture.from(`/sprites/${spriteName}.png`);
        const character = new Sprite(texture);
        
        character.x = x;
        character.y = y;
        character.scale.set(2); // 放大 2 倍
        character.anchor.set(0.5, 1); // 底部中心对齐
        
        container.addChild(character);
        spriteIndex++;
      } catch (e) {
        console.warn('Failed to load sprite:', spriteNames[spriteIndex % spriteNames.length], e);
        
        // 如果精灵图加载失败，用简单图形代替
        const placeholder = new Graphics();
        placeholder.beginFill(0xFF6B6B);
        placeholder.drawRect(x - 10, y - 40, 20, 40);
        placeholder.endFill();
        container.addChild(placeholder);
      }
    }
  }
}

/**
 * 添加家具
 */
function addFurniture(container: Container, floors: number, floorHeight: number, roomWidth: number) {
  const WALL_THICKNESS = 8;
  
  for (let floor = 0; floor < floors; floor++) {
    const y = (floors - floor) * floorHeight; // 从底部开始
    
    // 每个房间添加办公桌和电脑
    for (let room = 0; room < 2; room++) {
      const roomX = room * roomWidth + WALL_THICKNESS;
      
      // 办公桌（靠近地板）
      const desk = new Graphics();
      desk.beginFill(0x8B4513); // 棕色
      desk.drawRect(roomX + 20, y + floorHeight - 60, 80, 40);
      desk.endFill();
      container.addChild(desk);
      
      // 电脑（在桌子上）
      const computer = new Graphics();
      computer.beginFill(0x696969); // 灰色
      computer.drawRect(roomX + 40, y + floorHeight - 70, 30, 20);
      computer.endFill();
      container.addChild(computer);
      
      // 椅子（在桌子前面）
      const chair = new Graphics();
      chair.beginFill(0x4682B4); // 蓝色
      chair.drawRect(roomX + 50, y + floorHeight - 20, 20, 20);
      chair.endFill();
      container.addChild(chair);
    }
    
    // 书架（靠墙）
    const bookshelf = new Graphics();
    bookshelf.beginFill(0xA0522D); // 棕色
    bookshelf.drawRect(roomWidth * 2 - 60, y + floorHeight - 100, 40, 80);
    bookshelf.endFill();
    container.addChild(bookshelf);
    
    // 植物（在角落）
    const plant = new Graphics();
    plant.beginFill(0x228B22); // 绿色
    plant.drawRect(roomWidth + 10, y + floorHeight - 40, 20, 20);
    plant.endFill();
    container.addChild(plant);
  }
}
