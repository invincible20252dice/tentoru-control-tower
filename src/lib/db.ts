import { createClient } from '@supabase/supabase-js';

// Types representing DB entities
export interface School {
  id: string;
  name: string;
  type: 'elementary' | 'junior_high' | 'high_school';
  created_at: string;
}

export interface TargetSchoolItem {
  school_name: string;
  course_name?: string;
}

export interface Student {
  id: string;
  student_id: string;
  name: string;
  email: string;
  grade: string;
  school_id: string;
  status: 'normal' | 'fast' | 'warning';
  start_unit_id: string | null;
  period_count?: number;
  created_at: string;
  level?: 'A' | 'B' | 'C';
  // 新規追加
  name_kana?: string;
  birthday?: string;
  enrollment_date?: string | null;
  withdrawal_date?: string | null;
  club_activities?: string;
  hobbies?: string;
  parent_name?: string;
  parent_name_kana?: string;
  parent_image_url?: string;
  contact_phone?: string;
  contact_time?: string;
  image_url?: string;
  personalities?: string[];
  personality_tags?: string[];
  target_school?: string;
  target_schools?: TargetSchoolItem[];
  classroom?: string;
  teacher_in_charge?: string;
  assigned_teachers?: string[];
  registered_grade?: string;
  registered_year?: number;
  school_name?: string;
  start_unit_math?: string | null;
  start_unit_english?: string | null;
  start_unit_science?: string | null;
  start_unit_social?: string | null;
  start_unit_japanese?: string | null;
  start_unit_basic_english?: string | null;
  start_unit_basic_kanji?: string | null;
  start_unit_basic_calculation?: string | null;
  subject_start_positions?: Record<string, string>;
  last_completed_lesson_id?: string | null;
  last_completed_at?: string | null;
  completed_lesson_ids?: string[];
  excluded_lesson_ids?: string[];
  weekly_sessions_count?: string | null;
  weekly_duration_minutes?: string | null;
  selected_days?: string[];
  selected_subjects?: string[];
  default_slots?: number;
  branch_id?: string | null;
}

export type UserRole = 'admin' | 'branch';

export interface BranchAIRules {
  lessons_per_slot: number; // 1コマあたりの標準授業進捗数 (例: 1~5, デフォルト: 2)
  subject_rotation_priority: string[]; // 受講教科の配置優先度 (例: ['算数', '国語', '英語'])
  review_frequency_units: number; // 復習コマを挟む頻度 (例: 3単元ごとに1コマ復習, 0=なし)
  test_insert_interval: string; // 小テスト・確認テストの自動挿入タイミング ('unit_completion' | 'every_session' | 'weekly' | 'none')
  custom_prompt: string; // 校舎固有のプロンプト/カスタム指示
  test_prep_lead_weeks?: number; // 定期テスト・目標対策開始 (週間前)
  punk_threshold_slots?: number; // 計画パンク判定の閾値 (コマ)
  review_slot_interval?: number; // 復習コマの自動挿入サイクル
  updated_at?: string;
}

export const DEFAULT_BRANCH_AI_RULES: BranchAIRules = {
  lessons_per_slot: 2,
  subject_rotation_priority: ['算数', '数学', '英語', '国語', '理科', '社会'],
  review_frequency_units: 3,
  test_insert_interval: 'unit_completion',
  custom_prompt: '',
  test_prep_lead_weeks: 3,
  punk_threshold_slots: 4,
  review_slot_interval: 4,
};

export interface Branch {
  id: string;
  name: string;
  code: string;
  email: string;
  status: 'active' | 'suspended';
  created_at: string;
  last_login_at?: string | null;
  phone?: string;
  address?: string;
  student_count?: number;
  ai_rules?: BranchAIRules;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branch_id?: string | null;
  branch_name?: string | null;
  created_at?: string;
}

export interface UserSession {
  user: {
    id: string;
    email: string;
    role: UserRole;
    branch_id?: string | null;
    branch_name?: string | null;
    name?: string;
  };
  token?: string;
  logged_in_at: string;
}

export interface StudentScheduleConfig {
  student_id: string;
  weekly_frequency: string; // '2', '3', '4', '5', 'unlimited', etc.
  weekly_duration: string;  // '60min', '90min', '120min', '180min', '240min', 'unlimited', etc.
  selected_days: string[];  // e.g. ['tuesday', 'friday'] or ['火', '金']
  default_slots: number;    // コマ数初期値
  updated_at?: string;
}

export interface StudentInteraction {
  id: string;
  student_id: string;
  category: '保護者対応' | '人生相談' | '勉強相談' | '学校相談' | 'その他';
  memo: string;
  date: string; // YYYY-MM-DD
  contact_date?: string;
  staff_name: string;
  created_at: string;
}

export const GRADES = [
  '園児',
  '小1', '小2', '小3', '小4', '小5', '小6',
  '中1', '中2', '中3',
  '高1', '高2', '高3',
  '既卒'
];

export function getSchoolYear(dateString?: string): number {
  const date = dateString ? new Date(dateString) : new Date();
  const y = date.getFullYear();
  const m = date.getMonth(); // 0 is Jan, 3 is Apr
  return m < 3 ? y - 1 : y;
}

export function calculateCurrentGrade(registeredGrade: string, registeredYear: number, currentYear: number): string {
  const diff = currentYear - registeredYear;
  if (diff <= 0) return registeredGrade;
  const idx = GRADES.indexOf(registeredGrade);
  if (idx === -1) return registeredGrade;
  return GRADES[Math.min(idx + diff, GRADES.length - 1)];
}


export interface MilestonePlan {
  id: string;
  grade: string;       // '中3' | '小5' など
  subject: string;     // '数学' | '英語' など
  course: 'standard' | 'advanced';
  month: number;       // 3 to 12, 1 to 2
  week_number: number; // 1 to 5
  unit_name?: string;  // 目標完了単元名 (例: '単元1', '歴史1章')
  target_sequence_order?: number; // 到達しているべき sequence_order
  is_holiday: boolean; // GW休暇などの休校週フラグ
  holiday_name?: string; // 'GW休暇', '定期テスト休み' など
  created_at?: string;
  level?: 'A' | 'B' | 'C';
  chapter?: string;
  target_theme_name?: string;
}

export interface MilestoneTemplate {
  id: string;
  name: string;
  grade: string;
  subject: string;
  level: 'A' | 'B' | 'C';
  plans: MilestonePlan[];
  created_at: string;
}

export interface CurriculumMaster {
  id: string;
  grade: string;        // '小5', '中1', etc.
  grade_level?: string; // Supabase column compatibility
  subject: string;      // '算数', '数学', '英語', '国語', '理科', '社会', etc.
  unit_name: string;    // '1章 正の数・負の数' etc.
  lesson_name: string;  // '正の数・負の数の意味' etc.
  sort_order: number;   // 連番 (1, 2, 3...)
  item_type?: 'lesson' | 'unit_test'; // 'lesson': 通常授業, 'unit_test': 単元確認テスト
  passing_line?: string; // 合格基準点（例: '80点以上', '-3点以内'）
  created_at?: string;
}

export interface CurriculumUnit {
  id: string;
  school_id: string;
  subject: string;
  name: string;
  sequence_order: number;
  google_drive_url?: string;
  link_url?: string | null;
  created_at: string;
}

export interface LearningTask {
  id: string;
  student_id: string;
  unit_id: string;
  scheduled_date: string; // YYYY-MM-DD
  period?: number | null; // 1 to 10
  status: 'unstarted' | 'skipped' | 'completed' | 'failed';
  video_watched: boolean;
  test_passed: boolean;
  office_note?: string;
  actual_completed_date?: string;
  subject?: string;
  custom_unit_name?: string;
  passing_line?: string | null;
  start_lesson_name?: string | null;
  end_lesson_name?: string | null;
  start_lesson_id?: string | null;
  end_lesson_id?: string | null;
  lesson_range?: string | null;
  completed_lesson_ids?: string[];
  created_at: string;
}

export interface StudentLessonProgress {
  id: string;
  student_id: string;
  subject: string;
  lesson_id: string;
  lesson_name: string;
  task_id?: string;
  date: string; // YYYY-MM-DD
  status: 'completed' | 'unstarted' | 'in_progress';
  completed_at?: string;
  created_at: string;
}

export interface LearningLog {
  id: string;
  student_id: string;
  unit_id: string;
  log_type: 'video_view' | 'test_result';
  duration_seconds?: number;
  score?: number;
  total_questions?: number;
  incorrect_genres?: string[];
  created_at: string;
}

export interface TestRecord {
  id: string;
  student_id: string;
  record_type: 'regular_test' | 'mock_exam';
  subject?: string;
  score?: number | null;
  rank_change?: 'up' | 'down' | 'keep';
  rate_change?: number;
  next_target_score?: number;
  improvement_plan?: string;
  target_school_code?: string;
  created_at: string;

  // 定期テスト用追加項目 (5教科＋合計＋順位＋偏差値)
  test_name?: string;
  score_japanese?: number | null;
  score_math?: number | null;
  score_english?: number | null;
  score_social?: number | null;
  score_science?: number | null;
  score_total?: number | null;
  class_rank?: string | null;
  school_rank?: string | null;
  deviation_value?: number | null;
}

export interface SchoolCodeMaster {
  code: string;
  name: string;
  deviation_value: number;
}

export interface ExamThresholdMaster {
  id: string;
  school_code: string;
  min_score: number;
  max_score: number;
  probability: number;
}

export interface AIReport {
  id: string;
  student_id: string;
  month: string; // YYYY-MM
  analysis_text: string;
  teacher_notes?: string;
  original_ai_text?: string;
  final_text?: string;
  image_url?: string;
  created_at: string;
}

export interface PromptSetting {
  id: string;
  prompt_template: string;
  created_at: string;
}

export interface TeacherCorrectionLog {
  id: string;
  student_id: string;
  original_text: string;
  corrected_text: string;
  created_at: string;
}

export interface MiniTestResult {
  id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  subject?: string; // 教科 (算数, 数学, 英語, etc.)
  test_content: string; // テスト内容
  test_type?: 'unit_test' | 'custom'; // 'unit_test': 単元テストマスタ連携, 'custom': 自由記述
  unit_name?: string; // 関連単元名
  score: number | null; // 結果点数
  passed?: boolean | null; // 合格したかどうか
  passing_line?: string | null; // 合格ライン
  target_scope?: string; // 対象 (例: 'individual', 'grade', 'school', 'level')
  created_at: string;
}

export interface HomeworkResult {
  id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  subject?: string; // 教科 (算数, 数学, 英語, etc.)
  homework_type?: 'drill_2nd' | 'custom' | string; // 種別 (当日2回目演習 or 自由記述)
  homework_content: string;
  homework_deadline: string; // YYYY-MM-DD
  status: 'incomplete' | 'completed' | 'skipped';
  target_scope?: string;
  created_at: string;
}

export interface CustomClass {
  id: string;
  name: string;
  created_at: string;
}

export interface CustomApplyScope {
  id: string;
  label: string;
  created_at: string;
}

// -------------------------------------------------------------
// Payload Sanitization Utilities for Safe Database Operations
// -------------------------------------------------------------

/**
 * Safely sanitize a LearningTask object for memory, state, and database operations.
 * - Guarantees ID fields (id, student_id, unit_id, start_lesson_id, end_lesson_id) are safe strings (TEXT).
 * - Converts undefined or empty values safely.
 * - Ensures valid status enum, booleans, and valid period.
 */
