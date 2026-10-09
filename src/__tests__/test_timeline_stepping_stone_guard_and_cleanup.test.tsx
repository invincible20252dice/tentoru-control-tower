import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db, Student, LearningTask, sanitizeCorruptedCompletedLessonIds } from '../lib/db';

describe('Timeline Stepping Stone Guard & Corrupted ID Cleanup Test Suite', () => {
  const mockStudentMath: Student = {
    id: 'std-elem-math-test',
    student_id: 'std-math-001',
    name: '算数 太郎',
    grade: '小1',
    school_id: 'sch-1',
    school_name: 'テスト小学校',
    status: 'normal',
    level: 'B',
    selected_subjects: ['算数', '国語'],
    selected_days: ['monday', 'thursday'],
    default_slots: 2,
    created_at: '2026-04-01T00:00:00Z',
    // 過去のテスト実行等で混入した未来の誤完了テストID
    completed_lesson_ids: [
      'cm-p1-m1', // 正常に完了した通常レッスン（STEP 1）
      'cm-p1-m2', // 正常に完了した通常レッスン（STEP 2）
      // 算数小1の「大きい かず」以降の未来のまとめテスト（汚染ID）
      'cm-auto-sum1-算数-小1-大きいかず',
      'cm-auto-sum2-算数-小1-大きいかず',
      'cm-auto-sum1-算数-小1-とけい',
      // 算数小2の未来のまとめテスト（汚染ID）
      'cm-auto-sum1-算数-小2-ひっ算のしかた',
      'cm-auto-sum2-算数-小2-たし算とひき算'
    ]
  };

  const mockStudentJapanese: Student = {
    id: 'std-elem-jp-test',
    student_id: 'std-jp-001',
    name: '国語 花子',
    grade: '小1',
    school_id: 'sch-1',
    school_name: 'テスト小学校',
    status: 'normal',
    level: 'B',
    selected_subjects: ['国語', '算数'],
    selected_days: ['tuesday', 'friday'],
    default_slots: 3,
    created_at: '2026-04-01T00:00:00Z',
    // 国語の誤完了ID（STEP 15以降の未来まとめテストが混入）
    completed_lesson_ids: [
      'cm-p1-jp1', // 正常に完了した通常レッスン
      'cm-auto-sum1-国語-小1-カタカナでかく言葉', // STEP 14のまとめテスト(1)は受講済み
      'cm-auto-sum2-国語-小1-カタカナでかく言葉', // 誤って混入したまとめテスト(2)のID
      'cm-auto-sum3-国語-小1-カタカナでかく言葉', // 誤って混入したまとめテスト(3)のID
      'cm-auto-sum1-国語-小1-かん字のはなし'    // 誤って混入した未来単元のまとめテストID
    ]
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    db.saveSession({
      user: {
        id: 'u-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        name: '管理者'
      },
      token: 'mock-token'
    });
  });

  it('sanitizeCorruptedCompletedLessonIds cleanly removes future summary test IDs for Math and Japanese', () => {
    // 1. 算数の汚染ID除外テスト
    const mathResult = sanitizeCorruptedCompletedLessonIds(mockStudentMath.completed_lesson_ids);
    expect(mathResult.removedCount).toBe(5);
    expect(mathResult.cleanedIds).toEqual(['cm-p1-m1', 'cm-p1-m2']);
    expect(mathResult.cleanedIds).not.toContain('cm-auto-sum1-算数-小1-大きいかず');
    expect(mathResult.cleanedIds).not.toContain('cm-auto-sum1-算数-小2-ひっ算のしかた');

    // 2. 国語の汚染ID除外テスト（カタカナでかく言葉のsum2, sum3およびかん字のはなしのsum1が除外される）
    const jpResult = sanitizeCorruptedCompletedLessonIds(mockStudentJapanese.completed_lesson_ids);
    expect(jpResult.removedCount).toBe(3);
    expect(jpResult.cleanedIds).toContain('cm-p1-jp1');
    expect(jpResult.cleanedIds).toContain('cm-auto-sum1-国語-小1-カタカナでかく言葉');
    expect(jpResult.cleanedIds).not.toContain('cm-auto-sum2-国語-小1-カタカナでかく言葉');
    expect(jpResult.cleanedIds).not.toContain('cm-auto-sum3-国語-小1-カタカナでかく言葉');
    expect(jpResult.cleanedIds).not.toContain('cm-auto-sum1-国語-小1-かん字のはなし');

    // 3. 空配列やundefinedのセーフガード
    expect(sanitizeCorruptedCompletedLessonIds([]).cleanedIds).toEqual([]);
    expect(sanitizeCorruptedCompletedLessonIds(undefined).cleanedIds).toEqual([]);
  });

  it('db.cleanupStudentCorruptedCompletedLessonIds updates and saves student data cleanly', async () => {
    const saved = await db.saveStudent(mockStudentMath);
    // saveStudent 内部でも自動サニタイズが実行されるため、汚染IDは既に除外される
    expect(saved.completed_lesson_ids).toEqual(['cm-p1-m1', 'cm-p1-m2']);
    expect(saved.completed_lesson_ids).not.toContain('cm-auto-sum1-算数-小1-大きいかず');

    // cleanupStudentCorruptedCompletedLessonIds メソッドの直接実行
    const result = await db.cleanupStudentCorruptedCompletedLessonIds(saved.id);
    expect(result).not.toBeNull();
    expect(result?.completed_lesson_ids).toEqual(['cm-p1-m1', 'cm-p1-m2']);
  });

  it('TeacherDashboard stepping stone guard prevents future Math summary tests from being marked as completed', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const mockMasters = [
      { id: 'cm-p1-m1', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 1', sort_order: 1 },
      { id: 'cm-p1-m2', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 2', sort_order: 2 },
      { id: 'cm-p1-m3', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 3', sort_order: 3 },
      { id: 'cm-p1-m4', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'まとめテスト（１）', sort_order: 4 },
      // 未来の単元（STEP 99相当の大きいかず）
      { id: 'cm-auto-sum1-算数-小1-大きいかず', subject: '算数', grade: '小1', unit_name: '大きいかず', lesson_name: 'まとめテスト（１）', sort_order: 99 },
      // 小2の未来単元
      { id: 'cm-auto-sum1-算数-小2-ひっ算のしかた', subject: '算数', grade: '小2', unit_name: 'ひっ算のしかた', lesson_name: 'まとめテスト（１）', sort_order: 120 }
    ];
    (db as any).saveMockData('curriculum_masters', mockMasters);

    await db.saveStudent(mockStudentMath);

    // 本日のアクティブタスク: STEP 3 (かずとすうじ 3)
    const activeTask: LearningTask = {
      id: 'task-math-today',
      student_id: mockStudentMath.id,
      subject: '算数',
      unit_id: 'cm-p1-m3',
      start_lesson_id: 'cm-p1-m3',
      end_lesson_id: 'cm-p1-m3',
      start_lesson_name: 'かずとすうじ 3',
      end_lesson_name: 'かずとすうじ 3',
      scheduled_date: todayStr,
      period: 1,
      status: 'in_progress',
      video_watched: false,
      test_passed: false
    };
    await db.saveLearningTasks([activeTask]);

    render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={mockStudentMath.id}
        initialTab="milestones"
      />
    );

    // タイムラインが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByTestId('elementary-timeline-container')).toBeInTheDocument();
    });

    // 1. STEP 1 & STEP 2 は DB に完了データがあるため「✓ 完了」
    const step1El = screen.getByTestId('timeline-item-cm-p1-m1');
    expect(step1El).toHaveTextContent('✓ 完了');

    const step2El = screen.getByTestId('timeline-item-cm-p1-m2');
    expect(step2El).toHaveTextContent('✓ 完了');

    // 2. 本日の現在地 STEP 3 は「📍 現在地（取り組み中）」
    const step3El = screen.getByTestId('timeline-item-cm-p1-m3');
    expect(step3El).toHaveTextContent('📍 現在地（取り組み中）');

    // 3. 未来のステップ（STEP 4 まとめテスト1）は「○ 予定」
    const step4El = screen.getByTestId('timeline-item-cm-p1-m4');
    expect(step4El).toHaveTextContent('○ 予定');
    expect(step4El).not.toHaveTextContent('✓ 完了');

    // 4. 未来の誤完了IDが入っていた「大きいかず まとめテスト(1)」は、飛び石完了ガードにより絶対に「✓ 完了」にならず「○ 予定」
    const step99El = screen.getByTestId('timeline-item-cm-auto-sum1-算数-小1-大きいかず');
    expect(step99El).toHaveTextContent('○ 予定');
    expect(step99El).not.toHaveTextContent('✓ 完了');
  });

  it('correctly maps Japanese Period 3 (まとめテスト(2)) to current position in timeline and prevents future stepping stone completions', async () => {
    const todayStr = new Date().toISOString().split('T')[0];

    const mockJpMasters = [
      { id: 'cm-p1-jp1', subject: '国語', grade: '小1', unit_name: 'カタカナでかく言葉', lesson_name: 'カタカナのれんしゅう', sort_order: 1 },
      { id: 'cm-auto-sum1-国語-小1-カタカナでかく言葉', subject: '国語', grade: '小1', unit_name: 'カタカナでかく言葉', lesson_name: 'まとめテスト（１）', sort_order: 14 },
      // コマ3の対象ステップ
      { id: 'cm-auto-sum2-国語-小1-カタカナでかく言葉', subject: '国語', grade: '小1', unit_name: 'カタカナでかく言葉', lesson_name: 'まとめテスト（２）', sort_order: 15 },
      // 未来のステップ
      { id: 'cm-auto-sum3-国語-小1-カタカナでかく言葉', subject: '国語', grade: '小1', unit_name: 'カタカナでかく言葉', lesson_name: 'まとめテスト（３）', sort_order: 16 },
      { id: 'cm-auto-sum1-国語-小1-かん字のはなし', subject: '国語', grade: '小1', unit_name: 'かん字のはなし', lesson_name: 'まとめテスト（１）', sort_order: 20 }
    ];
    (db as any).saveMockData('curriculum_masters', mockJpMasters);

    await db.saveStudent(mockStudentJapanese);

    // コマ3に割り当てられた国語タスク: STEP 1: まとめテスト(2)（表記揺れ: カタカナでかく言葉 - まとめテスト（２） または まとめテスト(2)）
    const period3Task: LearningTask = {
      id: 'task-jp-period3',
      student_id: mockStudentJapanese.id,
      subject: '国語',
      unit_id: 'cm-auto-sum2-国語-小1-カタカナでかく言葉',
      start_lesson_id: 'cm-auto-sum2-国語-小1-カタカナでかく言葉',
      end_lesson_id: 'cm-auto-sum2-国語-小1-カタカナでかく言葉',
      start_lesson_name: 'まとめテスト(2)',
      end_lesson_name: 'まとめテスト(2)',
      lesson_range: 'まとめテスト(2)',
      custom_unit_name: 'カタカナでかく言葉 - まとめテスト(2)',
      scheduled_date: todayStr,
      period: 3,
      status: 'in_progress',
      video_watched: false,
      test_passed: false
    };
    await db.saveLearningTasks([period3Task]);

    render(
      <TeacherDashboard
        onLogout={() => {}}
        teacherType="elementary"
        initialStudentId={mockStudentJapanese.id}
        initialTab="milestones"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('elementary-timeline-container')).toBeInTheDocument();
    });

    // 1. STEP 1 は完了
    const step1El = screen.getByTestId('timeline-item-cm-p1-jp1');
    expect(step1El).toHaveTextContent('✓ 完了');

    // 2. まとめテスト(1) は受講済みのため「✓ 完了」
    const sum1El = screen.getByTestId('timeline-item-cm-auto-sum1-国語-小1-カタカナでかく言葉');
    expect(sum1El).toHaveTextContent('✓ 完了');

    // 3. コマ3のまとめテスト(2) は、タイムライン上で青枠ハイライト「📍 現在地（取り組み中）」として描画される！
    const sum2El = screen.getByTestId('timeline-item-cm-auto-sum2-国語-小1-カタカナでかく言葉');
    expect(sum2El).toHaveTextContent('📍 現在地（取り組み中）');
    expect(sum2El).not.toHaveTextContent('✓ 完了');

    // 4. 未来のまとめテスト(3) および かん字のはなし は、過去の汚染データに関わらず強制的に「○ 予定」
    const sum3El = screen.getByTestId('timeline-item-cm-auto-sum3-国語-小1-カタカナでかく言葉');
    expect(sum3El).toHaveTextContent('○ 予定');
    expect(sum3El).not.toHaveTextContent('✓ 完了');

    const futureUnitSum1El = screen.getByTestId('timeline-item-cm-auto-sum1-国語-小1-かん字のはなし');
    expect(futureUnitSum1El).toHaveTextContent('○ 予定');
    expect(futureUnitSum1El).not.toHaveTextContent('✓ 完了');
  });
});
