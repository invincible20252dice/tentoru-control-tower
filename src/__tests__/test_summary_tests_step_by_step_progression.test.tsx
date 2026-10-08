import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { 
  findNextUncompletedLessonForSubject 
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
      '英語': 'You are 〜. あなたは〜です。'
    },
    completed_lesson_ids: ['cm-zero-1', 'cm-zero-2'],
    created_at: '2026-10-01T00:00:00Z'
  };

  const testMasters: CurriculumMaster[] = [
    { id: 'cm-zero-1', grade: '1年生', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0のたしざん', sort_order: 82 },
    { id: 'cm-zero-2', grade: '1年生', subject: '算数', unit_name: '0の たしざんと ひきざん', lesson_name: '0のひきざん', sort_order: 83 },
    { id: 'cm-next-1', grade: '1年生', subject: '算数', unit_name: 'ものと ひとの かず', lesson_name: 'ものと ひとの かず(1)', sort_order: 88 },
    { id: 'cm-next-2', grade: '1年生', subject: '算数', unit_name: 'ものと ひとの かず', lesson_name: 'ものと ひとの かず(2)', sort_order: 89 },
    { id: 'cm-eng-1', grade: '小1', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 1', sort_order: 10 },
    { id: 'cm-eng-2', grade: '小1', subject: '英語', unit_name: 'You are 〜. あなたは〜です。', lesson_name: 'STEP 2', sort_order: 11 },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '100');
  });

  describe('Pure scheduler logic step-by-step', () => {
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

    it('2) summary test 1 passed -> next is summary test 2', () => {
      const mini1: MiniTestResult = {
        id: 'mini-1',
        student_id: baseStudent.id,
        subject: '算数',
        unit_name: '0の たしざんと ひきざん',
        test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-20'
      };

      const next = findNextUncompletedLessonForSubject({
        student: baseStudent,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: [mini1]
      });
      expect(next.lessonName).toContain('まとめテスト（２）');
    });

    it('3) summary test 2 passed -> next is summary test 3', () => {
      const mini1: MiniTestResult = {
        id: 'mini-1',
        student_id: baseStudent.id,
        subject: '算数',
        unit_name: '0の たしざんと ひきざん',
        test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-20'
      };
      const mini2: MiniTestResult = {
        id: 'mini-2',
        student_id: baseStudent.id,
        subject: '算数',
        unit_name: '0の たしざんと ひきざん',
        test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-21'
      };

      const next = findNextUncompletedLessonForSubject({
        student: baseStudent,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults: [mini1, mini2]
      });
      expect(next.lessonName).toContain('まとめテスト（３）');
    });

    it('4) summary test 3 passed -> next is unit test', () => {
      const miniTestResults: MiniTestResult[] = [
        {
          id: 'mini-1',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-20'
        },
        {
          id: 'mini-2',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-21'
        },
        {
          id: 'mini-3',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（３）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-22'
        }
      ];

      const next = findNextUncompletedLessonForSubject({
        student: baseStudent,
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults
      });
      expect(next.lessonName).toContain('単元確認テスト');
    });

    it('5) unit test passed -> next is new unit (ものと ひとの かず)', () => {
      const miniTestResults: MiniTestResult[] = [
        {
          id: 'mini-1',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-20'
        },
        {
          id: 'mini-2',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-21'
        },
        {
          id: 'mini-3',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（３）',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-22'
        },
        {
          id: 'mini-4',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - 単元確認テスト',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-23'
        }
      ];

      const next = findNextUncompletedLessonForSubject({
        student: {
          ...baseStudent,
          completed_lesson_ids: [...baseStudent.completed_lesson_ids!, 'cm-auto-ut-算数-小1-0の たしざんと ひきざん']
        },
        subject: '算数',
        tasks: [],
        curriculumMasters: testMasters,
        curriculumUnits: [],
        schoolId: baseStudent.school_id,
        lessonProgressList: [],
        miniTestResults
      });
      expect(next.lessonName).toContain('ものと ひとの かず(1)');
    });
  });

  describe('UI level Auto Reschedule button click & loadData correction', () => {
    it('should select summary test (2) when summary test (1) passed and stale unit test task was in DB', async () => {
      await db.saveStudent(baseStudent);
      await db.saveCurriculumMasters(testMasters);

      await db.saveMiniTestResult({
        id: 'mini-1',
        student_id: baseStudent.id,
        subject: '算数',
        unit_name: '0の たしざんと ひきざん',
        test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
        score: 100,
        passed: true,
        status: 'passed',
        date: '2026-10-20'
      });

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

    it('should progress to summary test (3) when summary test (2) passes', async () => {
      await db.saveStudent(baseStudent);
      await db.saveCurriculumMasters(testMasters);

      const tests = [
        {
          id: 'mini-1',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-20'
        },
        {
          id: 'mini-2',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-21'
        }
      ];
      for (const t of tests) {
        await db.saveMiniTestResult(t);
      }

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

    it('should progress to unit test when summary test (3) passes', async () => {
      await db.saveStudent(baseStudent);
      await db.saveCurriculumMasters(testMasters);

      const tests = [
        {
          id: 'mini-1',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-20'
        },
        {
          id: 'mini-2',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-21'
        },
        {
          id: 'mini-3',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（３）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-22'
        }
      ];
      for (const t of tests) {
        await db.saveMiniTestResult(t);
      }

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

    it('should progress to new unit when unit test passes', async () => {
      const studentWithUnitTestCompleted: Student = {
        ...baseStudent,
        completed_lesson_ids: [...baseStudent.completed_lesson_ids!, 'cm-auto-ut-算数-小1-0の たしざんと ひきざん']
      };
      await db.saveStudent(studentWithUnitTestCompleted);
      await db.saveCurriculumMasters(testMasters);

      const tests = [
        {
          id: 'mini-1',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（１）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-20'
        },
        {
          id: 'mini-2',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（２）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-21'
        },
        {
          id: 'mini-3',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - まとめテスト（３）',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-22'
        },
        {
          id: 'mini-4',
          student_id: baseStudent.id,
          subject: '算数',
          unit_name: '0の たしざんと ひきざん',
          test_content: '算数: 0の たしざんと ひきざん - 単元確認テスト',
          score: 100,
          passed: true,
          status: 'passed' as const,
          date: '2026-10-23'
        }
      ];
      for (const t of tests) {
        await db.saveMiniTestResult(t);
      }

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
        expect(period1Select.value).toBe('cm-next-1');
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

      // 保存された小テスト結果を確認
      await waitFor(() => {
        const savedResults = db.getMiniTestResults().filter(r => r.student_id === baseStudent.id);
        const savedTest = savedResults.find(r => r.task_id === 'task-s1' || r.test_content?.includes('まとめテスト（１）'));
        expect(savedTest).toBeDefined();
        expect(savedTest?.test_content).toBe('算数: 0の たしざんと ひきざん - まとめテスト（１）');
      });
    });
  });
});
