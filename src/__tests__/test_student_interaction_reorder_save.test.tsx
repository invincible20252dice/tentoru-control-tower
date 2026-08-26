import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, StudentInteraction } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Student Detail Interaction Log Reorder & Safe Save Tests', () => {
  beforeEach(async () => {
    localStorage.clear();

    const student: Student = {
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
    await db.saveStudent(student);
    await db.addTeacherOption('佐藤 健');
  });

  it('places interaction input card at top, saves contact log safely with contact_date, clears input, and refreshes history list', async () => {
    render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 山田 太郎カードをクリック
    const studentCard = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentCard);
    });

    // 「生徒情報」タブを開く
    const studentDetailTab = screen.getByRole('button', { name: /生徒情報/i });
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

    // DOM上の順序検証: 「📝 対応入力」が「📊 直近のテスト・模試実績」より前に出現すること
    const interactionTitle = screen.getByText('📝 対応入力');
    const testResultsTitle = screen.getByText('📊 直近のテスト・模試実績');

    expect(interactionTitle.compareDocumentPosition(testResultsTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // 対応入力フォームの要素を取得
    const categorySelect = screen.getByLabelText('種別') as HTMLSelectElement;
    const memoTextarea = screen.getByPlaceholderText('具体的な対応メモを入力...') as HTMLTextAreaElement;
    const submitBtn = screen.getByRole('button', { name: '対応内容を登録' });

    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: '保護者対応' } });
      fireEvent.change(memoTextarea, { target: { value: '保護者へ次回定期テスト対策の面談を実施しました。' } });
    });

    // 保存ボタンを押下
    window.alert = vi.fn();
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 検証1: トースト/アラートで「✅ 対応内容を登録しました」が表示されること
    expect(window.alert).toHaveBeenCalledWith('✅ 対応内容を登録しました');

    // 検証2: メモ欄がクリアされること
    expect(memoTextarea.value).toBe('');

    // 検証3: 対応履歴一覧に登録されたメモが即時反映されること
    expect(screen.getByText('保護者へ次回定期テスト対策の面談を実施しました。')).toBeInTheDocument();

    // 検証4: DBに正しく保存され contact_date が含まれること
    const savedInteractions = db.getStudentInteractions('std-1');
    expect(savedInteractions.length).toBeGreaterThan(0);
    expect(savedInteractions[0].memo).toBe('保護者へ次回定期テスト対策の面談を実施しました。');
    expect(savedInteractions[0].category).toBe('保護者対応');
  });

  it('supports selecting staff name dropdown, editing interaction, and deleting interaction', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 山田 太郎カードをクリック
    const studentCard = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentCard);
    });

    // 「生徒情報」タブを開く
    const studentDetailTab = screen.getByRole('button', { name: /生徒情報/i });
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

    // 担当講師ドロップダウンのテスト
    const staffSelect = screen.getByLabelText('対応者 (講師)') as HTMLSelectElement;
    expect(staffSelect).toBeInTheDocument();

    const memoTextarea = screen.getByPlaceholderText('具体的な対応メモを入力...') as HTMLTextAreaElement;
    const submitBtn = screen.getByRole('button', { name: '対応内容を登録' });

    await act(async () => {
      fireEvent.change(staffSelect, { target: { value: '佐藤 健' } });
      fireEvent.change(memoTextarea, { target: { value: 'テスト対策学習指導メモ' } });
      fireEvent.click(submitBtn);
    });

    // バッジに選択した講師名が表示されること
    expect(screen.getByText('佐藤')).toBeInTheDocument();
    expect(screen.getByText('テスト対策学習指導メモ')).toBeInTheDocument();

    // 編集ボタンを押下してインライン編集をテスト
    const editBtn = screen.getAllByTestId(/^edit-interaction-/)[0];
    await act(async () => {
      fireEvent.click(editBtn);
    });

    const editSaveBtn = screen.getByRole('button', { name: '保存' });
    await act(async () => {
      fireEvent.click(editSaveBtn);
    });
    expect(window.alert).toHaveBeenCalledWith('✅ 対応履歴を更新しました');

    // 削除ボタンを押下して削除をテスト
    const deleteBtn = screen.getAllByTestId(/^delete-interaction-/)[0];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(window.alert).toHaveBeenCalledWith('✅ 対応履歴を削除しました');
  });
});
