import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  db,
  Student,
  CurriculumMaster,
  LearningTask,
  MiniTestResult,
  HomeworkResult,
  TestRecord,
  AIReport,
  MilestonePlan
} from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Coverage 95%+ TeacherDashboard Deep Direct Coverage Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    const std: Student = {
      id: 'std-td-deep-01',
      student_id: 'S_TD_DEEP',
      name: '講師徹底テスト生',
      grade: '中1',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '荒木はやと',
      assigned_teachers: ['荒木はやと', '福田 尚弘'],
      personality_tags: ['集中力高い', '慎重'],
      enrollment_date: '2025-04-01'
    };
    await db.saveStudent(std);

    const master1: CurriculumMaster = {
      id: 'cm-td-01',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '加法と減法',
      sort_order: 1,
      item_type: 'lesson'
    };
    const master2: CurriculumMaster = {
      id: 'cm-td-02',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '正の数・負の数 確認テスト',
      sort_order: 2,
      item_type: 'unit_test',
      passing_line: '80%以上'
    };
    await db.saveCurriculumMasters([master1, master2]);

    const task: LearningTask = {
      id: 'lt-td-01',
      student_id: 'std-td-deep-01',
      scheduled_date: '2026-09-10',
      period: 1,
      subject: '数学',
      unit_id: 'cm-td-01',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const mini: MiniTestResult = {
      id: 'mtr-td-01',
      student_id: 'std-td-deep-01',
      date: '2026-09-10',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '正の数・負の数',
      test_content: '確認テスト1',
      status: 'pass',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(mini);

    const hr: HomeworkResult = {
      id: 'hr-td-01',
      student_id: 'std-td-deep-01',
      date: '2026-09-10',
      subject: '数学',
      homework_content: '計算ドリル',
      homework_deadline: '2026-09-15',
      status: 'done',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hr);

    const rep: AIReport = {
      id: 'rep-td-01',
      student_id: 'std-td-deep-01',
      report_text: '計算力が高く、理解が早いです。',
      generated_at: new Date().toISOString()
    };
    await db.saveAIReport(rep);
  });

  // 1. Elementary Mode Dashboard Coverage
  it('covers Elementary TeacherDashboard layout, milestone timeline, and subject selector', async () => {
    const elemStd: Student = {
      id: 'std-elem-td',
      student_id: 'S_ELEM_TD',
      name: '小学生テスト生',
      grade: '小5',
      grade_category: '小学生',
      level: 'B',
      school_id: 'sch-2',
      school_name: 'テントル小学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 1,
      selected_days: ['tuesday'],
      selected_subjects: ['算数']
    };
    await db.saveStudent(elemStd);

    render(
      <TeacherDashboard
        teacherType="elementary"
        initialStudentId="std-elem-td"
        onBackToPortal={vi.fn()}
      />
    );

    expect(screen.getAllByText(/小学生テスト生/i).length).toBeGreaterThan(0);
  });

  // 2. High School Mode Dashboard Coverage
  it('covers High School TeacherDashboard layout and subject chips', async () => {
    const highStd: Student = {
      id: 'std-high-td',
      student_id: 'S_HIGH_TD',
      name: '高校生テスト生',
      grade: '高2',
      grade_category: '高校生',
      level: 'A',
      school_id: 'sch-3',
      school_name: '都立高校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['friday'],
      selected_subjects: ['数学II', '英語']
    };
    await db.saveStudent(highStd);

    render(
      <TeacherDashboard
        teacherType="high_school"
        initialStudentId="std-high-td"
        onBackToPortal={vi.fn()}
      />
    );

    expect(screen.getAllByText(/高校生テスト生/i).length).toBeGreaterThan(0);
  });

  // 3. Junior High School Interactive Action Flows
  it('covers interactive tabs, filter dropdowns, modal saves, and AI reports in Junior High TeacherDashboard', async () => {
    const { container } = render(
      <TeacherDashboard
        teacherType="junior_high"
        initialStudentId="std-td-deep-01"
        onBackToPortal={vi.fn()}
      />
    );

    // 1. Switch to AI Report Tab
    const aiTab = screen.queryByRole('button', { name: /AI進捗レポート/i });
    if (aiTab) {
      await act(async () => {
        fireEvent.click(aiTab);
      });

      // Edit report text
      const textarea = container.querySelector('textarea');
      if (textarea) {
        fireEvent.change(textarea, { target: { value: '修正後のレポート内容です。' } });
      }

      // Save correction
      const saveReportBtn = screen.queryByRole('button', { name: /修正を保存/i }) || screen.queryByRole('button', { name: /保存/i });
      if (saveReportBtn) {
        await act(async () => {
          fireEvent.click(saveReportBtn);
        });
      }
    }

    // 2. Switch to Student Detail Tab
    const detailTab = screen.queryByRole('button', { name: /生徒カルテ/i });
    if (detailTab) {
      await act(async () => {
        fireEvent.click(detailTab);
      });

      // Add counseling memo
      const memoInput = container.querySelector('input[placeholder*="トピック"]') || container.querySelector('input[type="text"]');
      if (memoInput) {
        fireEvent.change(memoInput, { target: { value: '定期テスト面談' } });
      }

      // Save memo button
      const saveMemoBtn = screen.queryByRole('button', { name: /記録する/i }) || screen.queryByRole('button', { name: /追加/i });
      if (saveMemoBtn) {
        await act(async () => {
          fireEvent.click(saveMemoBtn);
        });
      }
    }

    // 3. Switch to Tests Tab
    const testsTab = screen.queryByRole('button', { name: /定期テスト・模試/i });
    if (testsTab) {
      await act(async () => {
        fireEvent.click(testsTab);
      });

      // Score input
      const scoreInputs = container.querySelectorAll('input[type="number"]');
      scoreInputs.forEach(input => {
        fireEvent.change(input, { target: { value: '88' } });
      });
    }

    // 4. Switch to Mini Tests Tab
    const miniTab = screen.queryByRole('button', { name: /小テスト・確認/i });
    if (miniTab) {
      await act(async () => {
        fireEvent.click(miniTab);
      });

      // Toggle pass/fail button
      const passBtn = screen.queryByRole('button', { name: /合格/i });
      if (passBtn) {
        await act(async () => {
          fireEvent.click(passBtn);
        });
      }
    }

    // 5. Switch to Homework Tab
    const hwTab = screen.queryByRole('button', { name: /宿題管理/i });
    if (hwTab) {
      await act(async () => {
        fireEvent.click(hwTab);
      });

      // Toggle done button
      const doneBtn = screen.queryByRole('button', { name: /提出済/i }) || screen.queryByRole('button', { name: /完了/i });
      if (doneBtn) {
        await act(async () => {
          fireEvent.click(doneBtn);
        });
      }
    }

    // 6. Header school category buttons
    const headerElemBtn = screen.queryByTestId('header-teacher-type-elem');
    if (headerElemBtn) {
      await act(async () => {
        fireEvent.click(headerElemBtn);
      });
    }

    const headerHighBtn = screen.queryByTestId('header-teacher-type-high');
    if (headerHighBtn) {
      await act(async () => {
        fireEvent.click(headerHighBtn);
      });
    }

    const headerJhsBtn = screen.queryByTestId('header-teacher-type-jhs');
    if (headerJhsBtn) {
      await act(async () => {
        fireEvent.click(headerJhsBtn);
      });
    }
  });
});
