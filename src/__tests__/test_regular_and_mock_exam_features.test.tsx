import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, SchoolCodeMaster, ExamThresholdMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Regular Exam and Mock Exam Features Unit Tests', () => {
  beforeEach(async () => {
    localStorage.clear();

    const student: Student = {
      id: 'std-exam-1',
      student_id: 'S_EXAM01',
      name: 'テスト 太郎',
      grade: '中3',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday'],
      selected_subjects: ['数学'],
      teacher_in_charge: '荒木はやと'
    };
    await db.saveStudent(student);

    const schoolCode: SchoolCodeMaster = {
      code: 'SCH_HIGH_01',
      name: '第一高校',
      deviation_value: 65
    };
    await db.saveSchoolCodeMaster(schoolCode);

    const threshold: ExamThresholdMaster = {
      id: 'eth-1',
      school_code: 'SCH_HIGH_01',
      min_score: 300,
      max_score: 400,
      probability: 85
    };
    await db.saveExamThresholdMaster(threshold);
  });

  it('handles regular exam recording with form clearance and history list update', async () => {
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    render(<TeacherDashboard teacherType="junior_high" initialStudentId="std-exam-1" onBackToPortal={vi.fn()} />);

    // 「定期テスト・模試」タブを開く
    const testTab = screen.getByRole('button', { name: /定期テスト・模試/i });
    await act(async () => {
      fireEvent.click(testTab);
    });

    await waitFor(() => {
      expect(screen.getByText('定期テスト結果記録')).toBeInTheDocument();
    });

    // フォーム入力
    const testNameInput = screen.getByPlaceholderText(/例：1学期中間テスト/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(testNameInput, { target: { value: '1学期中間テスト' } });
    });

    const submitBtn = screen.getByRole('button', { name: '定期テスト結果を記録' });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('✅ 定期テスト結果を記録しました'));

    // 履歴一覧に反映されたか確認
    await waitFor(() => {
      expect(screen.getByText('1学期中間テスト')).toBeInTheDocument();
      expect(screen.getByText(/📝 定期テスト/i)).toBeInTheDocument();
    });

    // DB に記録が格納されたか検証
    const records = db.getTestRecords();
    const saved = records.find(r => r.student_id === 'std-exam-1' && r.test_name === '1学期中間テスト');
    expect(saved).toBeDefined();
  });

  it('handles mock exam recording, pass probability calculation card, and delete functionality', async () => {
    window.alert = vi.fn();
    window.confirm = vi.fn().mockReturnValue(true);

    render(<TeacherDashboard teacherType="junior_high" initialStudentId="std-exam-1" onBackToPortal={vi.fn()} />);

    // 「定期テスト・模試」タブを開く
    const testTab = screen.getByRole('button', { name: /定期テスト・模試/i });
    await act(async () => {
      fireEvent.click(testTab);
    });

    await waitFor(() => {
      expect(screen.getByText('模試結果 ＆ 志望校判定')).toBeInTheDocument();
    });

    // 模試フォーム入力
    const mockSubjectInput = screen.getByPlaceholderText(/例: 全県模試 第1回/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(mockSubjectInput, { target: { value: '第1回 駿台模試' } });
    });

    const mockScoreInput = screen.getByPlaceholderText(/例: 380/i) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(mockScoreInput, { target: { value: '380' } });
    });

    await waitFor(() => {
      const opts = screen.getAllByRole('option');
      const hasTarget = opts.some(opt => (opt as HTMLOptionElement).value === 'SCH_HIGH_01');
      expect(hasTarget).toBe(true);
    });

    const options = screen.getAllByRole('option');
    const targetOption = options.find(opt => (opt as HTMLOptionElement).value === 'SCH_HIGH_01');
    const schoolSelect = targetOption?.parentElement as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(schoolSelect, { target: { value: 'SCH_HIGH_01' } });
    });

    const calcBtn = screen.getByRole('button', { name: '模試点数を入力して合格判定算出' });
    await act(async () => {
      fireEvent.click(calcBtn);
    });

    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('✅ 模試結果を記録し、判定を算出しました！'));

    // 最新合格判定結果カードの描画検証
    await waitFor(() => {
      expect(screen.getByText(/最新合格判定算出結果/i)).toBeInTheDocument();
      expect(screen.getByText(/🎯 模試/i)).toBeInTheDocument();
    });

    const deleteBtns = screen.getAllByRole('button', { name: /🗑️ 削除/i });
    const deleteBtn = deleteBtns[deleteBtns.length - 1];
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('削除してもよろしいですか'));

    await waitFor(() => {
      expect(screen.queryByText('第1回 駿台模試')).not.toBeInTheDocument();
    });
  });
});
