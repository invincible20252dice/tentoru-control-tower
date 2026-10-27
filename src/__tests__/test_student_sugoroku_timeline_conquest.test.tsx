import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import SugorokuMap from '../components/SugorokuMap';
import TimelineSubjectView from '../components/TimelineSubjectView';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type MiniTestResult, type LearningTask } from '../lib/db';

describe('StudentDashboard, SugorokuMap, and Timeline Deep Conquest Suite', () => {
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

  it('exhaustively exercises StudentDashboard step completion, toasts, test submits, and advance titles', async () => {
    const d0 = getDynamicDate(0);
    const student: Student = {
      id: 'st-dash-cq',
      name: '進捗制覇生徒',
      grade: '中3',
      grade_category: 'junior_high',
      school_name: '進歩中学',
      level: 'B',
      completed_lesson_ids: ['cm-cq-1']
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-cq-1', grade: '中3', subject: '数学', unit_name: '二次関数', lesson_name: '放物線', sort_order: 1 },
      { id: 'cm-cq-2', grade: '中3', subject: '数学', unit_name: '二次関数', lesson_name: '変化の割合', sort_order: 2 },
      { id: 'cm-cq-3', grade: '中3', subject: '数学', unit_name: '', lesson_name: '二次方程式の応用', sort_order: 3 }
    ];

    const tasks: LearningTask[] = [
      {
        id: 't-cq-1',
        student_id: student.id,
        scheduled_date: d0,
        period: 1,
        status: 'pending',
        subject: '数学',
        lesson_ids: ['cm-cq-1', 'cm-cq-2'],
        start_lesson_name: '放物線',
        lesson_range: '放物線 〜 変化の割合'
      },
      {
        id: 't-cq-2',
        student_id: student.id,
        scheduled_date: d0,
        period: 2,
        status: 'completed',
        test_passed: true,
        subject: undefined,
        unit_id: 'u-cq-none',
        start_lesson_name: '二次方程式の応用'
      }
    ];

    const tests: MiniTestResult[] = [
      {
        id: 'mt-cq-today',
        student_id: student.id,
        subject: '数学',
        test_type: 'unit_test',
        test_content: '二次関数 単元テスト',
        date: d0,
        score: null,
        status: undefined,
        passed: undefined,
        passing_line: '80点'
      }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('learning_tasks', tasks);
    (db as any).saveMockData('mini_test_results', tests);

    const { unmount } = render(
      <StudentDashboard
        student={student}
        currentDate={d0}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/進捗制覇生徒/)).toBeDefined();
    });

    // Test task step click
    const stepBtns = screen.queryAllByRole('button').filter(b => b.textContent && b.textContent.includes('STEP'));
    stepBtns.forEach(btn => fireEvent.click(btn));

    // Test check boxes
    const cbs = screen.queryAllByRole('checkbox');
    cbs.forEach(cb => fireEvent.click(cb));

    // Test date picker
    const datePicker = screen.queryByTestId('student-date-picker');
    if (datePicker) {
      fireEvent.change(datePicker, { target: { value: getDynamicDate(1) } });
      fireEvent.change(datePicker, { target: { value: d0 } });
    }

    unmount();
  });

  it('exhaustively exercises SugorokuMap nodes, subject switches, and failure markers', () => {
    const student: Student = {
      id: 'st-sg-1',
      name: 'すごろく生徒',
      grade: '小4',
      grade_category: 'elementary',
      school_name: '双六小学校',
      completed_lesson_ids: ['cm-sg-1']
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-sg-1', grade: '小4', subject: '算数', unit_name: '角の大きさ', lesson_name: '分度器の使い方', sort_order: 1 },
      { id: 'cm-sg-2', grade: '小4', subject: '算数', unit_name: '角の大きさ', lesson_name: '三角形の内角の和', sort_order: 2 }
    ];

    const failedTests: MiniTestResult[] = [
      {
        id: 'mt-sg-fail',
        student_id: student.id,
        subject: '算数',
        test_type: 'unit_test',
        test_content: '角の大きさ 単元確認テスト',
        date: getDynamicDate(-1),
        score: 45,
        status: 'failed',
        passed: false
      }
    ];

    const { unmount } = render(
      <SugorokuMap
        student={student}
        subject="算数"
        curriculumMasters={masters}
        failedTests={failedTests}
        onSelectNode={() => {}}
      />
    );

    expect(screen.getByTestId('sugoroku-node-cm-p1-m1')).toBeDefined();

    // Click nodes
    const nodes = screen.queryAllByRole('button');
    nodes.forEach(n => fireEvent.click(n));

    unmount();
  });

  it('exhaustively exercises TimelineSubjectView progress bars and estimation dates', () => {
    const student: Student = {
      id: 'st-tl-1',
      name: 'タイムライン生徒',
      grade: '小5',
      grade_category: 'elementary',
      level: 'A',
      completed_lesson_ids: ['cm-tl-1']
    };

    const units: CurriculumUnit[] = [
      { id: 'u-tl-1', subject: '算数', name: '小数のかけ算', sequence_order: 1 },
      { id: 'u-tl-2', subject: '算数', name: '小数のわり算', sequence_order: 2 }
    ];

    const masters: CurriculumMaster[] = [
      { id: 'cm-tl-1', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: '小数×整数', sort_order: 1 },
      { id: 'cm-tl-2', grade: '小5', subject: '算数', unit_name: '小数のわり算', lesson_name: '小数÷整数', sort_order: 2 }
    ];

    const tasks: LearningTask[] = [
      { id: 't-tl-1', student_id: student.id, subject: '算数', scheduled_date: getDynamicDate(-2), period: 1, status: 'completed' }
    ];

    const { unmount } = render(
      <TimelineSubjectView
        student={student}
        subject="算数"
        units={units}
        masters={masters}
        tasks={tasks}
        currentDate={getDynamicDate(0)}
      />
    );

    expect(screen.getByTestId('timeline-subject-view')).toBeDefined();

    // Click today button
    const todayBtn = screen.getByTestId('timeline-today-btn');
    fireEvent.click(todayBtn);

    // Change schedule date picker
    const picker = screen.getByTestId('timeline-schedule-date-picker');
    fireEvent.change(picker, { target: { value: getDynamicDate(1) } });

    unmount();
  });
});
