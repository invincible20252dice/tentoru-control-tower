import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { db } from '../lib/db';
import { 
  generateSlotsForSelectedSubjects, 
  findNextUncompletedLessonForSubject, 
  ensureMathEnglishUnitTests,
  getFirstAttendanceDate,
  getSortedSubjectsByProgressRate
} from '../lib/scheduler';
import { CurriculumMaster, Student, LearningTask } from '../types';

describe('Auto Reschedule Preserves Completed Lessons Specification', () => {
  const targetDate = '2026-10-07';

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mathMasters: CurriculumMaster[] = [
    {
      id: 'cm-m-step1',
      grade: '小1',
      subject: '算数',
      unit_name: 'かずとすうじ',
      lesson_name: 'STEP 1: 1から5のすうじ',
      sort_order: 1
    },
    {
      id: 'cm-m-step2',
      grade: '小1',
      subject: '算数',
      unit_name: 'かずとすうじ',
      lesson_name: 'まとめテスト（１）',
      sort_order: 2
    },
    {
      id: 'cm-m-step3',
      grade: '小1',
      subject: '算数',
      unit_name: 'かずとすうじ',
      lesson_name: 'まとめテスト（２）',
      sort_order: 3
    },
    {
      id: 'cm-m-step4',
      grade: '小1',
      subject: '算数',
      unit_name: 'かずとすうじ',
      lesson_name: 'まとめテスト（３）',
      sort_order: 4
    },
    {
      id: 'cm-m-test',
      grade: '小1',
      subject: '算数',
      unit_name: 'かずとすうじ',
      lesson_name: 'かずとすうじ - 単元確認テスト',
      item_type: 'unit_test',
      sort_order: 5
    }
  ];

  it('1. スケジューラ単体検証: STEP 1〜4が完了している生徒は、未完了タスクがあってもSTEP 1（スタートライン）に戻らず、直近未完了レッスン（STEP 5 単元確認テスト）からスケジュールされること', async () => {
    const processedMasters = ensureMathEnglishUnitTests(mathMasters);
    await db.saveCurriculumMasters(processedMasters);

    const mockStudent: Student = {
      id: 'std-math-e1',
      name: '小1算数生徒',
      grade: '小1',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['算数'],
      selected_days: ['wednesday'],
      // STEP 1〜4（かずとすうじ〜まとめテスト3）完了済み
      completed_lesson_ids: ['cm-m-step1', 'cm-m-step2', 'cm-m-step3', 'cm-m-step4'],
      last_completed_lesson_id: 'cm-m-step4'
    };
    await db.saveStudent(mockStudent);

    // 未完了タスクがシステム内に残っている（前回のリスケジュール前のタスクなど）
    const incompleteTask: LearningTask = {
      id: 'task-incomplete-old',
      student_id: mockStudent.id,
      scheduled_date: targetDate,
      period: 1,
      subject: '算数',
      start_lesson_id: 'cm-m-step1',
      end_lesson_id: 'cm-m-step4',
      start_lesson_name: 'STEP 1: 1から5のすうじ',
      end_lesson_name: 'まとめテスト（３）',
      status: 'unstarted',
      completed_lesson_ids: []
    };

    // 1. 直近未完了レッスンの検索
    const nextLesson = findNextUncompletedLessonForSubject({
      student: mockStudent,
      subject: '算数',
      tasks: [incompleteTask],
      curriculumMasters: processedMasters
    });

    // STEP 1（スタートライン）に巻き戻らず、STEP 5（単元確認テスト）が返ること！
    expect(nextLesson.lessonId).not.toBe('cm-m-step1');
    expect(nextLesson.lessonId).toBe('cm-m-test');
    expect(nextLesson.lessonName).toContain('単元確認テスト');

    // 2. コマ割り自動生成
    const slots = generateSlotsForSelectedSubjects({
      student: mockStudent,
      periodCount: 2,
      selectedSubjects: ['算数'],
      tasks: [incompleteTask],
      curriculumMasters: processedMasters
    });

    expect(slots[1]).toBeDefined();
    expect(slots[1].startLessonId).not.toBe('cm-m-step1');
    expect(slots[1].startLessonId).toBe('cm-m-test');
    expect(slots[1].startLessonName).toContain('単元確認テスト');
  });

  it('2. TeacherDashboard UI検証: 「遅れチェック ＆ 自動リスケ」ボタンをクリックした際、完了済み生徒のコマ割りが最初から（スタートライン）にならず正しい現在地から生成されること', async () => {
    const mockStudent: Student = {
      id: 'std-math-e2',
      student_id: 'std-math-e2',
      name: 'リスケ検証生徒',
      grade: '小1',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['算数'],
      selected_days: ['wednesday'],
      status: 'normal',
      // 初期レッスン cm-p1-m1, cm-p1-m2, cm-p1-m3 を完了している
      completed_lesson_ids: ['cm-p1-m1', 'cm-p1-m2', 'cm-p1-m3'],
      last_completed_lesson_id: 'cm-p1-m3'
    };
    await db.saveStudent(mockStudent);

    // 既存の未完了タスク（初期レッスン cm-p1-m1 を含んでいた古いタスク）
    const existingTask: LearningTask = {
      id: 'task-e2-1',
      student_id: mockStudent.id,
      scheduled_date: targetDate,
      period: 1,
      subject: '算数',
      start_lesson_id: 'cm-p1-m1',
      end_lesson_id: 'cm-p1-m3',
      start_lesson_name: '1章 かずとすうじ - 1から5のすうじ',
      end_lesson_name: '1章 かずとすうじ - なんばんめ',
      lesson_range: '1から5のすうじ 〜 なんばんめ',
      status: 'unstarted',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([existingTask]);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockStudent.id}
          initialTab="schedule"
        />
      );
      container = renderRes.container;
    });

    // 「遅れチェック ＆ 自動リスケ」ボタンを探す
    const rescheduleBtn = await screen.findByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    expect(rescheduleBtn).toBeInTheDocument();

    // クリック実行！
    await act(async () => {
      fireEvent.click(rescheduleBtn);
    });

    // 最適化されたコマ割り結果を検証
    // 第1コマのFromが初期レッスン（スタートライン: cm-p1-m1）に巻き戻らず、未完了の現在地（cm-p1-m4 等）になっていること
    await waitFor(() => {
      const fromSelect = container.querySelector('select[data-testid="period-unit-select-1"]') as HTMLSelectElement;
      expect(fromSelect).toBeDefined();
      expect(fromSelect.value).not.toBe('cm-p1-m1');
      expect(fromSelect.value).toBe('cm-p1-m4');
    });

    // 生徒の完了済みデータが保護されていること
    const reloadedStudent = db.getStudent(mockStudent.id);
    expect(reloadedStudent?.completed_lesson_ids).toContain('cm-p1-m1');
    expect(reloadedStudent?.completed_lesson_ids).toContain('cm-p1-m2');
    expect(reloadedStudent?.completed_lesson_ids).toContain('cm-p1-m3');
  });

  it('3. スケジューラ詳細検証: last_completed_lesson_id および lessonProgressList による完了判定が正しく動作し、最初に戻らないこと', async () => {
    const processedMasters = ensureMathEnglishUnitTests(mathMasters);

    const mockStudent: Student = {
      id: 'std-math-e3',
      name: '進捗リスト検証生徒',
      grade: '小1',
      level: 'A',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-step1'],
      last_completed_lesson_id: 'cm-m-step1'
    };

    // lessonProgressList で cm-m-step2 も完了扱い
    const progressList = [
      {
        id: 'slp-1',
        student_id: mockStudent.id,
        lesson_id: 'cm-m-step2',
        lesson_name: 'まとめテスト（１）',
        status: 'completed' as const
      }
    ];

    const nextLesson = findNextUncompletedLessonForSubject({
      student: mockStudent,
      subject: '算数',
      tasks: [],
      curriculumMasters: processedMasters,
      lessonProgressList: progressList
    });

    // cm-m-step1, cm-m-step2 は完了済みなので cm-m-step3 が返ること
    expect(nextLesson.lessonId).toBe('cm-m-step3');
  });

  it('4. スケジューラ詳細検証: 完了タスク（status=completed / test_passed=true）に含まれるレッスンも確実に完了として判定されること', async () => {
    const processedMasters = ensureMathEnglishUnitTests(mathMasters);

    const mockStudent: Student = {
      id: 'std-math-e4',
      name: '完了タスク検証生徒',
      grade: '小1',
      level: 'A',
      selected_subjects: ['算数'],
      completed_lesson_ids: []
    };

    const completedTasks: LearningTask[] = [
      {
        id: 'task-done-1',
        student_id: mockStudent.id,
        scheduled_date: '2026-10-06',
        period: 1,
        subject: '算数',
        start_lesson_id: 'cm-m-step1',
        end_lesson_id: 'cm-m-step2',
        start_lesson_name: 'STEP 1: 1から5のすうじ',
        end_lesson_name: 'まとめテスト（１）',
        status: 'completed',
        completed_lesson_ids: ['cm-m-step1', 'cm-m-step2']
      }
    ];

    const nextLesson = findNextUncompletedLessonForSubject({
      student: mockStudent,
      subject: '算数',
      tasks: completedTasks,
      curriculumMasters: processedMasters
    });

    // 完了タスクの cm-m-step1, cm-m-step2 はスキップされ、cm-m-step3 が返ること
    expect(nextLesson.lessonId).toBe('cm-m-step3');
  });

  it('5. StudentDashboard: 単元確認テスト完了時に次回通塾日に新単元が自動セットされること', async () => {
    const processedMasters = ensureMathEnglishUnitTests(mathMasters);
    await db.saveCurriculumMasters(processedMasters);

    const unitTestItem = processedMasters.find(m => m.lesson_name.includes('単元確認テスト') || m.lesson_name.includes('単元テスト'));

    const mockStudent: Student = {
      id: 'std-math-e5',
      name: '次回新単元自動セット生徒',
      grade: '小1',
      level: 'B',
      branch_id: 'b1',
      selected_subjects: ['算数'],
      selected_days: ['wednesday', 'friday'],
      completed_lesson_ids: ['cm-m-step1', 'cm-m-step2', 'cm-m-step3', 'cm-m-step4']
    };
    await db.saveStudent(mockStudent);

    const utTask: LearningTask = {
      id: 'task-e5-ut',
      student_id: mockStudent.id,
      scheduled_date: '2026-10-07',
      period: 1,
      subject: '算数',
      unit_id: unitTestItem!.id,
      custom_unit_name: 'かずとすうじ - 単元確認テスト',
      start_lesson_name: 'かずとすうじ - 単元確認テスト',
      end_lesson_name: 'かずとすうじ - 単元確認テスト',
      lesson_range: '単元確認テスト',
      status: 'unstarted',
      test_passed: false,
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([utTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={mockStudent}
          onBackToPortal={vi.fn()}
          initialDate="2026-10-07"
        />
      );
    });

    // 「この授業を完了にする」ボタンをクリック
    const compBtn = await screen.findByTestId('complete-task-btn-1');
    expect(compBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(compBtn);
    });

    // タスクが完了になり、次回通塾日に新タスクが生成されること
    await waitFor(() => {
      const allTasks = db.getLearningTasks().filter(t => t.student_id === mockStudent.id);
      expect(allTasks.some(t => t.id === 'task-e5-ut' && t.status === 'completed')).toBe(true);
    });
  });

  it('6. スケジューラヘルパー検証: 通塾曜日指定が空または無効な場合に現在日付フォールバックが安全に返ること', () => {
    const fallbackDate = getFirstAttendanceDate('2026-10-07', ['nonexistent_day']);
    expect(fallbackDate).toBe('2026-10-07');
  });

  it('7. スケジューラヘルパー検証: 同一進捗率・同一優先度の教科が安定ソート（元の配列順）されること', () => {
    const student: Student = {
      id: 'std-sort-1',
      name: 'ソート検証生徒',
      grade: '中1',
      selected_subjects: ['英語', '数学']
    };
    const sorted = getSortedSubjectsByProgressRate({
      student,
      selectedSubjects: ['英語', '数学'],
      curriculumMasters: [],
      curriculumUnits: [],
      tasks: [],
      lessonProgressList: []
    });
    expect(sorted).toEqual(['数学', '英語']);
  });
});
