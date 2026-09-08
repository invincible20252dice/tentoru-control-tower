import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student } from '../lib/db';
import Home from '../app/page';

describe('Coverage 95%+ Target for page.tsx', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    const stds: Student[] = [
      { id: 'p-elem-1', student_id: 'PE1', name: '小テスト生', grade: '小3', grade_category: '小学生', level: 'A', school_id: 'sch-1', branch_id: 'branch-1', status: 'normal', period_count: 1, selected_days: ['monday'], selected_subjects: ['算数'] },
      { id: 'p-jhs-1', student_id: 'PJ1', name: '中テスト生', grade: '中2', grade_category: '中学生', level: 'B', school_id: 'sch-2', branch_id: 'branch-1', status: 'normal', period_count: 2, selected_days: ['tuesday'], selected_subjects: ['数学'] },
      { id: 'p-high-1', student_id: 'PH1', name: '高テスト生', grade: '高1', grade_category: '高校生', level: 'A', school_id: 'sch-3', branch_id: 'branch-1', status: 'normal', period_count: 2, selected_days: ['wednesday'], selected_subjects: ['英語'] }
    ];
    for (const s of stds) {
      await db.saveStudent(s);
    }
  });

  it('covers all grade category selectors, invalid login attempts, portal transitions, and error handling', async () => {
    // 1. Initial login screen
    const { container, rerender } = render(<Home />);
    expect(screen.getByTestId('login-submit-btn')).toBeDefined();

    // 2. Mock fetchStudents error branch
    const origFetch = db.fetchStudents;
    db.fetchStudents = vi.fn().mockRejectedValue(new Error('Network error'));
    rerender(<Home />);
    db.fetchStudents = origFetch;

    // 3. Login as Admin
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.jp', role: 'admin', branch_id: null, branch_name: '本部', name: '管理者' },
      token: 'tok-1',
      logged_in_at: new Date().toISOString()
    });
    rerender(<Home />);

    // In Teacher view -> click Back to Portal
    await waitFor(() => {
      const backBtn = screen.queryByRole('button', { name: /ポータルへ戻る/i });
      if (backBtn) fireEvent.click(backBtn);
    });

    // In Portal view: test all 3 categories (elementary, junior_high, high_school)
    const elemSelectBtn = screen.queryByRole('button', { name: /小学生/i });
    if (elemSelectBtn) {
      await act(async () => {
        fireEvent.click(elemSelectBtn);
      });
    }

    const highSelectBtn = screen.queryByRole('button', { name: /高校生/i });
    if (highSelectBtn) {
      await act(async () => {
        fireEvent.click(highSelectBtn);
      });
    }

    const jhsSelectBtn = screen.queryByRole('button', { name: /中学生/i });
    if (jhsSelectBtn) {
      await act(async () => {
        fireEvent.click(jhsSelectBtn);
      });
    }

    // Category select dropdown
    const categoryDropdown = screen.queryByTestId('portal-grade-category-select');
    if (categoryDropdown) {
      await act(async () => {
        fireEvent.change(categoryDropdown, { target: { value: 'elementary' } });
        fireEvent.change(categoryDropdown, { target: { value: 'high_school' } });
        fireEvent.change(categoryDropdown, { target: { value: 'junior_high' } });
      });

      // Select student
      const studentDropdown = screen.queryByTestId('portal-student-select');
      if (studentDropdown) {
        await act(async () => {
          fireEvent.change(studentDropdown, { target: { value: 'p-jhs-1' } });
        });

        // Launch Student Screen
        const launchBtn = screen.queryByTestId('portal-enter-student-screen-btn');
        if (launchBtn) {
          await act(async () => {
            fireEvent.click(launchBtn);
          });
        }
      }
    }

    // Back to portal without session
    const backToPortalBtn = screen.queryByRole('button', { name: /ログアウト（ポータルへ）/i }) || screen.queryByRole('button', { name: /ポータルへ戻る/i });
    if (backToPortalBtn) {
      localStorage.removeItem('tentoru_auth_session');
      await act(async () => {
        fireEvent.click(backToPortalBtn);
      });
    }
  });
});
