import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateLessonRangeForSlot, 
  generateSlotsForSelectedSubjects, 
  CurriculumSkipViolationError,
  getDisplaySteps,
  getLessonRangeStepIds,
  findNextUncompletedLessonForSubject
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

  describe('4. 受入基準 5大 Invariants 完全性検証', () => {
    it('Invariant 1 & 5: 国語コマ3が「かきじゅん - まとめテスト(1)〜(3)」の3件を展開し、1件に丸め込まれないこと', () => {
      const kakijunMasters: CurriculumMaster[] = [
        { id: 'cm-auto-sum1-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'かきじゅん - まとめテスト(1)', sort_order: 8, item_type: 'lesson' },
        { id: 'cm-auto-sum2-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'かきじゅん - まとめテスト(2)', sort_order: 9, item_type: 'lesson' },
        { id: 'cm-auto-sum3-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'かきじゅん - まとめテスト(3)', sort_order: 10, item_type: 'lesson' }
      ];

      const jpTask3 = {
        subject: '国語',
        start_lesson_name: 'かきじゅん - まとめテスト(1)',
        end_lesson_name: 'かきじゅん - まとめテスト(3)',
        start_lesson_id: 'cm-auto-sum1-国語-小2-かきじゅん',
        end_lesson_id: 'cm-auto-sum3-国語-小2-かきじゅん',
        lesson_range: 'かきじゅん - まとめテスト(1) 〜 かきじゅん - まとめテスト(3)',
        custom_unit_name: 'かきじゅん - まとめテスト(1) 〜 かきじゅん - まとめテスト(3)',
        lesson_ids: ['cm-auto-sum1-国語-小2-かきじゅん', 'cm-auto-sum2-国語-小2-かきじゅん', 'cm-auto-sum3-国語-小2-かきじゅん']
      };

      const resolved = getDisplaySteps(jpTask3, {
        curriculumMasters: kakijunMasters,
        studentGrade: '小2'
      });

      expect(resolved.length).toBe(3);
      expect(resolved[0].id).toBe('cm-auto-sum1-国語-小2-かきじゅん');
      expect(resolved[1].id).toBe('cm-auto-sum2-国語-小2-かきじゅん');
      expect(resolved[2].id).toBe('cm-auto-sum3-国語-小2-かきじゅん');
      expect(resolved.every(s => !s.isUnitTest)).toBe(true);
    });

    it('Invariant 2: 国語タイムラインにおいて、STEP 8〜10 が現在地であり、STEP 8の手前に未完了が存在しないこと', () => {
      const fullMasters: CurriculumMaster[] = [
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `cm-1786672452619-${i + 1}`,
          subject: '国語',
          grade: '小1',
          unit_name: 'ことばあそび',
          lesson_name: `ことばあそび(${i + 1})`,
          sort_order: i + 1,
          item_type: 'lesson' as const
        })),
        { id: 'cm-1786672452619-5', subject: '国語', grade: '小1', unit_name: 'ことばあそび', lesson_name: 'まとめテスト（１）', sort_order: 5, item_type: 'lesson' as const },
        { id: 'cm-1786672452619-6', subject: '国語', grade: '小1', unit_name: 'ことばあそび', lesson_name: 'まとめテスト（２）', sort_order: 6, item_type: 'lesson' as const },
        { id: 'cm-1786672452619-7', subject: '国語', grade: '小1', unit_name: 'ことばあそび', lesson_name: 'まとめテスト（３）', sort_order: 7, item_type: 'lesson' as const },
        { id: 'cm-auto-sum1-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'まとめテスト(1)', sort_order: 8, item_type: 'lesson' },
        { id: 'cm-auto-sum2-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'まとめテスト(2)', sort_order: 9, item_type: 'lesson' },
        { id: 'cm-auto-sum3-国語-小2-かきじゅん', subject: '国語', grade: '小2', unit_name: 'かきじゅん', lesson_name: 'まとめテスト(3)', sort_order: 10, item_type: 'lesson' },
        { id: 'cm-1786672452619-11', subject: '国語', grade: '小2', unit_name: '次単元', lesson_name: '授業11', sort_order: 11, item_type: 'lesson' }
      ];

      // STEP 1〜7 が完了している生徒
      const completedIds = Array.from({ length: 7 }, (_, i) => `cm-1786672452619-${i + 1}`);
      const student: Student = {
        ...sampleStudent,
        completed_lesson_ids: completedIds
      };

      // 次の未完了ステップを探す
      const next = findNextUncompletedLessonForSubject({
        student,
        subject: '国語',
        tasks: [],
        curriculumMasters: fullMasters
      });

      expect(next).toBeDefined();
      expect(next?.lessonId).toBe('cm-auto-sum1-国語-小2-かきじゅん');
      expect(next?.masterIndex).toBe(7); // STEP 8 (index 7)

      // 手前（STEP 1〜7）に未完了が存在しないことの確認
      for (let i = 0; i < 7; i++) {
        expect(completedIds).toContain(fullMasters[i].id);
      }
    });

    it('Invariant 3: 算数 STEP 5（単元確認テスト）が completed_lesson_ids に含まれていないこと', () => {
      const mathStudentCompleted = [
        'cm-1786673232230-1', 'cm-auto-ut-算数-小1-かずと すうじ', '5', 'STEP 5'
      ];
      const sanitized = enforceUnitTestPassingGate(
        'std-math',
        mathStudentCompleted,
        [], // 合格記録なし
        [
          { id: 'cm-1786673232230-1', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: '授業1', sort_order: 1, item_type: 'lesson' },
          { id: 'cm-auto-ut-算数-小1-かずと すうじ', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'かずと すうじ - 単元確認テスト', sort_order: 5, item_type: 'unit_test' }
        ]
      );

      expect(sanitized).not.toContain('cm-auto-ut-算数-小1-かずと すうじ');
      expect(sanitized).not.toContain('5');
      expect(sanitized).not.toContain('STEP 5');
      expect(sanitized).toEqual(['cm-1786673232230-1']);
    });

    it('Invariant 4: 英語コマ2が STEP 4 から開始され、Check Test へ飛ぶ乖離が発生しないこと', () => {
      const engMasters: CurriculumMaster[] = [
        { id: 'cm-1786672798566-1', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'I am ~. わたしは〜です。', sort_order: 1, item_type: 'lesson' },
        { id: 'cm-1786672798566-2', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'I am 2', sort_order: 2, item_type: 'lesson' },
        { id: 'cm-1786672798566-3', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'I am 3', sort_order: 3, item_type: 'lesson' },
        { id: 'cm-1786672798566-4', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'I am ~. - I’m  a 〜. わたしは〜がくせい（学生）です。', sort_order: 4, item_type: 'lesson' },
        { id: 'cm-1786672798566-5', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'I am not', sort_order: 5, item_type: 'lesson' },
        { id: 'cm-auto-check-英語-小1-I am', subject: '英語', grade: '小1', unit_name: 'I am', lesson_name: 'Check Test', sort_order: 6, item_type: 'lesson' }
      ];

      const engStudent: Student = {
        ...sampleStudent,
        completed_lesson_ids: ['cm-1786672798566-1', 'cm-1786672798566-2', 'cm-1786672798566-3']
      };

      const nextEng = findNextUncompletedLessonForSubject({
        student: engStudent,
        subject: '英語',
        tasks: [],
        curriculumMasters: engMasters
      });

      expect(nextEng).toBeDefined();
      expect(nextEng?.lessonId).toBe('cm-1786672798566-4');

      const range = calculateLessonRangeForSlot({
        subject: '英語',
        startLessonId: nextEng!.lessonId,
        lessonsPerSlot: 1,
        curriculumMasters: engMasters,
        student: engStudent,
        enforceNoSkip: true
      });

      expect(range.start_lesson_id).toBe('cm-1786672798566-4');
      expect(range.lesson_ids).toEqual(['cm-1786672798566-4']);
      expect(range.start_lesson_name).toContain("I’m  a 〜");
    });
  });

  describe('5. 学年跨ぎ現在地誤爆撤廃・単元テスト合格照合完全義務化・中抜き飛び石遮断の徹底検証', () => {
    const multiGradeMasters: CurriculumMaster[] = [
      // 1年生
      { id: 'cm-g1-1', subject: '算数', grade: '小1', unit_name: 'かず', lesson_name: '1から5', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-g1-2', subject: '算数', grade: '小1', unit_name: 'かず', lesson_name: '6から10', sort_order: 2, item_type: 'lesson' },
      { id: 'cm-g1-ut', subject: '算数', grade: '小1', unit_name: 'かず', lesson_name: 'かず - 単元確認テスト', sort_order: 3, item_type: 'unit_test' },
      // 2年生
      { id: 'cm-g2-1', subject: '算数', grade: '小2', unit_name: 'ひきざん', lesson_name: 'ひきざんのしかた', sort_order: 4, item_type: 'lesson' },
      { id: 'cm-g2-2', subject: '算数', grade: '小2', unit_name: 'ひきざん', lesson_name: 'まとめテスト(1)', sort_order: 5, item_type: 'lesson' },
      { id: 'cm-g2-ut', subject: '算数', grade: '小2', unit_name: 'ひきざん', lesson_name: 'ひきざん - 単元確認テスト', sort_order: 6, item_type: 'unit_test' },
      // 3年生（未来学年）
      { id: 'cm-g3-1', subject: '算数', grade: '小3', unit_name: 'かけざん', lesson_name: '九九', sort_order: 7, item_type: 'lesson' },
      { id: 'cm-g3-2', subject: '算数', grade: '小3', unit_name: 'かけざん', lesson_name: 'まとめテスト(1)', sort_order: 8, item_type: 'lesson' }
    ];

    it('未来の学年（3年）タブを開いた時、本日のコマ割りに含まれないためSTEP 1を含め全ステップが「○ 予定」になること（現在地誤爆ゼロ）', () => {
      // 生徒は1年生で、本日のコマ割りは 1年生の cm-g1-2
      const todayActiveIds = new Set(['cm-g1-2']);
      const completedIds = new Set(['cm-g1-1']);
      const miniTestPassedSet = new Set<string>();

      // 3年生のタイムライン表示ユニット
      const g3TimelineUnits = multiGradeMasters.filter(m => m.grade === '小3');

      // 全体マスタ走査による真の完了セット構築
      const trulyCompleted = new Set<string>();
      let hasIncomplete = false;
      for (const m of multiGradeMasters) {
        if (hasIncomplete) continue;
        const isDone = completedIds.has(m.id);
        if (isDone) trulyCompleted.add(m.id);
        else hasIncomplete = true;
      }

      const statusMap = new Map<string, string>();
      g3TimelineUnits.forEach(u => {
        const isDone = trulyCompleted.has(u.id);
        const isActive = todayActiveIds.has(u.id);
        let status = 'planned';
        if (isDone) status = 'completed';
        else if (isActive) status = 'current';
        statusMap.set(u.id, status);
      });

      // 3年生の STEP 1 も STEP 2 も例外なく「planned」であり、「current」ではないこと！
      expect(statusMap.get('cm-g3-1')).toBe('planned');
      expect(statusMap.get('cm-g3-2')).toBe('planned');
      expect(Array.from(statusMap.values()).every(s => s === 'planned')).toBe(true);
    });

    it('未合格の単元確認テスト（STEP 5, 44, 62等）は、completed_lesson_ids に入っていても完了にならず planned になること', () => {
      const studentCompletedWithFakeTests = ['cm-g1-1', 'cm-g1-2', 'cm-g1-ut', '5', '44', '62'];
      const miniTestResults: MiniTestResult[] = []; // 合格記録ゼロ

      const sanitized = enforceUnitTestPassingGate(
        'std-fake-gate',
        studentCompletedWithFakeTests,
        miniTestResults,
        multiGradeMasters
      );

      // 単元確認テスト cm-g1-ut, 5, 44, 62 は合格記録がないためすべて除外される
      expect(sanitized).not.toContain('cm-g1-ut');
      expect(sanitized).not.toContain('5');
      expect(sanitized).not.toContain('44');
      expect(sanitized).not.toContain('62');
      expect(sanitized).toEqual(['cm-g1-1', 'cm-g1-2']);
    });

    it('中抜き・飛び石受講の物理的遮断: 最初の未完了ステップに遭遇した以降の未来ステップは完了として扱われないこと', () => {
      // 英語カリキュラム: STEP 1〜3 完了、STEP 4〜6 未完了、STEP 7〜11 が勝手に完了に入っている汚染状態
      const engUnits: CurriculumMaster[] = Array.from({ length: 11 }, (_, i) => ({
        id: `eng-step-${i + 1}`,
        subject: '英語',
        grade: '小1',
        unit_name: '英語単元',
        lesson_name: `Lesson ${i + 1}`,
        sort_order: i + 1,
        item_type: 'lesson'
      }));

      const corruptedCompletedIds = new Set([
        'eng-step-1', 'eng-step-2', 'eng-step-3',
        // 4, 5, 6 は未受講
        'eng-step-7', 'eng-step-8', 'eng-step-9', 'eng-step-10', 'eng-step-11'
      ]);

      const trulyCompleted = new Set<string>();
      let hasIncomplete = false;

      for (let i = 0; i < engUnits.length; i++) {
        const u = engUnits[i];
        if (hasIncomplete) continue; // 最初の未完了以降は物理遮断
        if (corruptedCompletedIds.has(u.id)) {
          trulyCompleted.add(u.id);
        } else {
          hasIncomplete = true;
        }
      }

      // STEP 1〜3 のみが完了として残り、飛び石完了（STEP 7〜11）はすべて遮断される
      expect(trulyCompleted.has('eng-step-1')).toBe(true);
      expect(trulyCompleted.has('eng-step-2')).toBe(true);
      expect(trulyCompleted.has('eng-step-3')).toBe(true);
      expect(trulyCompleted.has('eng-step-4')).toBe(false);
      expect(trulyCompleted.has('eng-step-7')).toBe(false);
      expect(trulyCompleted.has('eng-step-8')).toBe(false);
      expect(trulyCompleted.has('eng-step-11')).toBe(false);
      expect(trulyCompleted.size).toBe(3);
    });
  });
});
