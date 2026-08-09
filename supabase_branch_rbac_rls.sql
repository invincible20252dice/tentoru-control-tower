-- ==============================================================================
-- TENTORU CONTROL TOWER: 本部・校舎マルチテナント RBAC & RLS セキュリティポリシー
-- ==============================================================================

-- 1. 校舎テーブル (branches) の作成
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 2. ユーザープロフィール / ロール管理テーブル (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'branch' CHECK (role IN ('admin', 'branch')),
    branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. students テーブルに branch_id カラムの追加（既存テーブルへの安全な拡張）
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'students' 
        AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE public.students ADD COLUMN branch_id TEXT REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. ヘルパー関数の定義（現在のユーザーロールおよび校舎IDの取得）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT (role = 'admin') 
        FROM public.profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT branch_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Row Level Security (RLS) の有効化
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 6. branches テーブルの RLS ポリシー
-- admin: 全権限
CREATE POLICY "Admin has full access to branches"
ON public.branches
FOR ALL
TO authenticated
USING (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role');

-- branch ユーザー: 自校舎の参照のみ
CREATE POLICY "Branch users can view their own branch"
ON public.branches
FOR SELECT
TO authenticated
USING (id = public.current_branch_id());

-- 7. students テーブルのマルチテナント RLS ポリシー
-- admin: 全校舎の生徒の閲覧・更新・削除が可能
CREATE POLICY "Admin has full access to students"
ON public.students
FOR ALL
TO authenticated
USING (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role');

-- branch: 自校舎（branch_id）または未所属の生徒のみ操作可能
CREATE POLICY "Branch users can access only their branch students"
ON public.students
FOR ALL
TO authenticated
USING (
    branch_id = public.current_branch_id() 
    OR classroom = (SELECT name FROM public.branches WHERE id = public.current_branch_id())
    OR branch_id IS NULL
)
WITH CHECK (
    branch_id = public.current_branch_id() 
    OR classroom = (SELECT name FROM public.branches WHERE id = public.current_branch_id())
    OR branch_id IS NULL
);

-- 8. 初期シードデータ
INSERT INTO public.branches (id, name, code, email, status, phone, address)
VALUES 
    ('branch-1', '恵比寿教室', 'EBISU', 'ebisu@tentoru.jp', 'active', '03-1234-5678', '東京都渋谷区恵比寿1-2-3 テントルビル2F'),
    ('branch-2', '渋谷教室', 'SHIBUYA', 'shibuya@tentoru.jp', 'active', '03-2345-6789', '東京都渋谷区道玄坂2-10-1 渋谷タワー3F'),
    ('branch-3', '新宿教室', 'SHINJUKU', 'shinjuku@tentoru.jp', 'active', '03-3456-7890', '東京都新宿区西新宿1-5-11 新宿セントラルビル4F'),
    ('branch-4', '横浜教室', 'YOKOHAMA', 'yokohama@tentoru.jp', 'suspended', '045-123-4567', '神奈川県横浜市西区みなとみらい2-1-1 横浜パークビル5F')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    email = EXCLUDED.email,
    status = EXCLUDED.status;
