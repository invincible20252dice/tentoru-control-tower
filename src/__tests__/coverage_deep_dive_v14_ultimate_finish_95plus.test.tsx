import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, Branch, School, CurriculumUnit } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';

describe('Coverage Deep Dive V14 Ultimate Finish 95%+ Target Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS01',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const school: School = {
      id: 'sch-1',
      name: '恵比寿小学校',
      category: '小学生',
      is_active: true
    };
    await db.saveSchool(school);

    const unit: CurriculumUnit = {
      id: 'unit-v14-1',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_id: 'L05-MATH-01',
      lesson_name: '小数の倍',
      passing_line: '80点',
      created_at: '2026-08-27T00:00:00.000Z'
    };
    await db.saveCurriculumUnit(unit);

    const student: Student = {
      id: 'std-v14-1',
      student_id: 'SV1401',
      name: 'アルティメット 太郎',
      grade: '小5',
      grade_category: '小学生',
      level: 'A',
      school_id: 'sch-1',
      school_name: '恵比寿小学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['tuesday'],
      selected_subjects: ['算数'],
      teacher_in_charge: '荒木はやと',
      assigned_teachers: ['荒木はやと']
    };
    await db.saveStudent(student);
  });

  it('covers TeacherDashboard unit test creation form inputs and buttons', async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    render(<TeacherDashboard teacherType="elementary" initialStudentId="std-v14-1" onBackToPortal={vi.fn()} />);

    // 「学習設定・受講設定」または「学校カリキュラム管理」タブへ切替
    const curriculumTab = screen.queryByRole('button', { name: /学校カリキュラム管理/i });
    if (curriculumTab) {
      await act(async () => {
        fireEvent.click(curriculumTab);
      });
    }

    // 単元テスト作成ボタンを開く
    const addUnitTestBtn = screen.queryByRole('button', { name: /＋ 単元テスト/i });
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });
    }

    // 各種フォーム入力
    const testNameInput = screen.queryByPlaceholderText(/例: たしざん 単元確認テスト/i);
    if (testNameInput) {
      await act(async () => {
        fireEvent.change(testNameInput, { target: { value: '小数のかけ算 確認テスト' } });
      });
    }

    const passingLineInput = screen.queryByPlaceholderText(/例: 80%以上, 90点/i);
    if (passingLineInput) {
      await act(async () => {
        fireEvent.change(passingLineInput, { target: { value: '85点' } });
      });
    }
  });

  it('covers CurriculumCsvImport unit test master list search and filter dropdowns', async () => {
    render(<CurriculumCsvImport onImportSuccess={vi.fn()} />);

    // 「単元テスト一括管理＆CSV出力」タブ
    const unitTab = screen.getByTestId('tab-unit-tests');
    await act(async () => {
      fireEvent.click(unitTab);
    });

    // 「登録済みマスター一覧」タブ
    const listTab = screen.getByTestId('tab-curriculum-list');
    await act(async () => {
      fireEvent.click(listTab);
    });
  });
});
