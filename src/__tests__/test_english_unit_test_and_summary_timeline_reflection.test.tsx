import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, CurriculumMaster, MiniTestResult, LearningTask } from '../lib/db';
import { 
  getLatestUnitTestStatusForSubject, 
  findNextUncompletedLessonForSubject, 
  normalizeUnitName,
  isMatchingUnitOrTest
} from '../lib/scheduler';

describe('English Unit Test and Summary Test Timeline Reflection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト');
  });

  it('scheduler: getLatestUnitTestStatusForSubject correctly extracts normalized and prefix-stripped keys', () => {
    const miniResults: MiniTestResult[] = [
      {
        id: 'mini-eng-1',
        student_id: 'std-test-eng',
        subject: '英語',
        unit_name: 'You are 〜. あなたは〜です。',
        test_content: '英語: You are 〜. あなたは〜です。 - 単元確認テスト',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-08',
        target_scope: 'individual'
      },
      {
        id: 'mini-math-sum1',
        student_id: 'std-test-eng',
        subject: '算数',
        unit_name: 'かけ算',
        test_content: '算数: まとめテスト（１）',
        score: 95,
        passed: true,
        status: 'passed',
        date: '2026-10-08',
        target_scope: 'individual'
      }
    ];

    const engStatus = getLatestUnitTestStatusForSubject({
      studentId: 'std-test-eng',
      subject: '英語',
      miniTestResults: miniResults
    });

    expect(engStatus.hasFailedUnitTest).toBe(false);
    expect(engStatus.failedUnitTest).toBeNull();
    // プレフィックス除去後の生名称
    expect(engStatus.completedUnitTestKeys.has('You are 〜. あなたは〜です。 - 単元確認テスト')).toBe(true);
    // 正規化名称
    expect(engStatus.completedUnitTestKeys.has('You are 〜. あなたは〜です。')).toBe(true);
    // 元の test_content
    expect(engStatus.completedUnitTestKeys.has('英語: You are 〜. あなたは〜です。 - 単元確認テスト')).toBe(true);

    const mathStatus = getLatestUnitTestStatusForSubject({
      studentId: 'std-test-eng',
      subject: '算数',
      miniTestResults: miniResults
    });
    expect(mathStatus.completedUnitTestKeys.has('まとめテスト（１）')).toBe(true);
  });

  it('scheduler: findNextUncompletedLessonForSubject properly skips passed unit test and summary test to next unit', () => {
    const student: Student = {
      id: 'std-scheduler-test',
      name: '進度検証生徒',
      grade: '小6',
      grade_category: 'elementary',
      school_name: 'テスト小',
      created_at: new Date().toISOString()
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-eng-1', grade: '小6', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 1', sort_order: 1 },
      { id: 'cm-eng-2', grade: '小6', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 2', sort_order: 2 },
      { id: 'cm-eng-ut', grade: '小6', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'You are 〜. あなたは〜です。 - 単元確認テスト', sort_order: 3, item_type: 'unit_test' },
      { id: 'cm-eng-next', grade: '小6', subject: '英語', unit_name: 'This is 〜. これは〜です。', lesson_name: 'STEP 1', sort_order: 4 }
    ];

    const miniResults: MiniTestResult[] = [
      {
        id: 'mini-eng-pass',
        student_id: student.id,
        subject: '英語',
        unit_name: 'You are 〜. あなたは〜です。',
        test_content: '英語: You are 〜. あなたは〜です。 - 単元確認テスト',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-08',
        target_scope: 'individual'
      }
    ];

    student.completed_lesson_ids = [
      'cm-eng-1', 
      'cm-eng-2',
      'cm-auto-check-英語-小6-You are 〜. あなたは〜です。'
    ];

    const nextLesson = findNextUncompletedLessonForSubject({
      student,
      subject: '英語',
      curriculumMasters: masters,
      miniTestResults: miniResults
    });

    // 単元テストが合格しているため、次の新単元（cm-eng-next）が選択されること
    expect(nextLesson.lessonId).toBe('cm-eng-next');
    expect(nextLesson.hasFailedUnitTest).toBe(false);
  });

  it('TeacherDashboard: Elementary continuous timeline displays ✓ 完了 for STEP 13 unit test and summary tests', async () => {
    const student: Student = {
      id: 'std-timeline-eng-reflect',
      name: 'タイムライン反映生徒',
      grade: '小6',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 2,
      day_of_week: ['mon', 'wed', 'fri'],
      selected_subjects: ['英語', '算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    // カリキュラムマスター（12個の通常レッスン + STEP 13 単元確認テスト + STEP 14 新単元）
    const masters: CurriculumMaster[] = [];
    for (let i = 1; i <= 12; i++) {
      masters.push({
        id: `cm-eng-lesson-${i}`,
        grade: '小6',
        subject: '英語',
        unit_name: 'You are 〜. あなたは〜です。',
        lesson_name: `レッスン ${i}`,
        sort_order: i
      });
      student.completed_lesson_ids!.push(`cm-eng-lesson-${i}`);
    }
    // Check Test も完了済みに設定
    student.completed_lesson_ids!.push('cm-auto-check-英語-小6-You are 〜. あなたは〜です。');

    // STEP 13 単元テスト
    masters.push({
      id: 'cm-eng-step13-ut',
      grade: '小6',
      subject: '英語',
      unit_name: 'You are 〜. あなたは〜です。',
      lesson_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      sort_order: 13,
      item_type: 'unit_test'
    });
    // STEP 14 新単元
    masters.push({
      id: 'cm-eng-step14-new',
      grade: '小6',
      subject: '英語',
      unit_name: '【復習】これまでのまとめ',
      lesson_name: 'まとめ授業',
      sort_order: 14
    });
    await db.saveCurriculumMasters(masters);
    await db.saveStudent(student);

    // 小テスト結果管理に「英語: You are 〜. あなたは〜です。 - 単元確認テスト」合格を保存
    const miniResult: MiniTestResult = {
      id: 'mini-ut-step13',
      student_id: student.id,
      subject: '英語',
      unit_name: 'You are 〜. あなたは〜です。',
      test_content: '英語: You are 〜. あなたは〜です。 - 単元確認テスト',
      score: 100,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      passing_line: '80%以上',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(miniResult);

    // STEP 14のタスクをコマ割りで作成（現在地）
    const currentTask: LearningTask = {
      id: 'task-eng-step14',
      student_id: student.id,
      subject: '英語',
      unit_id: 'cm-eng-step14-new',
      start_lesson_id: 'cm-eng-step14-new',
      end_lesson_id: 'cm-eng-step14-new',
      start_lesson_name: 'まとめ授業',
      end_lesson_name: 'まとめ授業',
      custom_unit_name: '【復習】これまでのまとめ',
      status: 'unstarted',
      scheduled_date: '2026-10-08',
      period: 1,
      day_of_week: 'thu'
    };
    await db.saveLearningTasks([currentTask]);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);

    await waitFor(() => {
      expect(screen.getAllByText(/タイムライン反映生徒/).length).toBeGreaterThan(0);
    });

    // 生徒選択
    fireEvent.click(screen.getAllByText(/タイムライン反映生徒/)[0]);

    // 年間計画（マイルストーン）タブへ切り替え
    const milestoneTab = screen.getByRole('button', { name: /年間計画|マイルストーン/i });
    fireEvent.click(milestoneTab);

    // 英語タブに切り替え
    await waitFor(() => {
      const engBtn = screen.getByRole('button', { name: /英語/ });
      fireEvent.click(engBtn);
    });

    // STEP 13 が「✓ 完了」になっていることを検証！
    await waitFor(() => {
      const item13 = screen.getByTestId('timeline-item-cm-eng-step13-ut');
      expect(item13).toBeDefined();
      expect(item13.textContent).toContain('✓ 完了');
      expect(item13.textContent).toContain('You are 〜. あなたは〜です。 - 単元確認テスト');
    });

    // STEP 14 が「現在地」または次のステップとして描画されていることを検証
    const item14 = screen.getByTestId('timeline-item-cm-eng-step14-new');
    expect(item14).toBeDefined();
    expect(item14.textContent).toContain('【復習】これまでのまとめ');

    unmount();
  });

  it('StudentDashboard: Submitting unit test score 100 automatically saves miniTestResult and updates tasks', async () => {
    const student: Student = {
      id: 'std-student-ut-test',
      name: '生徒画面合格テスト生',
      grade: '小6',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 1,
      day_of_week: ['thu'],
      selected_subjects: ['英語'],
      level: 'A',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const task: LearningTask = {
      id: 'task-student-eng-test',
      student_id: student.id,
      subject: '英語',
      custom_unit_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      start_lesson_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      status: 'unstarted',
      scheduled_date: '2026-10-08',
      period: 1,
      passing_line: '90点以上'
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(<StudentDashboard student={student} onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('unit-test-score-section-1')).toBeDefined();
    });

    // 点数入力 (100)
    const scoreInput = screen.getByTestId('task-score-input-1');
    fireEvent.change(scoreInput, { target: { value: '100' } });

    // 結果送信
    const submitBtn = screen.getByTestId('task-score-submit-btn-1');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const results = db.getMiniTestResults(student.id);
      expect(results.length).toBeGreaterThan(0);
      const ut = results.find(r => r.subject === '英語');
      expect(ut).toBeDefined();
      expect(ut?.score).toBe(100);
      expect(ut?.passed).toBe(true);
      expect(ut?.test_content).toContain('You are 〜. あなたは〜です。 - 単元確認テスト');
    });

    unmount();
  });

  it('TeacherDashboard & Scheduler: Math summary test (1) completion and failure gate properly function', async () => {
    const student: Student = {
      id: 'std-math-summary-test',
      name: '算数まとめテスト生',
      grade: '小3',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 2,
      day_of_week: ['tue', 'fri'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-math-l1', 'cm-math-l2'],
      created_at: new Date().toISOString()
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-math-l1', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算のいみ', sort_order: 1 },
      { id: 'cm-math-l2', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: '計算のしかた', sort_order: 2 },
      { id: 'cm-math-sum1', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算 - まとめテスト（１）', sort_order: 3 },
      { id: 'cm-math-sum2', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算 - まとめテスト（２）', sort_order: 4 },
      { id: 'cm-math-ut', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算 - 単元確認テスト', sort_order: 5, item_type: 'unit_test' }
    ];
    await db.saveCurriculumMasters(masters);

    // 小テスト結果管理に「算数: まとめテスト（１）」合格を記録
    const miniResult: MiniTestResult = {
      id: 'mini-math-sum1-pass',
      student_id: student.id,
      subject: '算数',
      unit_name: 'わり算',
      test_content: '算数: まとめテスト（１）',
      score: 95,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(miniResult);
    await db.saveStudent(student);

    // スケジューラーでまとめテスト（１）が完了とみなされ、次回授業がまとめテスト（２）になることを検証
    const nextLesson = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: masters,
      miniTestResults: [miniResult]
    });
    expect(nextLesson.lessonId).toBe('cm-math-sum2');

    // タイムラインのレンダリング
    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);
    await waitFor(() => {
      expect(screen.getAllByText(/算数まとめテスト生/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/算数まとめテスト生/)[0]);

    const milestoneTab = screen.getByRole('button', { name: /年間計画|マイルストーン/i });
    fireEvent.click(milestoneTab);

    await waitFor(() => {
      const sum1Item = screen.getByTestId('timeline-item-cm-math-sum1');
      expect(sum1Item).toBeDefined();
      expect(sum1Item.textContent).toContain('✓ 完了');
    });

    unmount();
  });

  it('Math 0-addition and subtraction: summary (1) pass properly advances to summary (2), then (3), then unit test, without skipping', async () => {
    const student: Student = {
      id: 'std-math-zero-test',
      name: '0の計算検証生',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 2,
      day_of_week: ['tue', 'fri'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-zero-l1', 'cm-zero-l2'],
      created_at: new Date().toISOString()
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-zero-l1', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の たしざん', sort_order: 82 },
      { id: 'cm-zero-l2', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の ひきざん', sort_order: 83 },
      { id: 'cm-zero-sum1', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の たしざんと ひきざん - まとめテスト（１）', sort_order: 84 },
      { id: 'cm-zero-sum2', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の たしざんと ひきざん - まとめテスト（２）', sort_order: 85 },
      { id: 'cm-zero-sum3', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の たしざんと ひきざん - まとめテスト（３）', sort_order: 86 },
      { id: 'cm-zero-ut', grade: '小1', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0の たしざんと ひきざん - 単元確認テスト', sort_order: 87, item_type: 'unit_test' },
      { id: 'cm-next-unit', grade: '小1', subject: '算数', unit_name: 'くりあがりのある たしざん', lesson_name: 'くりあがりの たしざん1', sort_order: 88 }
    ];
    await db.saveCurriculumMasters(masters);

    // 1. まとめテスト（１）のみ合格
    const miniResult1: MiniTestResult = {
      id: 'mini-zero-sum1-pass',
      student_id: student.id,
      subject: '算数',
      unit_name: '0の たしざんと ひきざん',
      test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
      score: 100,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(miniResult1);
    await db.saveStudent(student);

    // 単元テスト状況チェック: 単元名自体は合格キー・単元完了キーに含まれないこと
    const status1 = getLatestUnitTestStatusForSubject({
      studentId: student.id,
      subject: '算数',
      miniTestResults: [miniResult1]
    });
    expect(status1.completedUnitTestKeys.has('0の たしざんと ひきざん - まとめテスト（１）')).toBe(true);
    expect(status1.completedUnitTestKeys.has('0の たしざんと ひきざん')).toBe(false);
    expect(status1.completedUnitKeys?.has('0の たしざんと ひきざん')).toBeFalsy();

    // スケジューラー判定: 単元確認テストに飛ばず、まとめテスト（２）が次回開始授業になること！
    const next1 = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: masters,
      miniTestResults: [miniResult1]
    });
    expect(next1.lessonId).toBe('cm-zero-sum2');
    expect(next1.lessonName).toContain('まとめテスト（２）');

    // 2. まとめテスト（２）も合格
    const miniResult2: MiniTestResult = {
      id: 'mini-zero-sum2-pass',
      student_id: student.id,
      subject: '算数',
      unit_name: '0の たしざんと ひきざん',
      test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
      score: 100,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(miniResult2);

    const next2 = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: masters,
      miniTestResults: [miniResult1, miniResult2]
    });
    expect(next2.lessonId).toBe('cm-zero-sum3');
    expect(next2.lessonName).toContain('まとめテスト（３）');

    // 3. まとめテスト（３）も合格
    const miniResult3: MiniTestResult = {
      id: 'mini-zero-sum3-pass',
      student_id: student.id,
      subject: '算数',
      unit_name: '0の たしざんと ひきざん',
      test_content: '算数: 0の たしざんと ひきざん - まとめテスト（３）',
      score: 100,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(miniResult3);

    const next3 = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: masters,
      miniTestResults: [miniResult1, miniResult2, miniResult3]
    });
    expect(next3.lessonId).toBe('cm-zero-ut');
    expect(next3.lessonName).toContain('単元確認テスト');

    // 4. 単元確認テストも合格
    const miniResultUT: MiniTestResult = {
      id: 'mini-zero-ut-pass',
      student_id: student.id,
      subject: '算数',
      unit_name: '0の たしざんと ひきざん',
      test_content: '算数: 0の たしざんと ひきざん - 単元確認テスト',
      score: 100,
      passed: true,
      status: 'passed',
      date: '2026-10-08',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(miniResultUT);

    const next4 = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: masters,
      miniTestResults: [miniResult1, miniResult2, miniResult3, miniResultUT]
    });
    expect(next4.lessonId).toBe('cm-next-unit');
    expect(next4.lessonName).toContain('くりあがりのある たしざん');
  });
});
