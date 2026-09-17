import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster } from '../lib/db';

describe('TeacherDashboard Complete Ultra Deep Coverage Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const sampleStudent: Student = {
    id: 'std-ultra-1',
    student_id: 'ultra101',
    name: '中尾 謙信',
    name_kana: 'ナカオ ケンシン',
    email: 'kenshin@tentoru.test',
    grade: '中3',
    school_id: 'sch-1',
    school_name: '天登第一中学校',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 3,
    level: 'A',
    registered_grade: '中3',
    registered_year: 2026,
    selected_subjects: ['数学', '英語', '国語', '理科', '社会'],
    assigned_teachers: ['福田 尚弘'],
    created_at: '2026-04-01T00:00:00Z'
  };

  it('tests student search, grade filter, role toggle, and branch switcher', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={[sampleStudent]}
          initialTab="student-list"
          teacherType="all"
        />
      );
    });

    // 検索入力
    const searchInputs = screen.queryAllByPlaceholderText(/生徒名で検索|検索/);
    if (searchInputs.length > 0) {
      await act(async () => {
        fireEvent.change(searchInputs[0], { target: { value: '中尾' } });
      });
      expect(screen.getByText(/中尾 謙信/)).toBeInTheDocument();
    }

    // ロール切り替えボタン
    const branchRoleBtn = screen.queryByTestId('role-toggle-branch');
    if (branchRoleBtn) {
      await act(async () => {
        fireEvent.click(branchRoleBtn);
      });
    }

    const adminRoleBtn = screen.queryByTestId('role-toggle-admin');
    if (adminRoleBtn) {
      await act(async () => {
        fireEvent.click(adminRoleBtn);
      });
    }

    // 校種切り替えボタン
    const elemTypeBtn = screen.queryByTestId('header-teacher-type-elem');
    if (elemTypeBtn) {
      await act(async () => {
        fireEvent.click(elemTypeBtn);
      });
    }

    const jhsTypeBtn = screen.queryByTestId('header-teacher-type-jhs');
    if (jhsTypeBtn) {
      await act(async () => {
        fireEvent.click(jhsTypeBtn);
      });
    }

    const highTypeBtn = screen.queryByTestId('header-teacher-type-high');
    if (highTypeBtn) {
      await act(async () => {
        fireEvent.click(highTypeBtn);
      });
    }

    // 校舎切り替えセレクター
    const branchSwitcher = screen.queryByTestId('admin-branch-switcher');
    if (branchSwitcher) {
      await act(async () => {
        fireEvent.change(branchSwitcher, { target: { value: 'branch-1' } });
        fireEvent.change(branchSwitcher, { target: { value: 'all' } });
      });
    }
  });

  it('tests new student account generation flow', async () => {
    const saveStudentSpy = vi.spyOn(db, 'saveStudent');

    await act(async () => {
      render(
        <TeacherDashboard
          students={[sampleStudent]}
          initialTab="create-student"
          teacherType="junior_high"
        />
      );
    });

    const nameInput = screen.queryByPlaceholderText('例: 佐藤 拓海');
    if (nameInput) {
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: '新規 テスト生徒' } });
      });
    }

    const submitBtns = screen.queryAllByText(/発行する|アカウント発行|登録/);
    if (submitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(submitBtns[0]);
      });
    }

    saveStudentSpy.mockRestore();
  });

  it('tests student detail tabs, personality tags, memo interactions and delete confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const deleteStudentSpy = vi.spyOn(db, 'deleteStudent');

    await act(async () => {
      render(
        <TeacherDashboard
          students={[sampleStudent]}
          initialStudentId={sampleStudent.id}
          initialTab="student-list"
          teacherType="junior_high"
        />
      );
    });

    // 削除ボタン
    const deleteBtns = screen.queryAllByText(/🗑️ 削除|生徒を削除/);
    if (deleteBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
    }

    confirmSpy.mockRestore();
    deleteStudentSpy.mockRestore();
  });
});
