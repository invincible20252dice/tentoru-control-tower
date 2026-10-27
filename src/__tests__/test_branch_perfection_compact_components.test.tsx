import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginForm } from '../components/LoginForm';
import { WeeklyScheduleViewer } from '../components/WeeklyScheduleViewer';
import { StudentScheduleConfigForm } from '../components/StudentScheduleConfigForm';
import { BranchManagement } from '../components/BranchManagement';
import TimelineSubjectView from '../components/TimelineSubjectView';
import { db } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('Compact Components Branch Perfection Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --- 1. LoginForm ---
  describe('LoginForm Branch Coverage', () => {
    it('covers error with custom message and fallback message, and catch blocks with/without message', async () => {
      const onLoginSuccess = vi.fn();

      // Test 1: signInWithPassword fails with custom error
      vi.spyOn(db, 'signInWithPassword').mockResolvedValueOnce({
        success: false,
        error: 'カスタムエラーメッセージ'
      });

      render(<LoginForm onLoginSuccess={onLoginSuccess} />);
      const emailInput = screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('カスタムエラーメッセージ')).toBeDefined();
      });

      // Test 2: signInWithPassword fails without error message (triggers line 40 fallback)
      vi.spyOn(db, 'signInWithPassword').mockResolvedValueOnce({
        success: false
      });
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText(/ログインに失敗しました。メールアドレスとパスワードをご確認ください。/i)).toBeDefined();
      });

      // Test 3: throws exception with message
      vi.spyOn(db, 'signInWithPassword').mockRejectedValueOnce(new Error('例外エラー発生'));
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText('例外エラー発生')).toBeDefined();
      });

      // Test 4: throws exception without message (triggers line 43 fallback)
      vi.spyOn(db, 'signInWithPassword').mockRejectedValueOnce({});
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(screen.getByText('予期せぬエラーが発生しました。')).toBeDefined();
      });
    });
  });

  // --- 2. WeeklyScheduleViewer ---
  describe('WeeklyScheduleViewer Branch Coverage', () => {
    it('covers fallback day, tasks without id, and tasks with/without office_note in day and week view', () => {
      const todayStr = getDynamicDateStr(0);
      const tasks = [
        {
          id: '',
          student_id: 's1',
          unit_id: 'u1',
          subject: '数学',
          scheduled_date: todayStr,
          period: 1,
          status: 'pending',
          office_note: '特設補習コマ'
        },
        {
          id: undefined as any,
          student_id: 's1',
          unit_id: 'u2',
          subject: '英語',
          scheduled_date: todayStr,
          period: 2,
          status: 'pending',
          office_note: ''
        }
      ];

      // Provide invalid currentDateStr to trigger DAY_KEYS fallback (line 32)
      const { rerender } = render(
        <WeeklyScheduleViewer
          tasks={tasks as any}
          scheduleConfig={{
            weekly_frequency: '2回',
            weekly_duration: '120分',
            selected_days: ['tuesday', 'friday'],
            default_slots: 2
          }}
          currentDateStr="invalid-date-string"
        />
      );

      // Switch to Day view
      const dayViewBtn = screen.getByRole('button', { name: /日表示/i });
      fireEvent.click(dayViewBtn);

      // Click Tuesday button to see tasks
      const tuesdayBtn = screen.getByRole('button', { name: /火/i });
      fireEvent.click(tuesdayBtn);

      expect(screen.getByText('特設補習コマ')).toBeDefined();
      expect(screen.getByText('個別学習コマ 2')).toBeDefined();

      // Click Wednesday (not in selectedDays) to trigger "通塾日外のため" branch
      const wednesdayBtn = screen.getByRole('button', { name: /水/i });
      fireEvent.click(wednesdayBtn);
      expect(screen.getByText(/通塾日外のため「授業予定なし」/i)).toBeDefined();

      // Also render with empty selectedDays to trigger getNextSchoolDayKey null branches
      rerender(
        <WeeklyScheduleViewer
          tasks={tasks as any}
          scheduleConfig={{
            weekly_frequency: '0回',
            weekly_duration: '60分',
            selected_days: [],
            default_slots: 1
          }}
          currentDateStr={todayStr}
        />
      );
    });
  });

  // --- 3. StudentScheduleConfigForm ---
  describe('StudentScheduleConfigForm Branch Coverage', () => {
    it('covers elementary vs junior_high defaults, empty selected_days, and error messages', async () => {
      // Mock db.getStudentScheduleConfig with sparse object
      vi.spyOn(db, 'getStudentScheduleConfig').mockReturnValueOnce({
        student_id: 's1',
        weekly_frequency: '',
        weekly_duration: '',
        selected_days: null as any,
        default_slots: 0
      } as any);

      const onSaved = vi.fn();
      const { unmount } = render(
        <StudentScheduleConfigForm
          studentId="s1"
          gradeType="elementary"
          onSaved={onSaved}
        />
      );

      // Verify defaults applied
      expect(screen.getByText(/小学生向け/i)).toBeDefined();

      // Toggle a day chip
      const wednesdayChip = screen.getByRole('button', { name: /水曜日/i });
      fireEvent.click(wednesdayChip);

      unmount();

      // Test with junior high and undefined config
      vi.spyOn(db, 'getStudentScheduleConfig').mockReturnValueOnce(undefined);
      render(
        <StudentScheduleConfigForm
          studentId="s2"
          gradeType="junior_high"
          onSaved={onSaved}
        />
      );
      expect(screen.getByText(/中学生向け/i)).toBeDefined();

      // Test loading state by returning an unsettled promise during save
      let resolveSave: any;
      vi.spyOn(db, 'saveStudentScheduleConfig').mockImplementationOnce(() => new Promise(res => { resolveSave = res; }));
      
      const saveBtn = screen.getByRole('button', { name: /通塾設定を保存する/i });
      fireEvent.click(saveBtn);

      // Verify button changes to "保存中..." and has disabled/opacity styling
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /保存中.../i })).toBeDefined();
      });

      // Resolve the save
      resolveSave();
      await waitFor(() => {
        expect(onSaved).toHaveBeenCalled();
      });
    });
  });

  // --- 4. BranchManagement ---
  describe('BranchManagement Branch Coverage', () => {
    it('covers API error with fallback, status toggle active and inactive, and custom event dispatch', async () => {
      const branch1 = {
        id: 'b1',
        name: '新所沢校',
        code: 'shintokorozawa',
        email: 'shin@tentoru.com',
        phone: '04-1111-2222',
        address: '埼玉県所沢市',
        status: 'active' as const,
        created_at: getDynamicDateStr(-10),
        updated_at: getDynamicDateStr(-1)
      };
      const branch2 = {
        ...branch1,
        id: 'b2',
        name: '東所沢校',
        status: 'inactive' as const
      };

      vi.spyOn(db, 'getBranches').mockReturnValue([branch1, branch2]);
      const toggleMock = vi.spyOn(db, 'toggleBranchStatus').mockResolvedValue(true);
      const onUpdated = vi.fn();

      render(<BranchManagement onBranchesUpdated={onUpdated} />);

      await waitFor(() => {
        expect(screen.getByText('新所沢校')).toBeDefined();
      });

      // Dispatch tentoru_branches_updated window event
      window.dispatchEvent(
        new CustomEvent('tentoru_branches_updated', {
          detail: { branches: [branch1] }
        })
      );
      expect(onUpdated).toHaveBeenCalled();

      // Dispatch without branches detail to cover falsy branch
      window.dispatchEvent(new CustomEvent('tentoru_branches_updated', { detail: null }));

      // Test toggle branch status for active using title
      const suspendBtn = await screen.findByTitle('アカウントを一時停止');
      fireEvent.click(suspendBtn);
      await waitFor(() => {
        expect(toggleMock).toHaveBeenCalledWith('b1');
      });

      // Test toggle branch status for inactive
      const resumeBtn = await screen.findByTitle('アカウントを有効化');
      fireEvent.click(resumeBtn);
      await waitFor(() => {
        expect(toggleMock).toHaveBeenCalledWith('b2');
      });

      // Test Create Branch with API failure throwing Error without error message (line 116 fallback)
      // and db.createBranchAccount failing without message (line 155 fallback)
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({}) // no error field -> triggers line 116 fallback
      });
      vi.spyOn(db, 'createBranchAccount').mockRejectedValueOnce({}); // no message -> triggers line 155 fallback

      const openCreateBtn = screen.getByTestId('open-create-branch-modal');
      fireEvent.click(openCreateBtn);

      const nameInput = screen.getByPlaceholderText(/例: 横浜教室/i);
      const emailInput = screen.getByPlaceholderText(/例: yokohama@tentoru.jp/i);
      fireEvent.change(nameInput, { target: { value: '狭山校' } });
      fireEvent.change(emailInput, { target: { value: 'sayama@tentoru.com' } });

      const submitCreateBtn = screen.getByRole('button', { name: /アカウントを発行する/i });
      fireEvent.click(submitCreateBtn);

      await waitFor(() => {
        expect(screen.getByText(/アカウント作成に失敗しました/i)).toBeDefined();
      });

      // Also test successful API path with resData.branch
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ branch: { ...branch1, id: 'b4', name: '川越校' } })
      });
      const saveBranchMock = vi.spyOn(db, 'saveBranch').mockResolvedValueOnce(true as any);
      fireEvent.click(openCreateBtn);
      fireEvent.change(screen.getByPlaceholderText(/例: 横浜教室/i), { target: { value: '川越校' } });
      fireEvent.change(screen.getByPlaceholderText(/例: yokohama@tentoru.jp/i), { target: { value: 'kawagoe@tentoru.com' } });
      fireEvent.click(screen.getByRole('button', { name: /アカウントを発行する/i }));
      await waitFor(() => {
        expect(saveBranchMock).toHaveBeenCalled();
      });
    });
  });

  // --- 5. TimelineSubjectView ---
  describe('TimelineSubjectView Branch Coverage', () => {
    it('covers task lesson id variants, subject matching, unit test matching, and step ordering', () => {
      const todayStr = getDynamicDateStr(0);
      const tomorrowStr = getDynamicDateStr(1);
      const student = {
        id: 'st_1',
        name: 'テスト生徒',
        grade: '中2',
        completed_lesson_ids: ['step_1', '10']
      };

      const timelineUnits = [
        {
          id: 'step_1',
          unit_name: '一次関数',
          name: '一次関数の基礎',
          lesson_name: '一次関数の基礎',
          sort_order: 10,
          item_type: 'lesson'
        },
        {
          id: 'step_2',
          unit_name: '一次関数',
          name: '一次関数 単元確認テスト',
          lesson_name: '一次関数 単元確認テスト',
          sort_order: 20,
          item_type: 'unit_test'
        },
        {
          id: 'step_3',
          unit_name: '連立方程式',
          name: '連立方程式の応用',
          sort_order: 30
        },
        {
          id: '', // falsy id to cover line 218 idx fallback
          unit_name: '平面図形',
          name: '図形の性質',
          sort_order: undefined // undefined sort_order to cover lines 140, 209
        }
      ];

      // Student tasks with single unit_id, start_lesson_id, end_lesson_id (lines 89-91)
      const studentTasks = [
        {
          id: 't_1',
          student_id: 'st_1',
          subject: '算数', // Math compatibility check
          unit_id: 'step_1',
          start_lesson_id: 'step_1',
          end_lesson_id: 'step_1',
          scheduled_date: todayStr,
          period: 1,
          status: 'pending'
        },
        {
          id: 't_2',
          student_id: 'st_1',
          subject: '英語', // non-target subject
          scheduled_date: todayStr,
          period: 2,
          status: 'pending'
        },
        {
          id: 't_3',
          student_id: 'st_1',
          subject: undefined, // undefined subject to cover line 85 (!sub)
          scheduled_date: todayStr,
          period: 3,
          status: 'pending'
        }
      ];

      const miniTestResults = [
        {
          student_id: 'st_1',
          subject: '数学',
          date: todayStr,
          unit_name: '一次関数',
          test_content: '一次関数 単元確認テスト',
          passed: false
        }
      ];

      const onDateChange = vi.fn();

      const { rerender } = render(
        <TimelineSubjectView
          student={student as any}
          subject="数学"
          timelineUnits={timelineUnits as any}
          studentTasks={studentTasks as any}
          miniTestResults={miniTestResults as any}
          scheduleDate={todayStr}
          onDateChange={onDateChange}
        />
      );

      // Verify rendering
      expect(screen.getByText('一次関数の基礎')).toBeDefined();

      // Trigger "今日" button
      const todayBtn = screen.getByRole('button', { name: /今日/i });
      fireEvent.click(todayBtn);
      expect(onDateChange).toHaveBeenCalled();

      // Rerender with different targetDate to trigger lines 66-67
      rerender(
        <TimelineSubjectView
          student={{ ...student, completed_lesson_ids: undefined } as any}
          subject="数学"
          timelineUnits={timelineUnits as any}
          studentTasks={studentTasks as any}
          miniTestResults={miniTestResults as any}
          targetDate={tomorrowStr}
          onDateChange={onDateChange}
        />
      );
    });
  });
});
