import { createClient } from '@supabase/supabase-js';

// Types representing DB entities
export interface School {
  id: string;
  name: string;
  type: 'elementary' | 'junior_high';
  created_at: string;
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
}

export interface CurriculumUnit {
  id: string;
  school_id: string;
  subject: string;
  name: string;
  sequence_order: number;
  google_drive_url?: string;
  created_at: string;
}

export interface LearningTask {
  id: string;
  student_id: string;
  unit_id: string;
  scheduled_date: string; // YYYY-MM-DD
  period: number | null; // 1 to 10
  status: 'unstarted' | 'skipped' | 'completed' | 'failed';
  video_watched: boolean;
  test_passed: boolean;
  office_note?: string;
  actual_completed_date?: string;
  subject?: string;
  custom_unit_name?: string;
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
  subject: string;
  score: number;
  rank_change?: 'up' | 'down' | 'keep';
  rate_change?: number;
  next_target_score?: number;
  improvement_plan?: string;
  target_school_code?: string;
  created_at: string;
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
  test_content: string; // 自由記述テスト内容
  score: number | null; // 結果点数
  created_at: string;
}

export interface HomeworkResult {
  id: string;
  student_id: string;
  date: string; // YYYY-MM-DD
  homework_content: string;
  homework_deadline: string; // YYYY-MM-DD
  status: 'incomplete' | 'completed' | 'skipped';
  created_at: string;
}

// -------------------------------------------------------------
// Hybrid DB Access Class
// -------------------------------------------------------------
class DatabaseService {
  private supabase: any = null;
  private isMockMode: boolean = true;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'mock' && supabaseAnonKey !== 'mock') {
      try {
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
        this.isMockMode = false;
        console.log('DatabaseService initialized with Supabase');
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

  private saveMockData<T>(key: string, data: T[]): void {
    if (!this.isBrowser()) return;
    localStorage.setItem(`tentoru_${key}`, JSON.stringify(data));
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
        start_unit_id: 'unit-102-1', // 「文字式（最初のテーマ）」からスタート
        period_count: 2,
        created_at: new Date().toISOString()
      },
      {
        id: 'std-2',
        student_id: 'student102',
        name: '鈴木 結衣',
        email: 'student102@tentoru-student.com',
        grade: '小5',
        school_id: 'sch-2',
        status: 'normal',
        start_unit_id: 'unit-301-1', // 最初（最初のテーマ）からスタート
        period_count: 2,
        created_at: new Date().toISOString()
      }
    ];
    return this.getMockData('students', seed);
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

      // 鈴木結衣 (小5) 用のタスク
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
      { id: 'tr-1', student_id: 'std-1', record_type: 'regular_test', subject: '数学', score: 72, rank_change: 'up', rate_change: 8.5, next_target_score: 85, improvement_plan: '一次方程式の計算手順の再確認', created_at: new Date().toISOString() },
      { id: 'tr-3', student_id: 'std-1', record_type: 'regular_test', subject: '英語', score: 60, rank_change: 'down', rate_change: -2.0, next_target_score: 75, improvement_plan: '単語練習の徹底', created_at: new Date().toISOString() },
      { id: 'tr-2', student_id: 'std-1', record_type: 'mock_exam', subject: '総合', score: 320, target_school_code: 'schcode-A', created_at: new Date().toISOString() }
    ];
    return this.getMockData('test_records', seed);
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
      // schcode-A
      { id: 'eth-1', school_code: 'schcode-A', min_score: 350, max_score: 500, probability: 80 },
      { id: 'eth-2', school_code: 'schcode-A', min_score: 300, max_score: 349, probability: 60 },
      { id: 'eth-3', school_code: 'schcode-A', min_score: 250, max_score: 299, probability: 40 },
      { id: 'eth-4', school_code: 'schcode-A', min_score: 0, max_score: 249, probability: 20 },
      // schcode-B
      { id: 'eth-5', school_code: 'schcode-B', min_score: 280, max_score: 500, probability: 80 },
      { id: 'eth-6', school_code: 'schcode-B', min_score: 220, max_score: 279, probability: 60 },
      { id: 'eth-7', school_code: 'schcode-B', min_score: 0, max_score: 219, probability: 30 },
      // schcode-C
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

  // 2. Students CRUD
  public async saveStudent(student: Student): Promise<Student> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('students').upsert(student).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getStudents();
      const idx = list.findIndex(s => s.id === student.id);
      if (idx >= 0) list[idx] = student;
      else list.push(student);
      this.saveMockData('students', list);
      return student;
    }
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

  // 4. LearningTasks CRUD
  public async saveLearningTasks(tasks: LearningTask[]): Promise<LearningTask[]> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('learning_tasks').upsert(tasks).select();
      if (error) throw error;
      return data;
    } else {
      const list = this.getLearningTasks();
      tasks.forEach(t => {
        const idx = list.findIndex(item => item.id === t.id);
        if (idx >= 0) list[idx] = t;
        else list.push(t);
      });
      this.saveMockData('learning_tasks', list);
      return tasks;
    }
  }

  public async deleteLearningTasksByStudent(studentId: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('learning_tasks').delete().eq('student_id', studentId);
      if (error) throw error;
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
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('test_records').upsert(record).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getTestRecords();
      const idx = list.findIndex(r => r.id === record.id);
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      this.saveMockData('test_records', list);
      return record;
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

  public async saveMiniTestResult(result: MiniTestResult): Promise<MiniTestResult> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('mini_test_results').upsert(result).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getMiniTestResults();
      const idx = list.findIndex(r => r.id === result.id);
      if (idx >= 0) list[idx] = result;
      else list.push(result);
      this.saveMockData('mini_test_results', list);
      return result;
    }
  }

  public async deleteMiniTestResult(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('mini_test_results').delete().eq('id', id);
      if (error) throw error;
    } else {
      let list = this.getMiniTestResults();
      list = list.filter(r => r.id !== id);
      this.saveMockData('mini_test_results', list);
    }
  }

  // 13. HomeworkResults CRUD
  public getHomeworkResults(): HomeworkResult[] {
    return this.getMockData('homework_results', []);
  }

  public async saveHomeworkResult(result: HomeworkResult): Promise<HomeworkResult> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('homework_results').upsert(result).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = this.getHomeworkResults();
      const idx = list.findIndex(r => r.id === result.id);
      if (idx >= 0) list[idx] = result;
      else list.push(result);
      this.saveMockData('homework_results', list);
      return result;
    }
  }

  public async saveHomeworkResults(results: HomeworkResult[]): Promise<HomeworkResult[]> {
    if (!this.isMockMode && this.supabase) {
      const { data, error } = await this.supabase.from('homework_results').upsert(results).select();
      if (error) throw error;
      return data;
    } else {
      const list = this.getHomeworkResults();
      results.forEach(result => {
        const idx = list.findIndex(r => r.id === result.id);
        if (idx >= 0) list[idx] = result;
        else list.push(result);
      });
      this.saveMockData('homework_results', list);
      return results;
    }
  }

  public async deleteHomeworkResult(id: string): Promise<void> {
    if (!this.isMockMode && this.supabase) {
      const { error } = await this.supabase.from('homework_results').delete().eq('id', id);
      if (error) throw error;
    } else {
      let list = this.getHomeworkResults();
      list = list.filter(r => r.id !== id);
      this.saveMockData('homework_results', list);
    }
  }

  // Clear mock data if needed (for testing or reset)
  public clearMockData(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem('tentoru_schools');
    localStorage.removeItem('tentoru_curriculum_units');
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
  }
}

export const db = new DatabaseService();
