import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Strict Timeline Completion Bug Resolution & Accurate Current Position Suite', () => {
  const todayStr = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    db.saveSession({
      user: {
        id: 'u-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        branch_id: null,
        branch_name: '本部統括管理者',
        name: '本部管理者'
      },
      token: 'tok-admin',
      logged_in_at: new Date().toISOString()
    });
  });

  it('strictly marks ONLY actual completed IDs as "✓ 完了", marks today active slot as "📍 現在地", and marks all other uncompleted steps as "○ 予定"', async () => {
    // 算数 小1カリキュラム 20ステップを用意
    // 例: STEP 1〜5: 「かずのならび」
    //     STEP 6〜10: 「大きいかず」「大きいかずのけいさん」「大きいかず まとめテスト」
    //     STEP 11〜20: 「たしざんのひっさん」「まとめテスト2」等
    const masters: CurriculumMaster[] = [];
    for (let i = 1; i <= 20; i++) {
      let lessonName = `レッスン${i}`;
      if (i === 6) lessonName = '大きいかず';
      if (i === 10) lessonName = '大きいかず まとめテスト';
      masters.push({
        id: `cm-strict-m-${i}`,
        grade: '1年生',
        subject: '算数',
        unit_name: i <= 10 ? '大きいかず' : 'たしざんのひっさん',
        lesson_name: lessonName,
        sort_order: i
      });
    }
    (db as any).saveMockData('curriculum_masters', masters);

    // 生徒: 実際に受講完了したIDは STEP 1 と STEP 2 のみ（DBの実データ completed_lesson_ids）
    // STEP 3〜5 は未受講！
    const student: Student = {
      id: 'st-strict-math',
      name: '厳密判定生徒（算数）',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-strict-m-1', 'cm-strict-m-2'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 本日のコマ割り・タスク: STEP 6〜10（「大きいかず」〜「大きいかず まとめテスト」）
    const task: LearningTask = {
      id: 'task-strict-math-today',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-strict-m-6',
      end_lesson_id: 'cm-strict-m-10',
      lesson_range: '大きいかず 〜 大きいかず まとめテスト',
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
      // 1. 生徒が実際に受講完了した STEP 1, 2 のみ「✓ 完了」
      const item1 = screen.getByTestId('timeline-item-cm-strict-m-1');
      expect(item1).toHaveTextContent('✓ 完了');
      expect(item1).not.toHaveTextContent('📍 現在地（取り組み中）');
      expect(item1).not.toHaveTextContent('○ 予定');

      const item2 = screen.getByTestId('timeline-item-cm-strict-m-2');
      expect(item2).toHaveTextContent('✓ 完了');
      expect(item2).not.toHaveTextContent('📍 現在地（取り組み中）');

      // 2. 現在地の手前であっても、completed_lesson_ids にない STEP 3〜5 は絶対に完了にならず「○ 予定」
      for (let i = 3; i <= 5; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-m-${i}`);
        expect(item).toHaveTextContent('○ 予定');
        expect(item).not.toHaveTextContent('✓ 完了');
        expect(item).not.toHaveTextContent('📍 現在地（取り組み中）');
      }

      // 3. 本日のコマ割り・タスク（STEP 6〜10: 大きいかず 〜 大きいかず まとめテスト）は
      //    決して「✓ 完了」にならず、「📍 現在地（取り組み中）」として青色枠＆バッジで最優先表示
      for (let i = 6; i <= 10; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-m-${i}`);
        expect(item).toHaveTextContent('📍 現在地（取り組み中）');
        expect(item).not.toHaveTextContent('✓ 完了');
        expect(item).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      }

      // 4. STEP 11〜20 は未受講なので「○ 予定」
      for (let i = 11; i <= 20; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-m-${i}`);
        expect(item).toHaveTextContent('○ 予定');
        expect(item).not.toHaveTextContent('✓ 完了');
        expect(item).not.toHaveTextContent('📍 現在地（取り組み中）');
      }

      // 5. 上部進捗バーのパーセンテージ計算:
      //    完了は STEP 1, 2 の 2件 のみ。
      //    決して 99% や 100% のような全件完了バグにならない！
      const progressBadge = screen.getByTestId('elementary-progress-percent');
      expect(progressBadge).toHaveTextContent('算数 7% 完了');
      expect(progressBadge).not.toHaveTextContent('99%');
      expect(progressBadge).not.toHaveTextContent('100%');
    });

    unmount();
  });

  it('correctly displays Japanese "カタカナでかく言葉〜まとめテスト2" as current position with strict DB completion', async () => {
    // 国語 小1カリキュラム 15ステップ
    const masters: CurriculumMaster[] = [];
    for (let i = 1; i <= 15; i++) {
      let lessonName = `国語レッスン${i}`;
      if (i === 4) lessonName = 'カタカナでかく言葉';
      if (i === 6) lessonName = 'まとめテスト2';
      masters.push({
        id: `cm-strict-j-${i}`,
        grade: '1年生',
        subject: '国語',
        unit_name: i <= 6 ? 'カタカナでかく言葉' : 'かん字のはなし',
        lesson_name: lessonName,
        sort_order: i
      });
    }
    (db as any).saveMockData('curriculum_masters', masters);

    // 生徒: completed_lesson_ids が空（未受講）
    const student: Student = {
      id: 'st-strict-jp',
      name: '国語判定生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['tue'],
      selected_subjects: ['国語'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 本日のコマ割り・タスク: STEP 4〜6（カタカナでかく言葉〜まとめテスト2）
    const task: LearningTask = {
      id: 'task-strict-jp-today',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '国語',
      period: 1,
      start_lesson_id: 'cm-strict-j-4',
      end_lesson_id: 'cm-strict-j-6',
      lesson_range: 'カタカナでかく言葉 〜 まとめテスト2',
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
      // 1. STEP 1〜3: 未受講なので「○ 予定」
      for (let i = 1; i <= 3; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-j-${i}`);
        expect(item).toHaveTextContent('○ 予定');
        expect(item).not.toHaveTextContent('✓ 完了');
        expect(item).not.toHaveTextContent('📍 現在地（取り組み中）');
      }

      // 2. STEP 4〜6: 本日のコマ割り ➔ 「📍 現在地（取り組み中）」最優先
      for (let i = 4; i <= 6; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-j-${i}`);
        expect(item).toHaveTextContent('📍 現在地（取り組み中）');
        expect(item).not.toHaveTextContent('✓ 完了');
      }

      // 3. STEP 7〜15: 未受講なので「○ 予定」
      for (let i = 7; i <= 15; i++) {
        const item = screen.getByTestId(`timeline-item-cm-strict-j-${i}`);
        expect(item).toHaveTextContent('○ 予定');
        expect(item).not.toHaveTextContent('✓ 完了');
      }

      // 4. 進捗率は 0% 完了
      const progressBadge = screen.getByTestId('elementary-progress-percent');
      expect(progressBadge).toHaveTextContent('国語 0% 完了');
    });

    unmount();
  });
});
