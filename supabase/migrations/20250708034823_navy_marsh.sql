/*
  # プロジェクトコラボレーションシステム

  1. 新しいテーブル
    - `project_members`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `user_id` (uuid, foreign key to auth.users)
      - `role` (text) - 'owner', 'editor', 'viewer'
      - `invited_by` (uuid, foreign key to auth.users)
      - `invited_at` (timestamp)
      - `joined_at` (timestamp)
      - `status` (text) - 'pending', 'accepted', 'declined'

    - `project_invitations`
      - `id` (uuid, primary key)
      - `project_id` (uuid, foreign key to projects)
      - `email` (text)
      - `role` (text) - 'editor', 'viewer'
      - `invited_by` (uuid, foreign key to auth.users)
      - `token` (text, unique) - 招待トークン
      - `expires_at` (timestamp)
      - `created_at` (timestamp)
      - `used_at` (timestamp)

  2. プロジェクトテーブルの更新
    - `last_modified_by` (uuid) - 最後に変更したユーザー
    - `version` (integer) - 楽観的ロック用

  3. セキュリティ
    - RLSポリシーの更新
    - メンバーシップベースのアクセス制御
*/

-- プロジェクトテーブルに新しいカラムを追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_modified_by uuid REFERENCES auth.users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- プロジェクトメンバーテーブル
CREATE TABLE IF NOT EXISTS project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- プロジェクト招待テーブル
CREATE TABLE IF NOT EXISTS project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- RLSを有効化
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- 既存のプロジェクトRLSポリシーを削除
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- 新しいプロジェクトRLSポリシー（メンバーシップベース）
CREATE POLICY "Users can view projects they are members of"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = projects.id 
      AND project_members.user_id = auth.uid()
      AND project_members.status = 'accepted'
    )
  );

CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Project members can update projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = projects.id 
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'editor')
      AND project_members.status = 'accepted'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = projects.id 
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'editor')
      AND project_members.status = 'accepted'
    )
  );

CREATE POLICY "Project owners can delete projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = projects.id 
      AND project_members.user_id = auth.uid()
      AND project_members.role = 'owner'
      AND project_members.status = 'accepted'
    )
  );

-- プロジェクトメンバーのRLSポリシー
CREATE POLICY "Users can view project members for their projects"
  ON project_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
      AND pm.status = 'accepted'
    )
  );

CREATE POLICY "Project owners can manage members"
  ON project_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = project_members.project_id 
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
      AND pm.status = 'accepted'
    )
  );

-- プロジェクト招待のRLSポリシー
CREATE POLICY "Users can view invitations for their projects"
  ON project_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = project_invitations.project_id 
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'editor')
      AND project_members.status = 'accepted'
    )
  );

CREATE POLICY "Project owners and editors can create invitations"
  ON project_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = project_invitations.project_id 
      AND project_members.user_id = auth.uid()
      AND project_members.role IN ('owner', 'editor')
      AND project_members.status = 'accepted'
    )
  );

-- プロジェクト作成時に自動的にオーナーとしてメンバーに追加する関数
CREATE OR REPLACE FUNCTION add_project_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.user_id, 'owner', 'accepted', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロジェクト作成時のトリガー
CREATE TRIGGER add_project_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_project_owner();

-- プロジェクト更新時にlast_modified_byとversionを更新する関数
CREATE OR REPLACE FUNCTION update_project_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified_by = auth.uid();
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- プロジェクト更新時のトリガー
CREATE TRIGGER update_project_metadata_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_metadata();

-- 招待トークンから参加する関数
CREATE OR REPLACE FUNCTION join_project_by_invitation(invitation_token text)
RETURNS json AS $$
DECLARE
  invitation_record project_invitations%ROWTYPE;
  project_record projects%ROWTYPE;
  current_user_id uuid;
BEGIN
  -- 現在のユーザーIDを取得
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'ログインが必要です');
  END IF;

  -- 招待を検索
  SELECT * INTO invitation_record
  FROM project_invitations
  WHERE token = invitation_token
    AND expires_at > now()
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', '無効または期限切れの招待です');
  END IF;

  -- プロジェクト情報を取得
  SELECT * INTO project_record
  FROM projects
  WHERE id = invitation_record.project_id;

  -- 既にメンバーかチェック
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = invitation_record.project_id
      AND user_id = current_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', '既にこのプロジェクトのメンバーです');
  END IF;

  -- メンバーとして追加
  INSERT INTO project_members (project_id, user_id, role, invited_by, status, joined_at)
  VALUES (
    invitation_record.project_id,
    current_user_id,
    invitation_record.role,
    invitation_record.invited_by,
    'accepted',
    now()
  );

  -- 招待を使用済みにマーク
  UPDATE project_invitations
  SET used_at = now()
  WHERE id = invitation_record.id;

  RETURN json_build_object(
    'success', true,
    'project', json_build_object(
      'id', project_record.id,
      'title', project_record.title,
      'goal', project_record.goal
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- リアルタイム更新のためのPublication作成
CREATE PUBLICATION project_changes FOR TABLE projects, project_members, project_invitations;