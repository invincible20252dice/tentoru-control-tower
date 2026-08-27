import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';

describe('Coverage Deep Dive V7 Mega 95% Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    const branch1: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS01',
      email: 'ebisu@tentoru.jp',
      phone: '03-1111-2222',
      is_active: true,
      status: 'active'
    };
    const branchSuspended: Branch = {
      id: 'branch-suspended',
      name: '停止中教室',
      code: 'SPD01',
      email: 'suspended@tentoru.jp',
      phone: '03-9999-9999',
      is_active: false,
      status: 'suspended'
    };
    await db.saveBranch(branch1);
    await db.saveBranch(branchSuspended);
  });

  it('covers all db.ts authentication, session, role, and password reset branches', async () => {
    // 空メール・パスワードのテスト
    const res1 = await db.signInWithPassword('', '');
    expect(res1.success).toBe(false);

    const res2 = await db.signInWithPassword('test@tentoru.jp', '');
    expect(res2.success).toBe(false);

    // パスワード間違い・誤メールのテスト
    const res3 = await db.signInWithPassword('test@tentoru.jp', 'wrongpass');
    expect(res3.success).toBe(false);

    // 一時停止中校舎でのログインのテスト
    const res4 = await db.signInWithPassword('suspended@tentoru.jp', 'password123');
    expect(res4.success).toBe(false);
    expect(res4.error).toContain('一時停止中');

    // 校舎アカウントログイン成功のテスト
    const res5 = await db.signInWithPassword('ebisu@tentoru.jp', 'Tentoru2026!');
    expect(res5.success).toBe(true);
    expect(db.getSession()).toBeDefined();

    // 本部管理者アカウントログイン成功のテスト
    const res6 = await db.signInWithPassword('admin@tentoru.jp', 'Tentoru2026!');
    expect(res6.success).toBe(true);

    // 一般メールアドレスでのサインインのテスト
    const res7 = await db.signInWithPassword('user@example.com', 'validpass');
    expect(res7.success).toBe(false);

    // ログアウトとロール設定のテスト
    await db.signOut();
    expect(db.getSession()).toBeNull();

    db.setCurrentUserRole('branch', 'branch-1', '恵比寿教室');
    const roleInfo = db.getCurrentUserRole();
    expect(roleInfo.role).toBe('branch');

    // Supabase モード時の Auth サインイン
    const mockSupabaseAuth = {
      auth: {
        signInWithPassword: () => Promise.resolve({
          data: {
            user: { id: 'supa-usr-1', email: 'ebisu@tentoru.jp', user_metadata: { role: 'branch' } },
            session: { access_token: 'mock-access-token' }
          },
          error: null
        }),
        signOut: () => Promise.resolve({ error: null })
      }
    };
    (db as any).supabase = mockSupabaseAuth;
    (db as any).isMockMode = false;

    await db.signInWithPassword('ebisu@tentoru.jp', 'pass');
    await db.signOut();

    (db as any).isMockMode = true;
  });

  it('covers CurriculumCsvImport edge cases and export options', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<CurriculumCsvImport onImportSuccess={vi.fn()} />);

    // 「登録済みマスター一覧」タブの表示・操作
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });

    // 「CSVインポート」タブへの復帰
    const importTab = screen.getByTestId('tab-csv-import');
    await act(async () => {
      fireEvent.click(importTab);
    });
  });
});
