import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateLessonRangeForSlot, 
  generateSlotsForSelectedSubjects, 
  CurriculumSkipViolationError,
  getDisplaySteps,
  getLessonRangeStepIds
} from '../lib/scheduler';
import { 
  db, 
  enforceUnitTestPassingGate, 
  CurriculumMaster, 
  Student, 
  MiniTestResult,
  LearningTask 
} from '../lib/db';

describe('カリキュラム中抜き防止ガード & 単元テスト合否暗号的ゲートの検証', () => {
  const sampleJapaneseMasters: CurriculumMaster[] = [
    {
      id: 'cm-jp-1',
      subject: '国語',
      grade: '小1',
      grade_level: '小1',
      unit_name: '文のきまり',
      lesson_name: '。と、のつかい方',
      sort_order: 1,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-2',
      subject: '国語',
      grade: '小1',
      grade_level: '小1',
      unit_name: '文のきまり',
      lesson_name: 'まとめテスト(1)',
      sort_order: 2,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-3',
      subject: '国語',
      grade: '小1',
      grade_level: '小1',
      unit_name: '文のきまり',
      lesson_name: 'まとめテスト(2)',
      sort_order: 3,
      item_type: 'lesson'
    },
    {
      id: 'cm-jp-4',
      subject: '国語',
      grade: '小1',
      grade_level: '小1',
      unit_name: '文のきまり',
      lesson_name: '単元確認テスト',
      sort_order: 4,
      item_type: 'unit_test'
    }
  ];

  const sampleStudent: Student = {
    id: 'std-test-1',
    student_id: 'student999',
    name: 'テスト生徒',
    email: 'test@student.com',
    grade: '小1',
    school_id: 'sch-1',
    selected_subjects: ['国語'],
    status: 'normal',
    start_unit_id: null,
    completed_lesson_ids: [],
    created_at: new Date().toISOString()
  };

  beforeEach(async () => {
    await db.deleteStudent(sampleStudent.id);
  });

  describe('1. スケジューラーの中抜き物理禁止ガード (CurriculumSkipViolationError)', () => {
    it('手前の未完了ステップがある状態で、未来のステップをFromに指定した場合は CurriculumSkipViolationError をスローする', () => {
      // cm-jp-1 が未完了なのに、cm-jp-2 から開始しようとする
      const studentWithNothingCompleted: Student = {
        ...sampleStudent,
        completed_lesson_ids: []
      };

      expect(() => {
        calculateLessonRangeForSlot({
          subject: '国語',
          startLessonId: 'cm-jp-2', // スキップして2番目から開始しようとする
          lessonsPerSlot: 1,
          curriculumMasters: sampleJapaneseMasters,
          student: studentWithNothingCompleted,
          enforceNoSkip: true
        });
      }).toThrowError(CurriculumSkipViolationError);
    });

    it('未完了最小インデックス（先頭）からの指定であればエラーなく正常にスロットが計算される', () => {
      const studentWithStep1Done: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-jp-1']
      };

      // 次の未完了は cm-jp-2 なので、cm-jp-2 からの開始は正常
      const result = calculateLessonRangeForSlot({
        subject: '国語',
        startLessonId: 'cm-jp-2',
        lessonsPerSlot: 1,
        curriculumMasters: sampleJapaneseMasters,
        student: studentWithStep1Done,
        enforceNoSkip: true
      });

      expect(result.lesson_ids).toEqual(['cm-jp-2']);
      expect(result.start_lesson_id).toBe('cm-jp-2');
      expect(result.end_lesson_id).toBe('cm-jp-2');
    });

    it('generateSlotsForSelectedSubjects において、Fromが未完了先頭に自動固定される', () => {
      const studentWithStep1Done: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-jp-1']
      };

      const slots = generateSlotsForSelectedSubjects({
        student: studentWithStep1Done,
        periodCount: 1,
        selectedSubjects: ['国語'],
        curriculumMasters: sampleJapaneseMasters
      });

      // period 1 のスロットを取得
      const slot1 = slots[1];
      expect(slot1).toBeDefined();
      // cm-jp-1 は完了しているので、開始は cm-jp-2 になること
      expect(slot1.startLessonId).toBe('cm-jp-2');
      expect(slot1.lesson_ids).toEqual(['cm-jp-2', 'cm-jp-3']);
    });
  });

  describe('2. 単元確認テスト合否ゲート (enforceUnitTestPassingGate)', () => {
    it('合格実績のない単元確認テストIDが completed_lesson_ids に含まれていても物理的に除去される', () => {
      const studentWithCorruptedTest: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-jp-1', 'cm-jp-2', 'cm-jp-4'] // cm-jp-4 は単元テストだが合否実績なし
      };

      const miniTestResults: MiniTestResult[] = []; // 合格実績なし

      const sanitized = enforceUnitTestPassingGate(
        studentWithCorruptedTest.id,
        studentWithCorruptedTest.completed_lesson_ids,
        miniTestResults,
        sampleJapaneseMasters
      );

      // 通常ステップ cm-jp-1, cm-jp-2 は残り、cm-jp-4 だけが除外される
      expect(sanitized).toEqual(['cm-jp-1', 'cm-jp-2']);
      expect(sanitized).not.toContain('cm-jp-4');
    });

    it('合格実績（passed: true）が存在する単元確認テストIDは保持される', () => {
      const studentWithPassedTest: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-jp-1', 'cm-jp-2', 'cm-jp-4']
      };

      const miniTestResults: MiniTestResult[] = [
        {
          id: 'mtr-1',
          student_id: studentWithPassedTest.id,
          subject: '国語',
          test_type: 'unit_test',
          unit_name: '文のきまり',
          test_content: '単元確認テスト',
          score: 100,
          passed: true,
          status: 'passed',
          date: '2026-10-12',
          created_at: new Date().toISOString()
        } as any
      ];

      const sanitized = enforceUnitTestPassingGate(
        studentWithPassedTest.id,
        studentWithPassedTest.completed_lesson_ids,
        miniTestResults,
        sampleJapaneseMasters
      );

      expect(sanitized).toContain('cm-jp-4');
      expect(sanitized).toEqual(['cm-jp-1', 'cm-jp-2', 'cm-jp-4']);
    });

    it('db.saveStudent を呼んだ際に、自動的に enforceUnitTestPassingGate が適用され未合格単元テストが弾かれる', async () => {
      const studentToSave: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-jp-1', 'cm-auto-ut-5'] // cm-auto-ut-5 は未合格テスト
      };

      // saveStudent を実行
      await db.saveStudent(studentToSave);

      // 保存されたレコードを検証
      const retrieved = db.getStudentById(studentToSave.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.completed_lesson_ids).not.toContain('cm-auto-ut-5');
      expect(retrieved?.completed_lesson_ids).toEqual(['cm-jp-1']);
    });
  });

  describe('3. ステップ展開完全性 (getDisplaySteps & getLessonRangeStepIds)', () => {
    it('複数ステップの範囲が漏れなく正しい順番で展開される', () => {
      const task: LearningTask = {
        id: 'task-test-multistep',
        student_id: sampleStudent.id,
        unit_id: 'cm-jp-1',
        scheduled_date: '2026-10-15',
        lesson_ids: ['cm-jp-1', 'cm-jp-2', 'cm-jp-3'],
        start_lesson_id: 'cm-jp-1',
        end_lesson_id: 'cm-jp-3',
        subject: '国語',
        grade: '小1'
      } as any;

      const steps = getDisplaySteps(task, {
        curriculumMasters: sampleJapaneseMasters,
        studentGrade: '小1'
      });
      expect(steps.length).toBe(3);
      expect(steps.map(s => s.id)).toEqual(['cm-jp-1', 'cm-jp-2', 'cm-jp-3']);
      expect(steps[0].name).toBe('。と、のつかい方');
      expect(steps[1].name).toBe('まとめテスト(1)');
      expect(steps[2].name).toBe('まとめテスト(2)');
    });

    it('lesson_ids が設定されていないタスクでも start_lesson_id と end_lesson_id から正しく全ステップを展開する', () => {
      const task: LearningTask = {
        id: 'task-test-range-only',
        student_id: sampleStudent.id,
        unit_id: 'cm-jp-1',
        scheduled_date: '2026-10-15',
        start_lesson_id: 'cm-jp-1',
        end_lesson_id: 'cm-jp-3',
        start_lesson_name: '。と、のつかい方',
        end_lesson_name: 'まとめテスト(2)',
        subject: '国語',
        grade: '小1'
      } as any;

      const steps = getDisplaySteps(task, {
        curriculumMasters: sampleJapaneseMasters,
        studentGrade: '小1'
      });
      expect(steps.length).toBe(3);
      expect(steps.map(s => s.id)).toEqual(['cm-jp-1', 'cm-jp-2', 'cm-jp-3']);
    });
  });
});
