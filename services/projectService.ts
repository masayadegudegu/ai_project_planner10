import { supabase } from '../lib/supabase';
import { ProjectTask, GanttItem, ProjectMember, ProjectInvitation, ProjectWithMetadata } from '../types';

export interface ProjectData {
  id: string;
  title: string;
  goal: string;
  targetDate: string;
  tasks: ProjectTask[];
  ganttData?: GanttItem[] | null;
  createdAt: string;
  updatedAt: string;
  lastModifiedBy?: string;
  version: number;
  userRole: 'owner' | 'editor' | 'viewer';
}

export class ProjectService {
  // プロジェクト一覧を取得
  static async getProjects(): Promise<ProjectData[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`);
    }

    return data.map(project => ({
      id: project.id,
      title: project.title,
      goal: project.goal,
      targetDate: project.target_date,
      tasks: project.tasks_data || [],
      ganttData: project.gantt_data,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      lastModifiedBy: project.last_modified_by,
      version: project.version || 1,
      userRole: project.project_members[0]?.role || 'viewer',
    }));
  }

  // プロジェクトの詳細情報とメンバー情報を取得
  static async getProjectWithMembers(projectId: string): Promise<ProjectWithMetadata> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    // プロジェクト情報を取得
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role)
      `)
      .eq('id', projectId)
      .single();

    if (projectError) {
      throw new Error(`プロジェクトの取得に失敗しました: ${projectError.message}`);
    }

    // メンバー情報を取得
    const { data: membersData, error: membersError } = await supabase
      .from('project_members')
      .select(`
        *,
        user:auth.users(email)
      `)
      .eq('project_id', projectId)
      .eq('status', 'accepted');

    if (membersError) {
      throw new Error(`メンバー情報の取得に失敗しました: ${membersError.message}`);
    }

    const members: ProjectMember[] = membersData.map(member => ({
      id: member.id,
      projectId: member.project_id,
      userId: member.user_id,
      role: member.role,
      invitedBy: member.invited_by,
      invitedAt: member.invited_at,
      joinedAt: member.joined_at,
      status: member.status,
      userEmail: member.user?.email,
    }));

    return {
      id: projectData.id,
      title: projectData.title,
      goal: projectData.goal,
      targetDate: projectData.target_date,
      tasks: projectData.tasks_data || [],
      ganttData: projectData.gantt_data,
      createdAt: projectData.created_at,
      updatedAt: projectData.updated_at,
      lastModifiedBy: projectData.last_modified_by,
      version: projectData.version || 1,
      userRole: projectData.project_members[0]?.role || 'viewer',
      members,
    };
  }

  // プロジェクトを作成
  static async createProject(
    title: string,
    goal: string,
    targetDate: string,
    tasks: ProjectTask[] = [],
    ganttData?: GanttItem[] | null
  ): Promise<ProjectData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        title,
        goal,
        target_date: targetDate,
        tasks_data: tasks,
        gantt_data: ganttData,
        last_modified_by: user.id,
        version: 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`プロジェクトの作成に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastModifiedBy: data.last_modified_by,
      version: data.version,
      userRole: 'owner',
    };
  }

  // プロジェクトを更新
  static async updateProject(
    id: string,
    updates: {
      title?: string;
      goal?: string;
      targetDate?: string;
      tasks?: ProjectTask[];
      ganttData?: GanttItem[] | null;
      expectedVersion?: number; // 楽観的ロック用
    }
  ): Promise<ProjectData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    // 楽観的ロックのチェック
    if (updates.expectedVersion !== undefined) {
      const { data: currentProject, error: checkError } = await supabase
        .from('projects')
        .select('version')
        .eq('id', id)
        .single();

      if (checkError) {
        throw new Error(`プロジェクトの確認に失敗しました: ${checkError.message}`);
      }

      if (currentProject.version !== updates.expectedVersion) {
        throw new Error('プロジェクトが他のユーザーによって更新されています。最新の状態を取得してから再度お試しください。');
      }
    }

    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.goal !== undefined) updateData.goal = updates.goal;
    if (updates.targetDate !== undefined) updateData.target_date = updates.targetDate;
    if (updates.tasks !== undefined) updateData.tasks_data = updates.tasks;
    if (updates.ganttData !== undefined) updateData.gantt_data = updates.ganttData;

    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        project_members!inner(role)
      `)
      .single();

    if (error) {
      throw new Error(`プロジェクトの更新に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastModifiedBy: data.last_modified_by,
      version: data.version,
      userRole: data.project_members[0]?.role || 'viewer',
    };
  }

  // プロジェクトを削除
  static async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`プロジェクトの削除に失敗しました: ${error.message}`);
    }
  }

  // 特定のプロジェクトを取得
  static async getProject(id: string): Promise<ProjectData> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(role)
      `)
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`プロジェクトの取得に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      title: data.title,
      goal: data.goal,
      targetDate: data.target_date,
      tasks: data.tasks_data || [],
      ganttData: data.gantt_data,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastModifiedBy: data.last_modified_by,
      version: data.version || 1,
      userRole: data.project_members[0]?.role || 'viewer',
    };
  }

  // プロジェクトに招待を送信
  static async inviteToProject(
    projectId: string,
    email: string,
    role: 'editor' | 'viewer'
  ): Promise<ProjectInvitation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('ログインが必要です');
    }

    const { data, error } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email,
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`招待の送信に失敗しました: ${error.message}`);
    }

    return {
      id: data.id,
      projectId: data.project_id,
      email: data.email,
      role: data.role,
      invitedBy: data.invited_by,
      token: data.token,
      expiresAt: data.expires_at,
      createdAt: data.created_at,
      usedAt: data.used_at,
    };
  }

  // 招待トークンでプロジェクトに参加
  static async joinProjectByInvitation(token: string): Promise<{ success: boolean; error?: string; project?: any }> {
    const { data, error } = await supabase.rpc('join_project_by_invitation', {
      invitation_token: token
    });

    if (error) {
      throw new Error(`プロジェクトへの参加に失敗しました: ${error.message}`);
    }

    return data;
  }

  // プロジェクトの招待一覧を取得
  static async getProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
    const { data, error } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', projectId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`招待一覧の取得に失敗しました: ${error.message}`);
    }
    return data.map(invitation => ({
      id: invitation.id,
      projectId: invitation.project_id,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invited_by,
      token: invitation.token,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
      usedAt: invitation.used_at,
    }));
  }

  // メンバーの役割を更新
  static async updateMemberRole(
    projectId: string,
    userId: string,
    newRole: 'owner' | 'editor' | 'viewer'
  ): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .update({ role: newRole })
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`メンバーの役割更新に失敗しました: ${error.message}`);
    }
  }

  // メンバーをプロジェクトから削除
  static async removeMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`メンバーの削除に失敗しました: ${error.message}`);
    }
  }

  // リアルタイム更新の購読
  static subscribeToProjectChanges(
    projectId: string,
    onProjectUpdate: (payload: any) => void,
    onMemberUpdate: (payload: any) => void
  ) {
    const projectChannel = supabase
      .channel(`project-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectId}`,
        },
        onProjectUpdate
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`,
        },
        onMemberUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(projectChannel);
    };
  }
}