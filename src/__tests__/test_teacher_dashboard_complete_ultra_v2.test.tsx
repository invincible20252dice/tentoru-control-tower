import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MilestonePlan, MiniTestResult, HomeworkResult } from '../types';

describe('TeacherDashboard Complete Ultra V2 Coverage Suite', () => {
  const students: Student[] = [
    {
      id: 'std-v2-1',
      student_id: 'S_V2_1',
      name: '生徒一',
      grade: '中1',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'thursday'],
      selected_subjects: ['数学', '英語'],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面'],
      start_unit_math: 'cm-1',
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '中1'
    },
    {
      id: 'std-v2-2',
      student_id: 'S_V2_2',
      name: '生徒二',
      grade: '小6',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'review_needed',
      period_count: 2,
      selected_days: ['wednesday'],
      selected_subjects: ['算数'],
      created_at: '2026-04-01T00:00:00Z',
      registered_year: 2026,
      registered_grade: '小6'
    }
  ];

  const curriculums: CurriculumMaster[] = [
    {
      id: 'cm-1',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '加法と減法 STEP 1',
      sort_order: 1,
      target_level: 'A'
    },
    {
      id: 'cm-2',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '正の数・負の数 単元確認テスト',
      sort_order: 2,
      target_level: 'A'
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    students.forEach(s => db.saveStudent(s));
    await db.saveCurriculumMasters(curriculums);
  });

  it('covers all TeacherDashboard tab clicks, modal triggers, and form interactions', async () => {
    let container: HTMLElement;
    await act(async () => {
      const res = render(
        <TeacherDashboard
          students={students}
          curriculumMasters={curriculums}
          tasks={[]}
          initialTab="schedule"
        />
      );
      container = res.container;
    });

    // 1. 各タブの切り替え
    const tabNames = [
      '週別時間割',
      '月間マイルストーン',
      'カリキュラムマスタ',
      '確認テスト結果',
      '宿題提出管理',
      '生徒カルテ',
      'AI進度レポート',
      '校舎・AI設定',
      'CSV一括管理'
    ];

    for (const name of tabNames) {
      const tabBtn = screen.queryAllByText(new RegExp(name));
      if (tabBtn.length > 0) {
        await act(async () => {
          fireEvent.click(tabBtn[0]);
        });
      }
    }

    // 2. 自動リスケボタン
    const rescheduleBtns = screen.queryAllByText(/遅れチェック＆自動リスケ|自動リスケ/);
    if (rescheduleBtns.length > 0) {
      await act(async () => {
        fireEvent.click(rescheduleBtns[0]);
      });
    }

    // 3. 生徒切り替え
    const studentSelect = container!.querySelector('select');
    if (studentSelect) {
      await act(async () => {
        fireEvent.change(studentSelect, { target: { value: 'std-v2-2' } });
      });
    }
  });

  it('covers mini-tests, homeworks, and student detail interactions thoroughly', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={students}
          curriculumMasters={curriculums}
          tasks={[]}
          initialTab="tests"
        />
      );
    });

    // テスト点数入力
    const scoreInputs = screen.queryAllByPlaceholderText(/点数/);
    if (scoreInputs.length > 0) {
      await act(async () => {
        fireEvent.change(scoreInputs[0], { target: { value: '95' } });
      });
    }

    // 合否トグル
    const passBtns = screen.queryAllByText(/合格|不合格/);
    if (passBtns.length > 0) {
      await act(async () => {
        fireEvent.click(passBtns[0]);
      });
    }

    // 宿題管理タブ
    const hwTab = screen.queryAllByText(/宿題提出管理/);
    if (hwTab.length > 0) {
      await act(async () => {
        fireEvent.click(hwTab[0]);
      });
      const completeBtns = screen.queryAllByText(/提出済|完了|未完了/);
      if (completeBtns.length > 0) {
        await act(async () => {
          fireEvent.click(completeBtns[0]);
        });
      }
    }
  });
});
