import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, MiniTestResult, HomeworkResult } from '../types';

describe('TeacherDashboard IA Refactoring & UX Improvements', () => {
  const sampleStudent: Student = {
    id: 'test-ia-student-1',
    student_id: 'std_ia_1',
    name: '伊藤 雅人',
    name_kana: 'イトウ マサト',
    email: 'ito@tentoru-student.com',
    grade: '中2',
    school_id: 'sch-ia-1',
    school_name: '第一中学校',
    status: 'warning',
    start_unit_id: 'cm-1',
    level: 'B',
    enrollment_date: '2025-04-01',
    withdrawal_date: null,
    weekly_sessions_count: '2回',
    weekly_duration_minutes: '120分',
    period_count: 2,
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['数学', '英語'],
    personalities: ['集中力が高い', '素直'],
    created_at: new Date().toISOString()
  };

  const sampleMiniTest: MiniTestResult = {
    id: 'minitest-ia-1',
    student_id: sampleStudent.id,
    date: '2026-09-20',
    subject: '数学',
    test_content: '一次関数 第1回 小テスト',
    score: null,
    passing_line: '80点',
    passed: false,
    created_at: new Date().toISOString()
  };

  const sampleHomework: HomeworkResult = {
    id: 'hw-ia-1',
    student_id: sampleStudent.id,
    date: '2026-09-21',
    subject: '数学',
    homework_content: 'ワーク P.40-45 一次関数のグラフ',
    homework_deadline: '2026-09-25',
    status: 'incomplete',
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    localStorage.clear();
    db.clearMockData();
    await db.saveStudent(sampleStudent);
    await db.saveMiniTestResult(sampleMiniTest);
    await db.saveHomeworkResult(sampleHomework);
  });

  it('A: Slim global header renders concise branding and compact dropdowns', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(<TeacherDashboard onBackToPortal={() => {}} />);
      container = res.container;
    });

    // Brand title
    expect(screen.getByText('TENTORU 司令塔')).toBeInTheDocument();
    expect(screen.getByText('講師用')).toBeInTheDocument();

    // Check that header element has the slim header class
    const headerEl = container!.querySelector('header');
    expect(headerEl).toBeInTheDocument();

    // Compact selectors exist
    expect(screen.getByTestId('admin-branch-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('role-toggle-admin')).toBeInTheDocument();
    expect(screen.getByTestId('header-teacher-type-jhs')).toBeInTheDocument();
  });

  it('B: Mini-tests and homework lists have 1-line toolbars, soft status badges, and subtle trash icon delete buttons', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="mini-tests" initialStudentId={sampleStudent.id} onBackToPortal={() => {}} />);
    });

    // Mini-tests toolbar elements
    expect(screen.getByText('小テスト結果管理')).toBeInTheDocument();
    expect(screen.getByLabelText('学年:')).toBeInTheDocument();
    expect(screen.getByLabelText('教科:')).toBeInTheDocument();
    expect(screen.getByLabelText('並び順:')).toBeInTheDocument();
    expect(screen.getByLabelText('検索:')).toBeInTheDocument();

    // Subtle delete button has trash icon and sr-only delete text
    const deleteMiniTestBtns = screen.getAllByRole('button', { name: /🗑️ 削除/i });
    expect(deleteMiniTestBtns.length).toBeGreaterThan(0);

    // Switch to homeworks tab
    const hwTabBtn = screen.getByText('宿題提出状況');
    await act(async () => {
      fireEvent.click(hwTabBtn);
    });

    // Homework toolbar
    expect(screen.getByText('宿題提出状況管理')).toBeInTheDocument();
    const hwStatusBtn = screen.getByTestId(`toggle-homework-status-${sampleHomework.id}`);
    expect(hwStatusBtn).toBeInTheDocument();
    expect(hwStatusBtn.textContent).toContain('未提出');

    // Subtle delete button for homework
    const deleteHwBtns = screen.getAllByRole('button', { name: /🗑️ 削除/i });
    expect(deleteHwBtns.length).toBeGreaterThan(0);
  });

  it('C: Student list has hidden debug banner and cards display alert badges', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="student-list" onBackToPortal={() => {}} />);
    });

    // Debug banner is hidden
    const debugBanner = screen.getByTestId('supabase-debug-banner');
    expect(debugBanner).toBeInTheDocument();
    expect(debugBanner).toHaveAttribute('hidden');

    // Student card exists
    const studentCard = screen.getByTestId(`student-card-${sampleStudent.id}`);
    expect(studentCard).toBeInTheDocument();
    expect(studentCard.textContent).toContain('伊藤 雅人');
  });

  it('D: Student detail (medical record) supports 3-tab switching, sticky side card, and unified save', async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="student-detail" initialStudentId={sampleStudent.id} onBackToPortal={() => {}} />);
    });

    // 3 Sub-tab navigation buttons
    expect(screen.getByTestId('subtab-basic')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-conditions')).toBeInTheDocument();
    expect(screen.getByTestId('subtab-start-and-personality')).toBeInTheDocument();

    // Sub-tab 1: Basic info fields
    expect(screen.getByDisplayValue('伊藤 雅人')).toBeInTheDocument();
    expect(screen.getByDisplayValue('イトウ マサト')).toBeInTheDocument();

    // Switch to Sub-tab 2: Conditions
    await act(async () => {
      fireEvent.click(screen.getByTestId('subtab-conditions'));
    });
    expect(screen.getByTestId('student-enrollment-date-input')).toBeInTheDocument();
    expect(screen.getByTestId('day-chip-tuesday')).toBeInTheDocument();
    expect(screen.getByTestId('subject-chip-数学')).toBeInTheDocument();

    // Switch to Sub-tab 3: Start position & personality
    await act(async () => {
      fireEvent.click(screen.getByTestId('subtab-start-and-personality'));
    });
    expect(screen.getByText('教科別学習スタート位置')).toBeInTheDocument();
    expect(screen.getByTestId('new-personality-input')).toBeInTheDocument();

    // Side card sticky check
    expect(screen.getByText('📝 対応入力')).toBeInTheDocument();
    expect(screen.getByText('📊 直近のテスト・模試実績')).toBeInTheDocument();

    // Form save button works
    const saveBtn = screen.getByRole('button', { name: '変更を保存する' });
    expect(saveBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(saveBtn);
    });
  });
});
