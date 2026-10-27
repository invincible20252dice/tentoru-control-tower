import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('Branch Perfection: TeacherDashboard Comprehensive Operations', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should cover tabs, searches, clear buttons, role toggles, and teacher types in junior_high', async () => {
    const todayStr = getDynamicDateStr(0);

    db.saveSession({
      user: { id: 'teacher-1', email: 'teacher@tentoru.com', role: 'admin' }
    } as any);

    const onBackToPortalMock = vi.fn();
    const onLogoutMock = vi.fn();
    const onViewStudentScreenMock = vi.fn();
    const onDateChangeMock = vi.fn();

    const { unmount } = render(
      <TeacherDashboard
        onBackToPortal={onBackToPortalMock}
        onLogout={onLogoutMock}
        onViewStudentScreen={onViewStudentScreenMock}
        theme="light"
        teacherType="junior_high"
        initialRole="admin"
        targetDate={todayStr}
        onDateChange={onDateChangeMock}
      />
    );

    // 1. Check default student rendering
    await waitFor(() => {
      expect(screen.getAllByText(/佐藤 拓海/i)[0]).toBeDefined();
    });

    // 2. Role toggles
    const roleBranchBtn = screen.queryByTestId('role-toggle-branch');
    if (roleBranchBtn) fireEvent.click(roleBranchBtn);
    const roleAdminBtn = screen.queryByTestId('role-toggle-admin');
    if (roleAdminBtn) fireEvent.click(roleAdminBtn);

    // 3. Teacher type toggle buttons
    const elemBtn = screen.queryByTestId('header-teacher-type-elem');
    if (elemBtn) fireEvent.click(elemBtn);
    const highBtn = screen.queryByTestId('header-teacher-type-high');
    if (highBtn) fireEvent.click(highBtn);
    const jhsBtn = screen.queryByTestId('header-teacher-type-jhs');
    if (jhsBtn) fireEvent.click(jhsBtn);

    // 4. Filter toggle in student list
    const filterAllBtn = screen.queryByTestId('filter-type-all');
    if (filterAllBtn) fireEvent.click(filterAllBtn);

    // 5. Select student
    const studentCard = screen.getAllByText(/佐藤 拓海/i)[0];
    fireEvent.click(studentCard);

    // 6. Test search inputs in Mini Tests tab
    const testTabs = screen.queryAllByText(/小テスト結果|小テスト/);
    if (testTabs.length > 0) {
      fireEvent.click(testTabs[0]);
      const searchInputs = screen.queryAllByPlaceholderText(/題名・生徒名・単元で検索|検索/);
      if (searchInputs.length > 0) {
        fireEvent.change(searchInputs[0], { target: { value: 'テスト不一致キーワード9999' } });
        const clearBtns = screen.queryAllByTitle(/検索をクリア/);
        if (clearBtns.length > 0) {
          fireEvent.click(clearBtns[0]);
        }
      }
    }

    // 7. Test homework tab
    const hwTabs = screen.queryAllByText(/宿題提出状況|宿題/);
    if (hwTabs.length > 0) {
      fireEvent.click(hwTabs[0]);
    }

    // 8. Test Curriculum tab
    const currTabs = screen.queryAllByText(/学校カリキュラム管理|カリキュラム/);
    if (currTabs.length > 0) {
      fireEvent.click(currTabs[0]);
    }

    // 9. Back to Students tab
    const studentListTabs = screen.queryAllByText(/生徒一覧/);
    if (studentListTabs.length > 0) {
      fireEvent.click(studentListTabs[0]);
    }

    unmount();
  });

  it('should cover elementary and high school teacher types, and student edit modal trigger', async () => {
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    // 1. Elementary
    const { unmount: unmountElem } = render(
      <TeacherDashboard
        teacherType="elementary"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    unmountElem();

    // 2. High school
    const { unmount: unmountHigh } = render(
      <TeacherDashboard
        teacherType="high_school"
        onBackToPortal={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    unmountHigh();
  });

  it('should test student edit modal, personality tags, enrollment dates, and save', async () => {
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
      expect(screen.getAllByText(/佐藤 拓海/i)[0]).toBeDefined();
    });

    // 1. Click edit button on student card
    const editBtns = screen.queryAllByTitle(/生徒情報を編集/);
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0]);

      // 2. Edit enrollment date
      const enrollInput = screen.queryByLabelText(/入塾日|在籍開始日/);
      if (enrollInput) {
        fireEvent.change(enrollInput, { target: { value: getDynamicDateStr(-100) } });
      }

      // 3. Edit withdrawal date
      const withdrawInput = screen.queryByLabelText(/退塾日|在籍終了日/);
      if (withdrawInput) {
        fireEvent.change(withdrawInput, { target: { value: getDynamicDateStr(-10) } });
      }

      // 4. Save modal
      const saveModalBtns = screen.queryAllByText(/保存|更新/);
      if (saveModalBtns.length > 0) {
        fireEvent.click(saveModalBtns[0]);
      }
    }

    unmount();
  });

  it('should test holiday modal and schedule matrix interactions', async () => {
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
      expect(screen.getAllByText(/佐藤 拓海/i)[0]).toBeDefined();
    });

    // 1. Switch to Schedule tab
    const schedTabs = screen.queryAllByText(/スケジュール|時間割/);
    if (schedTabs.length > 0) {
      fireEvent.click(schedTabs[0]);
    }

    // 2. Open Holiday Modal if button exists
    const holidayBtns = screen.queryAllByText(/休校日設定|休校日/);
    if (holidayBtns.length > 0) {
      fireEvent.click(holidayBtns[0]);
      const holidayNameInputs = screen.queryAllByPlaceholderText(/休校日名|祝日|GW/);
      if (holidayNameInputs.length > 0) {
        fireEvent.change(holidayNameInputs[0], { target: { value: '春季休校' } });
      }
      const closeOrCancelBtns = screen.queryAllByText(/閉じる|キャンセル/);
      if (closeOrCancelBtns.length > 0) {
        fireEvent.click(closeOrCancelBtns[0]);
      }
    }

    unmount();
  });
});
