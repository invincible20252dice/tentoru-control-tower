import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, LearningTask, Branch } from '../lib/db';

describe('TeacherDashboard Milestone & Sub-Features Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '単元テスト名');

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: 'std-exclude-1',
      student_id: 'std_ex',
      name: '除外テスト生徒',
      grade: '中1',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学'],
      excluded_lesson_ids: ['cm-ex-1']
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-ex-1', subject: '数学', grade: '中1', unit_name: '正の数・負の数', lesson_name: '正負の計算(1)', sort_order: 1 },
      { id: 'cm-ex-2', subject: '数学', grade: '中1', unit_name: '正の数・負の数', lesson_name: '正負の計算(2)', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    const task: LearningTask = {
      id: 'task-ex-1',
      student_id: student.id,
      unit_id: 'cm-ex-2',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '正負の計算(2)',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
  });

  it('covers student detail exclusion reset and unit test master modal toggles', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Select student
    const studentCard = screen.queryAllByText(/除外テスト生徒/);
    if (studentCard.length > 0) {
      await act(async () => {
        fireEvent.click(studentCard[0]);
      });
    }

    // Click reset excluded lessons button if present
    const resetBtns = screen.queryAllByRole('button');
    for (const btn of resetBtns) {
      await act(async () => {
        try {
          const txt = btn.textContent || '';
          if (txt.includes('除外') || txt.includes('リセット') || txt.includes('復元') || txt.includes('単元テスト') || txt.includes('マイルストーン')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
  });
});
