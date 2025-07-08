import React, { useState, useCallback, useEffect } from 'react';
import { 
  ProjectTask, 
  ViewState, 
  ProjectFileContent, 
  ExtendedTaskDetails,
  TaskStatus, 
  EditableExtendedTaskDetails,
  SubStep,
  Attachment,
  GanttItem,
  Decision,
  SlideDeck
} from './types';
import { generateProjectPlan, initializeGemini } from './services/geminiService';
import { ProjectService, ProjectData } from './services/projectService';
import { supabase } from './lib/supabase';
import ProjectInputForm from './components/ProjectInputForm';
import ProjectFlowDisplay from './components/ProjectFlowDisplay';
import TaskDetailModal from './components/TaskDetailModal';
import ErrorMessage from './components/ErrorMessage';
import AddTaskModal from './components/AddTaskModal';
import ConfirmNewProjectModal from './components/ConfirmNewProjectModal';
import SlideEditorView from './components/SlideEditorView';
import ApiKeyModal from './components/ApiKeyModal';
import AuthModal from './components/AuthModal';
import ProjectListModal from './components/ProjectListModal';

const defaultExtendedDetails: ExtendedTaskDetails = {
  subSteps: [],
  resources: '',
  responsible: '',
  notes: '',
  numericalTarget: undefined,
  dueDate: '',
  reportDeck: undefined,
  resourceMatrix: null,
  attachments: [],
  decisions: [],
  subStepCanvasSize: { width: 1200, height: 800 },
};

const getDefaultSubStepPosition = (index: number): { x: number; y: number } => ({
  x: 10, 
  y: index * 90 + 10, 
});

