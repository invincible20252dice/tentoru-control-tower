import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';

describe('Elementary Timeline Current Position Synchronization Across All Subjects Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力');
  });

  it('should accurately display all active lessons from student dashboard as current position for all subjects (Math and English)', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. カリキュラムマスタの準備（算数 & 英語）
    const sampleMasters: CurriculumMaster[] = [
      // 算数 (STEP 94〜100)
      { id: 'cm-math-94', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: '3つのかずのけいさん(1)', sort_order: 94 },
      { id: 'cm-math-95', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: '3つのかずのけいさん(2)', sort_order: 95 },
      { id: 'cm-math-96', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: '3つのかずのけいさん(3)', sort_order: 96 },
      { id: 'cm-math-97', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: 'けいさんもんだい', sort_order: 97 },
      { id: 'cm-math-98', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: 'まとめテスト（１）のれんしゅう', sort_order: 98 },
      { id: 'cm-math-99', grade: '1年生', subject: '算数', unit_name: 'たしざんと ひきざん', lesson_name: 'まとめテスト（１）', sort_order: 99 },
      { id: 'cm-math-100', grade: '1年生', subject: '算数', unit_name: 'かたちづくり', lesson_name: 'かたちあそび', sort_order: 100 },

      // 英語 (STEP 1〜4)
      { id: 'cm-eng-1', grade: '1年生', subject: '英語', unit_name: 'Daily Actions', lesson_name: 'I play soccer (1)', sort_order: 1 },
      { id: 'cm-eng-2', grade: '1年生', subject: '英語', unit_name: 'Daily Actions', lesson_name: 'I play soccer (2)', sort_order: 2 },
      { id: 'cm-eng-3', grade: '1年生', subject: '英語', unit_name: 'Daily Actions', lesson_name: "I don't play soccer", sort_order: 3 },
      { id: 'cm-eng-4', grade: '1年生', subject: '英語', unit_name: 'Questions', lesson_name: 'Do you play tennis?', sort_order: 4 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    // 2. 生徒の準備（算数と英語を受講、算数のSTEP 94〜96は過去完了済み）
    const student: Student = {
      id: 'student-sync-multi',
      name: 'テスト生徒（算数・英語学習中）',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 2,
      day_of_week: ['mon', 'thu'],
      selected_subjects: ['算数', '英語'],
      completed_lesson_ids: ['cm-math-94', 'cm-math-95', 'cm-math-96'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 算数の過去完了進捗
    await db.saveStudentLessonProgress({
      id: 'prog-m-94',
      student_id: 'student-sync-multi',
      lesson_id: 'cm-math-94',
      status: 'completed',
      score: 100
    });
    await db.saveStudentLessonProgress({
      id: 'prog-m-95',
      student_id: 'student-sync-multi',
      lesson_id: 'cm-math-95',
      status: 'completed',
      score: 100
    });
    await db.saveStudentLessonProgress({
      id: 'prog-m-96',
      student_id: 'student-sync-multi',
      lesson_id: 'cm-math-96',
      status: 'completed',
      score: 100
    });

    // 3. 生徒の学習画面に並んでいる本日のコマ割りタスク
    // 算数タスク: STEP 97〜99 の範囲（けいさんもんだい 〜 まとめテスト（１））
    const mathTask: LearningTask = {
      id: 'task-math-today',
      student_id: 'student-sync-multi',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-math-97',
      start_lesson_id: 'cm-math-97',
      end_lesson_id: 'cm-math-99',
      start_lesson_name: 'けいさんもんだい',
      end_lesson_name: 'まとめテスト（１）',
      title: 'けいさんもんだい 〜 まとめテスト（１）',
      status: 'in_progress',
      completed_lesson_ids: []
    };

    // 英語タスク: STEP 1〜3 の範囲（I play soccer (1) 〜 I don't play soccer）
    const engTask: LearningTask = {
      id: 'task-eng-today',
      student_id: 'student-sync-multi',
      scheduled_date: todayStr,
      subject: '英語',
      period: 2,
      unit_id: 'cm-eng-1',
      start_lesson_id: 'cm-eng-1',
      end_lesson_id: 'cm-eng-3',
      start_lesson_name: 'I play soccer (1)',
      end_lesson_name: "I don't play soccer",
      title: "I play soccer (1) 〜 I don't play soccer",
      status: 'in_progress',
      completed_lesson_ids: []
    };

    await db.saveLearningTasks([mathTask, engTask]);

    // 4. TeacherDashboard をレンダリング
    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    // 5. 算数タイムラインの検証
    await waitFor(() => {
      const step94 = screen.getByTestId('timeline-item-cm-math-94');
      const step95 = screen.getByTestId('timeline-item-cm-math-95');
      const step96 = screen.getByTestId('timeline-item-cm-math-96');
      const step97 = screen.getByTestId('timeline-item-cm-math-97');
      const step98 = screen.getByTestId('timeline-item-cm-math-98');
      const step99 = screen.getByTestId('timeline-item-cm-math-99');
      const step100 = screen.getByTestId('timeline-item-cm-math-100');

      // 過去ステップ: ✓ 完了
      expect(step94).toHaveTextContent('✓ 完了');
      expect(step94).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(step95).toHaveTextContent('✓ 完了');
      expect(step95).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(step96).toHaveTextContent('✓ 完了');
      expect(step96).not.toHaveTextContent('📍 現在地（取り組み中）');

      // 今日の授業（取り組み中範囲の全3ステップ）: すべて 📍 現在地（取り組み中）
      expect(step97).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step97).not.toHaveTextContent('✓ 完了');
      expect(step98).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step98).not.toHaveTextContent('✓ 完了');
      expect(step99).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step99).not.toHaveTextContent('✓ 完了');

      // 未来ステップ: ○ 予定
      expect(step100).toHaveTextContent('○ 予定');
      expect(step100).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(step100).not.toHaveTextContent('✓ 完了');
    });

    // 6. 英語タイムラインの検証
    // 科目ボタン「英語」をクリック
    const engBtn = screen.getByRole('button', { name: /英語/ });
    fireEvent.click(engBtn);

    await waitFor(() => {
      const stepEng1 = screen.getByTestId('timeline-item-cm-eng-1');
      const stepEng2 = screen.getByTestId('timeline-item-cm-eng-2');
      const stepEng3 = screen.getByTestId('timeline-item-cm-eng-3');
      const stepEng4 = screen.getByTestId('timeline-item-cm-eng-4');

      // 英語の今日の授業（全3ステップ）: すべて 📍 現在地（取り組み中）
      expect(stepEng1).toHaveTextContent('📍 現在地（取り組み中）');
      expect(stepEng1).not.toHaveTextContent('✓ 完了');
      expect(stepEng2).toHaveTextContent('📍 現在地（取り組み中）');
      expect(stepEng2).not.toHaveTextContent('✓ 完了');
      expect(stepEng3).toHaveTextContent('📍 現在地（取り組み中）');
      expect(stepEng3).not.toHaveTextContent('✓ 完了');

      // 未来ステップ: ○ 予定
      expect(stepEng4).toHaveTextContent('○ 予定');
      expect(stepEng4).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(stepEng4).not.toHaveTextContent('✓ 完了');
    });

    unmount();
  });

  it('should maintain current position synchronization even if teacher selected a different schedule date', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pastStr = '2026-01-01';

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-math-1', grade: '1年生', subject: '算数', unit_name: 'すうじ', lesson_name: '1から5までのかず', sort_order: 1 },
      { id: 'cm-math-2', grade: '1年生', subject: '算数', unit_name: 'すうじ', lesson_name: '6から10までのかず', sort_order: 2 },
      { id: 'cm-math-3', grade: '1年生', subject: '算数', unit_name: 'すうじ', lesson_name: 'いくつといくつ', sort_order: 3 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-date-diff',
      name: '日付非同期検証生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-math-1'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // STEP 1 完了
    await db.saveStudentLessonProgress({
      id: 'prog-diff-1',
      student_id: 'student-date-diff',
      lesson_id: 'cm-math-1',
      status: 'completed',
      score: 100
    });

    // 今日のタスク（STEP 2 が取り組み中）
    const taskToday: LearningTask = {
      id: 'task-today-2',
      student_id: 'student-date-diff',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-math-2',
      start_lesson_id: 'cm-math-2',
      end_lesson_id: 'cm-math-2',
      title: '6から10までのかず',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([taskToday]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    // 講師の日付セレクターを別の日に変更する（過去日）
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: pastStr } });
    }

    // 講師がどの日付を選択していようと、生徒の学習画面で本日進行中のSTEP2が「📍 現在地（取り組み中）」として表示される
    await waitFor(() => {
      const step1 = screen.getByTestId('timeline-item-cm-math-1');
      const step2 = screen.getByTestId('timeline-item-cm-math-2');
      const step3 = screen.getByTestId('timeline-item-cm-math-3');

      expect(step1).toHaveTextContent('✓ 完了');
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step3).toHaveTextContent('○ 予定');
    });

    unmount();
  });

  it('should properly match custom_unit_name and lesson_range string format when task does not specify lesson IDs directly', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-range-1', grade: '2年生', subject: '算数', unit_name: 'たし算とひき算のひっ算', lesson_name: 'たし算のひっ算(1)', sort_order: 1 },
      { id: 'cm-range-2', grade: '2年生', subject: '算数', unit_name: 'たし算とひき算のひっ算', lesson_name: 'たし算のひっ算(2)', sort_order: 2 },
      { id: 'cm-range-3', grade: '2年生', subject: '算数', unit_name: 'たし算とひき算のひっ算', lesson_name: 'たし算のひっ算(3)', sort_order: 3 },
      { id: 'cm-range-4', grade: '2年生', subject: '算数', unit_name: 'たし算とひき算のひっ算', lesson_name: 'まとめテスト（１）', sort_order: 4 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-range-text',
      name: '文字列範囲指定生徒',
      grade: '小2',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 1,
      day_of_week: ['tue'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // IDを直接持たず、名称範囲で設定されたタスク
    const textTask: LearningTask = {
      id: 'task-text-range',
      student_id: 'student-range-text',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_name: 'たし算のひっ算(1)',
      end_lesson_name: 'たし算のひっ算(3)',
      lesson_range: 'たし算のひっ算(1) 〜 たし算のひっ算(3)',
      title: 'たし算のひっ算(1) 〜 たし算のひっ算(3)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([textTask]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      const step1 = screen.getByTestId('timeline-item-cm-range-1');
      const step2 = screen.getByTestId('timeline-item-cm-range-2');
      const step3 = screen.getByTestId('timeline-item-cm-range-3');
      const step4 = screen.getByTestId('timeline-item-cm-range-4');

      // 文字列一致により範囲内の3ステップ全てが 📍 現在地（取り組み中）
      expect(step1).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step3).toHaveTextContent('📍 現在地（取り組み中）');
      // 範囲外のまとめテストは ○ 予定
      expect(step4).toHaveTextContent('○ 予定');
    });

    unmount();
  });

  it('should reflect partial completion within task range: completed lessons become "✓ 完了" and remaining active lessons stay "📍 現在地"', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-part-1', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算のいみ(1)', sort_order: 1 },
      { id: 'cm-part-2', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算のいみ(2)', sort_order: 2 },
      { id: 'cm-part-3', grade: '3年生', subject: '算数', unit_name: 'わり算', lesson_name: 'わり算のけいさん', sort_order: 3 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-partial-sync',
      name: '途中進捗生徒',
      grade: '小3',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 1,
      day_of_week: ['wed'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-part-1'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 範囲はSTEP1〜3だが、STEP1のみcompleted_lesson_idsに含まれるタスク
    const partialTask: LearningTask = {
      id: 'task-partial-today',
      student_id: 'student-partial-sync',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-part-1',
      end_lesson_id: 'cm-part-3',
      start_lesson_name: 'わり算のいみ(1)',
      end_lesson_name: 'わり算のけいさん',
      status: 'in_progress',
      completed_lesson_ids: ['cm-part-1']
    };
    await db.saveLearningTasks([partialTask]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      const step1 = screen.getByTestId('timeline-item-cm-part-1');
      const step2 = screen.getByTestId('timeline-item-cm-part-2');
      const step3 = screen.getByTestId('timeline-item-cm-part-3');

      // 完了したSTEP1は ✓ 完了
      expect(step1).toHaveTextContent('✓ 完了');
      expect(step1).not.toHaveTextContent('📍 現在地（取り組み中）');

      // 残りのSTEP2とSTEP3は 📍 現在地（取り組み中）
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step3).toHaveTextContent('📍 現在地（取り組み中）');
    });

    unmount();
  });

  it('should allow excluding a lesson and dynamically renumber sequence orders while maintaining current position', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-ex-1', grade: '1年生', subject: '算数', unit_name: '角の大きさ', lesson_name: '角の大きさ(1)', sort_order: 1 },
      { id: 'cm-ex-2', grade: '1年生', subject: '算数', unit_name: '角の大きさ', lesson_name: '角の大きさ(2)', sort_order: 2 },
      { id: 'cm-ex-3', grade: '1年生', subject: '算数', unit_name: '角の大きさ', lesson_name: '角の大きさ(3)', sort_order: 3 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-exclude-test',
      name: '除外テスト生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 1,
      day_of_week: ['thu'],
      selected_subjects: ['算数'],
      completed_lesson_ids: [],
      excluded_lesson_ids: ['cm-ex-1'], // STEP1を除外
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // STEP2のタスクが進行中
    const task: LearningTask = {
      id: 'task-ex-2',
      student_id: 'student-exclude-test',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-ex-2',
      start_lesson_id: 'cm-ex-2',
      end_lesson_id: 'cm-ex-2',
      title: '角の大きさ(2)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      // 除外された cm-ex-1 は表示されない
      expect(screen.queryByTestId('timeline-item-cm-ex-1')).not.toBeInTheDocument();

      // cm-ex-2 は繰り上がって STEP 1 となり、📍 現在地（取り組み中）
      const step2 = screen.getByTestId('timeline-item-cm-ex-2');
      expect(step2).toHaveTextContent('STEP 1');
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');

      // cm-ex-3 は STEP 2 となり、○ 予定
      const step3 = screen.getByTestId('timeline-item-cm-ex-3');
      expect(step3).toHaveTextContent('STEP 2');
      expect(step3).toHaveTextContent('○ 予定');
    });

    unmount();
  });

  it('should strictly highlight user exact scenario: Math STEP 97-99, English STEP 42-44, Japanese, with blue border and current position badges', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // カリキュラムマスタの準備
    const sampleMasters: CurriculumMaster[] = [
      // 算数 (STEP 94〜102)
      { id: 'cm-m-94', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: '1~100のかず (2)', sort_order: 94 },
      { id: 'cm-m-95', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: 'かずのしくみ', sort_order: 95 },
      { id: 'cm-m-96', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: '100のかずの大きさ', sort_order: 96 },
      { id: 'cm-m-97', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: 'けいさんもんだい', sort_order: 97 },
      { id: 'cm-m-98', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: '100をこえるかず', sort_order: 98 },
      { id: 'cm-m-99', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: 'まとめテスト（１）', sort_order: 99 },
      { id: 'cm-m-100', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: 'まとめテスト（２）', sort_order: 100 },
      { id: 'cm-m-101', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: 'まとめテスト（３）', sort_order: 101 },
      { id: 'cm-m-102', grade: '1年生', subject: '算数', unit_name: '大きい かず', lesson_name: '単元確認テスト', sort_order: 102, item_type: 'unit_test' },

      // 英語 (STEP 40〜45)
      { id: 'cm-e-40', grade: '1年生', subject: '英語', unit_name: 'Action Verbs', lesson_name: 'I run fast.', sort_order: 40 },
      { id: 'cm-e-41', grade: '1年生', subject: '英語', unit_name: 'Action Verbs', lesson_name: 'I jump high.', sort_order: 41 },
      { id: 'cm-e-42', grade: '1年生', subject: '英語', unit_name: 'I play ○○○.', lesson_name: 'I play ○○○. わたしは○○○をする。', sort_order: 42 },
      { id: 'cm-e-43', grade: '1年生', subject: '英語', unit_name: 'I play ○○○.', lesson_name: 'Do you play ○○○? あなたは○○○をしますか？', sort_order: 43 },
      { id: 'cm-e-44', grade: '1年生', subject: '英語', unit_name: 'I play ○○○.', lesson_name: "I don't play ○○○. わたしは○○○をしません。", sort_order: 44 },
      { id: 'cm-e-45', grade: '1年生', subject: '英語', unit_name: 'Daily Routines', lesson_name: 'I wash my hands.', sort_order: 45 },

      // 国語 (STEP 10〜12)
      { id: 'cm-j-10', grade: '1年生', subject: '国語', unit_name: '漢字の広場', lesson_name: '漢字の広場(1)', sort_order: 10 },
      { id: 'cm-j-11', grade: '1年生', subject: '国語', unit_name: '漢字の広場', lesson_name: '漢字の広場(2)', sort_order: 11 },
      { id: 'cm-j-12', grade: '1年生', subject: '国語', unit_name: 'おはなし', lesson_name: 'おおきなかぶ', sort_order: 12 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-user-exact-scenario',
      name: '本番仕様確認生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 3,
      day_of_week: ['mon', 'thu'],
      selected_subjects: ['算数', '英語', '国語'],
      completed_lesson_ids: ['cm-m-94', 'cm-m-95', 'cm-m-96', 'cm-e-40', 'cm-e-41'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // コマ1: 算数 STEP 97〜99 (けいさんもんだい 〜 まとめテスト（１）)
    const mathTask: LearningTask = {
      id: 'task-math-exact',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-m-97',
      start_lesson_name: '大きい かず - けいさんもんだい',
      end_lesson_name: '大きい かず - まとめテスト（１）',
      lesson_range: '大きい かず - けいさんもんだい 〜 大きい かず - まとめテスト（１）',
      title: '大きい かず - けいさんもんだい 〜 大きい かず - まとめテスト（１）',
      status: 'in_progress',
      completed_lesson_ids: []
    };

    // コマ2: 英語 STEP 42〜44 (I play ○○○. 〜 I don't play ○○○.)
    const engTask: LearningTask = {
      id: 'task-eng-exact',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '英語',
      period: 2,
      unit_id: 'cm-e-42',
      start_lesson_name: 'I play ○○○. わたしは○○○をする。',
      end_lesson_name: "I don't play ○○○. わたしは○○○をしません。",
      lesson_range: "I play ○○○. わたしは○○○をする。 〜 I don't play ○○○. わたしは○○○をしません。",
      title: "I play ○○○. わたしは○○○をする。 〜 I don't play ○○○. わたしは○○○をしません。",
      status: 'in_progress',
      completed_lesson_ids: []
    };

    // コマ3: 国語 STEP 10〜11 (漢字の広場(1) 〜 漢字の広場(2))
    const jpnTask: LearningTask = {
      id: 'task-jpn-exact',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '国語',
      period: 3,
      unit_id: 'cm-j-10',
      start_lesson_name: '漢字の広場(1)',
      end_lesson_name: '漢字の広場(2)',
      lesson_range: '漢字の広場(1) 〜 漢字の広場(2)',
      title: '漢字の広場(1) 〜 漢字の広場(2)',
      status: 'in_progress',
      completed_lesson_ids: []
    };

    await db.saveLearningTasks([mathTask, engTask, jpnTask]);

    // --- 算数の検証 ---
    const { unmount: unmountMath } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      // 算数の過去レッスン STEP 94〜96 は ✓ 完了
      const step94 = screen.getByTestId('timeline-item-cm-m-94');
      const step95 = screen.getByTestId('timeline-item-cm-m-95');
      const step96 = screen.getByTestId('timeline-item-cm-m-96');
      expect(step94).toHaveTextContent('✓ 完了');
      expect(step95).toHaveTextContent('✓ 完了');
      expect(step96).toHaveTextContent('✓ 完了');

      // 算数の当日コマ割りレッスン STEP 97〜99 はすべて 📍 現在地（取り組み中）
      const step97 = screen.getByTestId('timeline-item-cm-m-97');
      const step98 = screen.getByTestId('timeline-item-cm-m-98');
      const step99 = screen.getByTestId('timeline-item-cm-m-99');
      expect(step97).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step98).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step99).toHaveTextContent('📍 現在地（取り組み中）');

      // 青枠ハイライトスタイル
      expect(step97).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      expect(step98).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      expect(step99).toHaveStyle({ borderLeft: '4px solid #2563eb' });

      // 未割当の今後予定 STEP 100〜102 は ○ 予定
      const step100 = screen.getByTestId('timeline-item-cm-m-100');
      const step101 = screen.getByTestId('timeline-item-cm-m-101');
      const step102 = screen.getByTestId('timeline-item-cm-m-102');
      expect(step100).toHaveTextContent('○ 予定');
      expect(step101).toHaveTextContent('○ 予定');
      expect(step102).toHaveTextContent('○ 予定');
    });
    unmountMath();

    // --- 英語の検証 ---
    const { unmount: unmountEng } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    // 教科を「英語」に切り替え
    const engBtn = screen.getByRole('button', { name: /英語/ });
    fireEvent.click(engBtn);

    await waitFor(() => {
      // 過去完了 STEP 40〜41
      const step40 = screen.getByTestId('timeline-item-cm-e-40');
      const step41 = screen.getByTestId('timeline-item-cm-e-41');
      expect(step40).toHaveTextContent('✓ 完了');
      expect(step41).toHaveTextContent('✓ 完了');

      // 本日コマ割り STEP 42〜44 はすべて 📍 現在地（取り組み中）
      const step42 = screen.getByTestId('timeline-item-cm-e-42');
      const step43 = screen.getByTestId('timeline-item-cm-e-43');
      const step44 = screen.getByTestId('timeline-item-cm-e-44');
      expect(step42).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step43).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step44).toHaveTextContent('📍 現在地（取り組み中）');

      // 青枠ハイライト
      expect(step42).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      expect(step43).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      expect(step44).toHaveStyle({ borderLeft: '4px solid #2563eb' });

      // 未割当 STEP 45 は ○ 予定
      const step45 = screen.getByTestId('timeline-item-cm-e-45');
      expect(step45).toHaveTextContent('○ 予定');
    });
    unmountEng();

    // --- 国語の検証 ---
    const { unmount: unmountJpn } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    const jpnBtn = screen.getByRole('button', { name: /国語/ });
    fireEvent.click(jpnBtn);

    await waitFor(() => {
      // 国語の本日コマ割り STEP 10〜11 は 📍 現在地（取り組み中）
      const step10 = screen.getByTestId('timeline-item-cm-j-10');
      const step11 = screen.getByTestId('timeline-item-cm-j-11');
      expect(step10).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step11).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step10).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      expect(step11).toHaveStyle({ borderLeft: '4px solid #2563eb' });

      // 未割当 STEP 12 は ○ 予定
      const step12 = screen.getByTestId('timeline-item-cm-j-12');
      expect(step12).toHaveTextContent('○ 予定');
    });
    unmountJpn();
  });

  it('should enforce current position highlight even when previous unit tests are not passed (no gate test blocking)', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-gate-1', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざん(1)', sort_order: 1 },
      { id: 'cm-gate-2', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: 'たしざん 単元確認テスト', sort_order: 2, item_type: 'unit_test' },
      { id: 'cm-gate-3', grade: '1年生', subject: '算数', unit_name: 'ひきざん', lesson_name: 'ひきざん(1)', sort_order: 3 },
      { id: 'cm-gate-4', grade: '1年生', subject: '算数', unit_name: 'ひきざん', lesson_name: 'ひきざん(2)', sort_order: 4 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-gate-test',
      name: 'テスト合否影響なし生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-gate-1'], // 単元テスト cm-gate-2 は未完了！
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 生徒はSTEP 3（ひきざん(1)）のコマ割りタスクを持っている
    const task: LearningTask = {
      id: 'task-gate-3',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-gate-3',
      start_lesson_name: 'ひきざん(1)',
      end_lesson_name: 'ひきざん(1)',
      title: 'ひきざん(1)',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    const { unmount } = render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      // 過去のテストが未合格記録であっても、生徒の学習画面で割り振られているSTEP 3は合否ゲートで除外されず「📍 現在地（取り組み中）」
      const step3 = screen.getByTestId('timeline-item-cm-gate-3');
      expect(step3).toHaveTextContent('📍 現在地（取り組み中）');
      expect(step3).toHaveStyle({ borderLeft: '4px solid #2563eb' });

      // DBのcompleted_lesson_idsに存在しない未受講の過去ステップ STEP 2 は勝手に完了化されず「○ 予定」
      const step2 = screen.getByTestId('timeline-item-cm-gate-2');
      expect(step2).toHaveTextContent('○ 予定');
      expect(step2).not.toHaveTextContent('✓ 完了');

      // 未割当の未来ステップ STEP 4 は ○ 予定
      const step4 = screen.getByTestId('timeline-item-cm-gate-4');
      expect(step4).toHaveTextContent('○ 予定');
    });

    unmount();
  });
});
