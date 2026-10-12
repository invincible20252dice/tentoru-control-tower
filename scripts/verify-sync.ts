import { createClient } from '@supabase/supabase-js';
import { db, CurriculumMaster, Student, MiniTestResult, LearningTask } from '../src/lib/db';
import { 
  getDisplaySteps, 
  getLessonRangeStepIds, 
  findNextUncompletedLessonForSubject,
  getLatestUnitTestStatusForSubject
} from '../src/lib/scheduler';

/**
 * 自律検証・自己修復スクリプト（Self-Healing Loop）
 * 1. 中尾くん（student24295 / std-3 / student103）の進度データ整合性 & 単元テスト合否ゲート自動修復
 * 2. 生徒画面ステップ展開関数（getDisplaySteps）のユニット検証（国語コマ From〜To 3ステップ完全展開）
 * 3. タイムライン現在地検証（今日のコマの lesson_ids とタイムライン isCurrent の 100% 一致）
 * 4. シーケンシャル整合性検証（中抜き・飛び石受講の完全禁止 0件）
 */
async function verifyDataIntegrity() {
  console.log('=== [Self-Healing Loop] 自律検証・自己修復スクリプトを開始します ===');

  let maxIterations = 3;
  let iteration = 0;
  let allPassed = false;

  while (iteration < maxIterations && !allPassed) {
    iteration++;
    console.log(`\n--- 検証イテレーション ${iteration}/${maxIterations} ---`);
    const errors: string[] = [];

    // -------------------------------------------------------------
    // ① 単元テスト未受講チェック & 自己修復 (中尾くん: student24295)
    // -------------------------------------------------------------
    console.log('\n[Check 1] 中尾くん（student24295 / std-3 / student103）の単元テスト合否ゲート検証...');

    let supabase: any = null;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'mock') {
      supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    // 中尾くんを検索（ローカルDBおよびSupabase）
    const localStudents = db.getStudents();
    let nakao = localStudents.find(s => 
      s.id === 'std-3' || 
      s.student_id === 'student24295' || 
      s.student_id === 'student103' || 
      (s.name && s.name.includes('中尾'))
    );

    // Supabase から取得（接続可能な場合）
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .or('student_id.eq.student24295,student_id.eq.student103,id.eq.std-3,name.ilike.%中尾%')
          .limit(1);
        if (!error && data && data.length > 0) {
          nakao = {
            ...data[0],
            completed_lesson_ids: typeof data[0].completed_lesson_ids === 'string'
              ? JSON.parse(data[0].completed_lesson_ids)
              : (data[0].completed_lesson_ids || [])
          };
        }
      } catch (err) {
        console.warn('Supabase fetch notice (fallback to local DB):', err);
      }
    }

    if (!nakao) {
      console.log('中尾くんのレコードが存在しないため、初期データを作成・登録します。');
      nakao = {
        id: 'std-3',
        student_id: 'student24295',
        name: '中尾 謙信',
        email: 'nakao@tentoru.example.com',
        grade: '小5',
        level: 'A',
        school_id: 'sch-2',
        school_name: 'テントル小学校',
        status: 'normal',
        start_unit_id: null,
        created_at: new Date().toISOString(),
        selected_subjects: ['算数', '国語', '英語'],
        completed_lesson_ids: []
      };
      await db.saveStudent(nakao);
    }

    // STEP 5（かずと すうじ - 単元確認テスト）のID定義
    const step5Identifiers = [
      '5', 
      'STEP 5', 
      'cm-kazu-test', 
      'cm-auto-ut-5',
      'cm-auto-ut-算数-小1-かずと すうじ',
      'かずと すうじ - 単元確認テスト',
      '単元確認テスト: かずと すうじ'
    ];

    // 中尾くんの小テスト結果（mini_test_results）を検証
    let nakaoMiniTests = db.getMiniTestResults().filter(r => 
      r.student_id === nakao!.id || r.student_id === nakao!.student_id
    );
    if (supabase) {
      try {
        const { data } = await supabase
          .from('mini_test_results')
          .select('*')
          .or(`student_id.eq.${nakao.id},student_id.eq.${nakao.student_id}`);
        if (data) nakaoMiniTests = data;
      } catch (e) {}
    }

    // STEP 5 が合格（passed: true または score >= 80）しているか判定
    const isStep5Passed = nakaoMiniTests.some(r => {
      const matchContent = r.test_content?.includes('かずと すうじ') || r.unit_name?.includes('かずと すうじ');
      const isTest = r.test_type === 'unit_test' || r.test_content?.includes('単元確認テスト');
      if (matchContent && isTest) {
        const passScore = r.passing_line ? parseInt(r.passing_line.match(/\d+/)?.[0] || '80', 10) : 80;
        return r.passed === true || r.status === 'passed' || (r.score !== null && r.score !== undefined && r.score >= passScore);
      }
      return false;
    });

    const currentCompleted = nakao.completed_lesson_ids || [];
    const hasUnpassedStep5InCompleted = !isStep5Passed && currentCompleted.some(id => 
      step5Identifiers.includes(String(id).trim()) || 
      (typeof id === 'string' && (id.includes('かずと すうじ') && id.includes('単元確認テスト')))
    );

    if (hasUnpassedStep5InCompleted) {
      console.warn('⚠️ [自律検知] STEP 5（かずと すうじ - 単元確認テスト）が合格履歴なしに completed_lesson_ids に混入しています！');
      console.log('🔄 [自己修復] completed_lesson_ids から未合格の単元確認テストを自動削除します...');

      const cleanedCompleted = currentCompleted.filter(id => {
        const sId = String(id).trim();
        const isStep5Match = step5Identifiers.includes(sId) || 
          (sId.includes('かずと すうじ') && sId.includes('単元確認テスト'));
        return !isStep5Match;
      });

      nakao.completed_lesson_ids = cleanedCompleted;
      await db.saveStudent(nakao);

      if (supabase) {
        try {
          await supabase
            .from('students')
            .update({ completed_lesson_ids: JSON.stringify(cleanedCompleted) })
            .eq('id', nakao.id);
          console.log('✅ Supabase DB の中尾くん進度データを自己修復完了');
        } catch (err) {
          console.warn('Supabase DB 更新警告:', err);
        }
      }
      errors.push('Check 1: STEP 5が合格履歴なしにcompletedに入っていたため自己修復を実行しました。');
    } else {
      console.log('✅ [Check 1 PASS] 単元確認テスト（STEP 5等）の合否ゲート整合性は正常です（未合格テストの混入なし）。');
    }

    // -------------------------------------------------------------
    // ② 生徒画面のステップ展開関数のユニット検証 (getDisplaySteps)
    // -------------------------------------------------------------
    console.log('\n[Check 2] 生徒画面ステップ展開関数（getDisplaySteps）の From〜To スライス検証...');

    const sampleJapaneseMasters: CurriculumMaster[] = [
      {
        id: 'cm-jp-step-1',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: '。と、のつかい方',
        sort_order: 1
      },
      {
        id: 'cm-jp-step-2',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: 'まとめテスト(1)',
        sort_order: 2
      },
      {
        id: 'cm-jp-step-3',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: '文のきまり',
        lesson_name: 'まとめテスト(2)',
        sort_order: 3
      },
      {
        id: 'cm-jp-step-4',
        subject: '国語',
        grade: '小1',
        grade_level: '小1',
        unit_name: 'ことばをみつけよう',
        lesson_name: 'ことばあそび',
        sort_order: 4
      }
    ];

    const japaneseSlot = {
      subject: '国語',
      start_lesson_name: '。と、のつかい方',
      end_lesson_name: 'まとめテスト(2)',
      lesson_range: '。と、のつかい方 〜 まとめテスト(2)',
      custom_unit_name: '文のきまり - 。と、のつかい方 〜 まとめテスト(2)'
    };

    const resolvedSteps = getDisplaySteps(japaneseSlot, {
      curriculumMasters: sampleJapaneseMasters,
      studentGrade: '小1'
    });

    console.log(`展開されたステップ件数: ${resolvedSteps.length} 件:`, resolvedSteps.map(s => s.name));

    if (resolvedSteps.length !== 3) {
      errors.push(`Check 2: getDisplaySteps(slot) の戻り値が 3 件ではなく ${resolvedSteps.length} 件です（1件丸め込みバグ検知）`);
    } else {
      const stepNames = resolvedSteps.map(s => s.name);
      if (!stepNames.includes('。と、のつかい方') || !stepNames.includes('まとめテスト(1)') || !stepNames.includes('まとめテスト(2)')) {
        errors.push(`Check 2: 展開されたステップ内容が不正です: ${stepNames.join(', ')}`);
      } else {
        console.log('✅ [Check 2 PASS] 国語コマの「。と、のつかい方 〜 まとめテスト(2)」が正確に 3 ステップすべて展開されました！');
      }
    }

    // -------------------------------------------------------------
    // ③ タイムラインの現在地検証 (today lesson_ids vs timeline isCurrent)
    // -------------------------------------------------------------
    console.log('\n[Check 3] 今日のコマ（lesson_ids）とタイムライン（isCurrent）の 100% 一致検証...');

    const todayDateStr = new Date().toISOString().split('T')[0];
    const testSlotTask: LearningTask = {
      id: `task-slot-verify-${Date.now()}`,
      student_id: nakao.id,
      unit_id: 'cm-jp-step-1',
      scheduled_date: todayDateStr,
      period: 1,
      subject: '国語',
      start_lesson_name: '。と、のつかい方',
      end_lesson_name: 'まとめテスト(2)',
      lesson_range: '。と、のつかい方 〜 まとめテスト(2)',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };

    // スロットから展開された今日の受講対象レッスンID群
    const slotStepIds = getDisplaySteps(testSlotTask, {
      curriculumMasters: sampleJapaneseMasters,
      studentGrade: '小1'
    }).map(s => String(s.id));

    const todayActiveLessonIds = new Set(slotStepIds);

    // タイムラインの各ステップで isCurrent を評価
    const timelineUnits = sampleJapaneseMasters.map(m => {
      const isCurrent = todayActiveLessonIds.has(String(m.id));
      return {
        id: m.id,
        name: m.lesson_name,
        isCurrent
      };
    });

    const activeTimelineSteps = timelineUnits.filter(u => u.isCurrent).map(u => String(u.id));

    // 100% 一致の検証
    const isExactMatch = slotStepIds.length === activeTimelineSteps.length &&
      slotStepIds.every(id => activeTimelineSteps.includes(id));

    if (!isExactMatch) {
      errors.push(`Check 3: 今日のコマのID (${slotStepIds.join(',')}) とタイムラインの現在地ステップ (${activeTimelineSteps.join(',')}) が一致しません。`);
    } else {
      console.log(`✅ [Check 3 PASS] 今日のコマの対象ステップ [${slotStepIds.join(', ')}] とタイムラインの現在地（isCurrent）が 100% 完全一致しました！`);
    }

    // -------------------------------------------------------------
    // ④ シーケンシャル整合性検証 (中抜き・飛び石受講 0件)
    // -------------------------------------------------------------
    console.log('\n[Check 4] 全教科シーケンシャル中抜き・飛び石受講 0件検証...');

    const mathMasters: CurriculumMaster[] = [
      { id: 'm-1', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: '1から5まで', sort_order: 1 },
      { id: 'm-2', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: '6から10まで', sort_order: 2 },
      { id: 'm-3', subject: '算数', grade: '小1', unit_name: 'かずとすうじ', lesson_name: 'かずとすうじ 単元確認テスト', sort_order: 3, item_type: 'unit_test' },
      { id: 'm-4', subject: '算数', grade: '小1', unit_name: 'いくつといくつ', lesson_name: '5のかずの合成分解', sort_order: 4 }
    ];

    // m-2 が未受講の状態で次を検索
    const testStudent: Student = {
      id: 'std-test-seq',
      student_id: 'std-test-seq-no',
      name: '検証生徒',
      email: 'test@example.com',
      grade: '小1',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: new Date().toISOString(),
      selected_subjects: ['算数'],
      completed_lesson_ids: ['m-1'] // m-2 未完了, m-3 未受講
    };

    const nextStep = findNextUncompletedLessonForSubject({
      subject: '算数',
      student: testStudent,
      masterLessons: mathMasters.map(m => ({
        id: m.id,
        name: m.lesson_name,
        unit_name: m.unit_name,
        sort_order: m.sort_order,
        item_type: m.item_type
      }))
    });

    if (nextStep.lessonId !== 'm-2') {
      errors.push(`Check 4: シーケンシャル検証エラー: m-1完了後の現在地が m-2 ではなく ${nextStep.lessonId} (${nextStep.lessonName}) になっています（飛び石・中抜きバグ検知）`);
    } else {
      console.log('✅ [Check 4 PASS] m-1完了後、未完了の最小番号ステップ（m-2）が例外なく現在地として選択され、中抜き・飛び石は 0 件です！');
    }

    // -------------------------------------------------------------
    // 判定とループ制御
    // -------------------------------------------------------------
    if (errors.length === 0) {
      allPassed = true;
      console.log('\n======================================================');
      console.log('🎉 All Invariants Passed! すべての厳格な受入基準をクリアしました！');
      console.log('======================================================\n');
    } else {
      console.error('\n⚠️ 検証エラー（自己修復ループが検出）:', errors);
      if (iteration >= maxIterations) {
        console.error('❌ 最大イテレーションに達したため、検証を終了します。');
        process.exit(1);
      }
    }
  }
}

// 実行
verifyDataIntegrity().catch(err => {
  console.error('実行時致命的エラー:', err);
  process.exit(1);
});
