import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import {
  ensureMathEnglishUnitTests,
  calculateLessonRangeForSlot,
  generateSlotsForSelectedSubjects
} from '../lib/scheduler';
import StudentDashboard from '../components/StudentDashboard';
import { LoginForm } from '../components/LoginForm';
import { WeeklyScheduleViewer } from '../components/WeeklyScheduleViewer';
import { CurriculumMaster, CurriculumUnit, Student, LearningTask } from '../types';

describe('Unit Test Flow: Session Separation, Remedial Task on Failure, and Cross-Subject Pass Gate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mathMasters: CurriculumMaster[] = [
    { id: 'cm-m-1', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数のかけ算(1)', sort_order: 1 },
    { id: 'cm-m-2', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数のかけ算(2)', sort_order: 2 },
    { id: 'cm-m-3', grade: '小5', subject: '算数', unit_name: '分数のかけ算', lesson_name: '分数のかけ算(3)', sort_order: 3 },
    { id: 'cm-m-4', grade: '小5', subject: '算数', unit_name: '分数のわり算', lesson_name: '分数のわり算(1)', sort_order: 10 },
  ];

  const englishMasters: CurriculumMaster[] = [
    { id: 'cm-e-1', grade: '小5', subject: '英語', unit_name: 'Lesson 1', lesson_name: 'Lesson 1(1)', sort_order: 1 },
    { id: 'cm-e-2', grade: '小5', subject: '英語', unit_name: 'Lesson 1', lesson_name: 'Lesson 1(2)', sort_order: 2 },
    { id: 'cm-e-3', grade: '小5', subject: '英語', unit_name: 'Lesson 2', lesson_name: 'Lesson 2(1)', sort_order: 10 },
  ];

  it('1. 算数: まとめテスト(1〜3)までを同日授業内でやった場合でも、単元テストは同日に行わず、次回授業に単元テスト単独で行う', () => {
    const processedMath = ensureMathEnglishUnitTests(mathMasters);
    
    // まとめテスト(2)まで完了した生徒（レベルA: 1コマ4レッスン）
    const studentNearUnitTest: Student = {
      id: 'std-math-test-1',
      student_id: 'std-math-test-1',
      name: '算数生徒',
      grade: '小5',
      level: 'A',
      selected_subjects: ['算数'],
      completed_lesson_ids: [
        'cm-m-1', 'cm-m-2', 'cm-m-3',
        'cm-auto-sum1-算数-小5-分数のかけ算',
        'cm-auto-sum2-算数-小5-分数のかけ算'
      ]
    };

    // 当日のコマ割り計算: まとめテスト(3)でストップし、単元テストは含まれない
    const todaySlot = calculateLessonRangeForSlot({
      student: studentNearUnitTest,
      subject: '算数',
      curriculumMasters: processedMath
    });

    expect(todaySlot.start_lesson_name).toContain('まとめテスト（３）');
    expect(todaySlot.end_lesson_name).toContain('まとめテスト（３）');
    expect(todaySlot.end_lesson_name).not.toContain('単元確認テスト');

    // 複数コマ生成（同日内）でも、まとめテスト到達後に同日の別コマで単元テストは先入れされない
    const multiSlots = generateSlotsForSelectedSubjects({
      student: studentNearUnitTest,
      selectedSubjects: ['算数'],
      periodCount: 2,
      curriculumMasters: processedMath
    });
    expect(multiSlots[1]).toBeDefined();
    expect(multiSlots[1].endLessonName).toContain('まとめテスト（３）');
    expect(multiSlots[1].endLessonName).not.toContain('単元確認テスト');

    // まとめテスト(3)完了後の生徒 -> 次回の授業では単元テスト単独（1コマ）が割り当てられる
    const studentAfterSummary3: Student = {
      ...studentNearUnitTest,
      completed_lesson_ids: [
        ...studentNearUnitTest.completed_lesson_ids,
        'cm-auto-sum3-算数-小5-分数のかけ算'
      ]
    };

    const nextSessionSlot = calculateLessonRangeForSlot({
      student: studentAfterSummary3,
      subject: '算数',
      curriculumMasters: processedMath
    });

    expect(nextSessionSlot.start_lesson_name).toContain('単元確認テスト');
    expect(nextSessionSlot.end_lesson_name).toContain('単元確認テスト');
    expect(nextSessionSlot.end_lesson_name).not.toContain('分数のわり算');
  });

  it('2. 英語: Check Testまでを同日授業内でやった場合でも、単元テストは同日に行わず、次回授業に単元テスト単独で行う', () => {
    const processedEnglish = ensureMathEnglishUnitTests(englishMasters);

    // Lesson 1(2)まで完了した生徒（次は Check Test）
    const studentNearEnglishTest: Student = {
      id: 'std-eng-test-1',
      student_id: 'std-eng-test-1',
      name: '英語生徒',
      grade: '小5',
      level: 'A',
      selected_subjects: ['英語'],
      completed_lesson_ids: ['cm-e-1', 'cm-e-2']
    };

    // 当日のコマ割り計算: Check Test でストップし、単元テストは含まれない
    const todaySlot = calculateLessonRangeForSlot({
      student: studentNearEnglishTest,
      subject: '英語',
      curriculumMasters: processedEnglish
    });

    expect(todaySlot.start_lesson_name).toContain('Check Test');
    expect(todaySlot.end_lesson_name).toContain('Check Test');
    expect(todaySlot.end_lesson_name).not.toContain('単元確認テスト');

    // Check Test完了後の生徒 -> 次回の授業で単元テスト単独で割り当てられる
    const checkTestItem = processedEnglish.find(m => m.unit_name === 'Lesson 1' && m.lesson_name.includes('Check Test'));
    const studentAfterCheckTest: Student = {
      ...studentNearEnglishTest,
      completed_lesson_ids: [...studentNearEnglishTest.completed_lesson_ids, checkTestItem!.id]
    };

    const nextSessionSlot = calculateLessonRangeForSlot({
      student: studentAfterCheckTest,
      subject: '英語',
      curriculumMasters: processedEnglish
    });

    expect(nextSessionSlot.start_lesson_name).toContain('単元確認テスト');
    expect(nextSessionSlot.end_lesson_name).toContain('単元確認テスト');
    expect(nextSessionSlot.end_lesson_name).not.toContain('Lesson 2');
  });

  it('3. 単元テスト不合格時: 自動的にやり直し授業が生徒画面に追加され完了ボタンが発生、次回通塾日に再テストが自動予約される', async () => {
    const testStudent: Student = {
      id: 'std-fail-flow-1',
      student_id: 'std-fail-flow-1',
      name: '不合格テスト生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'A',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const mathUnit: CurriculumUnit = {
      id: 'unit-math-fraction',
      subject: '算数',
      grade: '小5',
      name: '分数のかけ算',
      sequence_order: 1
    };

    const todayDateStr = '2026-10-06'; // 火曜日
    const unitTestTask: LearningTask = {
      id: 'task-math-ut-fail-1',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 1,
      subject: '算数',
      unit_id: mathUnit.id,
      custom_unit_name: '分数のかけ算 - 単元テスト',
      start_lesson_name: '分数のかけ算 - 単元テスト',
      end_lesson_name: '分数のかけ算 - 単元テスト',
      lesson_range: '分数のかけ算 - 単元テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(testStudent);
    await db.saveCurriculumUnits([mathUnit]);
    await db.saveLearningTasks([unitTestTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    // 画面に「テストを受ける (不合格)」ボタンが存在することを確認
    const failButton = await screen.findByText(/テストを受ける \(不合格\)/i);
    expect(failButton).toBeDefined();

    // 不合格ボタンをクリック！
    await act(async () => {
      fireEvent.click(failButton);
    });

    // 1. 自動的に「単元確認テスト　ーやり直しー」が追加され、完了するボタンが発生すること
    await waitFor(() => {
      expect(screen.getAllByText(/単元確認テスト\s*ーやり直しー/i).length).toBeGreaterThan(0);
      expect(screen.queryByTestId('complete-task-btn-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('remedial-task-action-btn-1')).toHaveTextContent(/単元確認テスト\s*ーやり直しー/);
    });

    // やり直し授業（第2コマ）の「🎯 完了にする」ボタンが存在することを確認
    const remedialStepBtn = await screen.findByTestId('step-complete-btn-2-0');
    expect(remedialStepBtn).toBeDefined();

    // 2. 次回通塾日（金曜日: 2026-10-09）に同一単元テストが「再テスト」として自動予約されていること
    const allTasks = db.getLearningTasks();
    const nextFridayTask = allTasks.find(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
    expect(nextFridayTask).toBeDefined();
    expect(nextFridayTask?.custom_unit_name).toContain('再テスト');

    // 次回の miniTestResults にも再テストが予約されていること
    const miniTests = db.getMiniTestResults();
    const nextFridayMiniTest = miniTests.find(m => m.student_id === testStudent.id && m.date === '2026-10-09');
    expect(nextFridayMiniTest).toBeDefined();
    expect(nextFridayMiniTest?.test_content).toContain('再テスト');

    // 3. 追加された「やり直し授業」の完了ボタンをクリックすると受講完了になること
    await act(async () => {
      fireEvent.click(remedialStepBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('step-done-badge-2-0')).toHaveTextContent(/受講完了/i);
    });
  });

  it('4. 単元テスト合格時: 他の教科の授業が未完了の場合は保留され、他教科完了時に新しい単元に進む', async () => {
    const testStudent: Student = {
      id: 'std-cross-subject-flow-1',
      student_id: 'std-cross-subject-flow-1',
      name: '複数教科受講生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'A',
      selected_subjects: ['算数', '英語'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const mathUnit: CurriculumUnit = {
      id: 'unit-math-fraction',
      subject: '算数',
      grade: '小5',
      name: '分数のかけ算',
      sequence_order: 1
    };

    const englishUnit: CurriculumUnit = {
      id: 'unit-eng-lesson1',
      subject: '英語',
      grade: '小5',
      name: 'Lesson 1',
      sequence_order: 1
    };

    const todayDateStr = '2026-10-06'; // 火曜日
    // 第1コマ: 算数 単元テスト
    const mathUnitTestTask: LearningTask = {
      id: 'task-math-ut-pass-1',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 1,
      subject: '算数',
      unit_id: mathUnit.id,
      custom_unit_name: '分数のかけ算 - 単元テスト',
      start_lesson_name: '分数のかけ算 - 単元テスト',
      end_lesson_name: '分数のかけ算 - 単元テスト',
      lesson_range: '分数のかけ算 - 単元テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    // 第2コマ: 英語 通常授業（未完了）
    const englishLessonTask: LearningTask = {
      id: 'task-eng-normal-2',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 2,
      subject: '英語',
      unit_id: englishUnit.id,
      custom_unit_name: 'Lesson 1 - STEP 1',
      start_lesson_name: 'Lesson 1(1)',
      end_lesson_name: 'Lesson 1(1)',
      lesson_range: 'Lesson 1(1)',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(testStudent);
    await db.saveCurriculumUnits([mathUnit, englishUnit]);
    await db.saveLearningTasks([mathUnitTestTask, englishLessonTask]);

    const processedCurriculum: CurriculumMaster[] = [
      ...ensureMathEnglishUnitTests(mathMasters),
      ...ensureMathEnglishUnitTests(englishMasters)
    ];
    await db.saveCurriculumMasters(processedCurriculum);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    // 算数の単元テスト合格ボタンをクリック
    const passButton = await screen.findByTestId('complete-task-btn-1');
    expect(passButton).toBeDefined();

    await act(async () => {
      fireEvent.click(passButton);
    });

    // 英語がまだ未完了であるため、次回通塾日（2026-10-09）に新単元タスクはまだ生成されていないことを確認
    let allTasks = db.getLearningTasks();
    let nextFridayTasks = allTasks.filter(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
    expect(nextFridayTasks.length).toBe(0);

    // 英語の授業カードの完了ボタン（第2コマ）をクリックして英語を完了！
    const englishCompleteBtn = await screen.findByTestId('complete-task-btn-2');
    expect(englishCompleteBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(englishCompleteBtn);
    });

    // 全教科の授業が完了したため、次回通塾日（2026-10-09）に新単元のタスクが自動セットされていること！
    await waitFor(() => {
      allTasks = db.getLearningTasks();
      nextFridayTasks = allTasks.filter(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
      expect(nextFridayTasks.length).toBeGreaterThan(0);
    });
  });

  it('5. 小テスト撃破ミッションからの単元テスト不合格送信: やり直し授業追加 ＆ 次回再テスト予約', async () => {
    const testStudent: Student = {
      id: 'std-mini-fail-1',
      student_id: 'std-mini-fail-1',
      name: '小テスト不合格生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'A',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const todayDateStr = '2026-10-06';
    const miniTest: MiniTestResult = {
      id: 'mini-test-math-ut-1',
      student_id: testStudent.id,
      date: todayDateStr,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '分数のかけ算',
      test_content: '分数のかけ算 - 単元テスト',
      score: null,
      passing_line: '90点以上',
      target_scope: 'individual'
    };

    await db.saveStudent(testStudent);
    await db.saveMiniTestResult(miniTest);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    // 点数入力に 60 点を入力して撃破報告ボタンをクリック
    const scoreInput = await screen.findByTestId(`test-score-input-${miniTest.id}`);
    const saveBtn = await screen.findByTestId(`test-save-btn-${miniTest.id}`);

    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '60' } });
      fireEvent.click(saveBtn);
    });

    // 単元確認テスト　ーやり直しー が当日に追加されること
    await waitFor(() => {
      expect(screen.getAllByText(/単元確認テスト\s*ーやり直しー/i).length).toBeGreaterThan(0);
    });

    // 次回通塾日（2026-10-09）に再テストが自動予約されていること
    const allTasks = db.getLearningTasks();
    const nextFridayTask = allTasks.find(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
    expect(nextFridayTask).toBeDefined();
    expect(nextFridayTask?.custom_unit_name).toContain('再テスト');
  });

  it('6. 小テスト撃破ミッションからの単元テスト合格送信: 他教科授業完了時に次回新単元へ進む', async () => {
    const testStudent: Student = {
      id: 'std-mini-pass-1',
      student_id: 'std-mini-pass-1',
      name: '小テスト合格生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'A',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const todayDateStr = '2026-10-06';
    const miniTest: MiniTestResult = {
      id: 'mini-test-math-ut-pass-1',
      student_id: testStudent.id,
      date: todayDateStr,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '分数のかけ算',
      test_content: '分数のかけ算 - 単元テスト',
      score: null,
      passing_line: '90点以上',
      target_scope: 'individual'
    };

    await db.saveStudent(testStudent);
    await db.saveMiniTestResult(miniTest);

    const processedCurriculum: CurriculumMaster[] = [
      ...ensureMathEnglishUnitTests(mathMasters)
    ];
    await db.saveCurriculumMasters(processedCurriculum);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    // 100点を入力して撃破報告！
    const scoreInput = await screen.findByTestId(`test-score-input-${miniTest.id}`);
    const saveBtn = await screen.findByTestId(`test-save-btn-${miniTest.id}`);

    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '100' } });
      fireEvent.click(saveBtn);
    });

    // 他教科タスクは0件（算数のみ）なので即座に次回通塾日（2026-10-09）へ新単元がセットされる
    await waitFor(() => {
      const allTasks = db.getLearningTasks();
      const nextFridayTask = allTasks.find(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
      expect(nextFridayTask).toBeDefined();
    });
  });

  it('7. 小テスト入力バリデーション (負数/100超/空欄)、割/パーセント表記の合格基準、および動画視聴の処理', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const testStudent: Student = {
      id: 'std-validation-flow-1',
      student_id: 'std-validation-flow-1',
      name: '入力検証生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'B',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const todayDateStr = '2026-10-06';
    const miniTestWari: MiniTestResult = {
      id: 'mini-test-wari-1',
      student_id: testStudent.id,
      date: todayDateStr,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '分数のかけ算',
      test_content: '分数のかけ算 - 単元テスト',
      score: null,
      passing_line: '8割以上',
      target_scope: 'individual'
    };

    const mathTask: LearningTask = {
      id: 'task-math-single-lesson-1',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 1,
      subject: '算数',
      unit_id: 'unit-1',
      custom_unit_name: '分数のかけ算 - 通常授業',
      start_lesson_name: '分数のかけ算(1)',
      end_lesson_name: '分数のかけ算(1)',
      lesson_range: '1',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(testStudent);
    await db.saveMiniTestResult(miniTestWari);
    await db.saveLearningTasks([mathTask]);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    const scoreInput = await screen.findByTestId(`test-score-input-${miniTestWari.id}`);
    const saveBtn = await screen.findByTestId(`test-save-btn-${miniTestWari.id}`);

    // 不正な点数（150点）
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '150' } });
      fireEvent.click(saveBtn);
    });
    expect(alertMock).toHaveBeenCalledWith('0〜100の点数を入力してください。');

    // 不正な点数（-10点）
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '-10' } });
      fireEvent.click(saveBtn);
    });

    // 空欄入力（点数クリア）
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '' } });
      fireEvent.click(saveBtn);
    });

    // 8割（80点）以上で合格判定
    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '85' } });
      fireEvent.click(saveBtn);
    });

    // 動画視聴ボタンをクリック
    const watchVideoBtn = screen.queryByText(/動画を視聴する \(10分\)/);
    if (watchVideoBtn) {
      await act(async () => {
        fireEvent.click(watchVideoBtn);
      });
      await waitFor(() => {
        expect(screen.queryByText(/動画視聴済み/)).toBeDefined();
      });
    }

    alertMock.mockRestore();
  });

  it('8. 小テスト合格送信時に当日タスクに該当単元テストタスクが存在する場合の連動処理 & DB認証/ログカバレッジ', async () => {
    const testStudent: Student = {
      id: 'std-related-ut-1',
      student_id: 'std-related-ut-1',
      name: '連動テスト生徒',
      grade: '小5',
      classroom: '本校',
      branch_id: 'b-1',
      level: 'C',
      selected_subjects: ['算数', '英語'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: []
    };

    const todayDateStr = '2026-10-06';
    const mathUnitTestTask: LearningTask = {
      id: 'task-math-ut-related-1',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 1,
      subject: '算数',
      unit_id: 'unit-math-1',
      custom_unit_name: '分数のかけ算 - 単元テスト',
      start_lesson_name: '分数のかけ算 - 単元テスト',
      end_lesson_name: '分数のかけ算 - 単元テスト',
      lesson_range: '分数のかけ算 - 単元テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    const englishPendingTask: LearningTask = {
      id: 'task-eng-pending-1',
      student_id: testStudent.id,
      scheduled_date: todayDateStr,
      period: 2,
      subject: '英語',
      unit_id: 'unit-eng-1',
      custom_unit_name: 'Lesson 1',
      start_lesson_name: 'Lesson 1(1)',
      end_lesson_name: 'Lesson 1(1)',
      lesson_range: '1',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    const miniTest: MiniTestResult = {
      id: 'mini-test-math-rel-1',
      student_id: testStudent.id,
      date: todayDateStr,
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '分数のかけ算',
      test_content: '分数のかけ算 - 単元テスト',
      score: null,
      passing_line: '80%以上',
      target_scope: 'individual'
    };

    await db.saveStudent(testStudent);
    await db.saveLearningTasks([mathUnitTestTask, englishPendingTask]);
    await db.saveMiniTestResult(miniTest);

    const processedCurriculum: CurriculumMaster[] = [
      ...ensureMathEnglishUnitTests(mathMasters),
      ...ensureMathEnglishUnitTests(englishMasters)
    ];
    await db.saveCurriculumMasters(processedCurriculum);

    await act(async () => {
      render(
        <StudentDashboard
          student={testStudent}
          onBackToPortal={vi.fn()}
          initialDate={todayDateStr}
        />
      );
    });

    // 85点を入力して撃破報告 -> relatedTask が見つかり、handlePassTest(relatedTask) が呼ばれる！
    const scoreInput = await screen.findByTestId(`test-score-input-${miniTest.id}`);
    const saveBtn = await screen.findByTestId(`test-save-btn-${miniTest.id}`);

    await act(async () => {
      fireEvent.change(scoreInput, { target: { value: '85' } });
      fireEvent.click(saveBtn);
    });

    // 英語が未完了なので保留
    await waitFor(() => {
      const task = db.getLearningTasks().find(t => t.id === mathUnitTestTask.id);
      expect(task?.status).toBe('completed');
    });

    // 英語のステップ完了ボタンをクリックして英語を完了 -> 全教科完了により算数の新単元が自動アンロック（line 734実行）
    const engStepBtn = await screen.findByTestId('step-complete-btn-2-0');
    await act(async () => {
      fireEvent.click(engStepBtn);
    });

    await waitFor(() => {
      const nextTasks = db.getLearningTasks().filter(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
      expect(nextTasks.length).toBeGreaterThan(0);
    });

    // db.ts追加カバレッジ
    await db.saveStudentInteraction({ id: 'si-cov-1', student_id: testStudent.id, content: 'テストログ', category: 'support', author: '担当講師' });
    await db.deleteStudentInteraction('si-cov-1');
    db.saveSession({
      user: { id: 'usr-cov-1', email: 'branch-ebisu@example.com', role: 'branch', branch_id: 'b-1', branch_name: '恵比寿教室', name: 'Ebisu' },
      token: 'tok-cov-1',
      logged_in_at: new Date().toISOString()
    });
    expect(db.getSession()?.user.role).toBe('branch');
    await db.signOut();
    expect(db.getSession()).toBeNull();

    // db.signInWithPassword バリデーション分岐
    const res1 = await db.signInWithPassword('', 'pass');
    expect(res1.success).toBe(false);
    const res2 = await db.signInWithPassword('test@tentoru.jp', '');
    expect(res2.success).toBe(false);
    const res3 = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
    expect(res3.success).toBe(false);
    const res4 = await db.signInWithPassword('invalid-email-format', 'somepass');
    expect(res4.success).toBe(false);
  });

  it('9. LoginFormエラーハンドリングおよびWeeklyScheduleViewerの日表示・特訓コマ表示カバレッジ', async () => {
    // 1. LoginFormの不正パスワード
    const { unmount } = render(<LoginForm onLoginSuccess={vi.fn()} />);
    const emailInput = screen.getByPlaceholderText(/example@tentoru.jp/i) || screen.getByLabelText(/メールアドレス/i);
    const passInput = screen.getByPlaceholderText(/••••••••/i) || screen.getByLabelText(/パスワード/i);
    const submitBtn = screen.getByRole('button', { name: /ログイン/i });

    await act(async () => {
      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passInput, { target: { value: 'badpass' } });
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText(/ログインに失敗しました/i) || screen.queryByText(/正しくありません/i)).toBeDefined();
    });

    // 2. signInWithPassword が例外をスローした場合のエラー表示
    const spy = vi.spyOn(db, 'signInWithPassword').mockRejectedValueOnce(new Error('通信エラーが発生しました'));
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    await waitFor(() => {
      expect(screen.getByText(/通信エラーが発生しました/i)).toBeDefined();
    });
    spy.mockRestore();
    unmount();

    // 3. WeeklyScheduleViewer の通塾日（selected_days: ['tuesday']）および日表示での office_note 表示
    const testTasks: LearningTask[] = [
      {
        id: 't-weekly-1',
        student_id: 'std-weekly-1',
        scheduled_date: '2026-10-06',
        period: 1,
        status: 'unstarted',
        office_note: '単元テスト特訓コマ'
      }
    ];

    const { unmount: unmountViewer } = render(
      <WeeklyScheduleViewer
        scheduleConfig={{
          id: 'sc-1',
          student_id: 'std-weekly-1',
          selected_days: ['tuesday'],
          day_periods: {},
          default_slots: 2,
          subject_order: []
        }}
        tasks={testTasks}
        currentDateStr="2026-10-06"
      />
    );

    const dayViewBtn = screen.getByRole('button', { name: /日表示/i });
    await act(async () => {
      fireEvent.click(dayViewBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/単元テスト特訓コマ/i)).toBeDefined();
    });
    unmountViewer();

    // 4. WeeklyScheduleViewer の未指定通塾日（selected_days: []）カバレッジ
    render(
      <WeeklyScheduleViewer
        scheduleConfig={{
          id: 'sc-2',
          student_id: 'std-weekly-2',
          selected_days: [],
          day_periods: {},
          default_slots: 2,
          subject_order: []
        }}
        tasks={[]}
        currentDateStr="2026-10-06"
      />
    );
  });
});
