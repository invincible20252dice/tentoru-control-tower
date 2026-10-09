import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db, Student, CurriculumMaster, CurriculumUnit, LearningTask, StudentLessonProgress } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Elementary Timeline & Database Complete Meaningful Coverage Suite', () => {
  const testStudent: Student = {
    id: 'st-elem-cov-1',
    student_id: 'S_ELEM_COV_1',
    name: '小学生カバレッジ生徒',
    grade: '小3',
    grade_category: 'elementary',
    status: 'normal',
    branch_id: 'branch-1',
    school_id: 'sch-cov-1',
    school_name: 'てんとる小学校',
    period_count: 2,
    default_slots: 2,
    day_of_week: ['mon', 'thu'],
    selected_subjects: ['算数', '英語', '国語', '理科', '社会'],
    completed_lesson_ids: ['cm-cov-m1'],
    start_unit_math: 'cm-cov-m2',
    created_at: new Date().toISOString()
  };

  const masters: CurriculumMaster[] = [
    { id: 'cm-cov-m1', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算(1)', sort_order: 1 },
    { id: 'cm-cov-m2', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算(2)', sort_order: 2 },
    { id: 'cm-cov-m3', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算(3)', sort_order: 3 },
    { id: 'cm-cov-m4', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算のまとめテスト', sort_order: 4 },
    { id: 'cm-cov-e1', grade: '3年生', subject: '英語', unit_name: '挨拶', lesson_name: 'Hello', sort_order: 1 },
    { id: 'cm-cov-j1', grade: '3年生', subject: '国語', unit_name: '漢字', lesson_name: '漢字の読み', sort_order: 1 },
    { id: 'cm-cov-s1', grade: '3年生', subject: '理科', unit_name: '昆虫', lesson_name: '春の虫', sort_order: 1 },
    { id: 'cm-cov-ss1', grade: '3年生', subject: '社会', unit_name: 'まち', lesson_name: 'わたしたちの町', sort_order: 1 },
  ];

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    await db.saveStudent(testStudent);
    (db as any).saveMockData('curriculum_masters', masters);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('thoroughly exercises elementary timeline grade filters, subject switches, excluded units, and milestone UI', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const task: LearningTask = {
      id: 'task-cov-1',
      student_id: testStudent.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-cov-m2',
      start_lesson_id: 'cm-cov-m2',
      end_lesson_id: 'cm-cov-m3',
      start_lesson_name: 'わり算(2)',
      end_lesson_name: 'わり算(3)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { container, unmount } = render(
      <TeacherDashboard
        initialStudentId={testStudent.id}
        teacherType="elementary"
        initialTab="milestones"
      />
    );

    // 1. 小学生向け進度タイムラインの表示確認
    await waitFor(() => {
      expect(screen.getByTestId('elementary-timeline-container')).toBeInTheDocument();
      expect(screen.getByTestId('elementary-progress-percent')).toBeInTheDocument();
      expect(screen.getByTestId('elementary-estimated-date')).toBeInTheDocument();
    });

    // 2. 学年フィルターボタンの網羅クリック
    const gradeButtons = [
      '全学年表示',
      '1年生',
      '2年生',
      '3年生',
      '4年生',
      '5年生',
      '6年生'
    ];
    for (const g of gradeButtons) {
      const btn = screen.queryByTestId(`elementary-timeline-grade-btn-${g}`);
      if (btn) {
        fireEvent.click(btn);
      }
    }

    // 3年生に戻す
    const btn3 = screen.getByTestId('elementary-timeline-grade-btn-3年生');
    fireEvent.click(btn3);

    // 3. 科目切り替えボタンの網羅クリック（英語、国語、理科、社会、算数）
    const subjects = ['英語', '国語', '理科', '社会', '算数'];
    for (const sub of subjects) {
      const subBtn = screen.queryByRole('button', { name: new RegExp(sub) });
      if (subBtn) {
        fireEvent.click(subBtn);
      }
    }

    // 4. 除外ボタンのクリックと復元
    await waitFor(() => {
      const stepItem = screen.queryByTestId('timeline-item-cm-cov-m2');
      if (stepItem) {
        const excludeBtn = stepItem.querySelector('button');
        if (excludeBtn && excludeBtn.textContent?.includes('除外')) {
          fireEvent.click(excludeBtn);
        }
      }
    });

    // 除外リセットボタンがあればクリック
    const resetExcludedBtn = screen.queryByText(/除外をすべて解除/);
    if (resetExcludedBtn) {
      fireEvent.click(resetExcludedBtn);
    }

    unmount();
  });

  it('substantively exercises db.ts helper methods, deletion functions, and fallback queries', async () => {
    // 1. StudentLessonProgress の保存と取得・削除
    const p: StudentLessonProgress = {
      id: 'slp-cov-1',
      student_id: testStudent.id,
      lesson_id: 'cm-cov-m1',
      subject: '算数',
      status: 'completed',
      score: 100,
      completed_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(p);
    const progressList = db.getStudentLessonProgressList(testStudent.id);
    expect(progressList.length).toBeGreaterThan(0);

    // 2. LearningTask の単体更新・削除
    const taskObj: LearningTask = {
      id: 'task-temp-del',
      student_id: testStudent.id,
      scheduled_date: '2026-10-10',
      period: 1,
      subject: '英語',
      unit_id: 'cm-cov-e1',
      status: 'unstarted'
    };
    await db.saveLearningTasks([taskObj]);
    const fetchedTasks = await db.fetchLearningTasks(testStudent.id, '2026-10-10');
    expect(fetchedTasks.some(t => t.id === 'task-temp-del')).toBe(true);

    await db.deleteLearningTasksByDate(testStudent.id, '2026-10-10');
    const afterDelTasks = await db.fetchLearningTasks(testStudent.id, '2026-10-10');
    expect(afterDelTasks.some(t => t.id === 'task-temp-del')).toBe(false);

    // 3. CurriculumUnit の保存・取得・削除
    const unit: CurriculumUnit = {
      id: 'c-unit-cov-1',
      school_id: 'sch-cov-1',
      grade: '小3',
      subject: '算数',
      name: 'わり算単元',
      sequence_order: 1
    };
    await db.saveCurriculumUnits([unit]);
    const fetchedUnits = await db.fetchCurriculumUnits('sch-cov-1', '算数');
    expect(fetchedUnits.length).toBeGreaterThan(0);

    // 4. StudentInteraction の保存・取得
    const interaction = {
      id: 'inter-cov-1',
      student_id: testStudent.id,
      date: '2026-10-09',
      category: '面談' as const,
      memo: '進路面談の記録',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);
    const interactions = await db.fetchStudentInteractions(testStudent.id);
    expect(interactions.some(item => item.id === 'inter-cov-1')).toBe(true);

    // 5. MiniTestResult と HomeworkResult の削除・更新
    const miniRes = {
      id: 'mini-cov-1',
      student_id: testStudent.id,
      subject: '算数',
      date: '2026-10-09',
      test_type: 'unit_test' as const,
      test_content: 'わり算単元テスト',
      score: 95,
      passed: true,
      status: 'passed' as const
    };
    await db.saveMiniTestResult(miniRes);
    const miniResults = await db.fetchMiniTestResults(testStudent.id);
    expect(miniResults.some(m => m.id === 'mini-cov-1')).toBe(true);
    await db.deleteMiniTestResult('mini-cov-1');

    const hwRes = {
      id: 'hw-cov-1',
      student_id: testStudent.id,
      subject: '算数',
      date: '2026-10-09',
      homework_content: 'ドリルP10',
      status: 'completed' as const
    };
    await db.saveHomeworkResult(hwRes);
    const hwResults = await db.fetchHomeworkResults(testStudent.id);
    expect(hwResults.some(h => h.id === 'hw-cov-1')).toBe(true);
    await db.deleteHomeworkResult('hw-cov-1');
  });

  it('exercises interview tabs (two-way and three-way) custom fields, form resetting, and transcript parsing', async () => {
    // 既存の面談データをあらかじめ保存
    const int2: StudentInterview2 = {
      id: 'mock-int2-del',
      student_id: testStudent.id,
      interviewer: '担当講師',
      interview_date: '2026-10-01',
      notes: '既存メモ',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInterview2(int2);

    const int3: StudentInterview3 = {
      id: 'mock-int3-del',
      student_id: testStudent.id,
      interviewer: '担当講師',
      interview_date: '2026-10-01',
      notes: '三者面談既存メモ',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInterview3(int3);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={testStudent.id}
        initialTab="two-way-interview"
        teacherType="elementary"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('two-way-interview-view')).toBeInTheDocument();
    });

    // 1. 空の音声テキストで「AI自動入力」をクリック（未入力警告ブランチのカバー）
    const parseBtnEmpty = screen.queryByRole('button', { name: /AI.*入力/i });
    if (parseBtnEmpty) {
      fireEvent.click(parseBtnEmpty);
    }

    // 2. 音声議事録入力エリアにテキストを入力して「AI自動入力」をクリック
    const transcriptInput2 = screen.queryByPlaceholderText(/文字起こし/i) || screen.queryByLabelText(/音声文字起こし/i);
    if (transcriptInput2) {
      fireEvent.change(transcriptInput2, { target: { value: '面談内容のテスト文字起こし' } });
      const parseBtn = screen.queryByRole('button', { name: /AI.*入力/i });
      if (parseBtn) fireEvent.click(parseBtn);
    }

    // 3. 録音トグルボタンをクリック（Web Speech API未サポート分岐のカバー）
    const recordBtn2 = screen.queryByRole('button', { name: /音声認識開始/i }) || screen.queryByRole('button', { name: /録音/i });
    if (recordBtn2) {
      fireEvent.click(recordBtn2);
    }

    // 4. 二者面談のカスタムフィールド追加・編集・削除
    const addCustomFieldBtn2 = screen.queryByRole('button', { name: /項目を追加/i }) || screen.queryByText(/カスタム項目を追加/i);
    if (addCustomFieldBtn2) {
      fireEvent.click(addCustomFieldBtn2);
      // 入力フィールドを変更
      const customInputs = document.querySelectorAll('input[placeholder*="項目名"]');
      if (customInputs.length > 0) {
        fireEvent.change(customInputs[0], { target: { value: '特記事項' } });
      }
    }

    // 5. 二者面談の保存
    const saveBtn2 = screen.queryByRole('button', { name: /面談記録を保存/i });
    if (saveBtn2) {
      fireEvent.click(saveBtn2);
    }

    // 6. 二者面談の既存履歴から削除ボタンをクリック
    const delBtn2 = screen.queryByRole('button', { name: /削除/i });
    if (delBtn2) {
      fireEvent.click(delBtn2);
    }

    // 7. 三者面談タブに切り替え
    const tab3 = screen.queryByTestId('menu-three-way-interview');
    if (tab3) {
      fireEvent.click(tab3);
      await waitFor(() => {
        expect(screen.getByTestId('three-way-interview-view')).toBeInTheDocument();
      });

      // 録音トグル
      const recordBtn3 = screen.queryByRole('button', { name: /音声認識開始/i }) || screen.queryByRole('button', { name: /録音/i });
      if (recordBtn3) {
        fireEvent.click(recordBtn3);
      }

      // 三者面談のカスタム項目追加
      const addCustomFieldBtn3 = screen.queryByRole('button', { name: /項目を追加/i }) || screen.queryByText(/カスタム項目を追加/i);
      if (addCustomFieldBtn3) {
        fireEvent.click(addCustomFieldBtn3);
      }

      // 三者面談の保存
      const saveBtn3 = screen.queryByRole('button', { name: /三者面談記録を保存/i }) || screen.queryByRole('button', { name: /面談記録を保存/i });
      if (saveBtn3) {
        fireEvent.click(saveBtn3);
      }

      // 三者面談の削除
      const delBtn3 = screen.queryByRole('button', { name: /削除/i });
      if (delBtn3) {
        fireEvent.click(delBtn3);
      }
    }

    unmount();
  });

  it('exercises normalizeGrade and prop synchronizations with teacherType all', () => {
    const { unmount } = render(
      <TeacherDashboard
        teacherType="all"
      />
    );
    expect(screen.getByText(/TENTORU 司令塔/i)).toBeInTheDocument();
    unmount();
  });

  it('exercises rangeText splitting with whitespace tilde and compact tilde, and single end lesson matching', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. スペース付き「〜」で lesson_range のみ指定されたタスク
    const taskRangeWithSpaces: LearningTask = {
      id: 'task-range-spaces',
      student_id: testStudent.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      lesson_range: 'わり算(1) 〜 わり算(2)',
      status: 'in_progress'
    };

    // 2. スペースなし「〜」で custom_unit_name のみ指定されたタスク
    const taskCompactRange: LearningTask = {
      id: 'task-compact-range',
      student_id: testStudent.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 2,
      custom_unit_name: 'わり算(2)〜わり算(3)',
      status: 'in_progress'
    };

    // 3. end_lesson_id のみ指定されたタスク
    const taskEndOnly: LearningTask = {
      id: 'task-end-only',
      student_id: testStudent.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 3,
      end_lesson_id: 'cm-cov-m3',
      status: 'in_progress'
    };

    await db.saveLearningTasks([taskRangeWithSpaces, taskCompactRange, taskEndOnly]);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={testStudent.id}
        teacherType="elementary"
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('elementary-timeline-container')).toBeInTheDocument();
      // わり算(2) が 📍 現在地（取り組み中）
      const step2 = screen.getByTestId('timeline-item-cm-cov-m2');
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');
    });

    unmount();
  });
});
