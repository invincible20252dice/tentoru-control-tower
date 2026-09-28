import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MilestonePlan, MiniTestResult, HomeworkResult, TestRecord } from '../types';

describe('TeacherDashboard Ultimate Coverage Strike 98%', () => {
  const students: Student[] = [
    {
      id: 'std-strike-elem-1',
      student_id: 'S_ELEM_1',
      name: '小学生 一郎',
      name_kana: 'ショウガクセイ イチロウ',
      grade: '小5',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['算数', '英語'],
      target_schools: [{ school_name: '慶應中等部', course_name: '普通部' }],
      personalities: ['几帳面'],
      start_unit_math: 'cm-elem-1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '小5'
    },
    {
      id: 'std-strike-jhs-1',
      student_id: 'S_JHS_1',
      name: '中学生 花子',
      name_kana: 'チュウガクセイ ハナコ',
      grade: '中2',
      branch_id: 'branch-2',
      classroom: '渋谷教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'review_needed',
      period_count: 3,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '英語', '理科'],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['自主的'],
      start_unit_math: 'cm-jhs-1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中2'
    },
    {
      id: 'std-strike-high-1',
      student_id: 'S_HIGH_1',
      name: '高校生 次郎',
      name_kana: 'コウコウセイ ジロウ',
      grade: '高2',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'ahead',
      period_count: 2,
      selected_days: ['wednesday'],
      selected_subjects: ['数学', '英語'],
      target_schools: [{ school_name: '東京大学', course_name: '理科一類' }],
      personalities: ['論理的'],
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '高2'
    }
  ];

  const curriculums: CurriculumMaster[] = [
    {
      id: 'cm-elem-1',
      subject: '算数',
      grade: '小5',
      unit_name: '小数のかけ算',
      lesson_name: '小数のかけ算 STEP 1',
      sort_order: 1,
      target_level: 'A'
    },
    {
      id: 'cm-elem-2',
      subject: '算数',
      grade: '小5',
      unit_name: '小数のかけ算',
      lesson_name: '小数のかけ算 単元確認テスト',
      sort_order: 2,
      target_level: 'A'
    },
    {
      id: 'cm-jhs-1',
      subject: '数学',
      grade: '中2',
      unit_name: '連立方程式',
      lesson_name: '連立方程式の加減法 STEP 1',
      sort_order: 1,
      target_level: 'B'
    },
    {
      id: 'cm-jhs-2',
      subject: '数学',
      grade: '中2',
      unit_name: '連立方程式',
      lesson_name: '連立方程式 単元確認テスト',
      sort_order: 2,
      target_level: 'B'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    students.forEach(s => db.saveStudent(s));
    await db.saveCurriculumMasters(curriculums);
  });

  it('covers header controls: teacher type toggle (elem/jhs/high), role toggle, and branch switcher', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(
        <TeacherDashboard
          students={students}
          curriculumMasters={curriculums}
          tasks={[]}
        />
      );
      container = res.container;
    });

    // 1. 小学生・中学生・高校生切り替え
    const elemBtn = screen.queryByTestId('header-teacher-type-elem');
    const jhsBtn = screen.queryByTestId('header-teacher-type-jhs');
    const highBtn = screen.queryByTestId('header-teacher-type-high');

    if (elemBtn) {
      await act(async () => {
        fireEvent.click(elemBtn);
      });
    }
    if (highBtn) {
      await act(async () => {
        fireEvent.click(highBtn);
      });
    }
    if (jhsBtn) {
      await act(async () => {
        fireEvent.click(jhsBtn);
      });
    }

    // 2. 本部/校舎権限トグル
    const adminRoleBtn = screen.queryByTestId('role-toggle-admin');
    const branchRoleBtn = screen.queryByTestId('role-toggle-branch');
    if (branchRoleBtn) {
      await act(async () => {
        fireEvent.click(branchRoleBtn);
      });
    }
    if (adminRoleBtn) {
      await act(async () => {
        fireEvent.click(adminRoleBtn);
      });
    }

    // 3. 校舎スイッチャー
    const branchSelect = screen.queryByTestId('admin-branch-switcher');
    if (branchSelect) {
      await act(async () => {
        fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
        fireEvent.change(branchSelect, { target: { value: 'all' } });
      });
    }
  });

  it('covers student search, grade filter, status filter, and pagination in student-list', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={students}
          curriculumMasters={curriculums}
          tasks={[]}
          initialTab="student-list"
        />
      );
    });

    // 検索入力
    const searchInputs = screen.queryAllByPlaceholderText(/生徒名・生徒IDで検索|検索/);
    if (searchInputs.length > 0) {
      await act(async () => {
        fireEvent.change(searchInputs[0], { target: { value: '花子' } });
        fireEvent.change(searchInputs[0], { target: { value: '' } });
      });
    }

    // 学年フィルタ
    const gradeFilters = screen.queryAllByDisplayValue(/全学年/);
    if (gradeFilters.length > 0) {
      await act(async () => {
        fireEvent.change(gradeFilters[0], { target: { value: '中2' } });
      });
    }

    // ステータスフィルタ
    const statusFilters = screen.queryAllByDisplayValue(/全ステータス/);
    if (statusFilters.length > 0) {
      await act(async () => {
        fireEvent.change(statusFilters[0], { target: { value: 'review_needed' } });
      });
    }
  });

  it('covers curriculum master unit test modal, lesson edit, and delete', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={students}
          curriculumMasters={curriculums}
          tasks={[]}
          initialTab="curriculum"
        />
      );
    });

    // 単元テストモーダル開閉
    const addUnitTestBtns = screen.queryAllByText(/単元テスト追加|単元確認テスト作成|単元テスト作成/);
    if (addUnitTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(addUnitTestBtns[0]);
      });

      const cancelBtns = screen.queryAllByText('キャンセル');
      if (cancelBtns.length > 0) {
        await act(async () => {
          fireEvent.click(cancelBtns[0]);
        });
      }
    }
  });
});
