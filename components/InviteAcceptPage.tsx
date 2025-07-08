import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProjectService } from '../services/projectService';
import { supabase } from '../lib/supabase';
import { CheckCircleIcon, ExclamationTriangleIcon, SparklesIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import AuthModal from './AuthModal';

const InviteAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string; project?: any } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // 認証状態の確認
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user && token) {
        handleJoinProject();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user && token && !result) {
        handleJoinProject();
      }
    });

    return () => subscription.unsubscribe();
  }, [token]);

  const handleJoinProject = async () => {
    if (!token) {
      setResult({ success: false, error: '無効な招待リンクです' });
      return;
    }

    setIsLoading(true);
    try {
      const joinResult = await ProjectService.joinProjectByInvitation(token);
      setResult(joinResult);
      
      if (joinResult.success && joinResult.project) {
        // 3秒後にプロジェクトページにリダイレクト
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : 'プロジェクトへの参加に失敗しました'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // 認証成功後、自動的にuseEffectでhandleJoinProjectが呼ばれる
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">無効な招待リンク</h1>
          <p className="text-slate-600 mb-6">招待リンクが正しくありません。</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
            <SparklesIcon className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h1 className="text-2xl font-bold text-slate-800 mb-2">プロジェクトへの招待</h1>
            <p className="text-slate-600 mb-6">
              プロジェクトに参加するには、まずログインまたはアカウントを作成してください。
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
            >
              ログイン / アカウント作成
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          <LoadingSpinner size="lg" />
          <h1 className="text-2xl font-bold text-slate-800 mt-4 mb-2">プロジェクトに参加中...</h1>
          <p className="text-slate-600">しばらくお待ちください。</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full text-center">
          {result.success ? (
            <>
              <CheckCircleIcon className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h1 className="text-2xl font-bold text-slate-800 mb-2">参加完了！</h1>
              <p className="text-slate-600 mb-2">
                プロジェクト「{result.project?.title}」に参加しました。
              </p>
              <p className="text-sm text-slate-500 mb-6">
                3秒後に自動的にプロジェクトページに移動します...
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700"
              >
                今すぐプロジェクトを見る
              </button>
            </>
          ) : (
            <>
              <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500 mb-4" />
              <h1 className="text-2xl font-bold text-slate-800 mb-2">参加に失敗</h1>
              <p className="text-slate-600 mb-6">{result.error}</p>
              <button
                onClick={() => navigate('/')}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
              >
                ホームに戻る
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default InviteAcceptPage;