// --- Template Task Generators ---
const getProcessDesignTemplateTasks = (): ProjectTask[] => {
    const templateTasks: ProjectTask[] = [
        { id: 'apqp_1', title: "フェーズ1: 計画とプログラムの定義", description: "顧客の声を収集し、ビジネスプランと製品/プロセスベンチマークを定義する。設計・品質目標を設定。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['apqp_2'] },
        { id: 'apqp_2', title: "フェーズ2: 製品設計と開発", description: "DFMEA、製品仕様、図面を作成し、プロトタイプを製作・管理する。材料仕様とサプライヤーを確定。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['apqp_3'] },
        { id: 'apqp_3', title: "フェーズ3: 工程設計と開発", description: "製造工程フローチャート、PFMEA、コントロールプランを作成する。測定システム分析(MSA)計画を立案。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['apqp_4'] },
        { id: 'apqp_4', title: "フェーズ4: 製品と工程の妥当性確認", description: "トライアウト生産を実施し、MSAと初期工程能力調査(SPC)を行う。生産部品承認プロセス(PPAP)を完了。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['apqp_5'] },
        { id: 'apqp_5', title: "フェーズ5: フィードバック、評価、是正処置", description: "量産を開始し、ばらつきを低減させる。顧客満足度を評価し、継続的改善を実施する。", status: TaskStatus.NOT_STARTED, nextTaskIds: [] }
    ];
    return templateTasks.map(t => ({...t, extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }}));
};

const getProcessChangeTemplateTasks = (): ProjectTask[] => {
    const templateTasks: ProjectTask[] = [
        { id: 'change_1', title: "1. 変更要求と影響分析", description: "変更要求を特定し、品質、コスト、納期、安全性への影響を評価する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['change_2'] },
        { id: 'change_2', title: "2. 変更計画と承認", description: "詳細な変更計画（スケジュール、リソース、検証計画）を作成し、変更管理委員会(CCB)の承認を得る。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['change_3'] },
        { id: 'change_3', title: "3. 変更の実施と検証", description: "計画に基づき変更を実施。変更後のプロセスでトライアル生産を行い、結果を検証する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['change_4'] },
        { id: 'change_4', title: "4. 文書化とトレーニング", description: "FMEA、コントロールプラン、作業手順書等の関連文書をすべて更新し、関係者にトレーニングを実施する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['change_5'] },
        { id: 'change_5', title: "5. 変更のレビューとクローズ", description: "変更後のプロセスパフォーマンスを監視し、有効性をレビュー。問題がなければ変更をクローズする。", status: TaskStatus.NOT_STARTED, nextTaskIds: [] }
    ];
    return templateTasks.map(t => ({...t, extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }}));
};

const getNewProductEvaluationTemplateTasks = (): ProjectTask[] => {
    const templateTasks: ProjectTask[] = [
        { id: 'eval_1', title: "1. 顧客要求の分析", description: "顧客から提供された製品仕様、図面、品質要求、生産量を詳細に分析する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['eval_2'] },
        { id: 'eval_2', title: "2. 既存設備の能力評価 (ギャップ分析)", description: "要求仕様に対し、既存の設備・工程能力を評価し、ギャップ（治工具、精度、サイクルタイム等）を特定する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['eval_3'] },
        { id: 'eval_3', title: "3. 評価用トライアル計画の立案", description: "ギャップを埋めるための暫定対策を講じ、評価用トライアルの計画（材料、段取り、測定項目）を立案する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['eval_4'] },
        { id: 'eval_4', title: "4. 評価トライアルの実施とデータ収集", description: "計画に基づきトライアルを実施し、寸法、性能、外観等のデータを収集する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['eval_5'] },
        { id: 'eval_5', title: "5. 評価レポート作成と顧客への報告", description: "トライアル結果をまとめ、実現可能性、課題、推奨事項を記載したレポートを作成し、顧客に報告する。", status: TaskStatus.NOT_STARTED, nextTaskIds: [] }
    ];
    return templateTasks.map(t => ({...t, extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }}));
};

const getImprovementTemplateTasks = (): ProjectTask[] => {
    const templateTasks: ProjectTask[] = [
        { id: 'dmaic_1', title: "フェーズ1: 定義 (Define)", description: "プロジェクトの目的、範囲、目標を明確にし、現状の問題点とビジネスインパクトを特定する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['dmaic_2'] },
        { id: 'dmaic_2', title: "フェーズ2: 測定 (Measure)", description: "現状プロセスのパフォーマンスを測定するためのデータを収集し、KPIを設定してベースラインを確立する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['dmaic_3'] },
        { id: 'dmaic_3', title: "フェーズ3: 分析 (Analyze)", description: "収集データを分析し、問題の根本原因を特定する。特性要因図やパレート図などを活用。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['dmaic_4'] },
        { id: 'dmaic_4', title: "フェーズ4: 改善 (Improve)", description: "根本原因に対する解決策を立案・テストし、最も効果的な改善策をパイロット導入する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['dmaic_5'] },
        { id: 'dmaic_5', title: "フェーズ5: 管理 (Control)", description: "改善策を標準化し、効果をモニタリングする管理体制を構築する。成果を文書化し水平展開を検討。", status: TaskStatus.NOT_STARTED, nextTaskIds: [] }
    ];
    return templateTasks.map(t => ({...t, extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }}));
};

const getEquipmentModificationTemplateTasks = (): ProjectTask[] => {
    const templateTasks: ProjectTask[] = [
        { id: 'mod_1', title: "1. 改造計画の立案と承認", description: "改造の目的（生産性、安全性、品質向上など）、目標仕様、スコープを定義し、関連部署からの承認を得る。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['mod_2'] },
        { id: 'mod_2', title: "2. 改造設計と部品手配", description: "具体的な改造内容（機械、電気、ソフトウェア）を設計し、図面を作成する。必要な部品や材料を発注・手配する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['mod_3'] },
        { id: 'mod_3', title: "3. 設備改造の実施と初期トライアル", description: "安全手順に従い、設備の改造作業を実施する。改造後、初期の動作確認とトライアル運転を行う。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['mod_4'] },
        { id: 'mod_4', title: "4. パフォーマンス評価と安全性検証", description: "一定期間の連続運転を行い、生産性、品質、サイクルタイムなどのパフォーマンスを評価し、安全性を検証する。", status: TaskStatus.NOT_STARTED, nextTaskIds: ['mod_5'] },
        { id: 'mod_5', title: "5. 標準化とプロジェクト完了", description: "設備関連の図面、作業標準書、保全計画を更新する。関係者へのトレーニングを実施し、プロジェクトを完了させる。", status: TaskStatus.NOT_STARTED, nextTaskIds: [] }
    ];
    return templateTasks.map(t => ({...t, extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }}));
};
// --- End Template Task Generators ---

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [projectGoal, setProjectGoal] = useState<string>('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [ganttData, setGanttData] = useState<GanttItem[] | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [appError, setAppError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<ViewState>(ViewState.INPUT_FORM);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState<boolean>(false);

  const [history, setHistory] = useState<ProjectTask[][]>([]);
  const [redoHistory, setRedoHistory] = useState<ProjectTask[][]>([]);
  
  const [customReportDeck, setCustomReportDeck] = useState<SlideDeck | null>(null);

  // 認証状態の監視
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        // ログアウト時の処理
        setCurrentProjectId(null);
        setTasks([]);
        setProjectGoal('');
        setTargetDate('');
        setGanttData(null);
        setCurrentView(ViewState.INPUT_FORM);
      }
    });

    // 初期認証状態の確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const storedKey = sessionStorage.getItem('gemini-api-key');
    if (storedKey) {
      handleSetApiKey(storedKey);
    }
  }, []);

  const recordHistory = (currentTasks: ProjectTask[]) => {
    setHistory(prev => [...prev.slice(-10), currentTasks]); // Limit history size
    setRedoHistory([]);
  };

  const generateUniqueId = useCallback((prefix: string = 'id'): string => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, []);

  const downloadJson = (data: unknown, filename: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const readJsonFile = <T,>(file: File): Promise<T> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          if (typeof event.target?.result === 'string') {
            resolve(JSON.parse(event.target.result) as T);
          } else { reject(new Error('Failed to read file.')); }
        } catch (e) { reject(new Error(`Invalid JSON: ${(e as Error).message}`)); }
      };
      reader.onerror = () => reject(new Error('File read error.'));
      reader.readAsText(file);
    });
  };
  
  const autoLayoutTasks = useCallback((tasksToLayout: ProjectTask[]) => {
    if (tasksToLayout.length === 0) return tasksToLayout;

    const taskMap = new Map(tasksToLayout.map(task => [task.id, task]));
    const inDegree = new Map(tasksToLayout.map(task => [task.id, 0]));
    const adj = new Map<string, string[]>();

    tasksToLayout.forEach(task => {
        adj.set(task.id, []);
        (task.nextTaskIds || []).forEach(nextId => {
            if (taskMap.has(nextId)) {
                inDegree.set(nextId, (inDegree.get(nextId) || 0) + 1);
                adj.get(task.id)?.push(nextId);
            }
        });
    });

    const queue: string[] = tasksToLayout.filter(t => (inDegree.get(t.id) || 0) === 0).map(t => t.id);
    const tasksPerLevel: string[][] = [];
    let level = 0;
    const laidOutNodes = new Set<string>();

    while (queue.length > 0) {
        const levelSize = queue.length;
        tasksPerLevel[level] = [];
        for (let i = 0; i < levelSize; i++) {
            const u = queue.shift()!;
            laidOutNodes.add(u);
            tasksPerLevel[level].push(u);
            (adj.get(u) || []).forEach(v => {
                inDegree.set(v, (inDegree.get(v) || 0) - 1);
                if ((inDegree.get(v) || 0) === 0) queue.push(v);
            });
        }
        level++;
    }
    
    // Handle cycles: Add remaining nodes to a final level.
    const remainingNodes = tasksToLayout.filter(t => !laidOutNodes.has(t.id));
    if (remainingNodes.length > 0) {
        tasksPerLevel.push(remainingNodes.map(t => t.id));
    }
    
    const CARD_WIDTH = 380, HORIZONTAL_SPACING = 60, VERTICAL_SPACING = 50, CARD_HEIGHT = 280;
    const newPositions = new Map<string, { x: number; y: number }>();

    tasksPerLevel.forEach((tasksInLevel, lvlIdx) => {
        const levelHeight = tasksInLevel.length * CARD_HEIGHT + (tasksInLevel.length - 1) * VERTICAL_SPACING;
        const startY = Math.max(20, (500 - levelHeight) / 2);
        tasksInLevel.forEach((taskId, taskIdxInLevel) => {
            newPositions.set(taskId, {
                x: lvlIdx * (CARD_WIDTH + HORIZONTAL_SPACING) + 20,
                y: startY + taskIdxInLevel * (CARD_HEIGHT + VERTICAL_SPACING),
            });
        });
    });
    
    return tasksToLayout.map((task, index) => ({
        ...task,
        // Ensure ALL tasks get a position, even if something went wrong.
        position: newPositions.get(task.id) || task.position || { x: 20, y: 20 + index * 100 },
    }));
  }, []);

  const setTasksWithHistory = (newTasks: ProjectTask[] | ((prevTasks: ProjectTask[]) => ProjectTask[])) => {
    recordHistory(tasks);
    setTasks(newTasks);
  };
  
  const handleUndo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setRedoHistory(prev => [tasks, ...prev]);
      setTasks(previousState);
    }
  };

  const handleRedo = () => {
    if (redoHistory.length > 0) {
      const nextState = redoHistory[0];
      setRedoHistory(prev => prev.slice(1));
      setHistory(prev => [...prev, tasks]);
      setTasks(nextState);
    }
  };

  const handleSetApiKey = (key: string) => {
    if (!key.trim()) return;
    initializeGemini(key);
    sessionStorage.setItem('gemini-api-key', key);
    setApiKey(key);
    setAppError(null);
  };

  const handleClearApiKey = () => {
    sessionStorage.removeItem('gemini-api-key');
    setApiKey(null);
    initializeGemini(''); // De-initialize
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const saveCurrentProject = async () => {
    if (!user || !currentProjectId) return;

    try {
      await ProjectService.updateProject(currentProjectId, {
        tasks,
        ganttData,
      });
    } catch (error) {
      console.error('プロジェクトの自動保存に失敗しました:', error);
    }
  };

  // タスクが変更されたときに自動保存
  useEffect(() => {
    if (currentProjectId && tasks.length > 0) {
      const timeoutId = setTimeout(saveCurrentProject, 2000); // 2秒後に保存
      return () => clearTimeout(timeoutId);
    }
  }, [tasks, ganttData, currentProjectId]);

  const handleStartNewProject = () => {
    setProjectGoal('');
    setTargetDate('');
    setTasks([]);
    setGanttData(null);
    setCustomReportDeck(null);
    setCurrentProjectId(null);
    setCurrentView(ViewState.INPUT_FORM);
    setAppError(null);
    setHistory([]);
    setRedoHistory([]);
  };

  const handleExportProject = () => {
    const content: ProjectFileContent = { projectGoal, targetDate, tasks, ganttData };
    downloadJson(content, 'project-plan.json');
  };

  const handleImportProject = async (file: File) => {
    try {
      const content = await readJsonFile<ProjectFileContent>(file);
      if (content.projectGoal && content.targetDate && Array.isArray(content.tasks)) {
        setProjectGoal(content.projectGoal);
        setTargetDate(content.targetDate);
        setTasks(content.tasks.map(t => ({
            ...t,
            extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }
        })));
        setGanttData(content.ganttData || null);
        setCustomReportDeck(null);
        setCurrentProjectId(null); // JSONインポートは新規プロジェクト扱い
        setCurrentView(ViewState.PROJECT_FLOW);
        setHistory([]);
        setRedoHistory([]);
      } else { throw new Error('Invalid project file format.'); }
    } catch (e) { 
        const errorMessage = (e as Error).message;
        setAppError(errorMessage);
        if (errorMessage.toLowerCase().includes('api key')) {
            handleClearApiKey();
        }
    }
  };

  const handleSelectProject = (project: ProjectData) => {
    setProjectGoal(project.goal);
    setTargetDate(project.targetDate);
    setTasks(project.tasks.map(t => ({
      ...t,
      extendedDetails: { ...defaultExtendedDetails, ...(t.extendedDetails || {}) }
    })));
    setGanttData(project.ganttData || null);
    setCurrentProjectId(project.id);
    setCustomReportDeck(null);
    setCurrentView(ViewState.PROJECT_FLOW);
    setHistory([]);
    setRedoHistory([]);
    setIsProjectListOpen(false);
  };

  const handleCreateNewProject = () => {
    setIsProjectListOpen(false);
    handleStartNewProject();
  };
  
  const handleAddTaskFromModal = ({ title, description }: { title: string; description: string }) => {
    const newTask: ProjectTask = {
      id: generateUniqueId('task'),
      title,
      description,
      extendedDetails: defaultExtendedDetails,
      status: TaskStatus.NOT_STARTED,
      position: { x: 20, y: 20 }
    };
    setTasksWithHistory(prev => autoLayoutTasks([...prev, newTask]));
    setIsAddTaskModalOpen(false);
  };

  const handleRemoveTask = (taskId: string) => {
    setTasksWithHistory(prevTasks => prevTasks
        .filter(t => t.id !== taskId)
        .map(t => ({...t, nextTaskIds: (t.nextTaskIds || []).filter(id => id !== taskId)}))
    );
  };

  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus) => {
    setTasksWithHistory(prevTasks =>
        prevTasks.map(t => t.id === taskId ? { ...t, status } : t)
    );
  };
  
  const handleUpdateTaskConnections = (sourceTaskId: string, nextTaskIds: string[]) => {
      setTasksWithHistory(prev => prev.map(t => t.id === sourceTaskId ? {...t, nextTaskIds} : t));
  };
  
  const handleUpdateTaskPosition = (taskId: string, position: { x: number; y: number }) => {
    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === taskId ? { ...t, position } : t))
    );
  };

  const handleUpdateTaskCoreInfo = (taskId: string, updates: { title: string; description: string; status: TaskStatus }) => {
    setTasksWithHistory(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, ...updates } : t));
  };
  
  const handleUpdateTaskExtendedDetails = (taskId: string, details: EditableExtendedTaskDetails) => {
      setTasksWithHistory(prevTasks =>
          prevTasks.map(t => (t.id === taskId ? { ...t, extendedDetails: details } : t))
      );
  };

  const handleLoadTemplate = (templateName: string, goal: string, date: string) => {
    let templateTasks: ProjectTask[] = [];
    switch(templateName) {
      case 'process-design': templateTasks = getProcessDesignTemplateTasks(); break;
      case 'process-change': templateTasks = getProcessChangeTemplateTasks(); break;
      case 'new-product-eval': templateTasks = getNewProductEvaluationTemplateTasks(); break;
      case 'improvement-project': templateTasks = getImprovementTemplateTasks(); break;
      case 'equipment-modification': templateTasks = getEquipmentModificationTemplateTasks(); break;
    }
    setProjectGoal(goal);
    setTargetDate(date);
    setTasks(autoLayoutTasks(templateTasks));
    setGanttData(null);
    setCustomReportDeck(null);
    setCurrentProjectId(null); // テンプレートは新規プロジェクト扱い
    setCurrentView(ViewState.PROJECT_FLOW);
    setHistory([]);
    setRedoHistory([]);
    setAppError(null);
  };

  const handleSubmit = async (goal: string, date: string) => {
    setIsLoadingPlan(true);
    setAppError(null);
    try {
      setProjectGoal(goal);
      setTargetDate(date);
      const initialTasks = await generateProjectPlan(goal, date);
      const layoutedTasks = autoLayoutTasks(initialTasks.map(t => ({...t, extendedDetails: defaultExtendedDetails, status: TaskStatus.NOT_STARTED })));
      setTasks(layoutedTasks);
      setGanttData(null);
      setCustomReportDeck(null);
      setCurrentProjectId(null); // AI生成は新規プロジェクト扱い
      setCurrentView(ViewState.PROJECT_FLOW);
      setHistory([]);
      setRedoHistory([]);

      // ユーザーがログインしている場合、自動的にプロジェクトを保存
      if (user) {
        try {
          const project = await ProjectService.createProject(
            `AI生成プロジェクト - ${new Date().toLocaleDateString('ja-JP')}`,
            goal,
            date,
            layoutedTasks
          );
          setCurrentProjectId(project.id);
        } catch (error) {
          console.error('プロジェクトの自動保存に失敗しました:', error);
        }
      }
    } catch (e) {
      const errorMessage = (e as Error).message;
      if (errorMessage.toLowerCase().includes('api key')) {
        handleClearApiKey();
      }
      setAppError(errorMessage);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleSelectTask = (task: ProjectTask) => {
    setSelectedTask(task);
    setCurrentView(ViewState.TASK_DETAIL);
  };

  const handleCloseTaskDetail = () => {
    setSelectedTask(null);
    setCurrentView(ViewState.PROJECT_FLOW);
  };

  const handleCustomReportGenerated = (deck: SlideDeck) => {
    setCustomReportDeck(deck);
  };

  const renderContent = () => {
    if (!user) {
      return <AuthModal isOpen={true} onClose={() => {}} onSuccess={() => setIsAuthModalOpen(false)} />;
    }

    if (!apiKey) {
      return <ApiKeyModal onSetApiKey={handleSetApiKey} error={appError} />;
    }

    if (appError) {
      return (
        <div className="p-4">
          <ErrorMessage message={appError} />
          <button onClick={() => { setAppError(null); if (!apiKey) { handleClearApiKey() } else { setCurrentView(ViewState.INPUT_FORM) } }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            最初に戻る
          </button>
        </div>
      );
    }

    switch (currentView) {
      case ViewState.PROJECT_FLOW:
        return (
          <ProjectFlowDisplay
            tasks={tasks}
            projectGoal={projectGoal}
            targetDate={targetDate}
            onSelectTask={handleSelectTask}
            onUpdateTaskExtendedDetails={() => {}} // This is handled by opening the modal
            onUpdateTaskPosition={handleUpdateTaskPosition}
            onStartNewProject={handleStartNewProject}
            onExportProject={handleExportProject}
            onAddTask={() => setIsAddTaskModalOpen(true)}
            onRemoveTask={handleRemoveTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onImportSingleTask={() => {}} // Placeholder for now
            onAutoLayout={() => setTasksWithHistory(prev => autoLayoutTasks([...prev]))}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            onRedo={handleRedo}
            canRedo={redoHistory.length > 0}
            generateUniqueId={generateUniqueId}
            onUpdateTaskConnections={handleUpdateTaskConnections}
            ganttData={ganttData}
            setGanttData={setGanttData}
            onCustomReportGenerated={handleCustomReportGenerated}
            onClearApiKey={handleClearApiKey}
            onOpenProjectList={() => setIsProjectListOpen(true)}
            onLogout={handleLogout}
            currentProjectId={currentProjectId}
            onSaveProject={saveCurrentProject}
          />
        );
      case ViewState.TASK_DETAIL:
        return (
            selectedTask && <TaskDetailModal
              task={selectedTask}
              onClose={handleCloseTaskDetail}
              onUpdateTaskCoreInfo={handleUpdateTaskCoreInfo}
              onUpdateExtendedDetails={handleUpdateTaskExtendedDetails}
              generateUniqueId={generateUniqueId}
              projectGoal={projectGoal}
              targetDate={targetDate}
            />
        );
      case ViewState.INPUT_FORM:
      default:
        return (
          <ProjectInputForm
            onSubmit={handleSubmit}
            isLoading={isLoadingPlan}
            onImportProject={handleImportProject}
            onLoadTemplate={handleLoadTemplate}
            initialGoal={projectGoal}
            initialDate={targetDate}
            onOpenProjectList={() => setIsProjectListOpen(true)}
            onLogout={handleLogout}
            user={user}
          />
        );
    }
  };

  return (
    <div className="h-full w-full">
      {renderContent()}
      {isAddTaskModalOpen && (
        <AddTaskModal
          onClose={() => setIsAddTaskModalOpen(false)}
          onSubmit={handleAddTaskFromModal}
        />
      )}
      {isProjectListOpen && (
        <ProjectListModal
          isOpen={isProjectListOpen}
          onClose={() => setIsProjectListOpen(false)}
          onSelectProject={handleSelectProject}
          onCreateNew={handleCreateNewProject}
        />
      )}
      {customReportDeck && (
         <SlideEditorView
            tasks={tasks}
            initialDeck={customReportDeck}
            onSave={(deck) => setCustomReportDeck(deck)}
            onClose={() => setCustomReportDeck(null)}
            projectGoal={projectGoal}
            targetDate={targetDate}
            reportScope="project"
            generateUniqueId={generateUniqueId}
         />
      )}
    </div>
  );
};

export default App;