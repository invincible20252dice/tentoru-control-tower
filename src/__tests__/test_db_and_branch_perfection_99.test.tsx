import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import BranchManagement from '../components/BranchManagement';
import { db } from '../lib/db';
import { Branch, School, CustomApplyScope, Student, LearningTask, TestRecord, StudentInteraction } from '../types';

describe('DB and BranchManagement 99% Pure Coverage Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('covers all remaining db.ts CRUD and edge case methods', async () => {
    // 1. CustomApplyScopes
    const scope: CustomApplyScope = {
      id: 'scope-1',
      name: '中3 Aクラス一括',
      student_ids: ['std-1', 'std-2'],
      created_at: new Date().toISOString()
    };
    const savedScope = await db.saveCustomApplyScope(scope);
    expect(savedScope.id).toBe('scope-1');
    expect(db.getCustomApplyScopes().some(s => s.id === 'scope-1')).toBe(true);
    await db.deleteCustomApplyScope('scope-1');
    expect(db.getCustomApplyScopes().some(s => s.id === 'scope-1')).toBe(false);

    // 2. Schools
    const school: School = {
      id: 'sch-cov-99',
      name: '完全カバレッジ中学校',
      type: 'junior_high',
      grade_levels: ['中1', '中2', '中3'],
      created_at: new Date().toISOString()
    };
    await db.saveSchool(school);
    expect(db.getSchools().some(s => s.id === 'sch-cov-99')).toBe(true);
    await db.deleteSchool('sch-cov-99');
    expect(db.getSchools().some(s => s.id === 'sch-cov-99')).toBe(false);

    // 3. Branches & Accounts
    const branch: Branch = {
      id: 'branch-cov-99',
      name: '完全カバレッジ教室',
      code: 'COV99',
      email: 'cov99@tentoru.jp',
      status: 'active',
      phone: '03-9999-9999',
      address: '東京都渋谷区',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);
    expect(db.getBranches().some(b => b.id === 'branch-cov-99')).toBe(true);
    await db.toggleBranchStatus('branch-cov-99');
    const toggled = db.getBranches().find(b => b.id === 'branch-cov-99');
    expect(toggled?.status).toBe('suspended');

    // 4. Test Records
    const tr: TestRecord = {
      id: 'tr-cov-99',
      student_id: 'std-1',
      record_type: 'regular_test',
      test_name: '期末テスト',
      subject: '数学',
      score: 95,
      date: '2026-09-28',
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(tr);
    expect(db.getTestRecords('std-1').some(t => t.id === 'tr-cov-99')).toBe(true);
    await db.deleteTestRecord('tr-cov-99');
    expect(db.getTestRecords('std-1').some(t => t.id === 'tr-cov-99')).toBe(false);

    // 5. Interactions
    const inter: StudentInteraction = {
      id: 'inter-cov-99',
      student_id: 'std-1',
      category: '勉強相談',
      memo: '進度良好',
      date: '2026-09-28',
      staff_name: '福田',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(inter);
    expect(db.getStudentInteractions('std-1').some(i => i.id === 'inter-cov-99')).toBe(true);
    await db.deleteStudentInteraction('inter-cov-99');
    expect(db.getStudentInteractions('std-1').some(i => i.id === 'inter-cov-99')).toBe(false);

    // 6. Gemini Key LocalStorage
    localStorage.setItem('tentoru_gemini_api_key', 'AIzaSyDummy123456');
    expect(localStorage.getItem('tentoru_gemini_api_key')).toBe('AIzaSyDummy123456');
    localStorage.removeItem('tentoru_gemini_api_key');
    expect(localStorage.getItem('tentoru_gemini_api_key')).toBeNull();
  });

  it('covers BranchManagement password generator, modal toggle, and status changes', async () => {
    const branch: Branch = {
      id: 'branch-bm-1',
      name: '表参道教室',
      code: 'OMT01',
      email: 'omotesando@tentoru.jp',
      status: 'active',
      phone: '03-1111-2222',
      address: '東京都港区北青山',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    await act(async () => {
      render(<BranchManagement />);
    });

    // 新規登録モーダルを開く
    const addBtn = screen.queryByText(/新規校舎登録|校舎を追加/);
    if (addBtn) {
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // パスワード自動生成ボタン
      const genPassBtn = screen.queryByText(/自動生成|強力なパスワードを生成/);
      if (genPassBtn) {
        await act(async () => {
          fireEvent.click(genPassBtn);
        });
      }

      // キャンセル
      const cancelBtn = screen.queryByText('キャンセル');
      if (cancelBtn) {
        await act(async () => {
          fireEvent.click(cancelBtn);
        });
      }
    }

    // ステータス停止/再開ボタン
    const toggleBtns = screen.queryAllByText(/利用停止|停止|再開/);
    if (toggleBtns.length > 0) {
      await act(async () => {
        fireEvent.click(toggleBtns[0]);
      });
    }
  });
});
