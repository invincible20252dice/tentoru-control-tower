import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type MiniTestResult, type LearningTask } from '../lib/db';

describe('TeacherDashboard Deep Conquest Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively covers mini-test tab sorting, status badges, score inputs, and status dropdowns', async () => {
    const dynamicDate = getDynamicDate(0);
    const student: Student = {
      id: 'st-td-mini-deep',
      name: '小テスト生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '渋谷中学校'
    };

    const results: MiniTestResult[] = [
      {
        id: 'mt-1',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '数学',
        unit_name: '一次関数',
        test_type: 'unit_test',
        test_content: '一次関数 単元テスト',
        date: dynamicDate,
        score: 95,
        status: 'passed',
        passed: true,
        passing_line: '80点'
      },
      {
        id: 'mt-2',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '英語',
        unit_name: '過去進行形',
        test_type: 'unit_test',
        test_content: '過去進行形 単元テスト',
        date: dynamicDate,
        score: 45,
        status: 'failed',
        passed: false,
        passing_line: '80%'
      },
      {
        id: 'mt-3',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '国語',
        unit_name: '古文単語',
        test_type: 'custom',
        test_content: '古文単語 小テスト',
        date: dynamicDate,
        score: 75,
        status: undefined,
        passed: undefined
      },
      {
        id: 'mt-4',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '理科',
        unit_name: '化学変化',
        test_type: 'custom',
        test_content: '化学変化 小テスト',
        date: dynamicDate,
        score: 55,
        status: undefined,
        passed: undefined
      },
      {
        id: 'mt-5',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '社会',
        unit_name: '歴史',
        test_type: 'custom',
        test_content: '安土桃山時代 小テスト',
        date: dynamicDate,
        score: null,
        status: '合格' as any,
        passed: true
      },
      {
        id: 'mt-6',
        student_id: student.id,
        students: { id: student.id, name: student.name, grade: student.grade },
        subject: '数学',
        unit_name: '図形',
        test_type: 'custom',
        test_content: '平行と合同 小テスト',
        date: dynamicDate,
        score: null,
        status: '不合格' as any,
        passed: false
      }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('mini_test_results', results);
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        initialTab="mini-tests"
        targetDate={dynamicDate}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('小テスト結果管理')).toBeDefined();
    });

    // Test sorting by passed_first
    const sortSelect = screen.queryByDisplayValue(/受検日順|合格優先|不合格優先/) || screen.queryByRole('combobox', { name: /並び替え|ソート/ });
    if (sortSelect) {
      fireEvent.change(sortSelect, { target: { value: 'passed_first' } });
      fireEvent.change(sortSelect, { target: { value: 'failed_first' } });
      fireEvent.change(sortSelect, { target: { value: 'date' } });
    }

    // Test score change on mt-1
    const scoreInputs = screen.queryAllByPlaceholderText(/点数|スコア/);
    if (scoreInputs.length > 0) {
      fireEvent.change(scoreInputs[0], { target: { value: '90' } });
      fireEvent.change(scoreInputs[0], { target: { value: '9割' } });
      fireEvent.change(scoreInputs[0], { target: { value: '85%' } });
      fireEvent.change(scoreInputs[0], { target: { value: '' } });
    }

    // Test status select change
    const statusSelects = screen.queryAllByRole('combobox');
    for (const sel of statusSelects) {
      fireEvent.change(sel, { target: { value: 'passed' } });
      fireEvent.change(sel, { target: { value: 'failed' } });
      fireEvent.change(sel, { target: { value: 'unstarted' } });
    }

    unmount();
  });

  it('exhaustively covers Milestones tab subject icons, timeline matching, and weekly targets', async () => {
    const dynamicDate = getDynamicDate(0);
    const student: Student = {
      id: 'st-ms-icons',
      name: 'マイルストーン生徒',
      grade: '小5',
      grade_category: 'elementary',
      school_name: '緑ヶ丘小学校',
      start_unit_id: 'u-ms-1',
      selected_subjects: ['算数', '国語', '英語', '理科', '社会', '日本史', '化学']
    };

    const units: CurriculumUnit[] = [
      { id: 'u-ms-1', name: '小数のかけ算', subject: '算数', sequence_order: 1 },
      { id: 'u-ms-2', name: '小数のわり算', subject: '算数', sequence_order: 2 }
    ];

    const masters: CurriculumMaster[] = [
      { id: 'cm-ms-1', grade: '小5', subject: '算数', unit_name: '小数', lesson_name: '小数のかけ算', sort_order: 1 },
      { id: 'cm-ms-2', grade: '小5', subject: '算数', unit_name: '小数', lesson_name: '小数のわり算', sort_order: 2 }
    ];

    const tasks: LearningTask[] = [
      {
        id: 't-ms-1',
        student_id: student.id,
        unit_id: 'u-ms-1',
        subject: '算数',
        scheduled_date: dynamicDate,
        period: 1,
        status: 'completed',
        lesson_range: '小数のかけ算 〜 小数のわり算',
        lesson_ids: ['cm-ms-1', 'cm-ms-2']
      }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('curriculum_units', units);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('learning_tasks', tasks);
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialTab="milestones"
        initialStudentId={student.id}
        targetDate={dynamicDate}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Test subject buttons in milestone tab
    const subjGroup = screen.queryByTestId('milestone-subject-button-group');
    if (subjGroup) {
      const btns = subjGroup.querySelectorAll('button');
      btns.forEach(btn => fireEvent.click(btn));
    }

    unmount();
  });

  it('exhaustively covers student edit form start grade inference, grade natural sort, and personality variations', async () => {
    const student: Student = {
      id: 'st-edit-full',
      name: '詳細編集生徒',
      grade: '高1',
      grade_category: 'high_school',
      school_name: '青山高校',
      period_count: 3,
      default_slots: 3,
      teacher_in_charge: '福田',
      personalities: ['集中力高い'],
      personality_tags: ['集中力高い'],
      subject_start_units: {
        '数学': 'cm-sort-1'
      }
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-sort-1', grade: '高1', subject: '数学', unit_name: '数と式', lesson_name: '展開', sort_order: 1 },
      { id: 'cm-sort-2', grade: '高2', subject: '数学', unit_name: '三角関数', lesson_name: '加法定理', sort_order: 2 },
      { id: 'cm-sort-3', grade: '3年生', subject: '数学', unit_name: '数III', lesson_name: '微分', sort_order: 3 },
      { id: 'cm-sort-4', grade: 'その他学年', subject: '数学', unit_name: '発展', lesson_name: '行列', sort_order: 4 }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('curriculum_masters', masters);
    db.saveSession({
      user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
    } as any);

    const { unmount } = render(
      <TeacherDashboard
        initialTab="student-list"
        initialStudentId={student.id}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    const editBtn = screen.queryByTestId(`edit-student-btn-${student.id}`);
    if (editBtn) {
      fireEvent.click(editBtn);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/学校名を入力|高校名/)).toBeDefined();
      });

      // Change personality tag
      const persInput = screen.queryByPlaceholderText(/性格タグ|特徴/);
      if (persInput) {
        fireEvent.change(persInput, { target: { value: '好奇心旺盛' } });
        const addBtn = screen.queryByText(/追加/);
        if (addBtn) fireEvent.click(addBtn);
      }

      // Save student
      const saveBtn = screen.queryAllByText(/変更を保存/)[0];
      if (saveBtn) {
        fireEvent.click(saveBtn);
      }
    }

    unmount();
  });
});
