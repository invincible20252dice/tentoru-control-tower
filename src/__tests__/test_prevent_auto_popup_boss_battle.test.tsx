import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { Student, LearningTask, CurriculumMaster, MiniTestResult } from '../types';

describe('Prevent Auto Popup of Boss Battle Test on Lesson Completion', () => {
  const testDate = '2026-10-10';

  beforeEach(async () => {
    localStorage.clear();
    if (typeof (db as any).clearAll === 'function') {
      (db as any).clearAll();
    }
  });

  it('never displays boss test card and does not create MiniTestResult when student completes steps or finishes lesson on normal days', async () => {
    const student: Student = {
      id: 'student-no-test-1',
      student_id: 'std_no_test',
      name: '通常授業生徒',
      grade: '小5',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小5',
      selected_subjects: ['算数', '国語'],
      attendance_days: ['火', '金'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    // Curriculum Masters for the lesson steps
    const masters: CurriculumMaster[] = [
      { id: 'cm-step-1', subject: '算数', grade: '5年生', unit_name: '小数のかけ算', lesson_name: '小数の計算(1)', sort_order: 1 },
      { id: 'cm-step-2', subject: '算数', grade: '5年生', unit_name: '小数のかけ算', lesson_name: '小数の計算(2)', sort_order: 2 },
      { id: 'cm-step-3', subject: '国語', grade: '5年生', unit_name: '説明文の読解', lesson_name: '段落の要点(1)', sort_order: 1 },
      { id: 'cm-step-4', subject: '国語', grade: '5年生', unit_name: '説明文の読解', lesson_name: '段落の要点(2)', sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    // 2 Tasks (Period 1: Math, Period 2: Japanese) - Neither has teacher-registered mini-test
    const tasks: LearningTask[] = [
      {
        id: 'task-math-p1',
        student_id: student.id,
        scheduled_date: testDate,
        period: 1,
        status: 'unstarted',
        subject: '算数',
        start_lesson_id: 'cm-step-1',
        end_lesson_id: 'cm-step-2',
        start_lesson_name: '小数の計算(1)',
        end_lesson_name: '小数の計算(2)',
        custom_unit_name: '小数のかけ算',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-jpn-p2',
        student_id: student.id,
        scheduled_date: testDate,
        period: 2,
        status: 'unstarted',
        subject: '国語',
        start_lesson_id: 'cm-step-3',
        end_lesson_id: 'cm-step-4',
        start_lesson_name: '段落の要点(1)',
        end_lesson_name: '段落の要点(2)',
        custom_unit_name: '説明文の読解',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    // Verify initially NO MiniTestResult exists for this date
    const initialMiniTests = db.getMiniTestResults().filter(r => r.student_id === student.id && r.date === testDate);
    expect(initialMiniTests.length).toBe(0);

    const { unmount } = render(
      <StudentDashboard 
        student={student} 
        onLogout={vi.fn()} 
        initialDate={testDate} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/通常授業生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // 1. Initially: Boss battle card must NOT exist
    expect(screen.queryByTestId('today-test-card')).toBeNull();
    expect(screen.queryByText(/本日のテスト（ボス戦チャレンジ）/)).toBeNull();

    // 2. Complete steps in Period 1
    const step1Btn = screen.getByTestId('step-complete-btn-1-0');
    await act(async () => {
      fireEvent.click(step1Btn);
    });

    const step2Btn = screen.getByTestId('step-complete-btn-1-1');
    await act(async () => {
      fireEvent.click(step2Btn);
    });

    // Verify Period 1 is now completed
    await waitFor(() => {
      const updatedTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date === testDate);
      const mathTask = updatedTasks.find(t => t.id === 'task-math-p1');
      expect(mathTask?.status).toBe('completed');
    });

    // Verify that NO MiniTestResult was forged or created in DB
    const miniTestsAfterP1 = db.getMiniTestResults().filter(r => r.student_id === student.id && r.date === testDate);
    expect(miniTestsAfterP1.length).toBe(0);

    // Verify Boss battle card is STILL NOT visible
    expect(screen.queryByTestId('today-test-card')).toBeNull();
    expect(screen.queryByText(/本日のテスト（ボス戦チャレンジ）/)).toBeNull();

    // 3. Complete Period 2 via "この授業を完了にする" / "このコマの全ステップを一括完了にする"
    const p2CompleteBtn = screen.getByTestId('complete-task-btn-2');
    await act(async () => {
      fireEvent.click(p2CompleteBtn);
    });

    // Wait for all tasks to be completed
    await waitFor(() => {
      const updatedTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date === testDate);
      expect(updatedTasks.every(t => t.status === 'completed')).toBe(true);
    });

    // 4. Verify completion state:
    // (a) "🎉 本日の学習予定をすべて完了しました！お疲れ様でした！" is displayed
    expect(screen.getByText(/🎉 本日の学習予定をすべて完了しました！お疲れ様でした！/)).toBeInTheDocument();

    // (b) "本日のテスト（ボス戦チャレンジ）" card MUST NOT be visible!
    expect(screen.queryByTestId('today-test-card')).toBeNull();
    expect(screen.queryByText(/本日のテスト（ボス戦チャレンジ）/)).toBeNull();

    // (c) No mini test result was automatically created in DB
    const miniTestsAtEnd = db.getMiniTestResults().filter(r => r.student_id === student.id && r.date === testDate);
    expect(miniTestsAtEnd.length).toBe(0);

    unmount();
  });

  it('displays boss test card only when teacher explicitly registered a test record', async () => {
    const student: Student = {
      id: 'student-with-test-1',
      student_id: 'std_with_test',
      name: 'テスト登録あり生徒',
      grade: '小5',
      status: 'normal',
      period_count: 1,
      registered_year: 2026,
      registered_grade: '小5',
      selected_subjects: ['算数'],
      attendance_days: ['火'],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    // Teacher explicitly registered a test record
    const teacherRegisteredMiniTest: MiniTestResult = {
      id: 'mini-teacher-reg-1',
      student_id: student.id,
      date: testDate,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '小数のかけ算',
      test_content: '算数: 小数のかけ算 - 単元確認テスト',
      score: null,
      passed: null,
      status: 'unstarted',
      passing_line: '80%以上',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(teacherRegisteredMiniTest);

    const tasks: LearningTask[] = [
      {
        id: 'task-with-test-p1',
        student_id: student.id,
        scheduled_date: testDate,
        period: 1,
        status: 'unstarted',
        subject: '算数',
        custom_unit_name: '小数のかけ算',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const { unmount } = render(
      <StudentDashboard 
        student={student} 
        onLogout={vi.fn()} 
        initialDate={testDate} 
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/テスト登録あり生徒 さんの学習画面/)).toBeInTheDocument();
    });

    // Because teacher explicitly registered the test, the boss test card SHOULD be displayed
    expect(screen.getByTestId('today-test-card')).toBeInTheDocument();
    expect(screen.getByText(/本日のテスト（ボス戦チャレンジ）/)).toBeInTheDocument();

    unmount();
  });
});
