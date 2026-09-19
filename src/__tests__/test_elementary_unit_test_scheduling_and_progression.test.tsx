import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, CurriculumMaster, LearningTask } from '../lib/db';
import { calculateLessonRangeForSlot, findNextUncompletedLessonForSubject } from '../lib/scheduler';

describe('Elementary Unit Test Scheduling & Progression Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力');
  });

  it('correctly schedules unit tests at the end of units and stops crossing into next units for math and english', () => {
    const mathMasters: CurriculumMaster[] = [
      // 単元1: なんばんめ (4レッスン + 単元テスト)
      { id: 'cm-nb-1', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 1 },
      { id: 'cm-nb-2', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(2)', sort_order: 2 },
      { id: 'cm-nb-3', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(3)', sort_order: 3 },
      { id: 'cm-nb-4', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(4)', sort_order: 4 },
      // 単元2: いろいろな かたち
      { id: 'cm-katachi-1', grade: '1年生', subject: '算数', unit_name: 'いろいろな かたち', lesson_name: 'いろいろな かたち', sort_order: 5 }
    ];

    const student: Student = {
      id: 'std-elem-ut-1',
      student_id: 'S_ELEM_01',
      name: '小学生 単元テスト確認太郎',
      grade: '小1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小1',
      selected_subjects: ['算数', '英語'],
      completed_lesson_ids: ['cm-nb-1', 'cm-nb-2', 'cm-nb-3'] // なんばんめ(1)〜(3)まで完了
    };

    // 1. なんばんめ(4)からペース2でコマ割り計算した場合
    // ensureMathEnglishUnitTests により「なんばんめ - 単元確認テスト」が生成されているため、
    // なんばんめ(4)の次は「なんばんめ - 単元確認テスト」となり、新単元「いろいろな かたち」にはまたがない！
    const slotRange = calculateLessonRangeForSlot({
      subject: '算数',
      student,
      curriculumMasters: mathMasters,
      lessonsPerSlot: 2
    });

    expect(slotRange.start_lesson_name).toContain('なんばんめ(4)');
    expect(slotRange.end_lesson_name).toContain('単元確認テスト');
    expect(slotRange.end_lesson_name).not.toContain('いろいろな かたち');

    // 2. 「なんばんめ - 単元確認テスト」が完了していない間は、次未完了レッスンが「なんばんめ - 単元確認テスト」
    student.completed_lesson_ids = ['cm-nb-1', 'cm-nb-2', 'cm-nb-3', 'cm-nb-4'];
    const nextBeforeUnitTest = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: mathMasters
    });
    expect(nextBeforeUnitTest.lessonName).toContain('単元確認テスト');

    // 3. 単元テストが完了したら、次の単元の一番最初の授業（From: 新単元 STEP 1）になる
    student.completed_lesson_ids = ['cm-nb-1', 'cm-nb-2', 'cm-nb-3', 'cm-nb-4', nextBeforeUnitTest.lessonId!];
    const nextAfterUnitTest = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: mathMasters
    });
    expect(nextAfterUnitTest.lessonName).toContain('いろいろな かたち');
  });

  it('renders unit tests properly in StudentDashboard task step cards and handles completion', async () => {
    const student: Student = {
      id: 'std-elem-dash-ut',
      student_id: 'S_ELEM_02',
      name: '時間割 太郎',
      grade: '小1',
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '小1',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-nb-1', 'cm-nb-2', 'cm-nb-3']
    };
    await db.saveStudent(student);

    const mathMasters: CurriculumMaster[] = [
      { id: 'cm-nb-1', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 1 },
      { id: 'cm-nb-2', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(2)', sort_order: 2 },
      { id: 'cm-nb-3', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(3)', sort_order: 3 },
      { id: 'cm-nb-4', grade: '1年生', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(4)', sort_order: 4 },
      { id: 'cm-katachi-1', grade: '1年生', subject: '算数', unit_name: 'いろいろな かたち', lesson_name: 'いろいろな かたち', sort_order: 5 }
    ];
    await db.saveCurriculumMasters(mathMasters);

    const slotRange = calculateLessonRangeForSlot({
      subject: '算数',
      student,
      curriculumMasters: mathMasters,
      lessonsPerSlot: 2
    });

    const task: LearningTask = {
      id: 'task-elem-nb-4-ut',
      student_id: student.id,
      unit_id: slotRange.start_lesson_id || 'cm-nb-4',
      scheduled_date: '2026-09-19',
      period: 1,
      status: 'unstarted',
      subject: '算数',
      custom_unit_name: slotRange.lesson_range || 'なんばんめ(4) 〜 なんばんめ - 単元確認テスト',
      start_lesson_id: slotRange.start_lesson_id || undefined,
      end_lesson_id: slotRange.end_lesson_id || undefined,
      start_lesson_name: slotRange.start_lesson_name || undefined,
      end_lesson_name: slotRange.end_lesson_name || undefined,
      lesson_range: slotRange.lesson_range || undefined,
      completed_lesson_ids: [],
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    render(<StudentDashboard student={student} onLogout={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/さんの学習画面/)).toBeInTheDocument();
    });

    // Verify STEP 1: なんばんめ(4) and STEP 2: 単元確認テスト are both present in step cards
    await waitFor(() => {
      const step1Card = screen.getByTestId('step-card-1-0');
      const step2Card = screen.getByTestId('step-card-1-1');
      expect(step1Card).toHaveTextContent('STEP 1:');
      expect(step1Card).toHaveTextContent('なんばんめ(4)');
      expect(step2Card).toHaveTextContent('STEP 2:');
      expect(step2Card).toHaveTextContent('単元確認テスト');

      // Verify progress count shows 0 / 2
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 2 完了');

      // Ensure 'いろいろな かたち' is NOT in this slot
      expect(step1Card).not.toHaveTextContent('いろいろな かたち');
      expect(step2Card).not.toHaveTextContent('いろいろな かたち');
    });

    // Complete STEP 1
    const completeBtn1 = screen.getByTestId('step-complete-btn-1-0');
    fireEvent.click(completeBtn1);

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('1 / 2 完了');
      expect(screen.getByTestId('step-done-badge-1-0')).toBeInTheDocument();
    });

    // Complete STEP 2 (単元確認テスト)
    const completeBtn2 = screen.getByTestId('step-complete-btn-1-1');
    fireEvent.click(completeBtn2);

    await waitFor(() => {
      expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('2 / 2 完了');
      expect(screen.getByTestId('step-done-badge-1-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });
  });
});
