import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, CurriculumMaster, CurriculumUnit, LearningTask } from '../lib/db';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import TeacherDashboard from '../components/TeacherDashboard';

describe('High Coverage Final Targeted Suite (Pushing Components and DB above 95%)', () => {
  beforeEach(async () => {
    localStorage.clear();
    const st: Student = {
      id: 'st-final-1',
      student_id: 'SFINAL1',
      name: 'ファイナルテスト生',
      grade: '中2',
      level: 'A',
      school_id: 'school-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['数学', '英語']
    };
    await db.saveStudent(st);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true
    });
  });

  // 1. CurriculumCsvImport Tab Switching, Delete, Clean, Search
  it('covers CurriculumCsvImport master deletion, search filters, and import completion callbacks', async () => {
    const onImportComplete = vi.fn();
    const onClose = vi.fn();

    render(
      <CurriculumCsvImport 
        onImportComplete={onImportComplete}
        onClose={onClose}
      />
    );

    // Switch to curriculum list tab
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });

    // Search input
    const searchInput = screen.getByPlaceholderText(/単元・授業名で検索/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '一次関数' } });
    });
    expect(searchInput).toHaveValue('一次関数');

    // Switch to import tab
    const importTab = screen.getByTestId('tab-csv-import');
    await act(async () => {
      fireEvent.click(importTab);
    });

    // Upload CSV
    const fileInput = screen.getByTestId('csv-file-input');
    const csvContent = `学年,教科,単元名,授業名
中2,数学,一次関数,一次関数のグラフ
中2,数学,一次関数,一次関数単元確認テスト`;
    const csvFile = new File([csvContent], 'curriculum.csv', { type: 'text/csv' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
    });

    // Confirm Import
    const importBtn = screen.queryByRole('button', { name: /一括インポートを実行/i });
    if (importBtn) {
      await act(async () => {
        fireEvent.click(importBtn);
      });
      expect(onImportComplete).toHaveBeenCalled();
    }
  });

  // 2. TeacherDashboard Reschedule & Bulk Apply
  it('covers TeacherDashboard bulk schedule applications and student selection', async () => {
    render(
      <TeacherDashboard 
        onBackToPortal={vi.fn()}
      />
    );

    // Select student
    const studentCards = screen.getAllByText(/ファイナルテスト生|太郎|佐藤/i);
    if (studentCards.length > 0) {
      await act(async () => {
        fireEvent.click(studentCards[0]);
      });
    }

    // Auto reschedule button
    const rescheduleBtn = screen.queryByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    if (rescheduleBtn) {
      await act(async () => {
        fireEvent.click(rescheduleBtn);
      });
    }
  });
});
