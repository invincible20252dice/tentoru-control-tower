import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { 
  db, 
  Student, 
  School, 
  CurriculumUnit, 
  CurriculumMaster,
  LearningTask, 
  HomeworkResult, 
  ExamThresholdMaster, 
  SchoolCodeMaster,
  LearningLog,
  TestRecord,
  StudentInteraction
} from '../lib/db';

describe('Full 95%+ Coverage Master Suite (TeacherDashboard & db.ts Complete Real Workflows)', () => {
  const masterStudent: Student = {
    id: 'st-master-flow-1',
    student_id: 'S_MASTER_1',
    name: '完全制覇 太郎',
    grade: '中2',
    grade_category: 'junior_high',
    status: 'normal',
    branch_id: 'branch-1',
    school_id: 'sch-master-1',
    school_name: '本巣中学校',
    teacher_in_charge: '福田 尚弘',
    selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
    selected_days: ['monday', 'wednesday', 'friday'],
    period_count: 3,
    default_slots: 3,
    level: 'A',
    start_unit_science: 'u-sci-2',
    start_unit_social: 'u-soc-2',
    start_unit_japanese: 'u-jpn-2',
    created_at: new Date().toISOString()
  };

  const masterSchool: School = {
    id: 'sch-master-1',
    name: '本巣中学校',
    branch_id: 'branch-1',
    type: 'junior_high',
    created_at: new Date().toISOString()
  };

  const sampleUnits: CurriculumUnit[] = [
    { id: 'u-sci-1', school_id: 'sch-master-1', grade: '中2', subject: '理科', name: '化学変化(1)', sequence_order: 1 },
    { id: 'u-sci-2', school_id: 'sch-master-1', grade: '中2', subject: '理科', name: '化学変化(2)', sequence_order: 2 },
    { id: 'u-soc-1', school_id: 'sch-master-1', grade: '中2', subject: '社会', name: '地理(1)', sequence_order: 1 },
    { id: 'u-soc-2', school_id: 'sch-master-1', grade: '中2', subject: '社会', name: '地理(2)', sequence_order: 2 },
    { id: 'u-jpn-1', school_id: 'sch-master-1', grade: '中2', subject: '国語', name: '文法(1)', sequence_order: 1 },
    { id: 'u-jpn-2', school_id: 'sch-master-1', grade: '中2', subject: '国語', name: '文法(2)', sequence_order: 2 }
  ];

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-m-1', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '一次関数のグラフ', sort_order: 1 },
    { id: 'cm-m-2', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '一次関数の利用', sort_order: 2 }
  ];

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await db.saveStudent(masterStudent);
    await db.saveSchool(masterSchool);
    await db.saveCurriculumUnits(sampleUnits);
    (db as any).saveMockData('curriculum_masters', sampleMasters);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('thoroughly exercises start unit setting across science, social, and japanese with task status promotion/skipping and student detail save', async () => {
    // 未着手の理科タスクを登録（u-sci-1 と u-sci-2）
    const tasks: LearningTask[] = [
      {
        id: 'task-sci-1',
        student_id: masterStudent.id,
        scheduled_date: '2026-10-15',
        period: 1,
        subject: '理科',
        unit_id: 'u-sci-1',
        status: 'unstarted'
      },
      {
        id: 'task-sci-2',
        student_id: masterStudent.id,
        scheduled_date: '2026-10-15',
        period: 2,
        subject: '理科',
        unit_id: 'u-sci-2',
        status: 'skipped'
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(
      <TeacherDashboard
        students={[masterStudent]}
        initialStudentId={masterStudent.id}
        teacherType="junior_high"
        initialTab="student-detail"
      />
    );

    // 生徒詳細タブの描画待機
    await waitFor(() => {
      expect(screen.getByTestId('subtab-start-and-personality')).toBeInTheDocument();
    });

    // 1. 基本情報の保存（handleSaveStudentDetail の実行）
    const saveDetailBtn = screen.getByTitle(/生徒情報の変更を保存/i);
    await act(async () => {
      fireEvent.click(saveDetailBtn);
    });

    // 2. サブタブ「🎯 教科別スタート位置・個性」をクリック
    fireEvent.click(screen.getByTestId('subtab-start-and-personality'));

    // 学年選択・単元選択の操作
    const gradeSelect = screen.queryByTestId('start-grade-select-start_unit_math');
    if (gradeSelect) {
      fireEvent.change(gradeSelect, { target: { value: '中2' } });
    }
    const unitSelect = screen.queryByTestId('start-unit-select-start_unit_math');
    if (unitSelect) {
      fireEvent.change(unitSelect, { target: { value: 'cm-m-1' } });
    }

    // 「📍 教科別スタート位置をTodoに反映」ボタンをクリックして handleSaveStartUnit を実行
    const applyStartBtn = screen.getByText(/教科別スタート位置をTodoに反映/i);
    expect(applyStartBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(applyStartBtn);
    });

    // タスクが更新されたことを検証
    const savedTasks = db.getLearningTasks().filter(t => t.student_id === masterStudent.id);
    const task1 = savedTasks.find(t => t.id === 'task-sci-1');
    const task2 = savedTasks.find(t => t.id === 'task-sci-2');
    expect(task1?.status).toBe('skipped');
    expect(task2?.status).toBe('unstarted');

    unmount();
  });

  it('thoroughly exercises homework status auto-save, deletion, and API key settings', async () => {
    const hwItem: HomeworkResult = {
      id: 'hw-master-test-1',
      student_id: masterStudent.id,
      subject: '数学',
      date: '2026-10-12',
      homework_content: '連立方程式ワーク P14-16',
      status: 'unsubmitted',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hwItem);

    const { unmount } = render(
      <TeacherDashboard
        students={[masterStudent]}
        initialStudentId={masterStudent.id}
        teacherType="junior_high"
        initialTab="homeworks"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId(`toggle-homework-status-${hwItem.id}`)).toBeInTheDocument();
    });

    // 1. 宿題ステータスのトグル（未提出 -> 提出済、handleAutoSaveHomeworkStatus の実行）
    await act(async () => {
      fireEvent.click(screen.getByTestId(`toggle-homework-status-${hwItem.id}`));
    });
    expect(db.getHomeworkResults().find(h => h.id === hwItem.id)?.status).toBe('completed');

    // 2. 宿題レコードの削除（handleDeleteHomeworkResult の実行）
    const delBtns = screen.getAllByTitle(/宿題記録を削除する/i);
    expect(delBtns.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(delBtns[0]);
    });
    expect(db.getHomeworkResults().find(h => h.id === hwItem.id)).toBeUndefined();

    // 3. 定期テスト・模試タブに切り替えて APIキー設定（handleSaveApiKey & handleDeleteApiKey の実行）
    const testsTabBtn = screen.getByText('定期テスト・模試');
    await act(async () => {
      fireEvent.click(testsTabBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Gemini APIキー設定/i)).toBeInTheDocument();
    });

    // APIキー設定アコーディオンを開く
    fireEvent.click(screen.getByText(/Gemini APIキー設定/i));

    const keyInput = screen.getByPlaceholderText(/AIzaSy/);
    fireEvent.change(keyInput, { target: { value: 'AIzaSyMockValidApiKeyForCoverage95' } });

    // 保存ボタンをクリック
    const saveKeyBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveKeyBtn);
    expect(localStorage.getItem('tentoru_gemini_api_key')).toBe('AIzaSyMockValidApiKeyForCoverage95');

    // 再度開いて消去ボタンをクリック
    fireEvent.click(screen.getByText(/Gemini APIキー設定/i));
    const deleteKeyBtn = screen.getByRole('button', { name: '消去' });
    fireEvent.click(deleteKeyBtn);
    expect(localStorage.getItem('tentoru_gemini_api_key')).toBeNull();

    unmount();
  });

  it('thoroughly exercises mock exam score entry, threshold pass rate calculations (A through E ranks), regular exam and deletion', async () => {
    // 模試基準値マスターと学校コードマスターの準備
    const mockThresholds: ExamThresholdMaster[] = [
      { id: 'eth-1', school_code: 'schcode-A', min_score: 450, max_score: 500, probability: 85 },
      { id: 'eth-2', school_code: 'schcode-A', min_score: 400, max_score: 449, probability: 70 },
      { id: 'eth-3', school_code: 'schcode-A', min_score: 350, max_score: 399, probability: 55 },
      { id: 'eth-4', school_code: 'schcode-A', min_score: 300, max_score: 349, probability: 40 },
      { id: 'eth-5', school_code: 'schcode-A', min_score: 0, max_score: 299, probability: 20 }
    ];
    (db as any).saveMockData('exam_thresholds_master', mockThresholds);

    const mockSchoolCodes: SchoolCodeMaster[] = [
      { code: 'schcode-A', name: '天登星雲高校', deviation_value: 60 }
    ];
    (db as any).saveMockData('school_codes_master', mockSchoolCodes);

    const { unmount } = render(
      <TeacherDashboard
        students={[masterStudent]}
        initialStudentId={masterStudent.id}
        teacherType="junior_high"
        initialTab="tests"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/定期テスト・模試成績管理/i)).toBeInTheDocument();
    });

    // 1. 定期テスト結果記録 (handleSaveRegularExam)
    const testNameInput = screen.getByPlaceholderText(/1学期中間テスト/i);
    fireEvent.change(testNameInput, { target: { value: '2学期期末テスト' } });
    const mathScoreInput = screen.getByPlaceholderText('空欄時は入力点から自動計算');
    fireEvent.change(mathScoreInput, { target: { value: '450' } });

    const saveRegularBtn = screen.getByRole('button', { name: /定期テスト結果を記録/i });
    await act(async () => {
      fireEvent.click(saveRegularBtn);
    });
    expect(db.getTestRecords().some(r => r.student_id === masterStudent.id && r.test_name === '2学期期末テスト')).toBe(true);

    // 2. 模試判定計算 (A〜Eランクの網羅実行)
    const mockSubjectInput = screen.getByPlaceholderText(/全県模試/i);
    const mockScoreInput = screen.getByPlaceholderText('例: 380');
    const calcMockBtn = screen.getByRole('button', { name: /模試点数を入力して合格判定算出/i });

    // 志望校を選択
    const allSelects = screen.getAllByRole('combobox');
    const mockSchoolSelect = allSelects.find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'schcode-A')) || allSelects[0];
    fireEvent.change(mockSchoolSelect, { target: { value: 'schcode-A' } });

    // A判定 (460点: 450 <= 460 <= 500 -> prob 85 -> Rank A)
    fireEvent.change(mockSubjectInput, { target: { value: '全県模試 第1回' } });
    fireEvent.change(mockScoreInput, { target: { value: '460' } });
    await act(async () => {
      fireEvent.click(calcMockBtn);
    });
    expect(screen.getAllByText(/【A判定】/i)[0]).toBeInTheDocument();

    // B判定 (420点: 400 <= 420 <= 449 -> prob 70 -> Rank B)
    fireEvent.change(mockSubjectInput, { target: { value: '全県模試 第2回' } });
    fireEvent.change(mockScoreInput, { target: { value: '420' } });
    await act(async () => {
      fireEvent.click(calcMockBtn);
    });
    expect(screen.getAllByText(/【B判定】/i)[0]).toBeInTheDocument();

    // C判定 (370点: 350 <= 370 <= 399 -> prob 55 -> Rank C)
    fireEvent.change(mockSubjectInput, { target: { value: '全県模試 第3回' } });
    fireEvent.change(mockScoreInput, { target: { value: '370' } });
    await act(async () => {
      fireEvent.click(calcMockBtn);
    });
    expect(screen.getAllByText(/【C判定】/i)[0]).toBeInTheDocument();

    // D判定 (320点: 300 <= 320 <= 349 -> prob 40 -> Rank D)
    fireEvent.change(mockSubjectInput, { target: { value: '全県模試 第4回' } });
    fireEvent.change(mockScoreInput, { target: { value: '320' } });
    await act(async () => {
      fireEvent.click(calcMockBtn);
    });
    expect(screen.getAllByText(/【D判定】/i)[0]).toBeInTheDocument();

    // E判定 (200点: 0 <= 200 <= 299 -> prob 20 -> Rank E)
    fireEvent.change(mockSubjectInput, { target: { value: '全県模試 第5回' } });
    fireEvent.change(mockScoreInput, { target: { value: '200' } });
    await act(async () => {
      fireEvent.click(calcMockBtn);
    });
    expect(screen.getAllByText(/【E判定】/i)[0]).toBeInTheDocument();

    // 成績レコード削除 (handleDeleteTestRecord)
    const deleteTestBtns = screen.queryAllByTitle(/削除/i);
    if (deleteTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteTestBtns[0]);
      });
    }

    unmount();
  });

  it('exercises db.ts restoreAllDefaultData, deleteStudent, and comprehensive Supabase operations', async () => {
    const origSupabase = (db as any).supabase;
    const origMockMode = (db as any).isMockMode;

    try {
      const createChainedQuery = () => {
        const queryObj: any = {};
        const chainMethod = () => queryObj;
        queryObj.eq = vi.fn().mockImplementation(chainMethod);
        queryObj.order = vi.fn().mockImplementation(chainMethod);
        queryObj.limit = vi.fn().mockImplementation(chainMethod);
        queryObj.select = vi.fn().mockImplementation(chainMethod);
        queryObj.single = vi.fn().mockResolvedValue({ error: null, data: { id: 'st-temp-id', contact_logs: [] } });
        queryObj.then = (resolve: any) => Promise.resolve({ error: null, data: { id: 'st-temp-id', contact_logs: [] } }).then(resolve);
        return queryObj;
      };

      (db as any).isMockMode = false;
      (db as any).supabase = {
        from: (table: string) => ({
          delete: vi.fn().mockImplementation(createChainedQuery),
          upsert: vi.fn().mockImplementation(createChainedQuery),
          insert: vi.fn().mockImplementation(createChainedQuery),
          update: vi.fn().mockImplementation(createChainedQuery),
          select: vi.fn().mockImplementation(createChainedQuery)
        })
      };

      // 1. deleteStudent の実行（全関連テーブルのカスケード削除クエリ）
      await db.deleteStudent(masterStudent.id);

      // 2. restoreAllDefaultData の実行（Supabaseへの一括リストア）
      await db.restoreAllDefaultData();

      // 3. LearningTasks & Logs の Supabase 実行
      await db.deleteLearningTasksByDate(masterStudent.id, '2026-10-15');
      await db.deleteLearningTasksByStudent(masterStudent.id);
      const testLog: LearningLog = {
        id: 'll-1',
        task_id: 'task-sci-1',
        student_id: masterStudent.id,
        date: '2026-10-15',
        understanding_level: 5,
        concentration_level: 5,
        homework_status: 'completed',
        notes: '理解良好'
      };
      await db.addLearningLog(testLog);

      // 4. TestRecord の Supabase 実行
      const testRec: TestRecord = {
        id: 'tr-sup-1',
        student_id: masterStudent.id,
        record_type: 'regular_test',
        test_name: '期末テスト',
        score: 95,
        created_at: new Date().toISOString()
      };
      await db.saveTestRecord(testRec);
      await db.deleteTestRecord('tr-sup-1');

      // 5. SchoolCodes & ExamThresholds の Supabase 実行
      const scItem: SchoolCodeMaster = { code: 'schcode-TEST', name: 'テスト高校', deviation_value: 55 };
      await db.saveSchoolCodeMaster(scItem);

      const ethItem: ExamThresholdMaster = { id: 'eth-sup-1', school_code: 'schcode-TEST', min_score: 300, max_score: 500, probability: 80 };
      await db.saveExamThresholdMaster(ethItem);

      // 6. StudentInteractions の Supabase 実行
      const interactionItem: StudentInteraction = {
        id: 'si-sup-1',
        student_id: masterStudent.id,
        type: 'counseling',
        date: '2026-10-15',
        notes: '面談記録',
        created_at: new Date().toISOString()
      };
      await db.saveStudentInteraction(interactionItem);
      await db.deleteStudentInteraction('si-sup-1');
    } finally {
      (db as any).supabase = origSupabase;
      (db as any).isMockMode = origMockMode;
    }
  });
});
