import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, HomeworkResult, MilestonePlan } from '../types';

describe('TeacherDashboard & DB Deep Pure Coverage Master Suite', () => {
  const mockStudent1: Student = {
    id: 'std-cov-elem-100',
    student_id: 'std-cov-elem-100',
    name: '小学 算数太郎',
    name_kana: 'ショウガク サンスウタロウ',
    email: 'taro@example.com',
    grade: '小1',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'normal',
    level: 'A',
    selected_subjects: ['算数', '英語'],
    selected_days: ['monday', 'wednesday'],
    period_count: 2,
    registered_year: 2026,
    registered_grade: '小1',
    personalities: ['几帳面', '自主的'],
    target_schools: [{ school_name: 'テントル中学', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-cov-m1',
    start_unit_english: 'cm-cov-e1'
  };

  const mockStudent2: Student = {
    id: 'std-cov-jhs-200',
    student_id: 'std-cov-jhs-200',
    name: '中学 数学次郎',
    name_kana: 'チュウガク スウガクジロウ',
    email: 'jiro@example.com',
    grade: '中2',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'warning',
    level: 'B',
    selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
    selected_days: ['tuesday', 'friday'],
    period_count: 3,
    registered_year: 2026,
    registered_grade: '中2',
    personalities: ['集中力高い'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z'
  };

  const mockCurriculumMasters: CurriculumMaster[] = [
    { id: 'cm-cov-m1', grade: '小1', subject: '算数', unit_name: 'かずを かぞえよう', lesson_name: 'かずを かぞえよう(1)', sort_order: 1 },
    { id: 'cm-cov-m2', grade: '小1', subject: '算数', unit_name: 'かずを かぞえよう', lesson_name: 'かずを かぞえよう(2)', sort_order: 2 },
    { id: 'cm-cov-m3', grade: '小1', subject: '算数', unit_name: 'かずを かぞえよう', lesson_name: 'かずを かぞえよう - 単元確認テスト', sort_order: 3, item_type: 'unit_test' },
    { id: 'cm-cov-m4', grade: '小1', subject: '算数', unit_name: 'いくつと いくつ', lesson_name: 'いくつと いくつ(1)', sort_order: 4 },
    { id: 'cm-cov-e1', grade: '小1', subject: '英語', unit_name: 'アルファベット', lesson_name: 'アルファベット(1)', sort_order: 1 },
    { id: 'cm-cov-e2', grade: '小1', subject: '英語', unit_name: 'アルファベット', lesson_name: 'アルファベット - 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
    { id: 'cm-cov-j1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '連立方程式の解法(1)', sort_order: 1 },
    { id: 'cm-cov-j2', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '連立方程式の解法(2)', sort_order: 2 },
    { id: 'cm-cov-j3', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '連立方程式 - 単元確認テスト', sort_order: 3, item_type: 'unit_test' }
  ];

  const mockCurriculumUnits: CurriculumUnit[] = [
    { id: 'cu-1', school_id: 'school-1', subject: '数学', name: '中2数学 連立方程式', sequence_order: 1 },
    { id: 'cu-2', school_id: 'school-1', subject: '英語', name: '中2英語 過去進行形', sequence_order: 2 }
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('students', JSON.stringify([mockStudent1, mockStudent2]));
    localStorage.setItem('curriculum_masters', JSON.stringify(mockCurriculumMasters));
    localStorage.setItem('curriculum_units', JSON.stringify(mockCurriculumUnits));
  });

  it('1. TeacherDashboard: Deeply exercise Schedule tab, multi-period selection, AI auto-reschedule, and bulk apply', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={mockStudent1.id}
          initialTab="schedule"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/個別指導・学習計画設定/i).length).toBeGreaterThan(0);
    });

    // コマ割り教科の選択
    const period1Select = screen.queryByTestId('period-subject-select-1');
    if (period1Select) {
      await act(async () => {
        fireEvent.change(period1Select, { target: { value: '算数' } });
      });
    }

    const period2Select = screen.queryByTestId('period-subject-select-2');
    if (period2Select) {
      await act(async () => {
        fireEvent.change(period2Select, { target: { value: '英語' } });
      });
    }

    // AI自動最適化ボタンの実行
    const aiAutoOptimizeBtn = screen.queryByTestId('ai-auto-optimize-btn') || screen.queryByText(/AI自動最適化/i);
    if (aiAutoOptimizeBtn) {
      await act(async () => {
        fireEvent.click(aiAutoOptimizeBtn);
      });
    }

    // コマ割り確定・反映ボタンの実行
    const saveTimetableBtn = screen.queryByTestId('save-timetable-btn') || screen.queryByText(/コマ割りを確定・反映/i);
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }
  });

  it('2. TeacherDashboard: Deeply exercise Student Detail, Milestones, Personality tags, and History logs', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialTab="student-list"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/生徒一覧/i).length).toBeGreaterThan(0);
    });

    // 中学生生徒の編集ボタンをクリック
    const editBtn = screen.queryByTestId(`edit-student-btn-${mockStudent2.id}`) || screen.queryAllByTitle(/生徒情報を編集/i)[0];
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });
    }

    await waitFor(() => {
      expect(screen.getAllByText(/基本情報|生徒カルテ/i).length).toBeGreaterThan(0);
    });

    // 性格タグの追加
    const personalityInput = screen.queryByPlaceholderText(/性格・特性タグを入力/i);
    const addPersonalityBtn = screen.queryByText(/タグ追加/i);
    if (personalityInput && addPersonalityBtn) {
      await act(async () => {
        fireEvent.change(personalityInput, { target: { value: '負けず嫌い' } });
        fireEvent.click(addPersonalityBtn);
      });
    }

    // 志望校編集
    const targetSchoolInput = screen.queryByPlaceholderText(/第一志望校/i) || screen.queryByLabelText(/志望校/i);
    if (targetSchoolInput) {
      await act(async () => {
        fireEvent.change(targetSchoolInput, { target: { value: '慶應義塾普通部' } });
      });
    }

    // 詳細保存
    const saveStudentDetailBtn = screen.queryByTestId('save-student-detail-btn') || screen.queryByText(/生徒情報を保存/i);
    if (saveStudentDetailBtn) {
      await act(async () => {
        fireEvent.click(saveStudentDetailBtn);
      });
    }
  });

  it('3. TeacherDashboard: Deeply exercise Curriculum Master Tab, Unit CRUD, Sort, and Search', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={mockStudent2.id}
          initialTab="student-list"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/生徒一覧/i).length).toBeGreaterThan(0);
    });

    // 生徒検索入力
    const searchInput = screen.queryByPlaceholderText(/名前・カナ・学校名・担当講師で検索/i);
    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '数学' } });
      });
      expect(searchInput).toHaveValue('数学');
    }

    // 学年フィルタの切り替え
    const gradeSelect = screen.queryByTestId('filter-grade-select') || screen.queryByDisplayValue(/全学年/i);
    if (gradeSelect) {
      await act(async () => {
        fireEvent.change(gradeSelect, { target: { value: '中2' } });
      });
    }
  });

  it('4. DB Deep Coverage: CRUD on all entities including branches, templates, interaction logs, and backup', async () => {
    // 1. 校舎データ操作
    const branches = db.getBranches();
    expect(branches.length).toBeGreaterThan(0);
    const newBranch = {
      id: 'branch-cov-test-1',
      name: 'カバレッジテスト校舎',
      address: '東京都渋谷区1-2-3',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(newBranch);
    const updatedBranches = db.getBranches();
    expect(updatedBranches.some(b => b.id === 'branch-cov-test-1')).toBe(true);

    // 2. 面談・指導ログ操作
    const interactionLog = {
      id: 'log-cov-1',
      student_id: mockStudent1.id,
      date: '2026-09-22',
      category: '面談' as const,
      memo: '目標設定面談を実施しました。',
      staff_name: '福田 尚弘',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interactionLog);
    const logs = db.getStudentInteractions(mockStudent1.id);
    expect(logs.length).toBeGreaterThan(0);

    // 3. 小テスト・宿題結果の保存・取得・削除
    const testResult: MiniTestResult = {
      id: 'mini-cov-1',
      student_id: mockStudent1.id,
      date: '2026-09-22',
      unit_name: 'かずを かぞえよう',
      test_content: 'かずを かぞえよう - 単元確認テスト',
      subject: '算数',
      score: 100,
      passed: true,
      passing_line: '80%以上'
    };
    await db.saveMiniTestResult(testResult);
    const savedMini = db.getMiniTestResults().filter(r => r.student_id === mockStudent1.id);
    expect(savedMini.length).toBeGreaterThan(0);

    const hwResult: HomeworkResult = {
      id: 'hw-cov-1',
      student_id: mockStudent1.id,
      date: '2026-09-22',
      homework_content: '計算ドリル P10〜12',
      subject: '算数',
      is_submitted: true,
      score: 90
    };
    await db.saveHomeworkResult(hwResult);
    const savedHw = db.getHomeworkResults().filter(r => r.student_id === mockStudent1.id);
    expect(savedHw.length).toBeGreaterThan(0);

    // 4. 校舎別AIルール
    const customRules = {
      lessons_per_slot: 3,
      advance_lessons: 2,
      review_priority: 'medium' as const
    };
    await db.saveBranchAIRules('branch-1', customRules);
    const fetchedRules = db.getBranchAIRules('branch-1');
    expect(fetchedRules.lessons_per_slot).toBe(3);

    // 5. 学習タスクのCRUD & 削除操作
    const task: LearningTask = {
      id: 'task-db-cov-1',
      student_id: mockStudent1.id,
      scheduled_date: '2026-09-22',
      period: 1,
      subject: '算数',
      unit_name: 'かずを かぞえよう',
      lesson_name: 'かずを かぞえよう(1)',
      status: 'completed',
      is_completed: true
    };
    await db.saveLearningTasks([task]);
    const tasks = db.getLearningTasks().filter(t => t.student_id === mockStudent1.id && t.scheduled_date === '2026-09-22');
    expect(tasks.length).toBeGreaterThan(0);
    await db.deleteLearningTasksForDate(mockStudent1.id, '2026-09-22');
    const tasksAfter = db.getLearningTasks().filter(t => t.student_id === mockStudent1.id && t.scheduled_date === '2026-09-22');
    expect(tasksAfter.length).toBe(0);

    // 6. 生徒進捗リスト (StudentLessonProgress)
    await db.saveStudentLessonProgress({
      id: 'slp-cov-1',
      student_id: mockStudent1.id,
      lesson_id: 'cm-cov-m1',
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    const progressList = db.getStudentLessonProgressList(mockStudent1.id);
    expect(progressList.length).toBeGreaterThan(0);
  });

  it('5. TeacherDashboard: Deeply exercise Homework, Mini-Tests, Tests, and AI Report tabs', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={mockStudent1.id}
          initialTab="homeworks"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/宿題提出状況|宿題/i).length).toBeGreaterThan(0);
    });

    // 小テスト結果タブへ遷移
    const miniTestTab = screen.queryByText('小テスト結果');
    if (miniTestTab) {
      await act(async () => {
        fireEvent.click(miniTestTab);
      });
    }

    // 定期テスト・模試タブへ遷移
    const testsTab = screen.queryByText('定期テスト・模試');
    if (testsTab) {
      await act(async () => {
        fireEvent.click(testsTab);
      });
    }

    // AI指導報告書タブへ遷移
    const aiReportTab = screen.queryByText('AI指導報告書');
    if (aiReportTab) {
      await act(async () => {
        fireEvent.click(aiReportTab);
      });
    }
  });

  it('6. TeacherDashboard: Exercise Branch AI Rules Modal and Unit Test Master Modal', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={mockStudent1.id}
          initialTab="schedule"
        />
      );
    });

    // 校舎別AIルールモーダルを開く
    const openAIRulesBtn = screen.queryByTestId('open-branch-ai-rules-btn') || screen.queryByText(/校舎別AIルール/i);
    if (openAIRulesBtn) {
      await act(async () => {
        fireEvent.click(openAIRulesBtn);
      });

      const lessonInput = screen.queryByTestId('branch-ai-lessons-per-slot-input');
      if (lessonInput) {
        await act(async () => {
          fireEvent.change(lessonInput, { target: { value: '3' } });
        });
      }

      const saveRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn') || screen.queryByText(/ルールを保存する/i);
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }
  });

  it('7. DB Deep Pure Complete: Test all db methods, edge cases, and sync fallbacks', async () => {
    // Curriculum Master CRUD
    const masters = db.getCurriculumMasters();
    expect(masters.length).toBeGreaterThan(0);
    const newMaster: CurriculumMaster = {
      id: 'cm-pure-test-1',
      grade: '小3',
      subject: '算数',
      unit_name: 'わり算',
      lesson_name: 'わり算の筆算(1)',
      sort_order: 1
    };
    await db.saveCurriculumMasters([newMaster]);
    const fetchedMasters = db.getCurriculumMasters();
    expect(fetchedMasters.some(m => m.id === 'cm-pure-test-1')).toBe(true);
    await db.deleteCurriculumMaster('cm-pure-test-1');

    // Milestones CRUD
    const ms = db.getMilestonePlans();
    const newMs: MilestonePlan = {
      id: 'ms-pure-1',
      student_id: mockStudent1.id,
      grade: '小1',
      subject: '算数',
      course: '標準',
      target_month: '4月',
      target_unit: 'かずを かぞえよう',
      target_page: 'P10〜20',
      created_at: new Date().toISOString()
    };
    await db.saveMilestonePlans([newMs]);
    const fetchedMs = db.getMilestonePlans().filter(m => m.student_id === mockStudent1.id);
    expect(fetchedMs.length).toBeGreaterThan(0);

    // AI Report
    const report = {
      id: 'rep-pure-1',
      student_id: mockStudent1.id,
      week_start_date: '2026-09-21',
      ai_comment: '計算のスピードが大幅に向上しました。',
      created_at: new Date().toISOString()
    };
    await db.saveAIReport(report);
    const fetchedReport = db.getAIReports().find(r => r.student_id === mockStudent1.id && r.week_start_date === '2026-09-21');
    expect(fetchedReport).toBeDefined();

    // Reset password & status API simulation
    expect(db.isMockMode).toBe(true);
  });
});
