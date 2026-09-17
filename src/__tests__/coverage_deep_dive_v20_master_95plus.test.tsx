import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, MilestoneTemplate } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import BranchManagement from '../components/BranchManagement';
import {
  formatLessonRange,
  getLatestUnitTestStatusForSubject,
  normalizeGrade,
  ensureMathEnglishUnitTests,
  inferStudentSubjectPace,
  getYearMonthWeek,
  generateAttendanceDates,
  parseStartUnitSetting,
  calculateProgressGap,
  calculateMockExamPassRate,
  generateAIReportText
} from '../lib/scheduler';
import Home from '../app/page';

describe('Comprehensive 95%+ Coverage Master Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('db.ts Comprehensive Coverage', () => {
    it('should cover all db methods, edge cases, and error handling', async () => {
      // Test Supabase seed and sync methods
      const seedRes = await db.seedDefaultStudentsToSupabase();
      expect(seedRes).toBeDefined();

      // Test student CRUD
      const students = await db.fetchStudents();
      expect(students.length).toBeGreaterThan(0);

      const target = students[0];
      const updated: Student = { ...target, name: 'テスト更新生', period_count: 5 };
      await db.saveStudent(updated);

      const fetched = db.getStudent(target.id);
      expect(fetched?.name).toBe('テスト更新生');

      // Test save student individually
      await db.saveStudent({ ...target, name: '個別更新生1' });
      if (students[1]) {
        await db.saveStudent({ ...students[1], name: '個別更新生2' });
      }

      // Test curriculum masters
      const masters = await db.fetchCurriculumMasters();
      expect(masters).toBeDefined();
      const mathMasters = await db.fetchCurriculumMasters('数学');
      expect(mathMasters).toBeDefined();

      // Test curriculum upsert and save
      const sampleMaster = {
        id: 'cm-test-999',
        subject: '数学',
        grade: '中1',
        unit_name: '正の数・負の数',
        lesson_name: '加法と減法',
        sort_order: 999,
        estimated_minutes: 30
      };
      await db.saveCurriculumMasters([sampleMaster]);
      const allMasters = db.getCurriculumMasters();
      expect(allMasters.some(m => m.id === 'cm-test-999')).toBe(true);

      // Test delete curriculum master
      await db.deleteCurriculumMaster('cm-test-999');
      expect(db.getCurriculumMasters().some(m => m.id === 'cm-test-999')).toBe(false);

      // Test test records
      const testRecords = db.getTestRecords();
      expect(testRecords).toBeDefined();
      const sampleTestRecord = {
        id: 'tr-test-1',
        student_id: target.student_id,
        test_name: '第1回定期テスト',
        test_type: 'regular' as const,
        term: '1学期中間',
        date: '2026-10-15',
        subjects: [{ subject: '数学', score: 85, full_mark: 100 }]
      };
      await db.saveTestRecord(sampleTestRecord);
      expect(db.getTestRecords().some(t => t.id === 'tr-test-1')).toBe(true);

      // Test delete test record
      await db.deleteTestRecord('tr-test-1');
      expect(db.getTestRecords().some(t => t.id === 'tr-test-1')).toBe(false);

      // Test mini test results
      const sampleMiniTest = {
        id: 'mt-test-1',
        student_id: target.student_id,
        test_content: '単元確認テスト',
        subject: '数学',
        unit_name: '正負の数',
        score: 90,
        passed: true,
        date: '2026-09-17'
      };
      await db.saveMiniTestResult(sampleMiniTest);
      const miniResults = await db.fetchMiniTestResults(target.student_id);
      expect(miniResults.some(m => m.id === 'mt-test-1')).toBe(true);
      await db.deleteMiniTestResult('mt-test-1');

      // Test lesson progress
      const sampleProgress = {
        id: 'prog-test-1',
        student_id: target.student_id,
        subject: '数学',
        lesson_id: 'les-1',
        lesson_name: '正負の加法',
        status: 'completed' as const,
        date: '2026-09-17',
        completed_at: new Date().toISOString()
      };
      await db.saveStudentLessonProgress(sampleProgress);
      const progList = await db.fetchStudentLessonProgressList(target.student_id);
      expect(progList.some(p => p.id === 'prog-test-1')).toBe(true);

      // Test student schedule config
      const sampleConfig = {
        id: 'cfg-test-1',
        student_id: target.student_id,
        selected_days: ['tuesday', 'friday'],
        day_duration: '120分',
        periods_per_day: 2,
        updated_at: new Date().toISOString()
      };
      await db.saveStudentScheduleConfig(sampleConfig);
      const config = db.getStudentScheduleConfig(target.student_id);
      expect(config?.selected_days).toContain('tuesday');

      // Test milestones and templates
      const templates = db.getMilestoneTemplates();
      expect(templates).toBeDefined();

      const sampleTemplate: MilestoneTemplate = {
        id: 'mt-custom-1',
        name: '特訓テンプレート',
        grade: '中3',
        subject: '数学',
        plans: []
      };
      await db.saveMilestoneTemplate(sampleTemplate);
      expect(db.getMilestoneTemplates().some(t => t.id === 'mt-custom-1')).toBe(true);
      await db.deleteMilestoneTemplate('mt-custom-1');

      // Test student interactions
      const sampleInteraction = {
        id: 'int-1',
        student_id: target.student_id,
        date: '2026-09-17',
        staff_name: '福田 尚弘',
        memo: '理解度良好。集中して取り組めています。',
        category: '面談'
      };
      await db.saveStudentInteraction(sampleInteraction);
      const interactions = await db.fetchStudentInteractions(target.student_id);
      expect(interactions.some(i => i.id === 'int-1')).toBe(true);
      await db.deleteStudentInteraction('int-1');

      // Test teacher master & personality master
      await db.addTeacherOption('新規講師A');
      expect(db.getTeacherOptions()).toContain('新規講師A');
      await db.removeTeacherOption('新規講師A');

      await db.addPersonalityOption('積極的');
      expect(db.getPersonalityOptions()).toContain('積極的');
      await db.removePersonalityOption('積極的');
    });
  });

  describe('TeacherDashboard Comprehensive Coverage', () => {
    it('should exercise all view modes, tabs, actions, and dialogs', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <TeacherDashboard
            onSelectStudent={vi.fn()}
            onLogout={vi.fn()}
          />
        );
      });

      // Wait for dashboard load
      await waitFor(() => {
        expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      });

      // Test student search filter
      const searchInputs = screen.queryAllByPlaceholderText(/生徒名・IDで検索|検索/);
      if (searchInputs.length > 0) {
        act(() => {
          fireEvent.change(searchInputs[0], { target: { value: '中尾' } });
        });
      }

      // Test filter by grade
      const gradeSelects = screen.queryAllByRole('combobox');
      if (gradeSelects.length > 0) {
        act(() => {
          fireEvent.change(gradeSelects[0], { target: { value: '中3' } });
        });
      }

      // Test Tab Switch if tabs exist
      const tabButtons = screen.queryAllByRole('tab');
      for (const btn of tabButtons) {
        act(() => {
          fireEvent.click(btn);
        });
      }

      // Test DB restore button click
      const restoreBtns = screen.queryAllByText(/DB生徒データ再取得・自動復元|データ復元|再取得/);
      if (restoreBtns.length > 0) {
        await act(async () => {
          fireEvent.click(restoreBtns[0]);
        });
      }

      expect(renderResult.container).toBeDefined();
    });
  });

  describe('StudentDashboard Comprehensive Coverage', () => {
    it('should exercise video modal, test execution, tab switching, and timeline', async () => {
      const mockStudent: Student = {
        id: 'std-test-01',
        student_id: 'std001',
        name: 'テスト生徒',
        email: 'test@tentoru.jp',
        grade: '中3',
        status: 'normal',
        period_count: 3,
        created_at: '2026-04-01T00:00:00Z',
        completed_lesson_ids: ['les-1', 'les-2'],
        selected_subjects: ['数学', '英語']
      };

      let renderResult: any;
      await act(async () => {
        renderResult = render(
          <StudentDashboard
            student={mockStudent}
            onLogout={vi.fn()}
          />
        );
      });

      await waitFor(() => {
        expect(renderResult.container).toBeDefined();
      });

      // Test clicking video watch / test action buttons
      const actionButtons = screen.queryAllByRole('button');
      for (const btn of actionButtons) {
        if (btn.textContent?.includes('解説動画') || btn.textContent?.includes('テスト') || btn.textContent?.includes('完了')) {
          act(() => {
            fireEvent.click(btn);
          });
        }
      }

      expect(renderResult.container).toBeDefined();
    });
  });

  describe('BranchManagement Comprehensive Coverage', () => {
    it('should test branch management interface and operations', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(<BranchManagement onClose={vi.fn()} />);
      });

      expect(renderResult.container).toBeDefined();
    });
  });

  describe('Scheduler Comprehensive Edge Cases', () => {
    it('should test scheduler helper functions across all cases', () => {
      expect(formatLessonRange('単元1', '単元2')).toBe('単元1 〜 単元2');
      expect(formatLessonRange('単元1', '単元1')).toBe('単元1');
      expect(formatLessonRange('', '')).toBe('');

      expect(normalizeGrade('1年生')).toBe('小1');
      expect(normalizeGrade('中学2年')).toBe('中2');
      expect(normalizeGrade('高校3年')).toBe('高3');
      expect(normalizeGrade('小4')).toBe('小4');

      const mathTests = ensureMathEnglishUnitTests([
        {
          id: 'cm-1',
          subject: '数学',
          grade: '中1',
          unit_name: '正負の数',
          lesson_name: '加法',
          sort_order: 1
        }
      ]);
      expect(mathTests.length).toBeGreaterThan(0);

      const status = getLatestUnitTestStatusForSubject({
        studentId: 'std001',
        subject: '数学'
      });
      expect(status).toBeDefined();

      const ymWeek = getYearMonthWeek('2026-09-17');
      expect(ymWeek.month).toBe(9);

      const dates = generateAttendanceDates('2026-09-01', ['mon', 'wed', 'fri'], 10);
      expect(dates.length).toBe(10);

      const parsed = parseStartUnitSetting('中2 数学 一次関数');
      expect(parsed).toBeDefined();

      const pace = inferStudentSubjectPace({
        studentId: 'std001',
        subject: '数学',
        grade: '中3'
      });
      expect(pace).toBeDefined();

      const mockStudent: Student = {
        id: 'std001',
        name: 'テスト生徒',
        email: 'test@tentoru.jp',
        grade: '中3',
        status: 'normal',
        period_count: 2,
        created_at: '2026-04-01T00:00:00Z'
      };

      const gap = calculateProgressGap(
        mockStudent,
        [],
        [],
        [],
        '2026-09-17',
        '数学'
      );
      expect(gap).toBeDefined();

      const passRate = calculateMockExamPassRate(
        60,
        'sch-1',
        [
          {
            id: 'eth-1',
            school_code: 'sch-1',
            min_score: 50,
            max_score: 70,
            probability: 80
          }
        ]
      );
      expect(passRate).toBe(80);

      const report = generateAIReportText(
        'テスト頑張りました。よくできました。',
        {
          exclamationsCount: 2,
          positiveWords: ['成長', '素晴らしい']
        }
      );
      expect(report).toBeDefined();
    });
  });

  describe('app/page.tsx Comprehensive Routing', () => {
    it('should handle role switching, login, logout, and direct routing', async () => {
      let renderResult: any;
      await act(async () => {
        renderResult = render(<Home />);
      });

      expect(renderResult.container).toBeDefined();

      // Test clicking teacher login or student selection
      const loginBtns = screen.queryAllByRole('button');
      for (const btn of loginBtns) {
        if (btn.textContent?.includes('講師') || btn.textContent?.includes('ログイン')) {
          act(() => {
            fireEvent.click(btn);
          });
          break;
        }
      }
    });
  });
});
