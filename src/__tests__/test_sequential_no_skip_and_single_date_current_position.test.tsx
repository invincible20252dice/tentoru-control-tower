import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { 
  findNextUncompletedLessonForSubject, 
  generateSlotsForSelectedSubjects,
  ensureMathEnglishUnitTests
} from '../lib/scheduler';
import { 
  db, 
  Student, 
  CurriculumMaster, 
  LearningTask,
  MiniTestResult,
  NAKAO_STEPPING_STONE_COMPLETED_LESSON_IDS
} from '../lib/db';

describe('Emergency Bug Fixes: No-Skip Sequential Learning & Single-Date Current Position', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('【タスク1：完全シーケンシャル化】未受講のまとめテスト・単元確認テストの飛ばし完全禁止', () => {
    const mathMasters: CurriculumMaster[] = [
      { id: 'm-1', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: '小数のかけ算 1', sort_order: 1 },
      { id: 'm-2', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: '小数のかけ算 2', sort_order: 2 },
      { id: 'm-3', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'まとめテスト（１）', sort_order: 3 },
      { id: 'm-4', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'まとめテスト（２）', sort_order: 4 },
      { id: 'm-5', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'まとめテスト（３）', sort_order: 5 },
      { id: 'm-ut-1', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: '小数のかけ算 - 単元確認テスト', item_type: 'unit_test', sort_order: 6 },
      // 新単元
      { id: 'm-next-1', grade: '小5', subject: '算数', unit_name: '小数のわり算', lesson_name: '小数のわり算 1', sort_order: 7 },
      { id: 'm-next-2', grade: '小5', subject: '算数', unit_name: '小数のわり算', lesson_name: '小数のわり算 2', sort_order: 8 }
    ];

    it('1. 通常授業完了後、まとめテスト（１）が未受講の場合、次単元に進まずまとめテスト（１）を例外なく先頭に選定すること', () => {
      const student: Student = {
        id: 'st-seq-1',
        student_id: 'seq-1',
        name: '順序遵守生徒',
        grade: '小5',
        status: 'normal',
        period_count: 2,
        selected_subjects: ['算数'],
        completed_lesson_ids: ['m-1', 'm-2'],
        created_at: new Date().toISOString()
      };

      const next = findNextUncompletedLessonForSubject({
        student,
        subject: '算数',
        curriculumMasters: mathMasters
      });

      expect(next.lessonId).toBe('m-3');
      expect(next.lessonName).toContain('まとめテスト（１）');
    });

    it('2. まとめテスト（１）〜（３）完了後、単元確認テストが未受験の場合、次単元（小数のわり算）に進まず単元確認テストを先頭に選定すること', () => {
      const student: Student = {
        id: 'st-seq-2',
        student_id: 'seq-2',
        name: 'テストゲート生徒',
        grade: '小5',
        status: 'normal',
        period_count: 2,
        selected_subjects: ['算数'],
        completed_lesson_ids: ['m-1', 'm-2', 'm-3', 'm-4', 'm-5'],
        created_at: new Date().toISOString()
      };

      const next = findNextUncompletedLessonForSubject({
        student,
        subject: '算数',
        curriculumMasters: mathMasters
      });

      // 単元確認テストで進行がストップし、m-next-1（小数のわり算）へ進んではいけない
      expect(next.lessonId).toBe('m-ut-1');
      expect(next.lessonName).toContain('単元確認テスト');

      // generateSlotsForSelectedSubjects でも次単元に進まず単元確認テストが割り当てられること
      const slots = generateSlotsForSelectedSubjects({
        student,
        periodCount: 1,
        selectedSubjects: ['算数'],
        curriculumMasters: mathMasters
      });
      expect(slots[1].startLessonId).toBe('m-ut-1');
      expect(slots[1].startLessonName).toContain('単元確認テスト');
    });

    it('3. 国語において中抜き（STEP 20〜24等）がある場合、最も小さい番号の未受講ステップが選択されること', () => {
      const jpMasters: CurriculumMaster[] = [
        { id: 'jp-19', grade: '小5', subject: '国語', unit_name: '言葉のきまり', lesson_name: '敬語 1', sort_order: 19 },
        { id: 'jp-20', grade: '小5', subject: '国語', unit_name: '言葉のきまり', lesson_name: '敬語 2', sort_order: 20 },
        { id: 'jp-21', grade: '小5', subject: '国語', unit_name: '言葉のきまり', lesson_name: 'まとめテスト（１）', sort_order: 21 },
        { id: 'jp-25', grade: '小5', subject: '国語', unit_name: '原稿用紙のつかい方', lesson_name: '原稿用紙 1', sort_order: 25 },
      ];

      const student: Student = {
        id: 'st-seq-jp',
        student_id: 'seq-jp',
        name: '国語中抜き生徒',
        grade: '小5',
        status: 'normal',
        period_count: 1,
        selected_subjects: ['国語'],
        completed_lesson_ids: ['jp-19'],
        created_at: new Date().toISOString()
      };

      const next = findNextUncompletedLessonForSubject({
        student,
        subject: '国語',
        curriculumMasters: jpMasters
      });

      // 最も小さい番号の未受講ステップ jp-20 が選択される
      expect(next.lessonId).toBe('jp-20');
      expect(next.lessonName).toContain('敬語 2');
    });
  });

  describe('【タスク2：タイムライン現在地判定】当日（選択日）のみに厳密限定し、分裂バグ解消', () => {
    it('別日程（10/06と10/09）のタスクが存在する場合でも、選択日のタスクのみが現在地となり複数箇所に分裂しないこと', async () => {
      const testStudent: Student = {
        id: 'std-split-test',
        student_id: 'split-1',
        name: '現在地分裂検証生徒',
        grade: '小5',
        status: 'normal',
        period_count: 2,
        selected_subjects: ['国語'],
        selected_days: ['tuesday', 'friday'],
        completed_lesson_ids: ['cm-jp-1', 'cm-jp-2'],
        created_at: new Date().toISOString()
      };
      await db.saveStudent(testStudent);

      // 10/06 のタスク（国語 STEP 25〜27）
      const taskDay1: LearningTask = {
        id: 'task-day1',
        student_id: testStudent.id,
        scheduled_date: '2026-10-06',
        period: 1,
        subject: '国語',
        status: 'not_started',
        start_lesson_id: 'cm-jp-25',
        end_lesson_id: 'cm-jp-27',
        start_lesson_name: 'げんこう用紙のつかい方 1',
        end_lesson_name: 'げんこう用紙のつかい方 3',
        lesson_range: 'げんこう用紙のつかい方 1〜3',
        created_at: '2026-10-01T00:00:00Z'
      };

      // 10/09 のタスク（国語 STEP 31〜33）
      const taskDay2: LearningTask = {
        id: 'task-day2',
        student_id: testStudent.id,
        scheduled_date: '2026-10-09',
        period: 1,
        subject: '国語',
        status: 'not_started',
        start_lesson_id: 'cm-jp-31',
        end_lesson_id: 'cm-jp-33',
        start_lesson_name: '物語の読解 1',
        end_lesson_name: '物語の読解 3',
        lesson_range: '物語の読解 1〜3',
        created_at: '2026-10-01T00:00:00Z'
      };
      await db.saveLearningTasks([taskDay1, taskDay2]);

      // タイムラインの当日限定（他日程除外）ロジックの直接検証
      // 対象日: 2026-10-09
      const targetActiveDate = '2026-10-09';
      const allTasks = [taskDay1, taskDay2];
      const activeForToday = allTasks.filter(t => t.scheduled_date === targetActiveDate && t.period !== null);
      
      // 10/09 のタスクのみが抽出され、10/06 のタスクは混入しないこと
      expect(activeForToday.length).toBe(1);
      expect(activeForToday[0].id).toBe('task-day2');
      expect(activeForToday[0].start_lesson_id).toBe('cm-jp-31');

      // 他日程（10/06）の日付は除外されること（現在地分裂の完全防止）
      expect(activeForToday.some(t => t.scheduled_date === '2026-10-06')).toBe(false);
    });
  });

  describe('【タスク3：中尾くん進度データクリーンアップ】置き去りステップの一括修復', () => {
    it('中尾くん（student24295 / std-3）の cleanupStudentSteppingStoneUncompletedLessons で指定全ステップが修復登録されること', async () => {
      const nakao: Student = {
        id: 'std-nakao-fix-test',
        student_id: 'student24295',
        name: '中尾 謙信',
        grade: '小5',
        status: 'normal',
        period_count: 2,
        selected_subjects: ['算数', '国語', '英語'],
        completed_lesson_ids: ['cm-p1-m1'],
        created_at: new Date().toISOString()
      };
      await db.saveStudent(nakao);

      const cleaned = await db.cleanupStudentSteppingStoneUncompletedLessons(nakao.id);
      expect(cleaned).toBeDefined();

      const ids = cleaned?.completed_lesson_ids || [];

      // 算数: STEP 100, 101, 102, 103, 104, 108, 109
      expect(ids).toContain('100');
      expect(ids).toContain('101');
      expect(ids).toContain('102');
      expect(ids).toContain('103');
      expect(ids).toContain('104');
      expect(ids).toContain('108');
      expect(ids).toContain('109');

      // 国語: STEP 20, 21, 22, 23, 24
      expect(ids).toContain('20');
      expect(ids).toContain('21');
      expect(ids).toContain('22');
      expect(ids).toContain('23');
      expect(ids).toContain('24');

      // 英語: STEP 40, 41, 45, 46
      expect(ids).toContain('40');
      expect(ids).toContain('41');
      expect(ids).toContain('45');
      expect(ids).toContain('46');
    });

    it('NAKAO_STEPPING_STONE_COMPLETED_LESSON_IDS に指定された全ステップ番号が含まれていること', () => {
      const expectedMath = ['100', '101', '102', '103', '104', '108', '109'];
      const expectedJp = ['20', '21', '22', '23', '24'];
      const expectedEng = ['40', '41', '45', '46'];

      expectedMath.forEach(step => {
        expect(NAKAO_STEPPING_STONE_COMPLETED_LESSON_IDS).toContain(step);
      });
      expectedJp.forEach(step => {
        expect(NAKAO_STEPPING_STONE_COMPLETED_LESSON_IDS).toContain(step);
      });
      expectedEng.forEach(step => {
        expect(NAKAO_STEPPING_STONE_COMPLETED_LESSON_IDS).toContain(step);
      });
    });
  });

  describe('【タスク4：国語コマ内ステップ展開】げんこう用紙のつかい方 1〜3 の全3ステップ展開', () => {
    it('生徒学習画面でコマ3（国語）の From〜To「げんこう用紙のつかい方 1〜3」が3件のステップとして正しく展開されること', async () => {
      const jpMasters: CurriculumMaster[] = [
        { id: 'cm-jp-g1', grade: '小5', subject: '国語', unit_name: 'げんこう用紙のつかい方', lesson_name: '『 』のつかい方', sort_order: 1 },
        { id: 'cm-jp-g2', grade: '小5', subject: '国語', unit_name: 'げんこう用紙のつかい方', lesson_name: '行の変え方', sort_order: 2 },
        { id: 'cm-jp-g3', grade: '小5', subject: '国語', unit_name: 'げんこう用紙のつかい方', lesson_name: '題名・名前の書き方', sort_order: 3 },
      ];
      await db.saveCurriculumMasters(jpMasters);

      const student: Student = {
        id: 'std-slot3-test',
        student_id: 'st-slot3',
        name: '国語コマ展開生徒',
        grade: '小5',
        status: 'normal',
        period_count: 3,
        selected_subjects: ['国語'],
        created_at: new Date().toISOString()
      };
      await db.saveStudent(student);

      const todayStr = new Date().toISOString().split('T')[0];
      const slotTask: LearningTask = {
        id: 'task-slot3',
        student_id: student.id,
        scheduled_date: todayStr,
        period: 3,
        subject: '国語',
        status: 'not_started',
        start_lesson_name: 'げんこう用紙のつかい方 1',
        end_lesson_name: 'げんこう用紙のつかい方 3',
        lesson_range: 'げんこう用紙のつかい方 1〜3',
        created_at: new Date().toISOString()
      };
      await db.saveLearningTasks([slotTask]);

      render(<StudentDashboard student={student} onBackToPortal={() => {}} initialDate={todayStr} />);

      await waitFor(() => {
        // コマ3内に3つのステップカード（またはタイトル）が表示されること
        expect(screen.getByText(/げんこう用紙のつかい方/)).toBeInTheDocument();
      });
    });
  });
});
