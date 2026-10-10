import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { 
  findNextUncompletedLessonForSubject, 
  generateSlotsForSelectedSubjects 
} from '../lib/scheduler';
import { 
  db, 
  Student, 
  MiniTestResult, 
  CurriculumMaster, 
  LearningTask 
} from '../lib/db';

describe('Step-by-Step Summary Tests Progression & Auto Reschedule', () => {
  const baseStudent: Student = {
    id: 'student-nakao',
    student_id: 'student24295',
    name: '中尾謙信',
    grade: '小1',
    grade_category: 'elementary',
    school_name: '飽田南小学校',
    school_id: 'school-akita-minami',
    level: 'A',
    period_count: 3,
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数', '英語'],
    subject_start_positions: {
      '算数': '0の たしざんと ひきざん',
      '英語': 'I am 〜. わたしは〜です。'
    },
    completed_lesson_ids: ['cm-zero-1', 'cm-zero-2'],
    created_at: '2026-10-01T00:00:00Z'
  };

  const testMasters: CurriculumMaster[] = [
    // 算数 単元1: 0の たしざんと ひきざん
    { id: 'cm-zero-1', grade: '1年生', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0のたしざん', sort_order: 82 },
    { id: 'cm-zero-2', grade: '1年生', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0のひきざん', sort_order: 83 },
    // 算数 単元2: ものと ひとの かず
    { id: 'cm-next-1', grade: '1年生', subject: '算数', unit_name: 'ものと ひとの かず', lesson_name: 'ものと ひとの かず(1)', sort_order: 88 },
    { id: 'cm-next-2', grade: '1年生', subject: '算数', unit_name: 'ものと ひとの かず', lesson_name: 'ものと ひとの かず(2)', sort_order: 89 },
    // 英語 単元1: I am 〜. わたしは〜です。
    { id: 'cm-eng-iam-1', grade: '小1', subject: '英語', unit_name: 'I am 〜. わたしは〜です。', lesson_name: 'STEP 1', sort_order: 1 },
    { id: 'cm-eng-iam-2', grade: '小1', subject: '英語', unit_name: 'I am 〜. わたしは〜です。', lesson_name: 'STEP 2', sort_order: 2 },
    // 英語 単元2: You are 〜. あなたは〜です。
    { id: 'cm-eng-you-1', grade: '小1', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 1', sort_order: 10 },
    { id: 'cm-eng-you-2', grade: '小1', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 2', sort_order: 11 },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '100');
  });

  describe('Summary tests (1)(2)(3) progression without requiring pass/fail score', () => {
    it('1) lessons completed -> next is summary test 1', () => {
      const next = findNextUncompletedLessonForSubject({
        student: baseStudent,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });
      expect(next.lessonName).toContain('まとめテスト（１）');
    });

    it('2) summary test 1 completed by lesson completion (no pass score required) -> next is summary test 2', () => {
      const studentWithSum1Completed: Student = {
        ...baseStudent,
        completed_lesson_ids: [...baseStudent.completed_lesson_ids!, 'cm-auto-sum1-算数-小1-0の たしざんと ひきざん']
      };

      const next = findNextUncompletedLessonForSubject({
        student: studentWithSum1Completed,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });
      expect(next.lessonName).toContain('まとめテスト（２）');
    });

    it('3) summary test 2 completed -> next is summary test 3', () => {
      const studentWithSum2Completed: Student = {
        ...baseStudent,
        completed_lesson_ids: [
          ...baseStudent.completed_lesson_ids!,
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum2-算数-小1-0の たしざんと ひきざん'
        ]
      };

      const next = findNextUncompletedLessonForSubject({
        student: studentWithSum2Completed,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });
      expect(next.lessonName).toContain('まとめテスト（３）');
    });

    it('4) summary test 3 completed -> next is unit test', () => {
      const studentWithSum3Completed: Student = {
        ...baseStudent,
        completed_lesson_ids: [
          ...baseStudent.completed_lesson_ids!,
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum2-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum3-算数-小1-0の たしざんと ひきざん'
        ]
      };

      const next = findNextUncompletedLessonForSubject({
        student: studentWithSum3Completed,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });
      expect(next.lessonName).toContain('単元確認テスト');
    });

    it('5) past unit summary test completions NEVER cause next unit summary tests (2)(3) to skip', () => {
      // 生徒は前の単元「0の たしざんと ひきざん」を完了し、
      // さらに新単元「ものと ひとの かず」の「ものと ひとの かず(1)」「ものと ひとの かず(2)」「まとめテスト（１）」まで完了した状態
      const studentAtUnit2: Student = {
        ...baseStudent,
        completed_lesson_ids: [
          // 単元1
          'cm-zero-1', 'cm-zero-2',
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum2-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum3-算数-小1-0の たしざんと ひきざん',
          'cm-auto-ut-算数-小1-0の たしざんと ひきざん',
          // 単元2（授業1, 2, まとめテスト1完了）
          'cm-next-1', 'cm-next-2',
          'cm-auto-sum1-算数-小1-ものと ひとの かず',
          'ものと ひとの かず - まとめテスト（１）'
        ]
      };

      const next = findNextUncompletedLessonForSubject({
        student: studentAtUnit2,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });

      // 単元2のまとめテスト（２）が返されるべきであり、決して単元テストにスキップしてはならない！
      expect(next.lessonName).toBe('ものと ひとの かず - まとめテスト（２）');
    });
  });

  describe('English completed unit test regression prevention', () => {
    it('does NOT regress to completed "I am ~" unit test when student completed it with ASCII tilde or wave dash', () => {
      // 生徒は「I am 〜. わたしは〜です。」の全STEPおよび単元テストを完了している
      const studentWithEnglishCompleted: Student = {
        ...baseStudent,
        completed_lesson_ids: [
          'cm-eng-iam-1', 'cm-eng-iam-2',
          'I am ~. わたしは〜です。 - 単元確認テスト' // ASCII tildeで完了記録が存在する場合
        ]
      };

      const next = findNextUncompletedLessonForSubject({
        student: studentWithEnglishCompleted,
        subject: '英語',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: []
      });

      // 過去の「I am 〜」ではなく、新単元「You are 〜. あなたは〜です。」のSTEP 1に進むべき！
      expect(next.lessonName).toContain('You are 〜. あなたは〜です。');
      expect(next.lessonName).not.toContain('I am');
    });

    it('generates slots with next English unit STEP 1 instead of completed "I am ~" unit test', () => {
      const studentWithEnglishCompleted: Student = {
        ...baseStudent,
        selected_subjects: ['英語'],
        completed_lesson_ids: [
          'cm-eng-iam-1', 'cm-eng-iam-2',
          'I am 〜. わたしは〜です。 - 単元確認テスト'
        ]
      };

      const slots = generateSlotsForSelectedSubjects({
        student: studentWithEnglishCompleted,
        periodCount: 1,
        selectedSubjects: ['英語'],
        curriculumMasters: testMasters,
        schoolId: baseStudent.school_id
      });

      expect(slots[1].startLessonName).toContain('You are 〜. あなたは〜です。');
      expect(slots[1].startLessonName).not.toContain('I am');
    });
  });

  describe('UI level Auto Reschedule button click & loadData correction', () => {
    it('should select summary test (2) when summary test (1) completed and stale unit test task was in DB', async () => {
      const studentWithSum1: Student = {
        ...baseStudent,
        selected_subjects: ['算数'],
        completed_lesson_ids: [
          'cm-zero-1', 'cm-zero-2',
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん'
        ]
      };
      await db.saveStudent(studentWithSum1);
      await db.saveCurriculumMasters(testMasters);

      const staleTask: LearningTask = {
        id: 'task-stale',
        student_id: baseStudent.id,
        scheduled_date: '2026-10-27',
        period: 1,
        subject: '算数',
        unit_id: 'cm-auto-ut-算数-小1-0の たしざんと ひきざん',
        start_lesson_id: 'cm-auto-ut-算数-小1-0の たしざんと ひきざん',
        end_lesson_id: 'cm-auto-ut-算数-小1-0の たしざんと ひきざん',
        start_lesson_name: '0の たしざんと ひきざん - 単元確認テスト',
        end_lesson_name: '0の たしざんと ひきざん - 単元確認テスト',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: '2026-10-20'
      };
      await db.saveLearningTasks([staleTask]);

      render(
        <TeacherDashboard 
          initialStudentId={baseStudent.id} 
          teacherType="elementary" 
          initialDate="2026-10-27" 
          initialTab="schedule"
        />
      );

      // loadData または「遅れチェック ＆ 自動リスケ」押下でまとめテスト（２）に確実に更新される
      await waitFor(() => {
        const period1Select = screen.getByTestId('period-unit-select-1') as HTMLSelectElement;
        expect(period1Select.value).toBe('cm-auto-sum2-算数-小1-0の たしざんと ひきざん');
      });

      const rescheduleBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/ });
      fireEvent.click(rescheduleBtn);

      await waitFor(() => {
        const period1Select = screen.getByTestId('period-unit-select-1') as HTMLSelectElement;
        expect(period1Select.value).toBe('cm-auto-sum2-算数-小1-0の たしざんと ひきざん');
      });
    });

    it('should progress to summary test (3) when summary test (2) completes', async () => {
      const studentWithSum2: Student = {
        ...baseStudent,
        selected_subjects: ['算数'],
        completed_lesson_ids: [
          'cm-zero-1', 'cm-zero-2',
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum2-算数-小1-0の たしざんと ひきざん'
        ]
      };
      await db.saveStudent(studentWithSum2);
      await db.saveCurriculumMasters(testMasters);

      render(
        <TeacherDashboard 
          initialStudentId={baseStudent.id} 
          teacherType="elementary" 
          initialDate="2026-10-27" 
          initialTab="schedule"
        />
      );

      await waitFor(() => {
        const rescheduleBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/ });
        fireEvent.click(rescheduleBtn);
      });

      await waitFor(() => {
        const period1Select = screen.getByTestId('period-unit-select-1') as HTMLSelectElement;
        expect(period1Select.value).toBe('cm-auto-sum3-算数-小1-0の たしざんと ひきざん');
      });
    });

    it('should progress to unit test when summary test (3) completes', async () => {
      const studentWithSum3: Student = {
        ...baseStudent,
        selected_subjects: ['算数'],
        completed_lesson_ids: [
          'cm-zero-1', 'cm-zero-2',
          'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum2-算数-小1-0の たしざんと ひきざん',
          'cm-auto-sum3-算数-小1-0の たしざんと ひきざん'
        ]
      };
      await db.saveStudent(studentWithSum3);
      await db.saveCurriculumMasters(testMasters);

      render(
        <TeacherDashboard 
          initialStudentId={baseStudent.id} 
          teacherType="elementary" 
          initialDate="2026-10-27" 
          initialTab="schedule"
        />
      );

      await waitFor(() => {
        const rescheduleBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/ });
        fireEvent.click(rescheduleBtn);
      });

      await waitFor(() => {
        const period1Select = screen.getByTestId('period-unit-select-1') as HTMLSelectElement;
        expect(period1Select.value).toBe('cm-auto-ut-算数-小1-0の たしざんと ひきざん');
      });
    });
  });

  describe('StudentDashboard test completion saves exact test name', () => {
    it('saves exact test content for summary test 1 when completed on StudentDashboard', async () => {
      await db.saveStudent(baseStudent);
      await db.saveCurriculumMasters(testMasters);

      const taskSummary1: LearningTask = {
        id: 'task-s1',
        student_id: baseStudent.id,
        scheduled_date: '2026-10-20',
        period: 1,
        subject: '算数',
        unit_id: 'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
        start_lesson_id: 'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
        end_lesson_id: 'cm-auto-sum1-算数-小1-0の たしざんと ひきざん',
        start_lesson_name: '0の たしざんと ひきざん - まとめテスト（１）',
        end_lesson_name: '0の たしざんと ひきざん - まとめテスト（１）',
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        created_at: '2026-10-20'
      };
      await db.saveLearningTasks([taskSummary1]);

      render(
        <StudentDashboard 
          student={baseStudent} 
          onBackToPortal={() => {}}
          initialDate="2026-10-20" 
        />
      );

      // 完了ボタンをクリックして完了
      await waitFor(() => {
        const completeBtn = screen.getByTestId('complete-task-btn-1');
        expect(completeBtn).toBeInTheDocument();
        fireEvent.click(completeBtn);
      });

      // タスクが完了ステータスになり、講師未設定のため勝手な小テスト結果が自動生成されないことを確認
      await waitFor(() => {
        const updatedTask = db.getLearningTasks().find(t => t.id === 'task-s1');
        expect(updatedTask?.status).toBe('completed');
        const savedResults = db.getMiniTestResults().filter(r => r.student_id === baseStudent.id);
        const savedTest = savedResults.find(r => r.task_id === 'task-s1' || r.test_content?.includes('まとめテスト（１）'));
        expect(savedTest).toBeUndefined();
      });
    });
  });
});
