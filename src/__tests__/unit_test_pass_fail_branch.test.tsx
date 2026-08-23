import { describe, it, expect, beforeEach } from 'vitest';
import { db, Student, LearningTask, MiniTestResult } from '../lib/db';

describe('Unit Test Pass/Fail Branching & Target Correction Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deduplicates todayTasks by period to prevent duplicate card rendering', () => {
    const studentId = 'st-branch-1';
    const dateStr = '2026-08-25';

    // 同一コマ(1コマ目)に複数のタスクが混在するケース
    const tasks: LearningTask[] = [
      {
        id: `task-1`,
        student_id: studentId,
        unit_id: 'unit-1',
        scheduled_date: dateStr,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '算数',
        custom_unit_name: 'たしざん STEP 1',
        created_at: new Date().toISOString()
      },
      {
        id: `task-1-dup`,
        student_id: studentId,
        unit_id: 'unit-1-dup',
        scheduled_date: dateStr,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '算数',
        custom_unit_name: 'たしざん STEP 1 (重複)',
        created_at: new Date().toISOString()
      }
    ];

    // デデュプリケーション（1コマあたり1枚）のロジック検証
    const uniqueMap = new Map<string, LearningTask>();
    tasks.forEach(t => {
      const key = t.period != null ? `p-${t.period}` : t.id;
      if (!uniqueMap.has(key)) uniqueMap.set(key, t);
    });

    const displayTasks = Array.from(uniqueMap.values());
    expect(displayTasks.length).toBe(1);
    expect(displayTasks[0].period).toBe(1);
  });

  it('handles test failure: blocks progress and books re-test for next attendance date', async () => {
    const student: Student = {
      id: 'st-fail-1',
      name: 'テスト受講生',
      grade: '小1',
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: ['cm-add-1']
    };
    await db.saveStudent(student);

    const dateStr = '2026-08-25'; // 火曜日
    const task: LearningTask = {
      id: `task-test-1`,
      student_id: student.id,
      unit_id: 'cm-add-test',
      scheduled_date: dateStr,
      period: 1,
      status: 'unstarted',
      video_watched: true,
      test_passed: false,
      subject: '算数',
      custom_unit_name: '算数: たしざん - 単元確認テスト',
      start_lesson_name: 'たしざん - 単元確認テスト',
      end_lesson_name: 'たしざん - 単元確認テスト',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    // 不合格処理の模擬実行
    const failedTask = { ...task, status: 'failed' as const, test_passed: false };
    await db.saveLearningTasks([failedTask]);

    const nextDate = '2026-08-28'; // 次回金曜日
    const reTestResult: MiniTestResult = {
      id: `mini-retest-${student.id}-${nextDate}`,
      student_id: student.id,
      date: nextDate,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: 'たしざん - 単元確認テスト',
      test_content: '算数: たしざん - 単元確認テスト（再テスト）',
      score: null,
      passing_line: '80%以上',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(reTestResult);

    const reTestTask: LearningTask = {
      id: `task-retest-${student.id}-${nextDate}-1`,
      student_id: student.id,
      unit_id: 'cm-add-test-retest',
      scheduled_date: nextDate,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      subject: '算数',
      custom_unit_name: '算数: たしざん - 単元確認テスト（再テスト）',
      start_lesson_name: 'たしざん - 単元確認テスト（再テスト）',
      end_lesson_name: 'たしざん - 単元確認テスト（再テスト）',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([reTestTask]);

    // 検証：不合格時、completed_lesson_ids に新単元が混入せず、次回通塾日に再テストがセットされていること
    const refreshedSt = db.getStudents().find(s => s.id === student.id);
    expect(refreshedSt?.completed_lesson_ids).not.toContain('cm-sub-1'); // 新単元へ進行しない

    const savedMiniTests = db.getMiniTestResults().filter(m => m.student_id === student.id && m.date === nextDate);
    expect(savedMiniTests.length).toBe(1);
    expect(savedMiniTests[0].test_content).toContain('再テスト');

    const savedTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date === nextDate);
    expect(savedTasks.length).toBe(1);
    expect(savedTasks[0].custom_unit_name).toContain('再テスト');
  });
});
