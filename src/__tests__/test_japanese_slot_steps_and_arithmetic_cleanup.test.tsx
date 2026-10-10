import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import StudentDashboard from '../components/StudentDashboard';
import { db, Student, CurriculumMaster, LearningTask } from '../lib/db';

describe('Japanese Slot Step Slice Expansion & Arithmetic Cleanup Tests', () => {
  const mockMasters: CurriculumMaster[] = [
    // 国語: げんこう用紙のつかい方 1〜3
    {
      id: 'cm-jp-g1',
      grade: '小5',
      subject: '国語',
      unit_name: 'げんこう用紙のつかい方',
      lesson_name: '第1講 ますのあけ方',
      sort_order: 1,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-g2',
      grade: '小5',
      subject: '国語',
      unit_name: 'げんこう用紙のつかい方',
      lesson_name: '第2講 『 』のつかい方',
      sort_order: 2,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-g3',
      grade: '小5',
      subject: '国語',
      unit_name: 'げんこう用紙のつかい方',
      lesson_name: '第3講 行の変え方',
      sort_order: 3,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-other',
      grade: '小5',
      subject: '国語',
      unit_name: '漢字の組み立て',
      lesson_name: 'へんとつくり',
      sort_order: 4,
      item_type: 'lesson'
    },
    // 算数: 小5 算数ステップ
    {
      id: 'cm-math-1',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第1講 小数の倍',
      sort_order: 1,
      item_type: 'lesson'
    },
    {
      id: 'cm-math-2',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '第2講 小数×小数の筆算',
      sort_order: 2,
      item_type: 'lesson'
    },
    {
      id: 'cm-math-3',
      grade: '小5',
      subject: '算数',
      unit_name: '小数のわり算',
      lesson_name: '第1講 わり算の筆算',
      sort_order: 3,
      item_type: 'lesson'
    }
  ];

  const testStudent: Student = {
    id: 'st-jp-test-1',
    student_id: 'S_JP_1',
    name: '国語 太郎',
    name_kana: 'コクゴ タロウ',
    grade: '小5',
    status: 'normal',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    school_id: 'sch-1',
    school_name: '恵比寿小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小5',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['国語', '算数'],
    completed_lesson_ids: ['cm-math-3'], // 手前の cm-math-1, cm-math-2 が置き去り状態
    period_count: 3,
    default_slots: 3
  };

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    await db.saveStudent(testStudent);
    await db.saveCurriculumMasters(mockMasters);
  });

  it('国語コマ（コマ3）で「げんこう用紙のつかい方 1〜3」が設定された場合、全3ステップ（STEP 1〜3）が漏れなくスライス展開されること', async () => {
    const today = '2026-10-10';
    // 国語コマ（コマ3）
    const taskJapanese: LearningTask = {
      id: 'task-jp-period3',
      student_id: testStudent.id,
      unit_id: 'custom-jp-1',
      scheduled_date: today,
      period: 3,
      subject: '国語',
      custom_unit_name: 'げんこう用紙のつかい方',
      start_lesson_id: 'cm-jp-g1',
      end_lesson_id: 'cm-jp-g3',
      start_lesson_name: '第1講 ますのあけ方',
      end_lesson_name: '第3講 行の変え方',
      lesson_range: 'げんこう用紙のつかい方 1〜3',
      // 仮にlesson_idsが誤って1件（『 』のつかい方）しか入っていなかったとしてもFrom〜To全件スライスが優先される
      lesson_ids: ['cm-jp-g2'],
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([taskJapanese]);

    render(
      <StudentDashboard
        student={testStudent}
        initialDate={today}
      />
    );

    // コマ3のステップが表示されることを待機
    await waitFor(() => {
      expect(screen.getByTestId('period-row-3')).toBeInTheDocument();
    });

    // STEP 1〜3 がすべて描画されていること（1件しか出ないバグの解消を検証）
    expect(screen.getByTestId('step-card-3-0')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-3-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-3-2')).toBeInTheDocument();

    expect(screen.getByText(/STEP 1:/)).toBeInTheDocument();
    expect(screen.getByText(/ますのあけ方/)).toBeInTheDocument();

    expect(screen.getByText(/STEP 2:/)).toBeInTheDocument();
    expect(screen.getByText(/『 』のつかい方/)).toBeInTheDocument();

    expect(screen.getByText(/STEP 3:/)).toBeInTheDocument();
    expect(screen.getByText(/行の変え方/)).toBeInTheDocument();

    // 進捗カウントが「0 / 3 完了」となっていること
    expect(screen.getByTestId('step-progress-count-3')).toHaveTextContent('0 / 3 完了');
  });

  it('国語コマでタイトルのみ（from_lesson_title, to_lesson_title）指定でもFrom〜Toスライスが正しく動作すること', async () => {
    const today = '2026-10-10';
    const taskJapaneseTitleOnly: LearningTask = {
      id: 'task-jp-title-only',
      student_id: testStudent.id,
      unit_id: 'custom-jp-2',
      scheduled_date: today,
      period: 1,
      subject: '国語',
      custom_unit_name: 'げんこう用紙のつかい方',
      start_lesson_name: 'ますのあけ方',
      end_lesson_name: '行の変え方',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([taskJapaneseTitleOnly]);

    render(
      <StudentDashboard
        student={testStudent}
        initialDate={today}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-row-1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('step-card-1-0')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-1-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-card-1-2')).toBeInTheDocument();
    expect(screen.getByTestId('step-progress-count-1')).toHaveTextContent('0 / 3 完了');
  });

  it('タスク2：算数進度データの直接クリーンアップ（DB補正）により、対象生徒（中尾謙信 std-3）の進度データが正規化されていること', async () => {
    // 1. 中尾謙信（std-3）のDBシードデータが正規化され、正しい受講済みIDが直接保存されていること
    const std3 = db.getDefaultSeedStudents().find(s => s.id === 'std-3' || s.name === '中尾謙信');
    expect(std3).toBeDefined();
    expect(std3?.completed_lesson_ids).toEqual(
      expect.arrayContaining(['cm-p1-m1', 'cm-p1-m2', 'cm-p1-m3', 'cm-p1-m4', 'cm-elem-1', 'cm-elem-2'])
    );

    // 2. 任意の生徒の置き去り・中抜き進度データに対して cleanupStudentSteppingStoneUncompletedLessons を直接実行した際に、手前ステップが確実に正規化されること
    const dirtyStudent: Student = {
      ...testStudent,
      id: 'st-dirty-math',
      completed_lesson_ids: ['cm-math-3']
    };
    await db.saveStudent(dirtyStudent);

    const cleaned = await db.cleanupStudentSteppingStoneUncompletedLessons(dirtyStudent.id, '算数');
    expect(cleaned).toBeDefined();
    expect(cleaned?.completed_lesson_ids).toContain('cm-math-1');
    expect(cleaned?.completed_lesson_ids).toContain('cm-math-2');
    expect(cleaned?.completed_lesson_ids).toContain('cm-math-3');
  });
});
