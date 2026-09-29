import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { Student, CurriculumMaster, MiniTestResult } from '../types';
import {
  ensureMathEnglishUnitTests,
  calculateLessonRangeForSlot,
  findNextUncompletedLessonForSubject,
  generateSlotsForSelectedSubjects
} from '../lib/scheduler';

describe('単元テスト時のコマ割りFrom/To表示・本日のテスト自動連携・合否ゲート制御テスト', () => {
  const sampleMasters: CurriculumMaster[] = [
    {
      id: 'cm-kazu-1',
      grade: '小1',
      grade_level: '小1',
      subject: '算数',
      unit_name: 'かずと すうじ',
      lesson_name: '第1講 1から5までのかず',
      sort_order: 1,
      standard_completion_days: 7
    },
    {
      id: 'cm-kazu-2',
      grade: '小1',
      grade_level: '小1',
      subject: '算数',
      unit_name: 'かずと すうじ',
      lesson_name: '第2講 6から10までのかず',
      sort_order: 2,
      standard_completion_days: 7
    },
    {
      id: 'cm-kazu-test',
      grade: '小1',
      grade_level: '小1',
      subject: '算数',
      unit_name: 'かずと すうじ',
      lesson_name: 'かずと すうじ - 単元確認テスト',
      item_type: 'unit_test',
      sort_order: 3,
      standard_completion_days: 7,
      passing_line: '90点以上'
    },
    {
      id: 'cm-ikutsu-1',
      grade: '小1',
      grade_level: '小1',
      subject: '算数',
      unit_name: 'いくつと いくつ',
      lesson_name: '第1講 かずの合成分解',
      sort_order: 4,
      standard_completion_days: 7
    }
  ];

  const testStudent: Student = {
    id: 'st-unit-test-gate',
    student_id: 'S_UNIT_GATE_1',
    name: '単元テスト確認生徒',
    grade: '小1',
    status: 'normal',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小1',
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数'],
    start_unit_math: 'cm-kazu-1',
    completed_lesson_ids: ['cm-kazu-1', 'cm-kazu-2'],
    period_count: 2
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem('tentoru_curriculum_masters', JSON.stringify(sampleMasters));
    await db.saveStudent(testStudent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1 & 3. 単元テスト到達時にFrom/Toが単元テストとなり、同日に次単元を先入れしない（当日の学習ストッパー）', () => {
    const slots = generateSlotsForSelectedSubjects({
      student: testStudent,
      periodCount: 2,
      selectedSubjects: ['算数'],
      curriculumMasters: sampleMasters,
      tasks: [],
      lessonProgressList: []
    });

    // 1コマ目が単元確認テストになる
    expect(slots[1].startLessonName).toContain('単元確認テスト');
    expect(slots[1].endLessonName).toContain('単元確認テスト');
    expect(slots[1].lessonRange).toContain('単元確認テスト');
    expect(slots[1].startLessonId).toBe('cm-kazu-test');
    expect(slots[1].endLessonId).toBe('cm-kazu-test');

    // 2コマ目もテスト合格前は新単元（いくつと いくつ）へ先入れされないこと
    expect(slots[2].startLessonName).not.toContain('第1講 かずの合成分解');
  });

  it('3. 単元テスト不合格時は次回通塾日以降も新単元へ進めず「再テスト / 復習」を割り振る（不合格時の次単元ブロック）', () => {
    const failedMiniTests: MiniTestResult[] = [
      {
        id: 'mt-failed-1',
        student_id: testStudent.id,
        date: '2026-05-10',
        subject: '算数',
        unit_name: 'かずと すうじ',
        test_content: 'かずと すうじ - 単元確認テスト',
        score: 60,
        passing_line: '90点以上',
        passed: false
      }
    ];

    const nextLesson = findNextUncompletedLessonForSubject({
      student: testStudent,
      subject: '算数',
      curriculumMasters: sampleMasters,
      miniTestResults: failedMiniTests
    });

    expect(nextLesson.hasFailedUnitTest).toBe(true);

    const range = calculateLessonRangeForSlot({
      subject: '算数',
      student: testStudent,
      curriculumMasters: sampleMasters,
      miniTestResults: failedMiniTests
    });

    expect(range.start_lesson_name).toContain('【再テスト対策・総復習】');
    expect(range.end_lesson_name).toContain('【再テスト対策・総復習】');
    expect(range.start_lesson_name).toContain('かずと すうじ');
    expect(range.lesson_range).toContain('【弱点補強】');
  });

  it('3. 単元テスト合格時は次回学習計画で新単元の第1回授業が解禁される（合格時の次単元解禁）', () => {
    const passedMiniTests: MiniTestResult[] = [
      {
        id: 'mt-passed-1',
        student_id: testStudent.id,
        date: '2026-05-10',
        subject: '算数',
        unit_name: 'かずと すうじ',
        test_content: 'かずと すうじ - 単元確認テスト',
        score: 100,
        passing_line: '90点以上',
        passed: true
      }
    ];

    const nextLesson = findNextUncompletedLessonForSubject({
      student: testStudent,
      subject: '算数',
      curriculumMasters: sampleMasters,
      miniTestResults: passedMiniTests
    });

    expect(nextLesson.hasFailedUnitTest).toBe(false);
    expect(nextLesson.lessonName).toContain('第1講 かずの合成分解');
    expect(nextLesson.lessonId).toBe('cm-ikutsu-1');

    const slots = generateSlotsForSelectedSubjects({
      student: testStudent,
      periodCount: 1,
      selectedSubjects: ['算数'],
      curriculumMasters: sampleMasters,
      miniTestResults: passedMiniTests
    });

    expect(slots[1].startLessonName).toContain('第1講 かずの合成分解');
  });

  it('1 & 2. TeacherDashboardで遅れチェック＆自動リスケ実行時にFrom/Toが正常表示され、本日のテストに自動投入される', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard 
          initialStudentId={testStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/i })).toBeDefined();
    });

    // 「遅れチェック ＆ 自動リスケ」ボタンをクリック
    const autoReschedBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    await act(async () => {
      fireEvent.click(autoReschedBtn);
    });

    // 1. From / To ドロップダウンの表示確認
    const fromSelect = container!.querySelector('select[data-testid="period-unit-select-1"]') as HTMLSelectElement;
    expect(fromSelect).toBeDefined();
    expect(fromSelect.value).toBe('cm-kazu-test');
    // 空欄（""）になっていないこと
    expect(fromSelect.value).not.toBe('');

    const toSelect = container!.querySelector('select[data-testid="period-end-lesson-select-1"]') as HTMLSelectElement;
    expect(toSelect).toBeDefined();
    expect(toSelect.value).toBe('cm-kazu-test');
    expect(toSelect.value).not.toBe('');

    // 2. 本日のテストへの自動登録・投入確認
    const savedMiniTests = db.getMiniTestResults().filter(t => t.student_id === testStudent.id);
    expect(savedMiniTests.length).toBeGreaterThan(0);
    expect(savedMiniTests[0].subject).toBe('算数');
    expect(savedMiniTests[0].test_type).toBe('unit_test');
    expect(savedMiniTests[0].test_content).toContain('かずと すうじ - 単元確認テスト');
    expect(savedMiniTests[0].passing_line).toBe('90点以上');
  });

  it('5. 中学生: 単元テスト到達時のFrom/To適正表示、合否ゲート制御、自動リスケ本日のテスト自動連携', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const jhsMasters: CurriculumMaster[] = [
      {
        id: 'cm-jhs-eq-1',
        grade: '中2',
        grade_level: '中2',
        subject: '数学',
        unit_name: '連立方程式',
        lesson_name: '第1講 連立方程式の解き方',
        sort_order: 1
      },
      {
        id: 'cm-jhs-eq-test',
        grade: '中2',
        grade_level: '中2',
        subject: '数学',
        unit_name: '連立方程式',
        lesson_name: '連立方程式 - 単元確認テスト',
        item_type: 'unit_test',
        sort_order: 2,
        passing_line: '85点以上'
      },
      {
        id: 'cm-jhs-fn-1',
        grade: '中2',
        grade_level: '中2',
        subject: '数学',
        unit_name: '一次関数',
        lesson_name: '第1講 一次関数のグラフ',
        sort_order: 3
      }
    ];

    const jhsStudent: Student = {
      id: 'st-jhs-gate-1',
      student_id: 'S_JHS_GATE_1',
      name: '中学生 単元ゲートテスト生徒',
      grade: '中2',
      status: 'normal',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday', 'tuesday', 'thursday'],
      selected_subjects: ['数学'],
      start_unit_math: 'cm-jhs-eq-1',
      completed_lesson_ids: ['cm-jhs-eq-1'],
      period_count: 2
    };

    await db.saveCurriculumMasters(jhsMasters);
    await db.saveStudent(jhsStudent);

    // 5.1 スケジューラでのスロット生成: 1コマ目が単元確認テスト、2コマ目も同日に新単元を先入れしない
    const slots = generateSlotsForSelectedSubjects({
      student: jhsStudent,
      periodCount: 2,
      selectedSubjects: ['数学'],
      curriculumMasters: jhsMasters
    });

    expect(slots[1].startLessonName).toContain('連立方程式');
    expect(slots[1].startLessonName).toContain('単元確認テスト');
    expect(slots[1].startLessonId).toBe('cm-jhs-eq-test');
    expect(slots[1].endLessonId).toBe('cm-jhs-eq-test');

    // 2コマ目は一次関数へ先入れされないこと（当日の学習ストッパー）
    expect(slots[2].startLessonName).not.toContain('一次関数のグラフ');

    // 5.2 TeacherDashboard 上での遅れチェック＆自動リスケ
    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard 
          students={[jhsStudent]}
          initialStudentId={jhsStudent.id} 
          teacherType="junior_high" 
          initialTab="schedule" 
          curriculumMasters={jhsMasters}
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/i })).toBeDefined();
    });

    const autoReschedBtn = screen.getByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    await act(async () => {
      fireEvent.click(autoReschedBtn);
    });

    // ドロップダウンのFrom / To が空欄でないこと
    const fromSelect = container!.querySelector('select[data-testid="period-unit-select-1"]') as HTMLSelectElement;
    expect(fromSelect).toBeDefined();
    expect(fromSelect.value).toBe('cm-jhs-eq-test');

    const toSelect = container!.querySelector('select[data-testid="period-end-lesson-select-1"]') as HTMLSelectElement;
    expect(toSelect).toBeDefined();
    expect(toSelect.value).toBe('cm-jhs-eq-test');

    // 本日のテストに自動投入されていること
    const savedMiniTests = db.getMiniTestResults().filter(t => t.student_id === jhsStudent.id);
    expect(savedMiniTests.length).toBeGreaterThan(0);
    expect(savedMiniTests[0].subject).toBe('数学');
    expect(savedMiniTests[0].test_type).toBe('unit_test');
    expect(savedMiniTests[0].test_content).toContain('連立方程式 - 単元確認テスト');
    expect(savedMiniTests[0].passing_line).toBe('85点以上');
  });
});
