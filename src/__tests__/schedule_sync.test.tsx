import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { db, Student, LearningTask, MiniTestResult, HomeworkResult } from '../lib/db';
import StudentDashboard from '../components/StudentDashboard';

describe('Schedule and Timetable Synchronization Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('db.saveLearningTasks and db.fetchLearningTasks sync properly with localStorage and memory', async () => {
    const studentId = 'test-st-1';
    const date = '2026-08-18';
    const tasks: LearningTask[] = [
      {
        id: 't-1',
        student_id: studentId,
        unit_id: 'u-1',
        scheduled_date: date,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        lesson_range: '正負の数 第1講 〜 第3講',
        start_lesson_name: '正負の数 第1講',
        end_lesson_name: '正負の数 第3講',
        office_note: '計算ドリルP12-14も実施すること',
        created_at: new Date().toISOString()
      },
      {
        id: 't-2',
        student_id: studentId,
        unit_id: 'u-2',
        scheduled_date: date,
        period: 2,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '英語',
        custom_unit_name: '一般動詞の過去形 まとめ',
        office_note: '単語テスト準備',
        created_at: new Date().toISOString()
      }
    ];

    await db.saveLearningTasks(tasks);

    const fetched = await db.fetchLearningTasks(studentId, date);
    expect(fetched.length).toBe(2);
    expect(fetched[0].lesson_range).toBe('正負の数 第1講 〜 第3講');
    expect(fetched[0].office_note).toBe('計算ドリルP12-14も実施すること');
    expect(fetched[1].custom_unit_name).toBe('一般動詞の過去形 まとめ');
  });

  test('StudentDashboard displays teacher scheduled tasks on specified date', async () => {
    const student: Student = {
      id: 'st-schedule-test',
      student_id: 'ST0099',
      name: 'スケジュール同期確認生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const targetDate = '2026-08-18';
    const tasks: LearningTask[] = [
      {
        id: 'task-sync-1',
        student_id: student.id,
        unit_id: 'unit-math-1',
        scheduled_date: targetDate,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '数学',
        lesson_range: '連立方程式の解き方 第1講 〜 第2講',
        office_note: '途中式を丁寧にノートへ記入',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    const miniTest: MiniTestResult = {
      id: 'test-sync-1',
      student_id: student.id,
      date: targetDate,
      test_content: '連立方程式 計算小テスト (全10問)',
      score: null,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(miniTest);

    const homework: HomeworkResult = {
      id: 'hw-sync-1',
      student_id: student.id,
      date: targetDate,
      homework_content: 'ワークブック P45〜P47',
      homework_deadline: '2026-08-20',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(homework);

    render(
      <StudentDashboard
        student={student}
        initialDate={targetDate}
      />
    );

    // Wait for data load
    await waitFor(() => {
      expect(screen.getByText('連立方程式の解き方 第1講 〜 第2講')).toBeInTheDocument();
    });

    expect(screen.getAllByText('数学').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/途中式を丁寧にノートへ記入/).length).toBeGreaterThan(0);
    expect(screen.getByText('連立方程式 計算小テスト (全10問)')).toBeInTheDocument();
    expect(screen.getByText('ワークブック P45〜P47')).toBeInTheDocument();
    expect(screen.getByText(/提出期限: 2026-08-20/)).toBeInTheDocument();
  });

  test('StudentDashboard auto-detects latest schedule date if today has no tasks', async () => {
    const student: Student = {
      id: 'st-autodate-test',
      student_id: 'ST0100',
      name: '自動日付検出生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    // Save schedule on a non-today date
    const futureDate = '2026-09-01';
    const tasks: LearningTask[] = [
      {
        id: 'task-future-1',
        student_id: student.id,
        unit_id: 'unit-eng-1',
        scheduled_date: futureDate,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '英語',
        custom_unit_name: '関係代名詞 主格',
        office_note: '例文暗記テスト実施予定',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    render(
      <StudentDashboard
        student={student}
      />
    );

    // Should automatically navigate or find the closest schedule date
    await waitFor(() => {
      expect(screen.getByText('関係代名詞 主格')).toBeInTheDocument();
    });

    expect(screen.getByText(/本日はコマ割りがありません。直近の通塾予定日/)).toBeInTheDocument();
    expect(screen.getAllByText(/例文暗記テスト実施予定/).length).toBeGreaterThan(0);
  });

  test('Date picker switching works dynamically in StudentDashboard', async () => {
    const student: Student = {
      id: 'st-picker-test',
      student_id: 'ST0101',
      name: '日付切替確認生徒',
      grade: '中1',
      status: 'normal',
      branch_id: 'b-1',
      created_at: new Date().toISOString()
    };
    db.saveStudent(student);

    const dateA = '2026-08-18';
    const dateB = '2026-08-20';

    await db.saveLearningTasks([
      {
        id: 'task-a',
        student_id: student.id,
        unit_id: 'u-a',
        scheduled_date: dateA,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '理科',
        custom_unit_name: '光の反射と屈折',
        created_at: new Date().toISOString()
      },
      {
        id: 'task-b',
        student_id: student.id,
        unit_id: 'u-b',
        scheduled_date: dateB,
        period: 1,
        status: 'unstarted',
        video_watched: false,
        test_passed: false,
        subject: '社会',
        custom_unit_name: '古代文明の起こり',
        created_at: new Date().toISOString()
      }
    ]);

    render(
      <StudentDashboard
        student={student}
        initialDate={dateA}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('光の反射と屈折')).toBeInTheDocument();
    });

    // Switch date with date picker
    const datePicker = screen.getByTestId('student-date-picker');
    fireEvent.change(datePicker, { target: { value: dateB } });

    await waitFor(() => {
      expect(screen.getByText('古代文明の起こり')).toBeInTheDocument();
    });
  });
});
