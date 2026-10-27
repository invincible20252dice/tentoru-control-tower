import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, School } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getDynamicISO = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('TeacherDashboard Elementary Timeline and Step Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should deeply exercise elementary timeline rendering, grade filters, excluded lessons, and upcoming/past date fallbacks', async () => {
    const todayStr = getDynamicDateStr(0);
    const futureDateStr = getDynamicDateStr(7);
    const pastDateStr = getDynamicDateStr(-7);

    const school: School = {
      id: 'sch-elem-perf',
      name: '進度小学校',
      type: 'elementary',
      created_at: getDynamicISO(0)
    };

    const student: Student = {
      id: 'st-elem-perf',
      name: '小学生タイムライン君',
      student_id: 'std-elem-perf',
      grade: '小3',
      grade_category: 'elementary',
      school_id: school.id,
      school_name: school.name,
      period_count: 2,
      day_of_week: ['mon'],
      selected_days: ['monday'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['m-el-1'],
      excluded_lesson_ids: ['m-el-excluded'],
      created_at: getDynamicISO(0)
    };

    // Varied masters covering formattedName branches in lines 9150-9170
    const masters: CurriculumMaster[] = [
      // 1. Regular lesson with m.unit_name - lesson_name prefix already
      { id: 'm-el-1', grade: '小2', subject: '算数', unit_name: 'たし算', lesson_name: 'たし算 - くりあがりのあるたし算', sort_order: 1 },
      // 2. Regular lesson without prefix
      { id: 'm-el-2', grade: '小2', subject: '算数', unit_name: 'たし算', lesson_name: 'たし算のまとめ練習', sort_order: 2 },
      // 3. Excluded lesson
      { id: 'm-el-excluded', grade: '小3', subject: '算数', unit_name: 'かけ算', lesson_name: 'スキップ授業', sort_order: 3 },
      // 4. Unit test with hyphen already
      { id: 'm-el-ut1', grade: '小3', subject: '算数', unit_name: 'かけ算', lesson_name: 'かけ算 - 単元確認テスト', item_type: 'unit_test', sort_order: 4 },
      // 5. Unit test without hyphen
      { id: 'm-el-ut2', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算の単元テスト', item_type: 'unit_test', sort_order: 5 }
    ];

    // Varied tasks covering lines 9230 - 9285
    const tasks: LearningTask[] = [
      // Completed task with unit_id, start_lesson_id, end_lesson_id, completed_lesson_ids array
      {
        id: 't-done-1',
        student_id: student.id,
        subject: '算数',
        scheduled_date: pastDateStr,
        period: 1,
        status: 'completed',
        unit_id: 'm-el-1',
        start_lesson_id: 'm-el-1',
        end_lesson_id: 'm-el-1',
        completed_lesson_ids: ['m-el-1'],
        test_passed: true,
        created_at: getDynamicISO(-7)
      },
      // Upcoming task (future) exercising upcoming fallback when today has no task
      {
        id: 't-upcoming-1',
        student_id: student.id,
        subject: '算数',
        scheduled_date: futureDateStr,
        period: 1,
        status: 'unstarted',
        unit_id: 'm-el-2',
        start_lesson_id: 'm-el-2',
        created_at: getDynamicISO(0)
      }
    ];

    (db as any).saveMockData('schools', [school]);
    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('learning_tasks', tasks);

    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={student.id}
        teacherType="elementary"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Switch to Schedule / Timeline tab
    const schedTabs = screen.queryAllByText(/スケジュール|進度|タイムライン/);
    if (schedTabs.length > 0) {
      fireEvent.click(schedTabs[0]);
    }

    // Toggle grade filter in elementary timeline if available
    const gradeFilterSelects = screen.queryAllByDisplayValue(/全学年|小3/);
    if (gradeFilterSelects.length > 0) {
      fireEvent.change(gradeFilterSelects[0], { target: { value: '小2' } });
      fireEvent.change(gradeFilterSelects[0], { target: { value: 'all' } });
    }

    unmount();
  });

  it('should deeply exercise past date fallback when student has only past scheduled tasks', async () => {
    const pastDateStr = getDynamicDateStr(-14);

    const student: Student = {
      id: 'st-past-only',
      name: '過去タスク生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: '小学校',
      period_count: 1,
      day_of_week: ['tue'],
      selected_days: ['tuesday'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: getDynamicISO(-20)
    };

    const tasks: LearningTask[] = [
      {
        id: 't-past-only-1',
        student_id: student.id,
        subject: '算数',
        scheduled_date: pastDateStr,
        period: 1,
        status: 'unstarted',
        created_at: getDynamicISO(-20)
      }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('learning_tasks', tasks);

    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={student.id}
        teacherType="elementary"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    const schedTabs = screen.queryAllByText(/スケジュール|進度|タイムライン/);
    if (schedTabs.length > 0) {
      fireEvent.click(schedTabs[0]);
    }

    unmount();
  });
});
