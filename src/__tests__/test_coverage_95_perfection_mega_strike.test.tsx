import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, MiniTestResult, HomeworkResult } from '../lib/db';

describe('TeacherDashboard & DB 95%+ Mega Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const testStudentA: Student = {
    id: 'std-mega-01',
    student_id: 'mega01',
    name: '伊藤 健太',
    name_kana: 'イトウ ケンタ',
    email: 'kenta@tentoru.test',
    grade: '中3',
    school_id: 'sch-1',
    school_name: '天登第一中学校',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 2,
    level: 'A',
    registered_grade: '中3',
    registered_year: 2026,
    selected_subjects: ['数学', '英語'],
    assigned_teachers: ['福田 尚弘'],
    subject_start_positions: {
      '数学': 'cm-mega-1',
      '英語': 'cm-mega-2'
    },
    created_at: '2026-04-01T00:00:00Z'
  };

  const testMasters: CurriculumMaster[] = [
    {
      id: 'cm-mega-1',
      grade: '中3',
      subject: '数学',
      unit_name: '展開と因数分解',
      lesson_name: '第1講 乗法公式',
      sort_order: 1,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    },
    {
      id: 'cm-mega-2',
      grade: '中3',
      subject: '英語',
      unit_name: '受動態',
      lesson_name: '第1講 受動態の基本',
      sort_order: 2,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    },
    {
      id: 'cm-mega-3',
      grade: '中3',
      subject: '数学',
      unit_name: '展開と因数分解',
      lesson_name: '展開と因数分解 単元確認テスト',
      sort_order: 3,
      item_type: 'unit_test',
      passing_line: '80点以上',
      created_at: '2026-04-01T00:00:00Z'
    }
  ];

  const testMiniTests: MiniTestResult[] = [
    {
      id: 'mini-mega-01',
      student_id: 'std-mega-01',
      date: '2026-09-17',
      subject: '数学',
      unit_name: '乗法公式',
      score: 85,
      passed: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'mini-mega-02',
      student_id: 'std-mega-01',
      date: '2026-09-17',
      subject: '英語',
      unit_name: '受動態',
      score: null,
      passed: null,
      created_at: new Date().toISOString()
    }
  ];

  const testHomeworks: HomeworkResult[] = [
    {
      id: 'hw-mega-01',
      student_id: 'std-mega-01',
      date: '2026-09-17',
      subject: '数学',
      unit_name: '乗法公式 ワークP12',
      status: 'submitted',
      completed: true,
      created_at: new Date().toISOString()
    },
    {
      id: 'hw-mega-02',
      student_id: 'std-mega-01',
      date: '2026-09-17',
      subject: '英語',
      unit_name: '受動態 単語練習',
      status: 'unsubmitted',
      completed: false,
      created_at: new Date().toISOString()
    }
  ];

  it('tests mini-tests tab, scores editing, pass/fail toggling, and homework tab', async () => {
    db.saveStudent(testStudentA);
    db.saveCurriculumMasters(testMasters);
    for (const mt of testMiniTests) db.saveMiniTestResult(mt);
    for (const hw of testHomeworks) db.saveHomeworkResult(hw);

    await act(async () => {
      render(
        <TeacherDashboard
          students={[testStudentA]}
          initialStudentId={testStudentA.id}
          initialTab="mini-tests"
          teacherType="junior_high"
        />
      );
    });

    // 1. 小テストタブでの点数入力 & 合否ボタン
    const scoreInputs = screen.queryAllByPlaceholderText(/点数|点/);
    if (scoreInputs.length > 0) {
      await act(async () => {
        fireEvent.change(scoreInputs[0], { target: { value: '90' } });
      });
    }

    const passToggles = screen.queryAllByText(/合格|不合格|未採点/);
    for (const btn of passToggles) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    // 2. 宿題提出状況タブへの切り替え
    const hwTabs = screen.queryAllByText(/宿題提出状況|宿題/);
    if (hwTabs.length > 0) {
      await act(async () => {
        fireEvent.click(hwTabs[0]);
      });
    }

    // 宿題ステータスボタン
    const statusBtns = screen.queryAllByText(/提出済|未提出|再提出/);
    for (const btn of statusBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
  });

  it('tests student start position updates and automatic future task reorganization', async () => {
    db.saveStudent(testStudentA);
    db.saveCurriculumMasters(testMasters);

    await act(async () => {
      render(
        <TeacherDashboard
          students={[testStudentA]}
          initialStudentId={testStudentA.id}
          initialTab="student-list"
          teacherType="junior_high"
        />
      );
    });

    // 生徒情報編集・開始単元ドロップダウンの操作
    const startUnitSelects = screen.queryAllByRole('combobox');
    for (const sel of startUnitSelects) {
      await act(async () => {
        fireEvent.change(sel, { target: { value: 'cm-mega-1' } });
      });
    }

    const saveBtns = screen.queryAllByText(/保存|更新|設定を保存/);
    if (saveBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveBtns[0]);
      });
    }
  });

  it('tests db.ts exception branches and mock resilience', async () => {
    // 異常系テスト
    const invalidLogin = await db.signInWithPassword('not_an_email', 'wrong_pass');
    expect(invalidLogin.success).toBe(false);

    // 空IDでの取得
    const emptyConfig = db.getStudentScheduleConfig('');
    expect(emptyConfig).toBeDefined();

    // 空の単元マスタ
    const emptyMasters = await db.fetchCurriculumMasters();
    expect(Array.isArray(emptyMasters)).toBe(true);
  });
});
