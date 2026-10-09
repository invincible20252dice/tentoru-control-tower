import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard, { determineActiveGradeForSubject } from '../components/TeacherDashboard';
import { db, Student, LearningTask, CurriculumMaster } from '../lib/db';

describe('Elementary Timeline Dynamic Grade Follow & Clean Status Scan Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => '入力');
  });

  it('determineActiveGradeForSubject: should accurately find grade of today slots, or first uncompleted step if not in today slots', () => {
    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-m-1', grade: '1年生', subject: '算数', unit_name: 'かずとすうじ', lesson_name: '1から5まで', sort_order: 1 },
      { id: 'cm-m-99', grade: '1年生', subject: '算数', unit_name: 'おおきいかず', lesson_name: 'まとめテスト（１）', sort_order: 99 },
      { id: 'cm-j-1', grade: '2年生', subject: '国語', unit_name: 'カタカナでかく言葉', lesson_name: 'カタカナ(1)', sort_order: 1 },
      { id: 'cm-e-1', grade: '3年生', subject: '英語', unit_name: 'Daily Actions', lesson_name: 'I play soccer', sort_order: 1 },
      { id: 'cm-s-1', grade: '4年生', subject: '理科', unit_name: '天気', lesson_name: '気温のへんか', sort_order: 1 },
    ];

    const student: Student = {
      id: 'std-dyn-1',
      name: '学年追従テスト生徒',
      grade: '小2',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 2,
      day_of_week: ['mon', 'thu'],
      selected_subjects: ['算数', '国語', '英語', '理科'],
      completed_lesson_ids: ['cm-m-1'],
      created_at: new Date().toISOString()
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const tasks: LearningTask[] = [
      // 算数: 1年生のステップ
      {
        id: 'task-m',
        student_id: 'std-dyn-1',
        scheduled_date: todayStr,
        subject: '算数',
        period: 1,
        unit_id: 'cm-m-99',
        start_lesson_name: 'まとめテスト（１）',
        title: 'まとめテスト（１）',
        status: 'in_progress',
        completed_lesson_ids: []
      },
      // 国語: 2年生のステップ
      {
        id: 'task-j',
        student_id: 'std-dyn-1',
        scheduled_date: todayStr,
        subject: '国語',
        period: 2,
        unit_id: 'cm-j-1',
        start_lesson_name: 'カタカナ(1)',
        title: 'カタカナ(1)',
        status: 'in_progress',
        completed_lesson_ids: []
      },
      // 英語: 3年生のステップ
      {
        id: 'task-e',
        student_id: 'std-dyn-1',
        scheduled_date: todayStr,
        subject: '英語',
        period: 3,
        unit_id: 'cm-e-1',
        start_lesson_name: 'I play soccer',
        title: 'I play soccer',
        status: 'in_progress',
        completed_lesson_ids: []
      }
    ];

    // 1. 算数は今日のコマに小1「まとめテスト（１）」があるため ➔ 「小1」
    expect(determineActiveGradeForSubject('算数', student, tasks, undefined, todayStr, sampleMasters)).toBe('小1');

    // 2. 国語は今日のコマに小2「カタカナ(1)」があるため ➔ 「小2」
    expect(determineActiveGradeForSubject('国語', student, tasks, undefined, todayStr, sampleMasters)).toBe('小2');

    // 3. 英語は今日のコマに小3「I play soccer」があるため ➔ 「小3」
    expect(determineActiveGradeForSubject('英語', student, tasks, undefined, todayStr, sampleMasters)).toBe('小3');

    // 4. 理科は今日のコマにないが、未完了先頭ステップが小4「天気」にあるため ➔ 「小4」
    expect(determineActiveGradeForSubject('理科', student, tasks, undefined, todayStr, sampleMasters)).toBe('小4');
  });

  it('UI Interaction: clicking subject button dynamically switches elementary grade tab to matching grade', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      // 算数 (小1)
      { id: 'cm-math-1', grade: '1年生', subject: '算数', unit_name: 'おおきいかず', lesson_name: 'かずのならび', sort_order: 1 },
      // 国語 (小2)
      { id: 'cm-jap-1', grade: '2年生', subject: '国語', unit_name: 'カタカナでかく言葉', lesson_name: 'カタカナ(1)', sort_order: 1 },
      // 英語 (小3)
      { id: 'cm-eng-1', grade: '3年生', subject: '英語', unit_name: 'Daily Actions', lesson_name: 'I play soccer', sort_order: 1 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    const student: Student = {
      id: 'student-multi-grade',
      name: '無段階学習生徒',
      grade: '小2',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 2,
      day_of_week: ['mon', 'thu'],
      selected_subjects: ['算数', '国語', '英語'],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const tasks: LearningTask[] = [
      {
        id: 'task-math-1',
        student_id: 'student-multi-grade',
        scheduled_date: todayStr,
        subject: '算数',
        period: 1,
        unit_id: 'cm-math-1',
        start_lesson_name: 'かずのならび',
        title: 'かずのならび',
        status: 'in_progress',
        completed_lesson_ids: []
      },
      {
        id: 'task-jap-1',
        student_id: 'student-multi-grade',
        scheduled_date: todayStr,
        subject: '国語',
        period: 2,
        unit_id: 'cm-jap-1',
        start_lesson_name: 'カタカナ(1)',
        title: 'カタカナ(1)',
        status: 'in_progress',
        completed_lesson_ids: []
      },
      {
        id: 'task-eng-1',
        student_id: 'student-multi-grade',
        scheduled_date: todayStr,
        subject: '英語',
        period: 3,
        unit_id: 'cm-eng-1',
        start_lesson_name: 'I play soccer',
        title: 'I play soccer',
        status: 'in_progress',
        completed_lesson_ids: []
      }
    ];
    await db.saveLearningTasks(tasks);

    render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    // 算数ボタン押下 ➔ 「1年生」タブが選択状態（青背景）になる
    const mathBtn = await screen.findByTestId('milestone-subject-btn-算数');
    fireEvent.click(mathBtn);

    await waitFor(() => {
      const grade1Btn = screen.getByTestId('elementary-timeline-grade-btn-1年生');
      expect(grade1Btn).toHaveStyle({ backgroundColor: '#2563eb' });
    });

    // 国語ボタン押下 ➔ 「2年生」タブが選択状態（青背景）になる
    const japBtn = screen.getByTestId('milestone-subject-btn-国語');
    fireEvent.click(japBtn);

    await waitFor(() => {
      const grade2Btn = screen.getByTestId('elementary-timeline-grade-btn-2年生');
      expect(grade2Btn).toHaveStyle({ backgroundColor: '#2563eb' });
    });

    // 英語ボタン押下 ➔ 「3年生」タブが選択状態（青背景）になる
    const engBtn = screen.getByTestId('milestone-subject-btn-英語');
    fireEvent.click(engBtn);

    await waitFor(() => {
      const grade3Btn = screen.getByTestId('elementary-timeline-grade-btn-3年生');
      expect(grade3Btn).toHaveStyle({ backgroundColor: '#2563eb' });
    });
  });

  it('Clean scan logic: strictly guards future tests even if completed_lesson_ids contains corrupted future IDs', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-step-1', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: '1+1', sort_order: 1 },
      { id: 'cm-step-2', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: '1+2', sort_order: 2 },
      { id: 'cm-step-3', grade: '1年生', subject: '算数', unit_name: 'たしざん', lesson_name: 'まとめテスト（１）', sort_order: 3 },
      { id: 'cm-step-4', grade: '1年生', subject: '算数', unit_name: 'ひきざん', lesson_name: '2-1', sort_order: 4 },
      { id: 'cm-step-5', grade: '1年生', subject: '算数', unit_name: 'ひきざん', lesson_name: 'まとめテスト（２）', sort_order: 5 },
    ];
    (db as any).saveMockData('curriculum_masters', sampleMasters);

    // 生徒は step 1 を受講完了。しかし未来のまとめテスト（cm-step-5）のIDが誤って completed_lesson_ids に混入
    const student: Student = {
      id: 'student-clean-scan',
      name: 'クリーン走査テスト生徒',
      grade: '小1',
      grade_category: 'elementary',
      school_name: 'てんとる小学校',
      period_count: 2,
      day_of_week: ['mon', 'thu'],
      selected_subjects: ['算数'],
      completed_lesson_ids: ['cm-step-1', 'cm-step-5'],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // 今日の授業は step 2（1+2）
    const task: LearningTask = {
      id: 'task-clean-today',
      student_id: 'student-clean-scan',
      scheduled_date: todayStr,
      subject: '算数',
      period: 1,
      unit_id: 'cm-step-2',
      start_lesson_name: '1+2',
      title: '1+2',
      status: 'in_progress',
      completed_lesson_ids: []
    };
    await db.saveLearningTasks([task]);

    render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={student.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      const step1 = screen.getByTestId('timeline-item-cm-step-1');
      const step2 = screen.getByTestId('timeline-item-cm-step-2');
      const step3 = screen.getByTestId('timeline-item-cm-step-3');
      const step4 = screen.getByTestId('timeline-item-cm-step-4');
      const step5 = screen.getByTestId('timeline-item-cm-step-5');

      // step 1: 現在地手前の過去受講ステップ ➔ ✓ 完了
      expect(step1).toHaveTextContent('✓ 完了');

      // step 2: 今日のコマ ➔ 📍 現在地（取り組み中）
      expect(step2).toHaveTextContent('📍 現在地（取り組み中）');

      // step 3: 現在地以降の未来ステップ ➔ ○ 予定
      expect(step3).toHaveTextContent('○ 予定');

      // step 4: 現在地以降の未来ステップ ➔ ○ 予定
      expect(step4).toHaveTextContent('○ 予定');

      // step 5: 未来のまとめテスト（誤って completed_lesson_ids にあったとしても現在地以降なので確実に予定） ➔ ○ 予定
      expect(step5).toHaveTextContent('○ 予定');
      expect(step5).not.toHaveTextContent('✓ 完了');
    });
  });
});
