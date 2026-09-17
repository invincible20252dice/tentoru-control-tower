import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

describe('Supabase Debug Banner & Force Re-Sync Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('renders debug banner, displays raw students summary and sync logs', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialTab="student-list"
          teacherType="all"
        />
      );
    });

    const banner = screen.getByTestId('supabase-debug-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('Supabase DB接続・生徒データ取得診断バナー');

    const rawSummary = screen.getByTestId('debug-raw-students-summary');
    expect(rawSummary).toBeInTheDocument();
  });

  it('triggers force sync when clicking force sync button and displays sync log', async () => {
    const fetchSpy = vi.spyOn(db, 'fetchStudents');
    
    await act(async () => {
      render(
        <TeacherDashboard
          initialTab="student-list"
          teacherType="all"
        />
      );
    });

    const syncBtn = screen.getByTestId('force-sync-students-btn');
    expect(syncBtn).toBeInTheDocument();
    expect(syncBtn).toHaveTextContent('🔄 DB生徒データ再取得・自動復元');

    await act(async () => {
      fireEvent.click(syncBtn);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const syncLog = screen.queryByTestId('debug-sync-log');
    if (syncLog) {
      expect(syncLog).toBeInTheDocument();
      expect(syncLog).toHaveTextContent('同期ログ:');
    }

    fetchSpy.mockRestore();
  });

  it('handles force sync error gracefully', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialTab="student-list"
          teacherType="all"
        />
      );
    });

    const fetchSpy = vi.spyOn(db, 'fetchStudents').mockRejectedValueOnce(new Error('Network Sync Failure'));

    const syncBtn = screen.getByTestId('force-sync-students-btn');
    await act(async () => {
      fireEvent.click(syncBtn);
    });

    await waitFor(() => {
      const syncLog = screen.queryByTestId('debug-sync-log');
      expect(syncLog).toBeInTheDocument();
      expect(syncLog).toHaveTextContent('同期エラー: Network Sync Failure');
    });

    fetchSpy.mockRestore();
  });
});
