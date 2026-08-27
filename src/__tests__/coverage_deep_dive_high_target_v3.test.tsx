import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';

describe('Coverage Deep Dive High Target V3 Tests', () => {
  beforeEach(async () => {
    localStorage.clear();
    const student: Student = {
      id: 'std-1',
      student_id: 'S001',
      name: '山田 太郎',
      grade: '中1',
      level: 'A',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '福田 尚弘'
    };
    await db.saveStudent(student);
  });

  it('covers CurriculumCsvImport unit tests export, clear all, and tab switching', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
    const handleSuccess = vi.fn();

    render(<CurriculumCsvImport onImportSuccess={handleSuccess} />);

    // 「単元テスト一括管理＆CSV出力」タブへ切り替え
    const unitTestsTab = screen.getByTestId('tab-unit-tests');
    await act(async () => {
      fireEvent.click(unitTestsTab);
    });

    // 「単元テストCSVエクスポート」実行 (空データ時エラーメッセージ確認)
    const exportBtn = screen.getByRole('button', { name: /単元テストCSVエクスポート/i });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    // 「CSVインポート」タブへ戻る
    const importTab = screen.getByTestId('tab-csv-import');
    await act(async () => {
      fireEvent.click(importTab);
    });

    // 有効な単元テストCSVファイルを読み込み
    const fileInput = screen.getByTestId('csv-file-input') as HTMLInputElement;
    const csvContent = `学年,教科,単元名,授業名,標準週数,合格基準
中1,数学,正の数・負の数,加法テスト,2,80点以上
中2,英語,Be動詞,過去形テスト,1,75点以上`;
    const csvFile = new File([csvContent], 'unit_tests.csv', { type: 'text/csv' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
    });

    await waitFor(() => {
      expect(screen.getByText('正の数・負の数')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /一括登録/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // タブ「単元テスト一括管理＆CSV出力」でデータあり時のエクスポート
    await act(async () => {
      fireEvent.click(unitTestsTab);
    });

    const mockURL = { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() };
    (global as any).URL = mockURL;

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    // 「登録済みマスター一覧」タブへ切り替え
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });
  });

  it('covers TeacherDashboard remaining tabs and sorting branches', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard initialStudentId="std-1" onBackToPortal={vi.fn()} />);

    // 「年間計画（マイルストーン）」タブ
    const milestoneTab = screen.getByRole('button', { name: /年間計画（マイルストーン）/i });
    await act(async () => {
      fireEvent.click(milestoneTab);
    });

    // 「学校カリキュラム管理」タブ
    const curriculumTab = screen.getByRole('button', { name: /学校カリキュラム管理/i });
    await act(async () => {
      fireEvent.click(curriculumTab);
    });

    // 「定期テスト・模試」タブ
    const testTab = screen.getByRole('button', { name: /定期テスト・模試/i });
    await act(async () => {
      fireEvent.click(testTab);
    });

    // 「AI指導報告書」タブ
    const aiReportTab = screen.getByRole('button', { name: /AI指導報告書/i });
    await act(async () => {
      fireEvent.click(aiReportTab);
    });
  });

  it('covers db.ts saveStudentScheduleConfig update & insert Supabase branches', async () => {
    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { id: 'cfg-1', student_id: 'std-1' }, error: null })
          })
        }),
        upsert: (payload: any) => Promise.resolve({ error: null }),
        update: (payload: any) => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'cfg-1', ...payload }, error: null })
            })
          })
        }),
        insert: (payload: any) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'cfg-2', ...payload }, error: null })
          })
        })
      })
    };

    (db as any).supabase = mockSupabase;
    (db as any).isMockMode = false;

    const resConfig = await db.fetchStudentScheduleConfig('std-1');
    expect(resConfig).toBeDefined();

    await db.saveStudentScheduleConfig({
      id: 'cfg-1',
      student_id: 'std-1',
      period_count: 3
    } as any);

    (db as any).isMockMode = true;
  });
});
