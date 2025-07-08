import React, { useState, useEffect } from 'react';
import { ProjectService } from '../services/projectService';
import { ProjectInvitation, ProjectMember } from '../types';
import { XIcon, PlusIcon, TrashIcon, UserIcon, MailIcon, ClockIcon, CheckCircleIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface ProjectInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  members: ProjectMember[];
  userRole: 'owner' | 'editor' | 'viewer';
  onMembersUpdate: () => void;
}

const ProjectInviteModal: React.FC<ProjectInviteModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  members,
  userRole,
  onMembersUpdate,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers = userRole === 'owner' || userRole === 'editor';

  useEffect(() => {
    if (isOpen && canManageMembers) {
      loadInvitations();
    }
  }, [isOpen, projectId, canManageMembers]);

  const loadInvitations = async () => {
    setIsLoadingInvitations(true);
    try {
      const invitationList = await ProjectService.getProjectInvitations(projectId);
      setInvitations(invitationList);
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待一覧の取得に失敗しました');
    } finally {
      setIsLoadingInvitations(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('メールアドレスを入力してください');
      return;
    }

    // 既にメンバーかチェック
    if (members.some(member => member.userEmail === email.trim())) {
      setError('このユーザーは既にプロジェクトのメンバーです');
      return;
    }

    // 既に招待済みかチェック
    if (invitations.some(inv => inv.email === email.trim())) {
      setError('このメールアドレスには既に招待を送信済みです');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await ProjectService.inviteToProject(projectId, email.trim(), role);
      setEmail('');
      await loadInvitations();
      onMembersUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    if (userRole !== 'owner') return;

    try {
      await ProjectService.updateMemberRole(projectId, userId, newRole);
      onMembersUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : '役割の更新に失敗しました');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (userRole !== 'owner') return;

    if (!confirm('このメンバーをプロジェクトから削除しますか？')) {
      return;
    }

    try {
      await ProjectService.removeMember(projectId, userId);
      onMembersUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの削除に失敗しました');
    }
  };

  const copyInviteLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      alert('招待リンクをクリップボードにコピーしました');
    });
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'オーナー';
      case 'editor': return '編集者';
      case 'viewer': return '閲覧者';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'editor': return 'bg-blue-100 text-blue-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-bold text-slate-800">プロジェクトメンバー管理</h3>
            <p className="text-sm text-slate-500 mt-1">{projectTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-slate-100"
          >
            <XIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          {error && <ErrorMessage message={error} />}

          {/* 招待フォーム */}
          {canManageMembers && (
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                <MailIcon className="w-5 h-5 mr-2" />
                新しいメンバーを招待
              </h4>
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="メールアドレス"
                    className="px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                    className="px-3 py-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  >
                    <option value="editor">編集者</option>
                    <option value="viewer">閲覧者</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-slate-400"
                  >
                    {isLoading ? <LoadingSpinner size="sm" color="border-white" /> : <PlusIcon className="w-4 h-4" />}
                    招待
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 現在のメンバー */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
              <UserIcon className="w-5 h-5 mr-2" />
              現在のメンバー ({members.length}人)
            </h4>
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                      <UserIcon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{member.userEmail}</p>
                      <p className="text-xs text-slate-500">
                        参加日: {new Date(member.joinedAt || member.invitedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {userRole === 'owner' && member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.userId, e.target.value as 'owner' | 'editor' | 'viewer')}
                        className="text-xs px-2 py-1 border border-slate-300 rounded"
                      >
                        <option value="editor">編集者</option>
                        <option value="viewer">閲覧者</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                        {getRoleDisplayName(member.role)}
                      </span>
                    )}
                    {userRole === 'owner' && member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1 text-red-500 hover:text-red-700 rounded"
                        title="メンバーを削除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 保留中の招待 */}
          {canManageMembers && (
            <div>
              <h4 className="font-semibold text-slate-800 mb-3 flex items-center">
                <ClockIcon className="w-5 h-5 mr-2" />
                保留中の招待
              </h4>
              {isLoadingInvitations ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner size="md" />
                </div>
              ) : invitations.length === 0 ? (
                <p className="text-slate-500 text-sm">保留中の招待はありません</p>
              ) : (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{invitation.email}</p>
                        <p className="text-xs text-slate-500">
                          {getRoleDisplayName(invitation.role)} として招待 • 
                          期限: {new Date(invitation.expiresAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      <button
                        onClick={() => copyInviteLink(invitation.token)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        リンクをコピー
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="p-6 bg-slate-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700"
          >
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ProjectInviteModal;