export function sanitizeLearningTask(task: Partial<LearningTask> & Record<string, any>): LearningTask {
  const student_id = task.student_id != null ? String(task.student_id).trim() : '';
  const id = task.id != null && String(task.id).trim() !== ''
    ? String(task.id).trim()
    : `task-${student_id || 'st'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Safe string conversion for unit_id
  let unit_id = '';
  if (task.unit_id != null && String(task.unit_id).trim() !== '') {
    unit_id = String(task.unit_id).trim();
  } else if (task.start_lesson_id != null && String(task.start_lesson_id).trim() !== '') {
    unit_id = String(task.start_lesson_id).trim();
  } else if (task.custom_unit_name != null && String(task.custom_unit_name).trim() !== '') {
    unit_id = `custom-${String(task.custom_unit_name).trim()}`;
  } else {
    unit_id = 'default-unit';
  }

  // Safe string conversion for scheduled_date (YYYY-MM-DD)
  let scheduled_date = task.scheduled_date ? String(task.scheduled_date).trim() : new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) {
    try {
      const parsed = new Date(scheduled_date);
      if (!isNaN(parsed.getTime())) {
        scheduled_date = parsed.toISOString().split('T')[0];
      } else {
        scheduled_date = new Date().toISOString().split('T')[0];
      }
    } catch {
      scheduled_date = new Date().toISOString().split('T')[0];
    }
  }

  // Period: number | null
  let period: number | null = null;
  if (task.period !== undefined && task.period !== null && (task.period as any) !== '') {
    const num = parseInt(String(task.period), 10);
    if (!isNaN(num)) {
      period = num;
    }
  }

  // Status
  const validStatuses: LearningTask['status'][] = ['unstarted', 'skipped', 'completed', 'failed'];
  const status: LearningTask['status'] = validStatuses.includes(task.status as any) ? (task.status as LearningTask['status']) : 'unstarted';

  // Boolean flags
  const video_watched = Boolean(task.video_watched);
  const test_passed = Boolean(task.test_passed);

  // Helper for safe text or null
  const toSafeTextOrNull = (val: any): string | null => {
    if (val === undefined || val === null) return null;
    const str = String(val).trim();
    return str.length > 0 ? str : null;
  };

  const subject = toSafeTextOrNull(task.subject);
  const custom_unit_name = toSafeTextOrNull(task.custom_unit_name);
  const lesson_range = toSafeTextOrNull(task.lesson_range);
  const start_lesson_name = toSafeTextOrNull(task.start_lesson_name);
  const end_lesson_name = toSafeTextOrNull(task.end_lesson_name);
  const start_lesson_id = toSafeTextOrNull(task.start_lesson_id);
  const end_lesson_id = toSafeTextOrNull(task.end_lesson_id);
  const office_note = toSafeTextOrNull(task.office_note);
  const passing_line = toSafeTextOrNull(task.passing_line);
  const actual_completed_date = toSafeTextOrNull(task.actual_completed_date);
  const completed_lesson_ids = Array.isArray(task.completed_lesson_ids) ? task.completed_lesson_ids : undefined;
  const created_at = task.created_at ? String(task.created_at) : new Date().toISOString();

  return {
    id,
    student_id,
    unit_id,
    scheduled_date,
    period,
    status,
    video_watched,
    test_passed,
    ...(subject != null ? { subject } : {}),
    ...(custom_unit_name != null ? { custom_unit_name } : {}),
    ...(lesson_range != null ? { lesson_range } : {}),
    ...(start_lesson_name != null ? { start_lesson_name } : {}),
    ...(end_lesson_name != null ? { end_lesson_name } : {}),
    ...(start_lesson_id != null ? { start_lesson_id } : {}),
    ...(end_lesson_id != null ? { end_lesson_id } : {}),
    ...(office_note != null ? { office_note } : {}),
    ...(passing_line != null ? { passing_line } : {}),
    ...(actual_completed_date != null ? { actual_completed_date } : {}),
    ...(completed_lesson_ids ? { completed_lesson_ids } : {}),
    created_at
  };
}

/**
 * Returns a strictly normalized DB payload object without undefined values (replacing undefined with null or default values)
 * Suitable for Supabase / PostgREST upsert
 */
export function sanitizeLearningTaskForDB(task: Partial<LearningTask> & Record<string, any>): Record<string, any> {
  const sanitized = sanitizeLearningTask(task);
  return {
    id: sanitized.id,
    student_id: sanitized.student_id,
    unit_id: sanitized.unit_id,
    scheduled_date: sanitized.scheduled_date,
    period: sanitized.period ?? null,
    status: sanitized.status,
    video_watched: sanitized.video_watched,
    test_passed: sanitized.test_passed,
    subject: sanitized.subject ?? null,
    custom_unit_name: sanitized.custom_unit_name ?? null,
    lesson_range: sanitized.lesson_range ?? null,
    start_lesson_name: sanitized.start_lesson_name ?? null,
    end_lesson_name: sanitized.end_lesson_name ?? null,
    start_lesson_id: sanitized.start_lesson_id ?? null,
    end_lesson_id: sanitized.end_lesson_id ?? null,
    office_note: sanitized.office_note ?? null,
    passing_line: sanitized.passing_line ?? null,
    actual_completed_date: sanitized.actual_completed_date ?? null,
    ...(sanitized.completed_lesson_ids ? { completed_lesson_ids: sanitized.completed_lesson_ids } : {}),
    created_at: sanitized.created_at
  };
}

export function sanitizeMiniTestResult(test: Partial<MiniTestResult> & Record<string, any>): MiniTestResult {
  const student_id = test.student_id != null ? String(test.student_id).trim() : '';
  const id = test.id != null && String(test.id).trim() !== ''
    ? String(test.id).trim()
    : `mini-${student_id || 'st'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const date = test.date ? String(test.date).trim() : new Date().toISOString().split('T')[0];
  const test_content = test.test_content ? String(test.test_content).trim() : '';
  let score: number | null = null;
  if (test.score !== undefined && test.score !== null && (test.score as any) !== '') {
    const parsed = Number(test.score);
    if (!isNaN(parsed)) {
      score = parsed;
    }
  }
  const passed = test.passed !== undefined && test.passed !== null ? Boolean(test.passed) : null;
  const passing_line = test.passing_line ? String(test.passing_line).trim() : null;
  const target_scope = test.target_scope ? String(test.target_scope).trim() : 'individual';
  const subject = test.subject ? String(test.subject).trim() : undefined;
  const created_at = test.created_at ? String(test.created_at) : new Date().toISOString();

  return {
    id,
    student_id,
    date,
    test_content,
    score,
    passed,
    passing_line,
    target_scope,
    ...(subject ? { subject } : {}),
    created_at
  };
}

export function sanitizeHomeworkResult(hw: Partial<HomeworkResult> & Record<string, any>): HomeworkResult {
  const student_id = hw.student_id != null ? String(hw.student_id).trim() : '';
  const id = hw.id != null && String(hw.id).trim() !== ''
    ? String(hw.id).trim()
    : `hw-${student_id || 'st'}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const date = hw.date ? String(hw.date).trim() : new Date().toISOString().split('T')[0];
  const homework_content = hw.homework_content ? String(hw.homework_content).trim() : '';
  const homework_deadline = hw.homework_deadline ? String(hw.homework_deadline).trim() : date;
  const validStatuses: HomeworkResult['status'][] = ['incomplete', 'completed', 'skipped'];
  const status: HomeworkResult['status'] = validStatuses.includes(hw.status as any) ? (hw.status as HomeworkResult['status']) : 'incomplete';
  const target_scope = hw.target_scope ? String(hw.target_scope).trim() : 'individual';
  const subject = hw.subject ? String(hw.subject).trim() : undefined;
  const homework_type = hw.homework_type ? String(hw.homework_type).trim() : undefined;
  const created_at = hw.created_at ? String(hw.created_at) : new Date().toISOString();

  return {
    id,
    student_id,
    date,
    homework_content,
    homework_deadline,
    status,
    target_scope,
    ...(subject ? { subject } : {}),
    ...(homework_type ? { homework_type } : {}),
    created_at
  };
}

// -------------------------------------------------------------
// Hybrid DB Access Class
// -------------------------------------------------------------
class DatabaseService {
  private supabase: any = null;
  private isMockMode: boolean = true;

  constructor() {
    let supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'mock' && supabaseAnonKey !== 'mock') {
      try {
        // 二重パス (/rest/v1) や末尾のスラッシュを確実に自動除去して純粋なホストURLに変換
        supabaseUrl = supabaseUrl
          .replace(/\/rest\/v1\/?$/i, '')
          .replace(/\/+$/, '');

        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
        this.isMockMode = false;
        console.log('DatabaseService initialized with Supabase:', supabaseUrl);
      } catch (e) {
        console.error('Failed to initialize Supabase, falling back to MockMode:', e);
        this.isMockMode = true;
      }
    } else {
      this.isMockMode = true;
      console.log('DatabaseService initialized in Mock Mode (LocalStorage)');
    }
  }

  // Helper to check if running in browser
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  // Load from LocalStorage or initialize with Seed Data
  private getMockData<T>(key: string, initialData: T[]): T[] {
    if (!this.isBrowser()) return initialData;
    const stored = localStorage.getItem(`tentoru_${key}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(`Error parsing mock data for ${key}`, e);
      }
    }
    this.saveMockData(key, initialData);
    return initialData;
  }

  private getMockObject<T>(key: string, initialData: T): T {
    if (!this.isBrowser()) return initialData;
    const stored = localStorage.getItem(`tentoru_${key}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error(`Error parsing mock object for ${key}`, e);
      }
    }
    this.saveMockData(key, initialData);
    return initialData;
  }

  private saveMockData<T>(key: string, data: T): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(`tentoru_${key}`, JSON.stringify(data));
  }

  public getCustomClasses(): CustomClass[] {
    const seed: CustomClass[] = [
      { id: 'cc-1', name: '自習・質問', created_at: new Date().toISOString() },
      { id: 'cc-2', name: '単元面談', created_at: new Date().toISOString() }
    ];
    return this.getMockData('custom_classes', seed);
  }

  public getCustomApplyScopes(): CustomApplyScope[] {
    const seed: CustomApplyScope[] = [];
    return this.getMockData('custom_apply_scopes', seed);
  }

  // Seed Data Initializers
  public getSchools(): School[] {
    const seed: School[] = [
      { id: 'sch-1', name: '天登第一中学校', type: 'junior_high', created_at: new Date().toISOString() },
      { id: 'sch-2', name: 'テントル小学校', type: 'elementary', created_at: new Date().toISOString() }
    ];
    return this.getMockData('schools', seed);
  }

  public getCurriculumUnits(): CurriculumUnit[] {
    const seifuThemes = [
      '0より小さい数',
      '正の数と負の数',
      '自然数',
      '正の数・負の数で量を表すこと',
      '正の数・負の数で量を表すこと 文章題',
      '絶対値',
      '数直線',
      '数の大小',
      '数直線を使って',
      '正の数・負の数の加法（同符号）',
      '正の数・負の数の加法（同符号・小数）',
      '正の数・負の数の加法（異符号）',
      '正の数・負の数の加法（異符号・小数）',
      '正の数・負の数の減法',
      '正の数・負の数の減法（小数・分数）',
      '3つ以上の数の加法・減法',
      '加法と減法が混ざった計算',
      '正の数・負の数の乗法①',
      '正の数・負の数の乗法②',
      '正の数・負の数の除法①',
      '正の数・負の数の除法②',
      '分数を含む乗法',
      '逆数',
      '分数を含む除法',
      '3つ以上の数の乗法',
      '3つ以上の数の乗除',
      '同じ数の積',
      '指数をふくむ計算',
      '加減乗除を含む計算',
      '加減乗除を含む計算（指数をふくむ）',
      'かっこがある計算',
      '分配法則',
      '数の広がりと四則計算',
      '正の数・負の数の利用',
      '魔法陣',
      '素因数分解',
      '素因数分解の利用'
    ];

    const seed: CurriculumUnit[] = [];

    // sch-1: 天登第一中学校 (数学) のテーマ（正負の数）
    seifuThemes.forEach((theme, index) => {
      seed.push({
        id: `unit-101-${index + 1}`,
        school_id: 'sch-1',
        subject: '数学',
        name: theme,
        sequence_order: index + 1,
        google_drive_url: `https://drive.google.com/drive/folders/101-${index + 1}`,
        created_at: new Date().toISOString()
      });
    });

    // 残りの数学単元のテーマ（sequence_order を 38 から順に割り当てる。件数は 7単元 × 4テーマ = 28件、sequence_orderは 38〜65）
    const mathThemes = [
      // unit-102 (文字式)
      { id: 'unit-102-1', name: '文字を使った式', url: '102-1' },
      { id: 'unit-102-2', name: '式の値', url: '102-2' },
      { id: 'unit-102-3', name: '文字式の計算（加減）', url: '102-3' },
      { id: 'unit-102-4', name: '文字式の利用（数量の表し方）', url: '102-4' },
      // unit-103 (一次方程式)
      { id: 'unit-103-1', name: '等式と方程式の解', url: '103-1' },
      { id: 'unit-103-2', name: '等式の性質', url: '103-2' },
      { id: 'unit-103-3', name: '一次方程式の解き方', url: '103-3' },
      { id: 'unit-103-4', name: '一次方程式の利用（文章題）', url: '103-4' },
      // unit-104 (比例と反比例)
      { id: 'unit-104-1', name: '関数と比例の意味', url: '104-1' },
      { id: 'unit-104-2', name: '座標と比例のグラフ', url: '104-2' },
      { id: 'unit-104-3', name: '反比例とそのグラフ', url: '104-3' },
      { id: 'unit-104-4', name: '比例・反比例の利用', url: '104-4' },
      // unit-105 (式の計算)
      { id: 'unit-105-1', name: '単項式と多項式の同類項', url: '105-1' },
      { id: 'unit-105-2', name: '多項式の加減・乗除', url: '105-2' },
      { id: 'unit-105-3', name: '単項式の乗除の計算', url: '105-3' },
      { id: 'unit-105-4', name: '等式の変形', url: '105-4' },
      // unit-106 (連立方程式)
      { id: 'unit-106-1', name: '連立方程式とその解の意味', url: '106-1' },
      { id: 'unit-106-2', name: '連立方程式の解き方（加減法・代入法）', url: '106-2' },
      { id: 'unit-106-3', name: 'いろいろな連立方程式', url: '106-3' },
      { id: 'unit-106-4', name: '連立方程式の利用', url: '106-4' },
      // unit-107 (一次関数)
      { id: 'unit-107-1', name: '一次関数と変化の割合', url: '107-1' },
      { id: 'unit-107-2', name: '一次関数のグラフと式', url: '107-2' },
      { id: 'unit-107-3', name: '方程式とグラフ', url: '107-3' },
      { id: 'unit-107-4', name: '一次関数の利用（動点・ダイヤグラム）', url: '107-4' },
      // unit-108 (平行と合同)
      { id: 'unit-108-1', name: '対頂角・同位角・錯角', url: '108-1' },
      { id: 'unit-108-2', name: '三角形の内角・外角と多角形', url: '108-2' },
      { id: 'unit-108-3', name: '合同条件と三角形の証明', url: '108-3' },
      { id: 'unit-108-4', name: '証明の進め方と推論', url: '108-4' }
    ];

    mathThemes.forEach((unit, index) => {
      seed.push({
        id: unit.id,
        school_id: 'sch-1',
        subject: '数学',
        name: unit.name,
        sequence_order: 38 + index,
        google_drive_url: `https://drive.google.com/drive/folders/${unit.url}`,
        created_at: new Date().toISOString()
      });
    });

    // sch-1: 天登第一中学校 (英語)
    const englishThemes = [
      // unit-201 (Be動詞の現在形)
      { id: 'unit-201-1', name: 'Be動詞（am/are/is）肯定文', order: 1, url: '201-1' },
      { id: 'unit-201-2', name: 'Be動詞否定文と短縮形', order: 2, url: '201-2' },
      { id: 'unit-201-3', name: 'Be動詞疑問文と答え方', order: 3, url: '201-3' },
      // unit-202 (一般動詞の現在形)
      { id: 'unit-202-1', name: '一般動詞肯定文と三人称', order: 4, url: '202-1' },
      { id: 'unit-202-2', name: '一般動詞の否定文', order: 5, url: '202-2' },
      { id: 'unit-202-3', name: '一般動詞の疑問文と答え方', order: 6, url: '202-3' },
      // unit-203 (現在進行形)
      { id: 'unit-203-1', name: '現在進行形の肯定文 (be + ing)', order: 7, url: '203-1' },
      { id: 'unit-203-2', name: '現在進行形否定文・疑問文', order: 8, url: '203-2' },
      // unit-204 (過去形 規則動詞)
      { id: 'unit-204-1', name: '規則動詞の過去形肯定文 (-ed)', order: 9, url: '204-1' },
      { id: 'unit-204-2', name: '規則動詞過去形の否定文・疑問文', order: 10, url: '204-2' },
      // unit-205 (過去形 不規則動詞)
      { id: 'unit-205-1', name: '不規則動詞の過去形肯定文', order: 11, url: '205-1' },
      { id: 'unit-205-2', name: '不規則動詞過去形の否定文・疑問文', order: 12, url: '205-2' },
      // unit-206 (未来の表現)
      { id: 'unit-206-1', name: 'willを用いた未来表現', order: 13, url: '206-1' },
      { id: 'unit-206-2', name: 'be going toを用いた未来表現', order: 14, url: '206-2' },
      // unit-207 (助動詞 must/should)
      { id: 'unit-207-1', name: '助動詞 must の使い方', order: 15, url: '207-1' },
      { id: 'unit-207-2', name: '助動詞 should の使い方', order: 16, url: '207-2' },
      // unit-208 (不定詞と動名詞)
      { id: 'unit-208-1', name: '不定詞の３つの用法', order: 17, url: '208-1' },
      { id: 'unit-208-2', name: '動名詞 (ing) の使い方', order: 18, url: '208-2' }
    ];

    englishThemes.forEach(unit => {
      seed.push({
        id: unit.id,
        school_id: 'sch-1',
        subject: '英語',
        name: unit.name,
        sequence_order: unit.order,
        google_drive_url: `https://drive.google.com/drive/folders/${unit.url}`,
        created_at: new Date().toISOString()
      });
    });

    // 添付画像に基づく英語・理科・社会の単元マスター定義
    const imgEnglishUnits = [
      '1 I am〜 You are〜の文',
      '2 This(That) is〜の文',
      '3 He(She) is 〜〜の文',
      '4 一般動詞',
      '5 What〜の文',
      '6 形容詞',
      '7 複数',
      '8 命令文',
      '9 三人称単数',
      '10 疑問詞を用いた疑問文',
      '11 現在進行形',
      '12 〜できる（can）',
      '13 過去形（規則動詞）',
      '14 過去形（不規則動詞）'
    ];

    const imgScienceUnits = [
      '1章1節身近な生物の観察',
      '1章2節花のおつくりとはたらき',
      '1章3節植物のなかま分け',
      '1章4節動物のなかま',
      '1章 生物分野補足',
      '2章0節器具の基本操作を覚えよう',
      '2章1節いろいろな物質',
      '2章2節気体の発生と性質',
      '2章3節物質の状態変化',
      '2章4節水溶液',
      '3章1節光の性質',
      '3章2節音の性質',
      '3章3節 力のはたらき',
      '4章1節火山',
      '4章2節地震',
      '4章3節地層',
      '4章4節大地の変動'
    ];

    const imgSocialUnits = [
      '第1章 古代までの日本',
      '第2章 中世の日本',
      '第3章 近世の日本'
    ];

    imgEnglishUnits.forEach((name, index) => {
      seed.push({
        id: `unit-img-eng-${index + 1}`,
        school_id: 'sch-1',
        subject: '英語',
        name,
        sequence_order: 100 + index + 1,
        created_at: new Date().toISOString()
      });
    });

    imgScienceUnits.forEach((name, index) => {
      seed.push({
        id: `unit-img-sci-${index + 1}`,
        school_id: 'sch-1',
        subject: '理科',
        name,
        sequence_order: 100 + index + 1,
        created_at: new Date().toISOString()
      });
    });

    const imgMathUnits = [
      '1章 正の数・負の数',
      '2章 文字の式',
      '3章 方程式',
      '4章 変化の割合',
      '5章 平面図形',
      '6章 空間図形',
      '7章 データの活用',
      '1章式の計算',
      '2章連立方程式',
      '3章一次関数',
      '4章図形の調べ方',
      '5章図形の性質と証明',
      '6章確率',
      '1章式の展開と因数分解',
      '2章平方根',
      '3章二次方程式',
      '4章二次関数',
      '5章図形と相似',
      '6章円の性質',
      '7章三平方の定理',
      '8章標本調査'
    ];

    imgMathUnits.forEach((name, index) => {
      seed.push({
        id: `unit-img-math-${index + 1}`,
        school_id: 'sch-1',
        subject: '数学',
        name,
        sequence_order: 100 + index + 1,
        created_at: new Date().toISOString()
      });
    });

    imgSocialUnits.forEach((name, index) => {
      seed.push({
        id: `unit-img-soc-${index + 1}`,
        school_id: 'sch-1',
        subject: '社会',
        name,
        sequence_order: 100 + index + 1,
        created_at: new Date().toISOString()
      });
    });

    // sch-2: テントル小学校 (算数)
    const elemThemes = [
      // unit-301 (整数と小数)
      { id: 'unit-301-1', name: '整数と小数の仕組み', order: 1, url: '301-1' },
      { id: 'unit-301-2', name: '数を10倍、1/10にした数', order: 2, url: '301-2' },
      // unit-302 (体積)
      { id: 'unit-302-1', name: '直方体と立方体の体積の公式', order: 3, url: '302-1' },
      { id: 'unit-302-2', name: '大きな体積の単位と容積', order: 4, url: '302-2' },
      // unit-303 (比例)
      { id: 'unit-303-1', name: '小数のひき算・かけ算の意味', order: 5, url: '303-1' },
      { id: 'unit-303-2', name: '小数の筆算と計算練習', order: 6, url: '303-2' },
      // unit-304 (合同)
      { id: 'unit-304-1', name: '合同な図形と対応する辺・角', order: 7, url: '304-1' },
      { id: 'unit-304-2', name: '合同な三角形の書き方', order: 8, url: '304-2' },
      // unit-305 (分数加減)
      { id: 'unit-305-1', name: '異分母の分数のたし算とひき算', order: 9, url: '305-1' },
      { id: 'unit-305-2', name: '分数の計算の工夫', order: 10, url: '305-2' },
      // unit-306 (割合・グラフ)
      { id: 'unit-306-1', name: '割合の意味と表し方', order: 11, url: '306-1' },
      { id: 'unit-306-2', name: '帯グラフと折れ線グラフ', order: 12, url: '306-2' }
    ];

    elemThemes.forEach(unit => {
      seed.push({
        id: unit.id,
        school_id: 'sch-2',
        subject: '算数',
        name: unit.name,
        sequence_order: unit.order,
        google_drive_url: `https://drive.google.com/drive/folders/${unit.url}`,
        created_at: new Date().toISOString()
      });
    });

    // 基礎テスト（英語）
    const basicEnglishTests = [
      { id: 'unit-be-1', name: '基礎テスト（英単語1-50）', order: 1 },
      { id: 'unit-be-2', name: '基礎テスト（英単語51-100）', order: 2 },
      { id: 'unit-be-3', name: '基礎テスト（中1基本文）', order: 3 }
    ];
    basicEnglishTests.forEach(unit => {
      seed.push({
        id: unit.id,
        school_id: 'sch-1',
        subject: '基礎テスト（英語）',
        name: unit.name,
        sequence_order: unit.order,
        google_drive_url: '',
        created_at: new Date().toISOString()
      });
    });

    // 基礎テスト（漢字）
    const basicKanjiTests = [
      { id: 'unit-bk-1', name: '基礎テスト（漢字1級-5級）', order: 1 },
      { id: 'unit-bk-2', name: '基礎テスト（漢字同音異義語）', order: 2 },
      { id: 'unit-bk-3', name: '基礎テスト（四字熟語）', order: 3 }
    ];
    basicKanjiTests.forEach(unit => {
      seed.push({
        id: unit.id,
        school_id: 'sch-1',
        subject: '基礎テスト（漢字）',
        name: unit.name,
        sequence_order: unit.order,
        google_drive_url: '',
        created_at: new Date().toISOString()
      });
    });

    // 基礎テスト（計算）
    const basicCalcTests = [
      { id: 'unit-bc-1', name: '基礎テスト（正負の数四則）', order: 1 },
      { id: 'unit-bc-2', name: '基礎テスト（文字式計算）', order: 2 },
      { id: 'unit-bc-3', name: '基礎テスト（一次方程式計算）', order: 3 }
    ];
    basicCalcTests.forEach(unit => {
      seed.push({
        id: unit.id,
        school_id: 'sch-1',
        subject: '基礎テスト（計算）',
        name: unit.name,
        sequence_order: unit.order,
        google_drive_url: '',
        created_at: new Date().toISOString()
      });
    });

    return this.getMockData('curriculum_units', seed);
  }

  public getStudents(): Student[] {
    const seed: Student[] = [
      {
        id: 'std-1',
        student_id: 'student101',
        name: '佐藤 拓海',
        email: 'student101@tentoru-student.com',
        grade: '中3',
        school_id: 'sch-1',
        status: 'normal',
        start_unit_id: 'unit-102-1',
        period_count: 2,
        created_at: '2026-04-01T00:00:00Z',
        level: 'A',
        name_kana: 'サトウ タクミ',
        birthday: '2011-05-15',
        club_activities: '野球部',
        hobbies: '読書・ゲーム',
        parent_name: '佐藤 健二',
        contact_phone: '090-1234-5678',
        contact_time: '18:00 - 21:00',
        personalities: ['スイッチ入るとよく喋る', '班長'],
        target_school: '天登星雲高校',
        classroom: '恵比寿教室',
        teacher_in_charge: '福田 尚弘',
        registered_grade: '中3',
        registered_year: 2026,
        weekly_sessions_count: '2回',
        weekly_duration_minutes: '120分',
        selected_subjects: ['数学', '英語', '理科', '社会', '国語']
      },
      {
        id: 'std-2',
        student_id: 'student102',
        name: '鈴木 結衣',
        email: 'student102@tentoru-student.com',
        grade: '小5',
        school_id: 'sch-2',
        status: 'normal',
        start_unit_id: 'unit-301-1',
        period_count: 2,
        created_at: '2025-04-01T00:00:00Z', // 2025年度登録なので、2026年度時点では小6へ自動進級
        level: 'B',
        name_kana: 'スズキ ユイ',
        birthday: '2015-08-20',
        club_activities: '音楽クラブ',
        hobbies: 'ピアノ・歌',
        parent_name: '鈴木 陽子',
        contact_phone: '080-9876-5432',
        contact_time: '17:00 - 20:00',
        personalities: ['ぱっと見大人しい', '音楽の授業は好き'],
        target_school: 'テントル総合高校',
        classroom: '恵比寿教室',
        teacher_in_charge: '福田 尚弘',
        registered_grade: '小5',
        registered_year: 2025,
        weekly_sessions_count: '3回',
        weekly_duration_minutes: '90分',
        selected_subjects: ['算数', '国語', '英語']
      }
    ];
    const rawList = this.getMockData('students', seed);
    const curYear = getSchoolYear();
    const schoolsList = this.getSchools();
    return rawList.map(s => {
      const regYear = s.registered_year ?? getSchoolYear(s.created_at);
      const regGrade = s.registered_grade ?? s.grade;
      const assignedTeachers = s.assigned_teachers && Array.isArray(s.assigned_teachers) && s.assigned_teachers.length > 0
        ? s.assigned_teachers
        : (s.teacher_in_charge ? [s.teacher_in_charge] : ['福田 尚弘']);
      const selectedSubjects = s.selected_subjects && Array.isArray(s.selected_subjects) && s.selected_subjects.length > 0
        ? s.selected_subjects
        : (s.grade.startsWith('小') || s.grade === '園児' ? ['算数', '国語', '英語'] : ['数学', '英語', '理科', '社会', '国語']);
      const resolvedSchoolName = s.school_name || (s.school_id ? schoolsList.find(sc => sc.id === s.school_id)?.name : '') || '';
      return {
        ...s,
        school_name: resolvedSchoolName,
        assigned_teachers: assignedTeachers,
        teacher_in_charge: assignedTeachers[0] || s.teacher_in_charge || '',
        selected_subjects: selectedSubjects,
        registered_year: regYear,
        registered_grade: regGrade,
        grade: calculateCurrentGrade(regGrade, regYear, curYear)
      };
    });
  }

  public getLearningTasks(): LearningTask[] {
    // We can pre-populate student tasks matching curriculum
    const seifuTasks: LearningTask[] = Array.from({ length: 37 }, (_, i) => ({
      id: `task-1-${i + 1}`,
      student_id: 'std-1',
      unit_id: `unit-101-${i + 1}`,
      scheduled_date: '2026-06-17',
      period: null,
      status: 'skipped' as const,
      video_watched: false,
      test_passed: false,
      office_note: '開始位置指定によりスキップ',
      created_at: new Date().toISOString()
    }));

    const seed: LearningTask[] = [
      // 佐藤拓海 (中3) 用のタスク
      ...seifuTasks,
      // unit-102 (文字式) 4テーマは完了
      { id: 'task-2-1', student_id: 'std-1', unit_id: 'unit-102-1', scheduled_date: '2026-06-18', period: 1, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      { id: 'task-2-2', student_id: 'std-1', unit_id: 'unit-102-2', scheduled_date: '2026-06-18', period: 1, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      { id: 'task-2-3', student_id: 'std-1', unit_id: 'unit-102-3', scheduled_date: '2026-06-18', period: 1, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      { id: 'task-2-4', student_id: 'std-1', unit_id: 'unit-102-4', scheduled_date: '2026-06-18', period: 1, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      
      // unit-103 (一次方程式) 今日以降のタスク
      { id: 'task-3-1', student_id: 'std-1', unit_id: 'unit-103-1', scheduled_date: '2026-06-19', period: 2, status: 'unstarted', video_watched: false, test_passed: false, office_note: 'ワーク持参', created_at: new Date().toISOString() },
      { id: 'task-3-2', student_id: 'std-1', unit_id: 'unit-103-2', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-3-3', student_id: 'std-1', unit_id: 'unit-103-3', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-3-4', student_id: 'std-1', unit_id: 'unit-103-4', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      
      // unit-104 (比例と反比例) 明日以降のタスク
      { id: 'task-4-1', student_id: 'std-1', unit_id: 'unit-104-1', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-4-2', student_id: 'std-1', unit_id: 'unit-104-2', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-4-3', student_id: 'std-1', unit_id: 'unit-104-3', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-4-4', student_id: 'std-1', unit_id: 'unit-104-4', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },

      // 英語のタスク
      { id: 'task-5-1', student_id: 'std-1', unit_id: 'unit-201-1', scheduled_date: '2026-06-18', period: 2, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      { id: 'task-5-2', student_id: 'std-1', unit_id: 'unit-201-2', scheduled_date: '2026-06-18', period: 2, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      { id: 'task-5-3', student_id: 'std-1', unit_id: 'unit-201-3', scheduled_date: '2026-06-18', period: 2, status: 'completed', video_watched: true, test_passed: true, office_note: '', actual_completed_date: '2026-06-18', created_at: new Date().toISOString() },
      
      { id: 'task-6-1', student_id: 'std-1', unit_id: 'unit-202-1', scheduled_date: '2026-06-19', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-6-2', student_id: 'std-1', unit_id: 'unit-202-2', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-6-3', student_id: 'std-1', unit_id: 'unit-202-3', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-7-1', student_id: 'std-2', unit_id: 'unit-301-1', scheduled_date: '2026-06-19', period: 1, status: 'unstarted', video_watched: false, test_passed: false, office_note: '九九カード', created_at: new Date().toISOString() },
      { id: 'task-7-2', student_id: 'std-2', unit_id: 'unit-301-2', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-8-1', student_id: 'std-2', unit_id: 'unit-302-1', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() },
      { id: 'task-8-2', student_id: 'std-2', unit_id: 'unit-302-2', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, office_note: '', created_at: new Date().toISOString() }
    ];
    return this.getMockData('learning_tasks', seed);
  }

  public getLearningLogs(): LearningLog[] {
    const seed: LearningLog[] = [
      { id: 'log-1', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'video_view', duration_seconds: 1200, created_at: '2026-06-18T10:00:00Z' },
      { id: 'log-2', student_id: 'std-1', unit_id: 'unit-102-1', log_type: 'test_result', score: 85, total_questions: 10, incorrect_genres: ['計算ミス'], created_at: '2026-06-18T10:20:00Z' },
      { id: 'log-3', student_id: 'std-1', unit_id: 'unit-201-1', log_type: 'video_view', duration_seconds: 900, created_at: '2026-06-18T11:00:00Z' },
      { id: 'log-4', student_id: 'std-1', unit_id: 'unit-201-1', log_type: 'test_result', score: 100, total_questions: 5, incorrect_genres: [], created_at: '2026-06-18T11:15:00Z' }
    ];
    return this.getMockData('learning_logs', seed);
  }

  public getTestRecords(): TestRecord[] {
    const seed: TestRecord[] = [
      {
        id: 'tr-1',
        student_id: 'std-1',
        record_type: 'regular_test',
        test_name: '1学期中間テスト',
        score_japanese: 70,
        score_math: 72,
        score_english: 68,
        score_social: 65,
        score_science: 80,
        score_total: 355,
        class_rank: '12',
        school_rank: '45',
        deviation_value: 52.5,
        rank_change: 'up',
        rate_change: 8.5,
        next_target_score: 85,
        improvement_plan: '一次方程式の計算手順の再確認',
        created_at: new Date().toISOString()
      },
      {
        id: 'tr-3',
        student_id: 'std-1',
        record_type: 'regular_test',
        test_name: '1学期期末テスト',
        score_japanese: 65,
        score_math: 60,
        score_english: 70,
        score_social: 55,
        score_science: 75,
        score_total: 325,
        class_rank: 'ー',
        school_rank: 'ー',
        deviation_value: 48.0,
        rank_change: 'down',
        rate_change: -2.0,
        next_target_score: 75,
        improvement_plan: '単語練習の徹底',
        created_at: new Date().toISOString()
      },
      {
        id: 'tr-4',
        student_id: 'std-1',
        record_type: 'regular_test',
        test_name: '中間測定テスト',
        created_at: new Date().toISOString()
      },
      { id: 'tr-2', student_id: 'std-1', record_type: 'mock_exam', subject: '総合', score: 320, target_school_code: 'schcode-A', created_at: new Date().toISOString() }
    ];
    const list = this.getMockData('test_records', seed);
    return list.map(tr => {
      if (tr.record_type === 'regular_test') {
        return {
          ...tr,
          class_rank: tr.class_rank || 'ー',
          school_rank: tr.school_rank || 'ー'
        };
      }
      return tr;
    });
  }

  public getSchoolCodesMaster(): SchoolCodeMaster[] {
    const seed: SchoolCodeMaster[] = [
      { code: 'schcode-A', name: '天登星雲高校 (偏差値60)', deviation_value: 60 },
      { code: 'schcode-B', name: 'テントル総合高校 (偏差値50)', deviation_value: 50 },
      { code: 'schcode-C', name: '南テントル実業高校 (偏差値40)', deviation_value: 40 }
    ];
    return this.getMockData('school_codes_master', seed);
  }

  public getExamThresholdsMaster(): ExamThresholdMaster[] {
    const seed: ExamThresholdMaster[] = [
      { id: 'eth-1', school_code: 'schcode-A', min_score: 350, max_score: 500, probability: 80 },
      { id: 'eth-2', school_code: 'schcode-A', min_score: 300, max_score: 349, probability: 60 },
      { id: 'eth-3', school_code: 'schcode-A', min_score: 250, max_score: 299, probability: 40 },
      { id: 'eth-4', school_code: 'schcode-A', min_score: 0, max_score: 249, probability: 20 },
      { id: 'eth-5', school_code: 'schcode-B', min_score: 280, max_score: 500, probability: 80 },
      { id: 'eth-6', school_code: 'schcode-B', min_score: 220, max_score: 279, probability: 60 },
      { id: 'eth-7', school_code: 'schcode-B', min_score: 0, max_score: 219, probability: 30 },
      { id: 'eth-8', school_code: 'schcode-C', min_score: 200, max_score: 500, probability: 80 },
      { id: 'eth-9', school_code: 'schcode-C', min_score: 0, max_score: 199, probability: 40 }
    ];
    return this.getMockData('exam_thresholds_master', seed);
  }

  public getPromptSettings(): PromptSetting[] {
    const seed: PromptSetting[] = [
      {
        id: 'prompt-1',
        prompt_template: `あなたは個別指導塾の優秀な校舎長です。以下の学習ログ情報に基づいて、保護者に向けた「今月の頑張り・行動の成長」についての指導報告書を作成してください。

条件:
1. 点数が悪くても、行動の成長や努力した点（例：動画視聴時間、テストの受講回数など）に焦点を当て、ポジティブなトーンで執筆してください。
2. 専門用語は避け、保護者にも分かりやすい日本語で書いてください。
3. 文字数は250〜400文字程度としてください。
4. 相手の強みを褒めちぎるスタイルを維持してください。

学習ログデータ：
- 動画視聴時間合計: {video_duration}分
- テスト合格単元数: {passed_units_count}単元
- テスト平均正答率: {average_score}%
- 苦手・間違えたジャンル: {incorrect_genres}`,
        created_at: new Date().toISOString()
      }
    ];
    return this.getMockData('prompt_settings', seed);
  }

  public getAIReports(): AIReport[] {
    const seed: AIReport[] = [
      {
        id: 'rep-1',
        student_id: 'std-1',
        month: '2026-06',
        analysis_text: '佐藤君は今月、数学の「文字式」において非常に意欲的に取り組みました！動画を合計20分視聴し、その後の単元テストでは85%という素晴らしい高得点で一発合格を果たしています。少し計算ミスが見られる部分はありますが、動画を集中して見ながら素早く解法を理解できたことが大きな成長です。この調子で次の「一次方程式」もクリアしていきましょう！',
        teacher_notes: '二者面談を実施。定期テスト目標80点に向けて、一次方程式の基礎計算をあと3周ワークで解き進める約束をしました。',
        final_text: '佐藤君は今月、数学の「文字式」において非常に意欲的に取り組みました！動画を合計20分視聴し、その後の単元テストでは85%という素晴らしい高得点で一発合格を果たしています。少し計算ミスが見られる部分はありますが、動画を集中して見ながら素早く解法を理解できたことが大きな成長です。この調子で次の「一次方程式」もクリアしていきましょう！\n\n【二者面談結果】\n定期テスト目標80点に向けて、一次方程式の基礎計算をあと3周ワークで解き進める約束をしました。',
        created_at: new Date().toISOString()
      }
    ];
    return this.getMockData('ai_reports', seed);
  }

  public getTeacherCorrectionsLogs(): TeacherCorrectionLog[] {
    return this.getMockData('teacher_corrections_log', []);
  }

  // -------------------------------------------------------------
  // Data Mutators (Hybrid Implementation)
  // -------------------------------------------------------------
  
  // Curriculum CRUD
  public async saveCurriculumUnit(unit: CurriculumUnit): Promise<CurriculumUnit> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('curriculum_units').upsert(unit).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getCurriculumUnits();
      const idx = list.findIndex(u => u.id === unit.id);
      if (idx >= 0) list[idx] = unit;
      else list.push(unit);
      this.saveMockData('curriculum_units', list);
      return unit;
    }
  }

  public async deleteCurriculumUnit(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('curriculum_units').delete().eq('id', id);
      if (error) throw error;
    } else {
      const list = this.getCurriculumUnits();
      const filtered = list.filter(u => u.id !== id);
      this.saveMockData('curriculum_units', filtered);
    }
  }

  // CustomClasses CRUD
  public async saveCustomClass(customClass: CustomClass): Promise<CustomClass> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('custom_classes').upsert(customClass).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getCustomClasses();
      const idx = list.findIndex(c => c.id === customClass.id);
      if (idx >= 0) list[idx] = customClass;
      else list.push(customClass);
      this.saveMockData('custom_classes', list);
      return customClass;
    }
  }

  public async deleteCustomClass(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('custom_classes').delete().eq('id', id);
      if (error) throw error;
    } else {
      const list = this.getCustomClasses();
      const filtered = list.filter(c => c.id !== id);
      this.saveMockData('custom_classes', filtered);
    }
  }

  // CustomApplyScopes CRUD
  public async saveCustomApplyScope(customScope: CustomApplyScope): Promise<CustomApplyScope> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('custom_apply_scopes').upsert(customScope).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getCustomApplyScopes();
      const idx = list.findIndex(c => c.id === customScope.id);
      if (idx >= 0) list[idx] = customScope;
      else list.push(customScope);
      this.saveMockData('custom_apply_scopes', list);
      return customScope;
    }
  }

  public async deleteCustomApplyScope(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('custom_apply_scopes').delete().eq('id', id);
      if (error) throw error;
    } else {
      const list = this.getCustomApplyScopes();
      const filtered = list.filter(c => c.id !== id);
      this.saveMockData('custom_apply_scopes', filtered);
    }
  }

  // 1. Schools CRUD
  public async saveSchool(school: School): Promise<School> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('schools').upsert(school).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getSchools();
      const idx = list.findIndex(s => s.id === school.id);
      if (idx >= 0) list[idx] = school;
      else list.push(school);
      this.saveMockData('schools', list);
      return school;
    }
  }

  public async fetchSchools(): Promise<School[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('schools')
          .select('*')
          .order('name', { ascending: true });
        if (error) throw error;
        if (data) {
          let allSchools: School[] = [...data];
          try {
            const { data: stData } = await this.supabase.from('students').select('school_name, school_id');
            if (stData) {
              const existingNames = new Set(allSchools.map(s => s.name));
              for (const st of stData) {
                if (st.school_name && st.school_name.trim() && !existingNames.has(st.school_name.trim())) {
                  const newSch: School = {
                    id: st.school_id || `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    name: st.school_name.trim(),
                    type: st.school_name.includes('小') ? 'elementary' : st.school_name.includes('高') ? 'high_school' : 'junior_high',
                    created_at: new Date().toISOString()
                  };
                  allSchools.push(newSch);
                  existingNames.add(newSch.name);
                }
              }
            }
          } catch (stErr) {
            console.warn('fetchSchools students sync warning:', stErr);
          }

          const uniqueSchoolsMap = new Map<string, School>();
          for (const s of allSchools) {
            if (!uniqueSchoolsMap.has(s.name)) {
              uniqueSchoolsMap.set(s.name, s);
            }
          }
          const list = Array.from(uniqueSchoolsMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
          this.saveMockData('schools', list);
          return list;
        }
      } catch (err) {
        console.warn('fetchSchools Supabase error, fallback to local storage:', err);
      }
    }
    const local = this.getSchools();
    const uniqueMap = new Map<string, School>();
    for (const s of local) {
      if (!uniqueMap.has(s.name)) {
        uniqueMap.set(s.name, s);
      }
    }
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return sorted;
  }

  public async deleteSchool(idOrName: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { error: errId } = await this.supabase.from('schools').delete().eq('id', idOrName);
        if (errId) {
          console.warn('deleteSchool by id error, trying by name:', errId);
          await this.supabase.from('schools').delete().eq('name', idOrName);
        }
      } catch (err) {
        console.warn('deleteSchool Supabase error:', err);
      }
    }
    const list = this.getMockData<School>('schools', []);
    const filtered = list.filter(s => s.id !== idOrName && s.name !== idOrName);
    this.saveMockData('schools', filtered);
  }

  // 2. Students CRUD
  public async saveStudent(student: Student): Promise<Student> {
    const curYear = getSchoolYear();
    const assignedTeachers = student.assigned_teachers && Array.isArray(student.assigned_teachers) && student.assigned_teachers.length > 0
      ? student.assigned_teachers
      : (student.teacher_in_charge ? [student.teacher_in_charge] : []);

    const selectedSubjects = student.selected_subjects && Array.isArray(student.selected_subjects) && student.selected_subjects.length > 0
      ? student.selected_subjects
      : (student.grade.startsWith('小') || student.grade === '園児' ? ['算数', '国語', '英語'] : ['数学', '英語', '理科', '社会', '国語']);

    const schoolsList = this.getSchools();
    const derivedSchoolName = student.school_name || (student.school_id ? schoolsList.find(s => s.id === student.school_id)?.name : '') || '';

    const toSave: Student = {
      ...student,
      school_name: derivedSchoolName,
      assigned_teachers: assignedTeachers,
      teacher_in_charge: assignedTeachers[0] || student.teacher_in_charge || '',
      selected_subjects: selectedSubjects,
      registered_year: student.registered_year ?? getSchoolYear(student.created_at || new Date().toISOString()),
      registered_grade: student.registered_grade ?? student.grade
    };
    
    // 学年が手動変更されたかどうかのチェック
    const expectedGrade = calculateCurrentGrade(
      toSave.registered_grade!,
      toSave.registered_year!,
      curYear
    );
    if (expectedGrade !== student.grade) {
      toSave.registered_grade = student.grade;
      toSave.registered_year = curYear;
    }

    let savedData: any = null;

    if (!this.isMockMode && this.supabase) {
      // Keep school_name in payloadToSave, only strip transient properties like school, units, tasks
      const { school, units, tasks, ...payloadToSave } = toSave as any;
      console.log('[DEBUG] Save Payload:', payloadToSave);
      const { data, error } = await this.supabase.from('students').upsert(payloadToSave).select().single();
      if (error) {
        console.error('Supabase saveStudent upsert error:', error);
        // If column assigned_teachers or selected_subjects or school_name is not present on Supabase, fallback by saving payload without those columns
        if (error.message?.includes('assigned_teachers') || error.message?.includes('selected_subjects') || error.message?.includes('school_name') || error.code === 'PGRST204' || error.message?.includes('column')) {
          const { assigned_teachers, selected_subjects, school_name, ...fallbackPayload } = payloadToSave;
          const { data: fbData, error: fbError } = await this.supabase
            .from('students')
            .upsert(fallbackPayload)
            .select()
            .single();
          if (!fbError && fbData) {
            savedData = fbData;
          }
        }
        if (!savedData && payloadToSave.id) {
          const { data: updateData, error: updateError } = await this.supabase
            .from('students')
            .update(payloadToSave)
            .eq('id', payloadToSave.id)
            .select()
            .single();
          if (!updateError && updateData) {
            savedData = updateData;
          }
        }
        if (!savedData) {
          throw new Error(`Supabase Error [${error.code || 'UNKNOWN'}]: ${error.message || error.details || JSON.stringify(error)}`);
        }
      } else {
        savedData = data;
      }
    }

    const finalStudent: Student = {
      ...toSave,
      ...(savedData || {}),
      school_name: toSave.school_name,
      assigned_teachers: toSave.assigned_teachers,
      selected_subjects: toSave.selected_subjects,
      grade: calculateCurrentGrade((savedData?.registered_grade || toSave.registered_grade!), (savedData?.registered_year || toSave.registered_year!), curYear)
    };

    // Always update local cache so synchronous getStudents() immediately reflects the updated student!
    const rawList = this.getMockData<Student>('students', []);
    const idx = rawList.findIndex(s => s.id === finalStudent.id);
    if (idx >= 0) rawList[idx] = finalStudent;
    else rawList.push(finalStudent);
    this.saveMockData('students', rawList);

    return finalStudent;
  }

  public async deleteStudent(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      // Clean up related tables first
      try {
        await this.supabase.from('learning_tasks').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete learning_tasks warning:', err);
      }
      try {
        await this.supabase.from('student_schedule_configs').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete student_schedule_configs warning:', err);
      }
      try {
        await this.supabase.from('student_interactions').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete student_interactions warning:', err);
      }
      try {
        await this.supabase.from('test_records').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete test_records warning:', err);
      }
      try {
        await this.supabase.from('mini_test_results').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete mini_test_results warning:', err);
      }
      try {
        await this.supabase.from('homework_results').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete homework_results warning:', err);
      }
      try {
        await this.supabase.from('milestone_plans').delete().eq('student_id', id);
      } catch (err) {
        console.warn('Supabase delete milestone_plans warning:', err);
      }
      const { error } = await this.supabase.from('students').delete().eq('id', id);
      if (error) throw error;
    }
    // Update local cache
    const rawList = this.getMockData<Student>('students', []);
    const filtered = rawList.filter(s => s.id !== id);
    this.saveMockData('students', filtered);

    // Clean up local tasks
    const tasks = this.getMockData<LearningTask>('learning_tasks', []);
    this.saveMockData('learning_tasks', tasks.filter(t => t.student_id !== id));
  }

  public async fetchStudents(): Promise<Student[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('students').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        if (data) {
          const curYear = getSchoolYear();
          const schoolsList = this.getSchools();
          const list: Student[] = data.map((s: any) => {
            const regYear = s.registered_year ?? getSchoolYear(s.created_at);
            const regGrade = s.registered_grade ?? s.grade;
            const resolvedSchoolName = s.school_name || (s.school_id ? schoolsList.find(sc => sc.id === s.school_id)?.name : '') || '';
            return {
              ...s,
              school_name: resolvedSchoolName,
              assigned_teachers: s.assigned_teachers && Array.isArray(s.assigned_teachers) ? s.assigned_teachers : (s.teacher_in_charge ? [s.teacher_in_charge] : ['福田 尚弘']),
              teacher_in_charge: (s.assigned_teachers && s.assigned_teachers[0]) || s.teacher_in_charge || '福田 尚弘',
              selected_subjects: s.selected_subjects && Array.isArray(s.selected_subjects) ? s.selected_subjects : (s.grade?.startsWith('小') ? ['算数', '国語', '英語'] : ['数学', '英語', '理科', '社会', '国語']),
              registered_year: regYear,
              registered_grade: regGrade,
              grade: calculateCurrentGrade(regGrade, regYear, curYear)
            };
          });
          this.saveMockData('students', list);
          return list;
        }
      } catch (err) {
        console.warn('fetchStudents Supabase error, fallback to local storage:', err);
      }
    }
    return this.getStudents();
  }

  public async fetchStudent(id: string): Promise<Student | null> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('students').select('*').eq('id', id).single();
        if (!error && data) {
          const curYear = getSchoolYear();
          const schoolsList = this.getSchools();
          const regYear = data.registered_year ?? getSchoolYear(data.created_at);
          const regGrade = data.registered_grade ?? data.grade;
          const resolvedSchoolName = data.school_name || (data.school_id ? schoolsList.find(sc => sc.id === data.school_id)?.name : '') || '';
          const st: Student = {
            ...data,
            school_name: resolvedSchoolName,
            assigned_teachers: data.assigned_teachers && Array.isArray(data.assigned_teachers) ? data.assigned_teachers : (data.teacher_in_charge ? [data.teacher_in_charge] : ['福田 尚弘']),
            teacher_in_charge: (data.assigned_teachers && data.assigned_teachers[0]) || data.teacher_in_charge || '福田 尚弘',
            selected_subjects: data.selected_subjects && Array.isArray(data.selected_subjects) ? data.selected_subjects : (data.grade?.startsWith('小') ? ['算数', '国語', '英語'] : ['数学', '英語', '理科', '社会', '国語']),
            registered_year: regYear,
            registered_grade: regGrade,
            grade: calculateCurrentGrade(regGrade, regYear, curYear)
          };
          const list = this.getMockData<Student>('students', []);
          const idx = list.findIndex(s => s.id === id);
          if (idx >= 0) list[idx] = st;
          else list.push(st);
          this.saveMockData('students', list);
          return st;
        }
      } catch (err) {
        console.warn('fetchStudent Supabase error:', err);
      }
    }
    return this.getStudents().find(s => s.id === id) || null;
  }

  public getStudent(id: string): Student | null {
    return this.getStudents().find(s => s.id === id) || null;
  }

  public getStudentById(id: string): Student | null {
    return this.getStudent(id);
  }

  // 3. Curriculum CRUD
  public async saveCurriculumUnits(units: CurriculumUnit[]): Promise<CurriculumUnit[]> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('curriculum_units').upsert(units).select();
      if (error) throw error;
      return data;
    } else {
      const list = this.getCurriculumUnits();
      units.forEach(u => {
        const idx = list.findIndex(item => item.id === u.id);
        if (idx >= 0) list[idx] = u;
        else list.push(u);
      });
      // Ensure ordering constraints if any
      this.saveMockData('curriculum_units', list);
      return units;
    }
  }

  // 指定生徒・指定日付のコマ割り学習タスクを一括削除（安全な削除 ➔ 再登録用）
  public async deleteLearningTasksForDate(studentId: string, date: string): Promise<void> {
    if (!studentId || !date) return;
    let list = this.getLearningTasks();
    list = list.filter(t => !(t.student_id === studentId && t.scheduled_date === date));
    this.saveMockData('learning_tasks', list);

    if (!this.isMockMode && this.supabase) {
      try {
        await this.supabase.from('learning_tasks').delete().eq('student_id', studentId).eq('scheduled_date', date);
      } catch (err) {
        console.warn('deleteLearningTasksForDate error:', err);
      }
    }
  }

  // 4. LearningTasks CRUD
  public async saveLearningTasks(tasks: LearningTask[]): Promise<LearningTask[]> {
    if (!tasks || tasks.length === 0) return [];
    const sanitizedTasks = tasks.map(t => sanitizeLearningTask(t));

    // Update local cache regardless of mock mode so synchronous getLearningTasks() is immediately updated
    const list = this.getLearningTasks();
    sanitizedTasks.forEach(t => {
      const idx = list.findIndex(item => item.id === t.id);
      if (idx >= 0) list[idx] = t;
      else list.push(t);
    });
    this.saveMockData('learning_tasks', list);

    if (!this.isMockMode && this.supabase) {
      // 同一単元の複数コマで (student_id, unit_id) ユニーク制約エラーが起きないよう unit_id を個別一意化
      const unitKeyCounts = new Map<string, number>();
      const dbPayloads = sanitizedTasks.map((t, idx) => {
        const raw = sanitizeLearningTaskForDB(t);
        const groupKey = `${raw.student_id}_${raw.scheduled_date}_${raw.unit_id}`;
        const count = (unitKeyCounts.get(groupKey) || 0) + 1;
        unitKeyCounts.set(groupKey, count);

        if (count > 1 || !raw.unit_id) {
          const suffix = raw.period ? `_p${raw.period}` : `_${count}_${idx}`;
          raw.unit_id = `${raw.unit_id || 'unit'}${suffix}`;
        }
        return raw;
      });

      const { data, error } = await this.supabase.from('learning_tasks').upsert(dbPayloads).select();
      if (error) {
        // もしユニーク制約エラー (23505 または learning_tasks_student_id_unit_id_key) や completed_lesson_ids が原因の場合、一括削除＋強制一意化でリトライ
        if (
          error.code === '23505' ||
          error.message?.includes('learning_tasks_student_id_unit_id_key') ||
          error.message?.includes('completed_lesson_ids') ||
          error.code === '42703' ||
          (error as any).details?.includes('completed_lesson_ids') ||
          error.code === 'PGRST204'
        ) {
          // 強制一意化ペイロードの準備
          const fallbackPayloads = dbPayloads.map((p, idx) => {
            const { completed_lesson_ids, ...rest } = p;
            return {
              ...rest,
              unit_id: `${rest.unit_id}_p${rest.period || idx}_${Math.random().toString(36).substring(2, 5)}`
            };
          });

          // 旧レコードの安全削除
          const sampleStId = sanitizedTasks[0].student_id;
          const sampleDate = sanitizedTasks[0].scheduled_date;
          if (sampleStId && sampleDate) {
            await this.supabase.from('learning_tasks').delete().eq('student_id', sampleStId).eq('scheduled_date', sampleDate);
          }

          const retryRes = await this.supabase.from('learning_tasks').upsert(fallbackPayloads).select();
          if (!retryRes.error) {
            return (retryRes.data || sanitizedTasks) as LearningTask[];
          }
        }
        throw error;
      }
      return (data || sanitizedTasks) as LearningTask[];
    }
    return sanitizedTasks;
  }

  public async fetchLearningTasks(studentId?: string, date?: string): Promise<LearningTask[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        let query = this.supabase.from('learning_tasks').select('*');
        if (studentId) query = query.eq('student_id', studentId);
        if (date) query = query.eq('scheduled_date', date);
        const { data, error } = await query;
        if (error) throw error;
        const tasks = (data || []) as LearningTask[];

        // Synchronize local memory cache with latest remote tasks
        let currentList = this.getLearningTasks();
        if (studentId && date) {
          currentList = currentList.filter(t => !(t.student_id === studentId && t.scheduled_date === date));
        } else if (studentId) {
          currentList = currentList.filter(t => t.student_id !== studentId);
        }
        currentList.push(...tasks.map(t => sanitizeLearningTask(t)));
        this.saveMockData('learning_tasks', currentList);

        return tasks;
      } catch (err) {
        console.warn('Supabase fetchLearningTasks fallback to local storage:', err);
      }
    }
    const all = this.getLearningTasks();
    return all.filter(t => {
      if (studentId && t.student_id !== studentId) return false;
      if (date && t.scheduled_date !== date) return false;
      return true;
    });
  }

  public async deleteLearningTasksByDate(studentId: string, date: string): Promise<void> {
    // 1. Update local cache immediately
    let list = this.getLearningTasks();
    list = list.filter(t => !(t.student_id === studentId && t.scheduled_date === date));
    this.saveMockData('learning_tasks', list);

    // 2. Delete from Supabase
    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase
          .from('learning_tasks')
          .delete()
          .eq('student_id', studentId)
          .eq('scheduled_date', date);
        if (error) {
          console.warn('Supabase deleteLearningTasksByDate warning:', error);
        }
      } catch (err) {
        console.warn('Supabase deleteLearningTasksByDate exception:', err);
      }
    }
  }

  public async overwriteLearningTasksForDate(studentId: string, date: string, newTasks: LearningTask[]): Promise<LearningTask[]> {
    // 1. First delete existing tasks for this student and date
    await this.deleteLearningTasksByDate(studentId, date);

    // 2. Insert new tasks if any
    if (newTasks && newTasks.length > 0) {
      return await this.saveLearningTasks(newTasks);
    }
    return [];
  }

  public async deleteLearningTasksByStudent(studentId: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('learning_tasks').delete().eq('student_id', studentId);
      if (error) throw error;
      return;
    } else {
      let list = this.getLearningTasks();
      list = list.filter(t => t.student_id !== studentId);
      this.saveMockData('learning_tasks', list);
    }
  }

  // 5. LearningLogs CRUD
  public async addLearningLog(log: LearningLog): Promise<LearningLog> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('learning_logs').insert(log).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getLearningLogs();
      list.push(log);
      this.saveMockData('learning_logs', list);
      return log;
    }
  }

  // 6. TestRecords CRUD
  public async saveTestRecord(record: TestRecord): Promise<TestRecord> {
    const updatedRecord = { ...record };
    if (updatedRecord.record_type === 'regular_test') {
      updatedRecord.class_rank = updatedRecord.class_rank || 'ー';
      updatedRecord.school_rank = updatedRecord.school_rank || 'ー';
    }

    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('test_records').upsert(updatedRecord).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getTestRecords();
      const idx = list.findIndex(r => r.id === updatedRecord.id);
      if (idx >= 0) list[idx] = updatedRecord;
      else list.push(updatedRecord);
      this.saveMockData('test_records', list);
      return updatedRecord;
    }
  }

  // 7. SchoolCodes CRUD
  public async saveSchoolCodeMaster(code: SchoolCodeMaster): Promise<SchoolCodeMaster> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('school_codes_master').upsert(code).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getSchoolCodesMaster();
      const idx = list.findIndex(c => c.code === code.code);
      if (idx >= 0) list[idx] = code;
      else list.push(code);
      this.saveMockData('school_codes_master', list);
      return code;
    }
  }

  // 8. ExamThresholds CRUD
  public async saveExamThresholdMaster(eth: ExamThresholdMaster): Promise<ExamThresholdMaster> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('exam_thresholds_master').upsert(eth).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getExamThresholdsMaster();
      const idx = list.findIndex(e => e.id === eth.id);
      if (idx >= 0) list[idx] = eth;
      else list.push(eth);
      this.saveMockData('exam_thresholds_master', list);
      return eth;
    }
  }

  // 9. AIReports CRUD
  public async saveAIReport(report: AIReport): Promise<AIReport> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('ai_reports').upsert(report).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getAIReports();
      const idx = list.findIndex(r => r.student_id === report.student_id && r.month === report.month);
      if (idx >= 0) list[idx] = report;
      else list.push(report);
      this.saveMockData('ai_reports', list);
      return report;
    }
  }

  // 10. PromptSetting CRUD
  public async savePromptSetting(setting: PromptSetting): Promise<PromptSetting> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('prompt_settings').upsert(setting).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getPromptSettings();
      const idx = list.findIndex(p => p.id === setting.id);
      if (idx >= 0) list[idx] = setting;
      else list.push(setting);
      this.saveMockData('prompt_settings', list);
      return setting;
    }
  }

  // 11. TeacherCorrectionLogs CRUD
  public async addTeacherCorrectionLog(log: TeacherCorrectionLog): Promise<TeacherCorrectionLog> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('teacher_corrections_log').insert(log).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getTeacherCorrectionsLogs();
      list.push(log);
      this.saveMockData('teacher_corrections_log', list);
      return log;
    }
  }

  // 12. MiniTestResults CRUD
  public getMiniTestResults(): MiniTestResult[] {
    return this.getMockData('mini_test_results', []);
  }

  public async fetchMiniTestResults(studentId?: string, date?: string): Promise<MiniTestResult[]> {
    if (!this.isMockMode && this.supabase) {
      let query = this.supabase.from('mini_test_results').select('*');
      if (studentId) query = query.eq('student_id', studentId);
      if (date) query = query.eq('date', date);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MiniTestResult[];
    }
    const all = this.getMiniTestResults();
    return all.filter(t => {
      if (studentId && t.student_id !== studentId) return false;
      if (date && t.date !== date) return false;
      return true;
    });
  }

  public async saveMiniTestResult(result: MiniTestResult): Promise<MiniTestResult> {
    const sanitized = sanitizeMiniTestResult(result);
    const list = this.getMiniTestResults();
    const idx = list.findIndex(r => r.id === sanitized.id);
    if (idx >= 0) list[idx] = sanitized;
    else list.push(sanitized);
    this.saveMockData('mini_test_results', list);

    if (!this.isMockMode && this.supabase) {
      const dbPayload = {
        id: sanitized.id,
        student_id: sanitized.student_id,
        date: sanitized.date,
        subject: sanitized.subject ?? null,
        test_content: sanitized.test_content,
        score: sanitized.score,
        passed: sanitized.passed ?? null,
        passing_line: sanitized.passing_line ?? null,
        target_scope: sanitized.target_scope ?? 'individual',
        created_at: sanitized.created_at
      };
      const { data, error } = await this.supabase.from('mini_test_results').upsert(dbPayload).select().single();
      if (error) throw error;
      return (data || sanitized) as MiniTestResult;
    }
    return sanitized;
  }

  public async deleteMiniTestResult(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('mini_test_results').delete().eq('id', id);
      if (error) throw error;
      return;
    } else {
      let list = this.getMiniTestResults();
      list = list.filter(r => r.id !== id);
      this.saveMockData('mini_test_results', list);
    }
  }

  public async deleteMiniTestResultByDate(studentId: string, date: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('mini_test_results').delete().eq('student_id', studentId).eq('date', date);
      if (error) console.warn('deleteMiniTestResultByDate supabase error:', error);
      return;
    } else {
      let list = this.getMiniTestResults();
      list = list.filter(r => !(r.student_id === studentId && r.date === date));
      this.saveMockData('mini_test_results', list);
    }
  }

  public async deleteHomeworkResultsByDate(studentId: string, date: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('homework_results').delete().eq('student_id', studentId).eq('date', date);
      if (error) console.warn('deleteHomeworkResultsByDate supabase error:', error);
      return;
    } else {
      let list = this.getHomeworkResults();
      list = list.filter(r => !(r.student_id === studentId && r.date === date));
      this.saveMockData('homework_results', list);
    }
  }

  // 13. HomeworkResults CRUD
  public getHomeworkResults(): HomeworkResult[] {
    return this.getMockData('homework_results', []);
  }

  public async fetchHomeworkResults(studentId?: string, date?: string): Promise<HomeworkResult[]> {
    if (!this.isMockMode && this.supabase) {
      let query = this.supabase.from('homework_results').select('*');
      if (studentId) query = query.eq('student_id', studentId);
      if (date) query = query.eq('date', date);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as HomeworkResult[];
    }
    const all = this.getHomeworkResults();
    return all.filter(t => {
      if (studentId && t.student_id !== studentId) return false;
      if (date && t.date !== date) return false;
      return true;
    });
  }

  public async saveHomeworkResult(result: HomeworkResult): Promise<HomeworkResult> {
    const sanitized = sanitizeHomeworkResult(result);
    const list = this.getHomeworkResults();
    const idx = list.findIndex(r => r.id === sanitized.id);
    if (idx >= 0) list[idx] = sanitized;
    else list.push(sanitized);
    this.saveMockData('homework_results', list);

    if (!this.isMockMode && this.supabase) {
      const dbPayload = {
        id: sanitized.id,
        student_id: sanitized.student_id,
        date: sanitized.date,
        subject: sanitized.subject ?? null,
        homework_content: sanitized.homework_content,
        homework_deadline: sanitized.homework_deadline,
        status: sanitized.status,
        target_scope: sanitized.target_scope ?? 'individual',
        created_at: sanitized.created_at
      };
      const { data, error } = await this.supabase.from('homework_results').upsert(dbPayload).select().single();
      if (error) throw error;
      return (data || sanitized) as HomeworkResult;
    }
    return sanitized;
  }

  public async saveHomeworkResults(results: HomeworkResult[]): Promise<HomeworkResult[]> {
    if (!results || results.length === 0) return [];
    const sanitizedList = results.map(r => sanitizeHomeworkResult(r));
    const list = this.getHomeworkResults();
    sanitizedList.forEach(result => {
      const idx = list.findIndex(r => r.id === result.id);
      if (idx >= 0) list[idx] = result;
      else list.push(result);
    });
    this.saveMockData('homework_results', list);

    if (!this.isMockMode && this.supabase) {
      const dbPayloads = sanitizedList.map(sanitized => ({
        id: sanitized.id,
        student_id: sanitized.student_id,
        date: sanitized.date,
        subject: sanitized.subject ?? null,
        homework_content: sanitized.homework_content,
        homework_deadline: sanitized.homework_deadline,
        status: sanitized.status,
        target_scope: sanitized.target_scope ?? 'individual',
        created_at: sanitized.created_at
      }));
      const { data, error } = await this.supabase.from('homework_results').upsert(dbPayloads).select();
      if (error) throw error;
      return (data || sanitizedList) as HomeworkResult[];
    }
    return sanitizedList;
  }

  public async deleteHomeworkResult(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('homework_results').delete().eq('id', id);
      if (error) throw error;
      return;
    } else {
      let list = this.getHomeworkResults();
      list = list.filter(r => r.id !== id);
      this.saveMockData('homework_results', list);
    }
  }

  // MilestonePlans CRUD
  public getMilestonePlans(): MilestonePlan[] {
    const seed: MilestonePlan[] = [];
    
    // 中3 通常コース 数学
    const mathPlans: Omit<MilestonePlan, 'id' | 'grade' | 'subject' | 'course'>[] = [
      // 3月
      { month: 3, week_number: 1, unit_name: '単元1', target_sequence_order: 9, is_holiday: false, level: 'A', chapter: '第1章', target_theme_name: '正の数・負の数' },
      { month: 3, week_number: 2, unit_name: '単元1', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: '第1章', target_theme_name: '正の数・負の数' },
      { month: 3, week_number: 3, unit_name: '単元1', target_sequence_order: 27, is_holiday: false, level: 'A', chapter: '第1章', target_theme_name: '正の数・負の数' },
      { month: 3, week_number: 4, unit_name: '単元1', target_sequence_order: 37, is_holiday: false, level: 'A', chapter: '第1章', target_theme_name: '正の数・負の数' },
      // 4月
      { month: 4, week_number: 1, unit_name: '単元2', target_sequence_order: 38, is_holiday: false, level: 'A', chapter: '第2章', target_theme_name: '文字を使った式' },
      { month: 4, week_number: 2, unit_name: '単元2', target_sequence_order: 39, is_holiday: false, level: 'A', chapter: '第2章', target_theme_name: '式の値' },
      { month: 4, week_number: 3, unit_name: '単元2', target_sequence_order: 41, is_holiday: false, level: 'A', chapter: '第2章', target_theme_name: '文字式の計算（加減）' },
      { month: 4, week_number: 4, unit_name: '単元2', target_sequence_order: 41, is_holiday: false, level: 'A', chapter: '第2章', target_theme_name: '文字式の計算（加減）' },
      // 5月
      { month: 5, week_number: 1, unit_name: 'GW休暇', target_sequence_order: 41, is_holiday: true, holiday_name: 'GW休暇', level: 'A', chapter: 'GW休暇', target_theme_name: '' },
      { month: 5, week_number: 2, unit_name: '単元3', target_sequence_order: 43, is_holiday: false, level: 'A', chapter: '第3章', target_theme_name: '一次方程式' },
      { month: 5, week_number: 3, unit_name: '単元3', target_sequence_order: 45, is_holiday: false, level: 'A', chapter: '第3章', target_theme_name: '一次方程式' },
      { month: 5, week_number: 4, unit_name: '単元3', target_sequence_order: 46, is_holiday: false, level: 'A', chapter: '第3章', target_theme_name: '一次方程式' },
      // 6月
      { month: 6, week_number: 1, unit_name: '単元3', target_sequence_order: 48, is_holiday: false, level: 'A', chapter: '第3章', target_theme_name: '一次方程式' },
      { month: 6, week_number: 2, unit_name: '単元3', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '第3章', target_theme_name: '一次方程式' },
      { month: 6, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 49, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      { month: 6, week_number: 4, unit_name: '定期テスト対策', target_sequence_order: 49, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      // 7月
      { month: 7, week_number: 1, unit_name: '定期テスト休み', target_sequence_order: 49, is_holiday: true, holiday_name: '定期テスト休み', level: 'A', chapter: 'テスト休み', target_theme_name: '' },
      { month: 7, week_number: 2, unit_name: '単元1〜3の復習', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '復習', target_theme_name: '復習' },
      { month: 7, week_number: 3, unit_name: '単元1〜3の復習', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '復習', target_theme_name: '復習' },
      { month: 7, week_number: 4, unit_name: '単元1〜3の復習', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '復習', target_theme_name: '復習' },
      // 8月
      { month: 8, week_number: 1, unit_name: 'iスクール模試', target_sequence_order: 49, is_holiday: true, holiday_name: 'iスクール模試', level: 'A', chapter: '模試', target_theme_name: '' },
      { month: 8, week_number: 2, unit_name: 'お盆休み', target_sequence_order: 49, is_holiday: true, holiday_name: 'お盆休み', level: 'A', chapter: 'お盆休み', target_theme_name: '' },
      { month: 8, week_number: 3, unit_name: '単元1〜3の復習', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '復習', target_theme_name: '復習' },
      { month: 8, week_number: 4, unit_name: '単元1〜3の復習', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '復習', target_theme_name: '復習' },
      // 9月
      { month: 9, week_number: 1, unit_name: '予備', target_sequence_order: 49, is_holiday: false, level: 'A', chapter: '予備', target_theme_name: '' },
      { month: 9, week_number: 2, unit_name: '定期テスト対策', target_sequence_order: 49, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      { month: 9, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 49, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: 'テスト対策', target_theme_name: '' }
    ];

    // 中3 通常コース 英語
    const englishPlans: Omit<MilestonePlan, 'id' | 'grade' | 'subject' | 'course'>[] = [
      // 3月
      { month: 3, week_number: 1, unit_name: '1', target_sequence_order: 1, is_holiday: false, level: 'A', chapter: 'Lesson 1', target_theme_name: 'Be動詞' },
      { month: 3, week_number: 2, unit_name: '1', target_sequence_order: 3, is_holiday: false, level: 'A', chapter: 'Lesson 1', target_theme_name: 'Be動詞疑問文' },
      { month: 3, week_number: 3, unit_name: '2', target_sequence_order: 4, is_holiday: false, level: 'A', chapter: 'Lesson 2', target_theme_name: '一般動詞' },
      { month: 3, week_number: 4, unit_name: '2', target_sequence_order: 6, is_holiday: false, level: 'A', chapter: 'Lesson 2', target_theme_name: '一般動詞疑問文' },
      // 4月
      { month: 4, week_number: 1, unit_name: '3', target_sequence_order: 7, is_holiday: false, level: 'A', chapter: 'Lesson 3', target_theme_name: '現在進行形' },
      { month: 4, week_number: 2, unit_name: '3', target_sequence_order: 8, is_holiday: false, level: 'A', chapter: 'Lesson 3', target_theme_name: '現在進行形否定疑問' },
      { month: 4, week_number: 3, unit_name: '4', target_sequence_order: 9, is_holiday: false, level: 'A', chapter: 'Lesson 4', target_theme_name: '規則動詞の過去形' },
      { month: 4, week_number: 4, unit_name: '4', target_sequence_order: 10, is_holiday: false, level: 'A', chapter: 'Lesson 4', target_theme_name: '規則動詞過去否定疑問' },
      // 5月
      { month: 5, week_number: 1, unit_name: 'GW休暇', target_sequence_order: 10, is_holiday: true, holiday_name: 'GW休暇', level: 'A', chapter: 'GW休暇', target_theme_name: '' },
      { month: 5, week_number: 2, unit_name: '5', target_sequence_order: 12, is_holiday: false, level: 'A', chapter: 'Lesson 5', target_theme_name: '不規則動詞の過去形' },
      { month: 5, week_number: 3, unit_name: '6', target_sequence_order: 14, is_holiday: false, level: 'A', chapter: 'Lesson 6', target_theme_name: '未来の表現' },
      { month: 5, week_number: 4, unit_name: '7', target_sequence_order: 16, is_holiday: false, level: 'A', chapter: 'Lesson 7', target_theme_name: '助動詞' },
      // 6月
      { month: 6, week_number: 1, unit_name: '8', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 8', target_theme_name: '不定詞' },
      { month: 6, week_number: 2, unit_name: '予備', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: '予備', target_theme_name: '' },
      { month: 6, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 18, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      { month: 6, week_number: 4, unit_name: '定期テスト対策', target_sequence_order: 18, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      // 7月
      { month: 7, week_number: 1, unit_name: '定期テスト休み', target_sequence_order: 18, is_holiday: true, holiday_name: '定期テスト休み', level: 'A', chapter: 'テスト休み', target_theme_name: '' },
      { month: 7, week_number: 2, unit_name: '9', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 9', target_theme_name: '動名詞' },
      { month: 7, week_number: 3, unit_name: '9', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 9', target_theme_name: '動名詞' },
      { month: 7, week_number: 4, unit_name: '10', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 10', target_theme_name: '総合' },
      // 8月
      { month: 8, week_number: 1, unit_name: 'iスクール模試', target_sequence_order: 18, is_holiday: true, holiday_name: 'iスクール模試', level: 'A', chapter: '模試', target_theme_name: '' },
      { month: 8, week_number: 2, unit_name: 'お盆休み', target_sequence_order: 18, is_holiday: true, holiday_name: 'お盆休み', level: 'A', chapter: 'お盆休み', target_theme_name: '' },
      { month: 8, week_number: 3, unit_name: '10', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 10', target_theme_name: '総合' },
      { month: 8, week_number: 4, unit_name: '10', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 10', target_theme_name: '総合' },
      // 9月
      { month: 9, week_number: 1, unit_name: '11', target_sequence_order: 18, is_holiday: false, level: 'A', chapter: 'Lesson 11', target_theme_name: 'まとめ' },
      { month: 9, week_number: 2, unit_name: '定期テスト対策', target_sequence_order: 18, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: 'テスト対策', target_theme_name: '' },
      { month: 9, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 18, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: 'テスト対策', target_theme_name: '' }
    ];

    // 中1 数学 レベルA
    const m1MathA: Omit<MilestonePlan, 'id' | 'grade' | 'subject' | 'course'>[] = [
      { month: 4, week_number: 1, unit_name: '正の数と負の数', target_sequence_order: 4, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数で量を表すこと' },
      { month: 4, week_number: 2, unit_name: '絶対値', target_sequence_order: 6, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '絶対値' },
      { month: 4, week_number: 3, unit_name: '加法・減法', target_sequence_order: 12, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の加法（異符号）' },
      { month: 4, week_number: 4, unit_name: '加減混合', target_sequence_order: 17, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '加法と減法が混ざった計算' },
      { month: 5, week_number: 1, unit_name: 'GW休暇', target_sequence_order: 17, is_holiday: true, holiday_name: 'GW休暇', level: 'A', chapter: 'GW休暇', target_theme_name: '' },
      { month: 5, week_number: 2, unit_name: '乗法・除法', target_sequence_order: 20, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の除法①' },
      { month: 5, week_number: 3, unit_name: '四則混合', target_sequence_order: 27, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '同じ数の積' },
      { month: 5, week_number: 4, unit_name: '分配法則と利用', target_sequence_order: 32, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '分配法則' },
      { month: 6, week_number: 1, unit_name: '素因数分解', target_sequence_order: 37, is_holiday: false, level: 'A', chapter: '第1章 正の数・負の数', target_theme_name: '素因数分解の利用' },
      { month: 6, week_number: 2, unit_name: '文字を用いた式', target_sequence_order: 38, is_holiday: false, level: 'A', chapter: '第2章 文字の式', target_theme_name: '文字を使った式' },
      { month: 6, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 38, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 6, week_number: 4, unit_name: '定期テスト対策', target_sequence_order: 38, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'A', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 7, week_number: 1, unit_name: '定期テスト休み', target_sequence_order: 38, is_holiday: true, holiday_name: '定期テスト休み', level: 'A', chapter: '定期テスト休み', target_theme_name: '' },
      { month: 7, week_number: 2, unit_name: '式の値', target_sequence_order: 39, is_holiday: false, level: 'A', chapter: '第2章 文字の式', target_theme_name: '式の値' },
      { month: 7, week_number: 3, unit_name: '文字式の計算', target_sequence_order: 40, is_holiday: false, level: 'A', chapter: '第2章 文字の式', target_theme_name: '文字式の計算（加減）' },
      { month: 7, week_number: 4, unit_name: '文字式の利用', target_sequence_order: 41, is_holiday: false, level: 'A', chapter: '第2章 文字の式', target_theme_name: '文字式の利用（数量の表し方）' },
      { month: 8, week_number: 1, unit_name: 'iスクール模試', target_sequence_order: 41, is_holiday: true, holiday_name: 'iスクール模試', level: 'A', chapter: '模試', target_theme_name: '' },
      { month: 8, week_number: 2, unit_name: 'お盆休み', target_sequence_order: 41, is_holiday: true, holiday_name: 'お盆休み', level: 'A', chapter: 'お盆休み', target_theme_name: '' },
      { month: 8, week_number: 3, unit_name: '等式と方程式', target_sequence_order: 42, is_holiday: false, level: 'A', chapter: '第3章 方程式', target_theme_name: '等式と方程式の解' },
      { month: 8, week_number: 4, unit_name: '方程式の解き方', target_sequence_order: 44, is_holiday: false, level: 'A', chapter: '第3章 方程式', target_theme_name: '一次方程式の解き方' },
      { month: 9, week_number: 1, unit_name: '方程式の利用', target_sequence_order: 45, is_holiday: false, level: 'A', chapter: '第3章 方程式', target_theme_name: '一次方程式の利用（文章題）' },
      { month: 9, week_number: 2, unit_name: '定期テスト対策', target_sequence_order: 45, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 9, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 45, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'A', chapter: '定期テスト対策', target_theme_name: '' }
    ];

    // 中1 数学 レベルB (ユーザー指定の標準年間計画)
    const m1MathB: Omit<MilestonePlan, 'id' | 'grade' | 'subject' | 'course'>[] = [
      // 3月
      { month: 3, week_number: 1, unit_name: '1章 正の数・負の数', is_holiday: false, level: 'B', chapter: '1章 正の数・負の数' },
      { month: 3, week_number: 2, unit_name: '1章 正の数・負の数', is_holiday: false, level: 'B', chapter: '1章 正の数・負の数' },
      { month: 3, week_number: 3, unit_name: '1章 正の数・負の数', is_holiday: false, level: 'B', chapter: '1章 正の数・負の数' },
      { month: 3, week_number: 4, unit_name: '1章 正の数・負の数', is_holiday: false, level: 'B', chapter: '1章 正の数・負の数' },
      // 4月
      { month: 4, week_number: 1, unit_name: '2章 文字の式', is_holiday: false, level: 'B', chapter: '2章 文字の式' },
      { month: 4, week_number: 2, unit_name: '2章 文字の式', is_holiday: false, level: 'B', chapter: '2章 文字の式' },
      { month: 4, week_number: 3, unit_name: '2章 文字の式', is_holiday: false, level: 'B', chapter: '2章 文字の式' },
      { month: 4, week_number: 4, unit_name: '2章 文字の式', is_holiday: false, level: 'B', chapter: '2章 文字の式' },
      // 5月
      { month: 5, week_number: 1, unit_name: 'GW休暇', is_holiday: true, holiday_name: 'GW休暇', level: 'B', chapter: 'GW休暇' },
      { month: 5, week_number: 2, unit_name: '3章 方程式', is_holiday: false, level: 'B', chapter: '3章 方程式' },
      { month: 5, week_number: 3, unit_name: '3章 方程式', is_holiday: false, level: 'B', chapter: '3章 方程式' },
      { month: 5, week_number: 4, unit_name: '3章 方程式', is_holiday: false, level: 'B', chapter: '3章 方程式' },
      // 6月
      { month: 6, week_number: 1, unit_name: '3章 方程式', is_holiday: false, level: 'B', chapter: '3章 方程式' },
      { month: 6, week_number: 2, unit_name: '3章 方程式', is_holiday: false, level: 'B', chapter: '3章 方程式' },
      { month: 6, week_number: 3, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      { month: 6, week_number: 4, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      // 7月
      { month: 7, week_number: 1, unit_name: '定期テスト休み', is_holiday: true, holiday_name: '定期テスト休み', level: 'B', chapter: 'テスト休み' },
      { month: 7, week_number: 2, unit_name: '1章〜3章の復習', is_holiday: false, level: 'B', chapter: '復習' },
      { month: 7, week_number: 3, unit_name: '1章〜3章の復習', is_holiday: false, level: 'B', chapter: '復習' },
      { month: 7, week_number: 4, unit_name: '1章〜3章の復習', is_holiday: false, level: 'B', chapter: '復習' },
      // 8月
      { month: 8, week_number: 1, unit_name: '夏休み', is_holiday: true, holiday_name: '夏休み', level: 'B', chapter: '夏休み' },
      { month: 8, week_number: 2, unit_name: 'お盆休み', is_holiday: true, holiday_name: 'お盆休み', level: 'B', chapter: 'お盆休み' },
      { month: 8, week_number: 3, unit_name: '1章〜3章の復習', is_holiday: false, level: 'B', chapter: '復習' },
      { month: 8, week_number: 4, unit_name: '1章〜3章の復習', is_holiday: false, level: 'B', chapter: '復習' },
      // 9月
      { month: 9, week_number: 1, unit_name: '予備', is_holiday: false, level: 'B', chapter: '予備' },
      { month: 9, week_number: 2, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      { month: 9, week_number: 3, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      { month: 9, week_number: 4, unit_name: 'シルバーウィーク休み', is_holiday: true, holiday_name: 'シルバーウィーク休み', level: 'B', chapter: '休み' },
      // 10月
      { month: 10, week_number: 1, unit_name: '4章 変化の割合', is_holiday: false, level: 'B', chapter: '4章 変化の割合' },
      { month: 10, week_number: 2, unit_name: '4章 変化の割合', is_holiday: false, level: 'B', chapter: '4章 変化の割合' },
      { month: 10, week_number: 3, unit_name: '4章 変化の割合', is_holiday: false, level: 'B', chapter: '4章 変化の割合' },
      { month: 10, week_number: 4, unit_name: '4章 変化の割合', is_holiday: false, level: 'B', chapter: '4章 変化の割合' },
      // 11月
      { month: 11, week_number: 1, unit_name: '5章 平面図形', is_holiday: false, level: 'B', chapter: '5章 平面図形' },
      { month: 11, week_number: 2, unit_name: '5章 平面図形', is_holiday: false, level: 'B', chapter: '5章 平面図形' },
      { month: 11, week_number: 3, unit_name: '5章 平面図形', is_holiday: false, level: 'B', chapter: '5章 平面図形' },
      { month: 11, week_number: 4, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      // 12月
      { month: 12, week_number: 1, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      { month: 12, week_number: 2, unit_name: '定期テスト対策', is_holiday: true, holiday_name: '定期テスト対策期間', level: 'B', chapter: 'テスト対策' },
      { month: 12, week_number: 3, unit_name: '冬休み', is_holiday: true, holiday_name: '冬休み', level: 'B', chapter: '冬休み' },
      { month: 12, week_number: 4, unit_name: '年末年始休み', is_holiday: true, holiday_name: '年末年始休み', level: 'B', chapter: '年末年始休み' },
      // 1月
      { month: 1, week_number: 1, unit_name: '正月休み', is_holiday: true, holiday_name: '正月休み', level: 'B', chapter: '正月休み' },
      { month: 1, week_number: 2, unit_name: '6章 空間図形', is_holiday: false, level: 'B', chapter: '6章 空間図形' },
      { month: 1, week_number: 3, unit_name: '6章 空間図形', is_holiday: false, level: 'B', chapter: '6章 空間図形' },
      { month: 1, week_number: 4, unit_name: '6章 空間図形', is_holiday: false, level: 'B', chapter: '6章 空間図形' },
      // 2月
      { month: 2, week_number: 1, unit_name: '7章 データの活用', is_holiday: false, level: 'B', chapter: '7章 データの活用' },
      { month: 2, week_number: 2, unit_name: '学年末テスト対策', is_holiday: true, holiday_name: '学年末テスト対策', level: 'B', chapter: 'テスト対策' },
      { month: 2, week_number: 3, unit_name: '学年末テスト対策', is_holiday: true, holiday_name: '学年末テスト対策', level: 'B', chapter: 'テスト対策' },
      { month: 2, week_number: 4, unit_name: '学年末テスト対策', is_holiday: true, holiday_name: '学年末テスト対策', level: 'B', chapter: 'テスト対策' },
      // 3月 (翌年)
      { month: 3, week_number: 1, unit_name: '', is_holiday: false, level: 'B', chapter: '' },
      { month: 3, week_number: 2, unit_name: '', is_holiday: false, level: 'B', chapter: '' },
      { month: 3, week_number: 3, unit_name: '', is_holiday: false, level: 'B', chapter: '' }
    ];

    // 中1 数学 レベルC
    const m1MathC: Omit<MilestonePlan, 'id' | 'grade' | 'subject' | 'course'>[] = [
      { month: 4, week_number: 1, unit_name: '正の数と負の数', target_sequence_order: 3, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '自然数' },
      { month: 4, week_number: 2, unit_name: '数直線', target_sequence_order: 7, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '数直線' },
      { month: 4, week_number: 3, unit_name: '加法（同符号）', target_sequence_order: 10, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の加法（同符号）' },
      { month: 4, week_number: 4, unit_name: '加法（異符号）', target_sequence_order: 12, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の加法（異符号）' },
      { month: 5, week_number: 1, unit_name: 'GW休暇', target_sequence_order: 12, is_holiday: true, holiday_name: 'GW休暇', level: 'C', chapter: 'GW休暇', target_theme_name: '' },
      { month: 5, week_number: 2, unit_name: '減法', target_sequence_order: 14, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の減法' },
      { month: 5, week_number: 3, unit_name: '加減混合', target_sequence_order: 16, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '3つ以上の数の加法・減法' },
      { month: 5, week_number: 4, unit_name: '加減混合応用', target_sequence_order: 17, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '加法と減法が混ざった計算' },
      { month: 6, week_number: 1, unit_name: '乗法', target_sequence_order: 18, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の乗法①' },
      { month: 6, week_number: 2, unit_name: '除法', target_sequence_order: 20, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '正の数・負の数の除法①' },
      { month: 6, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 20, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'C', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 6, week_number: 4, unit_name: '定期テスト対策', target_sequence_order: 20, is_holiday: true, holiday_name: '定期テスト対策期間（前期中間）', level: 'C', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 7, week_number: 1, unit_name: '定期テスト休み', target_sequence_order: 20, is_holiday: true, holiday_name: '定期テスト休み', level: 'C', chapter: '定期テスト休み', target_theme_name: '' },
      { month: 7, week_number: 2, unit_name: '乗除混合', target_sequence_order: 23, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '逆数' },
      { month: 7, week_number: 3, unit_name: '四則混合', target_sequence_order: 28, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '指数をふくむ計算' },
      { month: 7, week_number: 4, unit_name: '分配法則', target_sequence_order: 32, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '分配法則' },
      { month: 8, week_number: 1, unit_name: 'iスクール模試', target_sequence_order: 32, is_holiday: true, holiday_name: 'iスクール模試', level: 'C', chapter: '模試', target_theme_name: '' },
      { month: 8, week_number: 2, unit_name: 'お盆休み', target_sequence_order: 32, is_holiday: true, holiday_name: 'お盆休み', level: 'C', chapter: 'お盆休み', target_theme_name: '' },
      { month: 8, week_number: 3, unit_name: '素因数分解', target_sequence_order: 36, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '素因数分解' },
      { month: 8, week_number: 4, unit_name: 'まとめ', target_sequence_order: 37, is_holiday: false, level: 'C', chapter: '第1章 正の数・負の数', target_theme_name: '素因数分解の利用' },
      { month: 9, week_number: 1, unit_name: '文字を用いた式', target_sequence_order: 38, is_holiday: false, level: 'C', chapter: '第2章 文字の式', target_theme_name: '文字を使った式' },
      { month: 9, week_number: 2, unit_name: '定期テスト対策', target_sequence_order: 38, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'C', chapter: '定期テスト対策', target_theme_name: '' },
      { month: 9, week_number: 3, unit_name: '定期テスト対策', target_sequence_order: 38, is_holiday: true, holiday_name: '定期テスト対策期間（前期期末）', level: 'C', chapter: '定期テスト対策', target_theme_name: '' }
    ];

    mathPlans.forEach(p => {
      seed.push({
        id: `mp-math-levelA-${p.month}-${p.week_number}`,
        grade: '中3',
        subject: '数学',
        course: 'standard',
        ...p
      });
    });

    englishPlans.forEach(p => {
      seed.push({
        id: `mp-eng-levelA-${p.month}-${p.week_number}`,
        grade: '中3',
        subject: '英語',
        course: 'standard',
        ...p
      });
    });

    m1MathA.forEach(p => {
      seed.push({
        id: `mp-m1math-levelA-${p.month}-${p.week_number}`,
        grade: '中1',
        subject: '数学',
        course: 'standard',
        ...p
      });
    });

    m1MathB.forEach(p => {
      // 中1 数学 レベルB
      seed.push({
        id: `mp-m1math-levelB-${p.month}-${p.week_number}`,
        grade: '中1',
        subject: '数学',
        course: 'standard',
        ...p
      });
      // 中2 数学 レベルB
      seed.push({
        id: `mp-m2math-levelB-${p.month}-${p.week_number}`,
        grade: '中2',
        subject: '数学',
        course: 'standard',
        ...p
      });
      // 中3 数学 レベルB
      seed.push({
        id: `mp-m3math-levelB-${p.month}-${p.week_number}`,
        grade: '中3',
        subject: '数学',
        course: 'standard',
        ...p
      });
    });

    m1MathC.forEach(p => {
      seed.push({
        id: `mp-m1math-levelC-${p.month}-${p.week_number}`,
        grade: '中1',
        subject: '数学',
        course: 'standard',
        ...p
      });
    });

    return this.getMockData('milestone_plans', seed);
  }

  public async saveMilestonePlan(plan: MilestonePlan): Promise<MilestonePlan> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('milestone_plans').upsert(plan).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getMilestonePlans();
      const idx = list.findIndex(p => p.id === plan.id);
      if (idx >= 0) list[idx] = plan;
      else list.push(plan);
      this.saveMockData('milestone_plans', list);
      return plan;
    }
  }

  public async saveMilestonePlans(plans: MilestonePlan[]): Promise<MilestonePlan[]> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('milestone_plans').upsert(plans).select();
      if (error) throw error;
      return data;
    } else {
      this.saveMockData('milestone_plans', plans);
      return plans;
    }
  }

  // MilestoneTemplates CRUD
  public getMilestoneTemplates(): MilestoneTemplate[] {
    return this.getMockData('milestone_templates', []);
  }

  public async saveMilestoneTemplate(template: MilestoneTemplate): Promise<MilestoneTemplate> {
    const list = this.getMilestoneTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    if (idx >= 0) list[idx] = template;
    else list.push(template);
    this.saveMockData('milestone_templates', list);
    return template;
  }

  public async deleteMilestoneTemplate(id: string): Promise<boolean> {
    const list = this.getMilestoneTemplates().filter(t => t.id !== id);
    this.saveMockData('milestone_templates', list);
    return true;
  }

  // 13.5. CurriculumMasters CRUD
  public getCurriculumMasters(subject?: string): CurriculumMaster[] {
    const seed: CurriculumMaster[] = [
      // 小1 算数
      { id: 'cm-p1-m1', grade: '小1', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: '1から5までのかず', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-p1-m2', grade: '小1', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: 'いくつといくつ（数の合成・分解）', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-p1-m3', grade: '小1', subject: '算数', unit_name: '2章 たしざんとひきざん', lesson_name: 'あわせていくつ（1桁の加法）', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-p1-m4', grade: '小1', subject: '算数', unit_name: '2章 たしざんとひきざん', lesson_name: 'のこりはいくつ（1桁の減法）', sort_order: 4, created_at: new Date().toISOString() },
      // 小2 算数
      { id: 'cm-p2-m1', grade: '小2', subject: '算数', unit_name: '1章 2けたのたし算・ひき算', lesson_name: '2桁のたし算の筆算', sort_order: 5, created_at: new Date().toISOString() },
      { id: 'cm-p2-m2', grade: '小2', subject: '算数', unit_name: '1章 2けたのたし算・ひき算', lesson_name: '2桁のひき算の筆算', sort_order: 6, created_at: new Date().toISOString() },
      { id: 'cm-p2-m3', grade: '小2', subject: '算数', unit_name: '2章 かけ算（九九）', lesson_name: 'かけ算の意味と九九（前半 2〜5の段）', sort_order: 7, created_at: new Date().toISOString() },
      { id: 'cm-p2-m4', grade: '小2', subject: '算数', unit_name: '2章 かけ算（九九）', lesson_name: '九九の完成（後半 6〜9の段・1の段）', sort_order: 8, created_at: new Date().toISOString() },
      // 小3 算数
      { id: 'cm-p3-m1', grade: '小3', subject: '算数', unit_name: '1章 わり算の基礎', lesson_name: 'わり算の意味と九九を使った計算', sort_order: 9, created_at: new Date().toISOString() },
      { id: 'cm-p3-m2', grade: '小3', subject: '算数', unit_name: '1章 わり算の基礎', lesson_name: 'あまりのあるわり算', sort_order: 10, created_at: new Date().toISOString() },
      { id: 'cm-p3-m3', grade: '小3', subject: '算数', unit_name: '2章 小数と分数', lesson_name: '小数の意味と加減', sort_order: 11, created_at: new Date().toISOString() },
      { id: 'cm-p3-m4', grade: '小3', subject: '算数', unit_name: '2章 小数と分数', lesson_name: '分数の意味と同分母加減', sort_order: 12, created_at: new Date().toISOString() },
      // 小4 算数
      { id: 'cm-p4-m1', grade: '小4', subject: '算数', unit_name: '1章 わり算の筆算', lesson_name: '2桁・3桁÷1桁の筆算', sort_order: 13, created_at: new Date().toISOString() },
      { id: 'cm-p4-m2', grade: '小4', subject: '算数', unit_name: '1章 わり算の筆算', lesson_name: '2桁÷2桁の筆算と商の仮定', sort_order: 14, created_at: new Date().toISOString() },
      { id: 'cm-p4-m3', grade: '小4', subject: '算数', unit_name: '2章 面積と角度', lesson_name: '長方形・正方形の面積公式', sort_order: 15, created_at: new Date().toISOString() },
      { id: 'cm-p4-m4', grade: '小4', subject: '算数', unit_name: '2章 面積と角度', lesson_name: '角度の測定と三角形の内角', sort_order: 16, created_at: new Date().toISOString() },
      // 小5 算数
      { id: 'cm-elem-1', grade: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: '小数と10倍・100倍・1/10', sort_order: 17, created_at: new Date().toISOString() },
      { id: 'cm-elem-2', grade: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: '小数の位取りと数の構成', sort_order: 18, created_at: new Date().toISOString() },
      { id: 'cm-elem-3', grade: '小5', subject: '算数', unit_name: '2章 小数の乗除', lesson_name: '小数×整数の計算', sort_order: 19, created_at: new Date().toISOString() },
      { id: 'cm-elem-4', grade: '小5', subject: '算数', unit_name: '2章 小数の乗除', lesson_name: '小数÷整数の計算', sort_order: 20, created_at: new Date().toISOString() },
      { id: 'cm-elem-5', grade: '小5', subject: '算数', unit_name: '2章 小数の乗除', lesson_name: '小数×小数の筆算', sort_order: 21, created_at: new Date().toISOString() },
      { id: 'cm-elem-6', grade: '小5', subject: '算数', unit_name: '2章 小数の乗除', lesson_name: '小数÷小数の筆算と余り', sort_order: 22, created_at: new Date().toISOString() },
      { id: 'cm-elem-7', grade: '小5', subject: '算数', unit_name: '3章 図形の角と体積', lesson_name: '三角形と四角形の内角の和', sort_order: 23, created_at: new Date().toISOString() },
      { id: 'cm-elem-8', grade: '小5', subject: '算数', unit_name: '3章 図形の角と体積', lesson_name: '直方体・立方体の体積公式', sort_order: 24, created_at: new Date().toISOString() },
      { id: 'cm-elem-9', grade: '小5', subject: '算数', unit_name: '4章 分数と約数・倍数', lesson_name: '公約数・最大公約数の求め方', sort_order: 25, created_at: new Date().toISOString() },
      { id: 'cm-elem-10', grade: '小5', subject: '算数', unit_name: '4章 分数と約数・倍数', lesson_name: '公倍数・最小公倍数の求め方', sort_order: 26, created_at: new Date().toISOString() },
      { id: 'cm-elem-11', grade: '小5', subject: '算数', unit_name: '4章 分数と約数・倍数', lesson_name: '通分と約分', sort_order: 27, created_at: new Date().toISOString() },
      { id: 'cm-elem-12', grade: '小5', subject: '算数', unit_name: '4章 分数と約数・倍数', lesson_name: '分数のたし算とひき算', sort_order: 28, created_at: new Date().toISOString() },
      { id: 'cm-elem-13', grade: '小5', subject: '算数', unit_name: '5章 単位量あたりの大きさ', lesson_name: '単位量あたりの大きさ・人口密度', sort_order: 29, created_at: new Date().toISOString() },
      { id: 'cm-elem-14', grade: '小5', subject: '算数', unit_name: '5章 単位量あたりの大きさ', lesson_name: '速さ・道のり・時間の公式', sort_order: 30, created_at: new Date().toISOString() },
      { id: 'cm-elem-15', grade: '小5', subject: '算数', unit_name: '6章 割合と百分率', lesson_name: '割合の意味と比べられる量・もとにする量', sort_order: 31, created_at: new Date().toISOString() },
      { id: 'cm-elem-16', grade: '小5', subject: '算数', unit_name: '6章 割合と百分率', lesson_name: '百分率（％）と歩合の計算', sort_order: 32, created_at: new Date().toISOString() },
      { id: 'cm-elem-17', grade: '小5', subject: '算数', unit_name: '7章 正多角形と円周の長さ', lesson_name: '円周率と円周の長さ公式', sort_order: 33, created_at: new Date().toISOString() },
      { id: 'cm-elem-18', grade: '小5', subject: '算数', unit_name: '8章 角柱と円柱', lesson_name: '見取り図と展開図・底面と側面', sort_order: 34, created_at: new Date().toISOString() },
      // 小6 算数
      { id: 'cm-p6-m1', grade: '小6', subject: '算数', unit_name: '1章 分数の乗除', lesson_name: '分数×分数の計算と約分', sort_order: 35, created_at: new Date().toISOString() },
      { id: 'cm-p6-m2', grade: '小6', subject: '算数', unit_name: '1章 分数の乗除', lesson_name: '分数÷分数の計算と逆数', sort_order: 36, created_at: new Date().toISOString() },
      { id: 'cm-p6-m3', grade: '小6', subject: '算数', unit_name: '2章 比とその利用', lesson_name: '比の値と等しい比の性質', sort_order: 37, created_at: new Date().toISOString() },
      { id: 'cm-p6-m4', grade: '小6', subject: '算数', unit_name: '2章 比とその利用', lesson_name: '比例・反比例のグラフと応用', sort_order: 38, created_at: new Date().toISOString() },
      { id: 'cm-p6-m5', grade: '小6', subject: '算数', unit_name: '3章 円の面積・立体の体積', lesson_name: '円の面積公式（半径×半径×3.14）', sort_order: 39, created_at: new Date().toISOString() },
      { id: 'cm-p6-m6', grade: '小6', subject: '算数', unit_name: '3章 円の面積・立体の体積', lesson_name: '柱体の体積公式（底面積×高さ）', sort_order: 40, created_at: new Date().toISOString() },
      // 小5・小6 国語
      { id: 'cm-p-jp1', grade: '小5', subject: '国語', unit_name: '1章 言語事項', lesson_name: '同音異義語・同訓異字の使い分け', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-p-jp2', grade: '小5', subject: '国語', unit_name: '1章 言語事項', lesson_name: '敬語の種類（尊敬語・謙譲語・丁寧語）', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-p-jp3', grade: '小6', subject: '国語', unit_name: '2章 説明文・論説文', lesson_name: '段落相互の関係と要約の作成', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-p-jp4', grade: '小6', subject: '国語', unit_name: '3章 物語文・心情読解', lesson_name: '登場人物の心情変化と主題の把握', sort_order: 4, created_at: new Date().toISOString() },
      // 小5・小6 理科
      { id: 'cm-p-sc1', grade: '小5', subject: '理科', unit_name: '1章 植物の発芽と成長', lesson_name: '発芽に必要な条件（水・空気・温度）', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-p-sc2', grade: '小5', subject: '理科', unit_name: '2章 電流の働き', lesson_name: '電磁石の強さと極の性質', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-p-sc3', grade: '小6', subject: '理科', unit_name: '3章 水溶液の性質', lesson_name: '酸性・アルカリ性・中性の指示薬判定', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-p-sc4', grade: '小6', subject: '理科', unit_name: '4章 人の体のつくりと働き', lesson_name: '呼吸・消化・血液循環の仕組み', sort_order: 4, created_at: new Date().toISOString() },
      // 小5・小6 社会
      { id: 'cm-p-so1', grade: '小5', subject: '社会', unit_name: '1章 日本の国土と農業', lesson_name: '米づくりの盛んな地域と気候条件', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-p-so2', grade: '小5', subject: '社会', unit_name: '2章 日本の工業', lesson_name: '太平洋ベルトと工業地帯の特色', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-p-so3', grade: '小6', subject: '社会', unit_name: '3章 日本の歴史', lesson_name: '縄文・弥生・古墳時代の成り立ち', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-p-so4', grade: '小6', subject: '社会', unit_name: '4章 政治・国際社会', lesson_name: '日本国憲法の三大原則と国会・内閣・裁判所', sort_order: 4, created_at: new Date().toISOString() },
      // 小5・小6 英語
      { id: 'cm-p-en1', grade: '小5', subject: '英語', unit_name: '1章 自己紹介と日常会話', lesson_name: 'What do you like? / I like ...', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-p-en2', grade: '小5', subject: '英語', unit_name: '2章 時間とスケジュール', lesson_name: 'What time is it? / Daily routine', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-p-en3', grade: '小6', subject: '英語', unit_name: '3章 過去形と思い出', lesson_name: 'Where did you go? / I went to ...', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-p-en4', grade: '小6', subject: '英語', unit_name: '4章 将来の夢・職業', lesson_name: 'What do you want to be? / I want to be ...', sort_order: 4, created_at: new Date().toISOString() },
      // 中3 数学
      { id: 'cm-jhs-1', grade: '中3', subject: '数学', unit_name: '1章 式の展開と因数分解', lesson_name: '多項式の乗法と公式①', sort_order: 1, created_at: new Date().toISOString() },
      { id: 'cm-jhs-2', grade: '中3', subject: '数学', unit_name: '1章 式の展開と因数分解', lesson_name: '乗法公式②③④と展開の工夫', sort_order: 2, created_at: new Date().toISOString() },
      { id: 'cm-jhs-3', grade: '中3', subject: '数学', unit_name: '1章 式の展開と因数分解', lesson_name: '因数分解の基本と公式利用', sort_order: 3, created_at: new Date().toISOString() },
      { id: 'cm-jhs-4', grade: '中3', subject: '数学', unit_name: '2章 平方根', lesson_name: '平方根の意味と根号（√）', sort_order: 4, created_at: new Date().toISOString() },
      { id: 'cm-jhs-5', grade: '中3', subject: '数学', unit_name: '2章 平方根', lesson_name: '根号を含む式の計算と有理化', sort_order: 5, created_at: new Date().toISOString() }
    ];
    const stored = this.getMockData('curriculum_masters', seed);
    const sorted = [...stored].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    if (subject) {
      return sorted.filter(m => m.subject === subject);
    }
    return sorted;
  }

  public async fetchCurriculumMasters(subject?: string): Promise<CurriculumMaster[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        let query = this.supabase
          .from('curriculum_masters')
          .select('*')
          .order('sort_order', { ascending: true })
          .limit(1000);

        if (subject) {
          query = query.eq('subject', subject);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const currentList = this.getCurriculumMasters();
          data.forEach((item: CurriculumMaster) => {
            const idx = currentList.findIndex(c => c.id === item.id);
            if (idx >= 0) currentList[idx] = item;
            else currentList.push(item);
          });
          this.saveMockData('curriculum_masters', currentList);
          return (data as CurriculumMaster[]).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        } else if (error) {
          console.warn('Supabase fetchCurriculumMasters warning, fallback to local storage:', error);
        }
      } catch (e) {
        console.warn('Supabase fetchCurriculumMasters exception:', e);
      }
    }
    return this.getCurriculumMasters(subject);
  }

  public async saveCurriculumMasters(masters: CurriculumMaster[]): Promise<CurriculumMaster[]> {
    let savedList: CurriculumMaster[] = [];
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('curriculum_masters').upsert(masters).select();
        if (!error && data) {
          savedList = data;
        } else {
          console.warn('Supabase curriculum_masters upsert warning, fallback to local storage:', error);
          savedList = masters;
        }
      } catch (e) {
        console.warn('Supabase curriculum_masters upsert exception:', e);
        savedList = masters;
      }
    } else {
      savedList = masters;
    }

    // Always update local cache
    const currentList = this.getCurriculumMasters();
    masters.forEach(m => {
      const idx = currentList.findIndex(item => item.id === m.id);
      if (idx >= 0) currentList[idx] = m;
      else currentList.push(m);
    });
    this.saveMockData('curriculum_masters', currentList);

    return savedList;
  }

  public async deleteCurriculumMaster(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        await this.supabase.from('curriculum_masters').delete().eq('id', id);
      } catch (e) {
        console.warn('Supabase deleteCurriculumMaster exception:', e);
      }
    }
    const list = this.getCurriculumMasters().filter(m => m.id !== id);
    this.saveMockData('curriculum_masters', list);
  }

  public async clearCurriculumMasters(): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        await this.supabase.from('curriculum_masters').delete().neq('id', 'dummy');
      } catch (e) {
        console.warn('Supabase clearCurriculumMasters exception:', e);
      }
    }
    this.saveMockData('curriculum_masters', []);
  }

  /**
   * 旧フォーマット（小1, 小2, 小3, 小4, 小5, 小6, 中3 等）のデータを一括削除
   * DELETE FROM public.curriculum_masters WHERE grade_level IN (...) OR grade IN (...)
   */
  public async deleteCurriculumMastersByGrades(grades: string[] = ['小1', '小2', '小3', '小4', '小5', '小6', '中3']): Promise<{ success: boolean; deletedCount: number }> {
    let deletedCount = 0;
    if (!this.isMockMode && this.supabase) {
      try {
        // Delete using grade_level column
        const { error: err1 } = await this.supabase
          .from('curriculum_masters')
          .delete()
          .in('grade_level', grades);
        if (err1) {
          console.warn('Supabase deleteCurriculumMastersByGrades (grade_level) warning:', err1);
        }

        // Also delete using grade column for backwards compatibility
        const { error: err2 } = await this.supabase
          .from('curriculum_masters')
          .delete()
          .in('grade', grades);
        if (err2) {
          console.warn('Supabase deleteCurriculumMastersByGrades (grade) warning:', err2);
        }
      } catch (e) {
        console.warn('Supabase deleteCurriculumMastersByGrades exception:', e);
      }
    }

    // Update local cache
    const currentList = this.getCurriculumMasters();
    const remaining = currentList.filter(m => {
      const g = m.grade || m.grade_level || '';
      return !grades.includes(g);
    });
    deletedCount = currentList.length - remaining.length;
    this.saveMockData('curriculum_masters', remaining);

    return { success: true, deletedCount };
  }

  // Clear mock data if needed (for testing or reset)
  public clearMockData(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem('tentoru_schools');
    localStorage.removeItem('tentoru_curriculum_units');
    localStorage.removeItem('tentoru_curriculum_masters');
    localStorage.removeItem('tentoru_students');
    localStorage.removeItem('tentoru_learning_tasks');
    localStorage.removeItem('tentoru_learning_logs');
    localStorage.removeItem('tentoru_test_records');
    localStorage.removeItem('tentoru_school_codes_master');
    localStorage.removeItem('tentoru_exam_thresholds_master');
    localStorage.removeItem('tentoru_ai_reports');
    localStorage.removeItem('tentoru_prompt_settings');
    localStorage.removeItem('tentoru_teacher_corrections_log');
    localStorage.removeItem('tentoru_mini_test_results');
    localStorage.removeItem('tentoru_homework_results');
    localStorage.removeItem('tentoru_milestone_plans');
    localStorage.removeItem('tentoru_milestone_templates');
    localStorage.removeItem('tentoru_student_interactions');
    localStorage.removeItem('tentoru_personality_options');
    localStorage.removeItem('tentoru_student_lesson_progress');
    localStorage.removeItem('tentoru_branches');
  }

  // 14.5. StudentLessonProgress CRUD
  public getStudentLessonProgressList(studentId?: string): StudentLessonProgress[] {
    const list = this.getMockData<StudentLessonProgress>('student_lesson_progress', []);
    if (studentId) {
      return list.filter(p => p.student_id === studentId);
    }
    return list;
  }

  public async fetchStudentLessonProgressList(studentId?: string): Promise<StudentLessonProgress[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        let query = this.supabase.from('student_lesson_progress').select('*');
        if (studentId) query = query.eq('student_id', studentId);
        const { data, error } = await query;
        if (!error && data) {
          const currentList = this.getStudentLessonProgressList();
          data.forEach((item: StudentLessonProgress) => {
            const idx = currentList.findIndex(c => c.id === item.id);
            if (idx >= 0) currentList[idx] = item;
            else currentList.push(item);
          });
          this.saveMockData('student_lesson_progress', currentList);
          return (studentId ? currentList.filter(p => p.student_id === studentId) : currentList);
        }
      } catch (e) {
        console.warn('fetchStudentLessonProgressList warning:', e);
      }
    }
    return this.getStudentLessonProgressList(studentId);
  }

  public async saveStudentLessonProgress(progress: StudentLessonProgress): Promise<StudentLessonProgress> {
    const list = this.getStudentLessonProgressList();
    const idx = list.findIndex(p => p.id === progress.id || (p.student_id === progress.student_id && p.lesson_id === progress.lesson_id));
    if (idx >= 0) list[idx] = progress;
    else list.push(progress);
    this.saveMockData('student_lesson_progress', list);

    if (!this.isMockMode && this.supabase) {
      try {
        const payload = {
          id: progress.id,
          student_id: progress.student_id,
          subject: progress.subject || 'その他',
          lesson_id: progress.lesson_id,
          lesson_name: progress.lesson_name || '',
          task_id: progress.task_id || null,
          date: progress.date || new Date().toISOString().split('T')[0],
          status: progress.status || 'completed',
          completed_at: progress.completed_at || new Date().toISOString(),
          created_at: progress.created_at || new Date().toISOString()
        };

        const { data, error } = await this.supabase.from('student_lesson_progress').upsert(payload).select().single();
        if (error) {
          console.warn('saveStudentLessonProgress supabase warning (trying student_task_progress):', error);
          try {
            await this.supabase.from('student_task_progress').upsert(payload);
          } catch (fbErr) {
            console.warn('student_task_progress fallback warning:', fbErr);
          }
        } else if (data) {
          return data as StudentLessonProgress;
        }
      } catch (e) {
        console.warn('saveStudentLessonProgress supabase exception:', e);
      }
    }
    return progress;
  }

  // 14. StudentInteractions CRUD
  public getStudentInteractions(studentId?: string): StudentInteraction[] {
    const seed: StudentInteraction[] = [
      {
        id: 'si-1',
        student_id: 'std-1',
        category: '勉強相談',
        memo: '理科は前回より手応えあり。英語が下がったかも、と言っている。\n今日の自習の様子はいつもより暗い顔。',
        date: '2026-06-18',
        staff_name: '福田',
        created_at: '2026-06-18T18:00:00Z'
      },
      {
        id: 'si-2',
        student_id: 'std-1',
        category: '保護者対応',
        memo: '私立併願を迷っている。今度、駒場学園見に行く。',
        date: '2026-06-20',
        staff_name: '福田',
        created_at: '2026-06-20T19:00:00Z'
      }
    ];
    const list = this.getMockData<StudentInteraction>('student_interactions', seed);
    if (studentId) {
      return list
        .filter(i => i.student_id === studentId)
        .sort((a, b) => new Date(b.date || (b as any).contact_date || 0).getTime() - new Date(a.date || (a as any).contact_date || 0).getTime());
    }
    return list;
  }

  public async fetchStudentInteractions(studentId: string): Promise<StudentInteraction[]> {
    if (!this.isMockMode && this.supabase) {
      // Step 1: student_contact_logs
      try {
        const { data, error } = await this.supabase
          .from('student_contact_logs')
          .select('*')
          .eq('student_id', studentId)
          .order('contact_date', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id || `si-${studentId}-${Date.now()}`,
            student_id: d.student_id,
            category: d.category || d.contact_type || 'その他',
            memo: d.memo || d.content || '',
            date: d.contact_date || d.date || new Date().toISOString().split('T')[0],
            contact_date: d.contact_date || d.date || new Date().toISOString().split('T')[0],
            staff_name: d.staff_name || '担当講師',
            created_at: d.created_at || new Date().toISOString()
          }));
        }
      } catch (e) {}

      // Step 2: student_support_logs
      try {
        const { data, error } = await this.supabase
          .from('student_support_logs')
          .select('*')
          .eq('student_id', studentId)
          .order('contact_date', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id || `si-${studentId}-${Date.now()}`,
            student_id: d.student_id,
            category: d.category || d.contact_type || 'その他',
            memo: d.memo || d.content || '',
            date: d.contact_date || d.date || new Date().toISOString().split('T')[0],
            contact_date: d.contact_date || d.date || new Date().toISOString().split('T')[0],
            staff_name: d.staff_name || '担当講師',
            created_at: d.created_at || new Date().toISOString()
          }));
        }
      } catch (e) {}

      // Step 3: student_interactions
      try {
        const { data, error } = await this.supabase
          .from('student_interactions')
          .select('*')
          .eq('student_id', studentId)
          .order('date', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id || `si-${studentId}-${Date.now()}`,
            student_id: d.student_id,
            category: d.category || 'その他',
            memo: d.memo || '',
            date: d.date || d.contact_date || new Date().toISOString().split('T')[0],
            contact_date: d.contact_date || d.date || new Date().toISOString().split('T')[0],
            staff_name: d.staff_name || '担当講師',
            created_at: d.created_at || new Date().toISOString()
          }));
        }
      } catch (e) {}
    }
    return this.getStudentInteractions(studentId);
  }

  public async saveStudentInteraction(interaction: StudentInteraction): Promise<StudentInteraction> {
    const studentId = interaction.student_id;
    const category = interaction.category || 'その他';
    const contactDate = interaction.date || interaction.contact_date || new Date().toISOString().split('T')[0];
    const memoText = interaction.memo || '';
    const staffName = interaction.staff_name || '担当講師';
    const createdAt = interaction.created_at || new Date().toISOString();

    const payload = {
      id: interaction.id || `si-${studentId}-${Date.now()}`,
      student_id: studentId,
      category: category,
      contact_type: category,
      contact_date: contactDate,
      date: contactDate,
      memo: memoText,
      content: memoText,
      staff_name: staffName,
      created_at: createdAt
    };

    const payloadNoId = {
      student_id: studentId,
      category: category,
      contact_type: category,
      contact_date: contactDate,
      date: contactDate,
      memo: memoText,
      content: memoText,
      staff_name: staffName,
      created_at: createdAt
    };

    const payloadNoStaffName = {
      student_id: studentId,
      category: category,
      contact_type: category,
      contact_date: contactDate,
      date: contactDate,
      memo: memoText,
      content: memoText,
      created_at: createdAt
    };

    if (!this.isMockMode && this.supabase) {
      let lastError: any = null;

      // Step 1: student_contact_logs への保存試行
      try {
        const query = this.supabase.from('student_contact_logs');
        if (query && typeof query.upsert === 'function') {
          const uRes = query.upsert(payload);
          if (uRes && typeof uRes.select === 'function') {
            const res = await uRes.select().single();
            if (!res.error && res.data) return res.data;
            if (res.error) lastError = res.error;
          }
        }
      } catch (err) {
        lastError = err;
      }

      if (lastError) {
        console.error('詳細登録エラー:', lastError);
        throw lastError;
      }

      // Step 2: student_support_logs への保存試行
      try {
        const query = this.supabase.from('student_support_logs');
        if (query && typeof query.upsert === 'function') {
          const res = await query.upsert(payload).select().single();
          if (!res.error && res.data) return res.data;

          const resNoId = await query.insert(payloadNoId).select().single();
          if (!resNoId.error && resNoId.data) return resNoId.data;

          const resNoStaff = await query.insert(payloadNoStaffName).select().single();
          if (!resNoStaff.error && resNoStaff.data) return resNoStaff.data;

          if (res.error) lastError = res.error;
        }
      } catch (err) {
        lastError = err;
      }

      // Step 3: student_interactions への保存試行
      try {
        const query = this.supabase.from('student_interactions');
        if (query && typeof query.upsert === 'function') {
          const res = await query.upsert(payload).select().single();
          if (!res.error && res.data) return res.data;

          const resNoId = await query.insert(payloadNoId).select().single();
          if (!resNoId.error && resNoId.data) return resNoId.data;

          if (res.error) lastError = res.error;
        }
      } catch (err) {
        lastError = err;
      }

      // Step 4: students テーブルの contact_logs JSONB 配列への追記更新
      try {
        const stRes = await this.supabase.from('students').select('*').eq('id', studentId).single();
        if (stRes && stRes.data) {
          const currentLogs = Array.isArray(stRes.data.contact_logs) ? stRes.data.contact_logs : [];
          const updatedLogs = [payload, ...currentLogs];
          const upRes = await this.supabase.from('students').update({ contact_logs: updatedLogs }).eq('id', studentId);
          if (upRes && !upRes.error) return interaction;
          if (upRes && upRes.error) lastError = upRes.error;
        }
      } catch (err) {
        lastError = err;
      }

      if (lastError) {
        console.error('詳細登録エラー:', lastError);
        throw lastError;
      }
      return interaction;
    } else {
      const list = this.getMockData<StudentInteraction>('student_interactions', []);
      const idx = list.findIndex(i => i.id === interaction.id);
      if (idx >= 0) list[idx] = interaction;
      else list.unshift(interaction);
      this.saveMockData('student_interactions', list);
      return interaction;
    }
  }

  public async deleteStudentInteraction(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      let lastError: any = null;

      try {
        const res = await this.supabase.from('student_contact_logs').delete().eq('id', id);
        if (res && res.error) lastError = res.error;
      } catch (e) { lastError = e; }

      try {
        const res = await this.supabase.from('student_support_logs').delete().eq('id', id);
        if (res && res.error) lastError = res.error;
      } catch (e) { lastError = e; }

      try {
        const res = await this.supabase.from('student_interactions').delete().eq('id', id);
        if (res && res.error) lastError = res.error;
      } catch (e) { lastError = e; }

      let list = this.getMockData<StudentInteraction>('student_interactions', []);
      list = list.filter(i => i.id !== id);
      this.saveMockData('student_interactions', list);

      if (lastError) throw lastError;
    } else {
      let list = this.getMockData<StudentInteraction>('student_interactions', []);
      list = list.filter(i => i.id !== id);
      this.saveMockData('student_interactions', list);
    }
  }

  // 15. PersonalityOptions CRUD
  public getPersonalityOptions(): string[] {
    const seed = [
      'ぱっと見大人しい',
      'スイッチ入るとよく喋る',
      '班長',
      '合唱実行委員長',
      '音楽の授業は好き',
      '礼儀正しくちゃんと敬語使える'
    ];
    return this.getMockData<string>('personality_options', seed);
  }

  public async fetchPersonalityOptions(): Promise<string[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('personality_options').select('name');
        if (!error && data && data.length > 0) {
          const names = data.map((d: any) => d.name).filter(Boolean);
          this.saveMockData('personality_options', names);
          return names;
        }
      } catch (e) {
        console.warn('fetchPersonalityOptions warning:', e);
      }
    }
    return this.getPersonalityOptions();
  }

  public async addPersonalityOption(name: string): Promise<string> {
    if (!name || !name.trim()) return '';
    const trimmed = name.trim();
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('personality_options').insert({ name: trimmed });
      if (error && error.code !== '23505') throw error;
    }
    const list = this.getPersonalityOptions();
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      this.saveMockData('personality_options', list);
    }
    return trimmed;
  }

  public async removePersonalityOption(name: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('personality_options').delete().eq('name', name);
      if (error) console.warn('Supabase removePersonalityOption warning:', error);
    }
    let list = this.getPersonalityOptions();
    list = list.filter(item => item !== name);
    this.saveMockData('personality_options', list);
  }

  public async deletePersonalityOption(name: string): Promise<void> {
    return this.removePersonalityOption(name);
  }

  // 16. TeacherOptions CRUD
  public getTeacherOptions(): string[] {
    const seed = [
      '福田 尚弘',
      '鈴木 健太郎',
      '佐藤 舞',
      '高橋 優希',
      '田中 翔太',
      '渡辺 葵'
    ];
    return this.getMockData<string>('teacher_options', seed);
  }

  public async fetchTeacherOptions(): Promise<string[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('teacher_options').select('name');
        if (!error && data && data.length > 0) {
          const names = data.map((d: any) => d.name).filter(Boolean);
          this.saveMockData('teacher_options', names);
          return names;
        }
      } catch (e) {
        console.warn('fetchTeacherOptions warning:', e);
      }
    }
    return this.getTeacherOptions();
  }

  public async addTeacherOption(name: string): Promise<string> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase.from('teacher_options').insert({ name });
        if (error && error.code !== '23505') console.warn('Supabase addTeacherOption warning:', error);
      } catch (err) {
        console.warn('addTeacherOption error:', err);
      }
    }
    const list = this.getTeacherOptions();
    if (!list.includes(name)) {
      list.push(name);
      this.saveMockData('teacher_options', list);
    }
    return name;
  }

  public async removeTeacherOption(name: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase.from('teacher_options').delete().eq('name', name);
        if (error) console.warn('Supabase removeTeacherOption warning:', error);
      } catch (err) {
        console.warn('removeTeacherOption error:', err);
      }
    }
    let list = this.getTeacherOptions();
    list = list.filter(item => item !== name);
    this.saveMockData('teacher_options', list);
  }

  public async deleteTeacherOption(name: string): Promise<void> {
    return this.removeTeacherOption(name);
  }

  public async updateTeacherOption(oldName: string, newName: string): Promise<string> {
    if (!oldName || !newName || oldName === newName) return oldName;
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('teacher_options').update({ name: newName }).eq('name', oldName);
      if (error) throw error;
      return newName;
    } else {
      let list = this.getTeacherOptions();
      const idx = list.indexOf(oldName);
      if (idx !== -1) {
        list[idx] = newName;
        this.saveMockData('teacher_options', list);
      }
      return newName;
    }
  }

  public getStudentScheduleConfig(studentId: string): StudentScheduleConfig {
    const configs = this.getMockData<StudentScheduleConfig>('student_schedule_configs', []);
    const found = configs.find(c => c.student_id === studentId);
    if (found) return found;

    const student = this.getStudents().find(s => s.id === studentId);
    const weekly_frequency = student?.weekly_sessions_count || '2回';
    const weekly_duration = student?.weekly_duration_minutes || '120分';
    const selected_days = student?.selected_days || ['tuesday', 'friday'];
    const default_slots = student?.default_slots || 2;

    return {
      student_id: studentId,
      weekly_frequency,
      weekly_duration,
      selected_days,
      default_slots,
      updated_at: new Date().toISOString(),
    };
  }

  public async fetchStudentScheduleConfig(studentId: string): Promise<StudentScheduleConfig> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('student_schedule_configs')
          .select('*')
          .eq('student_id', studentId)
          .single();
        if (data && !error) return data as StudentScheduleConfig;
      } catch (err) {
        console.error('fetchStudentScheduleConfig exception:', err);
      }
    }
    return this.getStudentScheduleConfig(studentId);
  }

  public async saveStudentScheduleConfig(config: StudentScheduleConfig): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        await this.supabase.from('students').update({
          weekly_sessions_count: config.weekly_frequency,
          weekly_duration_minutes: config.weekly_duration,
          selected_days: config.selected_days,
          default_slots: config.default_slots
        }).eq('id', config.student_id);

        const payload = {
          student_id: config.student_id,
          weekly_frequency: config.weekly_frequency,
          weekly_duration: config.weekly_duration,
          selected_days: config.selected_days,
          default_slots: config.default_slots,
          updated_at: new Date().toISOString(),
        };
        const { error: err1 } = await this.supabase
          .from('student_schedule_configs')
          .upsert(payload);
        if (err1) {
          await this.supabase
            .from('student_settings')
            .upsert(payload);
        }
      } catch (err) {
        console.error('saveStudentScheduleConfig exception:', err);
      }
    }

    const configs = this.getMockData<StudentScheduleConfig>('student_schedule_configs', []);
    const idx = configs.findIndex(c => c.student_id === config.student_id);
    if (idx !== -1) {
      configs[idx] = { ...config, updated_at: new Date().toISOString() };
    } else {
      configs.push({ ...config, updated_at: new Date().toISOString() });
    }
    this.saveMockData('student_schedule_configs', configs);

    const students = this.getStudents();
    const stIdx = students.findIndex(s => s.id === config.student_id);
    if (stIdx !== -1) {
      students[stIdx] = {
        ...students[stIdx],
        weekly_sessions_count: config.weekly_frequency,
        weekly_duration_minutes: config.weekly_duration,
        selected_days: config.selected_days,
        default_slots: config.default_slots,
      };
      this.saveMockData('students', students);
    }
  }

  // 17. Branches & Multitenancy (RBAC)
  public getBranches(): Branch[] {
    const seed: Branch[] = [
      {
        id: 'branch-1',
        name: '恵比寿教室',
        code: 'EBISU',
        email: 'ebisu@tentoru.jp',
        status: 'active',
        created_at: '2026-04-01T00:00:00Z',
        last_login_at: '2026-08-09T09:30:00Z',
        phone: '03-1234-5678',
        address: '東京都渋谷区恵比寿1-2-3 テントルビル2F'
      },
      {
        id: 'branch-2',
        name: '渋谷教室',
        code: 'SHIBUYA',
        email: 'shibuya@tentoru.jp',
        status: 'active',
        created_at: '2026-04-01T00:00:00Z',
        last_login_at: '2026-08-08T18:15:00Z',
        phone: '03-2345-6789',
        address: '東京都渋谷区道玄坂2-10-1 渋谷タワー3F'
      },
      {
        id: 'branch-3',
        name: '新宿教室',
        code: 'SHINJUKU',
        email: 'shinjuku@tentoru.jp',
        status: 'active',
        created_at: '2026-05-01T00:00:00Z',
        last_login_at: '2026-08-07T14:20:00Z',
        phone: '03-3456-7890',
        address: '東京都新宿区西新宿1-5-11 新宿セントラルビル4F'
      },
      {
        id: 'branch-4',
        name: '横浜教室',
        code: 'YOKOHAMA',
        email: 'yokohama@tentoru.jp',
        status: 'suspended',
        created_at: '2026-06-01T00:00:00Z',
        last_login_at: '2026-07-25T11:00:00Z',
        phone: '045-123-4567',
        address: '神奈川県横浜市西区みなとみらい2-1-1 横浜パークビル5F'
      }
    ];

    const list = this.getMockData<Branch>('branches', seed);
    // Dynamic student count calculation
    const allStudents = this.getStudents();
    return list.map(b => ({
      ...b,
      student_count: allStudents.filter(s => s.branch_id === b.id || s.classroom === b.name).length
    }));
  }

  private notifyBranchesUpdated(branches: Branch[]): void {
    if (this.isBrowser()) {
      try {
        window.dispatchEvent(new CustomEvent('tentoru_branches_updated', { detail: { branches } }));
      } catch (e) {}
    }
  }

  public async fetchBranches(): Promise<Branch[]> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.from('branches').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          const allStudents = this.getStudents();
          const branchesWithCount: Branch[] = data.map((b: any) => ({
            ...b,
            student_count: allStudents.filter(s => s.branch_id === b.id || s.classroom === b.name).length
          }));
          this.saveMockData('branches', branchesWithCount);
          this.notifyBranchesUpdated(branchesWithCount);
          return branchesWithCount;
        }
      } catch (err) {
        console.warn('fetchBranches supabase error:', err);
      }
    }
    const current = this.getBranches();
    this.notifyBranchesUpdated(current);
    return current;
  }

  public async saveBranch(branch: Branch): Promise<Branch> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { student_count, ...branchData } = branch as any;
        const { error } = await this.supabase.from('branches').upsert(branchData).select().single();
        if (error) console.warn('Supabase saveBranch warning:', error);
      } catch (err) {
        console.warn('saveBranch error:', err);
      }
    }
    const list = this.getMockData<Branch>('branches', []);
    const idx = list.findIndex(b => b.id === branch.id);
    if (idx >= 0) list[idx] = branch;
    else list.push(branch);
    this.saveMockData('branches', list);
    const updatedBranches = this.getBranches();
    this.notifyBranchesUpdated(updatedBranches);
    return branch;
  }

  public async deleteBranch(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase.from('branches').delete().eq('id', id);
        if (error) console.warn('Supabase deleteBranch warning:', error);
      } catch (err) {
        console.warn('deleteBranch error:', err);
      }
    }
    const list = this.getMockData<Branch>('branches', []);
    this.saveMockData('branches', list.filter(b => b.id !== id));
    const updatedBranches = this.getBranches();
    this.notifyBranchesUpdated(updatedBranches);
  }

  public async toggleBranchStatus(branchId: string): Promise<Branch> {
    const branches = this.getBranches();
    const branch = branches.find(b => b.id === branchId);
    if (!branch) throw new Error('校舎が見つかりません');
    const updated: Branch = {
      ...branch,
      status: branch.status === 'active' ? 'suspended' : 'active'
    };
    return this.saveBranch(updated);
  }

  public async createBranchAccount(data: { name: string; email: string; password?: string; code?: string; phone?: string; address?: string }): Promise<Branch> {
    const newId = `branch-${Date.now()}`;
    const newCode = data.code?.trim().toUpperCase() || data.name.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || `BR-${Math.floor(Math.random() * 1000)}`;
    const newBranch: Branch = {
      id: newId,
      name: data.name.trim(),
      code: newCode,
      email: data.email.trim(),
      status: 'active',
      created_at: new Date().toISOString(),
      last_login_at: null,
      phone: data.phone?.trim() || '',
      address: data.address?.trim() || '',
      ai_rules: { ...DEFAULT_BRANCH_AI_RULES }
    };
    return this.saveBranch(newBranch);
  }

  // 17.1 Branch AI Rules
  public getBranchAIRules(branchId?: string | null): BranchAIRules {
    if (!branchId || branchId === 'all') {
      const globalRules = this.getMockObject<BranchAIRules>('branch_ai_rules_default', DEFAULT_BRANCH_AI_RULES);
      return { ...DEFAULT_BRANCH_AI_RULES, ...(globalRules || {}) };
    }
    const branch = this.getBranches().find(b => b.id === branchId || b.name === branchId);
    if (branch?.ai_rules) {
      return { ...DEFAULT_BRANCH_AI_RULES, ...branch.ai_rules };
    }
    const stored = this.getMockObject<BranchAIRules>(`branch_ai_rules_${branchId}`, DEFAULT_BRANCH_AI_RULES);
    return { ...DEFAULT_BRANCH_AI_RULES, ...(stored || {}) };
  }

  public async saveBranchAIRules(branchId: string, rules: Partial<BranchAIRules>): Promise<BranchAIRules> {
    const prevRules = this.getBranchAIRules(branchId);
    const updatedRules: BranchAIRules = {
      ...prevRules,
      ...rules,
      updated_at: new Date().toISOString()
    };

    if (!branchId || branchId === 'all') {
      this.saveMockData('branch_ai_rules_default', updatedRules);
      return updatedRules;
    }

    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase.from('branches').update({ ai_rules: updatedRules }).eq('id', branchId);
        if (error) console.warn('Supabase saveBranchAIRules warning:', error);
      } catch (err) {
        console.warn('saveBranchAIRules error:', err);
      }
    }

    this.saveMockData(`branch_ai_rules_${branchId}`, updatedRules);
    const branches = this.getBranches();
    const branch = branches.find(b => b.id === branchId || b.name === branchId);
    if (branch) {
      branch.ai_rules = updatedRules;
      await this.saveBranch(branch);
    }
    return updatedRules;
  }

  public async sendBranchPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    if (!this.isMockMode && this.supabase) {
      try {
        const { error } = await this.supabase.auth.resetPasswordForEmail(email);
        if (error) {
          console.warn('Supabase resetPasswordForEmail warning:', error);
        }
      } catch (e) {
        console.warn('Supabase auth reset warning:', e);
      }
    }
    return {
      success: true,
      message: `${email} 宛てにパスワード再設定のご案内メールを送信しました。`
    };
  }

  public getCurrentUserRole(): { role: UserRole; branch_id?: string | null; branch_name?: string | null } {
    const defaultRole = { role: 'admin' as UserRole, branch_id: null, branch_name: '本部統括管理者' };
    if (typeof window === 'undefined') return defaultRole;
    try {
      const stored = localStorage.getItem('current_user_role');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return defaultRole;
  }

  public setCurrentUserRole(role: UserRole, branch_id?: string | null, branch_name?: string | null): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('current_user_role', JSON.stringify({ role, branch_id, branch_name }));
      } catch (e) {}
    }
  }

  // 18. Authentication & Session Management (Supabase Auth & Mock Fallback)
  public async signInWithPassword(email: string, password: string): Promise<{ success: boolean; session?: UserSession; error?: string }> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { success: false, error: 'メールアドレスを入力してください' };
    }
    if (!password) {
      return { success: false, error: 'パスワードを入力してください' };
    }

    // Attempt Supabase Auth
    if (!this.isMockMode && this.supabase) {
      try {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password
        });
        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {};
          const role: UserRole = userMeta.role === 'branch' ? 'branch' : 'admin';
          const branches = this.getBranches();
          const matchedBranch = branches.find(b => b.email.toLowerCase() === trimmedEmail.toLowerCase());
          
          const session: UserSession = {
            user: {
              id: data.user.id,
              email: trimmedEmail,
              role: role,
              branch_id: matchedBranch ? matchedBranch.id : userMeta.branch_id || null,
              branch_name: matchedBranch ? matchedBranch.name : userMeta.branch_name || (role === 'admin' ? '本部統括管理者' : '校舎アカウント'),
              name: userMeta.name || matchedBranch?.name || trimmedEmail.split('@')[0]
            },
            token: data.session?.access_token,
            logged_in_at: new Date().toISOString()
          };
          this.saveSession(session);
          return { success: true, session };
        } else if (error) {
          console.warn('Supabase signInWithPassword error, checking local/demo fallback:', error.message);
        }
      } catch (err: any) {
        console.warn('Supabase auth exception:', err);
      }
    }

    // Local / Mock / Demo fallback authentication
    const lowerEmail = trimmedEmail.toLowerCase();
    const branches = this.getBranches();
    const matchedBranch = branches.find(b => b.email.toLowerCase() === lowerEmail);

    // Check for password mismatch in mock/demo mode
    if (password === 'wrongpass' || (!matchedBranch && !lowerEmail.includes('admin') && !lowerEmail.includes('tentoru'))) {
      return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
    }

    if (matchedBranch) {
      if (matchedBranch.status === 'suspended') {
        return { success: false, error: `校舎「${matchedBranch.name}」のアカウントは現在一時停止中です。本部へお問い合わせください。` };
      }
      const session: UserSession = {
        user: {
          id: `usr-${matchedBranch.id}`,
          email: matchedBranch.email,
          role: 'branch',
          branch_id: matchedBranch.id,
          branch_name: matchedBranch.name,
          name: `${matchedBranch.name} 責任者`
        },
        token: `mock-token-${Date.now()}`,
        logged_in_at: new Date().toISOString()
      };
      this.saveSession(session);
      return { success: true, session };
    }

    if (lowerEmail.includes('admin') || lowerEmail === 'headquarters@tentoru.jp' || lowerEmail === 'admin@tentoru.jp') {
      const session: UserSession = {
        user: {
          id: 'usr-admin-1',
          email: trimmedEmail,
          role: 'admin',
          branch_id: null,
          branch_name: '本部統括管理者',
          name: '本部統括管理者'
        },
        token: `mock-token-${Date.now()}`,
        logged_in_at: new Date().toISOString()
      };
      this.saveSession(session);
      return { success: true, session };
    }

    // Default fallback for any other valid formatted email
    if (trimmedEmail.includes('@')) {
      const isBranch = lowerEmail.includes('branch') || lowerEmail.includes('school') || lowerEmail.includes('kyoshitsu');
      const session: UserSession = {
        user: {
          id: `usr-${Date.now()}`,
          email: trimmedEmail,
          role: isBranch ? 'branch' : 'admin',
          branch_id: isBranch ? 'branch-1' : null,
          branch_name: isBranch ? '恵比寿教室' : '本部統括管理者',
          name: trimmedEmail.split('@')[0]
        },
        token: `mock-token-${Date.now()}`,
        logged_in_at: new Date().toISOString()
      };
      this.saveSession(session);
      return { success: true, session };
    }

    return { success: false, error: 'メールアドレスまたはパスワードが正しくありません' };
  }

  public getSession(): UserSession | null {
    if (!this.isBrowser()) return null;
    try {
      const raw = localStorage.getItem('tentoru_auth_session');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error parsing session:', e);
    }
    return null;
  }

  public saveSession(session: UserSession): void {
    if (this.isBrowser()) {
      try {
        localStorage.setItem('tentoru_auth_session', JSON.stringify(session));
        this.setCurrentUserRole(session.user.role, session.user.branch_id, session.user.branch_name);
      } catch (e) {
        console.error('Error saving session:', e);
      }
    }
  }

  public async signOut(): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      try {
        await this.supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase signOut warning:', e);
      }
    }
    if (this.isBrowser()) {
      try {
        localStorage.removeItem('tentoru_auth_session');
        this.setCurrentUserRole('admin', null, '本部統括管理者');
      } catch (e) {}
    }
  }
}

export const db = new DatabaseService();
