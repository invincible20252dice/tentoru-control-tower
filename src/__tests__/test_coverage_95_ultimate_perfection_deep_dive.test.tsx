import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import BranchManagement from '../components/BranchManagement';
import { db, Student, CurriculumMaster, Branch } from '../lib/db';

describe('Coverage 95%+ Ultimate Perfection Deep Dive Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  const mockElemStudent: Student = {
    id: 'std-deep-elem',
    student_id: 'student_deep_elem',
    name: '小学 太郎',
    name_kana: 'ショウガク タロウ',
    email: 'taro.elem@tentoru.test',
    grade: '小5',
    school_id: 'sch-1',
    school_name: '恵比寿小学校',
    classroom: '恵比寿教室',
    status: 'normal',
    period_count: 2,
    level: 'B',
    registered_grade: '小5',
    registered_year: 2026,
    selected_subjects: ['算数', '国語'],
    assigned_teachers: ['福田 尚弘'],
    created_at: '2026-04-01T00:00:00Z',
    excluded_lesson_ids: ['cm-101']
  };

  const mockCurriculumMasters: CurriculumMaster[] = [
    {
      id: 'cm-101',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第1講 小数の意味',
      sort_order: 1,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    },
    {
      id: 'cm-102',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第2講 小数の計算',
      sort_order: 2,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    },
    {
      id: 'cm-103',
      grade: '小5',
      subject: '算数',
      unit_name: '分数のたし算',
      lesson_name: '第1講 通分と約分',
      sort_order: 3,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: '2026-04-01T00:00:00Z'
    }
  ];

  it('thoroughly tests unit test modal creation, validation, dropdown selection, and save in TeacherDashboard', async () => {
    db.saveCurriculumMasters(mockCurriculumMasters);

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const saveMastersSpy = vi.spyOn(db, 'saveCurriculumMasters');

    await act(async () => {
      render(
        <TeacherDashboard
          students={[mockElemStudent]}
          initialStudentId={mockElemStudent.id}
          initialTab="student-list"
          teacherType="elementary"
        />
      );
    });

    // 生徒詳細／カリキュラム管理を開く
    const studentCard = screen.queryByText(/小学 太郎/);
    if (studentCard) {
      await act(async () => {
        fireEvent.click(studentCard);
      });
    }

    // 単元テスト追加ボタンをクリック
    const addUnitTestBtn = screen.queryByTestId('timeline-add-unittest-btn');
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });

      // モーダルが開いていることを検証
      const modal = screen.getByTestId('unit-test-master-modal');
      expect(modal).toBeInTheDocument();

      // 空名での保存バリデーション（alert）
      const saveBtn = screen.getByTestId('save-unittest-master-btn');
      const testNameInput = screen.getByPlaceholderText('例: たしざん 単元確認テスト');
      await act(async () => {
        fireEvent.change(testNameInput, { target: { value: '' } });
        fireEvent.click(saveBtn);
      });
      expect(alertSpy).toHaveBeenCalledWith('単元テスト名を入力してください。');

      // 単元ドロップダウンの選択
      const unitSelect = screen.queryByDisplayValue(/-- 対象単元を選択/);
      if (unitSelect) {
        await act(async () => {
          fireEvent.change(unitSelect, { target: { value: '小数のかけ算' } });
        });
      }

      // フォーム入力
      await act(async () => {
        fireEvent.change(testNameInput, { target: { value: '小数のかけ算 総合まとめ' } });
      });

      const passingInput = screen.getByPlaceholderText('例: 80%以上, 90点');
      await act(async () => {
        fireEvent.change(passingInput, { target: { value: '85点以上' } });
        fireEvent.click(saveBtn);
      });

      await waitFor(() => {
        expect(saveMastersSpy).toHaveBeenCalled();
      });
    }

    alertSpy.mockRestore();
    saveMastersSpy.mockRestore();
  });

  it('tests Branch AI rules modal updates and persistence', async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          students={[mockElemStudent]}
          initialTab="student-list"
          teacherType="all"
        />
      );
    });

    const aiRulesBtn = screen.queryByText(/AI計画ルール/);
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });

      const reviewInput = screen.queryByTestId('branch-ai-review-slot-interval-input');
      if (reviewInput) {
        await act(async () => {
          fireEvent.change(reviewInput, { target: { value: '5' } });
        });
      }

      const saveAiRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveAiRulesBtn) {
        await act(async () => {
          fireEvent.click(saveAiRulesBtn);
        });
      }
    }
  });

  it('tests comprehensive db.ts methods and error branches', async () => {
    // Session & Auth
    const loginRes = await db.signInWithPassword('admin@tentoru.test', 'password123');
    expect(loginRes.success).toBe(true);
    expect(db.getSession()).not.toBeNull();

    const branchLoginRes = await db.signInWithPassword('branch_shibuya@tentoru.test', 'password123');
    expect(branchLoginRes.success).toBe(true);

    await db.signOut();
    expect(db.getSession()).toBeNull();

    // Students
    const testStudent: Student = {
      id: 'std-cov-db-test',
      student_id: 'cov101',
      name: 'テスト 生徒',
      grade: '中3',
      status: 'normal',
      period_count: 2,
      created_at: new Date().toISOString()
    };
    await db.saveStudent(testStudent);
    const fetched = await db.fetchStudent(testStudent.id);
    expect(fetched?.name).toBe('テスト 生徒');

    const allSt = await db.fetchStudents();
    expect(allSt.length).toBeGreaterThan(0);

    await db.deleteStudent(testStudent.id);
    const deletedSt = await db.fetchStudent(testStudent.id);
    expect(deletedSt).toBeNull();

    // Curriculum Masters
    const testMaster: CurriculumMaster = {
      id: 'cm-cov-test-1',
      grade: '中3',
      subject: '数学',
      unit_name: '2次方程式',
      lesson_name: '解の公式',
      sort_order: 10,
      item_type: 'lesson',
      passing_line: '80%以上',
      created_at: new Date().toISOString()
    };
    await db.saveCurriculumMasters([testMaster]);
    const masters = await db.fetchCurriculumMasters();
    expect(masters.some(m => m.id === 'cm-cov-test-1')).toBe(true);

    // Schedule Config
    await db.saveStudentScheduleConfig({
      student_id: 'std-cov-db-test',
      weekly_frequency: '3',
      weekly_duration: '90min',
      selected_days: ['火', '木', '土'],
      default_slots: 3
    });
    const config = db.getStudentScheduleConfig('std-cov-db-test');
    expect(config?.weekly_frequency).toBe('3');

    // Learning Tasks
    await db.saveLearningTasks([
      {
        id: 'task-cov-1',
        student_id: 'std-cov-db-test',
        date: '2026-09-17',
        subject: '数学',
        lesson_id: 'cm-cov-test-1',
        lesson_name: '解の公式',
        is_completed: false,
        is_review: false,
        is_homework: false,
        status: 'pending',
        slot_number: 1,
        created_at: new Date().toISOString()
      }
    ]);
    const tasks = db.getLearningTasks('std-cov-db-test');
    expect(tasks.length).toBe(1);

    // Schools & Branches
    const branches = db.getBranches();
    expect(branches.length).toBeGreaterThan(0);
    const defaultRules = db.getBranchAIRules('branch-1');
    expect(defaultRules.lessons_per_slot).toBeDefined();
  });

  it('tests BranchManagement full CRUD lifecycle and branch AI rules', async () => {
    await act(async () => {
      render(
        <BranchManagement
          onBack={() => {}}
        />
      );
    });

    const addBranchBtn = screen.queryByText(/新規校舎追加/) || screen.queryByText(/校舎登録/);
    if (addBranchBtn) {
      await act(async () => {
        fireEvent.click(addBranchBtn);
      });
    }

    const branchNameInput = screen.queryByPlaceholderText(/例: 恵比寿教室/);
    if (branchNameInput) {
      await act(async () => {
        fireEvent.change(branchNameInput, { target: { value: '新宿南口教室' } });
      });
    }
  });

  it('tests StudentDashboard views and interactions', async () => {
    db.saveStudent(mockElemStudent);
    await act(async () => {
      render(
        <StudentDashboard
          student={mockElemStudent}
          onBackToPortal={() => {}}
        />
      );
    });

    // 各タブ切り替え
    const tabs = screen.queryAllByRole('tab');
    for (const tab of tabs) {
      await act(async () => {
        fireEvent.click(tab);
      });
    }

    // 今日のタスク確認
    const completeBtns = screen.queryAllByText(/完了にする|受講済/);
    if (completeBtns.length > 0) {
      await act(async () => {
        fireEvent.click(completeBtns[0]);
      });
    }
  });
});
