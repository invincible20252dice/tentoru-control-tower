import { createClient } from '@supabase/supabase-js';
import { 
  db, 
  CurriculumMaster, 
  Student, 
  MiniTestResult, 
  LearningTask, 
  enforceUnitTestPassingGate 
} from '../src/lib/db';
import { 
  getDisplaySteps, 
  getLessonRangeStepIds, 
  findNextUncompletedLessonForSubject,
  calculateLessonRangeForSlot,
  ensureMathEnglishUnitTests,
  CurriculumSkipViolationError
} from '../src/lib/scheduler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqwnciwyzstiqszdgekr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd25jaXd5enN0aXFzemRnZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTYyOTgsImV4cCI6MjEwMDg5MjI5OH0.eGbXPVamL-6hMOehuViThOrkG1I_HGSajdLbGQE7c8M';

let supabase: any = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'mock') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('Supabase client initialization skipped/failed:', e);
  }
}

export async function runCurriculumIntegrityCheck(): Promise<boolean> {
  console.log('================================================================');
  console.log('   カリキュラム整合性・自律自己修復検証ランナー (Integrity Check)   ');
  console.log('================================================================\n');

  let maxIterations = 3;
  let iteration = 0;
  let allPassed = false;

  while (iteration < maxIterations && !allPassed) {
    iteration++;
    console.log(`>>> 検証イテレーション ${iteration}/${maxIterations} 開始`);
    const errors: string[] = [];

    // ローカルデータの準備
    const rawMasters = db.getCurriculumMasters();
    const students = db.getStudents();
    const miniTestResults = db.getMiniTestResults();
    const learningTasks = db.getLearningTasks();

    // Supabase 側の生徒データも取得（利用可能な場合）
    let supabaseStudents: any[] = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from('students').select('*');
        if (!error && data) {
          supabaseStudents = data.map((s: any) => ({
            ...s,
            completed_lesson_ids: typeof s.completed_lesson_ids === 'string'
              ? JSON.parse(s.completed_lesson_ids)
              : (s.completed_lesson_ids || [])
          }));
        }
      } catch (err) {
        console.warn('Supabase students fetch warning:', err);
      }
    }

    // -------------------------------------------------------------
    // Invariant 2: テスト誤完了ゼロ検証 (Unit Test Crypto-Gate)
    // -------------------------------------------------------------
    console.log('[Invariant 2] 単元テスト合否ゲート・誤完了ゼロ検証中...');
    
    // (A) ローカルDBの検証 & 自己修復
    for (const student of students) {
      const originalCompleted = [...(student.completed_lesson_ids || [])];
      const sanitizedCompleted = enforceUnitTestPassingGate(
        student.id,
        originalCompleted,
        miniTestResults,
        rawMasters
      );
      
      const removed = originalCompleted.filter(id => !sanitizedCompleted.includes(id));
      if (removed.length > 0) {
        const errMsg = `[Invariant 2 Violation] 生徒 ${student.name} (${student.id}) の completed_lesson_ids に合格実績のない単元テストが含まれていました: ${removed.join(', ')}`;
        errors.push(errMsg);
        console.warn(`  ! 自己修復実行: ${errMsg}`);
        student.completed_lesson_ids = sanitizedCompleted;
        await db.saveStudent(student);
      }
    }

    // (B) Supabase 本番DBの検証 & 自己修復
    if (supabase && supabaseStudents.length > 0) {
      for (const s of supabaseStudents) {
        const originalCompleted: string[] = s.completed_lesson_ids || [];
        const sanitizedCompleted = enforceUnitTestPassingGate(
          s.id || s.student_id,
          originalCompleted,
          miniTestResults,
          rawMasters
        );
        const removed = originalCompleted.filter(id => !sanitizedCompleted.includes(id));
        if (removed.length > 0) {
          const errMsg = `[Invariant 2 Supabase Violation] 本番 生徒 ${s.name} (${s.student_id || s.id}) に未合格単元テスト混入: ${removed.join(', ')}`;
          errors.push(errMsg);
          console.warn(`  ! Supabase 本番自己修復 UPDATE 実行: ${errMsg}`);
          try {
            await supabase
              .from('students')
              .update({ completed_lesson_ids: sanitizedCompleted })
              .eq('id', s.id);
          } catch (err) {
            console.error('Supabase update failed:', err);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Invariant 1: 中抜きゼロ検証 (No-Skip Invariant)
    // -------------------------------------------------------------
    console.log('[Invariant 1] カリキュラム中抜き・飛び石受講ゼロ検証中...');
    // 教科ごとにグループ化してステップ順序を作成
    const subjects = Array.from(new Set(rawMasters.map(m => m.subject)));
    for (const student of students) {
      const studentCompleted = new Set(student.completed_lesson_ids || []);

      for (const subj of subjects) {
        const subjMasters = rawMasters.filter(m => m.subject === subj);
        const ensuredMasters = ensureMathEnglishUnitTests(subjMasters);
        ensuredMasters.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

        let seenUncompleted = false;
        let firstUncompletedIdx = -1;

        for (let i = 0; i < ensuredMasters.length; i++) {
          const m = ensuredMasters[i];
          const isDone = studentCompleted.has(m.id) || 
                         studentCompleted.has(String(m.id)) || 
                         (m.sort_order !== undefined && studentCompleted.has(String(m.sort_order)));

          if (!isDone && !seenUncompleted) {
            seenUncompleted = true;
            firstUncompletedIdx = i;
          } else if (isDone && seenUncompleted) {
            // 手前が未完了なのに後ろが完了になっている
            const uncompletedStep = ensuredMasters[firstUncompletedIdx];
            const errMsg = `[Invariant 1 Violation] 生徒 ${student.name} (${student.id}) の教科「${subj}」にて中抜き検出: STEP ${uncompletedStep.sort_order || firstUncompletedIdx + 1} (${uncompletedStep.lesson_name}) が未完了であるにもかかわらず、未来の STEP ${m.sort_order || i + 1} (${m.lesson_name}) が完了になっています。`;
            errors.push(errMsg);
            console.warn(`  ! 自己修復実行: 未受講飛び石ステップ ${m.id} を completed_lesson_ids から除外します。`);

            student.completed_lesson_ids = (student.completed_lesson_ids || []).filter(id => id !== m.id && String(id) !== String(m.sort_order));
            await db.saveStudent(student);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Invariant 3: 画面連動一致検証 (Timeline & Next Slot Alignment)
    // -------------------------------------------------------------
    console.log('[Invariant 3] タイムライン現在地とタスク From の 100% 一致検証中...');
    for (const student of students) {
      const studentTasks = learningTasks.filter(t => t.student_id === student.id || t.student_id === student.student_id);

      for (const subj of subjects) {
        const nextStep = findNextUncompletedLessonForSubject({
          student,
          subject: subj,
          tasks: learningTasks,
          curriculumMasters: rawMasters
        });
        if (!nextStep || !nextStep.lessonId) continue;

        const relevantTask = studentTasks.find(t => (t as any).subject === subj);
        if (relevantTask && (relevantTask.lesson_ids && relevantTask.lesson_ids.length > 0)) {
          const scheduledFromId = relevantTask.lesson_ids[0];
          if (scheduledFromId !== nextStep.lessonId) {
            const errMsg = `[Invariant 3 Violation] 生徒 ${student.name} (${student.id})「${subj}」のタスク開始ステップ (${scheduledFromId}) と、カリキュラムの次未完了ステップ (${nextStep.lessonId}) が一致していません。`;
            errors.push(errMsg);
            console.warn(`  ! 自己修復実行: タスク開始位置を未完了先頭 (${nextStep.lessonId}) に再同期します。`);

            try {
              const range = calculateLessonRangeForSlot({
                subject: subj,
                startLessonId: nextStep.lessonId,
                lessonsPerSlot: relevantTask.lesson_ids.length,
                curriculumMasters: rawMasters,
                student,
                enforceNoSkip: true
              });
              relevantTask.lesson_ids = range.lesson_ids;
              (relevantTask as any).start_lesson_id = range.start_lesson_id;
              (relevantTask as any).end_lesson_id = range.end_lesson_id;
              await db.saveLearningTasks([relevantTask]);
            } catch (e) {
              console.error('Task realignment error:', e);
            }
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Invariant 4: ステップ展開検証 (getDisplaySteps Invariant)
    // -------------------------------------------------------------
    console.log('[Invariant 4] 生徒画面ステップ展開（getDisplaySteps）完全性検証中...');
    const sampleJapaneseMasters: CurriculumMaster[] = [
      {
        id: 'cm-jp-step-1',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: '。と、のつかい方',
        sort_order: 1,
        item_type: 'lesson'
      },
      {
        id: 'cm-jp-step-2',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: 'まとめテスト(1)',
        sort_order: 2,
        item_type: 'lesson'
      },
      {
        id: 'cm-jp-step-3',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: 'まとめテスト(2)',
        sort_order: 3,
        item_type: 'lesson'
      }
    ];

    const japaneseSlot = {
      subject: '国語',
      start_lesson_name: '。と、のつかい方',
      end_lesson_name: 'まとめテスト(2)',
      lesson_range: '。と、のつかい方 〜 まとめテスト(2)',
      custom_unit_name: '文のきまり - 。と、のつかい方 〜 まとめテスト(2)',
      lesson_ids: ['cm-jp-step-1', 'cm-jp-step-2', 'cm-jp-step-3']
    };

    const resolvedSteps = getDisplaySteps(japaneseSlot, {
      curriculumMasters: sampleJapaneseMasters,
      studentGrade: '小1'
    });

    if (resolvedSteps.length !== 3) {
      const errMsg = `[Invariant 4 Violation] getDisplaySteps が 3 ステップを展開できていません (取得件数: ${resolvedSteps.length})`;
      errors.push(errMsg);
    } else {
      const expectedIds = ['cm-jp-step-1', 'cm-jp-step-2', 'cm-jp-step-3'];
      for (let i = 0; i < 3; i++) {
        if (resolvedSteps[i].id !== expectedIds[i]) {
          const errMsg = `[Invariant 4 Violation] getDisplaySteps のステップ順序不整合: index ${i} expected ${expectedIds[i]}, got ${resolvedSteps[i].id}`;
          errors.push(errMsg);
        }
      }
    }

    // -------------------------------------------------------------
    // 中抜き禁止ハードガード (CurriculumSkipViolationError) の機能検証
    // -------------------------------------------------------------
    console.log('[Guard Check] scheduler の中抜き物理禁止ガード (CurriculumSkipViolationError) 検証中...');
    const mockStudentWithNothing: Student = {
      id: 'mock-guard-std',
      student_id: 'mock-guard-std',
      name: 'Guard Tester',
      email: 'guard@tester.com',
      grade: '小1',
      school_id: 'sch-1',
      selected_subjects: ['国語'],
      status: 'normal',
      start_unit_id: null,
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    };

    try {
      calculateLessonRangeForSlot({
        subject: '国語',
        startLessonId: 'cm-jp-step-2', // cm-jp-step-1 が未完了なのに step 2 を開始位置に指定
        lessonsPerSlot: 1,
        curriculumMasters: sampleJapaneseMasters,
        student: mockStudentWithNothing,
        enforceNoSkip: true
      });
      const errMsg = `[Guard Check Failure] calculateLessonRangeForSlot が中抜きリクエストで CurriculumSkipViolationError をスローしませんでした！`;
      errors.push(errMsg);
    } catch (err) {
      if (err instanceof CurriculumSkipViolationError) {
        console.log('  ✓ CurriculumSkipViolationError が正常にスローされ、中抜きリクエストを物理遮断しました。');
      } else {
        errors.push(`[Guard Check Failure] 予期しないエラーがスローされました: ${String(err)}`);
      }
    }

    // -------------------------------------------------------------
    // イテレーション判定
    // -------------------------------------------------------------
    if (errors.length === 0) {
      allPassed = true;
      console.log(`\n================================================================`);
      console.log(`✓ All Integrity Checks Passed (0 errors) [Iteration ${iteration}]`);
      console.log(`  - Invariant 1 (中抜きゼロ): PASS`);
      console.log(`  - Invariant 2 (テスト誤完了ゼロ・暗号的ゲート): PASS`);
      console.log(`  - Invariant 3 (画面連動100%一致): PASS`);
      console.log(`  - Invariant 4 (ステップ展開完全性): PASS`);
      console.log(`  - ハードガード機能検証: PASS`);
      console.log(`================================================================\n`);
    } else {
      console.warn(`\n[Iteration ${iteration}] 検出された違反件数: ${errors.length}`);
      errors.forEach(e => console.warn(`  - ${e}`));
      if (iteration >= maxIterations) {
        console.error(`\n❌ 最大イテレーション数に達しましたが、${errors.length} 件の不整合が解決しませんでした。`);
        process.exit(1);
      } else {
        console.log('自己修復を適用しました。次のイテレーションで再検証します...');
      }
    }
  }

  return allPassed;
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('verify-curriculum-integrity'))) {
  runCurriculumIntegrityCheck()
    .then((passed) => {
      if (passed) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal error during integrity check:', err);
      process.exit(1);
    });
}
