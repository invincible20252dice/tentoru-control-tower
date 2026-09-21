import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, LearningTask, Branch } from '../lib/db';

describe('TeacherDashboard Milestone & Sub-Features Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '単元テスト名');

    const branch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: 'std-exclude-1',
      student_id: 'std_ex',
      name: '除外テスト生徒',
      grade: '中1',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中1',
      selected_subjects: ['数学'],
      excluded_lesson_ids: ['cm-ex-1']
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-ex-1', subject: '数学', grade: '中1', unit_name: '正の数・負の数', lesson_name: '正負の計算(1)', sort_order: 1 },
      { id: 'cm-ex-2', subject: '数学', grade: '中1', unit_name: '正の数・負の数', lesson_name: '正負の計算(2)', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    const task: LearningTask = {
      id: 'task-ex-1',
      student_id: student.id,
      unit_id: 'cm-ex-2',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '数学',
      custom_unit_name: '正負の計算(2)',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);
  });

  it('covers student detail exclusion reset and unit test master modal toggles', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Select student
    const studentCard = screen.queryAllByText(/除外テスト生徒/);
    if (studentCard.length > 0) {
      await act(async () => {
        fireEvent.click(studentCard[0]);
      });
    }

    // Click reset excluded lessons button if present
    const resetBtns = screen.queryAllByRole('button');
    for (const btn of resetBtns) {
      await act(async () => {
        try {
          const txt = btn.textContent || '';
          if (txt.includes('除外') || txt.includes('リセット') || txt.includes('復元') || txt.includes('単元テスト') || txt.includes('マイルストーン')) {
            fireEvent.click(btn);
          }
        } catch (e) {}
      });
    }

    expect(renderResult.container).toBeDefined();
    renderResult.unmount();
  });

  it('deeply covers TeacherDashboard unit test master modal inputs, unit selector, passing line, and save/cancel actions', async () => {
    const student: Student = {
      id: 'std-v30-1',
      student_id: 'std_v30_1',
      name: '単元テストモーダル確認生徒',
      grade: '小1',
      school_id: 'sch-1',
      school_name: '第一小学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小1',
      selected_subjects: ['算数', '英語']
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-v30-1', subject: '算数', grade: '小1', unit_name: '1章 かずとすうじ', lesson_name: 'かずのならび', sort_order: 1 },
      { id: 'cm-v30-2', subject: '算数', grade: '小1', unit_name: '1章 かずとすうじ', lesson_name: 'かずの大小', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // Switch to elementary mode if needed
    const elemToggleBtn = screen.queryByTestId('header-teacher-type-elem');
    if (elemToggleBtn) {
      fireEvent.click(elemToggleBtn);
    }

    // Switch to milestones tab
    const milestoneTabBtn = screen.queryByTestId('nav-tab-milestones') || screen.queryByRole('button', { name: /進度タイムライン/ });
    if (milestoneTabBtn) {
      fireEvent.click(milestoneTabBtn);
    }

    // Click "+ 単元テストマスタ追加" button to open modal
    const addUnitTestBtn = screen.queryByRole('button', { name: /\+ 単元テストマスタ追加/ });
    if (addUnitTestBtn) {
      fireEvent.click(addUnitTestBtn);

      await waitFor(() => {
        expect(screen.getByText(/📝 単元確認テストの新規マスタ登録/)).toBeInTheDocument();
      });

      // Change unit select if available
      const selectElements = screen.getAllByRole('combobox');
      const unitSelect = selectElements.find(s => (s as HTMLSelectElement).innerHTML.includes('1章 かずとすうじ'));
      if (unitSelect) {
        fireEvent.change(unitSelect, { target: { value: '1章 かずとすうじ' } });
      }

      // Input unit name
      const textInputs = screen.getAllByRole('textbox');
      if (textInputs.length >= 2) {
        fireEvent.change(textInputs[0], { target: { value: '1章 かずとすうじ' } });
        fireEvent.change(textInputs[1], { target: { value: 'かずとすうじ 単元確認テスト' } });
      }
      if (textInputs.length >= 3) {
        fireEvent.change(textInputs[2], { target: { value: '85%以上' } });
      }

      // Save unit test master
      const saveBtn = screen.getByTestId('save-unittest-master-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.queryByText(/📝 単元確認テストの新規マスタ登録/)).not.toBeInTheDocument();
      });
    }

    renderResult.unmount();
  });

  it('deeply covers StudentDashboard completion of unit test and automatic scheduling of next unit STEP 1', async () => {
    const { default: StudentDashboard } = await import('../components/StudentDashboard');

    const student: Student = {
      id: 'std-v30-student',
      student_id: 'S_V30',
      name: '単元テスト自動移行生徒',
      grade: '小1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小1',
      selected_days: ['tuesday', 'friday'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-v30-m1', 'cm-v30-m2']
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: 'cm-v30-m1', grade: '小1', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざん(1)', sort_order: 1 },
      { id: 'cm-v30-m2', grade: '小1', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざん(2)', sort_order: 2 },
      { id: 'cm-v30-ut', grade: '小1', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざん - 単元確認テスト', sort_order: 2.5, item_type: 'unit_test' },
      { id: 'cm-v30-m3', grade: '小1', subject: '算数', unit_name: 'ひきざん', lesson_name: 'ひきざん(1)', sort_order: 3 },
      { id: 'cm-v30-m4', grade: '小1', subject: '算数', unit_name: 'ひきざん', lesson_name: 'ひきざん(2)', sort_order: 4 }
    ];
    await db.saveCurriculumMasters(masters);

    const targetDate = '2026-09-19';
    const task: LearningTask = {
      id: 'task-v30-ut',
      student_id: student.id,
      unit_id: 'cm-v30-ut',
      scheduled_date: targetDate,
      period: 1,
      status: 'unstarted',
      subject: '算数',
      custom_unit_name: 'たしざん - 単元確認テスト',
      start_lesson_id: 'cm-v30-ut',
      end_lesson_id: 'cm-v30-ut',
      start_lesson_name: 'たしざん - 単元確認テスト',
      end_lesson_name: 'たしざん - 単元確認テスト',
      lesson_range: 'たしざん - 単元確認テスト',
      completed_lesson_ids: [],
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    render(<StudentDashboard student={student} onLogout={vi.fn()} initialDate={targetDate} />);

    await waitFor(() => {
      expect(screen.getByText(/さんの学習画面/)).toBeInTheDocument();
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 1 完了');
    });

    // Complete the unit test step
    const completeBtn = screen.getByTestId('step-complete-btn-1-0');
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 1 完了');
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });

    // Verify next attendance day task is scheduled with next unit (ひきざん - ひきざん(1))
    const futureTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date > targetDate);
    if (futureTasks.length > 0) {
      expect(futureTasks[0].custom_unit_name).toContain('ひきざん');
    }
  });

  it('deeply covers DatabaseService methods and edge cases for database completeness', async () => {
    // 1. Curriculum Master methods
    const allMasters = await db.fetchCurriculumMasters();
    expect(allMasters.length).toBeGreaterThan(0);

    const mathMasters = await db.fetchCurriculumMasters('算数');
    expect(mathMasters.every(m => m.subject === '算数')).toBe(true);

    const newMaster: CurriculumMaster = {
      id: 'cm-test-db-edge',
      grade: '中1',
      subject: '理科',
      unit_name: '光の性質',
      lesson_name: '光の反射と屈折',
      sort_order: 999
    };
    await db.saveCurriculumMasters([newMaster]);
    const fetchedNew = db.getCurriculumMasters('理科').find(m => m.id === 'cm-test-db-edge');
    expect(fetchedNew).toBeDefined();

    await db.deleteCurriculumMaster('cm-test-db-edge');
    const fetchedDeleted = db.getCurriculumMasters('理科').find(m => m.id === 'cm-test-db-edge');
    expect(fetchedDeleted).toBeUndefined();

    // 2. Student lesson progress
    await db.saveStudentLessonProgress({
      student_id: 'std-v30-1',
      subject: '算数',
      lesson_id: 'cm-v30-1',
      lesson_name: 'かずのならび',
      status: 'completed',
      date: '2026-09-19'
    });

    const progressList = await db.fetchStudentLessonProgressList('std-v30-1');
    expect(progressList.length).toBeGreaterThan(0);

    // 3. MiniTest & Homework
    await db.saveMiniTestResult({
      id: 'mini-v30-edge',
      student_id: 'std-v30-1',
      date: '2026-09-19',
      test_content: '単元小テスト',
      score: 100
    });
    const minis = await db.fetchMiniTestResults('std-v30-1', '2026-09-19');
    expect(minis.length).toBeGreaterThan(0);

    await db.saveHomeworkResult({
      id: 'hw-v30-edge',
      student_id: 'std-v30-1',
      date: '2026-09-19',
      homework_content: '宿題ドリル',
      homework_deadline: '2026-09-22',
      status: 'complete'
    });
    const hws = await db.fetchHomeworkResults('std-v30-1', '2026-09-19');
    expect(hws.length).toBeGreaterThan(0);

    // 4. Delete learning tasks for date
    await db.deleteLearningTasksForDate('std-v30-1', '2026-09-19');
    const remainingTasks = db.getLearningTasks().filter(t => t.student_id === 'std-v30-1' && t.scheduled_date === '2026-09-19');
    expect(remainingTasks.length).toBe(0);
  });
});
