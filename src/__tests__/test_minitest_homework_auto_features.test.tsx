import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, MiniTestResult, HomeworkResult } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('MiniTest and Homework Auto Features & Delete Unit Tests', () => {
  beforeEach(async () => {
    localStorage.clear();

    const student: Student = {
      id: 'std-auto-1',
      student_id: 'S001',
      name: '小テスト 太郎',
      grade: '小5',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['算数'],
      teacher_in_charge: '荒木はやと'
    };
    await db.saveStudent(student);

    const miniTest: MiniTestResult = {
      id: 'mini-auto-1',
      student_id: 'std-auto-1',
      date: '2026-08-27',
      subject: '算数',
      test_content: '小数のかけ算小テスト',
      score: null,
      passed: null,
      passing_line: '90点',
      target_scope: 'individual',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveMiniTestResult(miniTest);

    const yesterdayStr = '2026-08-25'; // 期限超過日
    const homework: HomeworkResult = {
      id: 'hw-auto-1',
      student_id: 'std-auto-1',
      date: '2026-08-20',
      subject: '算数',
      homework_content: '算数ドリル P.15',
      homework_deadline: yesterdayStr,
      status: 'incomplete',
      target_scope: 'individual',
      created_at: '2026-08-20T00:00:00.000Z'
    };
    await db.saveHomeworkResult(homework);
  });

  it('automatically calculates grade result, auto-saves on score input, and handles delete in mini-tests tab', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    render(<TeacherDashboard initialStudentId="std-auto-1" onBackToPortal={vi.fn()} />);

    // 「小テスト結果」タブを開く
    const miniTab = screen.getByRole('button', { name: /小テスト結果/i });
    await act(async () => {
      fireEvent.click(miniTab);
    });

    await waitFor(() => {
      expect(screen.getByText('小数のかけ算小テスト')).toBeInTheDocument();
    });

    // 点数入力 (95点 ➔ 合格判定)
    const scoreInput = screen.getByPlaceholderText('未入力') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '95' } });
    });

    // 合否セレクトボックスが「合格」に自動切替されたか検証
    const passedSelect = screen.getByDisplayValue('合格') as HTMLSelectElement;
    expect(passedSelect).toBeInTheDocument();

    // DB に自動保存されたか検証
    await waitFor(() => {
      const dbResult = db.getMiniTestResults().find(r => r.id === 'mini-auto-1');
      expect(dbResult?.score).toBe(95);
      expect(dbResult?.passed).toBe(true);
    });

    // 点数入力 (70点 ➔ 90点未満のため不合格判定)
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '70' } });
    });

    await waitFor(() => {
      const dbResult = db.getMiniTestResults().find(r => r.id === 'mini-auto-1');
      expect(dbResult?.score).toBe(70);
      expect(dbResult?.passed).toBe(false);
    });

    // 「🗑️ 削除」ボタン押下
    const deleteBtn = screen.getByRole('button', { name: /🗑️ 削除/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('削除してもよろしいですか'));

    // DB 及び画面からレコードが物理削除されたか検証
    await waitFor(() => {
      expect(screen.queryByText('小数のかけ算小テスト')).not.toBeInTheDocument();
      const deletedItem = db.getMiniTestResults().find(r => r.id === 'mini-auto-1');
      expect(deletedItem).toBeUndefined();
    });
  });

  it('displays overdue alert warning icon & highlight row, auto-saves status, and handles delete in homework tab', async () => {
    window.confirm = vi.fn().mockReturnValue(true);

    render(<TeacherDashboard initialStudentId="std-auto-1" onBackToPortal={vi.fn()} />);

    // 「宿題提出状況」タブを開く
    const hwTab = screen.getByRole('button', { name: /宿題提出状況/i });
    await act(async () => {
      fireEvent.click(hwTab);
    });

    await waitFor(() => {
      expect(screen.getByText('算数ドリル P.15')).toBeInTheDocument();
    });

    // 提出期限超過のアラート表示 (⚠️ 2026-08-25 (期限超過)) の存在検証
    expect(screen.getByText(/⚠️ 2026-08-25 \(期限超過\)/i)).toBeInTheDocument();

    // 提出状況を「提出済み」に変更して自動保存
    const statusSelect = screen.getByDisplayValue('未完') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
    });

    await waitFor(() => {
      const dbHw = db.getHomeworkResults().find(h => h.id === 'hw-auto-1');
      expect(dbHw?.status).toBe('completed');
    });

    // 「🗑️ 削除」ボタン押下
    const deleteBtn = screen.getByRole('button', { name: /🗑️ 削除/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('削除してもよろしいですか'));

    // DB 及び画面からレコードが物理削除されたか検証
    await waitFor(() => {
      expect(screen.queryByText('算数ドリル P.15')).not.toBeInTheDocument();
      const deletedHw = db.getHomeworkResults().find(h => h.id === 'hw-auto-1');
      expect(deletedHw).toBeUndefined();
    });
  });
});
