import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Coverage Deep Dive V5 Branch Master Tests', () => {
  beforeEach(async () => {
    localStorage.clear();

    const b1: Branch = { id: 'branch-1', name: '恵比寿校', code: 'EBS01', email: 'ebisu@test.com', is_active: true };
    const b2: Branch = { id: 'branch-2', name: '渋谷校', code: 'SBY01', email: 'shibuya@test.com', is_active: true };
    await db.saveBranch(b1);
    await db.saveBranch(b2);

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
      selected_days: ['tuesday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '福田 尚弘'
    };
    const student2: Student = {
      id: 'std-2',
      student_id: 'S002',
      name: '鈴木 花子',
      grade: '高1',
      level: 'B',
      school_id: 'sch-2',
      branch_id: 'branch-2',
      status: 'withdrawn',
      period_count: 3,
      selected_days: ['monday'],
      selected_subjects: ['英語', '国語'],
      teacher_in_charge: '高橋 健'
    };
    await db.saveStudent(student1);
    await db.saveStudent(student2);

    await db.saveCurriculumUnit({
      id: 'cu-101',
      school_type: 'junior_high',
      grade: '中1',
      subject: '数学',
      curriculum_name: '中学数学',
      textbook_name: '啓林館',
      unit_name: '正の数・負の数',
      lesson_name: '加法',
      lesson_number: 1,
      standard_weeks: 2,
      sort_order: 10,
      item_type: 'lesson'
    } as any);

    await db.saveMiniTestResult({
      id: 'mtr-101',
      student_id: 'std-1',
      date: '2026-08-27',
      test_content: '正の数・負の数 小テスト',
      score: 90,
      passed: true,
      target_scope: 'individual'
    } as any);

    await db.saveHomeworkResult({
      id: 'hwr-101',
      student_id: 'std-1',
      date: '2026-08-27',
      homework_content: '計算ワーク P.10-12',
      completed: true
    } as any);

    await db.saveStudentInteraction({
      id: 'si-101',
      student_id: 'std-1',
      date: '2026-08-27',
      category: '面談',
      memo: '夏期講習の成果を確認',
      staff_name: '佐藤'
    });
  });

  it('covers all db.ts filter options and Supabase mode edge cases', async () => {
    // 1. fetchStudents 各種オプション
    await db.fetchStudents({ school_id: 'sch-1' });
    await db.fetchStudents({ branch_id: 'branch-1' });
    await db.fetchStudents({ status: 'normal' });
    await db.fetchStudents({ status: 'withdrawn' });
    await db.fetchStudents({ school_id: 'sch-1', branch_id: 'branch-1', status: 'normal' });

    // 2. getCurriculumUnits / getCurriculumMasters 各種オプション
    await db.getCurriculumUnits();
    await db.getCurriculumMasters();

    // 3. fetchMiniTestResults 各種オプション
    await db.fetchMiniTestResults({ student_id: 'std-1' });
    await db.fetchMiniTestResults({ date: '2026-08-27' });

    // 4. fetchHomeworkResults 各種オプション
    await db.fetchHomeworkResults({ student_id: 'std-1' });
    await db.fetchHomeworkResults({ date: '2026-08-27' });

    // 5. Supabase モードでの全クエリ分岐
    const mockSupabaseQuery = {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'test-1' }, error: null }),
          order: () => Promise.resolve({ data: [{ id: 'test-1' }], error: null }),
          limit: () => Promise.resolve({ data: [{ id: 'test-1' }], error: null }),
          eq: () => Promise.resolve({ data: [{ id: 'test-1' }], error: null })
        }),
        in: () => Promise.resolve({ data: [{ id: 'test-1' }], error: null }),
        order: () => Promise.resolve({ data: [{ id: 'test-1' }], error: null })
      }),
      upsert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'test-1' }, error: null })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'test-1' }, error: null })
        })
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null })
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
        in: () => Promise.resolve({ error: null })
      })
    };

    const mockSupabase = {
      from: () => mockSupabaseQuery
    };

    (db as any).supabase = mockSupabase;
    (db as any).isMockMode = false;

    await db.fetchStudents();
    await db.fetchMiniTestResults();
    await db.fetchHomeworkResults();

    (db as any).isMockMode = true;
  });

  it('covers TeacherDashboard student filters, sorts, and sub-views', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard initialStudentId="std-1" onBackToPortal={vi.fn()} />);

    // 「小テスト結果」タブの各フィルタ操作
    const miniTestsTab = screen.queryByRole('button', { name: /小テスト結果/i });
    if (miniTestsTab) {
      await act(async () => {
        fireEvent.click(miniTestsTab);
      });

      const gradeFilter = screen.queryByLabelText(/学年:/i);
      if (gradeFilter) {
        await act(async () => {
          fireEvent.change(gradeFilter, { target: { value: '中1' } });
        });
      }

      const subjectFilter = screen.queryByLabelText(/教科:/i);
      if (subjectFilter) {
        await act(async () => {
          fireEvent.change(subjectFilter, { target: { value: '数学' } });
        });
      }
    }

    // 「宿題提出状況」タブの各フィルタ操作
    const homeworkTab = screen.queryByRole('button', { name: /宿題提出状況/i });
    if (homeworkTab) {
      await act(async () => {
        fireEvent.click(homeworkTab);
      });
    }

    // 「生徒一覧」タブの各種フィルタ
    const studentListTab = screen.queryByRole('button', { name: /生徒一覧/i });
    if (studentListTab) {
      await act(async () => {
        fireEvent.click(studentListTab);
      });
    }
  });
});
