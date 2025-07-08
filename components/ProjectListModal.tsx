import React, { useState, useEffect } from 'react';
import { ProjectService, ProjectData } from '../services/projectService';
import { XIcon, PlusIcon, TrashIcon, CalendarIcon, TargetIcon, DownloadIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface ProjectListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: ProjectData) => void;
  onCreateNew: () => void;
}

const ProjectListModal: React.FC<ProjectListModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onCreateNew,
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const projectList = await ProjectService.getProjects();
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクトの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('このプロジェクトを削除しますか？この操作は取り消せません。')) {
      return;
    }

    try {
      await ProjectService.deleteProject(projectId);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクトの削除に失敗しました');
    }
  };

  const downloadJson = (project: ProjectData) => {
    const content = {
      projectGoal: project.goal,
      targetDate: project.targetDate,
      tasks: project.tasks,
      ganttData: project.ganttData,
    };
    const jsonString = JSON.stringify(content, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">プロジェクト一覧</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <PlusIcon className="w-5 h-5" />
              新規作成
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
            >
              <XIcon className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="flex-grow p-6 overflow-y-auto">
          {error && <ErrorMessage message={error} />}
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" text="プロジェクトを読み込み中..." />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg mb-4">プロジェクトがありません</p>
              <button
                onClick={onCreateNew}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
              >
                <PlusIcon className="w-5 h-5" />
                最初のプロジェクトを作成
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project)}
                  className="bg-slate-50 rounded-lg p-4 cursor-pointer hover:bg-slate-100 transition-colors border border-slate-200 hover:border-blue-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-slate-800 truncate flex-grow">
                      {project.title}
                    </h4>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadJson(project);
                        }}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded"
                        title="JSONでダウンロード"
                      >
                        <DownloadIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="p-1 text-slate-500 hover:text-red-600 rounded"
                        title="削除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-slate-600">
                    <p className="flex items-start">
                      <TargetIcon className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{project.goal}</span>
                    </p>
                    <p className="flex items-center">
                      <CalendarIcon className="w-4 h-4 mr-2 text-blue-600 flex-shrink-0" />
                      {new Date(project.targetDate + 'T00:00:00Z').toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-slate-500">
                      タスク数: {project.tasks.length} | 
                      更新: {new Date(project.updatedAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectListModal;