-- PostgreSQL / Supabase Schema for Individual Optimization & Learning Management System

-- 1. 学校マスター
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('elementary', 'junior_high', 'high_school')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 生徒アカウント
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL UNIQUE, -- 例: student12345
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE, -- 例: student12345@tentoru-student.com
    grade TEXT NOT NULL, -- 例: '小5', '中3'
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'fast', 'warning')), -- 状態（爆速、遅れ/パンクアラートなど）
    start_unit_id UUID, -- 学習スタート位置の単元ID
    period_count INTEGER NOT NULL DEFAULT 2 CHECK (period_count BETWEEN 2 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. 学校単位のマスターカリキュラム単元
CREATE TABLE IF NOT EXISTS curriculum_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject TEXT NOT NULL, -- 数学、英語、国語、理科、社会など
    name TEXT NOT NULL, -- 単元名
    sequence_order INTEGER NOT NULL, -- 並び順。年度途中に講師が変更可能
    google_drive_url TEXT, -- 印刷物用のGoogleドライブURL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (school_id, subject, id),
    UNIQUE (school_id, subject, sequence_order) DEFERRABLE INITIALLY DEFERRED
);

-- studentsのstart_unit_idの外部キー制約を追加
ALTER TABLE students ADD CONSTRAINT fk_start_unit FOREIGN KEY (start_unit_id) REFERENCES curriculum_units(id) ON DELETE SET NULL;

-- 4. 生徒ごとの学習タスク (Todo)
CREATE TABLE IF NOT EXISTS learning_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    period INTEGER, -- 1〜4時間目のコマ割り設定。1: 1時間目, 2: 2時間目, 3: 3時間目, 4: 4時間目
    status TEXT NOT NULL DEFAULT 'unstarted' CHECK (status IN ('unstarted', 'skipped', 'completed', 'failed')),
    video_watched BOOLEAN NOT NULL DEFAULT FALSE,
    test_passed BOOLEAN NOT NULL DEFAULT FALSE,
    office_note TEXT, -- 事務用備考欄。提出物の有無など
    actual_completed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (student_id, unit_id)
);

-- 5. 詳細な学習ログ
CREATE TABLE IF NOT EXISTS learning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES curriculum_units(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL CHECK (log_type IN ('video_view', 'test_result')),
    duration_seconds INTEGER DEFAULT 0,
    score INTEGER, -- テスト点数
    total_questions INTEGER,
    incorrect_genres TEXT[], -- 間違えたジャンル
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. 定期テスト・模試記録
CREATE TABLE IF NOT EXISTS test_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('regular_test', 'mock_exam')),
    subject TEXT, -- NULL 許容に変更 (定期テスト全体レコードなどに対応)
    score INTEGER, -- NULL 許容に変更 (定期テスト全体レコードなどに対応)
    rank_change TEXT CHECK (rank_change IN ('up', 'down', 'keep')),
    rate_change NUMERIC(5,2), -- 上昇・下降率 (%)
    next_target_score INTEGER,
    improvement_plan TEXT, -- 改善点
    target_school_code TEXT, -- 志望校コード（模試用）
    -- 定期テスト用の追加カラム
    test_name TEXT,
    score_japanese INTEGER,
    score_math INTEGER,
    score_english INTEGER,
    score_social INTEGER,
    score_science INTEGER,
    score_total INTEGER,
    class_rank TEXT,
    school_rank TEXT,
    deviation_value NUMERIC(4,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. 志望校コード表
CREATE TABLE IF NOT EXISTS school_codes_master (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    deviation_value INTEGER NOT NULL -- 基準偏差値
);

-- 8. 判定点数一覧
CREATE TABLE IF NOT EXISTS exam_thresholds_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_code TEXT NOT NULL REFERENCES school_codes_master(code) ON DELETE CASCADE,
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    probability INTEGER NOT NULL CHECK (probability BETWEEN 0 AND 100),
    UNIQUE (school_code, min_score, max_score)
);

-- 9. AI指導報告書
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- 例: '2026-06'
    analysis_text TEXT NOT NULL, -- AIポジティブ分析
    teacher_notes TEXT, -- 講師手動追加の二者面談結果・目標
    original_ai_text TEXT, -- 修正前のAIテキスト（学習用）
    final_text TEXT, -- 最終テキスト
    image_url TEXT, -- 画像化された報告書のURL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (student_id, month)
);

-- 10. AIプロンプト設定
CREATE TABLE IF NOT EXISTS prompt_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_template TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. 講師による手動修正履歴
CREATE TABLE IF NOT EXISTS teacher_corrections_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    original_text TEXT NOT NULL,
    corrected_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 初期プロンプト設定の挿入
