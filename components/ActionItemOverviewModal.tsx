
import React, { useState, useMemo } from 'react';
import { ProjectTask, ActionItem, SubStep } from '../types';
import { XIcon, CheckSquareIcon, SquareIcon, SortAscIcon, SortDescIcon, ArrowLeftIcon } from './icons';

interface FlattenedActionItem {
  actionItem: ActionItem;
  subStep: SubStep;
  task: ProjectTask;
}

type SortKeys = 'status' | 'actionItem' | 'responsible' | 'subStep' | 'task' | 'dueDate';
type SortDirection = 'ascending' | 'descending';


const ActionItemOverviewModal: React.FC<{ tasks: ProjectTask[]; onClose: () => void; }> = ({ tasks, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKeys; direction: SortDirection } | null>(null);

  const flattenedItems = useMemo(() => {
    const allItems: FlattenedActionItem[] = [];
    tasks.forEach(task => {
      task.extendedDetails?.subSteps?.forEach(subStep => {
        subStep.actionItems?.forEach(actionItem => {
          allItems.push({ actionItem, subStep, task });
        });
      });
    });
    return allItems;
  }, [tasks]);
  
  const filteredItems = useMemo(() => {
    return flattenedItems
      .filter(item => {
        if (filter === 'completed') return item.actionItem.completed;
        if (filter === 'pending') return !item.actionItem.completed;
        return true;
      })
      .filter(item => {
        const lowerSearch = searchTerm.toLowerCase();
        return (
          item.actionItem.text.toLowerCase().includes(lowerSearch) ||
          item.subStep.text.toLowerCase().includes(lowerSearch) ||
          (item.subStep.responsible || '').toLowerCase().includes(lowerSearch) ||
          item.task.title.toLowerCase().includes(lowerSearch)
        );
      });
  }, [flattenedItems, filter, searchTerm]);

  const sortedItems = useMemo(() => {
    let sortableItems = [...filteredItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch(sortConfig.key) {
            case 'status':
                aValue = a.actionItem.completed;
                bValue = b.actionItem.completed;
                break;
            case 'actionItem':
                aValue = a.actionItem.text.toLowerCase();
                bValue = b.actionItem.text.toLowerCase();
                break;
            case 'responsible':
                aValue = (a.subStep.responsible || '').toLowerCase();
                bValue = (b.subStep.responsible || '').toLowerCase();
                break;
            case 'subStep':
                aValue = a.subStep.text.toLowerCase();
                bValue = b.subStep.text.toLowerCase();
                break;
            case 'task':
                aValue = a.task.title.toLowerCase();
                bValue = b.task.title.toLowerCase();
                break;
            case 'dueDate':
                aValue = a.actionItem.dueDate || a.subStep.dueDate || '9999-12-31'; // Put items without due date at the end
                bValue = b.actionItem.dueDate || b.subStep.dueDate || '9999-12-31';
                break;
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
  }, [filteredItems, sortConfig]);

  const requestSort = (key: SortKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (name: SortKeys) => {
    if (!sortConfig || sortConfig.key !== name) {
      return <SortAscIcon className="w-3 h-3 ml-1 opacity-20" />;
    }
    if (sortConfig.direction === 'ascending') {
      return <SortAscIcon className="w-3 h-3 ml-1 text-blue-600" />;
    }
    return <SortDescIcon className="w-3 h-3 ml-1 text-blue-600" />;
  };

  const SortableHeader: React.FC<{ sortKey: SortKeys, label: string, className?: string }> = ({ sortKey, label, className }) => (
    <th scope="col" className={`px-6 py-3 ${className || ''}`}>
      <button onClick={() => requestSort(sortKey)} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
        {label}
        {getSortIcon(sortKey)}
      </button>
    </th>
  );


  return (
    <div className="fixed inset-0 bg-slate-100 z-[60] flex flex-col">
       <header className="flex-shrink-0 bg-white shadow-md">
         <div className="flex items-center justify-between p-4 border-b w-full max-w-7xl mx-auto">
           <h3 className="text-xl font-bold text-slate-800">全アクションアイテム一覧</h3>
           <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300">
             <ArrowLeftIcon className="w-5 h-5"/>
             フローに戻る
           </button>
         </div>
       </header>

       <main className="flex-grow flex flex-col overflow-hidden p-4 w-full max-w-7xl mx-auto">
        <div className="p-4 flex-shrink-0 bg-white rounded-t-lg border-x border-t">
          <div className="flex flex-wrap gap-4 items-center">
            <input
              type="text"
              placeholder="検索..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm w-full sm:w-auto flex-grow"
            />
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-1">
              <button onClick={() => setFilter('all')} className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-white shadow' : 'hover:bg-slate-200'}`}>全て</button>
              <button onClick={() => setFilter('pending')} className={`px-3 py-1 text-sm rounded-md ${filter === 'pending' ? 'bg-white shadow' : 'hover:bg-slate-200'}`}>未完了</button>
              <button onClick={() => setFilter('completed')} className={`px-3 py-1 text-sm rounded-md ${filter === 'completed' ? 'bg-white shadow' : 'hover:bg-slate-200'}`}>完了</button>
            </div>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto bg-white rounded-b-lg border">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-10">
              <tr>
                <SortableHeader sortKey="status" label="状態" className="w-24" />
                <SortableHeader sortKey="actionItem" label="アクションアイテム" />
                <SortableHeader sortKey="responsible" label="担当者" />
                <SortableHeader sortKey="subStep" label="所属サブステップ" />
                <SortableHeader sortKey="task" label="所属タスク" />
                <SortableHeader sortKey="dueDate" label="期日" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedItems.map(({ actionItem, subStep, task }, index) => (
                <tr key={actionItem.id + index} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    {actionItem.completed ? 
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckSquareIcon className="w-4 h-4 mr-1"/>完了
                        </span>
                         : 
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                           <SquareIcon className="w-4 h-4 mr-1"/>未完了
                        </span>
                    }
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900">{actionItem.text}</td>
                  <td className="px-6 py-3">{subStep.responsible || '未設定'}</td>
                  <td className="px-6 py-3">{subStep.text}</td>
                  <td className="px-6 py-3">{task.title}</td>
                  <td className="px-6 py-3">{(actionItem.dueDate || subStep.dueDate) ? new Date((actionItem.dueDate || subStep.dueDate) + 'T00:00:00Z').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric'}) : '未設定'}</td>
                </tr>
              ))}
              {sortedItems.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-500">条件に一致するアイテムはありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
       </main>
    </div>
  );
};

export default ActionItemOverviewModal;