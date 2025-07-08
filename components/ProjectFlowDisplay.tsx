import React, { useRef, useEffect, useState, createRef, useCallback } from 'react';
import { ProjectTask, EditableExtendedTaskDetails, ProjectHealthReport, SlideDeck, TaskStatus, GanttItem } from '../types';
import TaskCard from './TaskCard';
import { TargetIcon, CalendarIcon, DownloadIcon, PlusCircleIcon, UploadIcon, RefreshIcon, UndoIcon, RedoIcon, ClipboardDocumentListIcon, SparklesIcon, PresentationChartBarIcon, PlusIcon as NewProjectIcon, GanttChartIcon, FolderIcon, KeyIcon } from './icons';
import FlowConnector from './FlowConnector';
import ActionItemOverviewModal from './ActionItemOverviewModal';
import ProjectHealthReportModal from './ProjectHealthReportModal';
import { generateProjectHealthReport, generateProjectReportDeck, generateGanttData } from '../services/geminiService';
import { ProjectService } from '../services/projectService';
import LoadingSpinner from './LoadingSpinner';
import SlideEditorView from './SlideEditorView';
import ConfirmNewProjectModal from './ConfirmNewProjectModal';
import GanttChartView from './GanttChartView';
import DocumentCenterModal from './DocumentCenterModal';

interface ProjectFlowDisplayProps {
  tasks: ProjectTask[];
  projectGoal: string;
  targetDate: string;
  onSelectTask: (task: ProjectTask) => void;
  onUpdateTaskExtendedDetails: (taskId: string, updates: EditableExtendedTaskDetails) => void; 
  onUpdateTaskPosition: (taskId: string, position: { x: number; y: number }) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onStartNewProject: () => void;
  onExportProject: () => void;
  onAddTask: () => void; 
  onRemoveTask: (taskId: string) => void;
  onImportSingleTask: (file: File) => void;
  onAutoLayout: () => void; 
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  generateUniqueId: (prefix: string) => string;
  onUpdateTaskConnections: (sourceTaskId: string, nextTaskIds: string[]) => void;
  ganttData: GanttItem[] | null;
  setGanttData: (data: GanttItem[] | null) => void;
  onCustomReportGenerated: (deck: SlideDeck) => void;
  onClearApiKey: () => void;
  onOpenProjectList: () => void;
  onLogout: () => void;
  currentProjectId: string | null;
  onSaveProject: () => Promise<void>;
}

interface ConnectorInfo {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  sourceId: string;
  targetId: string;
}

