import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';

describe('Universal Dynamic Timeline Status Suite (All Subjects, Grades, and Steps)', () => {
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

  it('should dynamically assign completed, current, and planned status across arbitrary steps in Math without hardcoding', async () => {
    // 任意のステップ群 (STEP 1〜STEP 10) を動的に生成
    const totalSteps = 10;
    const masters: CurriculumMaster[] = [];
    for (let i = 1; i <= totalSteps; i++) {
      masters.push({
        id: `cm-dyn-m-${i}`,
        grade: '2年生',
        subject: '算数',
        unit_name: i <= 5 ? '1章 たし算' : '2章 ひき算',
        lesson_name: `レッスン${i}`,
        sort_order: i
      });
    }
    (db as any).saveMockData('curriculum_masters', masters);

    // 生徒: STEP 1〜3 を完了
    const student: Student = {
      id: 'st-dyn-math',
      name: '動的判定生徒（算数）',
      grade: '小2',
      grade_category: 'elementary',
      school_name: 'テスト小学校',
      period_count: 1,
      day_of_week: ['mon'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-dyn-m-1', 'cm-dyn-m-2', 'cm-dyn-m-3'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 本日のコマ割りタスク: STEP 4〜6 の範囲
    const task: LearningTask = {
      id: 'task-dyn-math',
      student_id: student.id,
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      start_lesson_id: 'cm-dyn-m-4',
      end_lesson_id: 'cm-dyn-m-6',
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
      // 1. STEP 1〜3: 過去完了 ➔ ✓ 完了
      for (let i = 1; i <= 3; i++) {
        const item = screen.getByTestId(`timeline-item-cm-dyn-m-${i}`);
        expect(item).toHaveTextContent('✓ 完了');
        expect(item).not.toHaveTextContent('📍 現在地（取り組み中）');
      }

      // 2. STEP 4〜6: 今日のコマ割り ➔ 📍 現在地（取り組み中）
      for (let i = 4; i <= 6; i++) {
        const item = screen.getByTestId(`timeline-item-cm-dyn-m-${i}`);
        expect(item).toHaveTextContent('📍 現在地（取り組み中）');
        expect(item).toHaveStyle({ borderLeft: '4px solid #2563eb' });
      }

      // 3. STEP 7〜10: 未受講分 ➔ ○ 予定
      for (let i = 7; i <= 10; i++) {
        const item = screen.getByTestId(`timeline-item-cm-dyn-m-${i}`);
        expect(item).toHaveTextContent('○ 予定');
        expect(item).not.toHaveTextContent('📍 現在地（取り組み中）');
        expect(item).not.toHaveTextContent('✓ 完了');
      }
    });

    unmount();
  });

  it('should dynamically assign status in English, Science, Social, and Japanese across arbitrary steps', async () => {
    const subjects = ['英語', '理科', '社会', '国語'] as const;

    for (const subj of subjects) {
      const masters: CurriculumMaster[] = [
        { id: `cm-${subj}-1`, grade: '5年生', subject: subj, unit_name: `${subj}1章`, lesson_name: `${subj}ステップ1`, sort_order: 1 },
        { id: `cm-${subj}-2`, grade: '5年生', subject: subj, unit_name: `${subj}1章`, lesson_name: `${subj}ステップ2`, sort_order: 2 },
        { id: `cm-${subj}-3`, grade: '5年生', subject: subj, unit_name: `${subj}1章`, lesson_name: `${subj}ステップ3`, sort_order: 3 },
        { id: `cm-${subj}-4`, grade: '5年生', subject: subj, unit_name: `${subj}2章`, lesson_name: `${subj}ステップ4`, sort_order: 4 },
        { id: `cm-${subj}-5`, grade: '5年生', subject: subj, unit_name: `${subj}2章`, lesson_name: `${subj}ステップ5`, sort_order: 5 },
      ];
      (db as any).saveMockData('curriculum_masters', masters);

      const student: Student = {
        id: `st-dyn-${subj}`,
        name: `動的判定生徒(${subj})`,
        grade: '小5',
        grade_category: 'elementary',
        school_name: 'テスト小学校',
        period_count: 1,
        day_of_week: ['wed'],
        selected_subjects: [subj],
        completed_lesson_ids: [`cm-${subj}-1`], // STEP 1 完了
        created_at: new Date().toISOString()
      };
      await db.saveStudent(student);

      // 本日のコマ割り: STEP 2〜3
      const task: LearningTask = {
        id: `task-dyn-${subj}`,
        student_id: student.id,
        scheduled_date: todayStr,
        subject: subj,
        period: 1,
        start_lesson_id: `cm-${subj}-2`,
        end_lesson_id: `cm-${subj}-3`,
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
        expect(screen.getByTestId(`timeline-item-cm-${subj}-1`)).toHaveTextContent('✓ 完了');
        expect(screen.getByTestId(`timeline-item-cm-${subj}-2`)).toHaveTextContent('📍 現在地（取り組み中）');
        expect(screen.getByTestId(`timeline-item-cm-${subj}-3`)).toHaveTextContent('📍 現在地（取り組み中）');
        expect(screen.getByTestId(`timeline-item-cm-${subj}-4`)).toHaveTextContent('○ 予定');
        expect(screen.getByTestId(`timeline-item-cm-${subj}-5`)).toHaveTextContent('○ 予定');
      });

      unmount();
    }
  });
});
