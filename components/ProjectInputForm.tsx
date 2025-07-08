import React, { useState, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { TargetIcon, CalendarIcon, UploadIcon, FolderIcon, KeyIcon } from './icons';

interface ProjectInputFormProps {
  onSubmit: (goal: string, date: string) => void;
  isLoading: boolean;
  onImportProject: (file: File) => void;
  onLoadTemplate: (templateName: 'process-design' | 'process-change' | 'new-product-eval' | 'improvement-project' | 'equipment-modification', goal: string, date: string) => void;
  initialGoal?: string;
  initialDate?: string;
  onOpenProjectList: () => void;
  onLogout: () => void;
  user: any;
}

type TemplateName = 'process-design' | 'process-change' | 'new-product-eval' | 'improvement-project' | 'equipment-modification';

const ProjectInputForm: React.FC<ProjectInputFormProps> = ({ 
  onSubmit, 
  isLoading, 
  onImportProject, 
  onLoadTemplate,
  initialGoal = '', 
  initialDate = '',
  onOpenProjectList,
  onLogout,
  user
}) => {
  const [goal, setGoal] = useState<string>(initialGoal);
  const [targetDate, setTargetDate] = useState<string>(initialDate);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setGoal(initialGoal);
  }, [initialGoal]);

  React.useEffect(() => {
    setTargetDate(initialDate);
  }, [initialDate]);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!goal.trim() || !targetDate) {
      alert('事業目的と目標日付を入力してください。');
      return;
    }
    onSubmit(goal, targetDate);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportProject(file);
      event.target.value = ''; // Reset file input
    }
  };

  const handleTemplateClick = (templateName: TemplateName) => {
    if (!goal.trim() || !targetDate) {
      alert('テンプレートから開始するには、まずプロジェクトの目的と目標の日付を入力してください。');
      return;
    }
    onLoadTemplate(templateName, goal, targetDate);
  };

  const TemplateButton: React.FC<{template: TemplateName, title: string, description: string, disabled: boolean}> = ({template, title, description, disabled}) => (
    <button
      type="button"
      onClick={() => handleTemplateClick(template)}
      disabled={disabled}
      className="text-left p-4 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105"
    >
        <div className="font-semibold text-md">{title}</div>
        <div className="text-xs text-purple-200 mt-1">{description}</div>
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      {/* ユーザー情報とログアウト */}
      <div className="w-full max-w-2xl mb-4 flex justify-between items-center">
        <div className="text-white text-sm">
          ログイン中: {user?.email}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenProjectList}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500"
          >
            <FolderIcon className="w-5 h-5" />
            保存済みプロジェクト
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            <KeyIcon className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white shadow-2xl rounded-xl p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-800 mb-3">AIプロジェクトプランナー</h1>
          <p className="text-slate-600 text-lg">あなたの目標達成をAIがお手伝いします。</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="projectGoal" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
              <TargetIcon className="w-5 h-5 mr-2 text-blue-600" />
              プロジェクトの目的 (最終形)
            </label>
            <textarea
              id="projectGoal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="例: 新しいEコマースサイトを立ち上げ、初年度売上1000万円を目指す"
              rows={3}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-base text-slate-100 placeholder-slate-400"
            />
          </div>

          <div>
            <label htmlFor="targetDate" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
              目標の日付
            </label>
            <input
              type="date"
              id="targetDate"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={today}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-base text-slate-100"
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <p className="text-sm text-slate-500 text-center">目的と日付を入力して計画を作成するか、テンプレートまたは既存の計画から開始します。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 flex items-center justify-center text-md"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" color="border-white" />
              ) : (
                'AIで計画を作成'
              )}
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-150 ease-in-out transform hover:scale-105 flex items-center justify-center text-md"
            >
              <UploadIcon className="w-5 h-5 mr-2" />
              計画をインポート (.json)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
              aria-hidden="true"
            />
          </div>
          <div className="sm:col-span-2 pt-4">
            <p className="text-center text-sm font-semibold text-slate-600 mb-3">または、テンプレートから開始:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
               <TemplateButton 
                template="process-design"
                disabled={isLoading}
                title="工程設計 (APQP)"
                description="新製品の工程をAPQPに基づき計画から量産まで設計します。"
              />
              <TemplateButton 
                template="process-change"
                disabled={isLoading}
                title="工程変更 (ISO/IATF)"
                description="既存工程の変更を影響分析、承認、検証を含めて管理します。"
              />
               <TemplateButton 
                template="new-product-eval"
                disabled={isLoading}
                title="新製品の設備評価"
                description="顧客要求に基づき、既存設備での実現可能性を評価・報告します。"
              />
              <TemplateButton 
                template="improvement-project"
                disabled={isLoading}
                title="生産性・コスト改善"
                description="DMAICフレームワークに基づき、既存プロセスの問題を解決し、改善します。"
              />
              <TemplateButton 
                template="equipment-modification"
                disabled={isLoading}
                title="社内設備改造"
                description="社内設備・治具の改造・改善を計画・実行・評価します。"
              />
            </div>
          </div>
        </form>
      </div>
       <footer className="mt-12 text-center">
        <p className="text-slate-400 text-sm">
          Powered by Gemini API & Supabase
        </p>
      </footer>
    </div>
  );
};

export default ProjectInputForm;