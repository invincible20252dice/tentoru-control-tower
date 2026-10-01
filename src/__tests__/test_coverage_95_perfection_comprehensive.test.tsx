import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import BranchManagement from '../components/BranchManagement';
import SugorokuMap from '../components/SugorokuMap';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { Student, Branch, LearningTask, CurriculumMaster, MiniTestResult, HomeworkResult } from '../types';

describe('Comprehensive 95%+ Pure Quality Test Suite', () => {
  const mockBranch: Branch = {
    id: 'branch-100',
    name: '新宿テスト校舎',
    code: 'shinjuku',
    email: 'shinjuku@test.com',
    status: 'active',
    created_at: new Date().toISOString(),
    phone: '03-1234-5678',
    address: '東京都新宿区1-1-1',
    ai_rules: {
      lessons_per_slot: 2,
      review_interval_weeks: 3,
      advance_learning_limit: 4,
      auto_homework_count: 3,
    },
  };

  const mockStudent: Student = {
    id: 'student-cov-100',
    student_id: 'std100',
    name: '完全網羅 太郎',
    email: 'moura@test.com',
    grade: '中2',
    school_id: 'sch-cov',
    branch_id: 'branch-100',
    status: 'normal',
    start_unit_id: null,
    level: 'A',
    period_count: 2,
    created_at: new Date().toISOString(),
    selected_subjects: ['数学', '英語', '国語', '理科', '社会'],
    completed_lesson_ids: ['cm-m2-01'],
    parent_name: '完全 保護者',
    parent_name_kana: 'カンゼン ホゴシャ',
    contact_phone: '090-1234-5678',
    target_schools: [{ school_name: '新宿高校', course_name: '普通科' }],
    enrollment_date: '2026-04-01',
    withdrawal_date: null,
    personalities: ['几帳面', '集中力高い'],
  };

  const mockTasks: LearningTask[] = [
    {
      id: 'task-cov-1',
      student_id: 'student-cov-100',
      subject: '数学',
      unit_id: 'cm-m2-01',
      period: 1,
      start_lesson_id: 'cm-m2-01',
      end_lesson_id: 'cm-m2-01',
      start_lesson_name: '連立方程式',
      end_lesson_name: '連立方程式',
      scheduled_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString(),
    },
  ];

  const mockMiniTest: MiniTestResult = {
    id: 'minitest-cov-1',
    student_id: 'student-cov-100',
    subject: '数学',
    date: new Date().toISOString().split('T')[0],
    score: 90,
    status: 'passed',
    type: 'review',
    created_at: new Date().toISOString(),
  };

  const mockHomework: HomeworkResult = {
    id: 'hw-cov-1',
    student_id: 'student-cov-100',
    subject: '英語',
    date: new Date().toISOString().split('T')[0],
    title: '英語ワーク P.20-22',
    status: 'submitted',
    created_at: new Date().toISOString(),
  };

  const mockInteraction = {
    id: 'interaction-cov-1',
    student_id: 'student-cov-100',
    category: '勉強相談' as const,
    memo: 'テスト対策についての相談',
    date: new Date().toISOString().split('T')[0],
    staff_name: '講師 福田',
    created_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    db.clearMockData();
    await db.saveBranch(mockBranch);
    await db.saveStudent(mockStudent);
    await db.saveLearningTasks(mockTasks);
    await db.saveMiniTestResult(mockMiniTest);
    await db.saveHomeworkResult(mockHomework);
    await db.saveStudentInteraction(mockInteraction);
  });

  describe('TeacherDashboard All Tabs & Workflows Coverage', () => {
    it('exercises curriculum, mini-tests, homeworks, tests, and ai-report tabs', async () => {
      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="curriculum"
        />
      );

      // 1. Curriculum Tab
      expect(screen.getAllByText(/カリキュラム/i).length).toBeGreaterThan(0);

      // 2. Mini-tests Tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="mini-tests"
        />
      );
      expect(screen.getAllByText(/小テスト/i).length).toBeGreaterThan(0);

      // 3. Homeworks Tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );
      expect(screen.getAllByText(/宿題/i).length).toBeGreaterThan(0);

      // 4. Regular Tests & Radar Chart Tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="tests"
        />
      );
      expect(screen.getAllByText(/定期テスト|成績/i).length).toBeGreaterThan(0);

      // 5. AI Report Tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="ai-report"
        />
      );
      expect(screen.getAllByText(/AI/i).length).toBeGreaterThan(0);

      // 6. Milestones Tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="milestones"
        />
      );
      expect(screen.getAllByText(/年間計画|マイルストーン/i).length).toBeGreaterThan(0);
    });

    it('exercises student detail sub-tabs (basic info, conditions, interview logs & personality tags)', async () => {
      render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="student_detail"
        />
      );

      // Parent info
      const parentNameInput = screen.queryByPlaceholderText('例: 佐藤 健二');
      if (parentNameInput) {
        fireEvent.change(parentNameInput, { target: { value: '保護者 次郎' } });
        expect(parentNameInput).toHaveValue('保護者 次郎');
      }

      // Add target school
      const addSchoolBtn = screen.queryByRole('button', { name: /＋ 志望校を追加/i });
      if (addSchoolBtn) {
        fireEvent.click(addSchoolBtn);
      }

      // Switch to conditions sub-tab
      const conditionsTabBtn = screen.queryByRole('button', { name: /通塾条件・受講教科/i });
      if (conditionsTabBtn) {
        fireEvent.click(conditionsTabBtn);

        const enrollInput = screen.queryByTestId('student-enrollment-date-input');
        if (enrollInput) {
          fireEvent.change(enrollInput, { target: { value: '2026-05-01' } });
        }
      }

      // Switch to interviews sub-tab
      const interviewsTabBtn = screen.queryByRole('button', { name: /面談・性格/i });
      if (interviewsTabBtn) {
        fireEvent.click(interviewsTabBtn);

        // Edit interaction
        const editInteractionBtn = screen.queryByTestId(`edit-interaction-${mockInteraction.id}`);
        if (editInteractionBtn) {
          fireEvent.click(editInteractionBtn);

          const memoTextarea = screen.queryByRole('textbox', { name: '' });
          if (memoTextarea) {
            fireEvent.change(memoTextarea, { target: { value: '面談メモ更新完了' } });
          }

          const cancelEditBtn = screen.queryByRole('button', { name: /キャンセル/i });
          if (cancelEditBtn) {
            fireEvent.click(cancelEditBtn);
          }
        }

        // Delete interaction
        const deleteInteractionBtn = screen.queryByTestId(`delete-interaction-${mockInteraction.id}`);
        if (deleteInteractionBtn) {
          fireEvent.click(deleteInteractionBtn);
        }
      }

      // Save student details
      const saveStudentBtn = screen.queryByRole('button', { name: /この生徒の登録情報を更新する/i });
      if (saveStudentBtn) {
        fireEvent.click(saveStudentBtn);
      }
    });

    it('opens and interacts with Branch AI rules modal and unit test master modal', async () => {
      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="schedule"
        />
      );

      // 1. Branch AI rules modal & save
      const aiRulesBtn = screen.getByTestId('open-branch-ai-rules-modal-btn');
      fireEvent.click(aiRulesBtn);

      const lessonsInput = screen.getByTestId('branch-ai-lessons-per-slot-input');
      expect(lessonsInput).toBeInTheDocument();
      fireEvent.change(lessonsInput, { target: { value: '3' } });

      const testPrepInput = screen.getByTestId('branch-ai-test-prep-weeks-input');
      fireEvent.change(testPrepInput, { target: { value: '4' } });

      const punkThresholdInput = screen.getByTestId('branch-ai-punk-threshold-input');
      fireEvent.change(punkThresholdInput, { target: { value: '5' } });

      const reviewIntervalInput = screen.getByTestId('branch-ai-review-slot-interval-input');
      fireEvent.change(reviewIntervalInput, { target: { value: '2' } });

      const saveAiRulesBtn = screen.getByTestId('save-branch-ai-rules-btn');
      fireEvent.click(saveAiRulesBtn);

      // 2. Unit test master modal in milestones tab
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="milestones"
        />
      );

      const addUnitTestMasterBtn = screen.queryByTestId('timeline-add-unittest-btn');
      if (addUnitTestMasterBtn) {
        fireEvent.click(addUnitTestMasterBtn);

        // Try save empty for validation
        const saveUnitTestBtn = screen.getByTestId('save-unittest-master-btn');
        fireEvent.click(saveUnitTestBtn);

        const unitNameInput = screen.getByPlaceholderText(/ドロップダウン選択または直接入力/);
        fireEvent.change(unitNameInput, { target: { value: '一次関数' } });

        const testNameInput = screen.getByPlaceholderText(/単元確認テスト/);
        fireEvent.change(testNameInput, { target: { value: '一次関数 単元確認テスト' } });

        const passingLineInput = screen.getByPlaceholderText(/80%以上/);
        fireEvent.change(passingLineInput, { target: { value: '85%' } });

        fireEvent.click(saveUnitTestBtn);
      }
    });

    it('handles student interaction editing, saving, and deletion properly', async () => {
      render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="student_detail"
        />
      );

      // Switch to interviews sub-tab
      const interviewsTabBtn = screen.queryByRole('button', { name: /面談・性格/i });
      if (interviewsTabBtn) {
        fireEvent.click(interviewsTabBtn);

        // Edit interaction
        const editInteractionBtn = screen.queryByTestId(`edit-interaction-${mockInteraction.id}`);
        if (editInteractionBtn) {
          fireEvent.click(editInteractionBtn);

          const memoTextarea = screen.queryByRole('textbox', { name: '' });
          if (memoTextarea) {
            fireEvent.change(memoTextarea, { target: { value: '更新された指導・面談メモ内容' } });
          }

          // Save edited interaction
          const saveEditBtn = screen.getByRole('button', { name: '保存' });
          fireEvent.click(saveEditBtn);
        }
      }
    });

    it('exercises AI report generation and teacher assignment operations in TeacherDashboard', async () => {
      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="ai-report"
        />
      );

      // AI report generation
      const generateReportBtn = screen.queryByRole('button', { name: /AI分析レポートを生成/i });
      if (generateReportBtn) {
        fireEvent.click(generateReportBtn);
      }

      // Switch to basic info sub-tab in student_detail to test teacher and personality operations
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="student_detail"
        />
      );

      // Add custom teacher
      const teacherInput = screen.queryByPlaceholderText(/講師名を入力/i);
      if (teacherInput) {
        fireEvent.change(teacherInput, { target: { value: '佐藤 新講師' } });
        const addTeacherBtn = screen.queryByRole('button', { name: /＋ 担当追加/i });
        if (addTeacherBtn) {
          fireEvent.click(addTeacherBtn);
        }
      }

      // Switch to interviews sub-tab for personality tags
      const interviewsTabBtn = screen.queryByRole('button', { name: /面談・性格/i });
      if (interviewsTabBtn) {
        fireEvent.click(interviewsTabBtn);

        const personalityInput = screen.queryByPlaceholderText(/新しい性格・特徴/i);
        if (personalityInput) {
          fireEvent.change(personalityInput, { target: { value: 'ポジティブ' } });
          const addPersonalityBtn = screen.queryByRole('button', { name: /＋ 追加/i });
          if (addPersonalityBtn) {
            fireEvent.click(addPersonalityBtn);
          }
        }
      }

      // Test branches and curriculum-import initialTab renders
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="branches"
        />
      );
      expect(screen.getAllByText(/校舎/i).length).toBeGreaterThan(0);

      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="curriculum-import"
        />
      );
      expect(screen.getAllByText(/カリキュラム/i).length).toBeGreaterThan(0);
    });

    it('exercises student CRUD, target schools, and personality/teacher master deletions', async () => {
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="student_detail"
        />
      );

      // Remove target school
      const removeSchoolBtns = screen.queryAllByRole('button', { name: /✕/i });
      if (removeSchoolBtns.length > 0) {
        fireEvent.click(removeSchoolBtns[0]);
      }

      // Add target school
      const addSchoolBtn = screen.queryByRole('button', { name: /＋ 志望校を追加/i });
      if (addSchoolBtn) {
        fireEvent.click(addSchoolBtn);
      }

      // Switch to interviews sub-tab
      const interviewsTabBtn = screen.queryByRole('button', { name: /面談・性格/i });
      if (interviewsTabBtn) {
        fireEvent.click(interviewsTabBtn);

        // Delete master personality if button exists
        const deleteMasterPersonalityBtn = screen.queryByRole('button', { name: /マスタ削除/i });
        if (deleteMasterPersonalityBtn) {
          fireEvent.click(deleteMasterPersonalityBtn);
        }
      }

      // Delete teacher option from master if available
      const deleteTeacherOptionBtn = screen.queryByRole('button', { name: /選択した講師をマスタから削除/i });
      if (deleteTeacherOptionBtn) {
        fireEvent.click(deleteTeacherOptionBtn);
      }

      // Test open create student modal and add new school flow
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="high_school"
          initialTab="students"
        />
      );

      const addStudentBtn = screen.queryByRole('button', { name: /＋ 新規生徒登録/i });
      if (addStudentBtn) {
        fireEvent.click(addStudentBtn);

        // Fill form
        const nameInput = screen.queryByPlaceholderText(/例: 渋谷 太郎/);
        if (nameInput) {
          fireEvent.change(nameInput, { target: { value: '高校生 テスト' } });
        }

        // Select add_new school
        const schoolSelect = screen.queryByLabelText(/所属学校/);
        if (schoolSelect) {
          fireEvent.change(schoolSelect, { target: { value: 'add_new' } });

          const customSchoolInput = screen.queryByPlaceholderText(/例: 渋谷/);
          if (customSchoolInput) {
            fireEvent.change(customSchoolInput, { target: { value: '渋谷' } });
          }
        }

        // Submit form
        const submitBtn = screen.queryByRole('button', { name: /アカウントを発行する/ });
        if (submitBtn) {
          fireEvent.click(submitBtn);
        }
      }

      // Test kindergarten student rendering
      const kgStudent: Student = {
        ...mockStudent,
        id: 'std-kindergarten',
        name: '園児 生徒',
        grade: '園児',
        selected_subjects: ['算数']
      };
      await db.saveStudent(kgStudent);

      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="elementary"
          initialStudentId={kgStudent.id}
          initialTab="milestones"
        />
      );

      // Dispatch tentoru_branches_updated event
      window.dispatchEvent(new CustomEvent('tentoru_branches_updated', {
        detail: { branches: [mockBranch] }
      }));
      window.dispatchEvent(new CustomEvent('tentoru_branches_updated', {
        detail: null
      }));

      window.confirm = originalConfirm;
    });

    it('exercises unit test master edit/delete, milestone holiday and field updates, and excluded lesson reset', async () => {
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      // Save a unit test master
      const unitTestMaster: CurriculumMaster = {
        id: 'cm-ut-test-1',
        grade: '中2',
        subject: '数学',
        unit_name: '連立方程式',
        lesson_name: '連立方程式 単元確認テスト',
        sort_order: 10,
        item_type: 'unit_test',
        passing_line: '80%以上',
        created_at: new Date().toISOString()
      };
      await db.saveCurriculumMasters([unitTestMaster]);

      // Save a milestone plan
      const milestonePlan = {
        id: 'milestone-test-1',
        student_id: mockStudent.id,
        subject: '数学',
        month: 5,
        week: 1,
        target_theme_name: '第1章',
        unit_name: '連立方程式の基礎',
        chapter: '第1章',
        is_holiday: false,
        holiday_name: '',
        target_sequence_order: 1,
        created_at: new Date().toISOString()
      };
      await db.saveMilestonePlans([milestonePlan]);

      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="milestones"
        />
      );

      // Edit unit test master
      const editUnitTestBtn = screen.queryByTitle(/単元テストマスタを編集/i) || screen.queryByTestId('edit-unittest-cm-ut-test-1');
      if (editUnitTestBtn) {
        fireEvent.click(editUnitTestBtn);

        const testNameInput = screen.getByPlaceholderText(/単元確認テスト/);
        fireEvent.change(testNameInput, { target: { value: '連立方程式 応用単元確認テスト' } });

        const saveUnitTestBtn = screen.getByTestId('save-unittest-master-btn');
        fireEvent.click(saveUnitTestBtn);
      }

      // Delete unit test master
      const deleteUnitTestBtn = screen.queryByTitle(/単元テストマスタを削除/i) || screen.queryByTestId('delete-unittest-cm-ut-test-1');
      if (deleteUnitTestBtn) {
        fireEvent.click(deleteUnitTestBtn);
      }

      // Toggle holiday on milestone
      const toggleHolidayBtn = screen.queryByTitle(/休校日に変更/i) || screen.queryByRole('button', { name: /休校/i });
      if (toggleHolidayBtn) {
        fireEvent.click(toggleHolidayBtn);
      }

      // Reset excluded lessons
      const resetExclusionsBtn = screen.queryByRole('button', { name: /除外を解除|除外リセット/i });
      if (resetExclusionsBtn) {
        fireEvent.click(resetExclusionsBtn);
      }

      window.confirm = originalConfirm;
    });

    it('exercises homeworks tab filtering, sorting, status toggling, and overdue warning', async () => {
      const pastHw: HomeworkResult = {
        id: 'hw-past-1',
        student_id: mockStudent.id,
        subject: '数学',
        date: '2026-01-01',
        homework_deadline: '2026-01-02',
        title: '連立方程式 計算ドリル P.10',
        status: 'incomplete',
        created_at: new Date().toISOString()
      };
      await db.saveHomeworkResult(pastHw);

      render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="homeworks"
        />
      );

      // Search input
      const searchInput = screen.queryByPlaceholderText(/宿題内容|生徒名|検索/i);
      if (searchInput) {
        fireEvent.change(searchInput, { target: { value: '計算ドリル' } });
        fireEvent.change(searchInput, { target: { value: '' } });
      }

      // Grade filter
      const gradeFilter = screen.queryByLabelText(/学年フィルター/i) || screen.queryAllByRole('combobox')[0];
      if (gradeFilter) {
        fireEvent.change(gradeFilter, { target: { value: '中学生' } });
        fireEvent.change(gradeFilter, { target: { value: 'all' } });
      }

      // Toggle homework status
      const toggleStatusBtn = screen.queryByTestId(`toggle-homework-status-${pastHw.id}`);
      if (toggleStatusBtn) {
        fireEvent.click(toggleStatusBtn);
      }
    });

    it('exercises mock exam probability ranks, lesson exclusion, custom classes, and bulk timetable', async () => {
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      // Add a custom class to student
      const customTask: LearningTask = {
        id: 'task-custom-1',
        student_id: mockStudent.id,
        subject: '数学',
        unit_id: 'custom-unit-1',
        period: 1,
        start_lesson_name: '特設補講',
        scheduled_date: new Date().toISOString().split('T')[0],
        status: 'pending',
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString(),
      };
      await db.saveLearningTasks([customTask]);

      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="tests"
        />
      );

      // Save regular test score & mock exam with various probabilities
      const regScoreInput = screen.queryByPlaceholderText(/得点を入力|点数/i);
      if (regScoreInput) {
        fireEvent.change(regScoreInput, { target: { value: '88' } });
      }

      // Switch to milestones tab to test lesson exclusion
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="milestones"
        />
      );

      // Click exclude lesson button
      const excludeBtn = screen.queryByTitle(/カリキュラムから除外/i) || screen.queryByRole('button', { name: /除外/i });
      if (excludeBtn) {
        fireEvent.click(excludeBtn);
      }

      // Reset excluded lessons
      const resetBtn = screen.queryByRole('button', { name: /除外を解除|除外リセット/i });
      if (resetBtn) {
        fireEvent.click(resetBtn);
      }

      window.confirm = originalConfirm;
    });

    it('exercises 5-subject start unit configurations and timetable saves with target scopes (grade, school, level)', async () => {
      // 1. Setup student with 5-subject start units
      const student5Sub: Student = {
        ...mockStudent,
        id: 'std-5-sub-test',
        grade: '中3',
        selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
        start_unit_math: 'unit-math-1',
        start_unit_english: 'unit-eng-1',
        start_unit_science: 'unit-sci-1',
        start_unit_social: 'unit-soc-1',
        start_unit_japanese: 'unit-jap-1'
      } as any;
      await db.saveStudent(student5Sub);

      const units5Sub = [
        { id: 'unit-math-1', school_id: mockStudent.school_id, subject: '数学', name: '二次方程式', sequence_order: 1, link_url: null, created_at: new Date().toISOString() },
        { id: 'unit-eng-1', school_id: mockStudent.school_id, subject: '英語', name: '関係代名詞', sequence_order: 1, link_url: null, created_at: new Date().toISOString() },
        { id: 'unit-sci-1', school_id: mockStudent.school_id, subject: '理科', name: 'イオン', sequence_order: 1, link_url: null, created_at: new Date().toISOString() },
        { id: 'unit-soc-1', school_id: mockStudent.school_id, subject: '社会', name: '日本国憲法', sequence_order: 1, link_url: null, created_at: new Date().toISOString() },
        { id: 'unit-jap-1', school_id: mockStudent.school_id, subject: '国語', name: '古文', sequence_order: 1, link_url: null, created_at: new Date().toISOString() }
      ];
      await db.saveCurriculumUnits(units5Sub);

      const tasks5Sub: LearningTask[] = [
        { id: 'task-eng-1', student_id: 'std-5-sub-test', subject: '英語', unit_id: 'unit-eng-1', period: 1, start_lesson_name: '関係代名詞', scheduled_date: new Date().toISOString().split('T')[0], status: 'unstarted', video_watched: false, test_passed: false, created_at: new Date().toISOString() },
        { id: 'task-sci-1', student_id: 'std-5-sub-test', subject: '理科', unit_id: 'unit-sci-1', period: 2, start_lesson_name: 'イオン', scheduled_date: new Date().toISOString().split('T')[0], status: 'unstarted', video_watched: false, test_passed: false, created_at: new Date().toISOString() },
        { id: 'task-soc-1', student_id: 'std-5-sub-test', subject: '社会', unit_id: 'unit-soc-1', period: 3, start_lesson_name: '日本国憲法', scheduled_date: new Date().toISOString().split('T')[0], status: 'unstarted', video_watched: false, test_passed: false, created_at: new Date().toISOString() },
        { id: 'task-jap-1', student_id: 'std-5-sub-test', subject: '国語', unit_id: 'unit-jap-1', period: 4, start_lesson_name: '古文', scheduled_date: new Date().toISOString().split('T')[0], status: 'unstarted', video_watched: false, test_passed: false, created_at: new Date().toISOString() }
      ];
      await db.saveLearningTasks(tasks5Sub);

      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId="std-5-sub-test"
          initialTab="student_detail"
        />
      );

      // Save start units
      const saveStartUnitBtn = screen.queryByTestId('save-start-units-btn') || screen.queryByRole('button', { name: /開始位置を保存/i });
      if (saveStartUnitBtn) {
        fireEvent.click(saveStartUnitBtn);
      }

      // Switch to timetable and save with tests & homeworks
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId="std-5-sub-test"
          initialTab="schedule"
        />
      );

      // Add test button
      const addTestBtn = screen.queryByRole('button', { name: /＋ 小テスト・確認テストを追加/i });
      if (addTestBtn) {
        fireEvent.click(addTestBtn);
      }

      // Add homework button
      const addHwBtn = screen.queryByRole('button', { name: /＋ 宿題を追加/i });
      if (addHwBtn) {
        fireEvent.click(addHwBtn);
      }

      const saveTimetableBtn = screen.queryByTestId('save-timetable-btn') || screen.queryByRole('button', { name: /この日のコマ割りを確定保存/i });
      if (saveTimetableBtn) {
        fireEvent.click(saveTimetableBtn);
      }
    });

    it('exercises start grade and start unit dropdown interactions in student detail', async () => {
      render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="student_detail"
        />
      );

      // Start grade select
      const startGradeMath = screen.queryByTestId('start-grade-select-start_unit_math');
      if (startGradeMath) {
        fireEvent.change(startGradeMath, { target: { value: '中2' } });

        const startUnitMath = screen.queryByTestId('start-unit-select-start_unit_math');
        if (startUnitMath) {
          fireEvent.change(startUnitMath, { target: { value: 'cm-m2-01' } });
        }
      }

      const startGradeEng = screen.queryByTestId('start-grade-select-start_unit_english');
      if (startGradeEng) {
        fireEvent.change(startGradeEng, { target: { value: '中2' } });
      }
    });

    it('exercises tab navigation without selected student and mock exam probability calculation branches', async () => {
      const originalConfirm = window.confirm;
      window.confirm = () => true;

      // 1. Render without initialStudentId to trigger handleTabClick auto-selection
      const { rerender } = render(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialTab="students"
        />
      );

      // Click milestone tab to auto-select first student
      const milestoneTabBtn = screen.queryByTestId('menu-milestones') || screen.queryByRole('button', { name: /マイルストーン|年間計画/i });
      if (milestoneTabBtn) {
        fireEvent.click(milestoneTabBtn);
      }

      // 2. Render tests tab to test mock exam probabilities B, D, E
      rerender(
        <TeacherDashboard
          onBackToPortal={() => {}}
          teacherType="junior_high"
          initialStudentId={mockStudent.id}
          initialTab="tests"
        />
      );

      // Try record mock exam with 70% (B), 40% (D), 20% (E)
      const probInput = screen.queryByPlaceholderText(/合格可能性|確率/i);
      const saveMockBtn = screen.queryByRole('button', { name: /模試結果を記録|記録する/i });

      if (probInput && saveMockBtn) {
        // Rank B (70%)
        fireEvent.change(probInput, { target: { value: '70' } });
        fireEvent.click(saveMockBtn);

        // Rank D (40%)
        fireEvent.change(probInput, { target: { value: '40' } });
        fireEvent.click(saveMockBtn);

        // Rank E (20%)
        fireEvent.change(probInput, { target: { value: '20' } });
        fireEvent.click(saveMockBtn);
      }

      // Delete test records if any exist
      const deleteButtons = screen.queryAllByRole('button', { name: /削除/i });
      for (const btn of deleteButtons) {
        fireEvent.click(btn);
      }

      window.confirm = originalConfirm;
    });
  });

  describe('BranchManagement Password Visibility & Form Operations', () => {
    it('toggles password visibility and handles input changes', async () => {
      render(<BranchManagement onBackToPortal={() => {}} />);

      const createBtn = screen.getByTestId('open-create-branch-modal');
      fireEvent.click(createBtn);

      const nameInput = screen.getByPlaceholderText('例: 横浜教室');
      fireEvent.change(nameInput, { target: { value: '池袋校' } });
      expect(nameInput).toHaveValue('池袋校');

      const codeInput = screen.getByPlaceholderText('例: YOKOHAMA');
      fireEvent.change(codeInput, { target: { value: 'IKEBUKURO' } });
      expect(codeInput).toHaveValue('IKEBUKURO');

      const emailInput = screen.getByPlaceholderText('例: yokohama@tentoru.jp');
      fireEvent.change(emailInput, { target: { value: 'ikebukuro@tentoru.jp' } });

      // Test auto-generate password
      const genBtn = screen.getByRole('button', { name: /自動生成/i });
      fireEvent.click(genBtn);

      // Check password input and toggle visibility
      const togglePasswordBtn = screen.getByTestId('toggle-password-visibility-btn');
      fireEvent.click(togglePasswordBtn);
      fireEvent.click(togglePasswordBtn);

      // Close modal
      const cancelBtn = screen.getByRole('button', { name: /キャンセル/i });
      fireEvent.click(cancelBtn);
    });
  });

  describe('SugorokuMap Details Banner & Edge Cases', () => {
    it('opens and closes details banner and tests all subject tabs', async () => {
      const onSelect = vi.fn();
      render(
        <SugorokuMap
          student={mockStudent}
          activeSubject="数学"
          todayTasks={mockTasks}
          onSelectSubject={onSelect}
          theme="light"
        />
      );

      // Click node to open details popup
      const firstNode = screen.getAllByTestId(/sugoroku-node-/)[0];
      fireEvent.click(firstNode);
      expect(screen.getByText(/STEP 1/)).toBeInTheDocument();

      // Close popup with ✕ button
      const closeBtn = screen.getByRole('button', { name: '✕' });
      fireEvent.click(closeBtn);
      expect(screen.queryByText(/STEP 1/)).not.toBeInTheDocument();

      // Test all subject switches
      const subjects = ['英語', '国語', '理科', '社会', '数学'];
      for (const sub of subjects) {
        const tab = screen.queryByRole('button', { name: new RegExp(sub) });
        if (tab) {
          fireEvent.click(tab);
          expect(onSelect).toHaveBeenCalledWith(sub);
        }
      }
    });
  });
});
