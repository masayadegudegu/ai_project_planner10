import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import * as htmlToImage from 'html-to-image';
import { GanttItem } from '../types';
import { XIcon, RefreshIcon, ChevronDownIcon, CheckSquareIcon, SquareIcon, DownloadIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface GanttChartViewProps {
  data: GanttItem[];
  onClose: () => void;
  onItemClick?: (item: GanttItem) => void;
  onRegenerate: () => Promise<void>;
  isRegenerating: boolean;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 64;
const TASK_LIST_WIDTH = 320;
const TASK_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#6B7280', '#6366F1', '#EC4899', '#8B5CF6'];
type ZoomLevel = 'day' | 'week' | 'month';

const GanttChartView: React.FC<GanttChartViewProps> = ({ data, onClose, onItemClick, onRegenerate, isRegenerating }) => {
  const [showDependencies, setShowDependencies] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [actionFilter, setActionFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const ganttContentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const dayWidths: Record<ZoomLevel, number> = { day: 40, week: 15, month: 5 };
  const dayWidth = dayWidths[zoomLevel];

  const taskColorMap = useMemo(() => {
    const map = new Map<string, string>();
    data.filter(i => i.type === 'task').forEach((task, index) => {
        map.set(task.id, TASK_COLORS[index % TASK_COLORS.length]);
    });
    return map;
  }, [data]);

  const getRootTaskId = useCallback((item: GanttItem, dataMap: Map<string, GanttItem>): string | null => {
      if (item.type === 'task') return item.id;
      let current = item;
      while (current.parentId) {
          const parent = dataMap.get(current.parentId);
          if (!parent) return null;
          if (parent.type === 'task') return parent.id;
          current = parent;
      }
      return null;
  }, []);

  const dataMap = useMemo(() => new Map(data.map(item => [item.id, item])), [data]);

  const getItemColor = useCallback((item: GanttItem): string => {
      const rootId = getRootTaskId(item, dataMap);
      return rootId ? taskColorMap.get(rootId) || '#9CA3AF' : '#9CA3AF';
  }, [dataMap, taskColorMap, getRootTaskId]);


  useEffect(() => {
    const taskIds = new Set(data.filter(item => item.type === 'task').map(item => item.id));
    setExpandedItems(taskIds);
  }, [data]);
  
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const visibleItems = useMemo(() => {
    const visible: GanttItem[] = [];
    const tasks = data.filter(item => item.type === 'task');
    tasks.forEach(task => {
        visible.push(task);
        if (expandedItems.has(task.id)) {
            const subSteps = data.filter(item => item.type === 'substep' && item.parentId === task.id);
            subSteps.forEach(subStep => {
                visible.push(subStep);
                if (expandedItems.has(subStep.id)) {
                    const actionItems = data.filter(item => {
                       if (item.type !== 'actionitem' || item.parentId !== subStep.id) return false;
                       if (actionFilter === 'all') return true;
                       const isCompleted = item.progress === 100;
                       if (actionFilter === 'completed') return isCompleted;
                       if (actionFilter === 'pending') return !isCompleted;
                       return true;
                    });
                    visible.push(...actionItems);
                }
            });
        }
    });
    return visible;
  }, [data, expandedItems, actionFilter]);

  const { timelineStart, totalDays } = useMemo(() => {
    if (data.length === 0) {
      const today = new Date();
      return { timelineStart: today, totalDays: 30 };
    }
    const startDates = data.map(d => new Date(d.start)).filter(d => !isNaN(d.getTime()));
    const endDates = data.map(d => new Date(d.end)).filter(d => !isNaN(d.getTime()));

    let projectMinDate: Date, projectMaxDate: Date;

    if (startDates.length === 0 || endDates.length === 0) {
        projectMinDate = new Date();
        projectMaxDate = new Date();
        projectMaxDate.setMonth(projectMaxDate.getMonth() + 1);
    } else {
        projectMinDate = new Date(Math.min(...startDates.map(d => d.getTime())));
        projectMaxDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    }
    
    let viewStartDate = dateRange.start ? new Date(dateRange.start) : projectMinDate;
    let viewEndDate = dateRange.end ? new Date(dateRange.end) : projectMaxDate;

    if (isNaN(viewStartDate.getTime())) viewStartDate = projectMinDate;
    if (isNaN(viewEndDate.getTime())) viewEndDate = projectMaxDate;
    if (viewEndDate < viewStartDate) viewEndDate = viewStartDate;

    viewStartDate.setDate(viewStartDate.getDate() - 2);
    viewEndDate.setDate(viewEndDate.getDate() + 5);

    const totalDaysValue = (viewEndDate.getTime() - viewStartDate.getTime()) / (1000 * 3600 * 24);
    return { timelineStart: viewStartDate, totalDays: Math.ceil(totalDaysValue) };
  }, [data, dateRange]);

  const timelineHeaders = useMemo(() => {
    const getWeekNumber = (d: Date) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    }

    const headers: { label: string, secondaryLabel?: string, width: number }[] = [];
    let currentDate = new Date(timelineStart);
    
    if (zoomLevel === 'day') {
        for (let i = 0; i < totalDays; i++) {
            headers.push({
                secondaryLabel: currentDate.toLocaleDateString('ja-JP', { weekday: 'short' }),
                label: String(currentDate.getDate()),
                width: dayWidth
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (zoomLevel === 'week') {
        for (let i = 0; i < totalDays; i++) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 1 || headers.length === 0) { // Monday or first day
                headers.push({
                    label: `W${getWeekNumber(currentDate)}`,
                    secondaryLabel: currentDate.toLocaleDateString('ja-JP', { month: 'short' }),
                    width: 0
                });
            }
            headers[headers.length - 1].width += dayWidth;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    } else if (zoomLevel === 'month') {
        let currentMonth = -1;
        for (let i = 0; i < totalDays; i++) {
            const month = currentDate.getMonth();
            if (month !== currentMonth) {
                currentMonth = month;
                headers.push({
                    label: currentDate.toLocaleDateString('ja-JP', { month: 'long', year: 'numeric' }),
                    width: 0
                });
            }
            headers[headers.length - 1].width += dayWidth;
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    return headers;
  }, [timelineStart, totalDays, zoomLevel, dayWidth]);

  const getDaysFromStart = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return -1;
    const timeDiff = date.getTime() - timelineStart.getTime();
    return timeDiff / (1000 * 3600 * 24);
  };
  
  const getLeftPadding = (type: GanttItem['type']) => {
    switch (type) {
        case 'substep': return 'pl-5';
        case 'actionitem': return 'pl-9';
        default: return 'pl-1';
    }
  };

  const hasChildren = (itemId: string) => data.some(item => item.parentId === itemId);

  const handleDownloadPng = useCallback(() => {
    if (ganttContentRef.current === null) {
        alert('チャート要素が見つかりません。');
        return;
    }
    setIsDownloading(true);

    htmlToImage.toPng(ganttContentRef.current, { 
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: ganttContentRef.current.scrollWidth,
        height: ganttContentRef.current.scrollHeight,
    })
    .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = 'gantt-chart.png';
        link.href = dataUrl;
        link.click();
    })
    .catch((err) => {
        console.error('ガントチャートのダウンロードに失敗しました。', err);
        alert('画像のダウンロードに失敗しました。コンソールログを確認してください。');
    })
    .finally(() => {
        setIsDownloading(false);
    });
  }, []);

  const totalTimelineWidth = useMemo(() => timelineHeaders.reduce((sum, h) => sum + h.width, 0), [timelineHeaders]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex flex-col p-4 z-[80]">
      <div className="bg-white rounded-xl shadow-2xl w-full h-full flex flex-col">
        <header className="flex-shrink-0 flex flex-wrap items-center justify-between p-4 border-b gap-4">
          <h2 className="text-xl font-bold text-slate-800">ガントチャート</h2>
          <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">表示単位:</span>
                <div className="flex items-center rounded-md bg-slate-100 p-1">
                    {(['day', 'week', 'month'] as ZoomLevel[]).map(level => (
                        <button key={level} onClick={() => setZoomLevel(level)} className={`px-3 py-1 text-xs capitalize rounded-md ${zoomLevel === level ? 'bg-white shadow-sm font-semibold text-blue-600' : ''}`}>{level}</button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">表示範囲:</span>
                <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="p-1 border rounded-md text-sm"/>
                <span>-</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="p-1 border rounded-md text-sm"/>
                <button onClick={() => setDateRange({start: '', end: ''})} className="text-xs px-2 py-1 bg-slate-200 rounded-md hover:bg-slate-300">リセット</button>
            </div>
            
            <button
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400"
            >
                {isDownloading ? <LoadingSpinner size="sm" color="border-white" /> : <DownloadIcon className="w-4 h-4" />}
                PNG
            </button>
            <button onClick={onClose} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">
                <XIcon className="w-5 h-5"/>
                閉じる
            </button>
          </div>
        </header>
        <div className="flex-shrink-0 p-4 border-b flex items-center justify-between">
           <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
                <button onClick={() => setActionFilter('all')} className={`px-3 py-1 text-xs rounded-full ${actionFilter === 'all' ? 'bg-white shadow-sm' : ''}`}>すべて</button>
                <button onClick={() => setActionFilter('pending')} className={`px-3 py-1 text-xs rounded-full ${actionFilter === 'pending' ? 'bg-white shadow-sm' : ''}`}>未完了</button>
                <button onClick={() => setActionFilter('completed')} className={`px-3 py-1 text-xs rounded-full ${actionFilter === 'completed' ? 'bg-white shadow-sm' : ''}`}>完了</button>
            </div>
             <div className="flex items-center gap-4">
                 <button
                    onClick={onRegenerate}
                    disabled={isRegenerating}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400"
                >
                    {isRegenerating ? <LoadingSpinner size="sm" color="border-white" /> : <RefreshIcon className="w-4 h-4" />}
                    AIで再生成
                </button>
                 <label className="flex items-center text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={showDependencies} onChange={() => setShowDependencies(p => !p)} className="w-4 h-4 mr-2 accent-blue-600" />
                  依存関係
                </label>
             </div>
        </div>
        <div className="flex-grow overflow-auto relative">
            <div ref={ganttContentRef} className="grid" style={{
                gridTemplateColumns: `${TASK_LIST_WIDTH}px 1fr`,
                width: `${TASK_LIST_WIDTH + totalTimelineWidth}px`,
            }}>
                {/* Headers */}
                <div className="sticky top-0 left-0 z-30 flex items-center p-2 font-semibold text-sm border-b border-r bg-slate-100 text-slate-800" style={{gridColumn: 1, gridRow: 1, height: HEADER_HEIGHT}}>タスク / サブステップ</div>
                <div className="sticky top-0 z-20 border-b bg-slate-50" style={{gridColumn: 2, gridRow: 1, height: HEADER_HEIGHT}}>
                     <div className="flex h-full">
                        {timelineHeaders.map((header, i) => (
                            <div key={i} className="border-r text-center text-[10px] flex flex-col items-center justify-center" style={{width: header.width}}>
                                {header.secondaryLabel && <span className="font-semibold text-slate-600">{header.secondaryLabel}</span>}
                                <div className={`font-bold text-slate-800 ${zoomLevel === 'day' ? 'text-lg' : 'text-sm'}`}>{header.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Background Grid Lines */}
                <div className="pointer-events-none flex" style={{ gridColumn: 2, gridRow: `2 / span ${visibleItems.length}` }}>
                   {timelineHeaders.map((header, i) => (
                        <div key={i} className="h-full border-r border-slate-200" style={{ width: header.width }}></div>
                    ))}
                </div>


                {/* Data Rows */}
                {visibleItems.map((item, index) => {
                    const itemColor = getItemColor(item);
                    const isLastItemOfGroup = (() => {
                        const nextItem = visibleItems[index + 1];
                        if (!nextItem) return true;
                        return getRootTaskId(item, dataMap) !== getRootTaskId(nextItem, dataMap);
                    })();

                    const startDays = getDaysFromStart(item.start);
                    const durationDays = Math.max(0.2, getDaysFromStart(item.end) - startDays + 1);
                    const barLeft = startDays * dayWidth;
                    const barWidth = durationDays * dayWidth;

                    const barStyles = {
                        task: { height: '24px' },
                        substep: { height: '20px' },
                        actionitem: { height: '8px' }
                    };

                    return (
                        <React.Fragment key={item.id}>
                            {/* Task List Cell */}
                            <div className="sticky left-0 z-10 flex items-center border-r bg-slate-50"
                                style={{
                                    gridColumn: 1, gridRow: index + 2, height: ROW_HEIGHT,
                                    borderBottom: isLastItemOfGroup ? `2px solid ${itemColor}` : '1px solid #e5e7eb',
                                }}>
                                <div className="w-1 h-full flex-shrink-0" style={{ backgroundColor: itemColor }}></div>
                                <div className={`flex items-center w-full ${getLeftPadding(item.type)}`}>
                                    {(item.type === 'task' || item.type === 'substep') && (
                                        hasChildren(item.id) ? (
                                        <ChevronDownIcon onClick={() => toggleExpand(item.id)} className={`w-4 h-4 mr-1 text-slate-500 cursor-pointer transition-transform ${expandedItems.has(item.id) ? 'rotate-0' : '-rotate-90'}`} />
                                        ) : <div className="w-4 h-4 mr-1"></div>
                                    )}
                                    {item.type === 'actionitem' && (item.progress === 100 ? <CheckSquareIcon className="w-3.5 h-3.5 text-green-600 mr-2 flex-shrink-0" /> : <SquareIcon className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />)}
                                    <span onClick={() => onItemClick?.(item)} className={`truncate text-xs ${item.type === 'task' ? 'font-semibold text-slate-800' : 'text-slate-600'} ${onItemClick ? 'cursor-pointer hover:text-blue-600' : ''}`} title={item.name}>
                                        {item.name}
                                    </span>
                                </div>
                            </div>
                            {/* Timeline Cell */}
                            <div className="relative" style={{ gridColumn: 2, gridRow: index + 2, borderBottom: isLastItemOfGroup ? `2px solid ${itemColor}` : '1px solid #e5e7eb' }}>
                               {startDays >= 0 && (
                                  <div
                                    title={`${item.name} (${item.progress}%)`}
                                    onClick={() => onItemClick?.(item)}
                                    className="absolute h-full flex items-center group"
                                    style={{ left: barLeft, width: barWidth, cursor: onItemClick ? 'pointer' : 'default' }}
                                  >
                                    <div className="w-full rounded" style={{...barStyles[item.type], backgroundColor: itemColor}}>
                                        <div className="bg-black bg-opacity-30 h-full rounded" style={{width: `${item.progress}%`}} />
                                    </div>
                                  </div>
                                )}
                            </div>
                        </React.Fragment>
                    )
                })}
                
                {/* Dependency Lines Wrapper */}
                <div style={{
                    gridColumn: 2,
                    gridRow: `2 / span ${visibleItems.length}`,
                    position: 'relative',
                    pointerEvents: 'none'
                }}>
                  {showDependencies && <DependencyLines items={visibleItems} getDaysFromStart={getDaysFromStart} dayWidth={dayWidth} />}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const DependencyLines: React.FC<{ items: GanttItem[], getDaysFromStart: (date: string) => number, dayWidth: number }> = ({ items, getDaysFromStart, dayWidth }) => {
    const lines = useMemo(() => {
        const newLines: { key: string, d: string }[] = [];
        const itemIndexMap = new Map<string, number>(items.map((item, index) => [item.id, index]));

        items.forEach((item, index) => {
            (item.dependencies || []).forEach(depId => {
                const fromIndex = itemIndexMap.get(depId);
                const fromItem = fromIndex !== undefined ? items[fromIndex] : undefined;

                if (fromItem && fromIndex !== undefined) {
                    const fromEndDays = getDaysFromStart(fromItem.end);
                    const toStartDays = getDaysFromStart(item.start);

                    if (fromEndDays < 0 || toStartDays < 0) return;
                    
                    const fromX = (fromEndDays + 1) * dayWidth;
                    const fromY = fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const toX = toStartDays * dayWidth;
                    const toY = index * ROW_HEIGHT + ROW_HEIGHT / 2;
                    
                    const midX1 = fromX + 20;
                    const midX2 = toX - 20;

                    const d = `M ${fromX} ${fromY} C ${midX1} ${fromY}, ${midX2} ${toY}, ${toX} ${toY}`;
                    newLines.push({ key: `${depId}-${item.id}`, d });
                }
            });
        });
        return newLines;
    }, [items, getDaysFromStart, dayWidth]);

    return (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" overflow="visible">
            <defs>
                <marker id="gantt_arrowhead" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto">
                    <polygon points="0 0, 5 2, 0 4" fill="#4b5563" />
                </marker>
            </defs>
            {lines.map(line => (
                <path key={line.key} d={line.d} stroke="#4b5563" strokeWidth="1" fill="none" markerEnd="url(#gantt_arrowhead)"/>
            ))}
        </svg>
    );
};

export default GanttChartView;
