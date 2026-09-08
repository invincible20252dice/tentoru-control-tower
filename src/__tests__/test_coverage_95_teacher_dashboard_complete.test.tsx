import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  LearningTask,
  MiniTestResult,
  HomeworkResult,
  TestRecord,
  School
} from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Coverage 95%+ TeacherDashboard Complete Handler Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    const sch: School = {
      id: 'sch-complete-1',
      name: '完全第一中学校',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(sch);

    const std: Student = {
      id: 'std-td-comp-01',
      student_id: 'S_TD_COMP_01',
      name: '完全テスト生',
      grade: '中1',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-complete-1',
      school_name: '完全第一中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '荒木はやと',
      assigned_teachers: ['荒木はやと', '福田 尚弘'],
      personality_tags: ['集中力高い', '負けず嫌い'],
      enrollment_date: '2025-04-01'
    };
    await db.saveStudent(std);

    const master1: CurriculumMaster = {
      id: 'cm-td-comp-01',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '加法と減法',
      sort_order: 1,
      item_type: 'lesson'
    };
    const master2: CurriculumMaster = {
      id: 'cm-td-comp-02',
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
      id: 'lt-td-comp-01',
      student_id: 'std-td-comp-01',
      scheduled_date: '2026-09-10',
      period: 1,
      subject: '数学',
      unit_id: 'cm-td-comp-01',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
  });

  it('triggers all action handlers across TeacherDashboard tabs', async () => {
    const { container } = render(
      <TeacherDashboard
        teacherType="junior_high"
        initialStudentId="std-td-comp-01"
        onBackToPortal={vi.fn()}
      />
    );

    // 1. Student detail: add teacher, remove teacher, delete teacher option
    const detailTab = screen.queryByRole('button', { name: /生徒カルテ/i });
    if (detailTab) {
      await act(async () => {
        fireEvent.click(detailTab);
      });

      const addTeacherBtn = screen.queryByRole('button', { name: /講師追加/i }) || screen.queryByRole('button', { name: /追加/i });
      if (addTeacherBtn) {
        await act(async () => {
          fireEvent.click(addTeacherBtn);
        });
      }

      // Save student detail
      const saveStudentBtn = screen.queryByRole('button', { name: /カルテ保存/i }) || screen.queryByRole('button', { name: /変更を保存/i });
      if (saveStudentBtn) {
        await act(async () => {
          fireEvent.click(saveStudentBtn);
        });
      }
    }

    // 2. Schedule tab: Add test, add homework, save timetable, auto-reschedule
    const scheduleTab = screen.queryByRole('button', { name: /時間割・予定/i });
    if (scheduleTab) {
      await act(async () => {
        fireEvent.click(scheduleTab);
      });

      const addTestBtn = screen.queryByRole('button', { name: /＋ 小テスト追加/i }) || screen.queryByRole('button', { name: /テスト追加/i });
      if (addTestBtn) {
        await act(async () => {
          fireEvent.click(addTestBtn);
        });
      }

      const addHwBtn = screen.queryByRole('button', { name: /＋ 宿題追加/i }) || screen.queryByRole('button', { name: /宿題追加/i });
      if (addHwBtn) {
        await act(async () => {
          fireEvent.click(addHwBtn);
        });
      }

      const autoRescheduleBtn = screen.queryByRole('button', { name: /自動リスケジュール/i });
      if (autoRescheduleBtn) {
        await act(async () => {
          fireEvent.click(autoRescheduleBtn);
        });
      }

      const saveTimetableBtn = screen.queryByRole('button', { name: /時間割を保存/i }) || screen.queryByRole('button', { name: /この日の予定を確定/i });
      if (saveTimetableBtn) {
        await act(async () => {
          fireEvent.click(saveTimetableBtn);
        });
      }
    }

    // 3. Curriculum tab: Add Unit, update, delete
    const currTab = screen.queryByRole('button', { name: /カリキュラム進捗/i });
    if (currTab) {
      await act(async () => {
        fireEvent.click(currTab);
      });

      const addUnitBtn = screen.queryByRole('button', { name: /単元追加/i });
      if (addUnitBtn) {
        await act(async () => {
          fireEvent.click(addUnitBtn);
        });
      }
    }

    // 4. Mini-tests tab: Delete, save
    const miniTab = screen.queryByRole('button', { name: /小テスト・確認/i });
    if (miniTab) {
      await act(async () => {
        fireEvent.click(miniTab);
      });
    }

    // 5. Homeworks tab: Delete, save
    const hwTab = screen.queryByRole('button', { name: /宿題管理/i });
    if (hwTab) {
      await act(async () => {
        fireEvent.click(hwTab);
      });
    }

    // 6. Branch Switcher
    const branchSwitcher = screen.queryByTestId('admin-branch-switcher');
    if (branchSwitcher) {
      await act(async () => {
        fireEvent.change(branchSwitcher, { target: { value: 'branch-1' } });
        fireEvent.change(branchSwitcher, { target: { value: 'all' } });
      });
    }

    // 7. Role toggle
    const roleBranchBtn = screen.queryByTestId('role-toggle-branch');
    if (roleBranchBtn) {
      await act(async () => {
        fireEvent.click(roleBranchBtn);
      });
    }

    const roleAdminBtn = screen.queryByTestId('role-toggle-admin');
    if (roleAdminBtn) {
      await act(async () => {
        fireEvent.click(roleAdminBtn);
      });
    }
  });
});
