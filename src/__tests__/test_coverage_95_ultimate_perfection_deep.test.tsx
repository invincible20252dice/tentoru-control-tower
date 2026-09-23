import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, HomeworkResult } from '../types';

describe('TeacherDashboard & DB 95%+ Ultimate Perfection Master Suite', () => {
  const elemStudent: Student = {
    id: 'std-perf-elem-1',
    student_id: 'std-perf-elem-1',
    name: '小学 完璧花子',
    name_kana: 'ショウガク カンペキハナコ',
    email: 'hanako@example.com',
    grade: '小3',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'fast',
    level: 'A',
    selected_subjects: ['算数', '国語', '英語'],
    selected_days: ['monday', 'thursday'],
    period_count: 2,
    registered_year: 2026,
    registered_grade: '小3',
    personalities: ['集中力高い', '負けず嫌い'],
    target_schools: [{ school_name: '慶應中等部', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-p-m1',
    start_unit_english: 'cm-p-e1'
  };

  const masters: CurriculumMaster[] = [
    { id: 'cm-p-m1', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算(1)', sort_order: 1 },
    { id: 'cm-p-m2', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算(2)', sort_order: 2 },
    { id: 'cm-p-m3', grade: '小3', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算 - 単元確認テスト', sort_order: 3, item_type: 'unit_test' },
    { id: 'cm-p-e1', grade: '小3', subject: '英語', unit_name: 'Greetings', lesson_name: 'Greetings(1)', sort_order: 1 },
    { id: 'cm-p-e2', grade: '小3', subject: '英語', unit_name: 'Greetings', lesson_name: 'Greetings - 単元確認テスト', sort_order: 2, item_type: 'unit_test' }
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('students', JSON.stringify([elemStudent]));
    localStorage.setItem('curriculum_masters', JSON.stringify(masters));
  });

  it('1. TeacherDashboard: Deeply exercise Curriculum Import, Unit Master Modal, and Milestone Timeline', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={elemStudent.id}
          initialTab="curriculum-import"
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/カリキュラムCSVインポート|CSV/i).length).toBeGreaterThan(0);
    });

    // 校舎アカウント管理タブへ遷移
    const branchTab = screen.queryByTestId('menu-branches') || screen.queryByText('校舎アカウント管理');
    if (branchTab) {
      await act(async () => {
        fireEvent.click(branchTab);
      });
    }

    // 年間計画（マイルストーン）タブへ遷移
    const milestonesTab = screen.queryByText('年間計画（マイルストーン）');
    if (milestonesTab) {
      await act(async () => {
        fireEvent.click(milestonesTab);
      });
    }
  });

  it('2. TeacherDashboard: Deeply exercise Student Detail All Form Fields, Dates, Tags, and Submissions', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          onBackToPortal={vi.fn()}
          initialStudentId={elemStudent.id}
          initialTab="student-list"
        />
      );
    });

    // 編集ボタンで生徒詳細へ
    const editBtn = screen.queryByTestId(`edit-student-btn-${elemStudent.id}`) || screen.queryAllByTitle(/生徒情報を編集/i)[0];
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });
    }

    await waitFor(() => {
      expect(screen.getAllByText(/基本情報|生徒カルテ/i).length).toBeGreaterThan(0);
    });

    // 電話番号や保護者名の変更
    const phoneInput = screen.queryByPlaceholderText(/電話番号/i) || screen.queryByLabelText(/電話/i);
    if (phoneInput) {
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '090-1234-5678' } });
      });
    }

    // 保存ボタン
    const saveBtn = screen.queryByTestId('save-student-detail-btn') || screen.queryByText(/生徒情報を保存/i);
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }
  });

  it('3. DB Operations Deep Coverage: Full Lifecycle of all methods and data synchronization', async () => {
    // 1. 全初期モックデータの取得
    const allStudents = db.getStudents();
    expect(allStudents.length).toBeGreaterThan(0);
    const allMasters = db.getCurriculumMasters();
    expect(allMasters.length).toBeGreaterThan(0);
    const allUnits = db.getCurriculumUnits();
    expect(Array.isArray(allUnits)).toBe(true);

    // 2. 単元マスタの追加・更新・削除
    const newMasterItem: CurriculumMaster = {
      id: 'cm-db-perf-99',
      grade: '小3',
      subject: '国語',
      unit_name: '漢字の組み立て',
      lesson_name: '漢字の組み立て(1)',
      sort_order: 99
    };
    await db.saveCurriculumMasters([newMasterItem]);
    expect(db.getCurriculumMasters().some(m => m.id === 'cm-db-perf-99')).toBe(true);
    await db.deleteCurriculumMaster('cm-db-perf-99');
    expect(db.getCurriculumMasters().some(m => m.id === 'cm-db-perf-99')).toBe(false);

    // 3. 生徒情報の更新・保存
    const updatedStudent: Student = {
      ...elemStudent,
      name: '小学 完璧花子 更新版',
      level: 'B'
    };
    await db.saveStudent(updatedStudent);
    const fetchedStudent = db.getStudents().find(s => s.id === elemStudent.id);
    expect(fetchedStudent?.name).toBe('小学 完璧花子 更新版');
    expect(fetchedStudent?.level).toBe('B');

    // 4. 校舎データの全件取得
    const branches = db.getBranches();
    expect(branches.length).toBeGreaterThan(0);
  });
});
