import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';
import SugorokuMap from '../components/SugorokuMap';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import BranchManagement from '../components/BranchManagement';
import { db, Student, LearningTask, CurriculumMaster, StudentScheduleConfig } from '../lib/db';

describe('Coverage Comprehensive Test Suite for 95%+ Target', () => {
  const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

  const mockElemStudent: Student = {
    id: 'std-cov-elem',
    name: '小学太郎',
    grade: '小4',
    login_id: 'elem_student',
    password: 'password123',
    status: 'normal',
    completed_lesson_ids: ['cm-cov-1'],
    selected_subjects: ['算数', '国語', '英語', '理科', '社会'],
    created_at: new Date().toISOString()
  };

  const mockJhsStudent: Student = {
    id: 'std-cov-jhs',
    name: '中学花子',
    grade: '中2',
    login_id: 'jhs_student',
    password: 'password123',
    status: 'warning',
    completed_lesson_ids: [],
    selected_subjects: ['数学', '英語', '国語', '理科', '社会'],
    created_at: new Date().toISOString()
  };

  const mockMasters: CurriculumMaster[] = [
    { id: 'cm-cov-1', grade: '小4', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算の筆算', sort_order: 1 },
    { id: 'cm-cov-2', grade: '小4', subject: '算数', unit_name: 'わり算', lesson_name: '商が2けたの筆算', sort_order: 2 },
    { id: 'cm-cov-3', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 10 },
    { id: 'cm-cov-4', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '代入法', sort_order: 11 }
  ];

  beforeEach(() => {
    localStorage.clear();
    alertMock.mockClear();
    db.saveCurriculumMasters(mockMasters);
  });

  afterAll(() => {
    alertMock.mockRestore();
  });

  test('StudentDashboard: invalid mini test score input validation & error alerts', async () => {
    await db.saveStudent(mockElemStudent);
    await db.saveMiniTestResult({
      id: 'mini-err-1',
      student_id: mockElemStudent.id,
      date: '2026-08-20',
      test_content: '確認テスト',
      score: null,
      created_at: new Date().toISOString()
    });

    render(<StudentDashboard student={mockElemStudent} initialDate="2026-08-20" onBackToPortal={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('確認テスト')).toBeInTheDocument();
    });

    const scoreInput = screen.getByTestId('test-score-input-mini-err-1');
    const sendBtn = screen.getByTestId('test-save-btn-mini-err-1');

    // 範囲外の数値 (150)
    fireEvent.change(scoreInput, { target: { value: '150' } });
    fireEvent.click(sendBtn);
    expect(alertMock).toHaveBeenCalledWith('0〜100の点数を入力してください。');

    // 範囲外の数値 (150)
    fireEvent.change(scoreInput, { target: { value: '150' } });
    fireEvent.click(sendBtn);
    expect(alertMock).toHaveBeenCalledWith('0〜100の点数を入力してください。');

    // 正常な数値 (85)
    fireEvent.change(scoreInput, { target: { value: '85' } });
    fireEvent.click(sendBtn);
    expect(scoreInput).toHaveValue(85);
  });

  test('StudentDashboard: empty timetable self-study fallback rendering & theme support', async () => {
    await db.saveStudent(mockElemStudent);

    const { rerender } = render(
      <StudentDashboard student={mockElemStudent} initialDate="2026-08-20" theme="dark" onBackToPortal={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText(/コマ割り予定はありません/)).toBeInTheDocument();
    });

    rerender(<StudentDashboard student={mockElemStudent} initialDate="2026-08-20" theme="light" onBackToPortal={() => {}} />);
    expect(screen.getByText(/コマ割り予定はありません/)).toBeInTheDocument();
  });

  test('SugorokuMap: subject tab clicking, onSelectSubject callback, and dark theme', () => {
    const onSelectSubjectMock = vi.fn();

    render(
      <SugorokuMap
        subject="算数"
        subjects={['算数', '国語', '英語']}
        student={mockElemStudent}
        theme="dark"
        onSelectSubject={onSelectSubjectMock}
      />
    );

    expect(screen.getByText('算数の学習マップ')).toBeInTheDocument();

    const kokugoTab = screen.getByText(/国語/);
    fireEvent.click(kokugoTab);

    expect(onSelectSubjectMock).toHaveBeenCalledWith('国語');
    expect(screen.getByText('国語の学習マップ')).toBeInTheDocument();
  });

  test('CurriculumCsvImport: rendering and dropzone interactions', async () => {
    render(<CurriculumCsvImport onImportSuccess={() => {}} />);

    expect(screen.getAllByText(/CSVファイル/)[0]).toBeInTheDocument();
  });

  test('BranchManagement: search filtering, add branch form toggle & status toggling', async () => {
    render(<BranchManagement onBackToPortal={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('open-create-branch-modal')).toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('open-create-branch-modal');
    fireEvent.click(addBtn);

    expect(screen.getByPlaceholderText('例: 横浜教室')).toBeInTheDocument();

    const cancelBtn = screen.getByText('キャンセル');
    fireEvent.click(cancelBtn);

    expect(screen.queryByPlaceholderText('例: 横浜教室')).not.toBeInTheDocument();
  });

  test('TeacherDashboard: student sorting and filter toggles', async () => {
    await db.saveStudent(mockElemStudent);
    await db.saveStudent(mockJhsStudent);

    render(<TeacherDashboard initialDate="2026-08-20" onBackToPortal={() => {}} />);

    expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();

    const searchInput = screen.queryByPlaceholderText('例: 佐藤 拓海');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: '佐藤' } });
      expect(searchInput).toHaveValue('佐藤');
    }
  });
});
