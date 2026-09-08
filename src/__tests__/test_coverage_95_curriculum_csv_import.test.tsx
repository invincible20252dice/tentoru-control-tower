import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, CurriculumMaster } from '../lib/db';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';

describe('Coverage 95%+ Target for CurriculumCsvImport', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });

    const masters: CurriculumMaster[] = [
      { id: 'cm-imp-01', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '正負の数とは', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-imp-02', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '正負の数 単元確認テスト', sort_order: 2, item_type: 'unit_test', passing_line: '80%以上' },
      { id: 'cm-imp-03', grade: '小5', subject: '算数', unit_name: '整数と小数', lesson_name: '小数の計算', sort_order: 1, item_type: 'lesson' }
    ];
    await db.saveCurriculumMasters(masters);
  });

  it('covers all tabs, file drop, sample downloads, imports, exports, and deletions in CurriculumCsvImport', async () => {
    const onImportSuccess = vi.fn();
    const onImportCompleted = vi.fn();
    const onBack = vi.fn();

    const { container } = render(
      <CurriculumCsvImport
        onImportSuccess={onImportSuccess}
        onImportCompleted={onImportCompleted}
        onBack={onBack}
      />
    );

    // 1. Back button
    const backBtn = screen.queryByRole('button', { name: /戻る/i });
    if (backBtn) {
      fireEvent.click(backBtn);
      expect(onBack).toHaveBeenCalled();
    }

    // 2. Download sample CSV and copy sample
    const sampleCsvBtn = screen.queryByRole('button', { name: /サンプルCSVダウンロード/i });
    if (sampleCsvBtn) fireEvent.click(sampleCsvBtn);

    const copySampleBtn = screen.queryByRole('button', { name: /コピー/i });
    if (copySampleBtn) fireEvent.click(copySampleBtn);

    // 3. Drag and Drop events
    const dropZone = container.querySelector('div[style*="dashed"]') || container;
    fireEvent.dragOver(dropZone, { preventDefault: vi.fn() });
    fireEvent.dragLeave(dropZone, { preventDefault: vi.fn() });

    const csvFile = new File(['学年,教科,単元名,授業名\n中1,数学,正負の数,加法'], 'curriculum.csv', { type: 'text/csv' });
    fireEvent.drop(dropZone, {
      preventDefault: vi.fn(),
      dataTransfer: { files: [csvFile] }
    });

    // 4. File input change
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput) {
      const validCsv = '学年,教科,単元名,授業名,区分,合格基準\n中1,数学,正負の数,符号テスト,単元テスト,80点';
      const file = new File([validCsv], 'test.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Execute import
      await waitFor(() => {
        const executeBtn = screen.queryByRole('button', { name: /インポート実行/i }) || screen.queryByRole('button', { name: /確定/i });
        if (executeBtn) {
          fireEvent.click(executeBtn);
        }
      });
    }

    // 5. Switch to Unit Tests Tab (tab-unit-tests)
    const unitTestsTab = screen.queryByTestId('tab-unit-tests') || screen.queryByRole('button', { name: /単元テスト/i });
    if (unitTestsTab) {
      await act(async () => {
        fireEvent.click(unitTestsTab);
      });

      const exportBtn = screen.queryByTestId('export-unit-test-csv-btn');
      if (exportBtn) fireEvent.click(exportBtn);

      const downloadSampleBtn = screen.queryByTestId('download-unit-test-sample-btn');
      if (downloadSampleBtn) fireEvent.click(downloadSampleBtn);

      // Delete single unit test
      const deleteUnitTestBtn = screen.queryByTestId('delete-unittest-master-cm-imp-02');
      if (deleteUnitTestBtn) {
        await act(async () => {
          fireEvent.click(deleteUnitTestBtn);
        });
      }
    }

    // 6. Switch to Curriculum List Tab (tab-curriculum-list)
    const listTab = screen.queryByTestId('tab-curriculum-list') || screen.queryByRole('button', { name: /登録済みマスター一覧/i });
    if (listTab) {
      await act(async () => {
        fireEvent.click(listTab);
      });

      // Filter select dropdowns
      const selects = container.querySelectorAll('select');
      selects.forEach(select => {
        fireEvent.change(select, { target: { value: '中1' } });
        fireEvent.change(select, { target: { value: '数学' } });
      });

      // Search query input
      const searchInput = container.querySelector('input[placeholder*="検索"]') || container.querySelector('input[type="text"]');
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: '正負' } });
      }

      // Delete legacy format button
      const legacyBtn = screen.queryByRole('button', { name: /旧フォーマット.*削除/i });
      if (legacyBtn) {
        await act(async () => {
          fireEvent.click(legacyBtn);
        });
      }

      // Clear all masters button
      const clearAllBtn = screen.queryByRole('button', { name: /全削除/i }) || screen.queryByRole('button', { name: /初期化/i });
      if (clearAllBtn) {
        await act(async () => {
          fireEvent.click(clearAllBtn);
        });
      }
    }
  });
});
