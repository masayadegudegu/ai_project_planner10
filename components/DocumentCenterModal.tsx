
import React, { useState, useMemo, useCallback } from 'react';
import { ProjectTask, GanttItem, SlideDeck, Attachment } from '../types';
import { generateCustomSlideDeck, CustomSource, generateCustomTextReport } from '../services/geminiService';
import { XIcon, SparklesIcon, SortAscIcon, SortDescIcon, FolderIcon, ArrowLeftIcon, GanttChartIcon, PresentationChartBarIcon, PaperClipIcon, TableCellsIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface DocumentReference {
    id: string;
    name: string;
    type: string;
    taskName: string;
    subStepName: string;
    actionItemName: string;
    source: CustomSource & { dataUrl?: string };
}

interface DocumentCenterModalProps {
    tasks: ProjectTask[];
    projectGoal: string;
    targetDate: string;
    ganttData: GanttItem[] | null;
    projectReportDeck: SlideDeck | null;
    onClose: () => void;
    onReportGenerated: (deck: SlideDeck) => void;
    generateUniqueId: (prefix: string) => string;
}

type SortKeys = 'name' | 'type' | 'taskName' | 'subStepName' | 'actionItemName';
type SortDirection = 'ascending' | 'descending';
type ViewMode = 'list' | 'generate';

const DocumentCenterModal: React.FC<DocumentCenterModalProps> = ({
    tasks,
    projectGoal,
    targetDate,
    ganttData,
    projectReportDeck,
    onClose,
    onReportGenerated,
    generateUniqueId,
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
    const [customPrompt, setCustomPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: SortDirection } | null>({key: 'taskName', direction: 'ascending'});
    const [reportFormat, setReportFormat] = useState<'slides' | 'text'>('slides');
    const [generatedText, setGeneratedText] = useState<string | null>(null);


    const allDocuments = useMemo((): DocumentReference[] => {
        const docs: DocumentReference[] = [];
        
        if (ganttData) {
            docs.push({
                id: 'gantt-chart-main', name: 'プロジェクト ガントチャート', type: 'Gantt Chart',
                taskName: 'プロジェクト全体', subStepName: '', actionItemName: '',
                source: { name: 'プロジェクト ガントチャート', type: 'json', content: ganttData },
            });
        }
        if (projectReportDeck) {
            docs.push({
                id: 'project-report-main', name: 'プロジェクトレポート', type: 'Project Report',
                taskName: 'プロジェクト全体', subStepName: '', actionItemName: '',
                source: { name: 'プロジェクトレポート', type: 'json', content: projectReportDeck },
            });
        }

        tasks.forEach(task => {
            if (task.extendedDetails?.reportDeck) {
                 docs.push({
                    id: `task-report-${task.id}`, name: `タスクレポート: ${task.title}`, type: 'Task Report',
                    taskName: task.title, subStepName: '', actionItemName: '',
                    source: { name: `タスクレポート: ${task.title}`, type: 'json', content: task.extendedDetails.reportDeck },
                });
            }
            task.extendedDetails?.attachments?.forEach(att => {
                docs.push({
                    id: att.id, name: att.name, type: 'Attachment',
                    taskName: task.title, subStepName: '', actionItemName: '',
                    source: { name: att.name, type: att.type.startsWith('image/') ? 'image' : 'text', content: att.dataUrl, dataUrl: att.dataUrl }
                });
            });
            task.extendedDetails?.subSteps?.forEach(ss => {
                 ss.attachments?.forEach(att => {
                    docs.push({
                        id: att.id, name: att.name, type: 'Attachment',
                        taskName: task.title, subStepName: ss.text, actionItemName: '',
                        source: { name: att.name, type: att.type.startsWith('image/') ? 'image' : 'text', content: att.dataUrl, dataUrl: att.dataUrl }
                    });
                });
                ss.actionItems?.forEach(ai => {
                     ai.report?.attachments?.forEach(att => {
                         docs.push({
                            id: att.id, name: att.name, type: 'Attachment',
                            taskName: task.title, subStepName: ss.text, actionItemName: ai.text,
                            source: { name: att.name, type: att.type.startsWith('image/') ? 'image' : 'text', content: att.dataUrl, dataUrl: att.dataUrl }
                        });
                    });
                    if (ai.report?.matrixData) {
                         docs.push({
                            id: `matrix-${ai.id}`, name: `データマトリクス: ${ai.text}`, type: 'Data Matrix',
                            taskName: task.title, subStepName: ss.text, actionItemName: ai.text,
                            source: { name: `データマトリクス: ${ai.text}`, type: 'json', content: ai.report.matrixData }
                        });
                    }
                })
            });
        });

        return docs;
    }, [tasks, ganttData, projectReportDeck]);
    
    const sortedDocuments = useMemo(() => {
        let sortableItems = [...allDocuments];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aVal = (a[sortConfig.key] || '').toLowerCase();
                const bVal = (b[sortConfig.key] || '').toLowerCase();
                if (aVal < bVal) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [allDocuments, sortConfig]);

    const requestSort = (key: SortKeys) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name: SortKeys) => {
        if (!sortConfig || sortConfig.key !== name) return <SortDescIcon className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-100" />;
        return sortConfig.direction === 'ascending' ? <SortAscIcon className="w-3 h-3 ml-1 text-blue-600" /> : <SortDescIcon className="w-3 h-3 ml-1 text-blue-600" />;
    };

    const handleToggleSelection = (docId: string) => {
        setSelectedDocs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(docId)) {
                newSet.delete(docId);
            } else {
                newSet.add(docId);
            }
            return newSet;
        });
    };
    
    const handleToggleAll = () => {
        if (selectedDocs.size === allDocuments.length) {
            setSelectedDocs(new Set());
        } else {
            setSelectedDocs(new Set(allDocuments.map(d => d.id)));
        }
    }

    const handleGenerateReport = async () => {
        if (selectedDocs.size === 0) {
            setError('レポート生成には、少なくとも1つの資料を選択してください。');
            return;
        }
        if (!customPrompt.trim()) {
            setError('レポートの目的をプロンプトに入力してください。');
            return;
        }

        setIsLoading(true);
        setError(null);
        setGeneratedText(null);

        const sourcesToUse = allDocuments
            .filter(doc => selectedDocs.has(doc.id))
            .map(doc => doc.source);
        
        try {
            if (reportFormat === 'slides') {
                const deck = await generateCustomSlideDeck(sourcesToUse, customPrompt);
                onReportGenerated(deck);
            } else {
                const text = await generateCustomTextReport(sourcesToUse, customPrompt);
                setGeneratedText(text);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'カスタムレポートの生成に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };
    
    const getIconForType = (type: string) => {
      switch(type) {
        case 'Gantt Chart': return <GanttChartIcon className="w-5 h-5 text-amber-600" />;
        case 'Project Report':
        case 'Task Report': return <PresentationChartBarIcon className="w-5 h-5 text-teal-600" />;
        case 'Attachment': return <PaperClipIcon className="w-5 h-5 text-slate-600" />;
        case 'Data Matrix': return <TableCellsIcon className="w-5 h-5 text-purple-600" />;
        default: return <FolderIcon className="w-5 h-5 text-slate-500" />;
      }
    };
    
    const getLinkForSource = (source: CustomSource & { dataUrl?: string }): string | undefined => {
        if (source.dataUrl) {
            return source.dataUrl;
        }
        if (source.type === 'json') {
            try {
                const jsonString = JSON.stringify(source.content, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                return URL.createObjectURL(blob);
            } catch { return undefined; }
        }
        return undefined;
    };
    
    const selectedDocDetails = useMemo(() => {
        return allDocuments.filter(doc => selectedDocs.has(doc.id));
    }, [selectedDocs, allDocuments]);

    const renderListView = () => (
        <>
            <main className="flex-grow p-4 overflow-y-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-200 z-10">
                        <tr>
                            <th className="p-2 border border-slate-300 w-10 text-center"><input type="checkbox" checked={selectedDocs.size === allDocuments.length && allDocuments.length > 0} onChange={handleToggleAll} className="w-4 h-4 accent-blue-600" /></th>
                            <th className="p-0 border border-slate-300 w-1/4"><button onClick={() => requestSort('name')} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50"><span>資料名</span>{getSortIcon('name')}</button></th>
                            <th className="p-0 border border-slate-300 w-40"><button onClick={() => requestSort('type')} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50"><span>種類</span>{getSortIcon('type')}</button></th>
                            <th className="p-0 border border-slate-300 w-1/4"><button onClick={() => requestSort('taskName')} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50"><span>タスク</span>{getSortIcon('taskName')}</button></th>
                            <th className="p-0 border border-slate-300 w-1/4"><button onClick={() => requestSort('subStepName')} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50"><span>サブステップ</span>{getSortIcon('subStepName')}</button></th>
                            <th className="p-0 border border-slate-300 w-1/4"><button onClick={() => requestSort('actionItemName')} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50"><span>アクション</span>{getSortIcon('actionItemName')}</button></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDocuments.map(doc => {
                             const link = getLinkForSource(doc.source);
                             return (
                                <tr key={doc.id} className="bg-white hover:bg-slate-50 transition-colors">
                                    <td className="border border-slate-300 align-middle text-center p-2"><input type="checkbox" checked={selectedDocs.has(doc.id)} onChange={() => handleToggleSelection(doc.id)} className="w-4 h-4 accent-blue-600" /></td>
                                    <td className="border border-slate-300 p-2 font-medium text-slate-800">
                                        {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">{doc.name}</a> : <span>{doc.name}</span>}
                                    </td>
                                    <td className="border border-slate-300 p-2 text-slate-600"><div className="flex items-center gap-2">{getIconForType(doc.type)}<span>{doc.type}</span></div></td>
                                    <td className="border border-slate-300 p-2 text-slate-600 truncate">{doc.taskName}</td>
                                    <td className="border border-slate-300 p-2 text-slate-600 truncate">{doc.subStepName}</td>
                                    <td className="border border-slate-300 p-2 text-slate-600 truncate">{doc.actionItemName}</td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </main>
            <footer className="flex-shrink-0 p-4 bg-white border-t flex justify-between items-center rounded-b-xl">
                 <span className="text-sm text-slate-600">{selectedDocs.size} / {allDocuments.length} 件の資料を選択中</span>
                 <button onClick={() => setViewMode('generate')} disabled={selectedDocs.size === 0} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
                    レポート生成へ
                 </button>
            </footer>
        </>
    );

    const renderGenerateView = () => (
        <>
            <main className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold text-lg text-slate-800 mb-2">選択した資料 ({selectedDocDetails.length}件)</h4>
                    <div className="bg-slate-50 border rounded-lg p-3 max-h-96 overflow-y-auto space-y-2">
                        {selectedDocDetails.map(doc => (
                            <div key={doc.id} className="text-sm text-slate-700 flex items-center gap-2">
                               {getIconForType(doc.type)}
                               <span className="truncate" title={doc.name}>{doc.name}</span>
                            </div>
                        ))}
                    </div>
                     <h4 className="font-semibold text-lg text-slate-800 mt-6 mb-2">レポート形式</h4>
                     <div className="flex gap-4">
                        <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 hover:bg-slate-50"><input type="radio" name="reportFormat" value="slides" checked={reportFormat==='slides'} onChange={() => setReportFormat('slides')} className="w-4 h-4 accent-blue-600"/>スライド形式</label>
                        <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 hover:bg-slate-50"><input type="radio" name="reportFormat" value="text" checked={reportFormat==='text'} onChange={() => setReportFormat('text')} className="w-4 h-4 accent-blue-600"/>テキスト形式</label>
                     </div>
                </div>
                 <div>
                    <h4 className="font-semibold text-lg text-slate-800 mb-2">レポート作成の目的</h4>
                     <textarea 
                        value={customPrompt}
                        onChange={e => setCustomPrompt(e.target.value)}
                        placeholder="例：これらの資料からプロジェクトの進捗状況をまとめ、経営層向けの報告スライドを作成してください。"
                        rows={6}
                        className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                    />
                    {error && <div className="mt-2"><ErrorMessage message={error}/></div>}
                    {generatedText && (
                        <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                            <h5 className="font-semibold text-md text-slate-800 mb-2">生成されたテキストレポート</h5>
                            <pre className="text-sm text-slate-700 bg-white p-3 rounded whitespace-pre-wrap max-h-60 overflow-y-auto">{generatedText}</pre>
                            <button onClick={() => navigator.clipboard.writeText(generatedText)} className="text-xs mt-2 px-2 py-1 bg-slate-200 rounded">クリップボードにコピー</button>
                        </div>
                    )}
                </div>
            </main>
             <footer className="flex-shrink-0 p-4 bg-white border-t flex justify-between items-center rounded-b-xl">
                 <button onClick={() => { setViewMode('list'); setGeneratedText(null); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md shadow-sm hover:bg-slate-200">
                    <ArrowLeftIcon className="w-4 h-4" />
                    資料選択に戻る
                 </button>
                 <button onClick={handleGenerateReport} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400">
                     {isLoading ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-5 h-5" />}
                    <span>{isLoading ? '生成中...' : 'レポートを生成'}</span>
                 </button>
            </footer>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex flex-col p-4 sm:p-6 md:p-8 z-[70]">
            <div className="bg-slate-100 rounded-xl shadow-2xl w-full h-full flex flex-col">
                <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 bg-white rounded-t-xl">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                        <FolderIcon className="w-7 h-7 text-blue-600" />
                        <span>資料センター</span>
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </header>

                {viewMode === 'list' ? renderListView() : renderGenerateView()}

            </div>
        </div>
    );
};

export default DocumentCenterModal;