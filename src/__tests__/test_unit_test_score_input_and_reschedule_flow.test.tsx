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
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumMaster, CurriculumUnit, Student, LearningTask } from '../types';

describe('Unit Test Score Input, Teacher Dashboard Realtime Sync, Remedial Flow & Session Rules', () => {
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
    { id: 'cm-e-1', grade: '小5', subject: '英語', unit_name: 'You are 〜', lesson_name: 'You are(1)', sort_order: 1 },
    { id: 'cm-e-2', grade: '小5', subject: '英語', unit_name: 'You are 〜', lesson_name: 'You are(2)', sort_order: 2 },
    { id: 'cm-e-3', grade: '小5', subject: '英語', unit_name: 'He is 〜', lesson_name: 'He is(1)', sort_order: 10 },
  ];

  it('1. 算数: まとめテスト(1〜3)までを同日授業内でやった場合、単元テストは同日に行わず次回授業に行う', () => {
    const processedMath = ensureMathEnglishUnitTests(mathMasters);
    const student: Student = {
      id: 'std-rule-math-1',
      student_id: 'std-rule-math-1',
      name: '算数学習生',
      grade: '小5',
      level: 'A',
      selected_subjects: ['算数'],
      completed_lesson_ids: [
        'cm-m-1', 'cm-m-2', 'cm-m-3',
        'cm-auto-sum1-算数-小5-分数のかけ算',
        'cm-auto-sum2-算数-小5-分数のかけ算'
      ]
    };

    const slot = calculateLessonRangeForSlot({
      student,
      subject: '算数',
      curriculumMasters: processedMath
    });

    expect(slot.start_lesson_name).toContain('まとめテスト（３）');
    expect(slot.end_lesson_name).toContain('まとめテスト（３）');
    expect(slot.lesson_range).not.toContain('単元確認テスト');

    // 複数コマ生成時、同日に先行して算数（まとめテスト3）がある場合、後続コマに単元テストは入らない
    const multiSlots = generateSlotsForSelectedSubjects({
      student,
      selectedSubjects: ['算数'],
      periodCount: 2,
      curriculumMasters: processedMath
    });

    expect(multiSlots[1]).toBeDefined();
    expect(multiSlots[1].lessonRange).toContain('まとめテスト（３）');
    expect(multiSlots[2]).toBeDefined();
    expect(multiSlots[2].lessonRange).not.toContain('単元確認テスト');

    // まとめテスト(3)完了後 -> 必ず次回授業日に「単元テスト」が割り当てられる
    const studentAfterSummary3: Student = {
      ...student,
      completed_lesson_ids: [
        ...student.completed_lesson_ids,
        'cm-auto-sum3-算数-小5-分数のかけ算'
      ]
    };
    const nextSlot = calculateLessonRangeForSlot({
      student: studentAfterSummary3,
      subject: '算数',
      curriculumMasters: processedMath
    });
    expect(nextSlot.start_lesson_name).toContain('単元確認テスト');
  });

  it('2. 英語: Check Testまでを同日授業内でやった場合、単元テストは同日に行わず次回授業に行う', () => {
    const processedEng = ensureMathEnglishUnitTests(englishMasters);
    const student: Student = {
      id: 'std-rule-eng-1',
      student_id: 'std-rule-eng-1',
      name: '英語学習生',
      grade: '小5',
      level: 'A',
      selected_subjects: ['英語'],
      completed_lesson_ids: ['cm-e-1']
    };

    const slot = calculateLessonRangeForSlot({
      student,
      subject: '英語',
      curriculumMasters: processedEng
    });

    expect(slot.end_lesson_name).toContain('Check Test');
    expect(slot.lesson_range).not.toContain('単元確認テスト');

    // 複数コマ生成時、同日に先行して英語がある場合、後続コマに単元テストは同日連続受講されない
    const studentAtCheckTest: Student = {
      ...student,
      completed_lesson_ids: ['cm-e-1', 'cm-e-2']
    };

    const multiSlots = generateSlotsForSelectedSubjects({
      student: studentAtCheckTest,
      selectedSubjects: ['英語'],
      periodCount: 2,
      curriculumMasters: processedEng
    });

    expect(multiSlots[1]).toBeDefined();
    expect(multiSlots[1].lessonRange).toContain('Check Test');
    expect(multiSlots[2]).toBeDefined();
    expect(multiSlots[2].lessonRange).not.toContain('単元確認テスト');

    // Check Test完了後 -> 必ず次回授業日に「単元テスト」が割り当てられる
    const checkTestItem = processedEng.find(m => m.unit_name === 'You are 〜' && m.lesson_name.includes('Check Test'));
    const studentAfterCheckTest: Student = {
      ...studentAtCheckTest,
      completed_lesson_ids: [
        ...studentAtCheckTest.completed_lesson_ids,
        checkTestItem!.id
      ]
    };
    const nextSlotEng = calculateLessonRangeForSlot({
      student: studentAfterCheckTest,
      subject: '英語',
      curriculumMasters: processedEng
    });
    expect(nextSlotEng.start_lesson_name).toContain('単元確認テスト');
  });

  it('3. 単元テスト点数入力欄の表示、合格判定＆送信、講師ダッシュボード（小テスト結果管理）とのリアルタイム連動', async () => {
    const testStudent: Student = {
      id: 'std-score-pass-1',
      student_id: 'std-score-pass-1',
      name: '高橋 健太',
      grade: '小5',
      level: 'A',
      selected_subjects: ['英語'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: ['cm-e-1', 'cm-e-2', 'cm-auto-chk-英語-小5-You are 〜']
    };

    const unit: CurriculumUnit = {
      id: 'unit-eng-you-are',
      subject: '英語',
      grade: '小5',
      name: 'You are 〜. あなたは〜です。',
      sequence_order: 1
    };

    const todayDate = '2026-10-06';
    const task: LearningTask = {
      id: 'task-eng-ut-1',
      student_id: testStudent.id,
      scheduled_date: todayDate,
      period: 1,
      subject: '英語',
      unit_id: unit.id,
      custom_unit_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      start_lesson_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      end_lesson_name: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      lesson_range: 'You are 〜. あなたは〜です。 - 単元確認テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(testStudent);
    await db.saveCurriculumUnits([unit]);
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <StudentDashboard
        student={testStudent}
        onBackToPortal={vi.fn()}
        initialDate={todayDate}
      />
    );

    // 1. 各教科（英語）の下に点数入力欄が存在することを確認
    const scoreSection = await screen.findByTestId('unit-test-score-section-1');
    expect(scoreSection).toBeInTheDocument();
    expect(screen.getByText(/📝 単元テスト結果入力/i)).toBeInTheDocument();

    const scoreInput = screen.getByTestId('task-score-input-1') as HTMLInputElement;
    const submitBtn = screen.getByTestId('task-score-submit-btn-1');
    expect(scoreInput).toBeInTheDocument();
    expect(submitBtn).toBeInTheDocument();

    // 2. 空欄または不正値送信時のバリデーションアラート
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(submitBtn);
    expect(alertMock).toHaveBeenCalledWith('点数を入力してください。');

    fireEvent.change(scoreInput, { target: { value: '150' } });
    fireEvent.click(submitBtn);
    expect(alertMock).toHaveBeenCalledWith('0〜100の点数を入力してください。');

    // 3. レベルAの合格点（95点）を入力して送信
    fireEvent.change(scoreInput, { target: { value: '95' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 合格表示になること
    await waitFor(() => {
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
      expect(screen.getByText('✅ 合格')).toBeInTheDocument();
    });

    // DBにMiniTestResultが保存され、生徒名が紐付いていること
    const miniResults = db.getMiniTestResults();
    const saved = miniResults.find(m => m.student_id === testStudent.id && m.date === todayDate);
    expect(saved).toBeDefined();
    expect(saved?.score).toBe(95);
    expect(saved?.passed).toBe(true);
    expect(saved?.status).toBe('passed');
    expect(saved?.students?.name).toBe('高橋 健太');

    unmount();

    // 4. 講師ダッシュボードの「小テスト結果管理」を開き、結果と内容が連動表示されていることを検証
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={testStudent.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    const studentCell = await screen.findByTestId(`minitest-student-name-${saved!.id}`);
    expect(studentCell.textContent).toBe('高橋 健太');
    expect(screen.getByText(/You are 〜.*単元確認テスト/i)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('95').length).toBeGreaterThan(0);
  });

  it('4. 単元テスト不合格時: やり直し授業の自動追加＆完了ボタン発生、次回再テスト予約、講師ダッシュボード連動', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const testStudent: Student = {
      id: 'std-score-fail-1',
      student_id: 'std-score-fail-1',
      name: '佐藤 綾乃',
      grade: '小5',
      level: 'A',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: ['cm-m-1', 'cm-m-2']
    };

    const unit: CurriculumUnit = {
      id: 'unit-math-frac-fail',
      subject: '算数',
      grade: '小5',
      name: '分数のかけ算',
      sequence_order: 1
    };

    const todayDate = '2026-10-06'; // 火曜日 -> 次回金曜日 2026-10-09
    const task: LearningTask = {
      id: 'task-math-fail-1',
      student_id: testStudent.id,
      scheduled_date: todayDate,
      period: 1,
      subject: '算数',
      unit_id: unit.id,
      custom_unit_name: '分数のかけ算 - 単元確認テスト',
      start_lesson_name: '分数のかけ算 - 単元確認テスト',
      end_lesson_name: '分数のかけ算 - 単元確認テスト',
      lesson_range: '分数のかけ算 - 単元確認テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(testStudent);
    await db.saveCurriculumUnits([unit]);
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <StudentDashboard
        student={testStudent}
        onBackToPortal={vi.fn()}
        initialDate={todayDate}
      />
    );

    const scoreInput = await screen.findByTestId('task-score-input-1');
    const submitBtn = screen.getByTestId('task-score-submit-btn-1');

    // 不合格点（65点: レベルAは90点未満不合格）を入力して送信
    fireEvent.change(scoreInput, { target: { value: '65' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    // 1. 本日授業に「【やり直し授業】分数のかけ算 復習」が追加されること
    await waitFor(() => {
      expect(screen.getByText(/【やり直し授業】分数のかけ算 復習/i)).toBeInTheDocument();
    });

    // やり直し授業に「この授業を完了にする」ボタンが発生すること
    const remedialCompleteBtn = await screen.findByTestId('complete-task-btn-2');
    expect(remedialCompleteBtn).toBeInTheDocument();
    expect(remedialCompleteBtn.textContent).toContain('この授業を完了にする');

    // やり直し授業を完了させる
    await act(async () => {
      fireEvent.click(remedialCompleteBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-completed-badge-2')).toHaveTextContent('合格完了！');
    });

    // 2. 次回通塾日（2026-10-09）に「再テスト」が自動予約されていること
    const allTasks = db.getLearningTasks();
    const nextFridayTask = allTasks.find(t => t.student_id === testStudent.id && t.scheduled_date === '2026-10-09');
    expect(nextFridayTask).toBeDefined();
    expect(nextFridayTask?.start_lesson_name).toContain('再テスト');

    // 3. 講師ダッシュボードの「小テスト結果管理」で不合格結果が連動表示されること
    unmount();

    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={testStudent.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    const failedMiniResult = db.getMiniTestResults().find(m => m.student_id === testStudent.id && m.date === todayDate);
    expect(failedMiniResult).toBeDefined();
    expect(failedMiniResult?.score).toBe(65);
    expect(failedMiniResult?.passed).toBe(false);

    const studentCell = await screen.findByTestId(`minitest-student-name-${failedMiniResult!.id}`);
    expect(studentCell.textContent).toBe('佐藤 綾乃');
    expect(screen.getByDisplayValue('65')).toBeInTheDocument();
  });

  it('5. passing_line指定（8割以上/80%）、直接合格/不合格ボタン、進捗ステップ完了、先取り学習フロー', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const student: Student = {
      id: 'std-coverage-flow-1',
      student_id: 'std-coverage-flow-1',
      name: '進度向上生',
      grade: '小5',
      level: 'B',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      completed_lesson_ids: ['cm-m-1']
    };

    const unit: CurriculumUnit = {
      id: 'unit-math-percent',
      subject: '算数',
      grade: '小5',
      name: '分数の計算',
      sequence_order: 1
    };

    const todayDate = '2026-10-06';
    const task: LearningTask = {
      id: 'task-math-pct-1',
      student_id: student.id,
      scheduled_date: todayDate,
      period: 1,
      subject: '算数',
      unit_id: unit.id,
      passing_line: '8割以上',
      custom_unit_name: '分数の計算 - 単元確認テスト',
      start_lesson_name: '分数の計算 - 単元確認テスト',
      end_lesson_name: '分数の計算 - 単元確認テスト',
      lesson_range: '分数の計算 - 単元確認テスト',
      status: 'unstarted',
      video_watched: false,
      test_passed: false
    };

    await db.saveStudent(student);
    await db.saveCurriculumUnits([unit]);
    await db.saveLearningTasks([task]);
    await db.saveCurriculumMasters([
      { id: 'cm-m-next-1', grade: '小5', subject: '算数', unit_name: '次の単元', lesson_name: '次の単元(1)', sort_order: 20 }
    ]);

    const { unmount } = render(
      <StudentDashboard
        student={student}
        onBackToPortal={vi.fn()}
        initialDate={todayDate}
      />
    );

    // 点数入力欄に85点を入れて直接「単元テストを受ける (合格)」ボタンをクリック
    const scoreInput = await screen.findByTestId('task-score-input-1');
    fireEvent.change(scoreInput, { target: { value: '85' } });

    const passBtn = screen.getByTestId('complete-task-btn-1');
    await act(async () => {
      fireEvent.click(passBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('task-completed-badge-1')).toHaveTextContent('合格完了！');
    });

    // 全タスク完了後の「🚀 次の単元を先取り学習する」ボタンが表示され、クリック可能
    const advanceBtn = await screen.findByTestId('advance-learning-btn');
    expect(advanceBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(advanceBtn);
    });

    // 先取り学習タスクが追加されたことを確認
    const allTasks = db.getLearningTasks().filter(t => t.student_id === student.id && t.scheduled_date === todayDate);
    expect(allTasks.some(t => t.custom_unit_name?.includes('先取り'))).toBe(true);

    unmount();
  });

  it('6. 当日すでに単元テストに到達している教科のスロット生成時、同日後続コマに定着演習が割り当てられる', () => {
    const processedMath = ensureMathEnglishUnitTests(mathMasters);
    const studentAtUnitTest: Student = {
      id: 'std-at-ut-1',
      student_id: 'std-at-ut-1',
      name: 'テスト到達生徒',
      grade: '小5',
      level: 'A',
      selected_subjects: ['算数'],
      completed_lesson_ids: [
        'cm-m-1', 'cm-m-2', 'cm-m-3',
        'cm-auto-sum1-算数-小5-分数のかけ算',
        'cm-auto-sum2-算数-小5-分数のかけ算',
        'cm-auto-sum3-算数-小5-分数のかけ算'
      ]
    };

    const slots = generateSlotsForSelectedSubjects({
      student: studentAtUnitTest,
      selectedSubjects: ['算数'],
      periodCount: 2,
      curriculumMasters: processedMath
    });

    expect(slots[1].lessonRange).toContain('単元確認テスト');
    expect(slots[2].lessonRange).toContain('【定着演習】');
  });
});
