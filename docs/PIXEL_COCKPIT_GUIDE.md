# 像素风驾驶舱使用指南

## 🎨 组件结构

```
src/components/pixel-cockpit/
├── PixelCockpit.tsx          # 主组件
├── TaskPanel.tsx             # 左上角任务面板
├── Skyscraper.tsx            # 摩天大厦主体
├── ModeToggle.tsx            # 明亮/暗黑模式切换
├── Background.tsx            # 背景环境（云朵、鸟儿、背景大厦）
├── GroundScene.tsx           # 底部场景（车辆、绿化带、道路）
├── types.ts                  # 类型定义
├── index.ts                  # 导出文件
├── styles/
│   └── pixels.css            # 像素设计系统
└── *.css                     # 各组件样式文件
```

## ✨ 功能特性

### 1. 左上角任务面板
- **位置**: fixed, top: 20px, left: 20px
- **尺寸**: 280px × 180px（最小高度）
- **样式**: 像素边框、半透明背景
- **功能**: 
  - 显示最多 5 个进行中的任务
  - 像素进度条动画（200ms/块）
  - 自动过滤 status='in_progress' 的任务
  - 滚动条像素风格

### 2. 摩天大厦主体（中国尊曲线造型）
- **尺寸**: 60% 宽度 × 72vh 高度
- **楼层**: 10 层（可配置）
- **造型**: 
  - 顶部收缩（梯形）
  - 中段外扩（最宽处）
  - 底部收腰
  - 右侧 45° 投影
- **玻璃幕墙**: 
  - 8 列玻璃面板
  - 半透明效果（alpha: 0.3-0.7）
  - 对角线高光条纹
  - 随机闪烁动画

### 3. 双模式切换系统

