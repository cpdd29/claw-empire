import OfficeView from "./OfficeView";
import { TaskPanel } from "./pixel-cockpit/TaskPanel";
import { ModeToggle } from "./pixel-cockpit/ModeToggle";
import { useState, useCallback } from "react";
import type { Task, Agent, Department } from "../types";
import "./Dashboard.css";

interface DashboardProps {
  stats: any;
  agents: Agent[];
  tasks: Task[];
  companyName: string;
  onPrimaryCtaClick: () => void;
  departments?: Department[];
}

export default function Dashboard({ 
  stats, 
  agents, 
  tasks, 
  companyName, 
  onPrimaryCtaClick,
  departments = []
}: DashboardProps) {
  const [isDark, setIsDark] = useState(false);

  const handleToggleMode = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return (
    <div className="dashboard-container">
      {/* OfficeView 主场景 */}
      <div className="office-view-wrapper">
        <OfficeView
          departments={departments}
          agents={agents}
          tasks={tasks}
          subAgents={[]}
          meetingPresence={[]}
          activeMeetingTaskId={null}
          unreadAgentIds={new Set<string>()}
          crossDeptDeliveries={[]}
          onCrossDeptDeliveryProcessed={() => {}}
          ceoOfficeCalls={[]}
          onCeoOfficeCallProcessed={() => {}}
          onOpenActiveMeetingMinutes={() => {}}
          onSelectAgent={() => {}}
          onSelectDepartment={() => {}}
        />
      </div>
      
      {/* UI 覆盖层 */}
      <TaskPanel tasks={tasks} />
      <ModeToggle mode={isDark ? 'night' : 'day'} onToggle={handleToggleMode} />
    </div>
  );
}
