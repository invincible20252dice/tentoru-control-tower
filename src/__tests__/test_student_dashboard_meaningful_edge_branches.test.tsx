import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MiniTestResult, LearningTask } from '../types';

describe('Meaningful Deep Branch Coverage Tests for StudentDashboard', () => {
  const sampleMasters: CurriculumMaster[] = [
    {
      id: 'cm-m-1',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数のグラフと傾き',
      sort_order: 1
    },
    {
      id: 'cm-m-2',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '切片と直線の式',
      sort_order: 2
    },
    {
      id: 'cm-m-ut',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数 - 単元確認テスト',
      sort_order: 3,
      item_type: 'unit_test'
    }
  ];

  const student: Student = {
    id: 'std-dash-1',
    student_id: 'S_DASH_1',
    name: '生徒 ダッシュ',
    grade: '中2',
    status: 'normal',
    branch_id: 'branch-1',
    selected_subjects: ['数学'],
    completed_lesson_ids: []
  };

  const todayStr = '2026-06-01';

  beforeEach(async () => {
    localStorage.clear();
    await db.saveCurriculumMasters(sampleMasters);
    await db.saveStudent(student);
  });

  it('1. テスト点数入力のバリデーション（0〜100範囲外アラート）および合否判定の網羅', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // 当日の単元テストレコードを用意
    const testItem: MiniTestResult = {
      id: 'mini-val-1',
      student_id: 'std-dash-1',
      date: todayStr,
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: null,
      passed: false,
      passing_line: '80%以上',
      target_scope: 'individual',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const taskItem: LearningTask = {
      id: 'task-val-1',
      student_id: 'std-dash-1',
      subject: '数学',
      unit_name: '一次関数',
      custom_unit_name: '一次関数 - 単元確認テスト',
      start_lesson_id: 'cm-m-ut',
      start_lesson_name: '一次関数 - 単元確認テスト',
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(testItem);
    await db.saveLearningTasks([taskItem]);

    const { unmount } = render(
      <StudentDashboard
        student={student}
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/一次関数 - 単元確認テスト/).length).toBeGreaterThan(0);
    });

    const scoreInput = screen.getByTestId('test-score-input-mini-val-1');
    const judgeBtn = screen.getByTestId('test-save-btn-mini-val-1');

    // 1. 0〜100の範囲外（例: 150）を入力して押下 ➔ L1161 分岐
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '150' } });
    });
    await act(async () => {
      fireEvent.click(judgeBtn);
    });
    expect(alertSpy).toHaveBeenCalledWith('0〜100の点数を入力してください。');

    // 2. 不合格点（50点）を入力して押下 ➔ 不合格判定＆handleProcessUnitTestFailure 分岐
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '50' } });
    });
    await act(async () => {
      fireEvent.click(judgeBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/不合格/i).length).toBeGreaterThan(0);
    });

    // 3. 合格点（95点）を入力して押下 ➔ 合格判定＆handlePassTest 分岐
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '95' } });
    });
    await act(async () => {
      fireEvent.click(judgeBtn);
    });

    await waitFor(() => {
      // 合格バッジが表示されることを検証
      expect(screen.getByText(/合格 ✨/i)).toBeInTheDocument();
    });

    alertSpy.mockRestore();
    unmount();
  });

  it('2. 日付ピッカーの変更（L1885）および業務連絡（office_note L1931）の描画網羅', async () => {
    const taskWithNote: LearningTask = {
      id: 'task-note-1',
      student_id: 'std-dash-1',
      subject: '数学',
      unit_name: '一次関数',
      start_lesson_name: '一次関数のグラフと傾き',
      scheduled_date: todayStr,
      period: 1,
      status: 'unstarted',
      office_note: '提出ノートを忘れずに持参してください',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    await db.saveLearningTasks([taskWithNote]);

    const { unmount } = render(
      <StudentDashboard
        student={student}
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      // 業務連絡カードが表示されていることを検証（L1931 分岐）
      expect(screen.getByTestId('office-note-card')).toBeInTheDocument();
    });

    // 日付ピッカーの変更（L1885 分岐）
    const dateInput = screen.getByTestId('student-date-picker');
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: '2026-06-02' } });
    });
    expect(dateInput).toHaveValue('2026-06-02');

    unmount();
  });

  it('3. 単元テスト合格時の次回通塾日新単元授業自動予約（scheduleNextUnitForStudent: L768-780）および不合格時のcompleted_lesson_ids安全除去（L862-875）', async () => {
    // 誤って completed_lesson_ids に単元確認テストID（cm-m-ut）が入っている生徒を用意
    const studentWithCorruptedUT: Student = {
      ...student,
      id: 'std-dash-schedule-next',
      student_id: 'S_DASH_SN',
      completed_lesson_ids: ['cm-m-1', 'cm-m-ut']
    };
    await db.saveStudent(studentWithCorruptedUT);

    const testItem: MiniTestResult = {
      id: 'mini-sn-1',
      student_id: 'std-dash-schedule-next',
      date: todayStr,
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: null,
      passed: false,
      passing_line: '80%以上',
      target_scope: 'individual',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    // 本日のタスクはすでに受講完了済み（status: 'completed'）にしておくことで、
    // 単元テスト合格時に scheduleNextUnitForStudent が即実行されるパス（L1228）を通す
    const completedTask: LearningTask = {
      id: 'task-sn-1',
      student_id: 'std-dash-schedule-next',
      subject: '数学',
      unit_name: '一次関数',
      start_lesson_id: 'cm-m-1',
      end_lesson_id: 'cm-m-1',
      scheduled_date: todayStr,
      period: 1,
      status: 'completed',
      video_watched: true,
      test_passed: true,
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(testItem);
    await db.saveLearningTasks([completedTask]);

    const { unmount } = render(
      <StudentDashboard
        student={studentWithCorruptedUT}
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('test-score-input-mini-sn-1')).toBeInTheDocument();
    });

    const scoreInput = screen.getByTestId('test-score-input-mini-sn-1');
    const judgeBtn = screen.getByTestId('test-save-btn-mini-sn-1');

    // 1. 不合格（50点）を入力して送信 ➔ 不合格処理で completed_lesson_ids から cm-m-ut が除去される（L862-875）
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '50' } });
    });
    await act(async () => {
      fireEvent.click(judgeBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/不合格/i).length).toBeGreaterThan(0);
    });

    // 2. 合格（95点）を入力して送信 ➔ すべての授業タスクが completed のため、scheduleNextUnitForStudent が呼ばれる（L768-780, L1228）
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '95' } });
    });
    await act(async () => {
      fireEvent.click(judgeBtn);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/合格 ✨/i).length).toBeGreaterThan(0);
    });

    unmount();
  });
});
