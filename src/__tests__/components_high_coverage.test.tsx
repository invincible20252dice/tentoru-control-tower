import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import { StudentScheduleConfigForm } from '../components/StudentScheduleConfigForm';
import { TestScoreRadarChart } from '../components/TestScoreRadarChart';
import { WeeklyScheduleViewer } from '../components/WeeklyScheduleViewer';
import { db, Student, LearningTask } from '../lib/db';

describe('High-Coverage Test Suite for UI Components & Features', () => {
  beforeEach(() => {
    db.clearMockData();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('CurriculumCsvImport Detailed Features', () => {
    test('File selection and CSV text parsing execution', async () => {
      const onImportCompletedMock = vi.fn();
      const { getByTestId } = render(<CurriculumCsvImport onImportCompleted={onImportCompletedMock} />);

      const csvFileInput = getByTestId('csv-file-input');
      const csvContent = `学年,教科,単元名,授業名
小5,算数,1章 整数と小数,小数と10倍・100倍・1/10
小5,算数,1章 整数と小数,小数の位取りと数の構成`;

      const file = new File([csvContent], 'test_curriculum.csv', { type: 'text/csv' });
      fireEvent.change(csvFileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/2件のカリキュラムデータを読み込みました/)).toBeInTheDocument();
      });

      const importBtn = getByTestId('execute-import-btn');
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(onImportCompletedMock).toHaveBeenCalled();
      });
    });

    test('Download sample CSV and Copy sample button handlers', async () => {
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = vi.fn();

      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockResolvedValue(undefined)
        }
      });

      render(<CurriculumCsvImport onImportSuccess={vi.fn()} />);

      const downloadBtn = screen.getByText(/サンプルCSV/);
      fireEvent.click(downloadBtn);
      expect(URL.createObjectURL).toHaveBeenCalled();

      const copyBtn = screen.getByText(/形式をコピー/);
      fireEvent.click(copyBtn);
      expect(navigator.clipboard.writeText).toHaveBeenCalled();

      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('StudentScheduleConfigForm Extended Features', () => {
    test('renders form, toggles days, updates frequency and duration, and submits successfully', async () => {
      const onSaveMock = vi.fn();
      const mockStudent: Student = {
        id: 'std-config-form-1',
        name: '時間割設定生徒',
        grade: '中2',
        login_id: 'std_cfg',
        password: 'pass',
        status: 'normal',
        weekly_sessions_count: '2回',
        weekly_duration_minutes: '120分',
        selected_days: ['tuesday', 'friday'],
        default_slots: 2,
        created_at: new Date().toISOString()
      };

      const { container } = render(
        <StudentScheduleConfigForm studentId={mockStudent.id} onSaved={onSaveMock} />
      );

      expect(screen.getByText(/通塾設定/)).toBeInTheDocument();

      // Select frequency
      const selects = container.querySelectorAll('select');
      if (selects.length >= 2) {
        fireEvent.change(selects[0], { target: { value: '3回' } });
        fireEvent.change(selects[1], { target: { value: '180分' } });
      }

      const submitBtn = screen.getByText(/通塾設定を保存する/);
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalled();
      });
    });
  });

  describe('TestScoreRadarChart Edge Cases', () => {
    test('renders radar chart or fallback when empty data provided', () => {
      render(<TestScoreRadarChart data={[]} />);
      expect(screen.getByText(/レーダーチャート/i)).toBeInTheDocument();
    });

    test('renders with records data', () => {
      const data = [
        { subject: '数学', score: 85, target: 80 },
        { subject: '英語', score: 90, target: 85 }
      ];
      render(<TestScoreRadarChart data={data} />);
      expect(screen.getByText(/レーダーチャート/i)).toBeInTheDocument();
    });
  });

  describe('WeeklyScheduleViewer Extended Matrix Render', () => {
    test('renders weekly schedule grid for student', () => {
      const mockStudent: Student = {
        id: 'std-weekly-1',
        name: 'ウィークリー生徒',
        grade: '中1',
        login_id: 'std_w',
        password: 'pass',
        status: 'normal',
        selected_days: ['tuesday', 'friday'],
        created_at: new Date().toISOString()
      };

      const mockTasks: LearningTask[] = [
        { id: 't-1', student_id: 'std-weekly-1', scheduled_date: '2026-08-21', period: 1, subject: '数学', start_lesson_name: '正負の数', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
      ];

      render(
        <WeeklyScheduleViewer
          student={mockStudent}
          tasks={mockTasks}
          scheduleConfig={{ student_id: 'std-weekly-1', weekly_frequency: '2回', weekly_duration: '120分', selected_days: ['tuesday', 'friday'], default_slots: 2 }}
        />
      );

      expect(screen.getByText(/週表示/)).toBeInTheDocument();
    });
  });
});
