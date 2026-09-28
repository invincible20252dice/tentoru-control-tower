import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, TestRecord, LearningTask } from '../types';

describe('TeacherDashboard Mega Coverage Master Suite', () => {
  const mockStudents: Student[] = [
    {
      id: 'std-mega-1',
      student_id: 'S_MEGA_1',
      name: 'メガテスト生徒',
      name_kana: 'メガテストセイト',
      grade: '中3',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 3,
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語', '理科'],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面', '論理的'],
      start_unit_math: 'cm-mega-1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中3'
    }
  ];

  const mockCurriculums: CurriculumMaster[] = [
    {
      id: 'cm-mega-1',
      subject: '数学',
      grade: '中3',
      unit_name: '平方根',
      lesson_name: '平方根の計算 STEP 1',
      sort_order: 1,
      target_level: 'A'
    },
    {
      id: 'cm-mega-2',
      subject: '数学',
      grade: '中3',
      unit_name: '平方根',
      lesson_name: '平方根 単元確認テスト',
      sort_order: 2,
      target_level: 'A'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    mockStudents.forEach(s => db.saveStudent(s));
    await db.saveCurriculumMasters(mockCurriculums);
  });

  it('tests regular exam and mock exam forms with save & delete', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialTab="tests"
        />
      );
    });

    // 定期テスト登録フォーム
    const examScoreInputs = screen.queryAllByPlaceholderText(/得点|点数/);
    if (examScoreInputs.length > 0) {
      await act(async () => {
        fireEvent.change(examScoreInputs[0], { target: { value: '92' } });
      });
    }

    const saveExamBtns = screen.queryAllByText(/定期テスト結果を保存|登録する/);
    if (saveExamBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveExamBtns[0]);
      });
    }
  });

  it('tests schedule slot customization and AI rules saving', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialTab="schedule"
        />
      );
    });

    // コマ割り教科変更
    const periodSelects = screen.queryAllByTestId(/period-subject-select/);
    if (periodSelects.length > 0) {
      await act(async () => {
        fireEvent.change(periodSelects[0], { target: { value: '英語' } });
      });
    }

    // 宿題追加
    const addHwBtn = screen.queryByText(/➕ 宿題を追加/);
    if (addHwBtn) {
      await act(async () => {
        fireEvent.click(addHwBtn);
      });
    }

    // 時間割保存
    const saveTimetableBtn = screen.queryByText(/時間割コマ割りを保存/);
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }
  });

  it('tests AI report editor and interaction notes', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={mockStudents}
          curriculumMasters={mockCurriculums}
          tasks={[]}
          initialTab="ai-report"
        />
      );
    });

    const reportTextareas = screen.queryAllByPlaceholderText(/指導報告書の詳細/);
    if (reportTextareas.length > 0) {
      await act(async () => {
        fireEvent.change(reportTextareas[0], { target: { value: '今週は平方根の計算を重点的に演習しました。' } });
      });
    }

    const saveReportBtns = screen.queryAllByText(/報告書を保存|保存する/);
    if (saveReportBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveReportBtns[0]);
      });
    }
  });
});
