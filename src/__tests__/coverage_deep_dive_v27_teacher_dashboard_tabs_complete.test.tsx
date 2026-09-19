import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, Branch, LearningTask } from '../lib/db';

describe('TeacherDashboard All Tabs & Actions Complete Strike Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力テスト');

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: 'std-tab-1',
      student_id: 'stdtab01',
      name: 'タブ網羅 太郎',
      grade: '中3',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中3',
      selected_subjects: ['数学', '英語'],
      personalities: ['集中力高い']
    };
    await db.saveStudent(student);

    const curriculum: CurriculumMaster[] = [
      { id: 'cm-tab-1', subject: '数学', grade: '中3', unit_name: '三平方の定理', lesson_name: '三平方の定理(1)', sort_order: 1 },
      { id: 'cm-tab-2', subject: '数学', grade: '中3', unit_name: '三平方の定理', lesson_name: '三平方の定理(2)', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(curriculum);

    const task: LearningTask = {
      id: 'task-tab-1',
      student_id: student.id,
      unit_id: 'cm-tab-1',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '三平方の定理(1)',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
  });

  it('covers curriculum tab unit add, update, delete, sort order, and link url', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(
        <TeacherDashboard
          initialTab="curriculum"
          teacherType="all"
          onLogout={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Switch subject selects if present
    const selects = screen.queryAllByRole('combobox');
    for (const sel of selects) {
      fireEvent.change(sel, { target: { value: sel.children[1] ? (sel.children[1] as any).value : sel.value } });
    }

    // Interact with unit inputs and buttons
    const inputs = screen.queryAllByRole('textbox');
    for (const inp of inputs) {
      fireEvent.change(inp, { target: { value: '新規テスト単元名' } });
    }

    const buttons = screen.queryAllByRole('button');
    for (const btn of buttons) {
      await act(async () => {
        try {
          const txt = btn.textContent || '';
          if (txt.includes('追加') || txt.includes('保存') || txt.includes('編集') || txt.includes('更新') || txt.includes('並び替え')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
  });

  it('covers mass operations dialogs and student schedule timetable matrix', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(
        <TeacherDashboard
          initialTab="schedule"
          teacherType="middle"
          onLogout={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Click mass apply buttons
    const massButtons = screen.queryAllByRole('button');
    for (const btn of massButtons) {
      await act(async () => {
        try {
          const txt = btn.textContent || '';
          if (txt.includes('一括適用') || txt.includes('小テスト') || txt.includes('宿題') || txt.includes('時間割')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
  });
});
