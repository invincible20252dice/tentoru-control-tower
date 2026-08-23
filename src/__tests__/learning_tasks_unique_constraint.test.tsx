import { describe, it, expect, beforeEach } from 'vitest';
import { db, LearningTask, HomeworkResult, MiniTestResult } from '../lib/db';

describe('LearningTasks Unique Constraint and Safe Save Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('handles multiple tasks with identical unit_id on the same date without unique constraint errors', async () => {
    const studentId = 'st-dup-1';
    const dateStr = '2026-08-25';

    // 同日・同一単元（unit_id）の複数コマタスク
    const tasks: LearningTask[] = [
      {
        id: `task-${studentId}-${dateStr}-1`,
        student_id: studentId,
        unit_id: 'unit-same-101', // 同一の unit_id
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
        id: `task-${studentId}-${dateStr}-2`,
        student_id: studentId,
        unit_id: 'unit-same-101', // 同一の unit_id
        scheduled_date: dateStr,
        period: 2,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '算数',
        custom_unit_name: 'たしざん STEP 2',
        created_at: new Date().toISOString()
      }
    ];

    // 削除 ➔ 再登録フローの検証
    await db.deleteLearningTasksForDate(studentId, dateStr);
    const saved = await db.saveLearningTasks(tasks);

    expect(saved).toBeDefined();
    expect(saved.length).toBe(2);

    const fetched = db.getLearningTasks().filter(t => t.student_id === studentId && t.scheduled_date === dateStr);
    expect(fetched.length).toBe(2);
    expect(fetched[0].period).toBe(1);
    expect(fetched[1].period).toBe(2);
  });

  it('guarantees simultaneous save for homework, tests, and tasks for a student', async () => {
    const studentId = 'st-dup-2';
    const dateStr = '2026-08-25';

    const tasks: LearningTask[] = [
      {
        id: `task-${studentId}-${dateStr}-1`,
        student_id: studentId,
        unit_id: 'unit-eng-1',
        scheduled_date: dateStr,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '英語',
        custom_unit_name: 'You are ~. あなたは〜です。',
        created_at: new Date().toISOString()
      }
    ];

    const hw: HomeworkResult = {
      id: `hw-${studentId}-${dateStr}-1`,
      student_id: studentId,
      date: dateStr,
      subject: '英語',
      homework_type: 'drill_2nd',
      homework_content: '英語: You are ~. あなたは〜です。 （2回目演習）',
      homework_deadline: '2026-08-28',
      status: 'incomplete',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };

    const miniTest: MiniTestResult = {
      id: `mini-${studentId}-${dateStr}-1`,
      student_id: studentId,
      date: dateStr,
      subject: '英語',
      test_type: 'unit_test',
      unit_name: 'You are ~.',
      test_content: '英語: You are ~. 単元確認テスト',
      score: null,
      passing_line: '80%以上',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };

    await db.deleteLearningTasksForDate(studentId, dateStr);
    await db.saveLearningTasks(tasks);
    await db.saveHomeworkResult(hw);
    await db.saveMiniTestResult(miniTest);

    const savedTasks = db.getLearningTasks().filter(t => t.student_id === studentId && t.scheduled_date === dateStr);
    const savedHws = db.getHomeworkResults().filter(h => h.student_id === studentId && h.date === dateStr);
    const savedTests = db.getMiniTestResults().filter(m => m.student_id === studentId && m.date === dateStr);

    expect(savedTasks.length).toBe(1);
    expect(savedHws.length).toBe(1);
    expect(savedTests.length).toBe(1);

    expect(savedHws[0].homework_content).toContain('2回目演習');
    expect(savedTests[0].test_content).toContain('単元確認テスト');
  });
});
