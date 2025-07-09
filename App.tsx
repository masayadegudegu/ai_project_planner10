import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { ProjectTask, ViewState, EditableExtendedTaskDetails, TaskStatus, GanttItem, SlideDeck, ProjectMember } from './types';
import { initializeGemini, generateProjectPlan } from './services/geminiService';
import { ProjectService, ProjectData } from './services/projectService';
import ProjectInputForm from './components/ProjectInputForm';
import ProjectFlowDisplay from './components/ProjectFlowDisplay';
import TaskDetailModal from './components/TaskDetailModal';
import ApiKeyModal from './components/ApiKeyModal';
import AuthModal from './components/AuthModal';
import ProjectListModal from './components/ProjectListModal';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorMessage from './components/ErrorMessage';

// Template data
const TEMPLATES = {
  'process-design': {
    goal: 'APQP（Advanced Product Quality Planning）に基づく新製品の工程設計を完了し、量産開始準備を整える',
    tasks: [
      { id: 'apqp-1', title: '計画・プログラム定義（Phase 1）', description: '顧客要求の理解、設計目標の設定、初期品質計画の策定' },
      { id: 'apqp-2', title: '製品設計・開発（Phase 2）', description: 'DFMEA実施、設計検証、製品仕様の確定' },
      { id: 'apqp-3', title: '工程設計・開発（Phase 3）', description: 'PFMEA実施、工程フロー作成、制御計画策定' },
      { id: 'apqp-4', title: '製品・工程検証（Phase 4）', description: '試作評価、工程能力確認、量産試作実施' },
      { id: 'apqp-5', title: '立上げ・評価・是正処置（Phase 5）', description: '量産開始、初期品質監視、継続的改善' }
    ]
  },
  'process-change': {
    goal: 'ISO/IATF 16949に準拠した工程変更管理を実施し、品質リスクを最小化して変更を完了する',
    tasks: [
      { id: 'change-1', title: '変更要求・影響分析', description: '変更内容の詳細分析、リスクアセスメント、関連部門への影響評価' },
      { id: 'change-2', title: '変更計画・承認', description: '変更実施計画の策定、必要な承認取得、リソース確保' },
      { id: 'change-3', title: '変更実施・検証', description: '工程変更の実施、検証試験、品質確認' },
      { id: 'change-4', title: '効果確認・標準化', description: '変更効果の測定、標準書更新、関係者への展開' }
    ]
  },
  'new-product-eval': {
    goal: '顧客からの新製品要求に対し、既存設備での製造可能性を評価し、実現可能性報告書を提出する',
    tasks: [
      { id: 'eval-1', title: '顧客要求分析', description: '製品仕様、品質要求、数量・納期要求の詳細分析' },
      { id: 'eval-2', title: '設備能力評価', description: '既存設備の能力確認、必要な改造・追加設備の検討' },
      { id: 'eval-3', title: '製造可能性検証', description: '試作・テスト実施、品質確認、コスト試算' },
      { id: 'eval-4', title: '実現可能性報告', description: '評価結果まとめ、リスク・課題整理、顧客への提案書作成' }
    ]
  },
  'improvement-project': {
    goal: 'DMAICアプローチを用いて生産性向上とコスト削減を実現し、目標効果を達成する',
    tasks: [
      { id: 'dmaic-d', title: 'Define（定義）', description: '問題の明確化、目標設定、プロジェクトスコープの定義' },
      { id: 'dmaic-m', title: 'Measure（測定）', description: '現状把握、データ収集、ベースライン設定' },
      { id: 'dmaic-a', title: 'Analyze（分析）', description: '根本原因分析、要因特定、改善機会の抽出' },
      { id: 'dmaic-i', title: 'Improve（改善）', description: '改善案実施、効果検証、最適化' },
      { id: 'dmaic-c', title: 'Control（管理）', description: '標準化、監視体制構築、継続的改善' }
    ]
  },
  'equipment-modification': {
    goal: '社内設備・治具の改造により生産効率向上を図り、投資対効果を最大化する',
    tasks: [
      { id: 'equip-1', title: '現状分析・要求定義', description: '現設備の課題分析、改造要求の明確化、目標設定' },
      { id: 'equip-2', title: '改造設計・計画', description: '改造設計、部品調達計画、作業スケジュール策定' },
      { id: 'equip-3', title: '改造実施・テスト', description: '設備停止、改造作業実施、機能確認テスト' },
      { id: 'equip-4', title: '効果検証・標準化', description: '改造効果測定、作業標準更新、横展開検討' }
    ]
  }
};

