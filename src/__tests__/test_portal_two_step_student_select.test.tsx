import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student } from '../lib/db';
import Home from '../app/page';

describe('Portal 2-Step Student Select UI Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.signOut();

    // デモ用データの保存（小学生・中学生・高校生）
    const elemStudent: Student = {
      id: 'std-elem-01',
      student_id: 'S_ELEM01',
      name: '小林 咲良',
      grade: '小4',
      grade_category: '小学生',
      level: 'A',
      school_id: 'sch-elem-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday'],
      selected_subjects: ['算数'],
      created_at: new Date().toISOString()
    };

    const juniorStudent: Student = {
      id: 'std-junior-01',
      student_id: 'S_JUNIOR01',
      name: '佐藤 健太',
      grade: '中2',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-junior-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['数学'],
      created_at: new Date().toISOString()
    };

    const highStudent: Student = {
      id: 'std-high-01',
      student_id: 'S_HIGH01',
      name: '高橋 葵',
      grade: '高3',
      grade_category: '高校生',
      level: 'A',
      school_id: 'sch-high-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['wednesday'],
      selected_subjects: ['英語'],
      created_at: new Date().toISOString()
    };

    await db.saveStudent(elemStudent);
    await db.saveStudent(juniorStudent);
    await db.saveStudent(highStudent);
  });

  const renderPortalHome = async () => {
    db.saveSession({
      user: {
        id: 'usr-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        branch_id: 'branch-1'
      },
      expires_at: Date.now() + 3600 * 1000
    });
    const result = render(<Home />);
    await waitFor(() => {
      const backBtn = screen.queryByText(/ポータルへ戻る/i);
      if (backBtn) {
        fireEvent.click(backBtn);
      }
    });
    await waitFor(() => {
      expect(screen.getByTestId('portal-grade-category-select')).toBeInTheDocument();
    });
    return result;
  };

  it('renders disabled 2nd step dropdown initially until grade category is selected', async () => {
    await renderPortalHome();

    const categorySelect = screen.getByTestId('portal-grade-category-select') as HTMLSelectElement;
    const studentSelect = screen.getByTestId('portal-student-select') as HTMLSelectElement;
    const enterBtn = screen.getByTestId('portal-enter-student-screen-btn') as HTMLButtonElement;

    expect(categorySelect.value).toBe('');
    expect(studentSelect.disabled).toBe(true);
    expect(enterBtn.disabled).toBe(true);
  });

  it('filters students accurately when switching grade category (小学生 / 中学生 / 高校生)', async () => {
    await renderPortalHome();

    const categorySelect = screen.getByTestId('portal-grade-category-select') as HTMLSelectElement;
    const studentSelect = screen.getByTestId('portal-student-select') as HTMLSelectElement;

    // 1. 小学生を選択
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'elementary' } });
    });

    expect(studentSelect.disabled).toBe(false);
    let options = Array.from(studentSelect.options).map(o => o.text);
    expect(options.some(t => t.includes('小林 咲良'))).toBe(true);
    expect(options.some(t => t.includes('佐藤 健太'))).toBe(false);
    expect(options.some(t => t.includes('高橋 葵'))).toBe(false);

    // 2. 中学生を選択
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'junior_high' } });
    });

    options = Array.from(studentSelect.options).map(o => o.text);
    expect(options.some(t => t.includes('小林 咲良'))).toBe(false);
    expect(options.some(t => t.includes('佐藤 健太'))).toBe(true);
    expect(options.some(t => t.includes('高橋 葵'))).toBe(false);

    // 3. 高校生を選択
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'high_school' } });
    });

    options = Array.from(studentSelect.options).map(o => o.text);
    expect(options.some(t => t.includes('小林 咲良'))).toBe(false);
    expect(options.some(t => t.includes('佐藤 健太'))).toBe(false);
    expect(options.some(t => t.includes('高橋 葵'))).toBe(true);
  });

  it('resets selected student ID when changing category and navigates to StudentDashboard upon submission', async () => {
    await renderPortalHome();

    const categorySelect = screen.getByTestId('portal-grade-category-select') as HTMLSelectElement;
    const studentSelect = screen.getByTestId('portal-student-select') as HTMLSelectElement;

    // 小学生を選択し、特定の生徒を選ぶ
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'elementary' } });
    });
    await act(async () => {
      fireEvent.change(studentSelect, { target: { value: 'std-elem-01' } });
    });

    expect(studentSelect.value).toBe('std-elem-01');

    // 校種を中学生へ変更すると、選択生徒がクリアされる
    await act(async () => {
      fireEvent.change(categorySelect, { target: { value: 'junior_high' } });
    });

    expect(studentSelect.value).toBe('');

    // 中学生を選択し、ログイン実行
    await act(async () => {
      fireEvent.change(studentSelect, { target: { value: 'std-junior-01' } });
    });

    const enterBtn = screen.getByTestId('portal-enter-student-screen-btn') as HTMLButtonElement;
    expect(enterBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(enterBtn);
    });

    // 生徒学習画面への遷移を確認
    await waitFor(() => {
      const match = screen.getAllByText((content) => content.includes('佐藤 健太'));
      expect(match.length).toBeGreaterThan(0);
    });
  });
});
