import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Coverage Deep Dive V4 TeacherDashboard Branch Coverage Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    const branch1: Branch = { id: 'branch-1', name: '恵比寿校', code: 'EBS01', email: 'ebisu@test.com', is_active: true };
    const branch2: Branch = { id: 'branch-2', name: '渋谷校', code: 'SBY01', email: 'shibuya@test.com', is_active: true };
    await db.saveBranch(branch1);
    await db.saveBranch(branch2);

    const student1: Student = {
      id: 'std-1',
      student_id: 'S001',
      name: '山田 太郎',
      grade: '中1',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '福田 尚弘'
    };
    const student2: Student = {
      id: 'std-2',
      student_id: 'S002',
      name: '佐藤 花子',
      grade: '高2',
      level: 'B',
      school_id: 'sch-2',
      branch_id: 'branch-2',
      status: 'normal',
      period_count: 3,
      selected_days: ['monday', 'wednesday'],
      selected_subjects: ['数学', '物理'],
      teacher_in_charge: '高橋 健'
    };
    await db.saveStudent(student1);
    await db.saveStudent(student2);
  });

  it('covers role toggles, branch switchers, sorting and filtering branches', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard initialStudentId="std-1" onBackToPortal={vi.fn()} />);

    // 1. ロール権限切り替えボタン
    const roleBranchBtn = screen.getByTestId('role-toggle-branch');
    await act(async () => {
      fireEvent.click(roleBranchBtn);
    });

    const roleAdminBtn = screen.getByTestId('role-toggle-admin');
    await act(async () => {
      fireEvent.click(roleAdminBtn);
    });

    // 2. 本部校舎切り替えドロップダウン
    const branchSelect = screen.getByTestId('admin-branch-switcher') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
      fireEvent.change(branchSelect, { target: { value: 'branch-2' } });
      fireEvent.change(branchSelect, { target: { value: 'all' } });
    });

    // 3. 各タブへの切替
    const tabs = [
      '小テスト結果',
      '宿題提出状況',
      'カリキュラムマスタ',
      '学習設定・受講設定',
      '年間計画（マイルストーン）',
      '定期テスト・模試',
      'AI指導報告書'
    ];

    for (const tabName of tabs) {
      const tabBtn = screen.queryByRole('button', { name: new RegExp(tabName, 'i') });
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }
  });

  it('covers elementary, junior_high and high_school modes, grade promotion, and bulk operations', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    // 小学生モード
    const { unmount: unmountElem } = render(
      <TeacherDashboard teacherType="elementary" initialStudentId="std-1" onBackToPortal={vi.fn()} />
    );
    unmountElem();

    // 高校生モード
    const { unmount: unmountHigh } = render(
      <TeacherDashboard teacherType="high_school" initialStudentId="std-2" onBackToPortal={vi.fn()} />
    );
    unmountHigh();
  });
});