// History management
interface HistoryState {
  tasks: ProjectTask[];
  projectGoal: string;
  targetDate: string;
}

const useHistory = (initialState: HistoryState) => {
  const [history, setHistory] = useState<HistoryState[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const addToHistory = useCallback((newState: HistoryState) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(newState);
      return newHistory.slice(-50); // Keep last 50 states
    });
    setCurrentIndex(prev => Math.min(prev + 1, 49));
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { addToHistory, undo, redo, canUndo, canRedo };
};

const App: React.FC = () => {
  // Authentication state
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Project collaboration state
  const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [showProjectList, setShowProjectList] = useState(false);

  // Core application state
  const [viewState, setViewState] = useState<ViewState>(ViewState.INPUT_FORM);
  const [projectGoal, setProjectGoal] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [ganttData, setGanttData] = useState<GanttItem[] | null>(null);
  const [customReportDeck, setCustomReportDeck] = useState<SlideDeck | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);

  // History management
  const { addToHistory, undo, redo, canUndo, canRedo } = useHistory({
    tasks,
    projectGoal,
    targetDate,
  });

  // Auto-layout configuration
  const CARD_WIDTH = 380;
  const CARD_HEIGHT = 280;
  const HORIZONTAL_SPACING = 450;
  const VERTICAL_SPACING = 350;

  // Initialize authentication
  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setCurrentProject(null);
        setProjectMembers([]);
        setTasks([]);
        setProjectGoal('');
        setTargetDate('');
        setViewState(ViewState.INPUT_FORM);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize API key
  useEffect(() => {
    const savedApiKey = sessionStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      setIsApiKeySet(true);
      initializeGemini(savedApiKey);
    }
  }, []);

  // Real-time project updates
  useEffect(() => {
    if (!currentProject?.id) return;

    const unsubscribe = ProjectService.subscribeToProjectChanges(
      currentProject.id,
      (payload) => {
        // Handle project updates
        if (payload.eventType === 'UPDATE') {
          const updatedProject = payload.new;
          setTasks(updatedProject.tasks_data || []);
          setProjectGoal(updatedProject.goal);
          setTargetDate(updatedProject.target_date);
          setGanttData(updatedProject.gantt_data);
        }
      },
      () => {
        // Handle member updates
        loadProjectMembers();
      }
    );

    return unsubscribe;
  }, [currentProject?.id]);

  const loadProjectMembers = useCallback(async () => {
    if (!currentProject?.id) return;
    
    try {
      const projectWithMembers = await ProjectService.getProjectWithMembers(currentProject.id);
      setProjectMembers(projectWithMembers.members || []);
    } catch (error) {
      console.error('Failed to load project members:', error);
    }
  }, [currentProject?.id]);

  // Load project members when project changes
  useEffect(() => {
    loadProjectMembers();
  }, [loadProjectMembers]);

  const generateUniqueId = useCallback((prefix: string = 'item'): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const setTasksWithHistory = useCallback((newTasks: ProjectTask[] | ((prev: ProjectTask[]) => ProjectTask[])) => {
    setTasks(prevTasks => {
      const updatedTasks = typeof newTasks === 'function' ? newTasks(prevTasks) : newTasks;
      addToHistory({ tasks: updatedTasks, projectGoal, targetDate });
      return updatedTasks;
    });
  }, [addToHistory, projectGoal, targetDate]);

  const handleSetApiKey = useCallback((key: string) => {
    setApiKey(key);
    setIsApiKeySet(true);
    sessionStorage.setItem('gemini_api_key', key);
    initializeGemini(key);
    setError(null);
  }, []);

  const handleClearApiKey = useCallback(() => {
    setApiKey('');
    setIsApiKeySet(false);
    sessionStorage.removeItem('gemini_api_key');
    initializeGemini('');
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setShowAuthModal(false);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleProjectSubmit = useCallback(async (goal: string, date: string) => {
    if (!isApiKeySet) {
      setError('APIキーが設定されていません。');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const generatedTasks = await generateProjectPlan(goal, date);
      const tasksWithPositions = generatedTasks.map((task, index) => ({
        ...task,
        position: {
          x: 50 + (index % 3) * HORIZONTAL_SPACING,
          y: 50 + Math.floor(index / 3) * VERTICAL_SPACING,
        },
      }));

      setProjectGoal(goal);
      setTargetDate(date);
      setTasksWithHistory(tasksWithPositions);
      setViewState(ViewState.PROJECT_FLOW);
      addToHistory({ tasks: tasksWithPositions, projectGoal: goal, targetDate: date });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクト計画の生成に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  }, [isApiKeySet, setTasksWithHistory, addToHistory, HORIZONTAL_SPACING, VERTICAL_SPACING]);

  const handleLoadTemplate = useCallback((templateName: keyof typeof TEMPLATES, goal: string, date: string) => {
    const template = TEMPLATES[templateName];
    const tasksWithPositions = template.tasks.map((task, index) => ({
      ...task,
      position: {
        x: 50 + (index % 3) * HORIZONTAL_SPACING,
        y: 50 + Math.floor(index / 3) * VERTICAL_SPACING,
      },
    }));

    setProjectGoal(goal);
    setTargetDate(date);
    setTasksWithHistory(tasksWithPositions);
    setViewState(ViewState.PROJECT_FLOW);
    addToHistory({ tasks: tasksWithPositions, projectGoal: goal, targetDate: date });
  }, [setTasksWithHistory, addToHistory, HORIZONTAL_SPACING, VERTICAL_SPACING]);

  const handleSelectTask = useCallback((task: ProjectTask) => {
    setSelectedTask(task);
  }, []);

  const handleUpdateTaskExtendedDetails = useCallback(async (taskId: string, details: EditableExtendedTaskDetails) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, extendedDetails: details } : t
    );
    setTasksWithHistory(updatedTasks);

    // Auto-save to Supabase if project exists
    if (currentProject?.id && (currentProject.userRole === 'owner' || currentProject.userRole === 'editor')) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          expectedVersion: currentProject.version,
        });
      } catch (error) {
        console.error('Failed to auto-save project:', error);
      }
    }
  }, [tasks, setTasksWithHistory, currentProject]);

  const handleUpdateTaskPosition = useCallback(async (taskId: string, position: { x: number; y: number }) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, position } : t
    );
    setTasksWithHistory(updatedTasks);

    // Auto-save to Supabase if project exists
    if (currentProject?.id && (currentProject.userRole === 'owner' || currentProject.userRole === 'editor')) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          expectedVersion: currentProject.version,
        });
      } catch (error) {
        console.error('Failed to auto-save project:', error);
      }
    }
  }, [tasks, setTasksWithHistory, currentProject]);

  const handleUpdateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    const updatedTasks = tasks.map(t => 
      t.id === taskId ? { ...t, status } : t
    );
    setTasksWithHistory(updatedTasks);

    // Auto-save to Supabase if project exists
    if (currentProject?.id && (currentProject.userRole === 'owner' || currentProject.userRole === 'editor')) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          expectedVersion: currentProject.version,
        });
      } catch (error) {
        console.error('Failed to auto-save project:', error);
      }
    }
  }, [tasks, setTasksWithHistory, currentProject]);

  const handleUpdateTaskConnections = useCallback(async (sourceTaskId: string, nextTaskIds: string[]) => {
    const updatedTasks = tasks.map(t => 
      t.id === sourceTaskId ? { ...t, nextTaskIds } : t
    );
    setTasksWithHistory(updatedTasks);

    // Auto-save to Supabase if project exists
    if (currentProject?.id && (currentProject.userRole === 'owner' || currentProject.userRole === 'editor')) {
      try {
        await ProjectService.updateProject(currentProject.id, {
          tasks: updatedTasks,
          expectedVersion: currentProject.version,
        });
      } catch (error) {
        console.error('Failed to auto-save project:', error);
      }
    }
  }, [tasks, setTasksWithHistory, currentProject]);

  const handleStartNewProject = useCallback(() => {
    setCurrentProject(null);
    setProjectMembers([]);
    setTasks([]);
    setProjectGoal('');
    setTargetDate('');
    setGanttData(null);
    setCustomReportDeck(null);
    setViewState(ViewState.INPUT_FORM);
  }, []);

  const handleExportProject = useCallback(() => {
    const projectData = {
      projectGoal,
      targetDate,
      tasks,
      ganttData,
    };
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [projectGoal, targetDate, tasks, ganttData]);

  const handleImportProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (content.projectGoal && content.targetDate && Array.isArray(content.tasks)) {
          setProjectGoal(content.projectGoal);
          setTargetDate(content.targetDate);
          setTasksWithHistory(content.tasks);
          setGanttData(content.ganttData || null);
          setViewState(ViewState.PROJECT_FLOW);
          addToHistory({ 
            tasks: content.tasks, 
            projectGoal: content.projectGoal, 
            targetDate: content.targetDate 
          });
        } else {
          setError('無効なプロジェクトファイル形式です。');
        }
      } catch (err) {
        setError('ファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  }, [setTasksWithHistory, addToHistory]);

  const handleAddTask = useCallback(() => {
    const newTask: ProjectTask = {
      id: generateUniqueId('task'),
      title: '新しいタスク',
      description: 'タスクの説明を入力してください',
      position: {
        x: 50 + (tasks.length % 3) * HORIZONTAL_SPACING,
        y: 50 + Math.floor(tasks.length / 3) * VERTICAL_SPACING,
      },
    };
    setTasksWithHistory([...tasks, newTask]);
  }, [tasks, generateUniqueId, setTasksWithHistory, HORIZONTAL_SPACING, VERTICAL_SPACING]);

  const handleRemoveTask = useCallback((taskId: string) => {
    if (confirm('このタスクを削除しますか？')) {
      const updatedTasks = tasks.filter(t => t.id !== taskId);
      setTasksWithHistory(updatedTasks);
    }
  }, [tasks, setTasksWithHistory]);

  const handleImportSingleTask = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string);
        if (content.task && content.task.id && content.task.title) {
          const importedTask = {
            ...content.task,
            id: generateUniqueId('imported_task'),
            position: {
              x: 50 + (tasks.length % 3) * HORIZONTAL_SPACING,
              y: 50 + Math.floor(tasks.length / 3) * VERTICAL_SPACING,
            },
          };
          setTasksWithHistory([...tasks, importedTask]);
        } else {
          setError('無効なタスクファイル形式です。');
        }
      } catch (err) {
        setError('タスクファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  }, [tasks, generateUniqueId, setTasksWithHistory, HORIZONTAL_SPACING, VERTICAL_SPACING]);

  const handleAutoLayout = useCallback(() => {
    const updatedTasks = tasks.map((task, index) => ({
      ...task,
      position: {
        x: 50 + (index % 3) * HORIZONTAL_SPACING,
        y: 50 + Math.floor(index / 3) * VERTICAL_SPACING,
      },
    }));
    setTasksWithHistory(updatedTasks);
  }, [tasks, setTasksWithHistory, HORIZONTAL_SPACING, VERTICAL_SPACING]);

  const handleUndo = useCallback(() => {
    const previousState = undo();
    if (previousState) {
      setTasks(previousState.tasks);
      setProjectGoal(previousState.projectGoal);
      setTargetDate(previousState.targetDate);
    }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const nextState = redo();
    if (nextState) {
      setTasks(nextState.tasks);
      setProjectGoal(nextState.projectGoal);
      setTargetDate(nextState.targetDate);
    }
  }, [redo]);

  const handleCustomReportGenerated = useCallback((deck: SlideDeck) => {
    setCustomReportDeck(deck);
  }, []);

  const handleSelectProject = useCallback(async (project: ProjectData) => {
    setIsLoadingProject(true);
    try {
      const projectWithMembers = await ProjectService.getProjectWithMembers(project.id);
      setCurrentProject(project);
      setProjectMembers(projectWithMembers.members || []);
      setProjectGoal(project.goal);
      setTargetDate(project.targetDate);
      setTasks(project.tasks);
      setGanttData(project.ganttData || null);
      setViewState(ViewState.PROJECT_FLOW);
      setShowProjectList(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'プロジェクトの読み込みに失敗しました');
    } finally {
      setIsLoadingProject(false);
    }
  }, []);

  const handleSaveProject = useCallback(async () => {
    if (!user) {
      throw new Error('ログインが必要です');
    }

    if (currentProject?.id) {
      // Update existing project
      const updatedProject = await ProjectService.updateProject(currentProject.id, {
        goal: projectGoal,
        targetDate,
        tasks,
        ganttData,
        expectedVersion: currentProject.version,
      });
      setCurrentProject(updatedProject);
    } else {
      // This case is handled in ProjectFlowDisplay
      throw new Error('新規プロジェクトの保存はProjectFlowDisplayで処理されます');
    }
  }, [user, currentProject, projectGoal, targetDate, tasks, ganttData]);

  // Show loading screen during auth initialization
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700">
        <LoadingSpinner size="lg" text="認証情報を確認中..." />
      </div>
    );
  }

  // Show auth modal if not logged in
  if (!user) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
            <h1 className="text-3xl font-bold text-slate-800 mb-4">AI Project Planner</h1>
            <p className="text-slate-600 mb-6">プロジェクト管理を始めるには、ログインまたはアカウントを作成してください。</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
            >
              ログイン / アカウント作成
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  // Show API key modal if not set
  if (!isApiKeySet) {
    return (
      <ApiKeyModal
        onSetApiKey={handleSetApiKey}
        error={error}
        isLoading={isLoading}
      />
    );
  }

  // Show project loading screen
  if (isLoadingProject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <LoadingSpinner size="lg" text="プロジェクトを読み込み中..." />
      </div>
    );
  }

  // Main application render
  return (
    <>
      {viewState === ViewState.INPUT_FORM && (
        <ProjectInputForm
          onSubmit={handleProjectSubmit}
          isLoading={isLoading}
          onImportProject={handleImportProject}
          onLoadTemplate={handleLoadTemplate}
          initialGoal={projectGoal}
          initialDate={targetDate}
          onOpenProjectList={() => setShowProjectList(true)}
          onLogout={handleLogout}
          user={user}
        />
      )}

      {viewState === ViewState.PROJECT_FLOW && (
        <ProjectFlowDisplay
          tasks={tasks}
          projectGoal={projectGoal}
          targetDate={targetDate}
          onSelectTask={handleSelectTask}
          onUpdateTaskExtendedDetails={handleUpdateTaskExtendedDetails}
          onUpdateTaskPosition={handleUpdateTaskPosition}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onStartNewProject={handleStartNewProject}
          onExportProject={handleExportProject}
          onAddTask={handleAddTask}
          onRemoveTask={handleRemoveTask}
          onImportSingleTask={handleImportSingleTask}
          onAutoLayout={handleAutoLayout}
          onUndo={handleUndo}
          canUndo={canUndo}
          onRedo={handleRedo}
          canRedo={canRedo}
          generateUniqueId={generateUniqueId}
          onUpdateTaskConnections={handleUpdateTaskConnections}
          ganttData={ganttData}
          setGanttData={setGanttData}
          onCustomReportGenerated={handleCustomReportGenerated}
          onClearApiKey={handleClearApiKey}
          onOpenProjectList={() => setShowProjectList(true)}
          onLogout={handleLogout}
          currentProjectId={currentProject?.id || null}
          onSaveProject={handleSaveProject}
          projectMembers={projectMembers}
          userRole={currentProject?.userRole || 'viewer'}
          onMembersUpdate={loadProjectMembers}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTaskExtendedDetails}
          generateUniqueId={generateUniqueId}
          projectGoal={projectGoal}
          targetDate={targetDate}
          canEdit={!currentProject || currentProject.userRole === 'owner' || currentProject.userRole === 'editor'}
        />
      )}

      {showProjectList && (
        <ProjectListModal
          isOpen={showProjectList}
          onClose={() => setShowProjectList(false)}
          onSelectProject={handleSelectProject}
          onCreateNew={handleStartNewProject}
        />
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50">
          <ErrorMessage message={error} />
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            閉じる
          </button>
        </div>
      )}
    </>
  );
};

export default App;