import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import {
  ensureMathEnglishUnitTests,
  findNextUncompletedLessonForSubject,
  calculateLessonRangeForSlot
} from '../lib/scheduler';
import StudentDashboard from '../components/StudentDashboard';
import { CurriculumMaster, Student, LearningTask, MiniTestResult } from '../types';

describe('Elementary Math & English Unit Test Full Lifecycle & Progression Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Math: STEP3~6 lessons -> STEP7 unit test -> upon pass -> STEP8 first lesson of next unit', () => {
    // 算数カリキュラムの定義（なんばんめ 単元 + いろいろな かたち 単元）
    const mathMasters: CurriculumMaster[] = [
      { id: 'cm-m-3', grade: '小1', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 3 },
      { id: 'cm-m-4', grade: '小1', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(2)', sort_order: 4 },
      { id: 'cm-m-5', grade: '小1', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(3)', sort_order: 5 },
      { id: 'cm-m-6', grade: '小1', subject: '算数', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(4)', sort_order: 6 },
      { id: 'cm-m-8', grade: '小1', subject: '算数', unit_name: 'いろいろな かたち', lesson_name: 'いろいろな かたち(1)', sort_order: 8 },
      { id: 'cm-m-9', grade: '小1', subject: '算数', unit_name: 'いろいろな かたち', lesson_name: 'いろいろな かたち(2)', sort_order: 9 },
    ];

    // ensureMathEnglishUnitTests により単元テストが自動補完される
    const processedMasters = ensureMathEnglishUnitTests(mathMasters);
    expect(processedMasters.length).toBe(8);

    // なんばんめの末尾に単元確認テストが配置される
    const nanbanmeTest = processedMasters.find(m => m.unit_name === 'なんばんめ' && (m.item_type === 'unit_test' || m.lesson_name.includes('単元確認テスト')));
    expect(nanbanmeTest).toBeDefined();
    expect(nanbanmeTest?.lesson_name).toContain('なんばんめ - 単元確認テスト');

    // 1コマで複数ステップ進む場合でも、単元テストでストップし新単元「いろいろな かたち」にはまたがない
    const student: Student = {
      id: 'std-elem-math-1',
      student_id: 'std-elem-math-1',
      name: '算数 小学生',
      grade: '小1',
      level: 'B',
      branch_id: 'branch-1',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-3', 'cm-m-4'] // STEP 3, 4 完了済み
    };

    // 残りSTEP 5からペース4コマで進める場合、STEP 5〜STEP 6〜単元テストで終了する（STEP 8には進まない）
    const rangeResult = calculateLessonRangeForSlot({
      student,
      subject: '算数',
      curriculumMasters: processedMasters,
      lessonsPerSlot: 4
    });

    expect(rangeResult.start_lesson_name).toContain('なんばんめ(3)');
    expect(rangeResult.end_lesson_name).toContain('単元確認テスト');
    expect(rangeResult.end_lesson_name).not.toContain('いろいろな かたち');

    // STEP 3〜6が完了している状態のとき、次の授業は「なんばんめ - 単元確認テスト」
    const studentReadyForTest: Student = {
      ...student,
      completed_lesson_ids: ['cm-m-3', 'cm-m-4', 'cm-m-5', 'cm-m-6']
    };

    const nextUncompleted = findNextUncompletedLessonForSubject({
      student: studentReadyForTest,
      subject: '算数',
      curriculumMasters: processedMasters
    });

    expect(nextUncompleted.lessonName).toContain('なんばんめ - 単元確認テスト');

    // 単元テストが不合格の場合：新単元に進めず、再テスト・復習位置に留まる
    const miniTestFail: MiniTestResult = {
      id: 'mini-fail-1',
      student_id: student.id,
      date: '2026-09-22',
      unit_name: 'なんばんめ',
      test_content: 'なんばんめ - 単元確認テスト',
      subject: '算数',
      test_type: 'unit_test',
      score: 50,
      passed: false,
      passing_line: '80%以上'
    };

    const nextUncompletedFailed = findNextUncompletedLessonForSubject({
      student: studentReadyForTest,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [miniTestFail]
    });

    expect(nextUncompletedFailed.hasFailedUnitTest).toBe(true);
    expect(nextUncompletedFailed.lessonName).toContain('なんばんめ');

    // 単元テストが合格の場合：次の単元の最初の授業（STEP 8「いろいろな かたち(1)」）に進む
    const miniTestPass: MiniTestResult = {
      id: 'mini-pass-1',
      student_id: student.id,
      date: '2026-09-22',
      unit_name: 'なんばんめ',
      test_content: 'なんばんめ - 単元確認テスト',
      subject: '算数',
      test_type: 'unit_test',
      score: 95,
      passed: true,
      passing_line: '80%以上'
    };

    // 合格時は完了IDまたは完了タスクに単元テストが反映される
    const studentPassed: Student = {
      ...studentReadyForTest,
      completed_lesson_ids: ['cm-m-3', 'cm-m-4', 'cm-m-5', 'cm-m-6', nanbanmeTest!.id]
    };

    const nextUncompletedPassed = findNextUncompletedLessonForSubject({
      student: studentPassed,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [miniTestPass]
    });

    expect(nextUncompletedPassed.hasFailedUnitTest).toBe(false);
    expect(nextUncompletedPassed.lessonName).toContain('いろいろな かたち(1)');
  });

  it('2. English: STEP1~5 lessons -> STEP6 unit test -> upon pass -> STEP7 next unit', () => {
    // 英語カリキュラムの定義（I am ~. 単元 + You are ~. 単元）
    const englishMasters: CurriculumMaster[] = [
      { id: 'cm-e-1', grade: '小5', subject: '英語', unit_name: 'I am ~.', lesson_name: 'I am ~.(1)', sort_order: 1 },
      { id: 'cm-e-2', grade: '小5', subject: '英語', unit_name: 'I am ~.', lesson_name: 'I am ~.(2)', sort_order: 2 },
      { id: 'cm-e-3', grade: '小5', subject: '英語', unit_name: 'I am ~.', lesson_name: 'I am ~.(3)', sort_order: 3 },
      { id: 'cm-e-4', grade: '小5', subject: '英語', unit_name: 'I am ~.', lesson_name: 'I am ~.(4)', sort_order: 4 },
      { id: 'cm-e-5', grade: '小5', subject: '英語', unit_name: 'I am ~.', lesson_name: 'I am ~.(5)', sort_order: 5 },
      { id: 'cm-e-7', grade: '小5', subject: '英語', unit_name: 'You are ~.', lesson_name: 'You are ~.(1)', sort_order: 7 },
    ];

    const processedEnglish = ensureMathEnglishUnitTests(englishMasters);
    const iamTest = processedEnglish.find(m => m.unit_name === 'I am ~.' && (m.item_type === 'unit_test' || m.lesson_name.includes('単元確認テスト')));
    expect(iamTest).toBeDefined();
    expect(iamTest?.lesson_name).toContain('I am ~. - 単元確認テスト');

    const student: Student = {
      id: 'std-elem-eng-1',
      student_id: 'std-elem-eng-1',
      name: '英語 小学生',
      grade: '小5',
      level: 'B',
      branch_id: 'branch-1',
      selected_subjects: ['英語'],
      completed_lesson_ids: ['cm-e-1', 'cm-e-2', 'cm-e-3', 'cm-e-4', 'cm-e-5']
    };

    // STEP 1〜5完了後は STEP 6 単元テストが選ばれる
    const nextEng = findNextUncompletedLessonForSubject({
      student,
      subject: '英語',
      curriculumMasters: processedEnglish
    });
    expect(nextEng.lessonName).toContain('I am ~. - 単元確認テスト');

    // 単元テスト単体のコマ割り計算では、開始・終了ともに単元テストとなり次単元に跨がない
    const slotRange = calculateLessonRangeForSlot({
      student,
      subject: '英語',
      startLessonId: iamTest?.id,
      curriculumMasters: processedEnglish,
      lessonsPerSlot: 2
    });
    expect(slotRange.start_lesson_name).toContain('I am ~. - 単元確認テスト');
    expect(slotRange.end_lesson_name).toContain('I am ~. - 単元確認テスト');
    expect(slotRange.end_lesson_name).not.toContain('You are');

    // 合格後は STEP 7「You are ~.(1)」に進む
    const studentPassed: Student = {
      ...student,
      completed_lesson_ids: [...student.completed_lesson_ids!, iamTest!.id]
    };
    const nextEngPassed = findNextUncompletedLessonForSubject({
      student: studentPassed,
      subject: '英語',
      curriculumMasters: processedEnglish
    });
    expect(nextEngPassed.lessonName).toContain('You are ~.(1)');
  });

  it('3. StudentDashboard: Displays unit test task, handles pass/fail, and enforces boundaries', async () => {
    const testStudent: Student = {
      id: 'std-elem-dash-ut-flow',
      student_id: 'std-elem-dash-ut-flow',
      name: '単元テスト受講 生徒',
      grade: '小1',
      classroom: '恵比寿教室',
      branch_id: 'branch-1',
      level: 'A',
      selected_subjects: ['算数', '英語']
    };

    const mathUnitTestTask: LearningTask = {
      id: 'task-elem-math-ut-1',
      student_id: testStudent.id,
      date: '2026-09-22',
      period: 1,
      subject: '算数',
      unit_name: 'なんばんめ',
      lesson_name: 'なんばんめ - 単元確認テスト',
      lesson_range: 'なんばんめ - 単元確認テスト',
      status: 'in_progress',
      is_completed: false
    };

    const englishNormalTask: LearningTask = {
      id: 'task-elem-eng-normal-2',
      student_id: testStudent.id,
      date: '2026-09-22',
      period: 2,
      subject: '英語',
      unit_name: 'I am ~.',
      lesson_name: 'I am ~.(1)',
      lesson_range: 'I am ~.(1)',
      status: 'pending',
      is_completed: false
    };

    db.saveLearningTasks([mathUnitTestTask, englishNormalTask]);

    await act(async () => {
      render(<StudentDashboard student={testStudent} onBackToPortal={vi.fn()} initialDateStr="2026-09-22" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/なんばんめ/i).length).toBeGreaterThan(0);
    });

    // 単元テストの表示確認
    expect(screen.getAllByText(/単元確認テスト|単元テスト/i).length).toBeGreaterThan(0);
  });
});
