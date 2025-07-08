
import React from 'react';
import { XIcon, DownloadIcon, ExclamationTriangleIcon } from './icons';

interface ConfirmNewProjectModalProps {
  onClose: () => void;
  onDownloadAndStartNew: () => void;
  onStartNewWithoutSaving: () => void;
}

const ConfirmNewProjectModal: React.FC<ConfirmNewProjectModalProps> = ({
  onClose,
  onDownloadAndStartNew,
  onStartNewWithoutSaving,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <header className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 mr-2 text-yellow-500" />
            確認
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
            title="閉じる"
            aria-label="確認モーダルを閉じる"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6">
          <p className="text-slate-700">
            新しいプロジェクトを開始します。現在の作業内容は保存されませんが、よろしいですか？
          </p>
          <p className="text-sm text-slate-500 mt-2">
            現在のプロジェクトを保存したい場合は、JSON形式でダウンロードできます。
          </p>
        </div>

        <footer className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onStartNewWithoutSaving}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-md shadow-sm hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            保存せずに新規作成
          </button>
          <button
            type="submit"
            onClick={onDownloadAndStartNew}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            ダウンロードして新規作成
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ConfirmNewProjectModal;
