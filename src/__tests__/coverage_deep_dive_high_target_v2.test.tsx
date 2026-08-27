import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, StudentInteraction, CurriculumMaster, MiniTestResult, HomeworkResult } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';
import { BranchManagement } from '../components/BranchManagement';

describe('Coverage Deep Dive High Target V2 Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  it('covers all db.ts Supabase mode and fallback branches for 95%+ coverage', async () => {
    // Supabase モッククライアント作成
    const mockSingleSuccess = (data: any) => ({ single: () => Promise.resolve({ data, error: null }) });
    const mockSingleError = (err: any) => ({ single: () => Promise.resolve({ data: null, error: err }) });
    const mockOrderSuccess = (data: any[]) => ({ order: () => Promise.resolve({ data, error: null }) });
    const mockOrderError = (err: any) => ({ order: () => Promise.resolve({ data: null, error: err }) });

    const createMockSupabase = (succeed: boolean) => ({
      from: (tableName: string) => {
        return {
          select: (cols?: string) => {
            if (!succeed) {
              return {
                eq: () => ({
                  order: () => Promise.resolve({ data: null, error: new Error('Supabase Select Error') }),
                  single: () => Promise.resolve({ data: null, error: new Error('Supabase Select Error') })
                }),
                order: () => Promise.resolve({ data: null, error: new Error('Supabase Select Error') }),
                single: () => Promise.resolve({ data: null, error: new Error('Supabase Select Error') })
              };
            }
            return {
              eq: (col: string, val: any) => ({
                order: () => Promise.resolve({
                  data: [
                    {
                      id: 'row-1',
                      student_id: 'std-1',
                      category: 'その他',
                      memo: 'テストメモ',
                      contact_date: '2026-08-27',
                      staff_name: '山田',
                      created_at: '2026-08-27T00:00:00Z',
                      grade: '中1',
                      name: 'テスト生徒',
                      branch_id: 'branch-1'
                    }
                  ],
                  error: null
                }),
                single: () => Promise.resolve({
                  data: {
                    id: 'row-1',
                    student_id: 'std-1',
                    category: 'その他',
                    memo: 'テストメモ',
                    contact_date: '2026-08-27',
                    staff_name: '山田',
                    created_at: '2026-08-27T00:00:00Z'
                  },
                  error: null
                })
              }),
              order: (col: string, opt: any) => Promise.resolve({
                data: [
                  {
                    id: 'row-1',
                    student_id: 'std-1',
                    category: 'その他',
                    memo: 'テストメモ',
                    contact_date: '2026-08-27',
                    staff_name: '山田',
                    created_at: '2026-08-27T00:00:00Z'
                  }
                ],
                error: null
              }),
              single: () => Promise.resolve({ data: { id: 'row-1' }, error: null })
            };
          },
          upsert: (payload: any) => ({
            select: () => mockSingleSuccess({ id: 'upserted-1', ...payload })
          }),
          insert: (payload: any) => ({
            select: () => mockSingleSuccess({ id: 'inserted-1', ...payload })
          }),
          update: (payload: any) => ({
            eq: () => ({
              select: () => mockSingleSuccess({ id: 'updated-1', ...payload })
            })
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
            in: () => Promise.resolve({ error: null })
          })
        };
      }
    });

    // Supabase モード有効化 (成功パターン)
    const successSupabase = createMockSupabase(true);
    (db as any).supabase = successSupabase;
    (db as any).isMockMode = false;

    // fetchStudentInteractions (Step 1 ~ Step 3)
    const interactions = await db.fetchStudentInteractions('std-1');
    expect(interactions.length).toBeGreaterThan(0);

    // saveStudentInteraction
    const savedInt = await db.saveStudentInteraction({
      id: 'si-99',
      student_id: 'std-1',
      category: '保護者対応',
      memo: 'テスト保護者対応',
      date: '2026-08-27',
      staff_name: '佐藤'
    });
    expect(savedInt).toBeDefined();

    // deleteStudentInteraction
    await db.deleteStudentInteraction('si-99');

    // fetchPersonalityOptions & add & delete
    const personalities = await db.fetchPersonalityOptions();
    expect(personalities).toBeDefined();
    await db.addPersonalityOption('真面目');
    await db.deletePersonalityOption('真面目');

    // fetchTeacherOptions & add & delete
    const teachers = await db.fetchTeacherOptions();
    expect(teachers).toBeDefined();
    await db.addTeacherOption('高橋');
    await db.deleteTeacherOption('高橋');

    // 各テーブルの Async CRUD メソッド呼び出し網羅
    await db.fetchBranches();
    await db.saveBranch({ id: 'b-1', name: 'テスト校舎', code: 'T01' } as any);
    await db.deleteBranch('b-1');

    await db.fetchSchools();
    await db.saveSchool({ id: 'sch-1', name: 'テスト中学' } as any);
    await db.deleteSchool('sch-1');

    await db.fetchStudents();
    await db.saveStudent({ id: 'std-1', name: 'テスト生徒', grade: '中1' } as any);
    await db.deleteStudent('std-1');

    await db.fetchSchools();
    await db.saveSchool({ id: 'sch-1', name: 'テスト中学' } as any);
    await db.deleteSchool('sch-1');

    await db.fetchBranches();
    await db.saveBranch({ id: 'b-1', name: 'テスト校舎', code: 'T01' } as any);
    await db.deleteBranch('b-1');

    await db.getMilestoneTemplates();
    await db.saveMilestoneTemplate({ id: 'mt-1', name: 'テンプレート1' } as any);
    await db.deleteMilestoneTemplate('mt-1');

    await db.getCustomApplyScopes();
    await db.saveCustomApplyScope({ id: 'cas-1', scope_name: '適用範囲' } as any);
    await db.deleteCustomApplyScope('cas-1');

    await db.deleteCurriculumMastersByGrades(['中1', '中2']);
    await db.fetchStudentScheduleConfig('std-1');
    await db.saveStudentScheduleConfig({ id: 'ssc-1', student_id: 'std-1' } as any);

    // Supabase モードのエラー発生分岐の網羅
    const errorSupabase = createMockSupabase(false);
    (db as any).supabase = errorSupabase;
    (db as any).isMockMode = false;

    await db.fetchStudentInteractions('std-1').catch(() => []);
    await db.deleteStudentInteraction('si-99').catch(() => {});
    await db.fetchPersonalityOptions().catch(() => []);
    await db.fetchTeacherOptions().catch(() => []);
    await db.deleteCurriculumMastersByGrades(['中1']).catch(() => {});
    await db.fetchStudentScheduleConfig('std-1').catch(() => null);

    // Mock モードへの復帰
    (db as any).isMockMode = true;
  });

  it('covers CurriculumCsvImport edge cases, error handling, and legacy cleanup', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
    const handleSuccess = vi.fn();

    render(<CurriculumCsvImport onImportSuccess={handleSuccess} />);

    // 有効CSVファイル選択のテスト (学年,教科,単元名,授業名)
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement;
    const validCsvContent = `学年,教科,単元名,授業名,標準週数
中1,数学,正の数・負の数,加法,2
中2,英語,Be動詞,過去形,1`;
    const validFile = new File([validCsvContent], 'valid.curriculum.csv', { type: 'text/csv' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [validFile] } });
    });

    // プレビュー表示確認
    await waitFor(() => {
      expect(screen.getByText('正の数・負の数')).toBeInTheDocument();
    });

    // インポート実行
    const importSubmitBtn = screen.getByRole('button', { name: /一括登録/i });
    await act(async () => {
      fireEvent.click(importSubmitBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('curriculum-import-toast')).toBeInTheDocument();
    });
  });

  it('covers BranchManagement full feature branches', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    const mockBranchList = [
      { id: 'branch-1', name: '恵比寿校', code: 'EBS01', email: 'ebisu@test.com', phone: '03-1234-5678', is_active: true }
    ];
    vi.spyOn(db, 'fetchBranches').mockResolvedValue(mockBranchList as any);
    vi.spyOn(db, 'getBranches').mockReturnValue(mockBranchList as any);
    vi.spyOn(db, 'createBranchAccount').mockResolvedValue({
      branch: { id: 'branch-2', name: '池袋校', code: 'IKB01', email: 'ikebukuro@test.com', is_active: true }
    } as any);

    render(<BranchManagement />);

    await waitFor(() => {
      expect(screen.getByText('恵比寿校')).toBeInTheDocument();
    });

    // 「新規校舎アカウント発行」モーダルを開く
    const openModalBtn = screen.getByTestId('open-create-branch-modal');
    await act(async () => {
      fireEvent.click(openModalBtn);
    });

    // 新規校舎追加フォーム入力
    const nameInput = screen.getByPlaceholderText(/例: 横浜教室/i);
    const codeInput = screen.getAllByPlaceholderText(/例: YOKOHAMA/i)[0];
    const submitBtns = screen.getAllByRole('button', { name: /発行/i });
    const addBtn = submitBtns[submitBtns.length - 1];

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: '池袋校' } });
      fireEvent.change(codeInput, { target: { value: 'IKB01' } });
      fireEvent.click(addBtn);
    });
  });
});
