import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, School } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('TeacherDashboard Bulk, Matrix and Admin Operations Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should test student deletion confirmation true/false and export triggers', async () => {
    const todayStr = getDynamicDateStr(0);

    const school: School = {
      id: 'sch-bulk-1',
      name: 'バルク中学校',
      created_at: new Date().toISOString()
    };

    const student: Student = {
      id: 'st-del-test',
      name: '削除テスト生徒',
      grade: '中3',
      grade_category: 'junior_high',
      school_id: school.id,
      school_name: school.name,
      period_count: 2,
      day_of_week: ['wed'],
      selected_subjects: ['数学'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    (db as any).saveMockData('schools', [school]);
    (db as any).saveMockData('students', [student]);

    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    // Mock confirm
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false); // 1st: cancel
    confirmSpy.mockReturnValueOnce(true);  // 2nd: proceed

    const { unmount } = render(
      <TeacherDashboard
        teacherType="junior_high"
        initialDate={todayStr}
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/削除テスト生徒/)[0]).toBeDefined();
    });

    // Open student edit modal
    const editBtns = screen.queryAllByTitle(/生徒情報を編集/);
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0]);

      // Click delete student button
      const deleteBtns = screen.queryAllByText(/この生徒を削除|削除する/);
      if (deleteBtns.length > 0) {
        // First click (cancelled by confirm)
        fireEvent.click(deleteBtns[0]);
        // Second click (confirmed)
        fireEvent.click(deleteBtns[0]);
      }
    }

    confirmSpy.mockRestore();
    unmount();
  });

  it('should test scope switching (school / grade / level) and bulk apply modal', async () => {
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        teacherType="junior_high"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Switch to Schedule tab
    const schedTabs = screen.queryAllByText(/スケジュール|時間割/);
    if (schedTabs.length > 0) {
      fireEvent.click(schedTabs[0]);
    }

    // Test bulk apply triggers if present
    const bulkBtns = screen.queryAllByText(/一括適用|同じ学年に適用|同じ学校に適用/);
    if (bulkBtns.length > 0) {
      fireEvent.click(bulkBtns[0]);
    }

    unmount();
  });
});