INSERT INTO prompt_settings (prompt_template) VALUES (
    'あなたは個別指導塾の優秀な校舎長です。以下の学習ログ情報に基づいて、保護者に向けた「今月の頑張り・行動の成長」についての指導報告書を作成してください。

条件:
1. 点数が悪くても、行動の成長や努力した点（例：動画視聴時間、テストの受講回数など）に焦点を当て、ポジティブなトーンで執筆してください。
2. 専門用語は避け、保護者にも分かりやすい日本語で書いてください。
3. 文字数は250〜400文字程度としてください。
4. 相手の強みを褒めちぎるスタイルを維持してください。

学習ログデータ：
- 動画視聴時間合計: {video_duration}分
- テスト合格単元数: {passed_units_count}単元
- テスト平均正答率: {average_score}%
- 苦手・間違えたジャンル: {incorrect_genres}'
) ON CONFLICT DO NOTHING;

-- 12. 年間計画（マイルストーン）
CREATE TABLE IF NOT EXISTS milestone_plans (
    id TEXT PRIMARY KEY,
    grade TEXT NOT NULL,
    subject TEXT NOT NULL,
    course TEXT NOT NULL CHECK (course IN ('standard', 'advanced')),
    month INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    holiday_name TEXT,
    level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C')),
    chapter TEXT,
    unit_name TEXT,
    target_theme_name TEXT,
    target_sequence_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. マイルストーンテンプレート
CREATE TABLE IF NOT EXISTS milestone_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    subject TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C')),
    plans JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 既存の students テーブルへの level カラム追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'A' CHECK (level IN ('A', 'B', 'C'));

-- 既存の students テーブルへの属性拡張カラム追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS name_kana TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS club_activities TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS hobbies TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_name TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS contact_time TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS personalities TEXT[] DEFAULT '{}';
ALTER TABLE students ADD COLUMN IF NOT EXISTS target_school TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS classroom TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS teacher_in_charge TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_year INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS registered_grade TEXT;

-- 14. 生徒対応ログ履歴
CREATE TABLE IF NOT EXISTS student_interactions (
    id TEXT PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('保護者対応', '人生相談', '勉強相談', '学校相談', 'その他')),
    memo TEXT NOT NULL,
    date DATE NOT NULL,
    staff_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. 個性タグ選択肢マスター
CREATE TABLE IF NOT EXISTS personality_options (
    name TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 初期個性の挿入
INSERT INTO personality_options (name) VALUES
('ぱっと見大人しい'),
('スイッチ入るとよく喋る'),
('班長'),
('合唱実行委員長'),
('音楽の授業は好き'),
('礼儀正しくちゃんと敬語使える')
ON CONFLICT DO NOTHING;

-- 16. 小テスト結果
CREATE TABLE IF NOT EXISTS mini_test_results (
    id TEXT PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    test_content TEXT NOT NULL,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. 宿題提出状況
CREATE TABLE IF NOT EXISTS homework_results (
    id TEXT PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    homework_content TEXT NOT NULL,
    homework_deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'completed', 'skipped')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. 自作授業用のYouTubeリンク等のカラムをcurriculum_unitsに追加
ALTER TABLE curriculum_units ADD COLUMN IF NOT EXISTS link_url TEXT;

-- 19. 自由記述用の授業マスタテーブルを新規追加
CREATE TABLE IF NOT EXISTS custom_classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. studentsテーブルへ教科別の学習スタート位置カラムを追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_unit_math UUID REFERENCES curriculum_units(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_unit_english UUID REFERENCES curriculum_units(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_unit_science UUID REFERENCES curriculum_units(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_unit_social UUID REFERENCES curriculum_units(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS start_unit_japanese UUID REFERENCES curriculum_units(id) ON DELETE SET NULL;

-- 21. 小テスト結果およびタスクに合格ラインカラムを追加
ALTER TABLE mini_test_results ADD COLUMN IF NOT EXISTS passing_line TEXT;
ALTER TABLE learning_tasks ADD COLUMN IF NOT EXISTS passing_line TEXT;

-- 22. 小テスト結果および宿題に適用対象（scope）カラムを追加
ALTER TABLE mini_test_results ADD COLUMN IF NOT EXISTS target_scope TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE homework_results ADD COLUMN IF NOT EXISTS target_scope TEXT NOT NULL DEFAULT 'individual';

-- 23. 小テスト結果テーブルへ合格フラグ passed カラムを追加
ALTER TABLE mini_test_results ADD COLUMN IF NOT EXISTS passed BOOLEAN;

-- 24. studentsテーブルへ週の授業回数、授業時間カラムを追加
ALTER TABLE students ADD COLUMN IF NOT EXISTS weekly_sessions_count TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS weekly_duration_minutes TEXT;
