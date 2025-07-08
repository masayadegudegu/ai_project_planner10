
import React, { memo, useState, useRef, useEffect } from 'react';
import { ProjectTask, NumericalTargetStatus, TaskStatus } from '../types';
import { InfoIcon, TrashIcon, GaugeIcon, ClockIcon, CircleIcon, PlayCircleIcon, CheckCircleIcon as CompletedIcon, XCircleIcon } from './icons';

interface TaskCardProps {
  task: ProjectTask;
  onSelectTask: (task: ProjectTask) => void;
  onRemoveTask: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDragCardStart: (event: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  index: number;
  cardRef?: React.RefObject<HTMLDivElement>;
  onStartConnection: (taskId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onEndConnection: (taskId: string) => void;
  canEdit?: boolean;
}

const getStatusStyles = (status?: TaskStatus): { icon: JSX.Element, color: string, text: string, bgColor: string } => {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return { icon: <PlayCircleIcon className="w-3.5 h-3.5" />, color: 'text-blue-700', text: '進行中', bgColor: 'bg-blue-100' };
    case TaskStatus.COMPLETED:
      return { icon: <CompletedIcon className="w-3.5 h-3.5" />, color: 'text-green-700', text: '完了', bgColor: 'bg-green-100' };
    case TaskStatus.BLOCKED:
      return { icon: <XCircleIcon className="w-3.5 h-3.5" />, color: 'text-red-700', text: '停滞中', bgColor: 'bg-red-100' };
    case TaskStatus.NOT_STARTED:
    default:
      return { icon: <CircleIcon className="w-3.5 h-3.5" />, color: 'text-slate-600', text: '未着手', bgColor: 'bg-slate-100' };
  }
};


const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onSelectTask, 
  onRemoveTask, 
  onUpdateStatus,
  onDragCardStart,
  index,
  cardRef,
  onStartConnection,
  onEndConnection,
  canEdit = true,
}) => {
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusRef]);

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!canEdit) return;
    onUpdateStatus(task.id, newStatus);
    setIsStatusDropdownOpen(false);
  };
  
  const numericalTarget = task.extendedDetails?.numericalTarget;
  let targetColorClass = 'text-slate-500'; // Darker default
  if (numericalTarget) {
    if (numericalTarget.status === NumericalTargetStatus.ACHIEVED) targetColorClass = 'text-green-600';
    else if (numericalTarget.status === NumericalTargetStatus.MISSED) targetColorClass = 'text-red-600';
    else targetColorClass = 'text-yellow-600'; // PENDING
  }
  
  const statusInfo = getStatusStyles(task.status);
  const dueDate = task.extendedDetails?.dueDate;
  const formattedDueDate = dueDate ? new Date(dueDate + 'T00:00:00Z').toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : null;

  const isInProgress = task.status === TaskStatus.IN_PROGRESS;
  const cardBaseClasses = "task-card-in-flow bg-white rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 w-80 md:w-96 m-1 cursor-grab active:cursor-grabbing";
  const highlightClass = isInProgress ? "border-4 border-blue-500 ring-2 ring-blue-500 ring-offset-1" : "border border-transparent";

  const handleMouseDownOnConnector = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onStartConnection(task.id, event);
  };

  return (
    <div 
      ref={cardRef} 
      id={`taskcard-${task.id}`}
      draggable="true"
      onDragStart={(e) => onDragCardStart(e, task.id)}
      onMouseUp={() => onEndConnection(task.id)}
      className={`${cardBaseClasses} ${highlightClass}`}
      style={{ 
        position: 'absolute', 
        left: task.position?.x || 0, 
        top: task.position?.y || 0,
        touchAction: 'none', 
      }}
    >
      <div className="p-5 relative">
        <div 
            onMouseDown={handleMouseDownOnConnector}
            className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 border-2 border-white rounded-full cursor-crosshair hover:scale-125 transition-transform z-10"
            title="ドラッグして接続"
        />
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center flex-grow min-w-0 mr-2">
            <span className={`bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs mr-3 flex-shrink-0`}>{index + 1}</span>
            <div className="flex-grow min-w-0">
              <div
                className="text-lg font-bold text-slate-900 break-words"
                aria-label={`task title for ${task.title}`}
              >
                {task.title}
              </div>
            </div>
          </div>
          <div className="flex space-x-1 flex-shrink-0 items-center">
            {numericalTarget && (
              <GaugeIcon className={`w-5 h-5 ${targetColorClass}`} title={`数値目標: ${numericalTarget.description} (${numericalTarget.status})`} />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectTask(task);
              }}
              className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-100"
              title="詳細・計画編集"
              aria-label={`詳細・計画編集: ${task.title}`}
            >
              <InfoIcon className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!canEdit) return;
                onRemoveTask(task.id);
              }}
              disabled={!canEdit}
              className="text-red-500 hover:text-red-700 transition-colors p-1 rounded-full hover:bg-red-100"
              title={canEdit ? "タスクを削除" : "編集権限が必要です"}
              aria-label={`タスクを削除: ${task.title}`}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="h-20 mb-3">
          <p className="text-slate-800 text-sm leading-relaxed line-clamp-4 overflow-hidden h-full">
            {task.description}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <div className="relative" ref={statusRef}>
              <button
                onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                disabled={!canEdit}
                className={`inline-flex items-center px-2 py-0.5 rounded-full cursor-pointer ${statusInfo.bgColor} ${statusInfo.color} hover:ring-2 hover:ring-offset-1 hover:ring-blue-400 transition-all`}
                title={canEdit ? "ステータスを変更" : "編集権限が必要です"}
              >
                {React.cloneElement(statusInfo.icon, { className: `w-3 h-3 mr-1 ${statusInfo.color}` })}
                {statusInfo.text}
              </button>
              {isStatusDropdownOpen && canEdit && (
                <div className="absolute bottom-full mb-1 w-36 bg-white border border-slate-200 rounded-md shadow-lg z-20 py-1">
                  {Object.values(TaskStatus).map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 flex items-center"
                    >
                     {React.cloneElement(getStatusStyles(s).icon, { className: `w-3.5 h-3.5 mr-2 ${getStatusStyles(s).color}` })}
                      {getStatusStyles(s).text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formattedDueDate && (
                <div className="flex items-center text-orange-600">
                    <ClockIcon className="w-3.5 h-3.5 mr-1"/>
                    期日: {formattedDueDate}
                </div>
            )}
        </div>
      </div>
      
      <button
        onClick={(e) => {
            e.stopPropagation();
            onSelectTask(task);
        }}
        className="block w-full text-left bg-slate-100 hover:bg-slate-200 text-blue-700 font-medium py-3 px-5 transition-colors text-xs border-t border-slate-200"
      >
        {canEdit ? '詳細な計画・レポート・接続 →' : '詳細を表示 →'}
      </button>
    </div>
  );
};

export default memo(TaskCard);
