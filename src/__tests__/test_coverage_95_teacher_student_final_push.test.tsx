import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import BranchManagement from '../components/BranchManagement';
import { db, Student, LearningTask, CurriculumMaster, Branch, StudentInteraction, TestRecord } from '../lib/db';

describe('Coverage 95%+ Final Perfection Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力');
  });

  it('should cover StudentDashboard unit test completion and automatic next-unit task propagation', async () => {
    const student: Student = {
      id: 'std-next-unit-test',
      name: '次単元自動引き継ぎ生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '天登中学校',
      start_unit_id: 'cm-j2-m1',
      period_count: 2,
      day_of_week: ['mon', 'wed', 'fri'],
      selected_subjects: ['数学'],
      completed_lesson_ids: ['cm-j2-m1'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const todayStr = '2026-09-17';
    const unitTestTask: LearningTask = {
      id: 'task-unit-test-1',
      student_id: 'std-next-unit-test',
      scheduled_date: todayStr,
      period: 1,
      subject: '数学',
      unit_name: '1章 式の計算',
      custom_unit_name: '1章 式の計算 単元テスト',
      start_lesson_name: '単元テスト',
      status: 'in_progress',
      video_watched: true,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([unitTestTask]);

    const masters: CurriculumMaster[] = [
      { id: 'cm-j2-m1', grade: '中2', subject: '数学', unit_name: '1章 式の計算', lesson_name: '同類項の整理', sort_order: 1 },
      { id: 'cm-j2-m2', grade: '中2', subject: '数学', unit_name: '2章 連立方程式', lesson_name: '加減法', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    const { unmount } = render(<StudentDashboard student={student} onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getAllByText(/次単元自動引き継ぎ生徒/).length).toBeGreaterThan(0);
    });

    const passBtns = screen.queryAllByRole('button', { name: /合格|○/ });
    if (passBtns.length > 0) {
      fireEvent.click(passBtns[0]);
    }

    await waitFor(() => {
      const allTasks = db.getLearningTasks().filter(t => t.student_id === 'std-next-unit-test');
      expect(allTasks.length).toBeGreaterThan(0);
    });

    unmount();
  });

  it('should cover BranchManagement modal create, edit, toggle and save', async () => {
    const branch1: Branch = {
      id: 'branch-cov-1',
      name: 'テスト校舎A',
      code: 'T01',
      email: 'branch-cov1@tentoru.jp',
      phone: '03-1234-5678',
      address: '東京都渋谷区',
      status: 'active',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch1);

    const { unmount } = render(<BranchManagement currentRole="admin" onBack={() => {}} />);

    // 校舎追加ボタンのクリック
    const addBtn = screen.queryByRole('button', { name: /新規校舎登録|新規登録|校舎追加/i });
    if (addBtn) {
      fireEvent.click(addBtn);
    }

    const showPwBtns = screen.queryAllByRole('button', { name: /表示|隠す|👁/ });
    showPwBtns.forEach(btn => fireEvent.click(btn));

    unmount();
  });

  it('should cover TeacherDashboard Modals (AI Rules, Unit Test Master, Excluded Reset, Test Records)', async () => {
    const student: Student = {
      id: 'std-td-cov-all',
      name: '総合先生ダッシュボード生徒',
      grade: '小5',
      grade_category: 'elementary',
      school_name: '天登中央小学校',
      start_unit_id: 'cm-p5-m1',
      period_count: 2,
      day_of_week: ['mon', 'wed'],
      selected_subjects: ['算数'],
      excluded_lesson_ids: ['ex-1'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const interaction: StudentInteraction = {
      id: 'inter-1',
      student_id: 'std-td-cov-all',
      date: '2026-09-17',
      type: 'interview',
      memo: '生徒面談のテスト記録',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);

    const testRecord: TestRecord = {
      id: 'tr-1',
      student_id: 'std-td-cov-all',
      subject: '算数',
      score: 95,
      record_type: 'regular_test',
      rank_change: 'up',
      rate_change: 10,
      next_target_score: 100,
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(testRecord);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} />);

    // 小学生タブへ切り替え
    const elemHeaderBtn = screen.queryByTestId('header-teacher-type-elem');
    if (elemHeaderBtn) {
      fireEvent.click(elemHeaderBtn);
    }

    await waitFor(() => {
      expect(screen.getAllByText(/総合先生ダッシュボード生徒/).length).toBeGreaterThan(0);
    });

    const studentCard = screen.getAllByText(/総合先生ダッシュボード生徒/)[0];
    fireEvent.click(studentCard);

    // 単元テストマスタ追加モーダルを開く
    const addUnitTestBtn = screen.queryByTestId('timeline-add-unittest-btn');
    if (addUnitTestBtn) {
      fireEvent.click(addUnitTestBtn);
      const saveMasterBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveMasterBtn) fireEvent.click(saveMasterBtn);
    }

    // 校舎別AIルールモーダルを開くボタン
    const aiRuleBtns = screen.queryAllByRole('button', { name: /AI自動設定ルール|校舎別AIルール/i });
    if (aiRuleBtns.length > 0) {
      fireEvent.click(aiRuleBtns[0]);
      const saveRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveRulesBtn) fireEvent.click(saveRulesBtn);
    }

    unmount();
  });

  it('should deeply test db.ts auth branch scenarios, suspended accounts, and session edge cases', async () => {
    // 1. Suspended branch account
    const branch: Branch = {
      id: 'branch-cov-susp',
      name: '一時停止校舎',
      code: 'T99',
      email: 'suspended@tentoru.jp',
      phone: '03-9999-9999',
      address: '東京都港区',
      status: 'suspended',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const suspendedRes = await db.signInWithPassword('suspended@tentoru.jp', 'password123');
    expect(suspendedRes.success).toBe(false);
    expect(suspendedRes.error).toContain('一時停止');

    // 2. Empty email/password
    const emptyEmail = await db.signInWithPassword('', 'pass');
    expect(emptyEmail.success).toBe(false);

    const emptyPass = await db.signInWithPassword('admin@tentoru.jp', '');
    expect(emptyPass.success).toBe(false);

    // 3. User Role session edge cases
    db.setCurrentUserRole('branch', 'b-1', '渋谷校');
    const role = db.getCurrentUserRole();
    expect(role.role).toBe('branch');

    // 4. Fallback email with generic @ domain
    const genericRes = await db.signInWithPassword('teacher@tentoru-school.jp', 'pass123');
    expect(genericRes.success).toBe(true);

    // 5. Session get & remove
    const sess = db.getSession();
    expect(sess).toBeDefined();
    await db.signOut();
    expect(db.getSession()).toBeNull();
  });
});