const ProjectFlowDisplay: React.FC<ProjectFlowDisplayProps> = ({ 
  tasks, projectGoal, targetDate, onSelectTask, onUpdateTaskExtendedDetails, onUpdateTaskPosition, 
  onUpdateTaskStatus, onStartNewProject, onExportProject, onAddTask, onRemoveTask, onImportSingleTask, 
  onAutoLayout, onUndo, canUndo, onRedo, canRedo,
  generateUniqueId, onUpdateTaskConnections,
  ganttData, setGanttData, onCustomReportGenerated, onClearApiKey,
  onOpenProjectList, onLogout, currentProjectId, onSaveProject
}) => {
  const singleTaskFileInputRef = useRef<HTMLInputElement>(null);
  const flowContainerRef = useRef<HTMLDivElement>(null);
  const [taskCardRefs, setTaskCardRefs] = useState<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  
  const draggedTaskIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isActionItemOverviewOpen, setIsActionItemOverviewOpen] = useState(false);
  const [isHealthReportOpen, setIsHealthReportOpen] = useState(false);
  const [healthReport, setHealthReport] = useState<ProjectHealthReport | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  const [isProjectReportEditorOpen, setIsProjectReportEditorOpen] = useState(false);
  const [projectReportDeck, setProjectReportDeck] = useState<SlideDeck | null>(null);
  const [isGeneratingProjectReport, setIsGeneratingProjectReport] = useState(false);
  const [projectReportError, setProjectReportError] = useState<string | null>(null);
  
  const [isGanttOpen, setIsGanttOpen] = useState(false);
  const [isGeneratingGantt, setIsGeneratingGantt] = useState(false);
  const [ganttError, setGanttError] = useState<string | null>(null);

  const [isConfirmNewProjectOpen, setIsConfirmNewProjectOpen] = useState(false);
  const [isDocumentCenterOpen, setIsDocumentCenterOpen] = useState(false);

  const [connectingState, setConnectingState] = useState<{ fromId: string; fromPos: { x: number; y: number } } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const newRefs = new Map<string, React.RefObject<HTMLDivElement>>();
    tasks.forEach(task => {
      newRefs.set(task.id, taskCardRefs.get(task.id) || createRef<HTMLDivElement>());
    });
    setTaskCardRefs(newRefs);
  }, [tasks]);

  const calculateConnectors = useCallback(() => {
    if (!flowContainerRef.current || taskCardRefs.size === 0) {
      setConnectors([]);
      return;
    }
  
    const newConnectors: ConnectorInfo[] = [];
  
    tasks.forEach((sourceTask) => {
      if (sourceTask.nextTaskIds && sourceTask.nextTaskIds.length > 0) {
        const sourceCardRef = taskCardRefs.get(sourceTask.id);
        const sourceCardElement = sourceCardRef?.current;
  
        if (!sourceCardElement) return;
  
        const sourceX = sourceTask.position?.x || 0;
        const sourceY = sourceTask.position?.y || 0;
        
        const sourceRect = sourceCardElement.getBoundingClientRect();

        const sourcePos = {
          x: sourceX + sourceRect.width, 
          y: sourceY + sourceRect.height / 2,
        };
  
        sourceTask.nextTaskIds.forEach(targetId => {
          const targetTask = tasks.find(t => t.id === targetId);
          if (!targetTask) return;
          
          const targetCardRef = taskCardRefs.get(targetId);
          const targetCardElement = targetCardRef?.current;

          if (!targetCardElement) return;
          
          const targetX = targetTask.position?.x || 0;
          const targetY = targetTask.position?.y || 0;
          const targetRect = targetCardElement.getBoundingClientRect();

          const targetPos = {
            x: targetX, 
            y: targetY + targetRect.height / 2,
          };
          
          newConnectors.push({
            id: `conn-${sourceTask.id}-${targetId}`,
            from: sourcePos,
            to: targetPos,
            sourceId: sourceTask.id,
            targetId: targetId,
          });
        });
      }
    });
    setConnectors(newConnectors);
  }, [tasks, taskCardRefs]); 

  useEffect(() => {
    const timer = setTimeout(calculateConnectors, 50); 
    return () => clearTimeout(timer);
  }, [calculateConnectors, tasks]); 

  useEffect(() => {
    window.addEventListener('resize', calculateConnectors);
    const observer = new MutationObserver(calculateConnectors);
    if (flowContainerRef.current) {
        observer.observe(flowContainerRef.current, { childList: true, subtree: true, attributes: true, characterData: true });
    }
    return () => {
        window.removeEventListener('resize', calculateConnectors);
        observer.disconnect();
    };
  }, [calculateConnectors]);

  const handleDragCardStart = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
    draggedTaskIdRef.current = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (flowContainerRef.current) {
        const containerRect = flowContainerRef.current.getBoundingClientRect();
        dragOffsetRef.current.x = event.clientX - containerRect.left - (task?.position?.x || 0) ;
        dragOffsetRef.current.y = event.clientY - containerRect.top - (task?.position?.y || 0);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); 
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggedTaskIdRef.current || !flowContainerRef.current) return;

    const containerRect = flowContainerRef.current.getBoundingClientRect();
    const draggedCardElement = taskCardRefs.get(draggedTaskIdRef.current)?.current;
    
    const cardWidth = draggedCardElement?.offsetWidth || 380; 
    const cardHeight = draggedCardElement?.offsetHeight || 280;

    let newX = event.clientX - containerRect.left - dragOffsetRef.current.x;
    let newY = event.clientY - containerRect.top - dragOffsetRef.current.y;

    const scrollableWidth = flowContainerRef.current.scrollWidth;
    const scrollableHeight = flowContainerRef.current.scrollHeight;

    newX = Math.max(0, Math.min(newX, scrollableWidth - cardWidth));
    newY = Math.max(0, Math.min(newY, scrollableHeight - cardHeight));

    onUpdateTaskPosition(draggedTaskIdRef.current, { x: newX, y: newY });
    draggedTaskIdRef.current = null;
    setTimeout(calculateConnectors, 0); 
  };
  
  const handleGenerateHealthReport = async () => {
    setIsDiagnosing(true);
    setDiagnosisError(null);
    try {
        const report = await generateProjectHealthReport(tasks, projectGoal, targetDate);
        setHealthReport(report);
        setIsHealthReportOpen(true);
    } catch (err) {
        setDiagnosisError(err instanceof Error ? err.message : "プロジェクト診断レポートの生成に失敗しました。");
    } finally {
        setIsDiagnosing(false);
    }
  };

  const handleGenerateProjectReport = async () => {
    if (projectReportDeck) {
      setIsProjectReportEditorOpen(true);
      return;
    }
    setIsGeneratingProjectReport(true);
    setProjectReportError(null);
    try {
      const deck = await generateProjectReportDeck(tasks, projectGoal, targetDate);
      setProjectReportDeck(deck);
      setIsProjectReportEditorOpen(true);
    } catch (err) {
      setProjectReportError(err instanceof Error ? err.message : "プロジェクトレポートの生成に失敗しました。");
    } finally {
      setIsGeneratingProjectReport(false);
    }
  };

  const handleOpenGantt = async () => {
    if (ganttData) {
      setIsGanttOpen(true);
      return;
    }
    setIsGeneratingGantt(true);
    setGanttError(null);
    try {
      const data = await generateGanttData(tasks, projectGoal, targetDate);
      setGanttData(data);
      setIsGanttOpen(true);
    } catch (err) {
      setGanttError(err instanceof Error ? err.message : "ガントチャートのデータ生成に失敗しました。");
    } finally {
      setIsGeneratingGantt(false);
    }
  };

  const handleRegenerateGantt = async () => {
    setIsGeneratingGantt(true);
    setGanttError(null);
    try {
      const data = await generateGanttData(tasks, projectGoal, targetDate);
      setGanttData(data);
    } catch (err) {
      setGanttError(err instanceof Error ? err.message : "ガントチャートのデータ再生成に失敗しました。");
    } finally {
      setIsGeneratingGantt(false);
    }
  };

  const handleSaveProject = async () => {
    if (!currentProjectId) {
      // 新規プロジェクトの場合、保存ダイアログを表示
      const title = prompt('プロジェクト名を入力してください:', `${projectGoal.substring(0, 50)}...`);
      if (!title) return;

      setIsSaving(true);
      try {
        const project = await ProjectService.createProject(title, projectGoal, targetDate, tasks, ganttData);
        alert('プロジェクトが保存されました！');
        // currentProjectIdを更新する必要があるが、propsで渡されているので親コンポーネントで管理
      } catch (error) {
        alert('プロジェクトの保存に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
      } finally {
        setIsSaving(false);
      }
    } else {
      // 既存プロジェクトの場合、直接保存
      setIsSaving(true);
      try {
        await onSaveProject();
        alert('プロジェクトが保存されました！');
      } catch (error) {
        alert('プロジェクトの保存に失敗しました: ' + (error instanceof Error ? error.message : '不明なエラー'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleStartConnection = (taskId: string, event: React.MouseEvent<HTMLDivElement>) => {
      if (!flowContainerRef.current) return;
      const containerRect = flowContainerRef.current.getBoundingClientRect();
      const fromPos = {
          x: event.clientX - containerRect.left + flowContainerRef.current.scrollLeft,
          y: event.clientY - containerRect.top + flowContainerRef.current.scrollTop,
      };
      setConnectingState({ fromId: taskId, fromPos });
  };

  const handleEndConnection = (targetTaskId: string) => {
      if (!connectingState || connectingState.fromId === targetTaskId) {
          setConnectingState(null);
          return;
      }
      const sourceTask = tasks.find(t => t.id === connectingState.fromId);
      if (sourceTask) {
          const newNextTaskIds = Array.from(new Set([...(sourceTask.nextTaskIds || []), targetTaskId]));
          onUpdateTaskConnections(sourceTask.id, newNextTaskIds);
      }
      setConnectingState(null);
  };

  const handleDeleteConnection = (sourceTaskId: string, targetTaskId: string) => {
      const sourceTask = tasks.find(t => t.id === sourceTaskId);
      if (sourceTask) {
          const newNextTaskIds = (sourceTask.nextTaskIds || []).filter(id => id !== targetTaskId);
          onUpdateTaskConnections(sourceTask.id, newNextTaskIds);
      }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!connectingState || !flowContainerRef.current) return;
    const containerRect = flowContainerRef.current.getBoundingClientRect();
    setMousePos({
      x: event.clientX - containerRect.left + flowContainerRef.current.scrollLeft,
      y: event.clientY - containerRect.top + flowContainerRef.current.scrollTop,
    });
  };

  const handleMouseUp = () => {
      if (connectingState) {
          setConnectingState(null); // Cancel connection if dropped on canvas
      }
  };
  
  const handleGanttItemClick = (item: GanttItem) => {
    const taskId = item.type === 'task' ? item.id : item.parentId;
    if (!taskId) return;
  
    const taskToSelect = tasks.find(t => t.id === taskId);
    if (taskToSelect) {
      setIsGanttOpen(false); // Close Gantt chart modal
      onSelectTask(taskToSelect); // Open task detail modal
    }
  };
  
  const handleCustomReport = (deck: SlideDeck) => {
      onCustomReportGenerated(deck);
      setIsDocumentCenterOpen(false);
  }

  const formattedDate = targetDate ? new Date(targetDate + 'T00:00:00Z').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '未設定';

  if (isProjectReportEditorOpen && projectReportDeck) {
     return <SlideEditorView 
        tasks={tasks}
        initialDeck={projectReportDeck}
        onSave={(deck) => setProjectReportDeck(deck)}
        onClose={() => setIsProjectReportEditorOpen(false)}
        projectGoal={projectGoal}
        targetDate={targetDate}
        reportScope="project"
        generateUniqueId={generateUniqueId}
     />
  }

  return (
    <>
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 flex flex-col overflow-hidden">
      <div className="max-w-full mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
           <button
            onClick={() => setIsConfirmNewProjectOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-transform hover:scale-105"
          >
            <NewProjectIcon className="w-5 h-5 mr-2" />
            新規プロジェクト
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenProjectList}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
              title="保存済みプロジェクト"
            >
              <FolderIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleSaveProject}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-400"
              title="プロジェクトを保存"
            >
              {isSaving ? <LoadingSpinner size="sm" color="border-white" /> : <DownloadIcon className="w-5 h-5" />}
            </button>
            <button
              onClick={onUndo} disabled={!canUndo}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:bg-slate-300 disabled:cursor-not-allowed" title="元に戻す"
            ><UndoIcon className="w-5 h-5" /></button>
             <button
              onClick={onRedo} disabled={!canRedo}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 disabled:bg-slate-300 disabled:cursor-not-allowed" title="やり直し"
            ><RedoIcon className="w-5 h-5" /></button>
            <button
                onClick={onClearApiKey}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-slate-800 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400" title="APIキーを変更"
            >
                <KeyIcon className="w-5 h-5 text-yellow-600" />
            </button>
            <button
              onClick={onLogout}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700"
              title="ログアウト"
            >
              <KeyIcon className="w-5 h-5" />
            </button>
            <button
              onClick={onAddTask}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700"
            ><PlusCircleIcon className="w-5 h-5 mr-2" />タスク追加</button>
            <button
              onClick={onExportProject}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            ><DownloadIcon className="w-5 h-5 mr-2" />JSONエクスポート</button>
            <button
              onClick={onAutoLayout}
              className="inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50" title="自動整列"
            ><RefreshIcon className="w-5 h-5 mr-2" />整列</button>
          </div>
        </div>

        <header className="mb-6 p-6 bg-white rounded-xl shadow-lg">
           <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-800 mb-3">プロジェクトフロー</h1>
                <div className="space-y-2 text-slate-700">
                  <p className="flex items-start"><TargetIcon className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0 mt-1" /><strong>目的:</strong>&nbsp;<span className="break-all">{projectGoal}</span></p>
                  <p className="flex items-center"><CalendarIcon className="w-5 h-5 mr-2 text-blue-600 flex-shrink-0" /><strong>目標日:</strong>&nbsp;{formattedDate}</p>
                  {currentProjectId && <p className="text-sm text-green-600">✓ Supabaseに保存済み</p>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                 <button
                    onClick={() => setIsActionItemOverviewOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50"
                  >
                    <ClipboardDocumentListIcon className="w-5 h-5 mr-2" />
                    アクションアイテム一覧
                 </button>
                 <button
                    onClick={() => setIsDocumentCenterOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md shadow-sm text-slate-700 bg-white hover:bg-slate-50"
                  >
                    <FolderIcon className="w-5 h-5 mr-2" />
                    資料センター
                 </button>
                 <button
                    onClick={handleOpenGantt}
                    disabled={isGeneratingGantt}
                    className="inline-flex items-center justify-center px-4 py-2 border border-amber-300 text-sm font-medium rounded-md shadow-sm text-amber-800 bg-amber-100 hover:bg-amber-200 disabled:bg-slate-400"
                 >
                    {isGeneratingGantt ? <LoadingSpinner size="sm" /> : <GanttChartIcon className="w-5 h-5 mr-2" />}
                    ガントチャート
                 </button>
                 <button
                    onClick={handleGenerateHealthReport}
                    disabled={isDiagnosing}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400"
                  >
                    {isDiagnosing ? <LoadingSpinner size="sm" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                    AIプロジェクト診断
                 </button>
                 <button
                    onClick={handleGenerateProjectReport}
                    disabled={isGeneratingProjectReport}
                    className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400"
                  >
                    {isGeneratingProjectReport ? <LoadingSpinner size="sm" /> : <PresentationChartBarIcon className="w-5 h-5 mr-2" />}
                    プロジェクトレポート作成
                 </button>
              </div>
           </div>
           {diagnosisError && <div className="mt-4"><p className="text-red-600 text-sm">{diagnosisError}</p></div>}
           {projectReportError && <div className="mt-4"><p className="text-red-600 text-sm">{projectReportError}</p></div>}
           {ganttError && <div className="mt-4"><p className="text-red-600 text-sm">{ganttError}</p></div>}
        </header>
      </div>
      
      <div 
        ref={flowContainerRef} 
        className="flex-grow overflow-auto pb-8 relative min-h-[600px] border border-slate-300 rounded-lg bg-slate-50 p-4 shadow-inner"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="relative w-full h-full min-w-[1200px] min-h-[800px]">
            {tasks.map((task, index) => (
              <TaskCard 
                key={task.id}
                cardRef={taskCardRefs.get(task.id)}
                task={task} 
                onSelectTask={onSelectTask} 
                onRemoveTask={onRemoveTask}
                onUpdateStatus={onUpdateTaskStatus}
                onDragCardStart={handleDragCardStart}
                onStartConnection={handleStartConnection}
                onEndConnection={handleEndConnection}
                index={index}
              />
            ))}
            {connectors.map(conn => (
              <FlowConnector key={conn.id} from={conn.from} to={conn.to} id={conn.id} onDelete={() => handleDeleteConnection(conn.sourceId, conn.targetId)}/>
            ))}
            {connectingState && (
                <FlowConnector from={connectingState.fromPos} to={mousePos} id="preview-connector" />
            )}
        </div>
        {tasks.length === 0 && (
          <div className="text-center py-10 flex-grow flex items-center justify-center">
            <p className="text-slate-500 text-lg">タスクがありません。「タスク追加」ボタンで最初のタスクを作成しましょう。</p>
          </div>
        )}
      </div>
    </div>
    {isGanttOpen && ganttData && 
      <GanttChartView 
        data={ganttData} 
        onClose={() => setIsGanttOpen(false)} 
        onItemClick={handleGanttItemClick} 
        onRegenerate={handleRegenerateGantt}
        isRegenerating={isGeneratingGantt}
      />
    }
    {isDocumentCenterOpen && 
      <DocumentCenterModal 
        tasks={tasks}
        projectGoal={projectGoal}
        targetDate={targetDate}
        ganttData={ganttData}
        projectReportDeck={projectReportDeck}
        onClose={() => setIsDocumentCenterOpen(false)}
        onReportGenerated={handleCustomReport}
        generateUniqueId={generateUniqueId}
      />
    }
    {isActionItemOverviewOpen && <ActionItemOverviewModal tasks={tasks} onClose={() => setIsActionItemOverviewOpen(false)} />}
    {isHealthReportOpen && <ProjectHealthReportModal report={healthReport} onClose={() => setIsHealthReportOpen(false)} />}
    {isConfirmNewProjectOpen && (
        <ConfirmNewProjectModal
            onClose={() => setIsConfirmNewProjectOpen(false)}
            onDownloadAndStartNew={() => {
                onExportProject();
                onStartNewProject();
            }}
            onStartNewWithoutSaving={onStartNewProject}
        />
    )}
    </>
  );
};

export default ProjectFlowDisplay;