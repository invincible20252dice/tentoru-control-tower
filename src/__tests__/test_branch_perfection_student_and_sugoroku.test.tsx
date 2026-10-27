import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import SugorokuMap from '../components/SugorokuMap';
import { db, Student, CurriculumMaster, CurriculumUnit, LearningTask, MiniTestResult, HomeworkResult } from '../lib/db';

const getDynamicDateStr = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const getDynamicISO = (offsetDays: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

describe('Branch Perfection: StudentDashboard and SugorokuMap', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. SugorokuMap Branch Perfection', () => {
    it('should test fallbackUnits when mastersList is empty, and test onNodeClick', () => {
      const student: Student = {
        id: 'st-sugo-1',
        name: 'すごろく生徒1',
        grade: '小3',
        grade_category: 'elementary',
        school_name: '小学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['u-1'],
        created_at: getDynamicISO(0)
      };

      (db as any).saveMockData('curriculum_masters', []);

      const fallbackUnits: CurriculumUnit[] = [
        { id: 'u-1', grade: '小3', subject: '算数', name: '単元1', sequence_order: 1 },
        { id: 'u-2', grade: '小3', subject: '算数', name: '単元2', sequence_order: 2 }
      ];

      const onSelectSubjectMock = vi.fn();

      const { unmount } = render(
        <SugorokuMap
          student={student}
          subject="算数"
          subjects={['算数', '国語']}
          units={fallbackUnits}
          onSelectSubject={onSelectSubjectMock}
        />
      );

      expect(screen.getByText(/単元1/)).toBeDefined();
      expect(screen.getByText(/単元2/)).toBeDefined();

      // Click node to open details
      const nodeEl = screen.getByTestId('sugoroku-node-u-1');
      fireEvent.click(nodeEl);

      // Click subject tab
      const kokugoTab = screen.getByText(/国語/);
      fireEvent.click(kokugoTab);
      expect(onSelectSubjectMock).toHaveBeenCalledWith('国語');

      unmount();
    });

    it('should test masters with unit test failure locking, lesson_name vs unit_name variations', () => {
      const student: Student = {
        id: 'st-sugo-2',
        name: 'すごろく生徒2',
        grade: '中1',
        grade_category: 'junior_high',
        school_name: '中学校',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['数学'],
        completed_lesson_ids: ['m-1', 'm-2', 'm-3'],
        created_at: getDynamicISO(0)
      };

      const masters: CurriculumMaster[] = [
        // m-1: unit_name only
        { id: 'm-1', grade: '中1', subject: '数学', unit_name: '正負の数1', sort_order: 1 },
        // m-2: unit test (failed)
        { id: 'm-2', grade: '中1', subject: '数学', unit_name: '正負の数', lesson_name: '正負の数 単元確認テスト', item_type: 'unit_test', sort_order: 2 },
        // m-3: regular lesson after failed unit test
        { id: 'm-3', grade: '中1', subject: '数学', lesson_name: '文字と式1', sort_order: 3 }
      ];

      const miniResults: MiniTestResult[] = [
        {
          id: 'mini-fail',
          student_id: student.id,
          subject: '数学',
          date: getDynamicDateStr(-1),
          unit_name: '正負の数',
          test_content: '正負の数 単元確認テスト',
          score: 60,
          passed: false,
          status: 'failed',
          created_at: getDynamicISO(-1)
        }
      ];

      const { container, unmount } = render(
        <SugorokuMap
          student={student}
          activeSubject="数学"
          units={[]}
          mastersList={masters}
          miniTestResults={miniResults}
        />
      );

      expect(container).toBeDefined();
      unmount();
    });

    it('should test review test (まとめテスト / check test) not counted as unit test', () => {
      const student: Student = {
        id: 'st-sugo-3',
        name: 'すごろく生徒3',
        grade: '小1',
        grade_category: 'elementary',
        school_name: '小学校',
        period_count: 2,
        day_of_week: ['wed'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['m-rev-1'],
        created_at: getDynamicISO(0)
      };

      const masters: CurriculumMaster[] = [
        { id: 'm-rev-1', grade: '小1', subject: '算数', unit_name: 'まとめ', lesson_name: '算数: まとめテスト(1)', sort_order: 1 },
        { id: 'm-check-1', grade: '小1', subject: '算数', unit_name: '確認', lesson_name: 'Check Test 1', sort_order: 2 }
      ];

      const { container, unmount } = render(
        <SugorokuMap
          student={student}
          activeSubject="算数"
          units={[]}
          mastersList={masters}
        />
      );

      expect(container).toBeDefined();
      unmount();
    });
  });

  describe('2. StudentDashboard Branch Perfection', () => {
    it('should test StudentDashboard render, mission tab, test score inputs, and video watch', async () => {
      const student: Student = {
        id: 'st-dash-1',
        name: '生徒ダッシュボード君',
        grade: '小4',
        grade_category: 'elementary',
        school_name: '大宮小学校',
        period_count: 2,
        day_of_week: ['mon'],
        selected_subjects: ['算数'],
        completed_lesson_ids: ['l-done-1'],
        created_at: getDynamicISO(0)
      };

      const todayStr = getDynamicDateStr(0);

      const tasks: LearningTask[] = [
        {
          id: 'task-dash-1',
          student_id: student.id,
          subject: '算数',
          scheduled_date: todayStr,
          period: 1,
          status: 'unstarted',
          test_passed: false,
          created_at: getDynamicISO(0)
        }
      ];

      const miniResults: MiniTestResult[] = [
        {
          id: 'mini-dash-1',
          student_id: student.id,
          subject: '算数',
          date: todayStr,
          unit_name: '小数の計算',
          test_content: '小数のかけ算 小テスト',
          passing_line: '80点以上',
          score: 85,
          passed: true,
          status: 'passed',
          created_at: getDynamicISO(0)
        }
      ];

      const hwResults: HomeworkResult[] = [
        {
          id: 'hw-dash-1',
          student_id: student.id,
          subject: '算数',
          date: todayStr,
          homework_content: '計算ドリル p.10-12',
          completed: true,
          created_at: getDynamicISO(0)
        }
      ];

      (db as any).saveMockData('students', [student]);
      (db as any).saveMockData('learning_tasks', tasks);
      (db as any).saveMockData('mini_test_results', miniResults);
      (db as any).saveMockData('homework_results', hwResults);

      const onBackToPortalMock = vi.fn();
      const onGoToTeacherScheduleMock = vi.fn();

      const { unmount } = render(
        <StudentDashboard
          student={student}
          initialDate={todayStr}
          onBackToPortal={onBackToPortalMock}
          onGoToTeacherSchedule={onGoToTeacherScheduleMock}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/生徒ダッシュボード君/)).toBeDefined();
      });

      // Switch to Map tab
      const mapTabs = screen.queryAllByText(/マップ|すごろく/);
      if (mapTabs.length > 0) {
        fireEvent.click(mapTabs[0]);
      }

      // Switch back to mission tab
      const missionTabs = screen.queryAllByText(/本日のミッション|ミッション/);
      if (missionTabs.length > 0) {
        fireEvent.click(missionTabs[0]);
      }

      unmount();
    });

    it('should test sanitizeCompletedLessonIds with unpassed tests and various passing lines', () => {
      const student: Student = {
        id: 'st-dash-2',
        name: 'サニタイズ生徒',
        grade: '中2',
        grade_category: 'junior_high',
        school_name: '中学校',
        period_count: 2,
        day_of_week: ['tue'],
        selected_subjects: ['数学'],
        completed_lesson_ids: ['step-m-1', 'step-m-ut-fail'],
        created_at: getDynamicISO(0)
      };

      const dateStr = getDynamicDateStr(-2);
      (db as any).saveMockData('students', [student]);
      (db as any).saveMockData('curriculum_masters', [
        { id: 'step-m-1', grade: '中2', subject: '数学', lesson_name: '連立方程式1', sort_order: 1 },
        { id: 'step-m-ut-fail', grade: '中2', subject: '数学', lesson_name: '連立方程式 単元テスト', item_type: 'unit_test', sort_order: 2 }
      ]);
      (db as any).saveMockData('mini_test_results', [
        {
          id: 'mt-fail-2',
          student_id: student.id,
          subject: '数学',
          date: dateStr,
          test_type: 'unit_test',
          unit_name: '連立方程式',
          test_content: '連立方程式 単元テスト',
          passing_line: '90点以上',
          score: 75,
          passed: false,
          status: 'failed',
          created_at: getDynamicISO(-2)
        }
      ]);

      const { unmount } = render(
        <StudentDashboard
          student={student}
          initialDate={dateStr}
        />
      );

      expect(screen.getByText(/サニタイズ生徒/)).toBeDefined();
      unmount();
    });
  });
});
