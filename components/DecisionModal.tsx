
import React, { useState, useEffect, useMemo } from 'react';
import { Decision, ProjectTask } from '../types';
import { XIcon, TrashIcon, SparklesIcon, PlusCircleIcon, SortAscIcon, SortDescIcon } from './icons';
import { generateDecisions } from '../services/geminiService';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface DecisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (decisions: Decision[]) => void;
  task: ProjectTask;
  generateUniqueId: (prefix: string) => string;
}

const EditableCell: React.FC<{ value: string; onChange: (value: string) => void; placeholder: string; }> = ({ value, onChange, placeholder }) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={3}
    className="w-full h-full text-sm bg-transparent outline-none p-2 rounded-sm focus:ring-1 focus:ring-blue-500 focus:bg-blue-50 resize-none text-slate-800 placeholder-slate-400"
  />
);

type SortKeys = 'status' | 'question' | 'decision' | 'reasoning' | 'date';
type SortDirection = 'ascending' | 'descending';

const DecisionModal: React.FC<DecisionModalProps> = ({ isOpen, onClose, onSave, task, generateUniqueId }) => {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: SortDirection } | null>({ key: 'status', direction: 'ascending' });

  useEffect(() => {
    if (isOpen) {
      setDecisions(task.extendedDetails?.decisions || []);
    }
  }, [isOpen, task.extendedDetails?.decisions]);

  const sortedDecisions = useMemo(() => {
    let sortableItems = [...decisions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'status':
            aValue = a.status === 'undecided' ? 0 : 1;
            bValue = b.status === 'undecided' ? 0 : 1;
            break;
          case 'date':
            aValue = a.date || '9999-12-31';
            bValue = b.date || '9999-12-31';
            break;
          default:
            aValue = (a[sortConfig.key] || '').toLowerCase();
            bValue = (b[sortConfig.key] || '').toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [decisions, sortConfig]);

  const requestSort = (key: SortKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (name: SortKeys) => {
    if (!sortConfig || sortConfig.key !== name) {
      return <SortDescIcon className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'ascending' ? <SortAscIcon className="w-3 h-3 ml-1 text-blue-600" /> : <SortDescIcon className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const SortableHeader: React.FC<{ sortKey: SortKeys; label: string; className?: string }> = ({ sortKey, label, className }) => (
    <th className={`p-0 border border-slate-300 ${className || ''}`}>
      <button onClick={() => requestSort(sortKey)} className="w-full h-full flex items-center justify-between group font-semibold text-slate-700 p-2 hover:bg-slate-200/50 transition-colors">
        <span>{label}</span>
        {getSortIcon(sortKey)}
      </button>
    </th>
  );

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await generateDecisions(task, decisions);
      const newDecisions = results.map(aiDecision => {
        if (aiDecision.id === 'NEW') {
          return { ...aiDecision, id: generateUniqueId('dec_ai') };
        }
        return aiDecision;
      });
      setDecisions(newDecisions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '決定事項の抽出に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = (id: string, updates: Partial<Decision>) => {
    setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  };

  const handleStatusChange = (id: string, newStatus: 'decided' | 'undecided') => {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;

    const updates: Partial<Decision> = { status: newStatus };
    if (newStatus === 'decided' && !decision.date) {
      updates.date = new Date().toISOString().split('T')[0];
    } else if (newStatus === 'undecided') {
      updates.date = undefined;
    }
    handleUpdate(id, updates);
  };

  const handleRemove = (id: string) => {
    setDecisions((prev) => prev.filter((d) => d.id !== id));
  };

  const handleAdd = () => {
    const newDecision: Decision = {
      id: generateUniqueId('dec_manual'),
      question: '',
      status: 'undecided',
    };
    setDecisions((prev) => [newDecision, ...prev]);
  };

  const handleSaveAndClose = () => {
    onSave(decisions);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex flex-col p-4 sm:p-6 md:p-8 z-[50]">
      <div className="bg-slate-100 rounded-xl shadow-2xl w-full h-full flex flex-col">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 bg-white rounded-t-xl">
          <h3 className="text-xl font-bold text-slate-800">決定事項の管理</h3>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={handleGenerate} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:bg-slate-400">
              {isLoading ? <LoadingSpinner size="sm" color="border-white" /> : <SparklesIcon className="w-5 h-5" />}
              <span>AIでリストを更新</span>
            </button>
            <button onClick={handleAdd} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 disabled:bg-slate-400">
              <PlusCircleIcon className="w-5 h-5" />
              <span>手動で追加</span>
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100">
              <XIcon className="w-6 h-6 text-slate-500" />
            </button>
          </div>
        </header>

        {error && <div className="p-4"><ErrorMessage message={error} /></div>}

        <main className="flex-grow p-4 overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-200 z-10">
              <tr>
                <SortableHeader sortKey="status" label="ステータス" className="w-32" />
                <SortableHeader sortKey="question" label="決定すべき項目 (Question)" className="w-[25%]" />
                <SortableHeader sortKey="decision" label="決定した内容 (Decision)" className="w-[25%]" />
                <SortableHeader sortKey="reasoning" label="理由/重要性" className="w-[25%]" />
                <SortableHeader sortKey="date" label="日付" className="w-36" />
                <th className="p-2 border border-slate-300 w-16">アクション</th>
              </tr>
            </thead>
            <tbody>
              {sortedDecisions.map((decision) => (
                <tr key={decision.id} className="bg-white hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-300 align-top p-2">
                    <select
                      value={decision.status}
                      onChange={(e) => handleStatusChange(decision.id, e.target.value as 'decided' | 'undecided')}
                      className={`w-full p-2 rounded-md font-semibold text-xs border ${decision.status === 'decided' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
                    >
                      <option value="undecided">未決定</option>
                      <option value="decided">決定済み</option>
                    </select>
                  </td>
                  <td className="border border-slate-300"><EditableCell value={decision.question || ''} onChange={(val) => handleUpdate(decision.id, { question: val })} placeholder="例：どのクラウドプロバイダーを利用するか？" /></td>
                  <td className="border border-slate-300"><EditableCell value={decision.decision || ''} onChange={(val) => handleUpdate(decision.id, { decision: val })} placeholder="決定内容..." /></td>
                  <td className="border border-slate-300"><EditableCell value={decision.reasoning || ''} onChange={(val) => handleUpdate(decision.id, { reasoning: val })} placeholder="理由や背景..." /></td>
                  <td className="border border-slate-300 align-top p-2">
                    <input
                      type="date"
                      value={decision.date || ''}
                      onChange={(e) => handleUpdate(decision.id, { date: e.target.value })}
                      className="w-full bg-transparent border-b border-dotted border-slate-400 outline-none p-1 text-xs text-slate-600 focus:border-solid focus:border-blue-500 disabled:border-none disabled:bg-slate-100"
                      disabled={decision.status === 'undecided'}
                    />
                  </td>
                  <td className="border border-slate-300 text-center align-middle">
                    <button
                      onClick={() => handleRemove(decision.id)}
                      className="text-red-400 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition-colors"
                      title="この項目を削除"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
               {decisions.length === 0 && (
                 <tr>
                   <td colSpan={6} className="text-center py-12 text-slate-500 bg-white border border-slate-300">
                     決定事項はありません。「手動で追加」するか、「AIでリストを更新」してください。
                   </td>
                 </tr>
               )}
            </tbody>
          </table>
        </main>

        <footer className="flex-shrink-0 p-4 bg-white border-t flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md shadow-sm hover:bg-slate-200">
            キャンセル
          </button>
          <button onClick={handleSaveAndClose} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-700">
            変更を保存
          </button>
        </footer>
      </div>
    </div>
  );
};

export default DecisionModal;
