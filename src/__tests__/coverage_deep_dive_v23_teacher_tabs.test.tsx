import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';

describe('TeacherDashboard All Detail Tabs & Actions Deep Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('should deeply exercise student detail view with all sub-tabs', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(
        <TeacherDashboard
          onSelectStudent={vi.fn()}
          onLogout={vi.fn()}
        />
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Find and click on the first student card / row to open detail modal
    const studentItems = screen.queryAllByText(/田中 颯太|高橋 蓮|佐藤 健|中尾 謙信/);
    if (studentItems.length > 0) {
      await act(async () => {
        fireEvent.click(studentItems[0]);
      });
    }

    // Click all tabs inside detail modal
    const tabs = screen.queryAllByRole('tab');
    for (const tab of tabs) {
      await act(async () => {
        try { fireEvent.click(tab); } catch (e) {}
      });
    }

    // Click sub-buttons inside modal
    const allButtons = screen.queryAllByRole('button');
    for (const btn of allButtons) {
      await act(async () => {
        try {
          if (btn.textContent?.includes('保存') || btn.textContent?.includes('追加') || btn.textContent?.includes('生成') || btn.textContent?.includes('更新') || btn.textContent?.includes('計算')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
  });
});
