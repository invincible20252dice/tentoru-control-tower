import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AdminBranchesPage from '../app/admin/branches/page';
import AdminCurriculumImportPage from '../app/admin/curriculum-import/page';
import { db } from '../lib/db';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn()
  })
}));

describe('Admin Pages Auth Guard and Rendering Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    vi.restoreAllMocks();
  });

  describe('AdminBranchesPage', () => {
    it('should redirect non-admin or unauthenticated user to root /', async () => {
      vi.spyOn(db, 'getSession').mockReturnValue(null);
      render(<AdminBranchesPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/');
      });
    });

    it('should redirect branch role user to root /', async () => {
      vi.spyOn(db, 'getSession').mockReturnValue({
        user: {
          id: 'usr-branch',
          email: 'ebisu@tentoru.jp',
          role: 'branch',
          branch_id: 'branch-1',
          branch_name: '恵比寿教室',
          name: '恵比寿教室 責任者'
        },
        logged_in_at: new Date().toISOString()
      });

      render(<AdminBranchesPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/');
      });
    });

    it('should render BranchManagement when session is admin and allow back navigation', async () => {
      vi.spyOn(db, 'getSession').mockReturnValue({
        user: {
          id: 'usr-admin',
          email: 'admin@tentoru.jp',
          role: 'admin',
          branch_id: null,
          branch_name: '本部統括管理者',
          name: '本部統括管理者'
        },
        logged_in_at: new Date().toISOString()
      });

      render(<AdminBranchesPage />);

      await waitFor(() => {
        expect(screen.getByText('本部専用 校舎アカウント管理')).toBeInTheDocument();
      });

      const backBtn = screen.getByText('ダッシュボードへ戻る');
      fireEvent.click(backBtn);
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });

  describe('AdminCurriculumImportPage', () => {
    it('should redirect unauthenticated user to root /', async () => {
      vi.spyOn(db, 'getSession').mockReturnValue(null);
      render(<AdminCurriculumImportPage />);

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/');
      });
    });

    it('should render CurriculumCsvImport when session is admin and allow back navigation', async () => {
      vi.spyOn(db, 'getSession').mockReturnValue({
        user: {
          id: 'usr-admin',
          email: 'admin@tentoru.jp',
          role: 'admin',
          branch_id: null,
          branch_name: '本部統括管理者',
          name: '本部統括管理者'
        },
        logged_in_at: new Date().toISOString()
      });

      render(<AdminCurriculumImportPage />);

      await waitFor(() => {
        expect(screen.getByText(/カリキュラムデータ CSV一括インポート/)).toBeInTheDocument();
      });

      const backBtn = screen.getByText('戻る');
      fireEvent.click(backBtn);
      expect(pushMock).toHaveBeenCalledWith('/');
    });
  });
});
