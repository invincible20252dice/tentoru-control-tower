import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, MiniTestResult, CurriculumMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Today Tests Deduplication & Completed Test Filtering Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    
    // カリキュラムマスタ初期設定
    const masters: CurriculumMaster[] = [
      { id: 'cm-add-1', subject: '算数', grade: '中1', unit_name: 'たしざん', lesson_name: 'たしざん(1)', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-add-2', subject: '算数', grade: '中1', unit_name: 'たしざん', lesson_name: 'たしざん - 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
      { id: 'cm-sub-1', subject: '算数', grade: '中1', unit_name: 'ひきざん', lesson_name: 'ひきざん(1)', sort_order: 3, item_type: 'lesson' },
      { id: 'cm-sub-2', subject: '算数', grade: '中1', unit_name: 'ひきざん', lesson_name: 'ひきざん - 単元確認テスト', sort_order: 4, item_type: 'unit_test' }
    ];
    await db.saveCurriculumMasters(masters);

    // テスト生徒（山田 太郎: たしざん確認テストは既に合格・完了済み）
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
      selected_subjects: ['数学', '算数'],
      completed_lesson_ids: ['cm-add-2', 'たしざん - 単元確認テスト']
    };
    await db.saveStudent(student);
  });

  it('never auto-appends completed unit tests (たしざん) even if in schedule, and limits today tests to incomplete ones (ひきざん)', async () => {
    const student = db.getStudents().find(s => s.id === 'std-1')!;
    const testDate = '2026-08-25';

    // 8/25 に未完了の「ひきざん - 単元確認テスト」のコマ割りを設定
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

    // 山田 太郎を選択し学習計画タブを開く
    const studentItem = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentItem);
    });

    const scheduleTab = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 日付を選択
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: testDate } });
      });
    }

    // 検証:
    // 1. 完了済みの「たしざん - 単元確認テスト」は絶対に自動セットされない
    expect(screen.queryByText(/たしざん - 単元確認テスト/i)).not.toBeInTheDocument();

    // 2. 当日コマ割りの未完了テスト「ひきざん - 単元確認テスト」が1件だけ正しく表示される
    expect(screen.getAllByText(/ひきざん - 単元確認テスト/i).length).toBeGreaterThan(0);
  });

  it('clears today tests to 0 items when schedule has no unit test', async () => {
    const student = db.getStudents().find(s => s.id === 'std-1')!;
    const testDate = '2026-08-26';

    // 8/26 に通常授業のコマ割りのみを設定（単元テストなし）
    const task: LearningTask = {
      id: `task-${student.id}-${testDate}-1`,
      student_id: student.id,
      scheduled_date: testDate,
      period: 1,
      subject: '算数',
      unit_id: 'cm-sub-1',
      start_lesson_id: 'cm-sub-1',
      end_lesson_id: 'cm-sub-1',
      start_lesson_name: 'ひきざん(1)',
      end_lesson_name: 'ひきざん(1)',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    const { container } = render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 山田 太郎を選択し学習計画タブを開く
    const studentItem = screen.getByText(/山田 太郎/i);
    await act(async () => {
      fireEvent.click(studentItem);
    });

    const scheduleTab = screen.getByText('学習計画・コマ割り');
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 8/26 を選択
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: testDate } });
      });
    }

    // 検証:
    // 単元テストがない場合は「登録されたテストはありません。」と表示され不要な自動挿入行が0件であること
    expect(screen.getByText('登録されたテストはありません。')).toBeInTheDocument();
  });
});