#### 明亮模式（Day Mode）
- **天空**: 天蓝色渐变 (#87CEEB → #E0F6FF)
- **玻璃**: 浅蓝反光 + 白色高光
- **员工指示**: 气泡对话框
  - 💻 编码中
  - 👥 会议中
  - ☕ 休息中
  - 🎯 专注中
- **动画**: 气泡上下浮动（2px, 2s 循环）

#### 暗黑模式（Night Mode）
- **天空**: 深紫蓝渐变 (#0f0c29 → #302b63)
- **玻璃**: 深色反光 + 黄色灯光
- **员工指示**: 窗户亮灯效果
  - 4 格灯光矩阵
  - 随机闪烁（模拟打字/思考）
  - 偶尔全层同步闪烁

#### 切换动画
- 太阳/月亮图标旋转（1s）
- 天空颜色渐变过渡（800ms）
- 玻璃反光颜色过渡
- 员工指示器形态变形

### 4. 背景环境

#### 云朵系统
- **数量**: 3 朵（可配置）
- **动画**: 水平飘动（30s 循环）
- **视差**: 速度 0.2x（最慢）
- **形状**: 4 个像素块组合

#### 鸟儿系统
- **数量**: 2 只（可配置）
- **动画**: 波浪形飞行轨迹（12s 循环）
- **翅膀**: 2 帧扇动循环
- **形状**: V 字形像素点（3px）

#### 背景大厦群
- **左侧**: 5 栋远景大厦（灰蓝色，40% 透明度）
- **右侧**: 6 栋中景大厦（灰紫色，70% 透明度）
- **动画**: 极慢视差滚动

### 5. 底部场景（15% 高度）

#### 道路系统
- **颜色**: 深灰色 (#2d3748)
- **标线**: 白色虚线
- **人行道**: 浅灰色

#### 车辆系统
- **类型**: 小汽车、卡车
- **颜色**: 红/黄/蓝
- **动画**: 匀速移动（8-15s 循环）
- **细节**: 
  - 车轮旋转动画
  - 车灯闪烁（前灯黄色、尾灯红色）
  - 刹车灯效果

#### 绿化带
- **树木**: 20 棵像素树
- **动画**: 轻微摇摆（3s 循环）
- **组成**: 树干 + 三角形树冠

### 6. 交互系统

#### 鼠标悬停（Hover）
- **楼层高亮**: 4px 青色边框发光 (#00ffff)
- **工具提示**: 
  ```
  ┌─────────────┐
  │ L7 - 技术部  │
  │ 👥 12 人     │
  │ 🟢 活跃     │
  └─────────────┘
  ```
- **光标**: 像素手型（待实现）

#### 点击交互
- **楼层选中**: 保持高亮 + 轻微放大（1.02x）
- **触发切换**: 像素溶解效果（待实现）
- **当前行为**: 打印楼层 ID 到控制台

## 🎮 使用方法

### 基本使用

```tsx
import { PixelCockpit } from './components/pixel-cockpit';

function App() {
  const tasks = [/* 任务数组 */];
  
  return <PixelCockpit tasks={tasks} />;
}
```

### 自定义楼层数据

修改 `PixelCockpit.tsx` 中的 `floors` 数组：

```typescript
const floors: FloorData[] = useMemo(() => [
  { 
    id: 1, 
    name: '大堂', 
    department: '接待处', 
    employees: 5, 
    status: 'active' 
  },
  // ... 更多楼层
], []);
```

### 自定义车辆/云朵/鸟儿

修改对应的数据数组：

```typescript
// 车辆
const vehicles: Vehicle[] = useMemo(() => [
  { 
    id: 'v1', 
    type: 'car', 
    color: '#e53e3e', 
    position: 10, 
    speed: 8, 
    direction: 'right' 
  },
], []);

// 云朵
const clouds: Cloud[] = useMemo(() => [
  { 
    id: 'c1', 
    position: { x: 10, y: 20 }, 
    speed: 30, 
    scale: 1, 
    shape: 1 
  },
], []);
```

## 🎨 调色板

### 8-bit 标准色（每通道步进 32）

```css
/* 基础色 */
--pixel-black: #0a0a0a
--pixel-white: #f5f5f5

/* 明亮模式 */
--day-sky-top: #87CEEB
--day-sky-bottom: #E0F6FF
--day-sun: #FFD700

/* 暗黑模式 */
--night-sky-top: #0f0c29
--night-sky-bottom: #302b63
--night-moon: #f5f5f5

/* 大厦颜色 */
--building-primary: #1a1c2c
--building-secondary: #334155
--building-accent: #475569

/* 玻璃幕墙 */
--glass-day-light: #60a5fa
--glass-day-highlight: #93c5fd
--glass-night-light: #1e3a5f
--glass-night-highlight: #3b82f6

/* 员工状态 */
--employee-bubble-bg: #ffffff
--employee-bubble-border: #1a1c2c
--employee-light-on: #ffbf00
--employee-light-off: #1a1c2c

/* 任务面板 */
--task-panel-bg: rgba(26, 28, 44, 0.9)
--task-panel-border: #0a0a0a
--task-panel-highlight: #ffffff
--task-progress-bg: #334155
--task-progress-fill: #10b981

/* 背景大厦 */
--bg-building-left: #4a5568
--bg-building-right: #718096

/* 底部场景 */
--ground-road: #2d3748
--ground-grass: #48bb78
--ground-sidewalk: #a0aec0

/* 车辆颜色 */
--car-red: #e53e3e
--car-yellow: #ecc94b
--car-blue: #4299e1
```

## ⚙️ 技术约束

### 像素完美

- 所有尺寸为 4 的倍数（4px/8px/16px 网格）
- 禁止亚像素渲染（使用 `transform: translate3d` 整数）
- 图片缩放：nearest-neighbor (`image-rendering: pixelated`)

### 性能优化

- Canvas 用于粒子效果（云朵、鸟儿）- 当前使用 CSS
- CSS transform 用于位移动画
- `will-change: transform` 用于车辆、云朵
- 动画使用 requestAnimationFrame（CSS 自动优化）

### 色彩限制

- 使用 8-bit 调色板（每通道 0-255，步进 32）
- 主色不超过 16 种

## 🔧 扩展功能

### 添加新的员工状态

1. 在 `types.ts` 中添加状态：
```typescript
export type EmployeeState = 
  | 'coding' 
  | 'meeting' 
  | 'idle' 
  | 'focused'
  | 'new_state'; // 新增
```

2. 在 `Skyscraper.tsx` 中添加图标和文字：
```typescript
{status.state === 'new_state' && '🆕'}
{status.state === 'new_state' && '新状态..'}
```

### 添加新的动画效果

在 `pixels.css` 中添加 keyframe：

```css
@keyframes custom-animation {
  0% { /* 初始状态 */ }
  100% { /* 结束状态 */ }
}

.animate-custom {
  animation: custom-animation 1s ease-in-out infinite;
}
```

### 添加响应式支持

在组件 CSS 中添加媒体查询：

```css
@media (max-width: 768px) {
  .pixel-task-panel {
    width: 240px;
  }
  
  .pixel-skyscraper {
    width: 80%;
    min-width: 400px;
  }
}
```

## 🐛 已知问题

1. **字体加载**: 依赖 Google Fonts 的 VT323 字体，国内访问可能较慢
   - 解决：可下载字体文件到本地 `public/fonts/` 目录

2. **动画性能**: 大量动画同时运行可能影响低端设备
   - 解决：添加性能模式开关，禁用部分动画

3. **任务进度**: 当前使用硬编码的 50% 默认值
   - 解决：从任务元数据中提取真实进度

## 📝 TODO

- [ ] 实现点击楼层切换到部门详情页
- [ ] 实现像素溶解转场效果
- [ ] 添加更多像素精灵图（车辆、树木变体）
- [ ] 实现键盘导航支持
- [ ] 添加音效（可选）
- [ ] 实现性能模式开关
- [ ] 添加更多任务状态指示器颜色
- [ ] 实现真实的员工状态数据绑定

## 📄 许可证

与主项目保持一致

---

*最后更新：2026-03-24*
