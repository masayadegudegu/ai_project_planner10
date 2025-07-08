/*
  # プロジェクト管理スキーマの作成

  1. 新しいテーブル
    - `projects`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text)
      - `goal` (text)
      - `target_date` (date)
      - `tasks_data` (jsonb) - タスクデータをJSONBで保存
      - `gantt_data` (jsonb) - ガントチャートデータ
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. セキュリティ
    - プロジェクトテーブルでRLSを有効化
    - ユーザーは自分のプロジェクトのみアクセス可能
*/

CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  goal text NOT NULL,
  target_date date NOT NULL,
  tasks_data jsonb DEFAULT '[]'::jsonb,
  gantt_data jsonb DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のプロジェクトのみ表示可能
CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ユーザーは自分のプロジェクトのみ作成可能
CREATE POLICY "Users can create own projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のプロジェクトのみ更新可能
CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分のプロジェクトのみ削除可能
CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- updated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();