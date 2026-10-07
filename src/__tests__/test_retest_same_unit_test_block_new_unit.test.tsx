import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import {
  ensureMathEnglishUnitTests,
  calculateLessonRangeForSlot,
  generateSlotsForSelectedSubjects,
  findNextUncompletedLessonForSubject,
  getLatestUnitTestStatusForSubject,
  normalizeUnitName
} from '../lib/scheduler';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { CurriculumMaster, CurriculumUnit, Student, LearningTask, MiniTestResult } from '../types';

describe('単元テスト不合格時の次回授業再テスト割り当て & 新単元進行完全ブロック仕様', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const sampleMasters: CurriculumMaster[] = [
    // 単元1: 3つの かずの けいさん
    { id: 'cm-m-1-1', grade: '小1', subject: '算数', unit_name: '3つの かずの けいさん', lesson_name: '3つの数の計算の順序', sort_order: 1 },
    { id: 'cm-m-1-2', grade: '小1', subject: '算数', unit_name: '3つの かずの けいさん', lesson_name: '3つの数の計算の練習', sort_order: 2 },
    // 単元2: くりあがりのあるたしざん
    { id: 'cm-m-2-1', grade: '小1', subject: '算数', unit_name: 'くりあがりのあるたしざん', lesson_name: '10になるたしざん', sort_order: 10 },
    { id: 'cm-m-2-2', grade: '小1', subject: '算数', unit_name: 'くりあがりのあるたしざん', lesson_name: '繰り上がりのある加法', sort_order: 11 },
  ];

  it('1. normalizeUnitName: 全角スペース、全角数字、ハイフン、接尾辞の表記揺れを正しく吸収して統一単元名を返す', () => {
    expect(normalizeUnitName('３つの　かずの　けいさん - 単元確認テスト')).toBe('3つの かずの けいさん');
    expect(normalizeUnitName('3つの かずの けいさん - 単元テスト')).toBe('3つの かずの けいさん');
    expect(normalizeUnitName('3つの かずの けいさん（再テスト）')).toBe('3つの かずの けいさん');
    expect(normalizeUnitName('  ３つの　かずの　けいさん ーやり直しー  ')).toBe('3つの かずの けいさん');
  });

  it('2. 単元テスト不合格時: 次回通塾日の calculateLessonRangeForSlot および generateSlotsForSelectedSubjects で新単元に進まず再テスト（同一単元テスト）を From/To に割り当てる', () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test');
    expect(unitTestItem).toBeDefined();

    const studentKenshin: Student = {
      id: 'std-kenshin-1',
      student_id: 'std-kenshin-1',
      name: '中尾謙信',
      grade: '小1',
      level: 'B',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2']
    };

    // 2026-10-13 に単元テストで80点（不合格: レベルB合格ラインは80%以上または90%など）
    const failedMiniTest: MiniTestResult = {
      id: 'mini-kenshin-1',
      student_id: studentKenshin.id,
      date: '2026-10-13',
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの　かずの　けいさん', // 全角スペース入り
      test_content: '3つの　かずの　けいさん - 単元確認テスト',
      score: 80,
      passed: false,
      status: 'failed',
      passing_line: '85%以上',
      target_scope: 'individual'
    };

    // findNextUncompletedLessonForSubject が新単元（くりあがりのあるたしざん）ではなく不合格単元テストを返すこと
    const nextUncompleted = findNextUncompletedLessonForSubject({
      student: studentKenshin,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [failedMiniTest]
    });

    expect(nextUncompleted.hasFailedUnitTest).toBe(true);
    expect(nextUncompleted.lessonId).toBe(unitTestItem!.id);
    expect(nextUncompleted.lessonName).toContain('単元確認テスト');
    expect(nextUncompleted.lessonName).not.toContain('くりあがり');

    // calculateLessonRangeForSlot: From / To の両方が単元テストのID・名前に固定され、再テスト表記になること
    const slotRange = calculateLessonRangeForSlot({
      student: studentKenshin,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [failedMiniTest]
    });

    expect(slotRange.start_lesson_id).toBe(unitTestItem!.id);
    expect(slotRange.end_lesson_id).toBe(unitTestItem!.id);
    expect(slotRange.start_lesson_name).toContain('3つの かずの けいさん');
    expect(slotRange.end_lesson_name).toContain('3つの かずの けいさん');
    expect(slotRange.lesson_range).toContain('再テスト');
    expect(slotRange.pace_reason).toContain('新単元進行をストップ');
    expect(slotRange.start_lesson_name).not.toContain('くりあがり');
    expect(slotRange.end_lesson_name).not.toContain('くりあがり');

    // generateSlotsForSelectedSubjects: コマ割りの From / To が新単元ではなく単元確認テストになること
    const slots = generateSlotsForSelectedSubjects({
      student: studentKenshin,
      selectedSubjects: ['算数'],
      periodCount: 1,
      curriculumMasters: processedMasters,
      miniTestResults: [failedMiniTest]
    });

    expect(slots[1].startLessonId).toBe(unitTestItem!.id);
    expect(slots[1].endLessonId).toBe(unitTestItem!.id);
    expect(slots[1].startLessonName).toContain('3つの かずの けいさん');
    expect(slots[1].endLessonName).toContain('3つの かずの けいさん');
    expect(slots[1].lessonRange).toContain('再テスト');
  });

  it('3. 単元テスト合格時: 1つ前の単元テストが合格になって初めて、新しい単元の授業に進むことができる', () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test');

    const studentKenshin: Student = {
      id: 'std-kenshin-2',
      student_id: 'std-kenshin-2',
      name: '中尾謙信',
      grade: '小1',
      level: 'B',
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2']
    };

    // 再テストで90点（合格！）
    const passedMiniTest: MiniTestResult = {
      id: 'mini-kenshin-2',
      student_id: studentKenshin.id,
      date: '2026-10-16',
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの かずの けいさん',
      test_content: '3つの かずの けいさん - 単元確認テスト',
      score: 90,
      passed: true,
      status: 'passed',
      passing_line: '85%以上',
      target_scope: 'individual'
    };

    // 合格後の探索: 新単元（くりあがりのあるたしざん - 10になるたしざん）が解禁されること
    const nextAfterPass = findNextUncompletedLessonForSubject({
      student: studentKenshin,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [passedMiniTest]
    });

    expect(nextAfterPass.hasFailedUnitTest).toBe(false);
    expect(nextAfterPass.lessonName).toContain('10になるたしざん');

    const slotRangeAfterPass = calculateLessonRangeForSlot({
      student: studentKenshin,
      subject: '算数',
      curriculumMasters: processedMasters,
      miniTestResults: [passedMiniTest]
    });

    expect(slotRangeAfterPass.start_lesson_name).toContain('10になるたしざん');
  });

  it('4. 講師ダッシュボード「学習計画の個別管理 & 自動最適化」: 次回通塾日を開いた際、From/To セレクトボックスが不合格単元テスト（再テスト）を選択状態にし、新単元を割り当てない', async () => {
    const processedMasters = ensureMathEnglishUnitTests(sampleMasters);
    await db.saveCurriculumMasters(processedMasters);

    const unitTestItem = processedMasters.find(m => m.unit_name === '3つの かずの けいさん' && m.item_type === 'unit_test')!;

    const studentKenshin: Student = {
      id: 'std-kenshin-ui-1',
      student_id: 'std-kenshin-ui-1',
      name: '中尾謙信',
      grade: '小1',
      classroom: '本校',
      branch_id: 'branch-1',
      level: 'B',
      selected_subjects: ['算数'],
      selected_days: ['tuesday', 'friday'],
      default_slots: 1,
      completed_lesson_ids: ['cm-m-1-1', 'cm-m-1-2']
    };
    await db.saveStudent(studentKenshin);

    // 2026-10-13 (火) に単元テスト不合格
    const failedMiniTest: MiniTestResult = {
      id: 'mini-kenshin-fail-ui',
      student_id: studentKenshin.id,
      date: '2026-10-13',
      subject: '算数',
      test_type: 'unit_test',
      unit_name: '3つの　かずの　けいさん',
      test_content: '3つの　かずの　けいさん - 単元確認テスト',
      score: 80,
      passed: false,
      status: 'failed',
      passing_line: '85%以上',
      target_scope: 'individual'
    };
    await db.saveMiniTestResult(failedMiniTest);

    // 次回通塾日 2026-10-16 (金) を表示
    const nextAttendanceDate = '2026-10-16';

    const { unmount } = render(
      <TeacherDashboard
        teacherType="elementary"
        initialTab="schedule"
        students={[studentKenshin]}
        initialDate={nextAttendanceDate}
        initialStudentId={studentKenshin.id}
      />
    );

    // 1. コマ1の開始授業 (From) セレクトボックスに該当単元テストが選択されていること
    await waitFor(() => {
      const fromSelect = screen.getByTestId('period-unit-select-1') as HTMLSelectElement;
      expect(fromSelect.value).toBe(unitTestItem.id);
    });

    // 2. コマ1の終了目標授業 (To) セレクトボックスにも該当単元テストが選択されていること
    const toSelect = screen.getByTestId('period-end-lesson-select-1') as HTMLSelectElement;
    expect(toSelect.value).toBe(unitTestItem.id);

    // 3. 授業進捗範囲に再テストテキストが表示されていること
    const rangeBadge = screen.getByTestId('period-lesson-range-badge-1');
    expect(rangeBadge).toHaveTextContent(/再テスト/);
    expect(rangeBadge).not.toHaveTextContent(/くりあがり/);

    unmount();
  });
});
