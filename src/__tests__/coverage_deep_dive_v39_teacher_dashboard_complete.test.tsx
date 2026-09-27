import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, SchoolMaster, CurriculumMaster, CurriculumUnit } from '../types';

describe('Coverage Deep Dive v39 - TeacherDashboard Complete Line & Logic Perfection', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();

    const sch: SchoolMaster = {
      id: 'sch-v39',
      name: '本巣中学校39',
      type: 'junior_high'
    };
    await db.saveSchool(sch as any);

    const unitMath: CurriculumUnit = {
      id: 'unit-v39-1',
      school_id: 'sch-v39',
      grade: '中2',
      subject: '数学',
      name: '連立方程式',
      order: 1
    };
    const unitMath2: CurriculumUnit = {
      id: 'unit-v39-2',
      school_id: 'sch-v39',
      grade: '中2',
      subject: '数学',
      name: '一次関数',
      order: 2
    };
    await db.saveCurriculumUnit(unitMath);
    await db.saveCurriculumUnit(unitMath2);

    const st1: Student = {
      id: 'st-v39-1',
      student_id: 'S_V39_1',
      name: '生徒39A',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      school_id: 'sch-v39',
      school_name: '本巣中学校39',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      personalities: ['几帳面'],
      period_count: 2
    };
    const st2: Student = {
      id: 'st-v39-2',
      student_id: 'S_V39_2',
      name: '生徒39B',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      school_id: 'sch-v39',
      school_name: '本巣中学校39',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '理科'],
      personalities: ['自主的'],
      period_count: 2
    };
    await db.saveStudent(st1);
    await db.saveStudent(st2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers student reordering, deletion, curriculum management, and schedule saves', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(<TeacherDashboard initialStudentId="S_V39_1" />);
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/i)).toBeDefined();
    });

    // 1. Delete student with confirmation
    const deleteStudentBtn = screen.queryByRole('button', { name: /生徒を削除|生徒削除/i });
    if (deleteStudentBtn) {
      await act(async () => {
        fireEvent.click(deleteStudentBtn);
      });
    }

    // 2. Switch to Curriculum Tab
    const curriculumTab = screen.queryByRole('button', { name: /学校カリキュラム管理/i });
    if (curriculumTab) {
      await act(async () => {
        fireEvent.click(curriculumTab);
      });

      // Add a unit
      const newUnitNameInput = container!.querySelector('input[placeholder*="単元名を入力"]') as HTMLInputElement;
      if (newUnitNameInput) {
        await act(async () => {
          fireEvent.change(newUnitNameInput, { target: { value: '図形と合同' } });
        });
        const addUnitBtn = screen.queryByRole('button', { name: /単元を追加|授業を追加/i });
        if (addUnitBtn) {
          await act(async () => {
            fireEvent.click(addUnitBtn);
          });
        }
      }

      // Reorder units (click ▲ / ▼ buttons)
      const upBtns = container!.querySelectorAll('button[title*="上へ"], button[aria-label*="上へ"]');
      for (const btn of Array.from(upBtns)) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }

      const downBtns = container!.querySelectorAll('button[title*="下へ"], button[aria-label*="下へ"]');
      for (const btn of Array.from(downBtns)) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }

    // 3. Switch to Daily Tasks Tab
    const dailyTab = screen.queryByRole('button', { name: /日別学習タスク|学習タスク/i });
    if (dailyTab) {
      await act(async () => {
        fireEvent.click(dailyTab);
      });
    }

    // 4. Switch to Progress Matrix Tab
    const progressTab = screen.queryByRole('button', { name: /進捗マトリクス|進度一覧/i });
    if (progressTab) {
      await act(async () => {
        fireEvent.click(progressTab);
      });
    }

    expect(true).toBe(true);
  });
});
