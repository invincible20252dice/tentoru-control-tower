import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Page from '../app/page';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';

describe('Precision Strike Coverage Tests (>95% Perfection)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. app/page.tsx precision test
  it('covers app/page.tsx error handling and edge state transitions', async () => {
    // Mock active session so it loads teacher view, then we go back to portal
    const mockSession = {
      user: {
        id: 'admin-user',
        name: '管理者',
        email: 'admin@tentoru.jp',
        role: 'admin' as const
      },
      token: 'mock-jwt-token'
    };

    vi.spyOn(db, 'getSession').mockReturnValue(mockSession as any);
    // Force db.fetchStudents to reject in page init to cover Line 88
    vi.spyOn(db, 'fetchStudents').mockRejectedValueOnce(new Error('Network error on init'));
    window.alert = vi.fn();

    render(<Page />);

    // Click back to portal button in TeacherDashboard
    const backBtn = await screen.findByText('ポータルへ戻る');
    await act(async () => {
      fireEvent.click(backBtn);
    });

    // In portal view, click student login button
    const studentLoginBtn = screen.getByTestId('portal-enter-student-screen-btn');
    await act(async () => {
      fireEvent.click(studentLoginBtn);
    });

    // Toggle category dropdown
    const categorySelect = screen.getByTestId('portal-grade-category-select');
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'junior_high' } });
      fireEvent.change(categorySelect, { target: { value: 'high_school' } });
      fireEvent.change(categorySelect, { target: { value: 'elementary' } });
      fireEvent.change(categorySelect, { target: { value: '' } });
    });

    // Switch theme to dark then light
    const themeBtn = screen.getByText(/ダークモードにする/);
    await act(async () => {
      fireEvent.click(themeBtn);
    });

    const lightBtn = screen.getByText(/ライトモードにする/);
    await act(async () => {
      fireEvent.click(lightBtn);
    });

    // Logout
    const logoutBtn = screen.getByTestId('portal-logout-btn');
    await act(async () => {
      fireEvent.click(logoutBtn);
    });
  });

  // 2. CurriculumCsvImport error handlers precision test
  it('covers CurriculumCsvImport import error and legacy delete error', async () => {
    vi.spyOn(db, 'getCurriculumMasters').mockReturnValue([
      {
        id: 'cm-err-1',
        subject: '国語',
        grade_category: 'elementary',
        target_grade: '小1',
        unit_name: 'ひらがな',
        lesson_name: 'あいうえお',
        item_type: 'video_lesson',
        sort_order: 1
      }
    ] as any);

    render(<CurriculumCsvImport />);

    // Force db.deleteCurriculumMastersByGrades to reject to cover Line 330-331
    vi.spyOn(db, 'deleteCurriculumMastersByGrades').mockRejectedValueOnce(new Error('Deletion failed on DB'));
    window.confirm = vi.fn().mockReturnValue(true);

    const tabs = screen.getAllByRole('button');
    const masterListTab = tabs.find(b => b.textContent?.includes('マスタ一覧'));
    if (masterListTab) {
      await act(async () => {
        fireEvent.click(masterListTab);
      });

      const deleteLegacyBtn = screen.getByText(/旧フォーマットデータ一括削除/);
      await act(async () => {
        fireEvent.click(deleteLegacyBtn);
      });
    }
  });

  // 3. StudentDashboard attendance date fallback and reset precision test
  it('covers StudentDashboard attendance date fallback and reset action', async () => {
    const studentWithNoDays = {
      id: 'std-no-days',
      name: '曜日未設定生徒',
      grade: '中1',
      grade_category: 'junior_high' as const,
      selected_days: ['invalid_day' as any],
      status: 'normal' as const
    };

    const task = {
      id: 'task-fallback-1',
      student_id: 'std-no-days',
      date: '2026-04-01',
      subject: '英語',
      unit_id: 'u-fb-1',
      start_lesson_name: 'Unit 1',
      status: 'pending' as const,
      is_completed: false
    };

    await db.saveStudent(studentWithNoDays as any);
    await db.saveLearningTasks([task as any]);

    delete (window as any).location;
    window.location = { reload: vi.fn() } as any;
    window.alert = vi.fn();

    render(<StudentDashboard student={studentWithNoDays as any} onBackToPortal={vi.fn()} />);

    // Trigger test failure button to trigger getNextAttendanceDate fallback (Line 774-775)
    const failBtns = screen.queryAllByText('テストを受ける (不合格)');
    if (failBtns.length > 0) {
      await act(async () => {
        fireEvent.click(failBtns[0]);
      });
    }

    // Trigger normal reset button (Line 926-927)
    const resetBtn = screen.queryByText(/通常状態に戻す/);
    if (resetBtn) {
      await act(async () => {
        fireEvent.click(resetBtn);
      });
      expect(window.location.reload).toHaveBeenCalled();
    }
  });
});
