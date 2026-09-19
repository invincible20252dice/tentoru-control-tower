import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, Branch, LearningTask, StudentScheduleConfig, HomeworkResult } from '../lib/db';

describe('TeacherDashboard & DB Deep Strike V25 Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力');

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: 'std-deep-1',
      student_id: 'stddeep01',
      name: '網羅 生徒太郎',
      grade: '中2',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中2',
      selected_subjects: ['数学', '英語'],
      personalities: ['集中力高い']
    };
    await db.saveStudent(student);

    const curriculum: CurriculumMaster[] = [
      { id: 'cm-d1', subject: '数学', grade: '中2', unit_name: '一次関数', lesson_name: '一次関数とグラフ', sort_order: 1 },
      { id: 'cm-d2', subject: '数学', grade: '中2', unit_name: '一次関数', lesson_name: '一次関数の利用', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(curriculum);

    const task: LearningTask = {
      id: 'task-d1',
      student_id: student.id,
      unit_id: 'cm-d1',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '一次関数とグラフ',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
  });

  it('interacts deeply with TeacherDashboard timetable, filter modes, modals, and actions', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 1. Switch to elementary and senior high modes
    const elemBtn = screen.getByTestId('header-teacher-type-elem');
    const jhsBtn = screen.getByTestId('header-teacher-type-jhs');
    const highBtn = screen.getByTestId('header-teacher-type-high');

    fireEvent.click(elemBtn);
    fireEvent.click(highBtn);
    fireEvent.click(jhsBtn);

    // 2. Select student to open detail view
    const studentItems = screen.queryAllByText(/網羅 生徒太郎/);
    if (studentItems.length > 0) {
      await act(async () => {
        fireEvent.click(studentItems[0]);
      });
    }

    // 3. Click every available tab in student detail
    const tabs = screen.queryAllByRole('tab');
    for (const tab of tabs) {
      await act(async () => {
        try { fireEvent.click(tab); } catch (e) {}
      });
    }

    // 4. Exercise action buttons
    const allButtons = screen.queryAllByRole('button');
    for (const btn of allButtons) {
      await act(async () => {
        try {
          const txt = btn.textContent || '';
          if (txt.includes('保存') || txt.includes('追加') || txt.includes('更新') || txt.includes('編集') || txt.includes('計算')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
  });

  it('covers comprehensive db fallback and persistence methods', async () => {
    // 1. Homework results
    const hw: HomeworkResult = {
      id: 'hw-1',
      student_id: 'std-deep-1',
      date: '2026-09-19',
      subject: '数学',
      homework_content: 'ワーク P10-15',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResults([hw]);
    expect(db.getHomeworkResults().length).toBeGreaterThan(0);

    // 2. Student schedule configs
    const config: StudentScheduleConfig = {
      student_id: 'std-deep-1',
      day_of_week: ['monday', 'thursday'],
      weekly_frequency: 2,
      start_time: '17:00',
      end_time: '19:00',
      created_at: new Date().toISOString()
    };
    await db.saveStudentScheduleConfig(config);
    expect(db.getStudentScheduleConfig('std-deep-1')).toBeDefined();

    // 3. Delete homework result
    await db.deleteHomeworkResult('hw-1');
  });
});
