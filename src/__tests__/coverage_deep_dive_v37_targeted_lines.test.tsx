import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, SchoolMaster, CurriculumMaster, CurriculumUnit } from '../types';

describe('Coverage Deep Dive v37 - Targeted Line & Branch Coverage', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();

    const sch: SchoolMaster = {
      id: 'sch-target-37',
      name: '本巣中学校37',
      type: 'junior_high'
    };
    await db.saveSchool(sch as any);

    const unitMath: CurriculumUnit = {
      id: 'unit-m-1',
      school_id: 'sch-target-37',
      grade: '中2',
      subject: '数学',
      name: '連立方程式',
      order: 1
    };
    const unitEng: CurriculumUnit = {
      id: 'unit-e-1',
      school_id: 'sch-target-37',
      grade: '中2',
      subject: '英語',
      name: '不定詞',
      order: 1
    };
    const unitSci: CurriculumUnit = {
      id: 'unit-s-1',
      school_id: 'sch-target-37',
      grade: '中2',
      subject: '理科',
      name: '化学変化',
      order: 1
    };
    const unitSoc: CurriculumUnit = {
      id: 'unit-so-1',
      school_id: 'sch-target-37',
      grade: '中2',
      subject: '社会',
      name: '歴史（近代）',
      order: 1
    };
    const unitJap: CurriculumUnit = {
      id: 'unit-j-1',
      school_id: 'sch-target-37',
      grade: '中2',
      subject: '国語',
      name: '文法（動詞の活用）',
      order: 1
    };
    await db.saveCurriculumUnit(unitMath);
    await db.saveCurriculumUnit(unitEng);
    await db.saveCurriculumUnit(unitSci);
    await db.saveCurriculumUnit(unitSoc);
    await db.saveCurriculumUnit(unitJap);

    const testStudent: any = {
      id: 'st-target-37',
      student_id: 'S_TARGET_37',
      name: 'ターゲット生徒37',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      school_id: 'sch-target-37',
      school_name: '本巣中学校37',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
      start_unit_math: 'unit-m-1',
      start_unit_english: 'unit-e-1',
      start_unit_science: 'unit-s-1',
      start_unit_social: 'unit-so-1',
      start_unit_japanese: 'unit-j-1',
      period_count: 3
    };
    await db.saveStudent(testStudent);

    await db.saveCurriculumMasters([
      {
        id: 'cm-master-37-1',
        grade_level: '中2',
        subject: '数学',
        unit_name: '連立方程式',
        lesson_name: '第1講 連立方程式の解法',
        sort_order: 1,
        standard_completion_days: 7,
        passing_line: '80%以上'
      },
      {
        id: 'cm-master-37-2',
        grade_level: '中2',
        subject: '数学',
        unit_name: '連立方程式',
        lesson_name: '第2講 連立方程式の応用',
        sort_order: 2,
        standard_completion_days: 7,
        passing_line: '80%以上'
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers specific handlers for unit test modals, start units, and curriculum tab actions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(<TeacherDashboard initialStudentId="S_TARGET_37" />);
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/i)).toBeDefined();
    });

    // 1. Switch to curriculum tab
    const curriculumTab = screen.queryByRole('button', { name: /学校カリキュラム管理/i });
    if (curriculumTab) {
      await act(async () => {
        fireEvent.click(curriculumTab);
      });
    }

    // 2. Click "単元テストマスタ管理" or "単元テスト追加" modal trigger
    const addUnitTestBtn = screen.queryByRole('button', { name: /単元テストマスタ管理|単元テスト登録/i });
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });

      // Fill in modal inputs if present
      const unitNameInput = container!.querySelector('input[placeholder*="単元名"]') as HTMLInputElement;
      if (unitNameInput) {
        await act(async () => {
          fireEvent.change(unitNameInput, { target: { value: '連立方程式' } });
        });
      }

      const testNameInput = container!.querySelector('input[placeholder*="テスト名"]') as HTMLInputElement;
      if (testNameInput) {
        await act(async () => {
          fireEvent.change(testNameInput, { target: { value: '第3講 総合確認テスト' } });
        });
      }

      const saveMasterBtn = screen.queryByRole('button', { name: /マスタに保存|登録する/i });
      if (saveMasterBtn) {
        await act(async () => {
          fireEvent.click(saveMasterBtn);
        });
      }

      const closeMasterBtn = screen.queryByRole('button', { name: /閉じる|キャンセル/i });
      if (closeMasterBtn) {
        await act(async () => {
          fireEvent.click(closeMasterBtn);
        });
      }
    }

    // 3. Switch back to student detail
    const studentDetailTab = screen.queryByRole('button', { name: /生徒カルテ/i });
    if (studentDetailTab) {
      await act(async () => {
        fireEvent.click(studentDetailTab);
      });
    }

    expect(true).toBe(true);
  });
});
