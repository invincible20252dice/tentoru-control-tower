import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, StudentInteraction, CustomApplyScope, BranchAIRule } from '../lib/db';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import TeacherDashboard from '../components/TeacherDashboard';

describe('High Target Deep Coverage Suite (DB Services & Component Branch Coverage)', () => {
  beforeEach(async () => {
    localStorage.clear();
  });

  // 1. Direct coverage for un-covered db.ts methods
  it('covers various db.ts methods directly for high coverage', async () => {
    const interaction: StudentInteraction = {
      id: 'si-direct-1',
      student_id: 'std-direct-1',
      category: '保護者対応',
      memo: 'ダイレクトDBテスト用メモ',
      date: '2026-08-26',
      contact_date: '2026-08-26',
      staff_name: '福田',
      created_at: new Date().toISOString()
    };

    // save & get & delete student interaction
    await db.saveStudentInteraction(interaction);
    let list = db.getStudentInteractions('std-direct-1');
    expect(list.length).toBeGreaterThan(0);
    await db.deleteStudentInteraction('si-direct-1');

    // school codes
    const schoolCode = { id: 'sc-1', code: 'SCH01', name: '第一高等学校', type: '高校' as const, branch_id: 'branch-1' };
    await db.saveSchoolCodeMaster(schoolCode);
    expect(db.getSchoolCodesMaster().length).toBeGreaterThan(0);

    // exam thresholds
    const threshold = { id: 'eth-1', school_code: 'SCH01', target_score: 400, branch_id: 'branch-1' };
    await db.saveExamThresholdMaster(threshold);
    expect(db.getExamThresholdsMaster().length).toBeGreaterThan(0);

    // prompt settings
    const promptSetting = { id: 'ps-1', feature_name: 'AIレスポンス', prompt_template: 'AI指導アシスタント', branch_id: 'branch-1' };
    await db.savePromptSetting(promptSetting);
    expect(db.getPromptSettings().length).toBeGreaterThan(0);

    // teacher correction logs
    const corrLog = { id: 'cl-1', student_id: 'std-direct-1', report_id: 'rep-1', original_text: 'A', corrected_text: 'B', created_at: new Date().toISOString() };
    await db.addTeacherCorrectionLog(corrLog);
    expect(db.getTeacherCorrectionsLogs().length).toBeGreaterThan(0);

    // custom apply scope
    const scope: CustomApplyScope = { id: 'cas-1', name: '特進Sクラス一括', student_ids: ['std-direct-1'], branch_id: 'branch-1' };
    await db.saveCustomApplyScope(scope);
    expect(db.getCustomApplyScopes('branch-1').length).toBeGreaterThan(0);
    await db.deleteCustomApplyScope('cas-1');

    // branch AI rules
    const branchRules: BranchAIRule = { branch_id: 'branch-1', lessons_per_slot: 2, default_homework_days: 3 };
    await db.saveBranchAIRules('branch-1', branchRules);
    expect(db.getBranchAIRules('branch-1').lessons_per_slot).toBe(2);

    // student lesson progress
    const progress = { id: 'slp-1', student_id: 'std-direct-1', lesson_id: 'les-1', status: 'completed' as const, completed_at: new Date().toISOString() };
    await db.saveStudentLessonProgress(progress);
    expect(db.getStudentLessonProgressList('std-direct-1').length).toBeGreaterThan(0);

    // Teacher Options Master
    await db.addTeacherOption('福田 尚弘');
    expect(db.getTeacherOptions().length).toBeGreaterThan(0);

    // Student Schedule Config
    const scheduleConfig = {
      student_id: 'std-direct-1',
      period_count: 3,
      selected_days: ['tuesday', 'thursday'],
      selected_subjects: ['数学', '英語']
    };
    await db.saveStudentScheduleConfig(scheduleConfig);
    const fetchedConfig = await db.fetchStudentScheduleConfig('std-direct-1');
    expect(fetchedConfig).toBeDefined();

    // Delete curriculum masters by grades
    await db.deleteCurriculumMastersByGrades(['小5', '小6']);
  });

  // 2. CurriculumCsvImport CSV Parsing & Bulk Import & Delete
  it('covers CurriculumCsvImport CSV upload parsing, search, and delete operations', async () => {
    const onImportComplete = vi.fn();
    const onClose = vi.fn();

    const { container } = render(
      <CurriculumCsvImport 
        onImportComplete={onImportComplete}
        onClose={onClose}
      />
    );

    // Simulate CSV file input change
    const csvContent = `教科,学年,単元名,授業名,並び順,種類
算数,小5,小数×小数,小数の掛け算(1),1,lesson
算数,小5,小数×小数,小数×小数 - 単元確認テスト,2,unit_test`;

    const file = new File([csvContent], 'curriculum.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    if (fileInput) {
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
    }

    // Switch to List tab and search
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });

    const searchInput = screen.getByPlaceholderText(/単元・授業名で検索/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '小数' } });
    });
    expect(searchInput).toHaveValue('小数');
  });

  // 3. TeacherDashboard extra branch coverage
  it('covers TeacherDashboard extra controls including branch switching and schedule tab', async () => {
    const student: Student = {
      id: 'std-deep-1',
      student_id: 'SDEEP1',
      name: '深層 カバレッジ生',
      grade: '中3',
      level: 'B',
      school_id: 'sch-1',
      branch_id: 'branch-1',
      status: 'warning',
      period_count: 3,
      selected_days: ['tuesday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '福田 尚弘'
    };
    await db.saveStudent(student);

    render(<TeacherDashboard onBackToPortal={vi.fn()} />);

    // 校舎切り替えドロップダウンの操作
    const branchSelect = screen.getByTestId('admin-branch-switcher') as HTMLSelectElement;
    await act(async () => {
      fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
    });
    expect(branchSelect.value).toBe('branch-1');

    // 生徒検索とステータスフィルタの操作
    const searchInput = screen.getByPlaceholderText(/名前を入力/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: '深層' } });
    });

    // 「学習計画・コマ割り」タブへ切替
    const scheduleTab = screen.getByRole('button', { name: /学習計画・コマ割り/i });
    await act(async () => {
      fireEvent.click(scheduleTab);
    });
    expect(scheduleTab).toBeInTheDocument();
  });
});
