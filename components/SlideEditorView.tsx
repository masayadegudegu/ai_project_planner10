
import React, { useState, useEffect, useCallback, useRef, ChangeEvent, useMemo } from 'react';
import { ProjectTask, SlideDeck, Slide, SlideElement, TextboxElement, ChartElement, ChartType, SubStep, ActionItem, ImageElement, TableElement, FlowchartElement, SubStepStatus } from '../types';
import { XIcon, PrinterIcon, LightBulbIcon, DownloadIcon, RefreshIcon, LockClosedIcon, LockOpenIcon } from './icons';
import { regenerateSlideDeck, optimizeSlideLayout, regenerateProjectReportDeck } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import FlowConnector from './FlowConnector';

// --- Chart Rendering Components ---
const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
};

const PieChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full text-xs text-slate-500">No data to display</div>;
    
    let cumulativePercent = 0;
    const colors = ['#4a90e2', '#50e3c2', '#f5a623', '#f8e71c', '#7ed321', '#9013fe'];
    
    const slices = data.map((d, i) => {
        const percent = d.value / total;
        const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
        cumulativePercent += percent;
        const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        
        const pathData = [
            `M ${startX} ${startY}`, // Move
            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
            `L 0 0`, // Line to center
        ].join(' ');

        return { path: pathData, color: colors[i % colors.length], label: d.label };
    });

    return (
        <div className="w-full h-full flex flex-col bg-white p-2">
            <text x="50%" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#333" className="block text-center">{title}</text>
            <div className="flex-grow flex items-center">
                <svg viewBox="-1 -1 2 2" className="w-2/3 h-full">
                    {slices.map((slice, i) => <path key={i} d={slice.path} fill={slice.color} />)}
                </svg>
                <div className="w-1/3 text-[8px] space-y-1">
                    {slices.map((slice, i) => (
                        <div key={i} className="flex items-center">
                            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: slice.color }}></span>
                            <span className="truncate">{slice.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const LineChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const width = 300, height = 150, margin = { top: 20, right: 10, bottom: 30, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * chartWidth;
        const y = chartHeight - (d.value / maxValue) * chartHeight;
        return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-white">
        <text x={width / 2} y={margin.top / 2 + 5} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#333">{title}</text>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#ddd" strokeWidth="0.5" />
          <line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#ddd" strokeWidth="0.5" />
          <polyline fill="none" stroke="#4a90e2" strokeWidth="1.5" points={points} />
          {data.map((d, i) => {
            const x = (i / (data.length - 1)) * chartWidth;
            const y = chartHeight - (d.value / maxValue) * chartHeight;
            return <circle key={i} cx={x} cy={y} r="2" fill="#4a90e2" />;
          })}
        </g>
      </svg>
    );
}

const BarChart: React.FC<{ data: { label: string; value: number }[], title: string }> = ({ data, title }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const width = 300, height = 150, margin = { top: 20, right: 10, bottom: 30, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const barWidth = data.length > 0 ? chartWidth / data.length * 0.8 : 0;
  
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full bg-white">
        <text x={width / 2} y={margin.top / 2 + 5} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#333">{title}</text>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <line x1="0" y1="0" x2="0" y2={chartHeight} stroke="#999" strokeWidth="0.5" />
          {[0, maxValue / 2, maxValue].map(tick => (
             <g key={tick} transform={`translate(0, ${chartHeight - (tick / maxValue) * chartHeight})`}>
              <line x1="-3" y1="0" x2="0" y2="0" stroke="#999" strokeWidth="0.5"/>
              <text x="-5" y="3" textAnchor="end" fontSize="6" fill="#666">{tick.toFixed(0)}</text>
            </g>
          ))}
          {data.map((d, i) => (
            <g key={d.label} transform={`translate(${(i * chartWidth / data.length) + (chartWidth / data.length * 0.1)}, 0)`}>
              <rect x="0" y={chartHeight - (d.value / maxValue) * chartHeight} width={barWidth} height={(d.value / maxValue) * chartHeight} fill="#4a90e2" />
              <text x={barWidth / 2} y={chartHeight + 8} textAnchor="middle" fontSize="6" fill="#666" transform={`rotate(-45, ${barWidth / 2}, ${chartHeight + 8})`}>{d.label}</text>
            </g>
          ))}
        </g>
      </svg>
    );
};
// --- End Chart Components ---

// --- Sub-step Flowchart Renderer ---
const SubStepFlowchartCard: React.FC<{ subStep: SubStep, statusColor: string }> = ({ subStep, statusColor }) => (
    <div style={{
        position: 'absolute',
        left: subStep.position?.x || 0,
        top: subStep.position?.y || 0,
        width: 192,
        minHeight: 76,
        padding: '8px',
        borderRadius: '8px',
        backgroundColor: 'white',
        borderLeft: `4px solid ${statusColor}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontSize: '12px',
        fontFamily: 'sans-serif',
        color: '#333',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
    }}>
        <p className={`font-bold break-words ${subStep.status === SubStepStatus.COMPLETED ? 'line-through text-slate-500' : ''}`}>{subStep.text}</p>
    </div>
);

const SubStepFlowchartRenderer: React.FC<{ subSteps: SubStep[] }> = ({ subSteps }) => {
    if (!subSteps || subSteps.length === 0) {
        return <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm">No sub-steps to display.</div>;
    }

    const getStatusColor = (status?: SubStepStatus) => {
        switch(status) {
            case SubStepStatus.COMPLETED: return '#22c55e'; // green-500
            case SubStepStatus.IN_PROGRESS: return '#3b82f6'; // blue-500
            default: return '#94a3b8'; // slate-400
        }
    };
    
    const cardWidth = 192;
    const cardHeight = 76;

    const connectors = useMemo(() => {
        const newConnectors: Array<{id: string, from: {x:number, y:number}, to: {x:number, y:number}, sourceId: string, targetId: string}> = [];
        (subSteps || []).forEach(sourceSS => {
            if (sourceSS?.nextSubStepIds?.length && sourceSS.position) {
                const sourcePos = { x: sourceSS.position.x + cardWidth, y: sourceSS.position.y + cardHeight / 2 };
                sourceSS.nextSubStepIds.forEach(targetId => {
                    const targetSS = subSteps.find(t => t.id === targetId);
                    if (targetSS && targetSS.position) {
                        const targetPos = { x: targetSS.position.x, y: targetSS.position.y + cardHeight / 2 };
                        newConnectors.push({ id: `fc-render-${sourceSS.id}-${targetId}`, from: sourcePos, to: targetPos, sourceId: sourceSS.id, targetId: targetId });
                    }
                });
            }
        });
        return newConnectors;
    }, [subSteps, cardWidth, cardHeight]);

    const boundingBox = useMemo(() => {
        if (!subSteps || subSteps.length === 0) return { minX: 0, minY: 0, width: 400, height: 300 };
        let maxX = 0, maxY = 0;
        subSteps.forEach(ss => {
            if (ss.position) {
                maxX = Math.max(maxX, ss.position.x + cardWidth);
                maxY = Math.max(maxY, ss.position.y + cardHeight);
            }
        });
        return { minX: 0, minY: 0, width: maxX + 20, height: maxY + 20 };
    }, [subSteps, cardWidth, cardHeight]);

    return (
        <div className="w-full h-full bg-slate-50 overflow-hidden" style={{fontFamily: 'Inter, sans-serif'}}>
            <svg width="100%" height="100%" viewBox={`${boundingBox.minX} ${boundingBox.minY} ${boundingBox.width} ${boundingBox.height}`}>
                <style>
                    {`
                    .flowchart-card-container {
                        position: relative;
                        width: 100%;
                        height: 100%;
                        font-family: Inter, sans-serif;
                    }
                    `}
                </style>
                <foreignObject x="0" y="0" width={boundingBox.width} height={boundingBox.height}>
                    <div className="flowchart-card-container">
                        {(subSteps || []).map(ss => (
                            <SubStepFlowchartCard key={ss.id} subStep={ss} statusColor={getStatusColor(ss.status)} />
                        ))}
                    </div>
                </foreignObject>
                {/* Render connectors on top */}
                {connectors.map(conn => (
                    <FlowConnector key={conn.id} from={conn.from} to={conn.to} id={conn.id} />
                ))}
            </svg>
        </div>
    );
};
// --- End Flowchart Renderer ---

// --- Draggable & Resizable Element Wrapper ---
const DraggableElement: React.FC<{ el: SlideElement, onUpdate: (pos: any) => void, children: React.ReactNode, isSelected: boolean, onClick: () => void }> = 
({ el, onUpdate, children, isSelected, onClick }) => {
    return (
        <div
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            style={{ 
                position: 'absolute', 
                left: `${el.position.x}%`, top: `${el.position.y}%`, 
                width: `${el.position.width}%`, height: `${el.position.height}%`,
                outline: isSelected ? '2px solid #3b82f6' : '1px dashed transparent',
                cursor: 'move',
            }}
            className="transition-all duration-150 hover:outline-dashed hover:outline-slate-400"
        >
            {children}
        </div>
    );
}

// --- Main Slide Editor View ---
interface SlideEditorViewProps {
  tasks: ProjectTask[]; // Can be a single task in an array, or all tasks
  initialDeck: SlideDeck;
  onSave: (deck: SlideDeck) => void;
  onClose: () => void;
  generateUniqueId: (prefix: string) => string;
  projectGoal: string;
  targetDate: string;
  reportScope: 'task' | 'project';
}

const SlideEditorView: React.FC<SlideEditorViewProps> = ({ 
  tasks, initialDeck, onSave, onClose, generateUniqueId, projectGoal, targetDate, reportScope 
}) => {
    const [deck, setDeck] = useState(initialDeck);
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string|null>(null);
    const [isDownloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const downloadButtonRef = useRef<HTMLDivElement>(null);

    const updateSlide = (slideId: string, updates: Partial<Slide> | ((s:Slide) => Partial<Slide>)) => {
        setDeck(prev => ({ ...prev, slides: prev.slides.map(s => s.id === slideId ? {...s, ...(typeof updates === 'function' ? updates(s) : s)} : s) }));
    };

    const toggleSlideLock = (index: number) => {
        const slide = deck.slides[index];
        updateSlide(slide.id, { isLocked: !slide.isLocked });
    };

    const updateElement = (slideId: string, elementId: string, updates: Partial<SlideElement>) => {
        updateSlide(slideId, s => ({ elements: s.elements.map(el => el.id === elementId ? {...el, ...updates} as SlideElement : el)}));
    };

    const handleOptimize = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const deckToOptimize = { ...deck, slides: deck.slides.map(s => s.isLocked ? s : ({...s, isLocked: undefined})) }; // Don't send lock status for optimization
            const optimized = await optimizeSlideLayout(deckToOptimize);
            // Re-apply lock status from original deck
            const finalDeck = { ...optimized, slides: optimized.slides.map((s, i) => ({ ...s, isLocked: deck.slides[i].isLocked }))};
            setDeck(finalDeck);
        } catch (err) {
            setError(err instanceof Error ? err.message : "最適化に失敗しました。");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRegenerate = async () => {
        setIsLoading(true);
        setError(null);
        try {
            let regenerated: SlideDeck;
            if (reportScope === 'project') {
                regenerated = await regenerateProjectReportDeck(deck, tasks, projectGoal, targetDate);
            } else {
                regenerated = await regenerateSlideDeck(deck, tasks[0], projectGoal);
            }
            setDeck(regenerated);
        } catch (err) {
            setError(err instanceof Error ? err.message : "レポートの再生成に失敗しました。");
        } finally {
            setIsLoading(false);
        }
    };

    const findActionItem = (subStepId: string, actionItemId: string): ActionItem | undefined => {
      for (const task of tasks) {
        const subStep = task.extendedDetails?.subSteps?.find(ss => ss.id === subStepId);
        if (subStep) {
          const actionItem = subStep?.actionItems?.find(ai => ai.id === actionItemId);
          if (actionItem) return actionItem;
        }
      }
      return undefined;
    };

    const renderElement = (el: SlideElement) => {
        switch(el.type) {
            case 'textbox': 
                const tb = el as TextboxElement;
                return <textarea value={tb.content} 
                    onChange={e => updateElement(deck.slides[selectedSlideIndex].id, el.id, {content: e.target.value})}
                    className="w-full h-full bg-transparent resize-none border-none outline-none p-2"
                    style={{fontSize: tb.fontSize, fontWeight: tb.fontWeight, textAlign: tb.textAlign, color: '#333'}}
                />;
            case 'image': {
                const imgEl = el as ImageElement;
                const actionItem = findActionItem(imgEl.subStepId, imgEl.actionItemId);
                const imgAttachment = actionItem?.report?.attachments?.find(a => a.id === imgEl.attachmentId);
                return imgAttachment ? <img src={imgAttachment.dataUrl} className="w-full h-full object-contain" alt={imgAttachment.name} /> : <div className="bg-slate-200 flex items-center justify-center text-xs text-slate-500">画像が見つかりません</div>;
            }
            case 'table': {
                const tblEl = el as TableElement;
                const actionItem = findActionItem(tblEl.subStepId, tblEl.actionItemId);
                const matrixData = actionItem?.report?.matrixData;
                return matrixData ? <div className="p-2 overflow-auto h-full"><table className="w-full text-[8px] border-collapse bg-white"><thead><tr className="bg-slate-200">{matrixData.headers.map((h, i) => <th key={i} className="border border-slate-300 p-1 font-semibold">{h}</th>)}</tr></thead><tbody>{matrixData.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={`${i}-${j}`} className="border border-slate-300 p-1">{c}</td>)}</tr>)}</tbody></table></div> : <div className="bg-slate-200 flex items-center justify-center text-xs text-slate-500">データなし</div>;
            }
            case 'chart': {
                const chartEl = el as ChartElement;
                const actionItem = findActionItem(chartEl.subStepId, chartEl.actionItemId);
                const chartData = (actionItem?.report?.matrixData?.rows || []).map(row => ({ label: row[0], value: parseFloat(row[1]) || 0 })).filter(d => d.label && !isNaN(d.value));
                if (chartData.length === 0) return <div className="bg-slate-200 flex items-center justify-center text-xs text-slate-500">チャートデータなし</div>;
                
                switch(chartEl.chartType) {
                    case 'line': return <LineChart data={chartData} title={chartEl.title} />;
                    case 'pie': return <PieChart data={chartData} title={chartEl.title} />;
                    case 'bar':
                    default:
                        return <BarChart data={chartData} title={chartEl.title} />;
                }
            }
            case 'flowchart': {
              const flowchartEl = el as FlowchartElement;
              if (flowchartEl.data && flowchartEl.data.subSteps) {
                  return <SubStepFlowchartRenderer subSteps={flowchartEl.data.subSteps} />;
              }
              return <div className="bg-slate-200 flex items-center justify-center text-xs text-slate-500">フローチャートのデータが見つかりません。</div>;
            }
            default: return null;
        }
    };

    const handlePrint = () => window.print();

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

    const handleDownload = (format: 'pdf' | 'json') => {
        if (format === 'pdf') {
            handlePrint();
        } else {
            downloadJson(deck, 'report-deck.json');
        }
        setDownloadMenuOpen(false);
    };

    const handleSaveAndClose = () => { onSave(deck); onClose(); };
    const currentSlide = deck.slides[selectedSlideIndex];
    const editorTitle = reportScope === 'project' ? `プロジェクト全体レポート: ${projectGoal}` : `タスクレポート: ${tasks[0].title}`;

    return (
        <>
        <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } .slide-print-page { page-break-after: always; width: 100vw; height: 56.25vw; /* 16:9 aspect ratio */ box-shadow: none !important; border: none; } }`}</style>
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 z-[100] flex flex-col p-4 no-print" onClick={() => setSelectedElementId(null)}>
            <header className="flex items-center justify-between pb-4 flex-shrink-0">
                <h2 className="text-xl font-bold text-white truncate pr-4">{editorTitle}</h2>
                <div className="flex items-center space-x-2">
                    <button onClick={handleRegenerate} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400">
                        <RefreshIcon className="w-4 h-4"/> {isLoading ? "処理中..." : "レポート再生成"}
                    </button>
                    <button onClick={handleOptimize} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-slate-400">
                        <LightBulbIcon className="w-4 h-4"/> {isLoading ? "処理中..." : "AIでレイアウト最適化"}
                    </button>
                    <div className="relative" ref={downloadButtonRef}>
                      <button onClick={() => setDownloadMenuOpen(prev => !prev)} className="p-2 bg-slate-600 text-white rounded-md hover:bg-slate-500" title="ダウンロード"><DownloadIcon className="w-5 h-5"/></button>
                      {isDownloadMenuOpen && <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10">
                        <button onClick={() => handleDownload('pdf')} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">PDFとして保存</button>
                        <button onClick={() => handleDownload('json')} className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100">JSONとして保存</button>
                      </div>}
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-600 text-white rounded-md hover:bg-slate-500" title="閉じる"> <XIcon className="w-5 h-5" /></button>
                    <button onClick={handleSaveAndClose} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-sm">保存して閉じる</button>
                </div>
            </header>
            {error && <div className="text-red-400 text-sm mb-2 bg-red-100 border border-red-400 p-2 rounded-md">{error}</div>}

            <div className="flex-grow flex gap-4 min-h-0">
                <aside className="w-40 bg-slate-800 rounded-lg p-2 flex flex-col gap-2 overflow-y-auto">
                    {deck.slides.map((slide, index) => (
                        <div key={slide.id} onClick={() => setSelectedSlideIndex(index)} 
                            className={`relative group aspect-video bg-white rounded cursor-pointer transition-all p-1 ${selectedSlideIndex === index ? 'ring-4 ring-blue-500' : 'hover:ring-2 ring-blue-400'}`}>
                            <div className="absolute top-1 right-1 z-10 opacity-50 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); toggleSlideLock(index); }} title={slide.isLocked ? "スライドのロック解除" : "スライドをロック"} className={`p-1 rounded-full ${slide.isLocked ? 'bg-blue-600 text-white' : 'bg-slate-500 text-white'}`}>
                                    {slide.isLocked ? <LockClosedIcon className="w-3 h-3"/> : <LockOpenIcon className="w-3 h-3"/>}
                                </button>
                            </div>
                            <div className="w-full h-full transform scale-[0.1] origin-top-left overflow-hidden relative">
                                {slide.elements.map(el => <div key={el.id} style={{position:'absolute', left:`${el.position.x}%`, top:`${el.position.y}%`, width:`${el.position.width}%`, height:`${el.position.height}%`, backgroundColor: '#ccc'}}></div>)}
                            </div>
                            <span className="text-white text-xs block text-center -mt-2">{index + 1}</span>
                        </div>
                    ))}
                </aside>
                
                <main className="flex-grow flex items-center justify-center">
                    {currentSlide && (
                        <div className="aspect-video w-full max-w-[100vh] bg-white shadow-2xl rounded-lg relative overflow-hidden">
                            {currentSlide.elements.map(el => (
                                <DraggableElement key={el.id} el={el} onUpdate={()=>{}} isSelected={selectedElementId === el.id} onClick={() => setSelectedElementId(el.id)}>
                                    {renderElement(el)}
                                </DraggableElement>
                            ))}
                        </div>
                    )}
                </main>
                
                <aside className="w-64 bg-slate-800 rounded-lg p-3 text-white overflow-y-auto">
                     <h3 className="font-bold border-b border-slate-600 pb-2 mb-3">プロパティ</h3>
                     <p className="text-xs text-slate-400">要素を選択してプロパティを編集します。</p>
                </aside>
            </div>
        </div>

        <div className="hidden print:block">
            {deck.slides.map((slide, index) => (
                <div key={slide.id} className="slide-print-page bg-white relative">
                   <div className="w-full h-full relative">
                    {slide.elements.map(el => (
                        <div key={el.id} style={{position: 'absolute', left:`${el.position.x}%`, top:`${el.position.y}%`, width:`${el.position.width}%`, height:`${el.position.height}%`}}>
                            {renderElement(el)}
                        </div>
                    ))}
                    </div>
                </div>
            ))}
        </div>
        </>
    );
};

export default SlideEditorView;
