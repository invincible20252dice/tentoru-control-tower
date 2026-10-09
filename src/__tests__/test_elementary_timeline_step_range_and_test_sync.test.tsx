import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, CurriculumMaster, MiniTestResult } from '../lib/db';

describe('Elementary Timeline Step Range and Test Sync Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '100');
  });

  const sampleMasters: CurriculumMaster[] = [
    // 算数: 過去単元「たしざん」
    { id: 'cm-m-add-1', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: 'かずをあらわす', sort_order: 19 },
    { id: 'cm-m-add-2', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: '10までのたしざん(1)', sort_order: 20 },
    { id: 'cm-m-add-3', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: '10までのたしざん(2)', sort_order: 21 },
    { id: 'cm-m-add-4', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: '10までのたしざん(3)', sort_order: 22 },
    // 算数: 現在単元「大きい　かず」
    { id: 'cm-m-big-1', grade: '1年生', subject: '算数', unit_name: '大きい　かず', lesson_name: '1~100のかず(2)', sort_order: 94 },
    { id: 'cm-m-big-2', grade: '1年生', subject: '算数', unit_name: '大きい　かず', lesson_name: 'かずのしくみ', sort_order: 95 },
    { id: 'cm-m-big-3', grade: '1年生', subject: '算数', unit_name: '大きい　かず', lesson_name: '100のかずの大きさ', sort_order: 96 },
    { id: 'cm-m-big-4', grade: '1年生', subject: '算数', unit_name: '大きい　かず', lesson_name: 'けいさんもんだい', sort_order: 97 },
    { id: 'cm-m-big-ut', grade: '1年生', subject: '算数', unit_name: '大きい　かず', lesson_name: '大きい　かず - 単元確認テスト', sort_order: 101, item_type: 'unit_test' },

    // 英語: 過去単元「She is ~.」
    { id: 'cm-e-she-ut', grade: '小3', subject: '英語', unit_name: 'She is ~. かのじょは~です。', lesson_name: 'She is ~. かのじょは~です。 - 単元確認テスト', sort_order: 36, item_type: 'unit_test' },
    // 英語: 現在単元「I like ○○○.」
    { id: 'cm-e-like-1', grade: '3年生', subject: '英語', unit_name: 'I like ○○○. わたしは○○○が好きです。', lesson_name: 'I like ○○○. わたしは○○○が好きです。', sort_order: 37 },
    { id: 'cm-e-like-2', grade: '3年生', subject: '英語', unit_name: 'I like ○○○. わたしは○○○が好きです。', lesson_name: 'Do you like ○○○? あなたは○○○が好きですか？', sort_order: 38 },
    { id: 'cm-e-like-3', grade: '3年生', subject: '英語', unit_name: 'I like ○○○. わたしは○○○が好きです。', lesson_name: "I don't like ○○○. わたしは○○○が好きではない。", sort_order: 39 },
    { id: 'cm-e-like-chk', grade: '小3', subject: '英語', unit_name: 'I like ○○○. わたしは○○○が好きです。', lesson_name: 'Check Test', sort_order: 40 },
    { id: 'cm-e-like-ut', grade: '小3', subject: '英語', unit_name: 'I like ○○○. わたしは○○○が好きです。', lesson_name: 'I like ○○○. わたしは○○○が好きです。 - 単元確認テスト', sort_order: 41, item_type: 'unit_test' },
    // 英語: 未来単元「I study ◯◯◯.」
    { id: 'cm-e-study-1', grade: '3年生', subject: '英語', unit_name: 'I study ◯◯◯. わたしは◯◯◯を勉強（べんきょう）する。', lesson_name: 'STEP 1', sort_order: 50 },
    { id: 'cm-e-study-ut', grade: '小3', subject: '英語', unit_name: 'I study ◯◯◯. わたしは◯◯◯を勉強（べんきょう）する。', lesson_name: 'I study ◯◯◯. わたしは◯◯◯を勉強（べんきょう）する。 - 単元確認テスト', sort_order: 55, item_type: 'unit_test' },
    // 英語: 未来単元「一般動詞 lives」
    { id: 'cm-e-lives-1', grade: '3年生', subject: '英語', unit_name: '一般動詞（いっぱんどうし）（３人称単数）（さんにんしょうたんすう）の文 lives', lesson_name: 'STEP 1', sort_order: 60 },
    { id: 'cm-e-lives-ut', grade: '小3', subject: '英語', unit_name: '一般動詞（いっぱんどうし）（３人称単数）（さんにんしょうたんすう）の文 lives', lesson_name: '一般動詞（いっぱんどうし）（３人称単数）（さんにんしょうたんすう）の文 lives - 単元確認テスト', sort_order: 65, item_type: 'unit_test' },
  ];

  it('1. Math: All 3 lessons within task range (STEP 94, 95, 96) become "現在地（取り組み中）" and past lessons become "✓ 完了"', async () => {
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'std-math-range-test',
      student_id: 'std-math-range-test',
      name: '算数範囲テスト生',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 2,
      day_of_week: ['tue', 'fri'],
      selected_subjects: ['算数'],
      subject_start_positions: {
        '算数': 'たしざん - かずをあらわす'
      },
      completed_lesson_ids: ['cm-m-add-2', 'cm-m-add-3'], // たしざんの途中のみ入っていた状態
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 生徒は過去単元「たしざん」の単元確認テストの合格記録を持っている
    const pastAddMiniResult: MiniTestResult = {
      id: 'mini-add-ut-passed',
      student_id: student.id,
      subject: '算数',
      date: '2026-10-01',
      test_type: 'unit_test',
      unit_name: 'たしざん',
      test_content: '算数: たしざん - 単元確認テスト',
      score: 100,
      passed: true,
      status: 'passed'
    };
    await db.saveMiniTestResult(pastAddMiniResult);

    const todayStr = new Date().toISOString().split('T')[0];
    // コマ割りに「大きい　かず - 1~100のかず(2)」〜「大きい　かず - 100のかずの大きさ」が割り当てられている
    const task: LearningTask = {
      id: 'task-math-range-1',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-m-big-1',
      end_lesson_id: 'cm-m-big-3',
      start_lesson_name: '大きい　かず - 1~100のかず(2)',
      end_lesson_name: '大きい　かず - 100のかずの大きさ',
      status: 'unstarted'
    };
    await db.saveLearningTasks([task]);

    render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" initialStudentId={student.id} initialTab="milestones" />);

    await waitFor(() => {
      // 範囲内の3つすべてが「📍 現在地（取り組み中）」になっていることを検証！
      const item94 = screen.getByTestId('timeline-item-cm-m-big-1');
      const item95 = screen.getByTestId('timeline-item-cm-m-big-2');
      const item96 = screen.getByTestId('timeline-item-cm-m-big-3');

      expect(item94.textContent).toContain('📍 現在地（取り組み中）');
      expect(item95.textContent).toContain('📍 現在地（取り組み中）');
      expect(item96.textContent).toContain('📍 現在地（取り組み中）');

      // 次のレッスンは「○ 予定」
      const item97 = screen.getByTestId('timeline-item-cm-m-big-4');
      expect(item97.textContent).toContain('○ 予定');

      // 過去のレッスン（STEP 19 かずをあらわす、STEP 22 10までのたしざん(3)）は「✓ 完了」になっており、現在地になっていないこと！
      const item19 = screen.getByTestId('timeline-item-cm-m-add-1');
      const item22 = screen.getByTestId('timeline-item-cm-m-add-4');
      expect(item19.textContent).toContain('✓ 完了');
      expect(item19.textContent).not.toContain('📍 現在地（取り組み中）');
      expect(item22.textContent).toContain('✓ 完了');
      expect(item22.textContent).not.toContain('📍 現在地（取り組み中）');
    });
  });

  it('2. English: All 3 lessons within task range become "現在地（取り組み中）" and unattempted future unit tests remain "○ 予定"', async () => {
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'std-eng-range-test',
      student_id: 'std-eng-range-test',
      name: '英語範囲テスト生',
      grade: '小3',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 2,
      day_of_week: ['tue', 'fri'],
      selected_subjects: ['英語'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 生徒は過去の「She is ~.」単元確認テストの合格記録を持っている
    const pastMiniResult: MiniTestResult = {
      id: 'mini-she-ut-passed',
      student_id: student.id,
      subject: '英語',
      date: '2026-10-01',
      test_type: 'unit_test',
      unit_name: 'She is ~. かのじょは~です。',
      test_content: '英語: She is ~. かのじょは~です。 - 単元確認テスト',
      score: 100,
      passed: true,
      status: 'passed'
    };
    await db.saveMiniTestResult(pastMiniResult);

    const todayStr = new Date().toISOString().split('T')[0];
    // コマ割りに「I like ○○○...」の STEP 1 〜 STEP 3 が割り当てられている
    const task: LearningTask = {
      id: 'task-eng-range-1',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '英語',
      period: 1,
      start_lesson_id: 'cm-e-like-1',
      end_lesson_id: 'cm-e-like-3',
      start_lesson_name: 'I like ○○○. わたしは○○○が好きです。 - I like ○○○. わたしは○○○が好きです。',
      end_lesson_name: "I like ○○○. わたしは○○○が好きです。 - I don't like ○○○. わたしは○○○が好きではない。",
      status: 'unstarted'
    };
    await db.saveLearningTasks([task]);

    render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" initialStudentId={student.id} initialTab="milestones" />);

    // 英語タブに切り替え
    const engBtn = screen.getByRole('button', { name: /英語/ });
    fireEvent.click(engBtn);

    await waitFor(() => {
      // 過去単元の「She is ~.」単元確認テストは「✓ 完了」
      const sheUtItem = screen.getByTestId('timeline-item-cm-e-she-ut');
      expect(sheUtItem.textContent).toContain('✓ 完了');

      // 範囲内の3つすべて（STEP 37, 38, 39）が「📍 現在地（取り組み中）」
      const item37 = screen.getByTestId('timeline-item-cm-e-like-1');
      const item38 = screen.getByTestId('timeline-item-cm-e-like-2');
      const item39 = screen.getByTestId('timeline-item-cm-e-like-3');

      expect(item37.textContent).toContain('📍 現在地（取り組み中）');
      expect(item38.textContent).toContain('📍 現在地（取り組み中）');
      expect(item39.textContent).toContain('📍 現在地（取り組み中）');

      // 未受講の「Check Test」は「○ 予定」
      const itemChk = screen.getByTestId('timeline-item-cm-e-like-chk');
      expect(itemChk.textContent).toContain('○ 予定');

      // まだ取り組んでいない単元確認テスト（STEP 41, 55, 65）は絶対に「✓ 完了」にならず、「○ 予定」であること！
      const itemLikeUt = screen.getByTestId('timeline-item-cm-e-like-ut');
      const itemStudyUt = screen.getByTestId('timeline-item-cm-e-study-ut');
      const itemLivesUt = screen.getByTestId('timeline-item-cm-e-lives-ut');

      expect(itemLikeUt.textContent).toContain('○ 予定');
      expect(itemLikeUt.textContent).not.toContain('✓ 完了');

      expect(itemStudyUt.textContent).toContain('○ 予定');
      expect(itemStudyUt.textContent).not.toContain('✓ 完了');

      expect(itemLivesUt.textContent).toContain('○ 予定');
      expect(itemLivesUt.textContent).not.toContain('✓ 完了');
    });
  });

  it('3. Passed unit test correctly turns into "✓ 完了"', async () => {
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'std-eng-passed-ut-test',
      student_id: 'std-eng-passed-ut-test',
      name: '英語合格テスト生',
      grade: '小3',
      grade_category: 'elementary',
      school_name: 'テスト小',
      period_count: 2,
      day_of_week: ['tue', 'fri'],
      selected_subjects: ['英語'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 生徒が「I like ○○○...」の単元確認テストを受験して100点で合格した
    const likeMiniResult: MiniTestResult = {
      id: 'mini-like-ut-passed',
      student_id: student.id,
      subject: '英語',
      date: '2026-10-09',
      test_type: 'unit_test',
      unit_name: 'I like ○○○. わたしは○○○が好きです。',
      test_content: '英語: I like ○○○. わたしは○○○が好きです。 - 単元確認テスト',
      score: 100,
      passed: true,
      status: 'passed'
    };
    await db.saveMiniTestResult(likeMiniResult);

    render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" initialStudentId={student.id} initialTab="milestones" />);

    // 英語タブに切り替え
    const engBtn = screen.getByRole('button', { name: /英語/ });
    fireEvent.click(engBtn);

    await waitFor(() => {
      // 合格した「I like ○○○...」の単元確認テストは「✓ 完了」になっている！
      const itemLikeUt = screen.getByTestId('timeline-item-cm-e-like-ut');
      expect(itemLikeUt.textContent).toContain('✓ 完了');

      // まだ受験していない未来の「I study」や「lives」の単元テストは「○ 予定」のまま！
      const itemStudyUt = screen.getByTestId('timeline-item-cm-e-study-ut');
      const itemLivesUt = screen.getByTestId('timeline-item-cm-e-lives-ut');
      expect(itemStudyUt.textContent).toContain('○ 予定');
      expect(itemLivesUt.textContent).toContain('○ 予定');
    });
  });
});
