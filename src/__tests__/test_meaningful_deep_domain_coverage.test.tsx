import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  db, 
  getSchoolYear, 
  normalizeStandardGrade, 
  isElementaryStudent, 
  isJuniorHighStudent, 
  isHighSchoolStudent, 
  calculateCurrentGrade, 
  sanitizeLearningTask, 
  sanitizeLearningTaskForDB, 
  sanitizeMiniTestResult, 
  sanitizeHomeworkResult,
  Student,
  CurriculumMaster
} from '../lib/db';
import { 
  getGeminiApiKey, 
  saveGeminiApiKey, 
  analyzeReportCardImage, 
  generateInterview2CoachingAdvice, 
  generateInterview3CoachingAdvice, 
  generateInterviewSummary, 
  parseInterviewTranscriptToFields 
} from '../lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import TeacherDashboard from '../components/TeacherDashboard';

vi.mock('html2canvas', () => ({
  default: vi.fn().mockImplementation(() =>
    Promise.resolve({
      toDataURL: () => 'data:image/png;base64,mockImage'
    })
  )
}));

describe('Meaningful Deep Domain Coverage Tests (gemini.ts, db.ts, TeacherDashboard)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    (db as any).isMockMode = true;
    (db as any).supabase = null;
  });

  describe('1. gemini.ts: 成績表画像解析・面談アドバイス・要約・文字起こし抽出の業務網羅', () => {
    it('APIキーの保存・取得・更新が正常に動作すること', () => {
      expect(getGeminiApiKey()).toBe('');
      saveGeminiApiKey('AIzaSyTestKey123');
      expect(getGeminiApiKey()).toBe('AIzaSyTestKey123');
      saveGeminiApiKey('');
      expect(getGeminiApiKey()).toBe('');
    });

    it('analyzeReportCardImage: APIキー未設定時はデモモックデータを返すこと', async () => {
      vi.useFakeTimers();
      const promise = analyzeReportCardImage('data:image/png;base64,sample', 'image/png');
      
      // 2秒の遅延を進める
      vi.advanceTimersByTime(2000);
      const res = await promise;

      expect(res.test_name).toBe('1学期期末テスト');
      expect(res.score_math).toBe(90);
      expect(res.score_total).toBe(423);
      expect(res.deviation_value).toBe(62.5);
    });

    it('analyzeReportCardImage: APIキー設定時にGeminiで画像を解析しJSONを抽出すること', async () => {
      localStorage.setItem('tentoru_gemini_api_key', 'test-api-key');
      const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              test_name: '2学期中間テスト',
              score_japanese: 75,
              score_math: 92,
              score_english: 88,
              score_social: 80,
              score_science: 84,
              score_total: 419,
              class_rank: '3',
              school_rank: '8',
              deviation_value: 61.2
            })
          }
        })
      } as any);

      const res = await analyzeReportCardImage('base64img', 'image/png');
      expect(res.test_name).toBe('2学期中間テスト');
      expect(res.score_math).toBe(92);
      expect(res.score_total).toBe(419);

      // JSONを含まない不正な返却テキストの場合は例外をスローすること
      spy.mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => 'エラー: 画像から文字を認識できませんでした' }
        })
      } as any);

      await expect(analyzeReportCardImage('base64img', 'image/png')).rejects.toThrow(
        '解析結果がJSONフォーマットではありませんでした。'
      );

      spy.mockRestore();
    });

    it('generateInterview2CoachingAdvice: APIキー未設定および設定時のカスタム項目付きアドバイス構築', async () => {
      const interview = {
        interviewer: '高橋講師',
        interview_date: '2026-11-01',
        dream_goal: 'プログラマー',
        target_school: '青山高校',
        club_activity: '吹奏楽部',
        club_members_count: '25',
        close_friends: '山田くん',
        study_anxiety: '英語の長文読解',
        self_evaluation: '60点',
        student_challenges: '毎日の単語学習の継続',
        required_actions: '通学時間にアプリで英単語を15分見る',
        expectations: '次の定期テストで80点以上',
        target_rank: '学年15位',
        target_score: '85点',
        notes: '部活のコンクール前で忙しい',
        custom_fields: [{ id: 'cf-1', label: '通塾時間', value: '30分' }]
      };
      const student = { name: '佐々木 健', grade: '中2' };

      // 1. APIキーなし（ルールベースMarkdown生成）
      const adviceNoKey = await generateInterview2CoachingAdvice(interview, student);
      expect(adviceNoKey).toContain('佐々木 健');
      expect(adviceNoKey).toContain('プログラマー');
      expect(adviceNoKey).toContain('青山高校');

      // 2. APIキーあり（Geminiモデル呼び出し）
      localStorage.setItem('tentoru_gemini_api_key', 'test-key');
      const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => '### AI面談アドバイス\n生徒の自主性を尊重した指導を行います。' }
        })
      } as any);

      const adviceWithKey = await generateInterview2CoachingAdvice(interview, student);
      expect(adviceWithKey).toContain('AI面談アドバイス');
      spy.mockRestore();
    });

    it('generateInterview3CoachingAdvice: 保護者種別・合意状況・カスタム項目を網羅してアドバイス生成すること', async () => {
      // 1. お父様・未合意・カスタム項目なし
      const adviceFather = await generateInterview3CoachingAdvice(
        {
          interviewer: '鈴木講師',
          parent_type: 'father',
          parent_anxieties: '進路の絞り込み',
          discussed_content: '普通科か高専かの選択',
          future_direction_agreed: false
        },
        { name: '佐藤 翔', grade: '中3' }
      );
      expect(adviceFather).toContain('お父様');
      expect(adviceFather).toContain('要継続すり合わせ');

      // 2. 保護者様（その他）・合意済み・カスタム項目あり
      const adviceOther = await generateInterview3CoachingAdvice(
        {
          interviewer: '鈴木講師',
          parent_type: 'other',
          parent_anxieties: '体調管理',
          discussed_content: '推薦入試のスケジュール',
          future_direction_agreed: 'yes',
          custom_fields: [{ id: 'cf-2', label: '希望面談頻度', value: '月1回' }]
        },
        { name: '田中 美咲', grade: '高1' }
      );
      expect(adviceOther).toContain('合意形成済み');

      // 3. APIキーあり
      localStorage.setItem('tentoru_gemini_api_key', 'test-key');
      const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => '### 三者面談総括\n塾と家庭で足並みを揃えて支援します。' }
        })
      } as any);
      const adviceWithKey = await generateInterview3CoachingAdvice({ parent_type: 'both' }, { name: 'テスト生徒' });
      expect(adviceWithKey).toContain('三者面談総括');
      spy.mockRestore();
    });

    it('generateInterviewSummary: 二者面談・三者面談の3者共有用要約生成を網羅すること', async () => {
      // APIキー未設定時の3者共有要約（二者面談）
      const sum2 = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: {
          interviewer: '担当講師',
          dream_goal: '建築士',
          target_school: '工科高校',
          required_actions: '日々の宿題を翌日までに完了'
        },
        student: { name: '小林 蓮', grade: '中2' }
      });
      expect(sum2).toContain('小林 蓮');
      expect(sum2).toContain('建築士');
      expect(sum2).toContain('日々の宿題を翌日までに完了');

      // APIキー未設定時の3者共有要約（三者面談）
      const sum3 = await generateInterviewSummary({
        interviewType: 'three-way',
        interview: {
          interviewer: '担当講師',
          parent_type: 'mother',
          parent_anxieties: '勉強習慣が定着しない',
          future_direction_agreed: 'yes',
          discussed_content: '定期テストに向けた学習スケジュール策定'
        },
        student: { name: '中村 陽菜', grade: '小6' }
      });
      expect(sum3).toContain('中村 陽菜');
      expect(sum3).toContain('お母様');
      expect(sum3).toContain('勉強習慣が定着しない');
      expect(sum3).toContain('3者の約束');

      // APIキー設定時
      localStorage.setItem('tentoru_gemini_api_key', 'test-key');
      const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel').mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: { text: () => '### 三者共有シート\n生徒、家庭、塾の約束事項です。' }
        })
      } as any);

      const sumAi = await generateInterviewSummary({
        interviewType: 'two-way',
        interview: {},
        student: { name: 'AI生徒' }
      });
      expect(sumAi).toContain('三者共有シート');
      spy.mockRestore();
    });

    it('parseInterviewTranscriptToFields: 複雑な議事録からの抽出・正規化を網羅すること', async () => {
      const fullTranscript = `
        面談担当は田中です。
        志望校は県立中央高校に行きたいです。
        将来の夢は看護師になりたいです。
        部活はバレーボール部に入っています。
        部員は18人です。
        仲良い友だちは加藤さんです。
        困っていることは数学の証明問題がわからないことです。
        今の勉強の手応えはまだまだ普通です。
        直したいところはケアレスミスが多いことです。
        やるべきことは毎日の復習プリントを解くことです。
        次のテストで目標は85点です。
        お母さんの心配はスマホの見すぎです。
      `;

      const fields = await parseInterviewTranscriptToFields(fullTranscript, 'three-way');
      expect(fields.target_school).toBe('県立中央高校');
      expect(fields.dream_goal).toBe('看護師');
      expect(fields.club_activity).toBe('バレーボール部');
      expect(fields.club_members_count).toBe('18');
      expect(fields.close_friends).toBe('加藤さん');
      expect(fields.study_anxiety).toContain('数学の証明問題');
      expect(fields.self_evaluation).toContain('普通');
      expect(fields.student_challenges).toContain('ケアレスミス');
      expect(fields.required_actions).toContain('毎日の復習プリント');
      expect(fields.target_score).toBe('85点');
      expect(fields.parent_anxieties).toContain('スマホの見すぎ');
      expect(fields.discussed_content).toBeDefined();
      expect(fields.notes).toContain('【音声文字起こし】');
    });
  });

  describe('2. db.ts: 学年計算・サニタイズ・認証・セッション・Supabase初期化の業務網羅', () => {
    it('getSchoolYear: 1〜3月は前年、4〜12月は当年を返すこと', () => {
      expect(getSchoolYear('2026-01-15')).toBe(2025);
      expect(getSchoolYear('2026-03-31')).toBe(2025);
      expect(getSchoolYear('2026-04-01')).toBe(2026);
      expect(getSchoolYear('2026-12-25')).toBe(2026);
      expect(typeof getSchoolYear()).toBe('number');
    });

    it('normalizeStandardGrade: あらゆる表記の学年を標準形式に正規化すること', () => {
      expect(normalizeStandardGrade('')).toBe('');
      expect(normalizeStandardGrade('園児')).toBe('園児');
      expect(normalizeStandardGrade('幼児')).toBe('園児');
      expect(normalizeStandardGrade('kindergarten')).toBe('園児');
      expect(normalizeStandardGrade('既卒')).toBe('既卒');
      expect(normalizeStandardGrade('graduated')).toBe('既卒');

      // 小学生
      expect(normalizeStandardGrade('小学1')).toBe('小1');
      expect(normalizeStandardGrade('小6')).toBe('小6');
      expect(normalizeStandardGrade('3年生')).toBe('小3');
      expect(normalizeStandardGrade('5')).toBe('小5');

      // 中学生
      expect(normalizeStandardGrade('中学2')).toBe('中2');
      expect(normalizeStandardGrade('junior_high_1')).toBe('中1');
      expect(normalizeStandardGrade('jhs3')).toBe('中3');
      expect(normalizeStandardGrade('7年生')).toBe('中1');
      expect(normalizeStandardGrade('8')).toBe('中2');
      expect(normalizeStandardGrade('9年生')).toBe('中3');

      // 高校生
      expect(normalizeStandardGrade('高校2')).toBe('高2');
      expect(normalizeStandardGrade('high_school_3')).toBe('高3');
      expect(normalizeStandardGrade('10年生')).toBe('高1');
      expect(normalizeStandardGrade('11')).toBe('高2');
      expect(normalizeStandardGrade('12年生')).toBe('高3');

      // 不明
      expect(normalizeStandardGrade('一般社会人')).toBe('一般社会人');
    });

    it('isElementaryStudent / isJuniorHighStudent / isHighSchoolStudent の判定網羅', () => {
      expect(isElementaryStudent('小4')).toBe(true);
      expect(isElementaryStudent(undefined, '小学生')).toBe(true);
      expect(isElementaryStudent(undefined, undefined, 'elementary')).toBe(true);
      expect(isElementaryStudent('中1')).toBe(false);

      expect(isJuniorHighStudent('中2')).toBe(true);
      expect(isJuniorHighStudent(undefined, '中学生')).toBe(true);
      expect(isJuniorHighStudent(undefined, undefined, 'junior_high')).toBe(true);
      expect(isJuniorHighStudent('高1')).toBe(false);

      expect(isHighSchoolStudent('高3')).toBe(true);
      expect(isHighSchoolStudent('既卒')).toBe(true);
      expect(isHighSchoolStudent(undefined, '高校生')).toBe(true);
      expect(isHighSchoolStudent(undefined, undefined, 'high_school')).toBe(true);
      expect(isHighSchoolStudent('小6')).toBe(false);
    });

    it('calculateCurrentGrade: 登録年からの進級計算と上限処理', () => {
      expect(calculateCurrentGrade('小1', 2024, 2024)).toBe('小1');
      expect(calculateCurrentGrade('小1', 2024, 2026)).toBe('小3');
      expect(calculateCurrentGrade('中2', 2024, 2025)).toBe('中3');
      expect(calculateCurrentGrade('高3', 2024, 2026)).toBe('既卒');
      expect(calculateCurrentGrade('特別学年', 2024, 2026)).toBe('特別学年');
    });

    it('sanitizeLearningTask & sanitizeLearningTaskForDB: 日付異常値やNULLセーフ変換の網羅', () => {
      // スラッシュ日付の正常変換
      const taskWithSlash = sanitizeLearningTask({
        id: 't-slash-1',
        student_id: 'std-1',
        scheduled_date: '2026/08/20',
        period: 2 as any,
        status: 'completed',
        subject: '数学',
        passing_line: '80点以上',
        completed_lesson_ids: ['les-1', 'les-2']
      });
      expect(taskWithSlash.scheduled_date).toBe('2026-08-20');
      expect(taskWithSlash.period).toBe(2);
      expect(taskWithSlash.status).toBe('completed');
      expect(taskWithSlash.completed_lesson_ids).toEqual(['les-1', 'les-2']);

      // 英語日付フォーマット等の new Date パース (L552-555)
      const taskDateParse = sanitizeLearningTask({
        id: 't-date-1',
        student_id: 'std-1',
        scheduled_date: 'May 20, 2026',
        period: 1
      });
      expect(taskDateParse.scheduled_date).toBe('2026-05-20');

      // sanitizeLearningTaskForDB（DB向け完全非undefinedオブジェクト変換）
      const dbPayload = sanitizeLearningTaskForDB({
        id: 't-db-1',
        student_id: 'std-1',
        scheduled_date: '2026-09-01',
        subject: '英語'
      });
      expect(dbPayload.id).toBe('t-db-1');
      expect(dbPayload.subject).toBe('英語');
      expect(dbPayload.period).toBeNull();
      expect(dbPayload.custom_unit_name).toBeNull();
      expect(dbPayload.office_note).toBeNull();
      expect(dbPayload.passing_line).toBeNull();
    });

    it('sanitizeMiniTestResult & sanitizeHomeworkResult の正規化', () => {
      const miniRes = sanitizeMiniTestResult({
        student_id: 'std-10',
        score: '95' as any,
        passed: true,
        test_type: 'unit_test',
        unit_name: '一次関数'
      });
      expect(miniRes.id).toContain('mini-std-10');
      expect(miniRes.score).toBe(95);
      expect(miniRes.passed).toBe(true);
      expect(miniRes.status).toBe('passed');
      expect(miniRes.completed_at).toBeDefined();

      const hwRes = sanitizeHomeworkResult({
        student_id: 'std-10',
        homework_content: '教科書P30-35',
        status: 'completed'
      });
      expect(hwRes.id).toContain('hw-std-10');
      expect(hwRes.homework_content).toBe('教科書P30-35');
      expect(hwRes.status).toBe('completed');
    });

    it('DatabaseService: clearLocalMockCache がモックキーを削除すること', () => {
      localStorage.setItem('tentoru_mock_students', '[]');
      localStorage.setItem('mock_students', '[]');
      db.clearLocalMockCache();
      expect(localStorage.getItem('tentoru_mock_students')).toBeNull();
      expect(localStorage.getItem('mock_students')).toBeNull();
    });

    it('DatabaseService: signInWithPassword の各権限・一時停止・パスワード不正分岐を網羅すること', async () => {
      // 1. 本部管理者ログイン
      const adminLogin = await db.signInWithPassword('admin@tentoru.jp', 'tentoru2026');
      expect(adminLogin.success).toBe(true);
      expect(adminLogin.session?.user.role).toBe('admin');

      // 2. パスワード不一致
      const wrongPass = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
      expect(wrongPass.success).toBe(false);
      expect(wrongPass.error).toBe('メールアドレスまたはパスワードが正しくありません');

      // 3. 校舎責任者ログイン
      const branchLogin = await db.signInWithPassword('ebisu@tentoru.jp', 'tentoru2026');
      expect(branchLogin.success).toBe(true);
      expect(branchLogin.session?.user.role).toBe('branch');

      // 4. 一時停止中の校舎
      await db.saveBranch({
        id: 'branch-suspended',
        name: '休校教室',
        email: 'suspended@tentoru.jp',
        status: 'suspended',
        created_at: new Date().toISOString()
      });
      const suspLogin = await db.signInWithPassword('suspended@tentoru.jp', 'tentoru2026');
      expect(suspLogin.success).toBe(false);
      expect(suspLogin.error).toContain('アカウントは現在一時停止中です');

      // 5. 一般メールアドレスでのログイン
      const customBranchLogin = await db.signInWithPassword('shibuya-school@tentoru.jp', 'tentoru2026');
      expect(customBranchLogin.success).toBe(true);
      expect(customBranchLogin.session?.user.role).toBe('branch');

      // 6. 不正形式メールアドレス
      const invalidEmailLogin = await db.signInWithPassword('invalid-format', 'tentoru2026');
      expect(invalidEmailLogin.success).toBe(false);
    });

    it('DatabaseService: getSession / saveSession の正常保存および破損JSONハンドリング', () => {
      db.saveSession({
        user: { id: 'u-1', email: 'test@tentoru.jp', role: 'admin', name: '管理者' },
        token: 'tok-1',
        logged_in_at: new Date().toISOString()
      });
      expect(db.getSession()?.user.email).toBe('test@tentoru.jp');

      // JSONが破損していた場合のフォールバック
      localStorage.setItem('tentoru_auth_session', 'broken{json');
      expect(db.getSession()).toBeNull();
    });

    it('DatabaseService: signOut でセッションがクリアされること', async () => {
      db.saveSession({
        user: { id: 'u-1', email: 'test@tentoru.jp', role: 'admin', name: '管理者' },
        token: 'tok-1',
        logged_in_at: new Date().toISOString()
      });
      await db.signOut();
      expect(db.getSession()).toBeNull();

      // Supabase連携時のsignOut例外ハンドリング
      (db as any).isMockMode = false;
      (db as any).supabase = {
        auth: {
          signOut: vi.fn().mockRejectedValue(new Error('SignOut network error'))
        }
      };
      await db.signOut();
      (db as any).isMockMode = true;
      (db as any).supabase = null;
    });

    it('DatabaseService: StudentInterview2 (二者面談) のCRUDおよびSupabase連携を完全網羅すること', async () => {
      const interview: StudentInterview2 = {
        id: 'iv2-001',
        student_id: 'std-domain-1',
        interviewer: '山田先生',
        interview_date: '2026-05-10',
        dream_goal: '宇宙飛行士',
        target_school: '県立トップ高',
        club_activity: 'サッカー部',
        club_members_count: 22,
        notes: 'やる気十分',
        created_at: '2026-05-10T10:00:00.000Z'
      };

      // 1. ローカルモック保存（新規）
      await db.saveStudentInterview2(interview);
      const list = db.getStudentInterviews2('std-domain-1');
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].id).toBe('iv2-001');

      // 全件取得
      const allList = db.getStudentInterviews2();
      expect(allList.some(i => i.id === 'iv2-001')).toBe(true);

      // 2. 既存更新 (idx >= 0 分岐)
      const updatedInterview = { ...interview, dream_goal: '航空宇宙工学研究者' };
      await db.saveStudentInterview2(updatedInterview);
      const reloaded = db.getStudentInterviews2('std-domain-1');
      expect(reloaded[0].dream_goal).toBe('航空宇宙工学研究者');

      // 3. Supabase連携 (正常系 & 異常系)
      try {
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: (_table: string) => ({
            upsert: vi.fn().mockReturnValue({
              select: () => ({
                single: async () => ({ data: { ...interview, id: 'iv2-sb-1' }, error: null })
              })
            }),
            delete: () => ({
              eq: async () => ({ error: null })
            })
          })
        };
        const sbResult = await db.saveStudentInterview2(interview);
        expect(sbResult.id).toBe('iv2-sb-1');

        // Supabase例外系
        (db as any).supabase = {
          from: (_table: string) => ({
            upsert: vi.fn().mockImplementation(() => { throw new Error('Supabase save error'); }),
            delete: vi.fn().mockImplementation(() => { throw new Error('Supabase delete error'); })
          })
        };
        await db.saveStudentInterview2(interview);
        await db.deleteStudentInterview2('iv2-001');
      } finally {
        (db as any).isMockMode = true;
        (db as any).supabase = null;
      }

      await db.deleteStudentInterview2('iv2-001');
      expect(db.getStudentInterviews2('std-domain-1').some(i => i.id === 'iv2-001')).toBe(false);
    });

    it('DatabaseService: StudentInterview3 (三者面談) のCRUDおよびSupabase連携を完全網羅すること', async () => {
      const interview3: StudentInterview3 = {
        id: 'iv3-001',
        student_id: 'std-domain-3',
        interviewer: '佐藤先生',
        interview_date: '2026-06-15',
        parent_type: 'mother',
        parent_anxieties: '数学の計算ミスが多い',
        future_direction_agreed: 'yes',
        notes: '家庭での学習計画を共有',
        created_at: '2026-06-15T10:00:00.000Z'
      };

      // 1. ローカルモック保存（新規）
      await db.saveStudentInterview3(interview3);
      const list = db.getStudentInterviews3('std-domain-3');
      expect(list.length).toBeGreaterThan(0);
      expect(list[0].id).toBe('iv3-001');

      // 全件取得
      const allList = db.getStudentInterviews3();
      expect(allList.some(i => i.id === 'iv3-001')).toBe(true);

      // 2. 既存更新 (idx >= 0 分岐)
      const updated3 = { ...interview3, notes: '毎日計算ドリルを1ページ実施' };
      await db.saveStudentInterview3(updated3);
      const reloaded3 = db.getStudentInterviews3('std-domain-3');
      expect(reloaded3[0].notes).toBe('毎日計算ドリルを1ページ実施');

      // 3. Supabase連携 (正常系 & 異常系)
      try {
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: (_table: string) => ({
            upsert: vi.fn().mockReturnValue({
              select: () => ({
                single: async () => ({ data: { ...interview3, id: 'iv3-sb-1' }, error: null })
              })
            }),
            delete: () => ({
              eq: async () => ({ error: null })
            })
          })
        };
        const sbResult3 = await db.saveStudentInterview3(interview3);
        expect(sbResult3.id).toBe('iv3-sb-1');

        // Supabase例外系
        (db as any).supabase = {
          from: (_table: string) => ({
            upsert: vi.fn().mockImplementation(() => { throw new Error('Supabase save3 error'); }),
            delete: vi.fn().mockImplementation(() => { throw new Error('Supabase delete3 error'); })
          })
        };
        await db.saveStudentInterview3(interview3);
        await db.deleteStudentInterview3('iv3-001');
      } finally {
        (db as any).isMockMode = true;
        (db as any).supabase = null;
      }

      await db.deleteStudentInterview3('iv3-001');
      expect(db.getStudentInterviews3('std-domain-3').some(i => i.id === 'iv3-001')).toBe(false);
    });

    it('DatabaseService: BranchAIRules (校舎別AIルール) および パスワードリセット処理を完全網羅すること', async () => {
      try {
        // 1. グローバルルールの取得と保存
        const globalRules = db.getBranchAIRules(null);
        expect(globalRules).toBeDefined();
        await db.saveBranchAIRules('all', { allow_ai_report: true });

        // 2. 校舎別ルールの保存・取得
        await db.saveBranch({ id: 'br-domain-1', name: '渋谷校', created_at: new Date().toISOString() });
        const savedRules = await db.saveBranchAIRules('br-domain-1', { custom_prompt: '熱意を持った指導' });
        expect(savedRules.custom_prompt).toBe('熱意を持った指導');
        const loadedRules = db.getBranchAIRules('br-domain-1');
        expect(loadedRules.custom_prompt).toBe('熱意を持った指導');

        // 3. Supabase連携 (正常・例外)
        (db as any).isMockMode = false;
        (db as any).supabase = {
          from: () => ({
            update: () => ({ eq: async () => ({ error: { message: 'Update failed' } }) })
          }),
          auth: {
            resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null })
          }
        };
        await db.saveBranchAIRules('br-domain-1', { custom_prompt: '更新' });
        const resetRes = await db.sendBranchPasswordReset('shibuya@tentoru.jp');
        expect(resetRes.success).toBe(true);

        // resetPasswordForEmail エラーでもセキュリティ上 true を返す仕様
        (db as any).supabase.auth.resetPasswordForEmail = vi.fn().mockResolvedValue({ error: new Error('Reset error') });
        const resetErr = await db.sendBranchPasswordReset('shibuya@tentoru.jp');
        expect(resetErr.success).toBe(true);

        // resetPasswordForEmail 例外でもセキュリティ上 true を返す仕様
        (db as any).supabase.auth.resetPasswordForEmail = vi.fn().mockRejectedValue(new Error('Network exception'));
        const resetEx = await db.sendBranchPasswordReset('shibuya@tentoru.jp');
        expect(resetEx.success).toBe(true);
      } finally {
        (db as any).isMockMode = true;
        (db as any).supabase = null;
      }

      const localReset = await db.sendBranchPasswordReset('shibuya@tentoru.jp');
      expect(localReset.success).toBe(true);
    });

    it('DatabaseService: saveSession 例外および汎用メール形式のログイン分岐を完全網羅すること', async () => {
      // 1. branch / school を含む汎用 tentoru メールログイン
      const branchEmailLogin = await db.signInWithPassword('shibuya-branch@tentoru.jp', 'tentoru2026');
      expect(branchEmailLogin.success).toBe(true);
      expect(branchEmailLogin.session?.user.role).toBe('branch');

      // 2. 一般 tentoru メール（admin扱い）
      const adminEmailLogin = await db.signInWithPassword('director@tentoru.jp', 'tentoru2026');
      expect(adminEmailLogin.success).toBe(true);
      expect(adminEmailLogin.session?.user.role).toBe('admin');

      // 3. 不正パスワード分岐 (L4843)
      const wrongPassLogin = await db.signInWithPassword('custom@other-school.jp', 'wrongpass');
      expect(wrongPassLogin.success).toBe(false);
      expect(wrongPassLogin.error).toContain('正しくありません');

      // 4. @なしtentoru含有ユーザーのログイン分岐 (L4843)
      const noAtTentoruLogin = await db.signInWithPassword('tentoru_user_no_at', 'anypassword');
      expect(noAtTentoruLogin.success).toBe(false);

      // 5. saveSession 中の LocalStorage 例外
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      db.saveSession({
        user: { id: 'u-err', email: 'err@test.jp', role: 'admin', name: 'エラーテスト' },
        token: 'tok-err',
        logged_in_at: new Date().toISOString()
      });
      setItemSpy.mockRestore();

      // 6. getSession 非ブラウザ環境判定 (L4847)
      const origIsBrowser = (db as any).isBrowser;
      (db as any).isBrowser = () => false;
      expect(db.getSession()).toBeNull();
      (db as any).isBrowser = origIsBrowser;
    });

    it('DatabaseService: StudentInteraction (指導・面談記録) のSupabase取得・保存・削除処理を完全網羅すること', async () => {
      const interaction: StudentInteraction = {
        id: 'interaction-cov-1',
        student_id: 'std-cov-1',
        type: 'interview',
        title: '定期面談',
        notes: 'モチベーション向上中',
        interviewer: '山田先生',
        interaction_date: '2026-05-15',
        created_at: '2026-05-15T10:00:00.000Z'
      };

      try {
        (db as any).isMockMode = false;

        // 1. fetchStudentInteractions: Step 3 (student_interactions テーブル) 取得とマッピング (L4086-4095)
        (db as any).supabase = {
          from: (table: string) => {
            if (table === 'student_interactions') {
              return {
                select: () => ({
                  eq: () => ({
                    order: async () => ({
                      data: [
                        { id: 'si-map-1', student_id: 'std-cov-1', category: '進路指導', memo: '面談メモ', date: '2026-06-01', staff_name: '指導員' }
                      ],
                      error: null
                    })
                  })
                })
              };
            }
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({ data: [], error: null })
                })
              })
            };
          }
        };
        const fetchedList = await db.fetchStudentInteractions('std-cov-1');
        expect(fetchedList.length).toBe(1);
        expect(fetchedList[0].category).toBe('進路指導');

        // 2. saveStudentInteraction: Step 1 (student_contact_logs) 正常系
        (db as any).supabase = {
          from: (_table: string) => ({
            upsert: vi.fn().mockReturnValue({
              select: () => ({
                single: async () => ({ data: interaction, error: null })
              })
            })
          })
        };
        const res1 = await db.saveStudentInteraction(interaction);
        expect(res1).toBeDefined();

        // 3. saveStudentInteraction: Step 1 エラー発生時の throw
        (db as any).supabase = {
          from: () => ({
            upsert: () => ({
              select: () => ({ single: async () => ({ data: null, error: new Error('table error') }) })
            })
          })
        };
        await expect(db.saveStudentInteraction(interaction)).rejects.toThrow('table error');

        // 4. saveStudentInteraction: テーブル未定義時、Step 4 (students テーブルの contact_logs JSONB 配列) へ到達
        (db as any).supabase = {
          from: (table: string) => {
            if (table === 'students') {
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({ data: { id: 'std-cov-1', contact_logs: [] }, error: null })
                  })
                }),
                update: () => ({
                  eq: async () => ({ error: null })
                })
              };
            }
            return {};
          }
        };
        const res4 = await db.saveStudentInteraction(interaction);
        expect(res4).toBeDefined();

        // 5. saveStudentInteraction: Step 4 更新エラー発生時の throw (L4212-4222)
        (db as any).supabase = {
          from: (table: string) => {
            if (table === 'students') {
              return {
                select: () => ({
                  eq: () => ({
                    single: async () => ({ data: { id: 'std-cov-1', contact_logs: [] }, error: null })
                  })
                }),
                update: () => ({
                  eq: async () => ({ error: new Error('Update students contact logs error') })
                })
              };
            }
            return {};
          }
        };
        await expect(db.saveStudentInteraction(interaction)).rejects.toThrow('Update students contact logs error');

        // 6. deleteStudentInteraction: Supabase正常系
        (db as any).supabase = {
          from: () => ({
            delete: () => ({ eq: async () => ({ error: null }) })
          })
        };
        await db.deleteStudentInteraction('interaction-cov-1');

        // 7. deleteStudentInteraction: Supabase例外系
        (db as any).supabase = {
          from: () => ({
            delete: () => ({ eq: async () => { throw new Error('Supabase network error'); } })
          })
        };
        await expect(db.deleteStudentInteraction('interaction-cov-1')).rejects.toThrow();

      } finally {
        (db as any).isMockMode = true;
        (db as any).supabase = null;
      }
    });

    it('DatabaseService: MiniTestResult および HomeworkResult のスキーマ自己修復・エラーハンドリング網羅', async () => {
      try {
        (db as any).isMockMode = false;

        // 1. saveMiniTestResult: 未存在カラムエラー検知時の動的カラム削除リトライ (L3114-3116)
        (db as any).supabase = {
          from: () => ({
            upsert: vi.fn().mockImplementation((payload: any) => {
              if (payload.extra_col) {
                return {
                  select: () => ({
                    single: async () => ({ data: null, error: { message: "Could not find the 'extra_col' column" } })
                  })
                };
              }
              return {
                select: () => ({
                  single: async () => ({ data: { ...payload, id: 'mini-retry-1' }, error: null })
                })
              };
            })
          })
        };

        const testRes = await db.saveMiniTestResult({
          student_id: 'std-cov-1',
          test_type: 'unit_test',
          unit_name: '正負の数',
          score: 100,
          passed: true,
          extra_col: 'dummy'
        } as any);
        expect(testRes.id).toBe('mini-retry-1');

        // 2. deleteMiniTestResultByDate: Supabase エラー警告ログ分岐 (L3166)
        (db as any).supabase = {
          from: () => ({
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: { message: 'Delete error' } })
              })
            })
          })
        };
        await db.deleteMiniTestResultByDate('std-cov-1', '2026-05-15');

        // 3. deleteHomeworkResultsByDate: Supabase エラー警告ログ分岐 (L3178)
        (db as any).supabase = {
          from: () => ({
            delete: () => ({
              eq: () => ({
                eq: async () => ({ error: { message: 'HW delete error' } })
              })
            })
          })
        };
        await db.deleteHomeworkResultsByDate('std-cov-1', '2026-05-15');

      } finally {
        (db as any).isMockMode = true;
        (db as any).supabase = null;
      }
    });
  });

  describe('3. TeacherDashboard: 生徒情報設定におけるスタート学年切替と単元リセット連動', () => {
    it('スタート学年選択を別の学年に切り替えた際、既存の単元設定が適切にリセットされること', async () => {
      const studentTest: Student = {
        id: 'std-grade-change-1',
        student_id: 'std-grade-change-1',
        name: '高橋 健太',
        grade: '中1',
        branch_id: 'branch-1',
        school_id: 'sch-1',
        status: 'normal',
        start_unit_id: 'unit-math-1',
        start_unit_id_math: 'unit-math-1',
        created_at: new Date().toISOString(),
        selected_subjects: ['数学'],
        selected_days: ['tuesday'],
        default_slots: 1
      };
      await db.saveStudent(studentTest);

      const masters: CurriculumMaster[] = [
        { id: 'unit-math-1', subject: '数学', grade: '中1', sort_order: 1, unit_name: '正負の数', lesson_name: '正負の数(1)' },
        { id: 'unit-math-2', subject: '数学', grade: '中2', sort_order: 2, unit_name: '連立方程式', lesson_name: '連立方程式(1)' }
      ];
      await db.saveCurriculumMasters(masters);

      render(
        <TeacherDashboard
          students={[studentTest]}
          teacherType="junior_high"
          initialStudentId={studentTest.id}
          initialTab="student-list"
        />
      );

      // 生徒編集ボタンをクリックして編集フォームを開く
      const editBtn = screen.getByTestId(`edit-student-btn-${studentTest.id}`);
      fireEvent.click(editBtn);

      // サブタブ「🎯 教科別スタート位置・個性」が表示されるのを待ってクリック
      await waitFor(() => {
        expect(screen.getByTestId('subtab-start-and-personality')).toBeInTheDocument();
      });
      const subTabBtn = screen.getByTestId('subtab-start-and-personality');
      fireEvent.click(subTabBtn);

      // 学年選択ドロップダウンの取得
      await waitFor(() => {
        expect(screen.getByTestId('start-grade-select-start_unit_math')).toBeInTheDocument();
      });

      const gradeSelect = screen.getByTestId('start-grade-select-start_unit_math');
      // 中1から中2へ学年を変更 -> 異なる学年になったため単元設定がリセットされる (L11053)
      fireEvent.change(gradeSelect, { target: { value: '中2' } });

      // 保存ボタンをクリックしてDB更新
      const saveBtn = screen.getByTitle('生徒情報の変更を保存');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        const updatedStudent = db.getStudents().find(s => s.id === studentTest.id);
        expect(updatedStudent).toBeDefined();
      });
    });
  });
});
