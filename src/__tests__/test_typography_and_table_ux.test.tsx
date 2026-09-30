import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        })
      })),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      })
    }))
  }
}));

describe('Typography, Table Alignment, and UX Refinements', () => {
  const mockStudent = {
    id: 's1',
    student_id: 'std-s1',
    name: '山田太郎',
    grade: '中2',
    level: 'A' as const,
    school_id: 'sc1',
    school_name: 'テスト中学校',
    start_date: '2026-04-01',
    target_school: '○○高校',
    status: 'normal' as const,
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['数学', '英語'],
    default_slots: 2
  };

  const mockMiniTestResults = [
    {
      id: 'm1',
      student_id: 's1',
      date: '2026-04-10',
      subject: '数学',
      test_content: '第1章 連立方程式 計算小テスト',
      passing_line: 'レベルA (90点)',
      score: 95,
      passed: true
    },
    {
      id: 'm2',
      student_id: 's1',
      date: '2026-04-12',
      subject: '数学',
      test_content: '第2章 一次関数 小テスト',
      passing_line: 'レベルA (90点)',
      score: 60,
      passed: false
    }
  ];

  const mockHomeworks = [
    {
      id: 'h1',
      student_id: 's1',
      date: '2026-04-10',
      subject: '数学',
      homework_content: 'ワーク P.10〜12',
      homework_deadline: '2026-04-15',
      status: 'completed' as const
    },
    {
      id: 'h2',
      student_id: 's1',
      date: '2026-04-12',
      subject: '数学',
      homework_content: 'ワーク P.13〜15',
      homework_deadline: '2026-04-18',
      status: 'incomplete' as const
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    await db.saveStudent(mockStudent);
    for (const m of mockMiniTestResults) {
      await db.saveMiniTestResult(m);
    }
    for (const h of mockHomeworks) {
      await db.saveHomeworkResult(h);
    }
  });

  it('renders mini test table with proper column alignment, badge styles, and centered delete button', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="mini-tests" students={[mockStudent]} initialStudentId="s1" />);
    });

    // Check table headers
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(7);

    // 日付 (left), 生徒名 (left), テスト内容 (left), レベル/合格点 (left)
    expect(headers[0].style.textAlign).toBe('left');
    expect(headers[1].style.textAlign).toBe('left');
    expect(headers[2].style.textAlign).toBe('left');
    expect(headers[3].style.textAlign).toBe('left');
    // 点数 (right)
    expect(headers[4].style.textAlign).toBe('right');
    // 合否 (center), 操作 (center)
    expect(headers[5].style.textAlign).toBe('center');
    expect(headers[6].style.textAlign).toBe('center');

    // Check status select styling
    const statusSelects = screen.getAllByRole('combobox').filter(el => 
      ['unstarted', 'passed', 'failed'].includes((el as HTMLSelectElement).value)
    );
    expect(statusSelects.length).toBeGreaterThanOrEqual(1);

    // Check delete buttons have centered style
    const deleteBtns = screen.getAllByRole('button', { name: /削除/i });
    expect(deleteBtns.length).toBeGreaterThan(0);
    expect(deleteBtns[0].style.margin).toBe('0px auto');
  });

  it('renders homework table with proper column alignment, badges, and centered delete button', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="homeworks" students={[mockStudent]} initialStudentId="s1" />);
    });

    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(6);

    // 日付, 生徒名, 宿題内容, 提出期限 (left)
    expect(headers[0].style.textAlign).toBe('left');
    expect(headers[1].style.textAlign).toBe('left');
    expect(headers[2].style.textAlign).toBe('left');
    expect(headers[3].style.textAlign).toBe('left');
    // 提出状況, 操作 (center)
    expect(headers[4].style.textAlign).toBe('center');
    expect(headers[5].style.textAlign).toBe('center');

    // Check toggle status buttons
    const toggleBtnCompleted = screen.getByTestId('toggle-homework-status-h1');
    expect(toggleBtnCompleted.textContent).toContain('提出済');
    expect(toggleBtnCompleted.style.backgroundColor).toBe('rgb(209, 250, 229)'); // #d1fae5 (emerald-100)

    const toggleBtnIncomplete = screen.getByTestId('toggle-homework-status-h2');
    expect(toggleBtnIncomplete.textContent).toContain('未提出');
    expect(toggleBtnIncomplete.style.backgroundColor).toBe('rgb(254, 243, 199)'); // #fef3c7 (amber-100)
  });

  it('renders subject start rows with uniform 36px height select boxes in student detail tab', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="student-detail" students={[mockStudent]} initialStudentId="s1" />);
    });

    // Switch to start-and-personality subtab
    const startTabBtn = screen.getByTestId('subtab-start-and-personality');
    await act(async () => {
      fireEvent.click(startTabBtn);
    });

    const mathGradeSelect = screen.getByTestId('start-grade-select-start_unit_math');
    expect(mathGradeSelect).toBeDefined();
    expect(mathGradeSelect.style.height).toBe('36px');

    const mathUnitSelect = screen.getByTestId('start-unit-select-start_unit_math');
    expect(mathUnitSelect).toBeDefined();
    expect(mathUnitSelect.style.height).toBe('36px');
  });

  it('provides quick save and sticky action save buttons on student-detail and schedule tabs', async () => {
    let unmountFn: () => void;
    await act(async () => {
      const { unmount } = render(<TeacherDashboard initialTab="student-detail" students={[mockStudent]} initialStudentId="s1" />);
      unmountFn = unmount;
    });

    // Quick save button on student detail tab
    const quickSaveBtn = screen.getByRole('button', { name: /💾 変更を保存/i });
    expect(quickSaveBtn).toBeDefined();

    // Bottom submit button in sticky bar
    const bottomSaveBtn = screen.getByRole('button', { name: /変更を保存する/i });
    expect(bottomSaveBtn).toBeDefined();

    unmountFn!();

    // Now test schedule tab
    await act(async () => {
      render(<TeacherDashboard initialTab="schedule" students={[mockStudent]} initialStudentId="s1" />);
    });

    const quickScheduleSaveBtn = screen.getByRole('button', { name: /💾 コマ割りを反映/i });
    expect(quickScheduleSaveBtn).toBeDefined();

    const bottomScheduleSaveBtn = screen.getByRole('button', { name: /時間割コマ割りを保存/i });
    expect(bottomScheduleSaveBtn).toBeDefined();
  });
});
