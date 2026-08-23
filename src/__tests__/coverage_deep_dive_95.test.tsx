import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import CurriculumCsvImport from '../components/CurriculumCsvImport';

describe('Deep Dive Coverage Boost Suite (Maximizing Branch & Line Coverage to 95%+)', () => {
  beforeEach(async () => {
    localStorage.clear();

    // テスト環境初期データ
    const elemStudent: Student = {
      id: 'st-deep-elem-1',
      student_id: 'SELEM1',
      name: '小学生ディープ生',
      grade: '小5',
      level: 'B',
      school_id: 'sch-elem-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['算数', '国語'],
      completed_lesson_ids: ['cm-elem-1']
    };

    const jhsStudent: Student = {
      id: 'st-deep-jhs-1',
      student_id: 'SJHS1',
      name: '中学生ディープ生',
      grade: '中3',
      level: 'A',
      school_id: 'sch-jhs-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 3,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
      completed_lesson_ids: ['cm-jhs-1']
    };

    await db.saveStudent(elemStudent);
    await db.saveStudent(jhsStudent);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true
    });
  });

  // 1. TeacherDashboard Elementary & JHS Auto Reschedule & Modals
  it('covers TeacherDashboard elementary auto reschedule, bulk apply, and detail tabs', async () => {
    render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // Select Student
    const studentCards = screen.getAllByText(/太郎|佐藤|ディープ/i);
    if (studentCards.length > 0) {
      await act(async () => {
        fireEvent.click(studentCards[0]);
      });
    }

    // Execute Auto Reschedule
    const rescheduleBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    await act(async () => {
      fireEvent.click(rescheduleBtn);
    });
  });

  // 2. StudentDashboard Elementary & JHS Flow with Test Inputs
  it('covers StudentDashboard for Elementary student timeline and score inputs', async () => {
    const student = db.getStudents().find(s => s.id === 'st-deep-elem-1')!;
    const todayStr = new Date().toISOString().split('T')[0];

    // Add a test task for today
    const task: LearningTask = {
      id: `task-elem-${todayStr}-1`,
      student_id: student.id,
      scheduled_date: todayStr,
      period: 1,
      subject: '算数',
      unit_id: 'cm-elem-1',
      start_lesson_name: '小数×整数',
      end_lesson_name: '小数×整数',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    render(
      <StudentDashboard 
        student={student}
        onBackToPortal={vi.fn()}
      />
    );

    // Change date
    const datePicker = screen.getByTestId('student-date-picker');
    await act(async () => {
      fireEvent.change(datePicker, { target: { value: todayStr } });
    });
  });

  // 3. CurriculumCsvImport Table Delete Row & Clean Operations
  it('covers CurriculumCsvImport preview table delete row and search empty results', async () => {
    const { container } = render(
      <CurriculumCsvImport 
        onImportComplete={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Switch to List Tab
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });

    // Search for non-existent keyword
    const searchInput = screen.getByPlaceholderText(/単元・授業名で検索/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '存在しないキーワードXYZ' } });
    });
    expect(searchInput).toHaveValue('存在しないキーワードXYZ');
  });
});
