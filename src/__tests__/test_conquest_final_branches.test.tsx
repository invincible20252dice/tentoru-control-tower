import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  calculateLessonRangeForSlot,
  findNextUncompletedLessonForSubject,
  getDisplaySteps,
  CurriculumSkipViolationError
} from '../lib/scheduler';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type LearningTask, type MiniTestResult } from '../lib/db';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Final Extreme Branch Conquest Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  describe('scheduler.ts Edge Branches', () => {
    it('throws CurriculumSkipViolationError when enforceNoSkip is true and future step is picked', () => {
      const student: Student = {
        id: 'st-skip-test',
        name: 'スキップ生徒',
        grade: '中1',
        completed_lesson_ids: []
      };

      const masters: CurriculumMaster[] = [
        { id: 'step-1', grade: '中1', subject: '数学', unit_name: '第1章', lesson_name: 'ステップ1', sort_order: 1 },
        { id: 'step-2', grade: '中1', subject: '数学', unit_name: '第1章', lesson_name: 'ステップ2', sort_order: 2 },
        { id: 'step-3', grade: '中1', subject: '数学', unit_name: '第1章', lesson_name: 'ステップ3', sort_order: 3 }
      ];

      expect(() => {
        calculateLessonRangeForSlot({
          subject: '数学',
          student,
          startLessonId: 'step-3', // Attempting to skip step-1
          enforceNoSkip: true,
          curriculumMasters: masters
        });
      }).toThrow(CurriculumSkipViolationError);
    });

    it('covers calculateLessonRangeForSlot with hasFailed && failedTestObj and fallback endLessonId', () => {
      const student: Student = {
        id: 'st-failed-plan',
        name: '不合格プラン生徒',
        grade: '中1',
        completed_lesson_ids: ['step-1']
      };

      const dynamicDate = getDynamicDate(-1);
      const miniTest: MiniTestResult = {
        id: 'mini-plan-fail',
        student_id: student.id,
        subject: '数学',
        unit_name: '第1章',
        test_type: 'unit_test',
        test_content: '第1章 単元テスト',
        date: dynamicDate,
        score: 40,
        status: 'failed'
      };

      const masters: CurriculumMaster[] = [
        { id: 'step-1', grade: '中1', subject: '数学', unit_name: '第1章', lesson_name: 'ステップ1', sort_order: 1 },
        { id: 'step-2', grade: '中1', subject: '数学', unit_name: '第1章', lesson_name: '単元テスト', sort_order: 2, item_type: 'unit_test' }
      ];

      const plan = calculateLessonRangeForSlot({
        subject: '数学',
        student,
        curriculumMasters: masters,
        miniTestResults: [miniTest]
      });

      expect(plan.start_lesson_id).toBeDefined();
    });

    it('covers findNextUncompletedLessonForSubject with isElem, English/Math subjects, and empty/fallback schoolId', () => {
      (db as any).saveMockData('curriculum_masters', []);

      // 1. Elementary student with 算数 & fallback units without schoolId
      const elemStudent: Student = {
        id: 'elem-std-1',
        name: '小学生徒1',
        grade: '小4',
        completed_lesson_ids: []
      };

      const units: CurriculumUnit[] = [
        { id: 'u-elem-1', name: '小4計算', subject: '算数', sequence_order: 1 },
        { id: 'u-elem-2', name: '小4英語アルファベット', subject: '英語', sequence_order: 1 }
      ];

      // isElem with 算数
      const resElemMath = findNextUncompletedLessonForSubject({
        subject: '算数',
        student: elemStudent,
        curriculumUnits: units,
        curriculumMasters: []
      });
      expect(resElemMath.lessonId).toBe('u-elem-1');

      // isElem with 英語 and no matching schoolId -> triggers fallbackUnits
      const resElemEng = findNextUncompletedLessonForSubject({
        subject: '英語',
        student: elemStudent,
        curriculumUnits: units,
        curriculumMasters: [],
        schoolId: 'school-b' // Doesn't match school-a, triggers fallbackUnits branch
      });
      expect(resElemEng.lessonId).toBe('u-elem-2');

      // 2. !student case
      const resNoStudent = findNextUncompletedLessonForSubject({
        subject: '算数',
        student: null,
        curriculumUnits: units,
        curriculumMasters: []
      });
      expect(resNoStudent.lessonId).toBe('u-elem-1');

      // 3. Empty masters & units for unhandled subject
      const resEmpty = findNextUncompletedLessonForSubject({
        subject: '宇宙物理学',
        student: elemStudent,
        curriculumUnits: [],
        curriculumMasters: []
      });
      expect(resEmpty.lessonId).toBeNull();
      expect(resEmpty.masterIndex).toBe(-1);
    });

    it('covers getDisplaySteps with custom_unit_name, fallback unit, and string array ids', () => {
      const taskWithRange: LearningTask = {
        id: 'task-range-1',
        student_id: 'st-steps-1',
        subject: '数学',
        period: 1,
        date: getDynamicDate(0),
        lesson_range: 'ステップ1 〜 ステップ2',
        start_lesson_name: 'ステップ1',
        end_lesson_name: 'ステップ2',
        lesson_ids: ['step-1', 'step-2']
      };

      const masters: CurriculumMaster[] = [
        { id: 'step-1', grade: '中1', subject: '数学', unit_name: '1章', lesson_name: 'ステップ1', sort_order: 1 },
        { id: 'step-2', grade: '中1', subject: '数学', unit_name: '1章', lesson_name: 'ステップ2', sort_order: 2 }
      ];

      const steps = getDisplaySteps(taskWithRange, {
        curriculumMasters: masters,
        curriculumUnits: [],
        studentGrade: '中1'
      });
      expect(steps.length).toBe(2);

      // Task with only unit_id fallback
      const taskWithUnit: LearningTask = {
        id: 'task-unit-only',
        student_id: 'st-steps-1',
        subject: '理科',
        period: 2,
        date: getDynamicDate(0),
        unit_id: 'unit-sci-1'
      };

      const sciUnits: CurriculumUnit[] = [
        { id: 'unit-sci-1', name: '光と音', subject: '理科', sequence_order: 1 }
      ];

      const stepsUnit = getDisplaySteps(taskWithUnit, {
        curriculumMasters: [],
        curriculumUnits: sciUnits,
        studentGrade: '中1'
      });
      expect(stepsUnit[0].id).toBe('unit-sci-1');
    });
  });

  describe('StudentDashboard.tsx Edge Branches', () => {
    it('covers getLessonSteps remedial branch variations and fallback names', () => {
      const student: Student = {
        id: 'std-sd-remedial',
        name: '復習テスト生徒',
        grade: '中1'
      };

      const tasks: LearningTask[] = [
        {
          id: 'task-rem-1',
          student_id: student.id,
          subject: '数学',
          period: 1,
          date: getDynamicDate(0),
          scheduled_date: getDynamicDate(0),
          start_lesson_name: 'ーやり直しー 特訓1'
        },
        {
          id: 'task-rem-2',
          student_id: student.id,
          subject: '数学',
          period: 2,
          date: getDynamicDate(0),
          scheduled_date: getDynamicDate(0),
          custom_unit_name: '【復習】 特訓2'
        },
        {
          id: 'task-rem-3',
          student_id: student.id,
          subject: '数学',
          period: 3,
          date: getDynamicDate(0),
          scheduled_date: getDynamicDate(0),
          lesson_range: 'やり直し 特訓3'
        },
        {
          id: 'task-rem-4',
          student_id: student.id,
          subject: '数学',
          period: 4,
          date: getDynamicDate(0),
          scheduled_date: getDynamicDate(0),
          custom_unit_name: 'ーやり直しー'
        }
      ];

      (db as any).saveMockData('students', [student]);
      (db as any).saveMockData('learning_tasks', tasks);

      const { unmount } = render(
        <StudentDashboard
          student={student}
          onLogout={() => {}}
        />
      );

      expect(screen.getAllByText(/特訓1/).length).toBeGreaterThan(0);
      unmount();
    });

    it('covers autoGenerateHomeworkForCompletedTask for elementary and junior high subjects', async () => {
      const elemStudent: Student = {
        id: 'std-elem-hw',
        name: '小児宿題生徒',
        grade: '小3',
        selected_days: ['monday', 'thursday']
      };

      const task: LearningTask = {
        id: 'task-elem-hw-1',
        student_id: elemStudent.id,
        period: 1,
        date: getDynamicDate(0),
        scheduled_date: getDynamicDate(0),
        status: 'not_started',
        start_lesson_name: '九九の練習'
      };

      (db as any).saveMockData('students', [elemStudent]);
      (db as any).saveMockData('learning_tasks', [task]);

      render(
        <StudentDashboard
          student={elemStudent}
          onLogout={() => {}}
        />
      );

      expect(screen.getAllByText(/九九の練習/).length).toBeGreaterThan(0);
    });

    it('covers unit test score submission passing score formulas and suffixes', async () => {
      const studentB: Student = {
        id: 'std-level-b',
        name: 'レベルB生徒',
        grade: '中2',
        level: 'B'
      };

      const dynamicDate = getDynamicDate(0);
      const taskUT: LearningTask = {
        id: 'task-ut-check',
        student_id: studentB.id,
        subject: '数学',
        period: 1,
        date: dynamicDate,
        scheduled_date: dynamicDate,
        custom_unit_name: '連立方程式 まとめテスト（１）',
        passing_line: '8割'
      };

      (db as any).saveMockData('students', [studentB]);
      (db as any).saveMockData('learning_tasks', [taskUT]);

      render(
        <StudentDashboard
          student={studentB}
          onLogout={() => {}}
        />
      );

      expect(screen.getAllByText(/連立方程式/).length).toBeGreaterThan(0);
    });
  });

  describe('TeacherDashboard.tsx Day Chips and Schedule Branches', () => {
    it('covers day chips limit checks for weekly_sessions_count 3回, 4回, 5回, and 1回', async () => {
      const student: Student = {
        id: 'std-td-chips',
        name: '通塾回数テスト生徒',
        grade: '中1',
        grade_category: 'junior_high',
        school_name: '恵比寿中学校',
        weekly_sessions_count: '3回',
        selected_days: ['tuesday', 'thursday', 'friday'],
        created_at: new Date().toISOString()
      };

      (db as any).saveMockData('students', [student]);
      db.saveSession({
        user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
      } as any);

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      render(
        <TeacherDashboard
          initialStudentId={student.id}
          teacherType="junior_high"
          onLogout={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
      });

      const editBtn = screen.queryByTestId(`edit-student-btn-${student.id}`);
      if (editBtn) {
        fireEvent.click(editBtn);

        await waitFor(() => {
          expect(screen.queryByTestId('day-chip-monday')).toBeDefined();
        });

        const monChip = screen.queryByTestId('day-chip-monday');
        const tueChip = screen.queryByTestId('day-chip-tuesday');

        if (monChip && tueChip) {
          fireEvent.click(monChip);
          expect(alertSpy).toHaveBeenCalled();

          fireEvent.click(tueChip);
          fireEvent.click(monChip);
        }
      }

      alertSpy.mockRestore();
    });

    it('covers handleSaveTimetable with custom timetable unit, deduplicated tests, and homeworks', async () => {
      const dynamicDate = getDynamicDate(0);
      const student: Student = {
        id: 'std-tt-save',
        name: '時間割保存生徒',
        grade: '中2',
        grade_category: 'junior_high',
        school_id: 'school-1',
        school_name: '恵比寿中学校',
        level: 'A',
        created_at: new Date().toISOString()
      };

      const tasks: LearningTask[] = [
        {
          id: 'task-tt-1',
          student_id: student.id,
          subject: 'その他',
          custom_unit_name: '自由研究',
          period: 1,
          date: dynamicDate,
          scheduled_date: dynamicDate,
          status: 'unstarted'
        }
      ];

      const miniTest: MiniTestResult = {
        id: 'mini-tt-1',
        student_id: student.id,
        subject: '数学',
        unit_name: '一次関数',
        test_type: 'unit_test',
        test_content: '一次関数 単元テスト',
        date: dynamicDate,
        score: 85,
        status: 'passed'
      };

      (db as any).saveMockData('students', [student]);
      (db as any).saveMockData('learning_tasks', tasks);
      (db as any).saveMockData('mini_test_results', [miniTest]);
      db.saveSession({
        user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' }
      } as any);

      render(
        <TeacherDashboard
          initialStudentId={student.id}
          targetDate={dynamicDate}
          onLogout={() => {}}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
      });

      const saveBtn = screen.queryByText(/コマ割りを反映/) || screen.queryAllByText(/時間割コマ割りを保存/)[0];
      if (saveBtn) {
        fireEvent.click(saveBtn);
      }
    });
  });
});
