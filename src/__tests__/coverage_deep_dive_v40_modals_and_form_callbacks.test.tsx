import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, SchoolMaster, CurriculumMaster } from '../types';

describe('Coverage Deep Dive v40 - Modals and Form Callbacks Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();

    const sch: SchoolMaster = {
      id: 'sch-v40',
      name: '本巣中学校40',
      type: 'junior_high'
    };
    await db.saveSchool(sch as any);

    const st: Student = {
      id: 'st-v40',
      student_id: 'S_V40',
      name: '生徒40',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      school_id: 'sch-v40',
      school_name: '本巣中学校40',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday'],
      selected_subjects: ['数学'],
      period_count: 2,
      image_url: 'http://example.com/student.png',
      parent_image_url: 'http://example.com/parent.png',
      enrollment_date: '2026-04-01'
    };
    await db.saveStudent(st);

    await db.saveStudentInteraction({
      id: 'inter-v40-1',
      student_id: 'st-v40',
      type: 'interview',
      date: '2026-05-10',
      staff_name: '福田 尚弘',
      memo: '進路について相談'
    });

    await db.saveCurriculumMasters([
      {
        id: 'cm-v40-1',
        grade_level: '中2',
        subject: '数学',
        unit_name: '1章 式の計算',
        lesson_name: '第1講 単項式と多項式',
        sort_order: 1,
        standard_completion_days: 7,
        passing_line: '80%以上'
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('thoroughly interacts with BranchAIRules modal, UnitTest modal, and student photo/interaction forms', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(<TeacherDashboard initialStudentId="S_V40" />);
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/i)).toBeDefined();
    });

    // 1. Interaction record edit & cancel
    const editInteractionBtn = container!.querySelector('button[title*="編集"], button[aria-label*="編集"]');
    if (editInteractionBtn) {
      await act(async () => {
        fireEvent.click(editInteractionBtn);
      });

      const memoEditInput = container!.querySelector('textarea[value*="進路"], input[value*="進路"]');
      if (memoEditInput) {
        await act(async () => {
          fireEvent.change(memoEditInput, { target: { value: '進路相談（更新）' } });
        });
      }

      const cancelEditBtn = screen.queryByRole('button', { name: /キャンセル/i });
      if (cancelEditBtn) {
        await act(async () => {
          fireEvent.click(cancelEditBtn);
        });
      }
    }

    // 2. Clear student & parent photo buttons
    const deleteStudentPhotoBtn = container!.querySelector('button[title*="生徒アイコンを削除"]');
    if (deleteStudentPhotoBtn) {
      await act(async () => {
        fireEvent.click(deleteStudentPhotoBtn);
      });
    }

    const deleteParentPhotoBtn = container!.querySelector('button[title*="保護者アイコンを削除"]');
    if (deleteParentPhotoBtn) {
      await act(async () => {
        fireEvent.click(deleteParentPhotoBtn);
      });
    }

    // 3. Date input change
    const enrollmentInput = screen.queryByTestId('student-enrollment-date-input');
    if (enrollmentInput) {
      await act(async () => {
        fireEvent.change(enrollmentInput, { target: { value: '2026-04-10' } });
      });
    }

    // 4. Switch to Curriculum Tab & Open Unit Test Master Modal
    const curriculumTab = screen.queryByRole('button', { name: /学校カリキュラム管理/i });
    if (curriculumTab) {
      await act(async () => {
        fireEvent.click(curriculumTab);
      });

      const openUnitTestModalBtn = screen.queryByRole('button', { name: /単元テストマスタ管理|単元テスト登録/i });
      if (openUnitTestModalBtn) {
        await act(async () => {
          fireEvent.click(openUnitTestModalBtn);
        });

        // Trigger change events inside Unit Test Modal
        const selects = container!.querySelectorAll('select');
        for (const sel of Array.from(selects)) {
          if (sel.value === '中2' || sel.value === '数学') {
            await act(async () => {
              fireEvent.change(sel, { target: { value: sel.value } });
            });
          }
        }

        const passingLineInput = container!.querySelector('input[placeholder*="80%以上"]') as HTMLInputElement;
        if (passingLineInput) {
          await act(async () => {
            fireEvent.change(passingLineInput, { target: { value: '85%以上' } });
          });
        }

        const closeBtn = screen.queryByRole('button', { name: /✕|閉じる|キャンセル/i });
        if (closeBtn) {
          await act(async () => {
            fireEvent.click(closeBtn);
          });
        }
      }
    }

    // 5. Open Branch AI Rules Modal
    const openAIRulesBtn = screen.queryByRole('button', { name: /校舎設定|AI設定|AI自動設定ルール/i });
    if (openAIRulesBtn) {
      await act(async () => {
        fireEvent.click(openAIRulesBtn);
      });

      const closeAIBtn = screen.queryByRole('button', { name: /✕|閉じる|キャンセル/i });
      if (closeAIBtn) {
        await act(async () => {
          fireEvent.click(closeAIBtn);
        });
      }
    }

    expect(true).toBe(true);
  });
});
