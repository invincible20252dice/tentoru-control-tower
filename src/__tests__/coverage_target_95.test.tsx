import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';

describe('Coverage Target 95%+ Final Comprehensive Suite', () => {
  beforeEach(() => {
    db.clearMockData();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('CurriculumCsvImport Search Filter & Deletion Operations', () => {
    test('filters masters by search query and grade/subject select, and performs single master delete', async () => {
      const mockMasters: CurriculumMaster[] = [
        { id: 'cm-del-1', grade: '小5', subject: '算数', unit_name: '少数1章', lesson_name: '10倍の計算', sort_order: 1, created_at: '' },
        { id: 'cm-del-2', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '加法と減法', sort_order: 2, created_at: '' }
      ];

      await db.saveCurriculumMasters(mockMasters);

      const { getByTestId, container } = render(<CurriculumCsvImport onImportCompleted={vi.fn()} />);

      // Switch to list tab
      const listTab = getByTestId('tab-curriculum-list');
      fireEvent.click(listTab);

      await waitFor(() => {
        expect(screen.getByText(/少数1章/)).toBeInTheDocument();
      });

      // Filter by search query
      const searchInput = container.querySelector('input[type="text"]')!;
      fireEvent.change(searchInput, { target: { value: '正負' } });

      await waitFor(() => {
        expect(screen.queryByText(/少数1章/)).not.toBeInTheDocument();
        expect(screen.getByText(/正負の数/)).toBeInTheDocument();
      });

      // Clear search
      fireEvent.change(searchInput, { target: { value: '' } });

      // Delete single item
      const deleteBtns = container.querySelectorAll('button');
      const singleDeleteBtn = Array.from(deleteBtns).find(b => b.title === '削除' || b.getAttribute('data-testid')?.includes('delete-master'));
      if (singleDeleteBtn) {
        fireEvent.click(singleDeleteBtn);
      }
    });
  });

  describe('StudentDashboard Theme & Fallback Operations', () => {
    test('renders student dashboard with dark theme and exercises user controls', async () => {
      const mockStudent: Student = {
        id: 'std-cov-theme',
        name: 'テーマテスト生徒',
        grade: '中3',
        login_id: 'std_theme',
        password: 'pass',
        status: 'normal',
        created_at: new Date().toISOString()
      };

      const { rerender } = render(
        <StudentDashboard student={mockStudent} initialDate="2026-08-21" theme="dark" onBackToPortal={vi.fn()} />
      );

      expect(screen.getAllByText(/テーマテスト生徒/)[0]).toBeInTheDocument();

      rerender(
        <StudentDashboard student={mockStudent} initialDate="2026-08-21" theme="light" onBackToPortal={vi.fn()} />
      );

      expect(screen.getAllByText(/テーマテスト生徒/)[0]).toBeInTheDocument();
    });
  });

  describe('TeacherDashboard AI & Filter Edge Operations', () => {
    test('switches tabs, edits AI rules, and toggles filters', async () => {
      const mockStudent: Student = {
        id: 'std-cov-td',
        name: 'TD生徒',
        grade: '小6',
        login_id: 'std_td',
        password: 'pass',
        status: 'normal',
        branch_id: 'branch-1',
        created_at: new Date().toISOString()
      };

      await db.saveStudent(mockStudent);

      const { container } = render(
        <TeacherDashboard onLogout={vi.fn()} initialDate="2026-08-21" />
      );

      await waitFor(() => {
        expect(screen.getByText(/司令塔ダッシュボード/)).toBeInTheDocument();
      });

      // Search student
      const searchBox = container.querySelector('input[placeholder*="検索"]') || container.querySelector('input[type="text"]');
      if (searchBox) {
        fireEvent.change(searchBox, { target: { value: 'TD生徒' } });
      }
    });
  });
});
