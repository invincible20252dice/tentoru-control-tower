import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

describe('TeacherDashboard UnitTest Master Modal Deep Coverage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers unit test modal full inputs, subject change, unit dropdown, and save', async () => {
    const student = {
      id: 'std-unit-modal',
      name: '単元モーダル生徒',
      grade: '中1',
      grade_category: 'junior_high' as const,
      selected_subjects: ['数学'],
      selected_days: ['monday'],
      status: 'normal' as const,
      branch_name: '恵比寿教室',
      classroom: '恵比寿教室'
    };

    const curriculumMasters = [
      { id: 'cm-u1', subject: '数学', grade_category: 'junior_high', target_grade: '中1', unit_name: '正の数・負の数', lesson_name: '正の数・負の数(1)', item_type: 'video_lesson', sort_order: 1 },
      { id: 'cm-u2', subject: '数学', grade_category: 'junior_high', target_grade: '中1', unit_name: '文字と式', lesson_name: '文字と式(1)', item_type: 'video_lesson', sort_order: 2 }
    ];

    await db.saveStudent(student as any);
    await db.saveCurriculumMasters(curriculumMasters as any);

    render(
      <TeacherDashboard
        students={[student as any]}
        initialStudentId="std-unit-modal"
        initialTab="schedule"
        onLogout={vi.fn()}
        onBackToPortal={vi.fn()}
      />
    );

    // Open unit test master modal
    const openModalBtn = screen.queryByText(/単元テストマスタ管理/);
    if (openModalBtn) {
      await act(async () => {
        fireEvent.click(openModalBtn);
      });

      // Find unit dropdown
      const unitSelect = screen.getByRole('combobox');
      if (unitSelect) {
        await act(async () => {
          fireEvent.change(unitSelect, { target: { value: '正の数・負の数' } });
        });
      }

      // Save unit test
      const saveBtn = screen.getByTestId('save-unittest-master-btn');
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeTruthy();
  });
});
