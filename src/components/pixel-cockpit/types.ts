import type { Task as BaseTask } from "../../types";

// 扩展项目现有的 Task 类型
export interface Task extends BaseTask {
  progress?: number;
}

export interface EmployeeStatus {
  state: 'coding' | 'meeting' | 'idle' | 'focused';
  progress?: number;
  intensity: number;
}

export interface FloorData {
  id: number;
  name: string;
  department: string;
  employees: number;
  status: 'active' | 'idle' | 'busy';
  employeeStatus?: EmployeeStatus;
}

export interface CockpitState {
  mode: 'day' | 'night';
  activeTasks: Task[];
  selectedFloor: number | null;
  employees: Record<number, EmployeeStatus>;
  vehicles: Vehicle[];
  clouds: Cloud[];
  birds: Bird[];
}

export interface Vehicle {
  id: string;
  type: 'car' | 'truck';
  color: string;
  position: number;
  speed: number;
  direction: 'left' | 'right';
}

export interface Cloud {
  id: string;
  position: { x: number; y: number };
  speed: number;
  scale: number;
  shape: number;
}

export interface Bird {
  id: string;
  position: { x: number; y: number };
  speed: number;
  wingPhase: number;
}
