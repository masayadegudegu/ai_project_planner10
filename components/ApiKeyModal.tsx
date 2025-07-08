
import React, { useState } from 'react';
import { KeyIcon, SparklesIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface ApiKeyModalProps {
  onSetApiKey: (key: string) => void;
  error?: string | null;
  isLoading?: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSetApiKey, error, isLoading }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSetApiKey(key);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-xl p-8">
        <div className="text-center mb-8">
          <SparklesIcon className="w-12 h-12 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-slate-800">AI Project Planner</h1>
          <p className="text-slate-600 mt-2">始めるには、Google Gemini APIキーを入力してください。</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center">
              <KeyIcon className="w-5 h-5 mr-2 text-slate-500" />
              Gemini API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="APIキーをここに貼り付け"
              className="w-full px-4 py-3 bg-slate-100 border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-base text-slate-800 placeholder-slate-400"
            />
          </div>
          
          {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
          
          <button
            type="submit"
            disabled={isLoading || !key}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-150 ease-in-out flex items-center justify-center"
          >
            {isLoading ? <LoadingSpinner size="sm" /> : '保存して開始'}
          </button>
        </form>
         <div className="text-center mt-6">
            <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
            >
                APIキーの取得はこちら
            </a>
            <p className="text-xs text-slate-400 mt-2">APIキーはセッション中のみブラウザに保存されます。</p>
        </div>
      </div>
      <footer className="mt-8 text-center">
        <p className="text-slate-400 text-sm">
          Powered by Gemini API
        </p>
      </footer>
    </div>
  );
};

export default ApiKeyModal;
