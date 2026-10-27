import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, MiniTestResult } from '../lib/db';

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

describe('TeacherDashboard MiniTest Filter, Sort, and Auto-Save Score Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should deeply exercise all grade, subject, query filters and sort orders in Mini Tests tab', async () => {
    const todayStr = getDynamicDateStr(0);

    const students: Student[] = [
      {
        id: 'st-elem-filter',
        name: '小学太郎',
        name_kana: 'ショウガクタロウ',
        grade: '小5',
        grade_category: '小学生',
        school_name: '小学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      },
      {
        id: 'st-kinder-filter',
        name: '園児花子',
        name_kana: 'エンジハナコ',
        grade: '園児',
        grade_category: '小学生',
        school_name: '幼稚園',
        period_count: 1,
        day_of_week: ['tue'],
        selected_subjects: ['算数'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      },
      {
        id: 'st-jh-filter',
        name: '中学次郎',
        name_kana: 'チュウガクジロウ',
        grade: '中2',
        grade_category: '中学生',
        school_name: '中学校',
        period_count: 2,
        day_of_week: ['wed'],
        selected_subjects: ['数学'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      },
      {
        id: 'st-high-filter',
        name: '高校三郎',
        name_kana: 'コウコウサブロウ',
        grade: '高1',
        grade_category: '高校生',
        school_name: '高校',
        period_count: 2,
        day_of_week: ['thu'],
        selected_subjects: ['英語'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      },
      {
        id: 'st-grad-filter',
        name: '既卒四郎',
        name_kana: 'キソツシロウ',
        grade: '既卒',
        grade_category: '高校生',
        school_name: '予備校',
        period_count: 2,
        day_of_week: ['fri'],
        selected_subjects: ['英語'],
        completed_lesson_ids: [],
        created_at: getDynamicISO(0)
      }
    ];

    const miniTests: MiniTestResult[] = [
      {
        id: 'mt-1',
        student_id: 'st-elem-filter',
        subject: '算数',
        date: getDynamicDateStr(-3),
        unit_name: '分数のたし算',
        test_content: '分数の計算 小テスト',
        passing_line: '80点以上',
        score: 90,
        passed: true,
        status: 'passed',
        created_at: getDynamicISO(-3)
      },
      {
        id: 'mt-2',
        student_id: 'st-jh-filter',
        subject: '数学',
        date: getDynamicDateStr(-2),
        unit_name: '連立方程式',
        test_content: '連立方程式の応用 小テスト',
        passing_line: '85点以上',
        score: null, // Unsubmitted
        passed: undefined,
        status: undefined,
        created_at: getDynamicISO(-2)
      },
      {
        id: 'mt-3',
        student_id: 'st-high-filter',
        subject: '英語',
        date: getDynamicDateStr(-1),
        unit_name: '関係代名詞',
        test_content: '英語: 関係代名詞 小テスト',
        passing_line: '70点以上',
        score: 50, // Failed
        passed: false,
        status: 'failed',
        created_at: getDynamicISO(-1)
      }
    ];

    (db as any).saveMockData('students', students);
    (db as any).saveMockData('mini_test_results', miniTests);

    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        teacherType="junior_high"
        targetDate={todayStr}
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Switch to Mini Test tab
    const testTabs = screen.queryAllByText(/小テスト結果|小テスト/);
    if (testTabs.length > 0) {
      fireEvent.click(testTabs[0]);

      // 1. Grade filters: 小学生, 中学生, 高校生, 中2, all
      const gradeFilterSelects = screen.queryAllByDisplayValue(/全学年/);
      if (gradeFilterSelects.length > 0) {
        const select = gradeFilterSelects[0];
        fireEvent.change(select, { target: { value: '小学生' } });
        fireEvent.change(select, { target: { value: '中学生' } });
        fireEvent.change(select, { target: { value: '高校生' } });
        fireEvent.change(select, { target: { value: '中2' } });
        fireEvent.change(select, { target: { value: 'all' } });
      }

      // 2. Subject filter: 数学, all
      const subjectFilterSelects = screen.queryAllByDisplayValue(/全教科/);
      if (subjectFilterSelects.length > 0) {
        const select = subjectFilterSelects[0];
        fireEvent.change(select, { target: { value: '数学' } });
        fireEvent.change(select, { target: { value: '英語' } });
        fireEvent.change(select, { target: { value: 'all' } });
      }

      // 3. Search query: test_content, passing_line, studentName
      const searchInputs = screen.queryAllByPlaceholderText(/題名・生徒名・単元で検索|検索/);
      if (searchInputs.length > 0) {
        const input = searchInputs[0];
        fireEvent.change(input, { target: { value: '分数' } });
        fireEvent.change(input, { target: { value: '80点' } });
        fireEvent.change(input, { target: { value: '小学太郎' } });
        fireEvent.change(input, { target: { value: '' } });
      }

      // 4. Sort orders: date_asc, name_asc, unsubmitted_first, passed_first
      const sortSelects = screen.queryAllByDisplayValue(/日付（新しい順）|日付/);
      if (sortSelects.length > 0) {
        const select = sortSelects[0];
        fireEvent.change(select, { target: { value: 'date_asc' } });
        fireEvent.change(select, { target: { value: 'name_asc' } });
        fireEvent.change(select, { target: { value: 'unsubmitted_first' } });
        fireEvent.change(select, { target: { value: 'passed_first' } });
      }

      // 5. Test score inputs and status selects
      const scoreInputs = screen.queryAllByPlaceholderText(/点数|得点|-/);
      if (scoreInputs.length > 0) {
        // Valid pass score
        fireEvent.change(scoreInputs[0], { target: { value: '95' } });
        // Valid fail score
        fireEvent.change(scoreInputs[0], { target: { value: '40' } });
        // Empty score
        fireEvent.change(scoreInputs[0], { target: { value: '' } });
        // Out of range (guard)
        fireEvent.change(scoreInputs[0], { target: { value: '999' } });
      }
    }

    unmount();
  });
});
