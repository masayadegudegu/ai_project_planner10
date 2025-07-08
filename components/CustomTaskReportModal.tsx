
import React, { useState, useMemo, useEffect } from 'react';
import { ProjectTask, SlideDeck } from '../types';
import { generateCustomSlideDeck, CustomSource } from '../services/geminiService';
import { XIcon, SparklesIcon, FolderIcon, PaperClipIcon, TableCellsIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface DocumentSource {
    id: string;
    name: string;
    type: 'Task Data' | 'Attachment' | 'Data Matrix';
    source: CustomSource;
}

interface CustomTaskReportModalProps {
    task: ProjectTask;
    isOpen: boolean;
    onClose: () => void;
    onReportGenerated: (deck: SlideDeck) => void;
}

const CustomTaskReportModal: React.FC<CustomTaskReportModalProps> = ({ task, isOpen, onClose, onReportGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const availableSources = useMemo((): DocumentSource[] => {
        const sources: DocumentSource[] = [];

        sources.push({
            id: `task-data-${task.id}`,
            name: `基本タスク情報: ${task.title}`,
            type: 'Task Data',
            source: { name: `タスクデータ: ${task.title}`, type: 'json', content: task }
        });

        task.extendedDetails?.attachments?.forEach(att => {
            sources.push({
                id: att.id,
                name: `添付: ${att.name}`,
                type: 'Attachment',
                source: { name: att.name, type: att.type.startsWith('image/') ? 'image' : 'text', content: att.dataUrl }
            });
        });
        
        task.extendedDetails?.subSteps?.forEach(ss => {
            ss.actionItems?.forEach(ai => {
                if (ai.report?.matrixData) {
                    sources.push({
                        id: `matrix-${ai.id}`,
                        name: `データ: ${ai.text} (${ss.text})`,
                        type: 'Data Matrix',
                        source: { name: `データマトリクス: ${ai.text}`, type: 'json', content: ai.report.matrixData }
                    });
                }
                ai.report?.attachments?.forEach(att => {
                    sources.push({
                        id: att.id,
                        name: `添付: ${att.name} (${ai.text})`,
                        type: 'Attachment',
                        source: { name: att.name, type: att.type.startsWith('image/') ? 'image' : 'text', content: att.dataUrl }
                    });
                });
            });
        });
        
        return sources;
    }, [task]);
    
    // Split sources for clearer UI
    const taskDataSource = useMemo(() => availableSources.find(s => s.type === 'Task Data'), [availableSources]);
    const optionalSources = useMemo(() => availableSources.filter(s => s.type !== 'Task Data'), [availableSources]);


    useEffect(() => {
        if (isOpen) {
            // Always pre-select the base task data
            const initialSelection = new Set<string>();
            if (taskDataSource) {
                initialSelection.add(taskDataSource.id);
            }
            setSelectedSources(initialSelection);
        }
    }, [isOpen, taskDataSource]);


    const handleToggleSelection = (sourceId: string) => {
        // Prevent toggling the main task data source
        const source = availableSources.find(s => s.id === sourceId);
        if (source?.type === 'Task Data') return;

        setSelectedSources(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sourceId)) {
                newSet.delete(sourceId);
            } else {
                newSet.add(sourceId);
            }
            return newSet;
        });
    };

    const handleSubmit = async () => {
        if (!prompt.trim()) {
            setError('レポート作成の目的を入力してください。');
            return;
        }
        if (selectedSources.size === 0) {
            setError('少なくとも1つの資料を選択してください。');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const sourcesToUse = availableSources
                .filter(s => selectedSources.has(s.id))
                .map(s => s.source);
            
            const deck = await generateCustomSlideDeck(sourcesToUse, prompt);
            onReportGenerated(deck);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'レポートの生成中にエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const getIconForType = (type: DocumentSource['type']) => {
        switch(type) {
            case 'Task Data': return <FolderIcon className="w-5 h-5 text-blue-600" />;
            case 'Attachment': return <PaperClipIcon className="w-5 h-5 text-slate-600" />;
            case 'Data Matrix': return <TableCellsIcon className="w-5 h-5 text-purple-600" />;
            default: return <FolderIcon className="w-5 h-5 text-slate-500" />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <header className="flex-shrink-0 flex items-center justify-between p-5 border-b border-slate-200">
                    <h3 className="text-xl font-bold text-slate-800">カスタムレポート作成</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100">
                        <XIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </header>

                <main className="flex-grow p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Source Selection */}
                    <div>
                        <h4 className="font-semibold text-lg text-slate-800 mb-3">1. 資料の選択</h4>
                        
                        {/* Always included source */}
                        <div className="mb-4">
                            <p className="text-xs text-slate-600 font-semibold mb-1">常に使用される情報:</p>
                            <div className="flex items-center gap-3 p-2 rounded-md bg-slate-200">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    disabled={true}
                                    className="w-4 h-4 accent-blue-600"
                                />
                                {taskDataSource && getIconForType(taskDataSource.type)}
                                <span className="text-sm text-slate-800 font-medium truncate" title={taskDataSource?.name}>{taskDataSource?.name}</span>
                            </div>
                        </div>

                        {/* Optional sources */}
                        {optionalSources.length > 0 && (
                            <>
                                <p className="text-xs text-slate-600 font-semibold mb-1">追加の資料 (任意):</p>
                                <div className="bg-slate-50 border rounded-lg p-3 max-h-80 overflow-y-auto space-y-2">
                                    {optionalSources.map(source => (
                                        <label key={source.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedSources.has(source.id)}
                                                onChange={() => handleToggleSelection(source.id)}
                                                className="w-4 h-4 accent-blue-600"
                                            />
                                            {getIconForType(source.type)}
                                            <span className="text-sm text-slate-700 truncate" title={source.name}>{source.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Column: Prompt */}
                    <div>
                        <h4 className="font-semibold text-lg text-slate-800 mb-3">2. レポート作成の指示</h4>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="例：選択した資料を基に、プロジェクトの技術的な課題とそれに対する解決策をまとめたスライドを作成してください。"
                            rows={8}
                            className="w-full p-3 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm"
                        />
                        {error && <div className="mt-2"><ErrorMessage message={error}/></div>}
                    </div>
                </main>

                <footer className="flex-shrink-0 p-5 bg-slate-100 border-t flex justify-end items-center gap-4">
                    <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50">
                        キャンセル
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 disabled:bg-slate-400"
                    >
                        {isLoading ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-5 h-5" />}
                        <span>{isLoading ? '生成中...' : 'レポートを生成'}</span>
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default CustomTaskReportModal;
