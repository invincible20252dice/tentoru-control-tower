import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student } from '../lib/db';

describe('Dynamic Grade Filter Options per School Category Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    const student: Student = {
      id: 'std-1',
      student_id: 'S001',
      name: '山田 太郎',
      grade: '中1',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['数学']
    };
    await db.saveStudent(student);
  });

  it('renders junior_high grade options by default', async () => {
    render(<TeacherDashboard initialStudentId="std-1" teacherType="junior_high" onBackToPortal={vi.fn()} />);

    // 「小テスト結果」タブを開く
    const minitestTab = screen.getByRole('button', { name: /小テスト結果/i });
    await act(async () => {
      fireEvent.click(minitestTab);
    });

    const gradeFilterSelect = screen.getByLabelText('学年:') as HTMLSelectElement;
    const optionLabels = Array.from(gradeFilterSelect.options).map(opt => opt.text);

    expect(optionLabels).toEqual([
      'すべての学年',
      '中学生全員',
      '中1',
      '中2',
      '中3'
    ]);
  });

  it('renders elementary grade options when teacherType is elementary', async () => {
    render(<TeacherDashboard initialStudentId="std-1" teacherType="elementary" onBackToPortal={vi.fn()} />);

    // 「宿題提出状況」タブを開く
    const homeworkTab = screen.getByRole('button', { name: /宿題提出状況/i });
    await act(async () => {
      fireEvent.click(homeworkTab);
    });

    const gradeFilterSelect = screen.getByLabelText('学年:') as HTMLSelectElement;
    const optionLabels = Array.from(gradeFilterSelect.options).map(opt => opt.text);

    expect(optionLabels).toEqual([
      'すべての学年',
      '小学生全員',
      '園児',
      '小1',
      '小2',
      '小3',
      '小4',
      '小5',
      '小6'
    ]);
  });

  it('renders high_school grade options when teacherType is high_school including 既卒', async () => {
    render(<TeacherDashboard initialStudentId="std-1" teacherType="high_school" onBackToPortal={vi.fn()} />);

    // 「小テスト結果」タブを開く
    const minitestTab = screen.getByRole('button', { name: /小テスト結果/i });
    await act(async () => {
      fireEvent.click(minitestTab);
    });

    const gradeFilterSelect = screen.getByLabelText('学年:') as HTMLSelectElement;
    const optionLabels = Array.from(gradeFilterSelect.options).map(opt => opt.text);

    expect(optionLabels).toEqual([
      'すべての学年',
      '高校生全員',
      '高1',
      '高2',
      '高3',
      '既卒'
    ]);
  });
});
