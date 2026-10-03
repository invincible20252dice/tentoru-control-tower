import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, MiniTestResult } from '../lib/db';

describe('Mini Test Student Name Resolution and Realtime Sync Tests', () => {
  const mockStudentNakao: Student = {
    id: 'std-nakao-1',
    student_id: 'S2001',
    name: '中尾 謙信',
    name_kana: 'ナカオ ケンシン',
    grade: '小5',
    status: 'normal',
    level: 'A',
    period_count: 2,
    school_id: 'sch-nakao-1',
    school_name: '恵比寿小学校',
    selected_subjects: ['算数', '国語'],
    created_at: new Date().toISOString()
  };

  const todayStr = '2026-06-16';

  const mockMiniTestNakao: MiniTestResult = {
    id: 'mini-nakao-test-1',
    student_id: 'std-nakao-1',
    date: todayStr,
    subject: '算数',
    test_type: 'unit_test',
    test_content: '小数のかけ算 単元確認テスト',
    score: null,
    passed: null,
    passing_line: '90点以上',
    target_scope: 'individual',
    created_at: '2026-06-16T10:00:00Z',
    students: {
      id: 'std-nakao-1',
      name: '中尾 謙信',
      grade: '小5'
    }
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    for (const seedSt of db.getDefaultSeedStudents()) {
      await db.saveStudent(seedSt);
    }
    await db.saveStudent(mockStudentNakao);
    await db.saveMiniTestResult(mockMiniTestNakao);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  it('1. should display proper student name (中尾 謙信) in TestResultsManagement instead of 不明な生徒', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={mockStudentNakao.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    const miniTestsMenu = screen.queryByText('小テスト結果');
    if (miniTestsMenu) {
      await act(async () => {
        fireEvent.click(miniTestsMenu);
      });
    }

    // 小テスト結果管理テーブルが表示されることを待機
    await waitFor(() => {
      expect(screen.getByText('小テスト結果管理')).toBeDefined();
    });

    // 生徒名セルに「中尾 謙信」が表示され、「不明な生徒」ではないことを検証
    const studentCell = await screen.findByTestId('minitest-student-name-mini-nakao-test-1');
    expect(studentCell).toBeDefined();
    expect(studentCell.textContent).toBe('中尾 謙信');
    expect(screen.queryAllByText('不明な生徒').length).toBe(0);
  });

  it('2. should save score, status (passed), and completed_at upon 撃破報告（保存） in StudentDashboard and sync to TeacherDashboard', async () => {
    // 1. 生徒画面を開く
    const { unmount } = render(
      <StudentDashboard
        student={mockStudentNakao}
        initialDate={todayStr}
      />
    );

    // 本日のテストカードと撃破報告ボタンを検証
    const scoreInput = await screen.findByTestId('test-score-input-mini-nakao-test-1');
    const saveBtn = await screen.findByTestId('test-save-btn-mini-nakao-test-1');
    expect(scoreInput).toBeDefined();
    expect(saveBtn).toBeDefined();

    // 点数「90」を入力
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '90' } });
    });

    // 撃破報告（保存）をクリック
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // 生徒画面で合格バッジが表示されることを検証
    await waitFor(() => {
      expect(screen.getByText(/合格 ✨/i)).toBeDefined();
    });

    // DB / LocalStorage に score: 90, passed: true, status: 'passed', completed_at が永続化されたことを検証
    const savedResults = db.getMiniTestResults();
    const updatedTest = savedResults.find(r => r.id === 'mini-nakao-test-1');
    expect(updatedTest).toBeDefined();
    expect(updatedTest?.score).toBe(90);
    expect(updatedTest?.passed).toBe(true);
    expect(updatedTest?.status).toBe('passed');
    expect(updatedTest?.completed_at).toBeDefined();

    unmount();

    // 2. 講師管理画面（小テスト結果管理）を開く
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={mockStudentNakao.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    const miniTestsMenu = screen.queryByText('小テスト結果');
    if (miniTestsMenu) {
      await act(async () => {
        fireEvent.click(miniTestsMenu);
      });
    }

    // 生徒名「中尾 謙信」の表示を確認
    const studentCell = await screen.findByTestId('minitest-student-name-mini-nakao-test-1');
    expect(studentCell.textContent).toBe('中尾 謙信');

    // 点数「90」および合否セレクトが「passed」（合格）になっていることを検証
    await waitFor(() => {
      const statusSelect = screen.getByTestId('minitest-status-select-mini-nakao-test-1') as HTMLSelectElement;
      expect(statusSelect.value).toBe('passed');
    });
  });
});
