import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, CurriculumMaster, MiniTestResult } from '../lib/db';

describe('Unit Test Master Management & Auto Scheduling Integration', () => {
  beforeEach(() => {
    db.clearMockData();
  });

  test('CurriculumCsvImport parses item_type and unit_test rows correctly', async () => {
    const onImportCompletedMock = vi.fn();
    const { getByTestId } = render(<CurriculumCsvImport onImportCompleted={onImportCompletedMock} />);

    const csvInput = getByTestId('csv-file-input');
    const csvData = `学年,教科,単元名,授業名,区分
小5,算数,1章 整数と小数,小数と10倍・100倍,授業
小5,算数,1章 整数と小数,1章 整数と小数 単元確認テスト,単元テスト`;

    const file = new File([csvData], 'unit_test_curriculum.csv', { type: 'text/csv' });
    fireEvent.change(csvInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/2件のカリキュラムデータを読み込みました/)).toBeInTheDocument();
    });

    const importBtn = getByTestId('execute-import-btn');
    fireEvent.click(importBtn);

    await waitFor(() => {
      expect(onImportCompletedMock).toHaveBeenCalled();
    });

    const masters = db.getCurriculumMasters();
    expect(masters.length).toBeGreaterThan(0);
    const unitTestItem = masters.find(m => m.lesson_name.includes('単元確認テスト'));
    expect(unitTestItem).toBeDefined();
    expect(unitTestItem?.item_type).toBe('unit_test');
  });

  test('generateSlotsForSelectedSubjects & auto-scheduling support unit_test master', async () => {
    const mockStudent: Student = {
      id: 'std-ut-1',
      name: '単元テスト生徒',
      grade: '中2',
      branch_id: 'branch-1',
      login_id: 'std_ut',
      password: 'pass',
      status: 'normal',
      selected_subjects: ['数学'],
      created_at: new Date().toISOString()
    };

    const mockMasters: CurriculumMaster[] = [
      { id: 'cm-ut-1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 1, item_type: 'lesson', created_at: '' },
      { id: 'cm-ut-2', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '連立方程式 単元確認テスト', sort_order: 2, item_type: 'unit_test', created_at: '' }
    ];

    await db.saveStudent(mockStudent);
    await db.saveCurriculumMasters(mockMasters);

    const { generateSlotsForSelectedSubjects } = await import('../lib/scheduler');

    const slots = generateSlotsForSelectedSubjects({
      student: mockStudent,
      periodCount: 3,
      selectedSubjects: ['数学'],
      tasks: [],
      branchRules: undefined,
      curriculumMasters: mockMasters,
      curriculumUnits: [],
      schoolId: 'school-1',
      lessonProgressList: []
    });

    expect(slots[1]).toBeDefined();
    expect(slots[1]?.subject).toBe('数学');
  });

  test('StudentDashboard renders subject badge and unit_test badge in today test card', async () => {
    const mockStudent: Student = {
      id: 'std-ut-card',
      name: 'カード表示生徒',
      grade: '中2',
      login_id: 'std_card',
      password: 'pass',
      status: 'normal',
      created_at: new Date().toISOString()
    };

    const mockMiniTest: MiniTestResult = {
      id: 'mini-ut-1',
      student_id: 'std-ut-card',
      date: '2026-08-21',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '連立方程式',
      test_content: '連立方程式 単元確認テスト',
      score: null,
      passing_line: '80%以上',
      created_at: new Date().toISOString()
    };

    await db.saveStudent(mockStudent);
    await db.saveMiniTestResult(mockMiniTest);

    render(
      <StudentDashboard student={mockStudent} initialDate="2026-08-21" onBackToPortal={vi.fn()} />
    );

    await waitFor(() => {
      const card = screen.getByTestId('today-test-card');
      expect(card).toBeInTheDocument();
      expect(card.textContent).toContain('数学');
      expect(card.textContent).toContain('単元テスト');
      expect(card.textContent).toContain('連立方程式 単元確認テスト');
    });
  });

  test('CurriculumCsvImport unit_tests tab renders and supports deleting unit tests', async () => {
    const mockMasters: CurriculumMaster[] = [
      { id: 'cm-ut-export-1', grade: '小5', subject: '算数', unit_name: '整数と小数', lesson_name: '整数と小数 確認テスト', item_type: 'unit_test', sort_order: 1 }
    ];
    await db.saveCurriculumMasters(mockMasters);

    render(<CurriculumCsvImport />);

    const unitTestsTabBtn = screen.getByTestId('tab-unit-tests');
    fireEvent.click(unitTestsTabBtn);

    await waitFor(() => {
      expect(screen.getByText(/単元テスト マスタ管理/)).toBeInTheDocument();
      expect(screen.getByText(/整数と小数 確認テスト/)).toBeInTheDocument();
    });

    // Verify CSV export buttons are present
    expect(screen.getByTestId('export-unit-test-csv-btn')).toBeInTheDocument();
    expect(screen.getByTestId('download-unit-test-sample-btn')).toBeInTheDocument();
  });

  test('Adding a unit test master synchronizes with CurriculumMasters list', async () => {
    const newMaster: CurriculumMaster = {
      id: 'cm-ut-sync-1',
      grade: '中1',
      subject: '英語',
      unit_name: 'Be動詞',
      lesson_name: 'Be動詞 単元確認テスト',
      item_type: 'unit_test',
      passing_line: '80点以上',
      sort_order: 10
    };

    await db.saveCurriculumMasters([newMaster]);

    const masters = db.getCurriculumMasters('英語');
    const target = masters.find(m => m.id === 'cm-ut-sync-1');
    expect(target).toBeDefined();
    expect(target?.lesson_name).toBe('Be動詞 単元確認テスト');
    expect(target?.passing_line).toBe('80点以上');
  });

  test('TeacherDashboard unit test modal opens, populates fields, and saves with auto sort_order', async () => {
    window.alert = vi.fn();
    const mockStudent: Student = {
      id: 'std-modal-test',
      name: 'モーダル検証生徒',
      grade: '小5',
      branch_id: 'branch-1',
      login_id: 'std_modal',
      password: 'pass',
      status: 'normal',
      selected_subjects: ['算数'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(mockStudent);

    const mockMasters: CurriculumMaster[] = [
      { id: 'cm-m1', grade: '小5', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざんのきほん', sort_order: 1, item_type: 'lesson' }
    ];
    await db.saveCurriculumMasters(mockMasters);

    const { getByTestId, findByTestId } = render(<TeacherDashboard />);

    await waitFor(() => {
      const el = screen.queryAllByText(/モーダル検証生徒/);
      expect(el.length).toBeGreaterThan(0);
    });

    const studentItem = screen.getAllByText(/モーダル検証生徒/)[0];
    fireEvent.click(studentItem);

    // Switch to milestones tab
    const milestoneMenu = screen.getByText('年間計画（マイルストーン）');
    fireEvent.click(milestoneMenu);

    await waitFor(() => {
      expect(screen.getByTestId('timeline-add-unittest-btn')).toBeInTheDocument();
    });

    const addBtn = getByTestId('timeline-add-unittest-btn');
    fireEvent.click(addBtn);

    const modal = await findByTestId('unit-test-master-modal');
    expect(modal).toBeInTheDocument();

    const saveBtn = getByTestId('save-unittest-master-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const updated = db.getCurriculumMasters('算数');
      expect(updated.length).toBeGreaterThan(1);
    });
  });
});
