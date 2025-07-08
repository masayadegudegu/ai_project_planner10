
import React, { useState } from 'react';
import { XIcon } from './icons';

interface AddTaskModalProps {
  onClose: () => void;
  onSubmit: (taskData: { title: string; description: string }) => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('タスクのタイトルは必須です。');
      return;
    }
    if (!description.trim()) {
      setError('タスクの説明は必須です。');
      return;
    }
    onSubmit({ title, description });
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <header className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-800">新しいタスクを追加</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
            title="閉じる"
            aria-label="タスク追加モーダルを閉じる"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="taskTitle" className="block text-sm font-medium text-slate-700 mb-1">
                タスクタイトル
              </label>
              <input
                type="text"
                id="taskTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base text-slate-800 placeholder-slate-500"
                placeholder="例: 市場調査を実施"
              />
            </div>
            <div>
              <label htmlFor="taskDescription" className="block text-sm font-medium text-slate-700 mb-1">
                タスク説明
              </label>
              <textarea
                id="taskDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base text-slate-800 placeholder-slate-500"
                placeholder="例: 競合製品の分析とターゲット顧客の特定"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <footer className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              タスクを追加
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AddTaskModal;