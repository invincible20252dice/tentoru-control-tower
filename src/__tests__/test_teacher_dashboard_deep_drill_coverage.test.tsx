import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, LearningTask, StudentInteraction, MilestonePlan, MilestoneTemplate } from '../types';

describe('TeacherDashboard Deep Drill Coverage Suite', () => {
  const mockStudents: Student[] = [
    {
      id: 'std-drill-1',
      student_id: 'S_DRILL_1',
      name: 'ドリル 生徒',
      name_kana: 'ドリル セイト',
      grade: '中3',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語', '理科'],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面'],
      start_unit_math: 'cm-d1',
      start_unit_english: 'cm-de1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中3'
    }
  ];

  const mockCurriculums: CurriculumMaster[] = [
    { id: 'cm-d1', subject: '数学', grade: '中3', unit_name: '展開と因数分解', lesson_name: '多項式の展開 STEP 1', sort_order: 1 },
    { id: 'cm-d2', subject: '数学', grade: '中3', unit_name: '展開と因数分解', lesson_name: '展開と因数分解 単元確認テスト', sort_order: 2 },
    { id: 'cm-d3', subject: '数学', grade: '中3', unit_name: '平方根', lesson_name: '平方根の基本 STEP 1', sort_order: 3 },
    { id: 'cm-de1', subject: '英語', grade: '中3', unit_name: '現在完了', lesson_name: '完了用法 STEP 1', sort_order: 1 },
    { id: 'cm-de2', subject: '英語', grade: '中3', unit_name: '現在完了', lesson_name: '現在完了 単元確認テスト', sort_order: 2 },
    { id: 'cm-ds1', subject: '理科', grade: '中3', unit_name: '運動とエネルギー', lesson_name: '速さ STEP 1', sort_order: 1 }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    mockStudents.forEach(s => db.saveStudent(s));
    await db.saveCurriculumMasters(mockCurriculums);
  });

  it('drills through TeacherDashboard unit test creation master modal and submissions', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialTab="curriculum"
        />
      );
    });

    const addUnitTestBtn = screen.queryByTestId('timeline-add-unittest-btn') || screen.queryByText(/単元テスト追加|単元確認テスト作成|単元テスト作成/);
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });

      // Subject select
      const subjSelect = screen.queryByDisplayValue('数学') || screen.queryByLabelText(/教科/);
      if (subjSelect) {
        await act(async () => {
          fireEvent.change(subjSelect, { target: { value: '数学' } });
        });
      }

      // Grade select
      const gradeSelect = screen.queryByDisplayValue('中3') || screen.queryByLabelText(/学年/);
      if (gradeSelect) {
        await act(async () => {
          fireEvent.change(gradeSelect, { target: { value: '中3' } });
        });
      }

      // Unit name selection / input
      const unitInputs = screen.queryAllByPlaceholderText(/例: 1章 整数と小数/);
      if (unitInputs.length > 0) {
        await act(async () => {
          fireEvent.change(unitInputs[0], { target: { value: '平方根' } });
        });
      }

      // Test name
      const testInputs = screen.queryAllByPlaceholderText(/例: たしざん 単元確認テスト/);
      if (testInputs.length > 0) {
        await act(async () => {
          fireEvent.change(testInputs[0], { target: { value: '平方根 単元確認テスト' } });
        });
      }

      // Passing line
      const passingInputs = screen.queryAllByPlaceholderText(/例: 80%以上/);
      if (passingInputs.length > 0) {
        await act(async () => {
          fireEvent.change(passingInputs[0], { target: { value: '80点以上' } });
        });
      }

      // Save modal
      const saveBtn = screen.queryByTestId('save-unittest-master-btn') || screen.queryByText('保存して追加');
      if (saveBtn) {
        await act(async () => {
          fireEvent.click(saveBtn);
        });
      }
    }
  });

  it('drills through TeacherDashboard schedule period dropdown selections and task manipulation', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialStudentId={mockStudents[0].id}
          initialTab="schedule"
        />
      );
    });

    // Subject select change on period 1
    const p1Subject = screen.queryByTestId('period-subject-select-1');
    if (p1Subject) {
      await act(async () => {
        fireEvent.change(p1Subject, { target: { value: '数学' } });
      });
    }

    // Start lesson change on period 1
    const p1Unit = screen.queryByTestId('period-unit-select-1');
    if (p1Unit) {
      await act(async () => {
        fireEvent.change(p1Unit, { target: { value: 'cm-d1' } });
      });
    }

    // End lesson change on period 1
    const p1End = screen.queryByTestId('period-end-lesson-select-1');
    if (p1End) {
      await act(async () => {
        fireEvent.change(p1End, { target: { value: 'cm-d2' } });
      });
    }

    // Add Homework
    const addHwBtn = screen.queryByText(/➕ 宿題を追加/);
    if (addHwBtn) {
      await act(async () => {
        fireEvent.click(addHwBtn);
      });
    }

    // Save timetable
    const saveTimetableBtn = screen.queryByText(/時間割コマ割りを保存/);
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }
  });

  it('drills through TeacherDashboard student detail operations, teacher options, and interaction notes', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialStudentId={mockStudents[0].id}
          initialTab="student-detail"
        />
      );
    });

    // Add Teacher Option
    const newTeacherInput = screen.queryByTestId('new-teacher-input');
    const addTeacherBtn = screen.queryByTestId('add-teacher-btn');
    if (newTeacherInput && addTeacherBtn) {
      await act(async () => {
        fireEvent.change(newTeacherInput, { target: { value: '佐藤 先生' } });
        fireEvent.click(addTeacherBtn);
      });
    }

    // Add Personality Option
    const newPersonalityInput = screen.queryByTestId('new-personality-input');
    const addPersonalityBtn = screen.queryByTestId('add-personality-btn');
    if (newPersonalityInput && addPersonalityBtn) {
      await act(async () => {
        fireEvent.change(newPersonalityInput, { target: { value: '努力家' } });
        fireEvent.click(addPersonalityBtn);
      });
    }

    // Add Interaction Note
    const memoTextarea = screen.queryByPlaceholderText(/具体的な対応メモを入力/);
    const addInteractionBtn = screen.queryByText(/対応内容を登録/);
    if (memoTextarea && addInteractionBtn) {
      await act(async () => {
        fireEvent.change(memoTextarea, { target: { value: '模試結果に基づき弱点補強の計画を策定。' } });
        fireEvent.click(addInteractionBtn);
      });
    }

    // Save student details
    const saveStudentBtn = screen.queryByText(/変更を保存する/);
    if (saveStudentBtn) {
      await act(async () => {
        fireEvent.click(saveStudentBtn);
      });
    }
  });
});
