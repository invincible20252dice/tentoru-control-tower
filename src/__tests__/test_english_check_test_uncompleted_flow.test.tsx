import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { ensureMathEnglishUnitTests, findNextUncompletedLessonForSubject } from '../lib/scheduler';
import { CurriculumMaster, Student, LearningTask } from '../types';

describe('English Check Test & Review Lessons Uncompleted Flow Specification', () => {
  const todayStr = '2026-10-07';

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const englishMasters: CurriculumMaster[] = [
    {
      id: 'cm-eng-1',
      grade: '小5',
      subject: '英語',
      unit_name: 'You are 〜. あなたは〜です。',
      lesson_name: 'STEP 1: You are 〜.',
      sort_order: 1
    },
    {
      id: 'cm-eng-2',
      grade: '小5',
      subject: '英語',
      unit_name: 'You are 〜. あなたは〜です。',
      lesson_name: 'STEP 2: Are you 〜?',
      sort_order: 2
    }
  ];

  it('1. 英語コマ（Check Test）: 生徒のcompleted_lesson_idsに誤混入していても、初期状態では「✅ 受講完了」にならず「🎯 完了にする」ボタンで描画されること', async () => {
    const processed = ensureMathEnglishUnitTests(englishMasters);
    await db.saveCurriculumMasters(processed);

    const checkTestItem = processed.find(m => m.lesson_name.toLowerCase().includes('check test'));
    expect(checkTestItem).toBeDefined();

    // 生徒データ: 過去の誤処理等で Check Test の ID や名前が completed_lesson_ids に先行混入しているケース
    const mockStudent: Student = {
      id: 'std-eng-check-1',
      student_id: 'std-eng-check-1',
      name: '英語受講生',
      grade: '小5',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['英語'],
      selected_days: ['wednesday'],
      // 先行混入データ
      completed_lesson_ids: ['cm-eng-1', 'cm-eng-2', checkTestItem!.id, 'Check Test']
    };
    await db.saveStudent(mockStudent);

    // 未受講タスク（英語 Check Test コマ）
    const checkTask: LearningTask = {
      id: 'task-eng-check-today',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '英語',
      unit_id: checkTestItem!.id,
      custom_unit_name: 'You are 〜. あなたは〜です。 - Check Test',
      start_lesson_name: 'Check Test',
      end_lesson_name: 'Check Test',
      lesson_range: 'You are 〜. あなたは〜です。 - Check Test',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      completed_lesson_ids: [] // まだこのコマでは受講していない！
    };
    await db.saveLearningTasks([checkTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayStr}
        />
      );
    });

    // 画面に英語の Check Test が表示されていることを確認
    await waitFor(() => {
      expect(screen.getByTestId('period-row-1')).toBeInTheDocument();
      expect(screen.getAllByText(/Check Test/).length).toBeGreaterThan(0);
    });

    // 重要検証: 未受講コマであるため、最初から「✅ 受講完了」バッジが表示されてはならない！
    expect(screen.queryByTestId('step-done-badge-1-0')).not.toBeInTheDocument();

    // 重要検証: 「🎯 完了にする」ボタンが初期状態で表示されていること！
    const completeBtn = screen.getByTestId('step-complete-btn-1-0');
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn).toHaveTextContent('🎯 完了にする');

    // 下部のアクションボタンも「この授業を完了にする」として表示されていること
    const taskActionBtn = screen.getByTestId('complete-task-btn-1');
    expect(taskActionBtn).toBeInTheDocument();
    expect(taskActionBtn).toHaveTextContent(/(この授業を完了にする|学習をスタート！)/);
  });

  it('2. 英語コマ（Check Test）: 生徒が「🎯 完了にする」をクリックすると「✅ 受講完了」に切り替わりコマ完了となること', async () => {
    const processed = ensureMathEnglishUnitTests(englishMasters);
    await db.saveCurriculumMasters(processed);

    const checkTestItem = processed.find(m => m.lesson_name.toLowerCase().includes('check test'));
    const mockStudent: Student = {
      id: 'std-eng-check-2',
      student_id: 'std-eng-check-2',
      name: '英語受講生2',
      grade: '小5',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['英語'],
      selected_days: ['wednesday'],
      completed_lesson_ids: ['cm-eng-1', 'cm-eng-2']
    };
    await db.saveStudent(mockStudent);

    const checkTask: LearningTask = {
      id: 'task-eng-check-today-2',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '英語',
      unit_id: checkTestItem!.id,
      custom_unit_name: 'You are 〜. あなたは〜です。 - Check Test',
      start_lesson_name: 'Check Test',
      end_lesson_name: 'Check Test',
      lesson_range: 'Check Test',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([checkTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayStr}
        />
      );
    });

    const stepBtn = await screen.findByTestId('step-complete-btn-1-0');
    expect(stepBtn).toBeInTheDocument();

    // クリック実行！
    await act(async () => {
      fireEvent.click(stepBtn);
    });

    // 「✅ 受講完了」バッジに切り替わること
    await waitFor(() => {
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
      expect(screen.getByTestId('step-done-badge-1-0')).toHaveTextContent('✅ 受講完了');
    });

    // 全ステップ完了により「合格完了！」バッジが表示されること
    await waitFor(() => {
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });
  });

  it('3. 英語コマ（Check Test）: 下部の「この授業を完了にする」ボタンでも一括完了できること', async () => {
    const processed = ensureMathEnglishUnitTests(englishMasters);
    await db.saveCurriculumMasters(processed);

    const checkTestItem = processed.find(m => m.lesson_name.toLowerCase().includes('check test'));
    const mockStudent: Student = {
      id: 'std-eng-check-3',
      student_id: 'std-eng-check-3',
      name: '英語受講生3',
      grade: '小5',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['英語'],
      selected_days: ['wednesday'],
      completed_lesson_ids: ['cm-eng-1', 'cm-eng-2']
    };
    await db.saveStudent(mockStudent);

    const checkTask: LearningTask = {
      id: 'task-eng-check-today-3',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '英語',
      unit_id: checkTestItem!.id,
      custom_unit_name: 'You are 〜. あなたは〜です。 - Check Test',
      start_lesson_name: 'Check Test',
      end_lesson_name: 'Check Test',
      lesson_range: 'Check Test',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([checkTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayStr}
        />
      );
    });

    const completeTaskBtn = await screen.findByTestId('complete-task-btn-1');
    expect(completeTaskBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(completeTaskBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
    });
  });

  it('4. スケジューラ側: 完了済みレッスン（cm-eng-1）は保護され、未完了タスクがあっても完了済みレッスンをスキップして正しい未完了位置（cm-eng-2）が特定されること', () => {
    const processed = ensureMathEnglishUnitTests(englishMasters);

    const mockStudent: Student = {
      id: 'std-eng-sched-1',
      name: 'スケジューラ検証生徒',
      grade: '小5',
      level: 'B',
      selected_subjects: ['英語'],
      // cm-eng-1 は既に完了している
      completed_lesson_ids: ['cm-eng-1']
    };

    // 未完了タスクとして cm-eng-2 以降が割り当てられている
    const currentIncompleteTask: LearningTask = {
      id: 'task-eng-slot',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '英語',
      start_lesson_id: 'cm-eng-2',
      end_lesson_id: 'cm-eng-2',
      start_lesson_name: 'STEP 2: Are you 〜?',
      end_lesson_name: 'STEP 2: Are you 〜?',
      status: 'unstarted',
      completed_lesson_ids: []
    };

    const nextLesson = findNextUncompletedLessonForSubject({
      student: mockStudent,
      subject: '英語',
      tasks: [currentIncompleteTask],
      curriculumMasters: processed
    });

    // cm-eng-1（完了済み）に巻き戻らず、未完了の cm-eng-2 が返ること！
    expect(nextLesson.lessonId).toBe('cm-eng-2');
    expect(nextLesson.lessonName).toContain('STEP 2');
  });

  it('5. 生徒完了データ保護: 画面ロード時に生徒の過去の受講完了ID（cm-eng-1, cm-eng-2）が消去されず安全に保持されること', async () => {
    const processed = ensureMathEnglishUnitTests(englishMasters);
    await db.saveCurriculumMasters(processed);

    const checkTestItem = processed.find(m => m.lesson_name.toLowerCase().includes('check test'));

    const mockStudent: Student = {
      id: 'std-eng-sanitize-1',
      student_id: 'std-eng-sanitize-1',
      name: '受講生保護検証',
      grade: '小5',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['英語'],
      selected_days: ['wednesday'],
      // 受講完了済みのレッスン
      completed_lesson_ids: ['cm-eng-1', 'cm-eng-2']
    };
    await db.saveStudent(mockStudent);

    const checkTask: LearningTask = {
      id: 'task-eng-sanitize-today',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '英語',
      unit_id: checkTestItem!.id,
      custom_unit_name: 'You are 〜. あなたは〜です。 - Check Test',
      start_lesson_name: 'Check Test',
      end_lesson_name: 'Check Test',
      lesson_range: 'You are 〜. あなたは〜です。 - Check Test',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([checkTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayStr}
        />
      );
    });

    await waitFor(() => {
      const savedStudent = db.getStudent(mockStudent.id);
      expect(savedStudent).toBeDefined();
      // 過去完了済みのレッスン（cm-eng-1, cm-eng-2）は安全に維持されていること
      expect(savedStudent?.completed_lesson_ids).toContain('cm-eng-1');
      expect(savedStudent?.completed_lesson_ids).toContain('cm-eng-2');
    });
  });

  it('6. 算数・国語との統一仕様: 算数のまとめテストコマでも同様に初期状態は「🎯 完了にする」で描画され、クリックで完了になること', async () => {
    const mathMasters: CurriculumMaster[] = [
      { id: 'cm-m-1', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数のかけ算(1)', sort_order: 1 }
    ];
    const processedMath = ensureMathEnglishUnitTests(mathMasters);
    await db.saveCurriculumMasters(processedMath);

    const sum1 = processedMath.find(m => m.lesson_name.includes('まとめテスト（１）'));
    expect(sum1).toBeDefined();

    const mockStudent: Student = {
      id: 'std-math-review-1',
      student_id: 'std-math-review-1',
      name: '算数受講生',
      grade: '小5',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['算数'],
      selected_days: ['wednesday'],
      completed_lesson_ids: ['cm-m-1', sum1!.id] // 誤混入
    };
    await db.saveStudent(mockStudent);

    const mathReviewTask: LearningTask = {
      id: 'task-math-sum-today',
      student_id: mockStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '算数',
      unit_id: sum1!.id,
      custom_unit_name: '分数のかけ算 - まとめテスト（１）',
      start_lesson_name: 'まとめテスト（１）',
      end_lesson_name: 'まとめテスト（１）',
      lesson_range: 'まとめテスト（１）',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([mathReviewTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayStr}
        />
      );
    });

    // 初期状態では「🎯 完了にする」ボタンが表示されること（✅ 受講完了ではない）
    const stepBtn = await screen.findByTestId('step-complete-btn-1-0');
    expect(stepBtn).toBeInTheDocument();
    expect(screen.queryByTestId('step-done-badge-1-0')).not.toBeInTheDocument();

    // クリックで受講完了になること
    await act(async () => {
      fireEvent.click(stepBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toBeInTheDocument();
    });
  });
});
