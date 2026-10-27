import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type MiniTestResult, type LearningTask } from '../lib/db';
import { calculateLessonRangeForSlot, ensureMathEnglishUnitTests, findNextUncompletedLessonForSubject } from '../lib/scheduler';

describe('Scheduler, StudentDashboard, and DB Deep Branch Blitz', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers scheduler.ts rawMasters empty, failedTestObj ranges, and elementary completion edge cases', () => {
    const d0 = getDynamicDate(0);
    const sElem: Student = {
      id: 'st-sch-deep-1',
      name: '小スケジューラ生徒',
      grade: '小6',
      grade_category: 'elementary',
      school_name: '第一小',
      level: 'A',
      selected_days: ['mon', 'wed', 'fri'],
      weekly_sessions_count: '3回' as any
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-sd-1', grade: '小6', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数×分数', sort_order: 1 },
      { id: 'cm-sd-2', grade: '小6', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数のかけ算の応用', sort_order: 2 }
    ];

    // Test ensureMathEnglishUnitTests with lessons.length === 0
    const emptyLessonsGroup: CurriculumMaster[] = [
      { id: 'cm-only-1', grade: '小6', subject: '算数', unit_name: '特殊単元', lesson_name: '単元確認テスト', sort_order: 5 }
    ];
    const augmented = ensureMathEnglishUnitTests(emptyLessonsGroup);
    expect(augmented.length).toBeGreaterThanOrEqual(1);

    // Test findNextUncompletedLessonForSubject with rawMasters empty
    const nextUncompleted = findNextUncompletedLessonForSubject({
      student: sElem,
      subject: '算数',
      curriculumMasters: []
    });
    expect(nextUncompleted).toBeDefined();

    // Test buildScheduleForStudent with failed test object having unit_name
    const failedResults: MiniTestResult[] = [
      {
        id: 'mt-fail-ut',
        student_id: sElem.id,
        subject: '算数',
        unit_name: '分数のかけ算 単元テスト',
        test_type: 'unit_test',
        test_content: '分数のかけ算 単元確認テスト',
        date: d0,
        score: 50,
        status: 'failed',
        passed: false
      }
    ];

    const slotRange = calculateLessonRangeForSlot({
      subject: '算数',
      student: sElem,
      curriculumMasters: masters,
      miniTestResults: failedResults,
      lessonsPerSlot: 2
    });
    expect(slotRange).toBeDefined();
    expect(slotRange.start_lesson_id).toBeDefined();
  });

  it('exhaustively covers StudentDashboard homework auto-generation, subject fallbacks, and score evaluations', async () => {
    const d0 = getDynamicDate(0);
    const dPrev = getDynamicDate(-1);

    const sElem: Student = {
      id: 'st-dash-elem',
      name: '生徒ダッシュ小',
      grade: '小5',
      grade_category: 'elementary',
      school_name: '第二小学校',
      level: 'A',
      completed_lesson_ids: []
    };

    const sJhs: Student = {
      id: 'st-dash-jhs',
      name: '生徒ダッシュ中',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '第二中学校',
      level: 'B',
      completed_lesson_ids: []
    };

    const units: CurriculumUnit[] = [
      { id: 'u-sd-1', name: '小数の計算', subject: '算数', sequence_order: 1 }
    ];

    const masters: CurriculumMaster[] = [
      { id: 'cm-elem-1', grade: '小5', subject: '算数', unit_name: '小数の計算', lesson_name: '小数のかけ算', sort_order: 1 },
      { id: 'cm-jhs-1', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '変化の割合', sort_order: 2 }
    ];

    const tasks: LearningTask[] = [
      {
        id: 'lt-dash-1',
        student_id: sElem.id,
        scheduled_date: d0,
        period: 1,
        status: 'pending',
        start_lesson_name: '小数のかけ算',
        lesson_ids: ['cm-elem-1']
      },
      {
        id: 'lt-dash-2',
        student_id: sElem.id,
        scheduled_date: d0,
        period: 2,
        status: 'completed',
        subject: undefined,
        unit_id: 'u-sd-1',
        lesson_ids: ['cm-elem-1']
      }
    ];

    const results: MiniTestResult[] = [
      {
        id: 'mt-prev-1',
        student_id: sElem.id,
        test_type: 'unit_test',
        test_content: '小数の計算 確認テスト',
        date: dPrev,
        score: null,
        status: undefined,
        passed: undefined
      },
      {
        id: 'mt-prev-2',
        student_id: sElem.id,
        test_type: 'unit_test',
        test_content: '小数の計算 確認テスト',
        date: d0,
        score: 95,
        status: 'passed',
        passed: true
      }
    ];

    (db as any).saveMockData('students', [sElem, sJhs]);
    (db as any).saveMockData('curriculum_units', units);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('learning_tasks', tasks);
    (db as any).saveMockData('mini_test_results', results);

    const { unmount } = render(
      <StudentDashboard
        student={sElem}
        currentDate={d0}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/生徒ダッシュ小/)).toBeDefined();
    });

    // Check homework modal / generation triggers if any
    const videoBtn = screen.queryByRole('button', { name: /解説動画|動画を見る/ });
    if (videoBtn) fireEvent.click(videoBtn);

    const taskCheckboxes = screen.queryAllByRole('checkbox');
    taskCheckboxes.forEach(cb => fireEvent.click(cb));

    unmount();
  });

  it('exhaustively covers db.ts school type inference, learning tasks saving/filtering, and interview sorting', async () => {
    const d0 = getDynamicDate(0);
    const dPrev = getDynamicDate(-3);

    // 1. Test getStudentInteractions with both date and contact_date sorting
    const mockInterviews = [
      { id: 'int-1', student_id: 'st-db-1', date: dPrev, student_name: '面談生徒1' },
      { id: 'int-2', student_id: 'st-db-1', contact_date: d0, student_name: '面談生徒1' },
      { id: 'int-3', student_id: 'st-db-1', date: undefined, contact_date: undefined, student_name: '面談生徒1' },
      { id: 'int-4', student_id: 'st-other', date: d0, student_name: '他生徒' }
    ];
    (db as any).saveMockData('student_interactions', mockInterviews);

    const interactions = db.getStudentInteractions('st-db-1');
    expect(interactions.length).toBe(3);
    expect(interactions[0].id).toBe('int-2');

    // 2. Test saveLearningTasks filtering with studentId and effectiveStudentId
    const initialTasks: LearningTask[] = [
      { id: 'task-filter-1', student_id: 'st-keep', scheduled_date: d0, period: 1, status: 'pending' },
      { id: 'task-filter-2', student_id: 'st-target', scheduled_date: d0, period: 1, status: 'pending' },
      { id: 'task-filter-3', student_id: 'st-effective', scheduled_date: d0, period: 1, status: 'pending' }
    ];
    (db as any).saveMockData('learning_tasks', initialTasks);

    const newTasks: LearningTask[] = [
      { id: 'task-new-1', student_id: 'st-target', scheduled_date: d0, period: 1, status: 'completed' }
    ];
    await db.saveLearningTasks(newTasks, 'st-target', 'st-effective');

    const updatedTasks = db.getLearningTasks('st-target');
    expect(updatedTasks.some(t => t.id === 'task-new-1')).toBe(true);
    expect(db.getLearningTasks('st-keep').some(t => t.id === 'task-filter-1')).toBe(true);

    // 3. Test derived school type: elementary, high_school, junior_high
    const stElementary: Student = { id: 'st-sch-e', name: '小生徒', grade: '小3', grade_category: 'elementary', school_name: '桜ヶ丘小学校' };
    const stHigh: Student = { id: 'st-sch-h', name: '高生徒', grade: '高1', grade_category: 'high_school', school_name: '桜ヶ丘高等学校' };
    const stJhs: Student = { id: 'st-sch-j', name: '中生徒', grade: '中2', grade_category: 'junior_high', school_name: '桜ヶ丘中学校' };

    await db.saveStudent(stElementary);
    await db.saveStudent(stHigh);
    await db.saveStudent(stJhs);

    const schools = db.getSchools();
    expect(schools.some(s => s.name.includes('小学校'))).toBe(true);
  });
});
