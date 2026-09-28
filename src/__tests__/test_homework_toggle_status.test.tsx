import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  Branch,
  HomeworkResult
} from '../types';

describe('Homework Status Toggle Button Suite', () => {
  const mockBranches: Branch[] = [
    { id: 'branch-hw-1', name: '宿題校舎', code: 'B_HW_1', email: 'hw@tentoru.jp', status: 'active', created_at: new Date().toISOString() }
  ];

  const mockSchools: SchoolMaster[] = [
    { id: 'sch-hw-1', name: '宿題中学校', type: 'junior_high' }
  ];

  const mockStudent: Student = {
    id: 'std-hw-1',
    student_id: 'S_HW_1',
    name: '宿題 太郎',
    grade: '中2',
    status: 'normal',
    level: 'A',
    branch_id: 'branch-hw-1',
    classroom: '宿題校舎',
    school_id: 'sch-hw-1',
    school_name: '宿題中学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '中2',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['数学', '英語'],
    period_count: 2,
    default_slots: 2
  };

  const initialHomework1: HomeworkResult = {
    id: 'hw-toggle-1',
    student_id: mockStudent.id,
    date: '2026-06-01',
    subject: '数学',
    homework_content: '教科書 p.20〜22 問題1〜5',
    homework_deadline: '2026-06-05',
    status: 'incomplete',
    created_at: new Date().toISOString()
  };

  const initialHomework2: HomeworkResult = {
    id: 'hw-toggle-2',
    student_id: mockStudent.id,
    date: '2026-06-02',
    subject: '英語',
    homework_content: '単語テスト練習 1〜30',
    homework_deadline: '2026-06-06',
    status: 'completed',
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.saveStudent(mockStudent);
    await db.saveHomeworkResult(initialHomework1);
    await db.saveHomeworkResult(initialHomework2);
  });

  it('renders one-click toggle buttons with appropriate labels and colors for unsubmitted and submitted statuses', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[mockStudent]}
          schools={mockSchools}
          curriculumMasters={[]}
          tasks={[]}
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );
    });

    // 1. hw-toggle-1 は incomplete なので「未提出」ボタンが表示されていること
    const btn1 = screen.getByTestId('toggle-homework-status-hw-toggle-1');
    expect(btn1).toBeInTheDocument();
    expect(btn1.textContent).toBe('未提出');

    // 2. hw-toggle-2 は completed なので「✓ 提出済」ボタンが表示されていること
    const btn2 = screen.getByTestId('toggle-homework-status-hw-toggle-2');
    expect(btn2).toBeInTheDocument();
    expect(btn2.textContent).toBe('✓ 提出済');

    wrapper.unmount();
  });

  it('toggles status from unsubmitted to submitted on click and persists immediately to DB', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[mockStudent]}
          schools={mockSchools}
          curriculumMasters={[]}
          tasks={[]}
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );
    });

    const btn1 = screen.getByTestId('toggle-homework-status-hw-toggle-1');
    expect(btn1.textContent).toBe('未提出');

    // クリックして「未提出」->「✓ 提出済」にトグル
    await act(async () => {
      fireEvent.click(btn1);
    });

    // UIが即時「✓ 提出済」に更新されること (Optimistic UI)
    expect(btn1.textContent).toBe('✓ 提出済');

    // DBに即時永続保存されたことを確認
    const updatedHwList = await db.fetchHomeworkResults(mockStudent.id);
    const updatedHw1 = updatedHwList.find(h => h.id === 'hw-toggle-1');
    expect(updatedHw1?.status).toBe('completed');

    wrapper.unmount();
  });

  it('toggles status back from submitted to unsubmitted on second click', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[mockStudent]}
          schools={mockSchools}
          curriculumMasters={[]}
          tasks={[]}
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );
    });

    const btn2 = screen.getByTestId('toggle-homework-status-hw-toggle-2');
    expect(btn2.textContent).toBe('✓ 提出済');

    // クリックして「✓ 提出済」->「未提出」にトグル
    await act(async () => {
      fireEvent.click(btn2);
    });

    // UIが即時「未提出」に更新されること
    expect(btn2.textContent).toBe('未提出');

    // DBに即時永続保存されたことを確認
    const updatedHwList = await db.fetchHomeworkResults(mockStudent.id);
    const updatedHw2 = updatedHwList.find(h => h.id === 'hw-toggle-2');
    expect(updatedHw2?.status).toBe('incomplete');

    // 再度クリックして「未提出」->「✓ 提出済」に戻す
    await act(async () => {
      fireEvent.click(btn2);
    });
    expect(btn2.textContent).toBe('✓ 提出済');

    const reUpdatedHw2 = (await db.fetchHomeworkResults(mockStudent.id)).find(h => h.id === 'hw-toggle-2');
    expect(reUpdatedHw2?.status).toBe('completed');

    wrapper.unmount();
  });

  it('maintains state and supports sort order toggling with unsubmitted_first and completed_first', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[mockStudent]}
          schools={mockSchools}
          curriculumMasters={[]}
          tasks={[]}
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );
    });

    const sortSelect = screen.getByLabelText(/並び順:/i);

    // 未完・未提出優先
    await act(async () => {
      fireEvent.change(sortSelect, { target: { value: 'unsubmitted_first' } });
    });

    // 提出済み優先
    await act(async () => {
      fireEvent.change(sortSelect, { target: { value: 'completed_first' } });
    });

    wrapper.unmount();
  });
});
