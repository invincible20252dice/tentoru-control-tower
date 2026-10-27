import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { Student, LearningTask, CurriculumUnit, HomeworkResult } from '../types';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('StudentDashboard Extreme Branch Perfection Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('covers remedial tasks, curriculumUnits fallback, and default task names in getDisplayStepsForTask', async () => {
    const todayStr = getDynamicDateStr(0);
    const student: Student = {
      id: 'st-student-extreme-1',
      student_id: 'SE001',
      name: 'やり直し検証生徒',
      grade: '小3',
      status: 'normal',
      branch_id: 'branch-1',
      selected_days: ['tuesday', 'friday'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const unit: CurriculumUnit = {
      id: 'cu-fallback-unit-1',
      school_id: 'sch-1',
      subject: '算数',
      name: 'フォールバック単元名',
      sequence_order: 1
    };
    (db as any).saveMockData('curriculum_units', [unit]);

    // 1. Task with remedial custom_unit_name
    const taskRemedial: LearningTask = {
      id: 'task-remedial-1',
      student_id: student.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '算数',
      custom_unit_name: '【復習】かけ算九九ーやり直しー',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    // 2. Task with unit_id matching curriculumUnits fallback
    const taskFallbackUnit: LearningTask = {
      id: 'task-fallback-1',
      student_id: student.id,
      scheduled_date: todayStr,
      period: 2,
      subject: '算数',
      unit_id: 'cu-fallback-unit-1',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    // 3. Task with pure default name
    const taskDefaultName: LearningTask = {
      id: 'task-default-1',
      student_id: student.id,
      scheduled_date: todayStr,
      period: 3,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    await db.saveLearningTasks([taskRemedial, taskFallbackUnit, taskDefaultName]);

    const { unmount } = render(
      <StudentDashboard
        student={student}
        initialDate={todayStr}
        onBackToPortal={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-row-1')).toHaveTextContent('【復習】かけ算九九ーやり直しー');
      expect(screen.getByTestId('period-row-2')).toHaveTextContent('フォールバック単元名');
      expect(screen.getByTestId('period-row-3')).toHaveTextContent('授業');
    });

    unmount();
  });

  it('covers homework auto-generation with unit test skip, elementary/jhs subject logic, and completion buttons', async () => {
    const todayStr = getDynamicDateStr(0);
    const jhsStudent: Student = {
      id: 'st-jhs-hw-auto',
      student_id: 'JH001',
      name: '中学生宿題自動生成生徒',
      grade: '中1',
      status: 'normal',
      branch_id: 'branch-1',
      selected_days: ['monday', 'thursday'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(jhsStudent);

    // 1. UnitTest task (should skip homework auto-generation)
    const taskUT: LearningTask = {
      id: 'task-ut-skip',
      student_id: jhsStudent.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '数学',
      start_lesson_name: '正負の数 - 単元確認テスト',
      custom_unit_name: '正負の数 - 単元テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    // 2. Normal task with custom_unit_name (should trigger homework auto-generation on complete)
    const taskNormal: LearningTask = {
      id: 'task-normal-complete',
      student_id: jhsStudent.id,
      scheduled_date: todayStr,
      period: 2,
      subject: '数学',
      custom_unit_name: '文字と式(1)',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    await db.saveLearningTasks([taskUT, taskNormal]);

    const { unmount } = render(
      <StudentDashboard
        student={jhsStudent}
        initialDate={todayStr}
        onBackToPortal={() => {}}
      />
    );

    // Complete normal task
    await waitFor(() => {
      const completeBtn = screen.getByTestId('complete-task-btn-2');
      expect(completeBtn).toBeInTheDocument();
      fireEvent.click(completeBtn);
    });

    await waitFor(() => {
      const hwResults = db.getHomeworkResults();
      // Should have generated homework for taskNormal
      const generated = hwResults.find(h => h.student_id === jhsStudent.id);
      expect(generated).toBeDefined();
      expect(generated?.subject).toBe('数学');
    });

    unmount();
  });

  it('covers invalid base date fallback and sorting in StudentDashboard', async () => {
    const student: Student = {
      id: 'st-invalid-date-fallback',
      student_id: 'ID001',
      name: '無効日付フォールバック生徒',
      grade: '小6',
      status: 'normal',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // Render with invalid date string like 'not-a-valid-date'
    const { unmount } = render(
      <StudentDashboard
        student={student}
        initialDate="not-a-valid-date"
        onBackToPortal={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/無効日付フォールバック生徒/)).toBeInTheDocument();
    });

    unmount();
  });
});
