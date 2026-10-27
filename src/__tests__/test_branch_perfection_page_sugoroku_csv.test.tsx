import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Home from '../app/page';
import SugorokuMap from '../components/SugorokuMap';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import { db } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

describe('Page, SugorokuMap, and CurriculumCsvImport Branch Perfection Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  });

  // --- 1. page.tsx ---
  describe('page.tsx Branch Perfection', () => {
    it('covers saved teacherType high_school, student category filters, branch user role badge, student login, and back to login', async () => {
      localStorage.setItem('tentoru_teacher_type', 'high_school');

      const mockStudentHighSchool = {
        id: 'st_hs',
        name: '高校生太郎',
        grade: '高2',
        grade_category: '高校生'
      };
      const mockStudentGrad = {
        id: 'st_grad',
        name: '既卒花子',
        grade: '既卒',
        grade_category: ''
      };
      const mockStudentElem = {
        id: 'st_elem',
        name: '小学生次郎',
        grade: '小3',
        grade_category: '小学生'
      };

      vi.spyOn(db, 'getStudents').mockReturnValue([mockStudentHighSchool as any, mockStudentGrad as any, mockStudentElem as any]);
      vi.spyOn(db, 'fetchStudents').mockResolvedValue([]); // trigger fetched.length === 0 branch
      vi.spyOn(db, 'getSession').mockReturnValue({
        user: { id: 'u2', name: '所沢校長', email: 'branch@tentoru.jp', role: 'teacher', branch_id: 'b1' },
        expires_at: '2099-01-01'
      } as any);

      // Render Home
      const { unmount } = render(<Home />);

      // Verify Teacher view rendered with "ポータルへ戻る"
      const backBtn = await screen.findByRole('button', { name: /ポータルへ戻る/i });
      fireEvent.click(backBtn);

      // Now on portal view, check branch role badge ('校舎')
      await waitFor(() => {
        expect(screen.getByText('校舎')).toBeDefined();
      });

      // Test Category select: high_school
      const categorySelect = screen.getByTestId('portal-grade-category-select');
      fireEvent.change(categorySelect, { target: { value: 'high_school' } });

      const studentSelect = screen.getByTestId('portal-student-select');
      fireEvent.change(studentSelect, { target: { value: 'st_hs' } });

      const enterStudentBtn = screen.getByTestId('portal-enter-student-screen-btn');
      fireEvent.click(enterStudentBtn);

      // Verify entering student dashboard
      await waitFor(() => {
        expect(screen.getByText(/高校生太郎/i)).toBeDefined();
      });

      // Back to portal from student dashboard
      const backFromStudentBtn = screen.getByRole('button', { name: /ログアウト（ポータルへ）/i });
      fireEvent.click(backFromStudentBtn);

      // Now on portal again, click logout to trigger handleLogout
      const logoutBtn = await screen.findByTestId('portal-logout-btn');
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(screen.getByTestId('login-submit-btn')).toBeDefined();
      });

      unmount();
    });

    it('covers session without role defaulting to admin, onDateChange callback, and handleBackToPortal without session', async () => {
      // Mock session without role to test session?.user?.role || 'admin'
      vi.spyOn(db, 'getSession').mockReturnValue({
        user: { id: 'u_norole', name: '名無し管理者', email: 'norole@test.com' },
        expires_at: '2099-01-01'
      } as any);
      vi.spyOn(db, 'getStudents').mockReturnValue([]);

      render(<Home />);

      // Verify rendered in Teacher view with admin fallback
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ポータルへ戻る/i })).toBeDefined();
      });

      // Click back to portal
      const backBtn = screen.getByRole('button', { name: /ポータルへ戻る/i });
      fireEvent.click(backBtn);

      await waitFor(() => {
        expect(screen.getByTestId('portal-logout-btn')).toBeDefined();
      });

      // Now click logout on portal
      fireEvent.click(screen.getByTestId('portal-logout-btn'));
      await waitFor(() => {
        expect(screen.getByTestId('login-submit-btn')).toBeDefined();
      });
    });
  });

  // --- 2. SugorokuMap.tsx ---
  describe('SugorokuMap.tsx Branch Perfection', () => {
    it('covers node click without masters, unit test lock conditions, and todayTasks range splitting', async () => {
      const todayStr = getDynamicDateStr(0);
      const student = {
        id: 'st_sugo',
        name: 'スゴロク生徒',
        grade: '中1',
        completed_lesson_ids: ['u_1']
      };

      const units = [
        {
          id: 'u_1',
          name: '正の数・負の数',
          subject: '数学',
          sequence_order: 1
        },
        {
          id: 'u_2',
          name: '正の数・負の数 単元確認テスト',
          subject: '数学',
          sequence_order: 2
        },
        {
          id: 'u_3',
          name: '文字と式',
          subject: '数学',
          sequence_order: 3
        }
      ];

      // Failed mini test for unit 2
      const miniTestResults = [
        {
          id: 'mt_1',
          student_id: 'st_sugo',
          subject: '数学',
          unit_name: '正の数・負の数',
          test_content: '正の数・負の数 単元確認テスト',
          date: todayStr,
          passed: false,
          score: 60
        }
      ];

      // Today task with range text ~ for splitting branch (lines 226-234)
      const todayTasks = [
        {
          id: 'tt_1',
          student_id: 'st_sugo',
          subject: '数学',
          lesson_range: '正の数・負の数 〜 文字と式',
          scheduled_date: todayStr,
          period: 1,
          status: 'pending'
        }
      ];

      // Mock getCurriculumMasters and fetchCurriculumMasters returning empty array so it uses fallbackUnits
      vi.spyOn(db, 'getCurriculumMasters').mockReturnValue([]);
      vi.spyOn(db, 'fetchCurriculumMasters').mockResolvedValue([]);

      const { rerender } = render(
        <SugorokuMap
          student={student as any}
          initialSubject="数学"
          units={units as any}
          todayTasks={todayTasks as any}
          miniTestResults={miniTestResults as any}
        />
      );

      // Click node card 1 to show detail banner
      const node1Card = await screen.findByTestId('sugoroku-node-u_1');
      fireEvent.click(node1Card);

      // Verify STEP 1 banner
      expect(screen.getByText('STEP 1')).toBeDefined();

      // Close banner
      const closeBtn = screen.getByRole('button', { name: '✕' });
      fireEvent.click(closeBtn);
      expect(screen.queryByText('STEP 1')).toBeNull();

      // Click node card 2 (active test node)
      const node2Card = screen.getByTestId('sugoroku-node-u_2');
      fireEvent.click(node2Card);
      expect(screen.getByText('STEP 2')).toBeDefined();

      // Rerender with empty subject and empty availableSubjects to trigger line 40 fallback to '数学'
      // and test non-math subjects (理科, 社会, etc.) to trigger default styles in lines 342, 362
      rerender(
        <SugorokuMap
          student={student as any}
          subject=""
          availableSubjects={[]}
          units={[
            { id: 'u_sci_1', name: '植物のつくり', subject: '理科', sequence_order: 1 },
            { id: 'u_sci_2', name: '光と音', subject: '理科', sequence_order: 2 }
          ] as any}
          todayTasks={[
            { id: 'tt_sci', student_id: 'st_sugo', subject: '理科', lesson_range: '植物のつくり 〜 不明な単元', scheduled_date: todayStr, period: 1, status: 'pending' }
          ] as any}
          miniTestResults={[
            { id: 'mt_sci', student_id: 'st_sugo', subject: '理科', unit_name: '光と音', test_content: '光と音 単元確認テスト', date: todayStr, passed: true, score: 100 }
          ] as any}
        />
      );

      // Switch to Science tab
      const sciTab = screen.getByRole('button', { name: /理科/i });
      fireEvent.click(sciTab);

      // Verify fallback subject rendering
      expect(screen.getByTestId('sugoroku-node-u_sci_1')).toBeDefined();
    });
  });

  // --- 3. CurriculumCsvImport.tsx ---
  describe('CurriculumCsvImport.tsx Branch Perfection', () => {
    it('covers clear all and delete legacy confirm dialog cancellations, and unit test csv export', async () => {
      const windowConfirmSpy = vi.spyOn(window, 'confirm');

      render(<CurriculumCsvImport />);

      // Switch to list tab
      const listTabBtn = screen.getByTestId('tab-curriculum-list');
      fireEvent.click(listTabBtn);

      // Click Clear All but cancel confirm
      windowConfirmSpy.mockReturnValueOnce(false);
      const clearAllBtn = screen.getByTestId('clear-all-masters-btn');
      fireEvent.click(clearAllBtn);
      expect(windowConfirmSpy).toHaveBeenCalled();

      // Click Delete Legacy Data but cancel confirm
      windowConfirmSpy.mockReturnValueOnce(false);
      const deleteLegacyBtn = screen.getByRole('button', { name: /旧フォーマット一括削除/i });
      fireEvent.click(deleteLegacyBtn);
      expect(windowConfirmSpy).toHaveBeenCalled();

      // Switch to unit_tests tab
      const unitTestsTabBtn = screen.getByTestId('tab-unit-tests');
      fireEvent.click(unitTestsTabBtn);

      // Click Export Unit Tests CSV
      const exportUnitTestBtn = screen.getByTestId('export-unit-test-csv-btn');
      fireEvent.click(exportUnitTestBtn);

      // Test download sample CSV
      const sampleUnitTestBtn = screen.getByTestId('download-unit-test-sample-btn');
      fireEvent.click(sampleUnitTestBtn);
    });

    it('covers empty lines, drag drop without files, import failure fallback, and subject filter mismatch', async () => {
      const { unmount } = render(<CurriculumCsvImport />);

      // 1. Trigger handleDrop with empty files (line 206) and non-csv file (line 208)
      const dropZone = screen.getByTestId('csv-dropzone');
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [] }
      });
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [new File(['foo'], 'image.png', { type: 'image/png' })] }
      });

      // 2. Trigger CSV parse with empty line (line 135) and type column with empty string (line 159)
      const fileInput = screen.getByTestId('csv-file-input');
      const csvContentWithEmptyLine = '学年,教科,単元名,授業名,区分,合格基準\n\n中1,数学,一次関数,一次関数のグラフ,,85%以上\n';
      const file = new File([csvContentWithEmptyLine], 'test.csv', { type: 'text/csv' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/1件のカリキュラムデータを読み込みました/i)).toBeDefined();
      });

      // 3. Trigger import failure with string rejection (line 311 fallback)
      const importBtn = screen.getByTestId('execute-import-btn');
      vi.spyOn(db, 'saveCurriculumMasters').mockRejectedValueOnce('インポートエラー文字列');
      fireEvent.click(importBtn);
      await waitFor(() => {
        expect(screen.getByText(/インポートに失敗しました: インポートエラー文字列/i)).toBeDefined();
      });

      // 5. Trigger delete legacy data failure with string rejection (line 358 fallback)
      vi.spyOn(window, 'confirm').mockReturnValueOnce(true);
      vi.spyOn(db, 'deleteCurriculumMastersByGrades').mockRejectedValueOnce('削除エラー文字列');
      const listTabBtn = screen.getByTestId('tab-curriculum-list');
      fireEvent.click(listTabBtn);
      const deleteLegacyBtn = screen.getByRole('button', { name: /旧フォーマット一括削除/i });
      fireEvent.click(deleteLegacyBtn);
      await waitFor(() => {
        expect(screen.getByText(/削除に失敗しました: 削除エラー文字列/i)).toBeDefined();
      });

      // 6. Test filter subject mismatch (line 418)
      const subjectSelect = screen.getByTestId('filter-subject-select');
      fireEvent.change(subjectSelect, { target: { value: '英語' } });

      unmount();
    });
  });
});
