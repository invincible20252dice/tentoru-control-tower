import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Unit Test Automatic Extraction & Real-time Dropdown Sync Tests', () => {
  beforeEach(async () => {
    localStorage.clear();

    const masters: CurriculumMaster[] = [
      { id: 'cm-sub-1', subject: '算数', grade: '中1', unit_name: 'ひきざん', lesson_name: 'ひきざん(1)', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-sub-2', subject: '算数', grade: '中1', unit_name: 'ひきざん', lesson_name: 'ひきざん - 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
      { id: 'cm-eng-1', subject: '英語', grade: '中1', unit_name: 'Be動詞', lesson_name: 'Be動詞(1)', sort_order: 3, item_type: 'lesson' },
      { id: 'cm-eng-2', subject: '英語', grade: '中1', unit_name: 'Be動詞', lesson_name: 'Be動詞 - 単元確認テスト', sort_order: 4, item_type: 'unit_test' }
    ];
    await db.saveCurriculumMasters(masters);

    const student: Student = {
      id: 'std-1',
      student_id: 'S001',
      name: '山田 太郎',
      grade: '中1',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      period_count: 2,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '算数', '英語'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);
  });

  it('automatically extracts unit test from schedule and displays in today tests section', async () => {
    const student = db.getStudents().find(s => s.id === 'std-1')!;
    const testDate = '2026-08-25';

    // 1コマ目に「ひきざん - 単元確認テスト」を設定
    const task: LearningTask = {
      id: `task-${student.id}-${testDate}-1`,
      student_id: student.id,
      scheduled_date: testDate,
      period: 1,
      subject: '算数',
      unit_id: 'cm-sub-2',
      start_lesson_id: 'cm-sub-2',
      end_lesson_id: 'cm-sub-2',
      start_lesson_name: 'ひきざん - 単元確認テスト',
      end_lesson_name: 'ひきざん - 単元確認テスト',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const { container } = render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 生徒を選択して学習計画タブへ
    const studentItem = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentItem);
    });

    const scheduleTab = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 8/25 を選択
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: testDate } });
      });
    }

    // 検証: 本日のテスト欄に「ひきざん - 単元確認テスト」が自動抽出・反映されていること
    expect(screen.getAllByText(/ひきざん - 単元確認テスト/i).length).toBeGreaterThan(0);
  });

  it('supports multiple subjects unit tests in the same day (算数 & 英語)', async () => {
    const student = db.getStudents().find(s => s.id === 'std-1')!;
    const testDate = '2026-08-27';

    // 1コマ目に算数テスト、2コマ目に英語テスト
    const task1: LearningTask = {
      id: `task-${student.id}-${testDate}-1`,
      student_id: student.id,
      scheduled_date: testDate,
      period: 1,
      subject: '算数',
      unit_id: 'cm-sub-2',
      start_lesson_id: 'cm-sub-2',
      end_lesson_id: 'cm-sub-2',
      start_lesson_name: 'ひきざん - 単元確認テスト',
      end_lesson_name: 'ひきざん - 単元確認テスト',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    const task2: LearningTask = {
      id: `task-${student.id}-${testDate}-2`,
      student_id: student.id,
      scheduled_date: testDate,
      period: 2,
      subject: '英語',
      unit_id: 'cm-eng-2',
      start_lesson_id: 'cm-eng-2',
      end_lesson_id: 'cm-eng-2',
      start_lesson_name: 'Be動詞 - 単元確認テスト',
      end_lesson_name: 'Be動詞 - 単元確認テスト',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task1, task2]);

    const { container } = render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 生徒を選択し学習計画タブへ
    const studentItem = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentItem);
    });

    const scheduleTab = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 8/27 を選択
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: testDate } });
      });
    }

    // 検証: 算数と英語の両方の単元確認テストが1行ずつ表示される
    expect(screen.getAllByText(/ひきざん - 単元確認テスト/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Be動詞 - 単元確認テスト/i).length).toBeGreaterThan(0);
  });
});
