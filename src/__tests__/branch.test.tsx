import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import BranchManagement from '../components/BranchManagement';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Branch } from '../lib/db';

describe('Branch Management & Multi-tenant RBAC Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render BranchManagement component with stats, search, and list', async () => {
    const onSelectBranchMock = vi.fn();
    const onBackMock = vi.fn();

    render(<BranchManagement onSelectBranch={onSelectBranchMock} onBack={onBackMock} />);

    // Check title and stats
    expect(screen.getByText('本部専用 校舎アカウント管理')).toBeInTheDocument();
    expect(screen.getByText('登録校舎総数')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('恵比寿教室')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/稼働中/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/一時停止中/).length).toBeGreaterThanOrEqual(1);

    // Check seed branches
    expect(screen.getByText('恵比寿教室')).toBeInTheDocument();
    expect(screen.getByText('渋谷教室')).toBeInTheDocument();
    expect(screen.getByText('新宿教室')).toBeInTheDocument();
    expect(screen.getByText('横浜教室')).toBeInTheDocument();

    // Search filter
    const searchInput = screen.getByTestId('branch-search-input');
    fireEvent.change(searchInput, { target: { value: '渋谷' } });
    expect(screen.getByText('渋谷教室')).toBeInTheDocument();
    expect(screen.queryByText('恵比寿教室')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Status filter
    fireEvent.click(screen.getByText('● 停止中'));
    expect(screen.getByText('横浜教室')).toBeInTheDocument();
    expect(screen.queryByText('恵比寿教室')).not.toBeInTheDocument();

    // Back to all filter
    fireEvent.click(screen.getByText('すべて'));
    expect(screen.getByText('恵比寿教室')).toBeInTheDocument();

    // Click back button
    fireEvent.click(screen.getByText('ダッシュボードへ戻る'));
    expect(onBackMock).toHaveBeenCalled();
  });

  it('should support creating a new branch account via modal', async () => {
    // Mock global fetch for API route
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, branch: { id: 'branch-new', name: '自由が丘教室', code: 'JIYUGAOKA', email: 'jiyugaoka@tentoru.jp', status: 'active', created_at: new Date().toISOString() } })
    });

    render(<BranchManagement />);

    await waitFor(() => {
      expect(screen.getByText('恵比寿教室')).toBeInTheDocument();
    });

    // Open create modal
    const openBtn = screen.getByTestId('open-create-branch-modal');
    fireEvent.click(openBtn);

    expect(screen.getAllByText('新規校舎アカウント発行').length).toBeGreaterThanOrEqual(2);

    // Fill form
    const nameInput = screen.getByPlaceholderText('例: 横浜教室');
    const codeInput = screen.getByPlaceholderText('例: YOKOHAMA');
    const emailInput = screen.getByPlaceholderText('例: yokohama@tentoru.jp');

    fireEvent.change(nameInput, { target: { value: '自由が丘教室' } });
    fireEvent.change(codeInput, { target: { value: 'JIYUGAOKA' } });
    fireEvent.change(emailInput, { target: { value: 'jiyugaoka@tentoru.jp' } });

    // Click password generator button
    const genPassBtn = screen.getByText('自動生成');
    fireEvent.click(genPassBtn);

    // Submit form
    const submitBtn = screen.getByText('アカウントを発行する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/校舎アカウント「自由が丘教室」を発行しました/)).toBeInTheDocument();
    });
  });

  it('should support toggling status, password reset, and selecting branch', async () => {
    const onSelectBranchMock = vi.fn();
    render(<BranchManagement onSelectBranch={onSelectBranchMock} />);

    // Find first branch row
    await waitFor(() => {
      expect(screen.getByTestId('branch-row-branch-1')).toBeInTheDocument();
    });
    const ebisuRow = screen.getByTestId('branch-row-branch-1');

    // Click 校舎表示
    const selectBtn = ebisuRow.querySelector('button[title="この校舎のダッシュボードに切り替え"]')!;
    fireEvent.click(selectBtn);
    expect(onSelectBranchMock).toHaveBeenCalledWith(expect.objectContaining({ name: '恵比寿教室' }));

    // Click パスワード再設定
    const resetBtn = ebisuRow.querySelector('button[title="パスワード再設定メールを送信"]')!;
    await act(async () => {
      fireEvent.click(resetBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/パスワード再設定のご案内メールを送信しました/)).toBeInTheDocument();
    });

    // Click 一時停止
    const toggleBtn = ebisuRow.querySelector('button[title="アカウントを一時停止"]')!;
    await act(async () => {
      fireEvent.click(toggleBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/一時停止しました/)).toBeInTheDocument();
    });
  });

  it('should support role toggle, branch switching, and sidebar navigation in TeacherDashboard', async () => {
    render(<TeacherDashboard />);

    // Admin role by default -> check Header branch switcher and sidebar menu
    expect(screen.getByTestId('admin-branch-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('menu-branches')).toBeInTheDocument();

    // Click 校舎アカウント管理 in sidebar
    fireEvent.click(screen.getByTestId('menu-branches'));
    expect(screen.getByText('本部専用 校舎アカウント管理')).toBeInTheDocument();

    // Switch branch filter in header
    const branchSelect = screen.getByTestId('admin-branch-switcher');
    fireEvent.change(branchSelect, { target: { value: 'branch-1' } });

    // Switch to 校舎権限 (Branch Role)
    const branchRoleBtn = screen.getByTestId('role-toggle-branch');
    fireEvent.click(branchRoleBtn);

    // In Branch role, 本部管理 menu is hidden
    expect(screen.queryByTestId('menu-branches')).not.toBeInTheDocument();
    expect(screen.getByText(/🏢 恵比寿教室/)).toBeInTheDocument();

    // Switch back to 本部権限
    const adminRoleBtn = screen.getByTestId('role-toggle-admin');
    fireEvent.click(adminRoleBtn);
    expect(screen.getByTestId('menu-branches')).toBeInTheDocument();
  });

  it('should immediately update branch list table and header dropdown options upon creating a new branch account', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        branch: {
          id: 'branch-nakameguro',
          name: '中目黒教室',
          code: 'NAKAMEGURO',
          email: 'nakameguro@tentoru.jp',
          status: 'active',
          created_at: new Date().toISOString()
        }
      })
    });

    render(<TeacherDashboard />);

    // 1. Initial header dropdown check
    const branchSelect = screen.getByTestId('admin-branch-switcher') as HTMLSelectElement;
    expect(screen.getByText('全校舎 (本部一括表示)')).toBeInTheDocument();
    expect(screen.queryByText('中目黒教室')).not.toBeInTheDocument();

    // 2. Open Branch Management tab
    fireEvent.click(screen.getByTestId('menu-branches'));
    expect(screen.getByText('本部専用 校舎アカウント管理')).toBeInTheDocument();

    // 3. Open Create Modal
    fireEvent.click(screen.getByTestId('open-create-branch-modal'));

    // 4. Fill form
    const nameInput = screen.getByPlaceholderText('例: 横浜教室');
    const codeInput = screen.getByPlaceholderText('例: YOKOHAMA');
    const emailInput = screen.getByPlaceholderText('例: yokohama@tentoru.jp');

    fireEvent.change(nameInput, { target: { value: '中目黒教室' } });
    fireEvent.change(codeInput, { target: { value: 'NAKAMEGURO' } });
    fireEvent.change(emailInput, { target: { value: 'nakameguro@tentoru.jp' } });

    // 5. Submit
    const submitBtn = screen.getByText('アカウントを発行する');
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 6. Check Table and Dropdown immediate reflection
    await waitFor(() => {
      expect(screen.getByText(/校舎アカウント「中目黒教室」を発行しました/)).toBeInTheDocument();
    });

    // Table and Header dropdown both contain newly created branch
    expect(screen.getAllByText('中目黒教室').length).toBeGreaterThanOrEqual(1);

    // Header dropdown contains newly created branch
    await waitFor(() => {
      const options = Array.from(branchSelect.options).map(opt => opt.text);
      expect(options).toContain('中目黒教室');
    });
  });
});
