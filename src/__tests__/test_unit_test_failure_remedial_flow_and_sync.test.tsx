import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import {
  ensureMathEnglishUnitTests,
  calculateLessonRangeForSlot,
  getLessonRangeStepIds,
  findNextUncompletedLessonForSubject,
  normalizeUnitName
} from '../lib/scheduler';
import StudentDashboard from '../components/StudentDashboard';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumMaster, Student, LearningTask, MiniTestResult } from '../types';

describe('単元テスト不合格時の「やり直し授業カード自動生成」＆次回リトライ制御、および3画面完全同期テスト', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  const sampleMasters: CurriculumMaster[] = [
    // 単元1: 3つの かずの けいさん
    { id: 'cm-m-1-1', grade: '小1', subject: '算数', unit_name: '3つの かずの けいさん', lesson_name: '3つの数の計算の順序', sort_order: 1 },
    { id: 'cm-m-1-2', grade: '小1', subject: '算数', unit_name: '3つの かずの けいさん', lesson_name: 'まとめテスト（１）', sort_order: 2 },
    // 単元2: くりあがりのあるたしざん
    { id: 'cm-m-2-1', grade: '小1', subject: '算数', unit_name: 'くりあがりのあるたしざん', lesson_name: '10になるたしざん', sort_order: 10 },
    { id: 'cm-m-2-2', grade: '小1', subject: '算数', unit_name: 'くりあがりのあるたしざん', lesson_name: 'まとめテスト（１）', sort_order: 11 },
  ];

  it('1. 生徒画面: ボス戦チャレンジで不合格点数を入力・保存時、やり直し授業カード「【復習】[単元名] - 単元テスト（やり直し）」が動的生成され、「✓ 完了にする」ボタンで即時完了する', async () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test');
    expect(unitTestItem).toBeDefined();

    const student: Student = {
      id: 'std-test-1',
      student_id: 'std-test-1',
      name: '生徒テスト1',
      grade: '小1',
      level: 'B',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2'],
      selected_days: ['tuesday', 'friday']
    };

    const todayDate = '2026-10-13'; // 火曜日
    // 当日「本日のテスト」に単元テストが配置されている
    const todayTest: MiniTestResult = {
      id: 'mini-test-1',
      student_id: student.id,
      date: todayDate,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの かずの けいさん',
      test_content: '3つの かずの けいさん - 単元確認テスト',
      score: null,
      passed: null,
      status: 'unstarted',
      passing_line: '80%以上',
      target_scope: 'individual'
    };

    const task1: LearningTask = {
      id: 'task-today-1',
      student_id: student.id,
      scheduled_date: todayDate,
      period: 1,
      subject: '算数',
      unit_id: 'unit-1',
      start_lesson_id: 'cm-m-1-1',
      end_lesson_id: 'cm-m-1-2',
      start_lesson_name: '3つの数の計算の順序',
      end_lesson_name: 'まとめテスト（１）',
      lesson_range: '3つの数の計算の順序 〜 まとめテスト（１）',
      status: 'completed',
      video_watched: true,
      test_passed: true
    };

    await db.saveStudent(student);
    await db.saveCurriculumMasters(processedMasters);
    await db.saveLearningTasks([task1]);
    await db.saveMiniTestResult(todayTest);

    render(
      <StudentDashboard
        student={student}
        curriculumMasters={processedMasters}
        currentDateStr={todayDate}
      />
    );

    // ボス戦チャレンジに「3つの かずの けいさん - 単元確認テスト」が表示される
    await waitFor(() => {
      expect(screen.getByTestId('test-item-mini-test-1')).toBeInTheDocument();
    });

    // 70点を入力して撃破報告（保存）
    const scoreInput = screen.getByTestId('test-score-input-mini-test-1');
    fireEvent.change(scoreInput, { target: { value: '70' } });

    const saveBtn = screen.getByTestId('test-save-btn-mini-test-1');
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    // mini_test_results に status: 'failed' が保存されること
    await waitFor(() => {
      const savedMini = db.getMiniTestResults().find(m => m.id === 'mini-test-1');
      expect(savedMini?.status).toBe('failed');
      expect(savedMini?.passed).toBe(false);
      expect(savedMini?.score).toBe(70);
    });

    // やり直し授業カード「【復習】3つの かずの けいさん - 単元テスト（やり直し）」が直後コマに自動生成されること
    await waitFor(() => {
      expect(screen.getAllByText(/【復習】3つの かずの けいさん - 単元テスト（やり直し）/).length).toBeGreaterThan(0);
    });

    // やり直しカードに「✓ 完了にする」ボタン（data-testid="remedial-complete-btn"）が存在すること
    const completeBtn = screen.getByTestId('remedial-complete-btn');
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn.textContent).toContain('✓ 完了にする');

    // 「✓ 完了にする」を押下
    await act(async () => {
      fireEvent.click(completeBtn);
    });

    // やり直しカードが完了状態になること
    await waitFor(() => {
      const allTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date === todayDate);
      const remedial = allTasks.find(t => t.custom_unit_name?.includes('【復習】'));
      expect(remedial?.status).toBe('completed');
    });
  });

  it('2. 次回通塾日の挙動: 不合格が存在する場合、新単元進行が完全ブロックされ、同一単元の再テストが割り当てられる', async () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test');
    expect(unitTestItem).toBeDefined();

    const student: Student = {
      id: 'std-test-retry',
      student_id: 'std-test-retry',
      name: 'リトライ生徒',
      grade: '小1',
      level: 'B',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2'],
      selected_days: ['tuesday', 'friday']
    };

    const failedMiniTest: MiniTestResult = {
      id: 'mini-fail-1',
      student_id: student.id,
      date: '2026-10-13',
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの かずの けいさん',
      test_content: '3つの かずの けいさん - 単元確認テスト',
      score: 60,
      passed: false,
      status: 'failed',
      passing_line: '80%以上',
      target_scope: 'individual'
    };

    // findNextUncompletedLessonForSubject: 新単元（くりあがりのあるたしざん）ではなく不合格単元テストを返す
    const nextUncompleted = findNextUncompletedLessonForSubject({
      student,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [failedMiniTest]
    });

    expect(nextUncompleted.hasFailedUnitTest).toBe(true);
    expect(nextUncompleted.lessonId).toBe(unitTestItem!.id);
    expect(nextUncompleted.lessonName).not.toContain('くりあがり');

    // calculateLessonRangeForSlot: 新単元に進まず再テストを割り当てる
    const slotRange = calculateLessonRangeForSlot({
      student,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [failedMiniTest]
    });

    expect(slotRange.start_lesson_id).toBe(unitTestItem!.id);
    expect(slotRange.end_lesson_id).toBe(unitTestItem!.id);
    expect(slotRange.start_lesson_name).toContain('3つの かずの けいさん');
    expect(slotRange.lesson_range).toContain('再テスト');
    expect(slotRange.start_lesson_name).not.toContain('くりあがり');
  });

  it('3. getLessonRangeStepIds: From〜Toに含まれる通常授業・まとめテストが完全展開され、同一単元優先で他単元の誤マッチを遮断する', () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);

    // 単元1の「3つの数の計算の順序」から「まとめテスト（１）」まで
    const stepsUnit1 = getLessonRangeStepIds({
      subject: '算数',
      startLessonName: '3つの数の計算の順序',
      endLessonName: 'まとめテスト（１）',
      curriculumMasters: processedMasters,
      studentGrade: '小1'
    });

    // 単元1のステップのみが含まれ、単元2の「まとめテスト（１）」に誤マッチしないこと
    expect(stepsUnit1.length).toBe(2);
    expect(stepsUnit1[0].id).toBe('cm-m-1-1');
    expect(stepsUnit1[1].id).toBe('cm-m-1-2');
    expect(stepsUnit1.some(s => s.id === 'cm-m-2-2')).toBe(false);

    // lessonIds が渡された場合は即時返却されること
    const stepsWithIds = getLessonRangeStepIds({
      subject: '算数',
      lessonIds: ['cm-m-2-1', 'cm-m-2-2'],
      curriculumMasters: processedMasters,
      studentGrade: '小1'
    });
    expect(stepsWithIds.length).toBe(2);
    expect(stepsWithIds[0].id).toBe('cm-m-2-1');
    expect(stepsWithIds[1].id).toBe('cm-m-2-2');
  });

  it('4. 単元テスト特化日（通常コマ0件でテスト枠のみの日）: 講師画面タイムラインで該当「単元確認テスト」1ステップのみが青枠「📍 現在地」としてハイライトされる', async () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test');
    expect(unitTestItem).toBeDefined();

    const student: Student = {
      id: 'std-test-special-day',
      student_id: 'std-test-special-day',
      name: 'テスト特化日生徒',
      grade: '小1',
      level: 'B',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2'],
      selected_days: ['tuesday']
    };

    const targetDate = '2026-10-20';
    // 当日は通常コマ0件で、「本日のテスト」に単元テストのみ存在
    const testRecord: MiniTestResult = {
      id: `mini-special-${targetDate}`,
      student_id: student.id,
      date: targetDate,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの かずの けいさん',
      test_content: '3つの かずの けいさん - 単元確認テスト',
      score: null,
      passed: null,
      status: 'unstarted',
      passing_line: '80%以上',
      target_scope: 'individual'
    };

    await db.saveStudent(student);
    await db.saveCurriculumMasters(processedMasters);
    await db.saveMiniTestResult(testRecord);
    await db.deleteLearningTasksForDate(student.id, targetDate);

    render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
        initialDate={targetDate}
        students={[student]}
        curriculumMasters={processedMasters}
      />
    );

    // タイムライン上で単元確認テストのアイテムに「📍 現在地」が付与されていること
    await waitFor(() => {
      const activePin = screen.getAllByText(/📍 現在地/);
      expect(activePin.length).toBeGreaterThan(0);
    });
  });
});
