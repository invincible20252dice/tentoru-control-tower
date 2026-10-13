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
  ensureMathEnglishUnitTests,
  findNextUncompletedLessonForSubject,
  getDisplaySteps
} from '../src/lib/scheduler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqwnciwyzstiqszdgekr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd25jaXd5enN0aXFzemRnZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTYyOTgsImV4cCI6MjEwMDg5MjI5OH0.eGbXPVamL-6hMOehuViThOrkG1I_HGSajdLbGQE7c8M';

let supabase: any = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'mock') {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('Supabase client init failed:', e);
  }
}

export async function healAllCurriculum(): Promise<{ success: boolean; repairedCount: number }> {
  console.log('========================================================================');
  console.log('  全生徒・全教科データの一括自動スキャン＆整合性修復 (Heal All Curriculum)  ');
  console.log('========================================================================\n');

  let repairedCount = 0;

  // 1. 全マスタデータとローカルデータの準備
  const rawMasters = db.getCurriculumMasters();
  const ensuredMasters = ensureMathEnglishUnitTests(rawMasters);
  const students = db.getStudents();
  let miniTestResults = db.getMiniTestResults();
  const learningTasks = db.getLearningTasks();

  // Supabase データ取得
  let supabaseStudents: any[] = [];
  let supabaseMiniTests: any[] = [];
  let supabaseTasks: any[] = [];

  if (supabase) {
    try {
      const [sRes, mRes, tRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('mini_test_results').select('*'),
        supabase.from('learning_tasks').select('*')
      ]);
      if (sRes.data) supabaseStudents = sRes.data;
      if (mRes.data) supabaseMiniTests = mRes.data;
      if (tRes.data) supabaseTasks = tRes.data;
    } catch (err) {
      console.warn('Supabase fetch failed, proceeding with local DB:', err);
    }
  }

  const allMiniTests = [...miniTestResults, ...supabaseMiniTests];

  // -----------------------------------------------------------------------------
  // [A] 全生徒の completed_lesson_ids スキャン ＆ 未合格単元テストの一括物理削除
  // -----------------------------------------------------------------------------
  console.log('[Step 1] 全生徒の単元確認テスト合格照合スキャン中...');

  const unitTestIdSet = new Set<string>();
  ensuredMasters.forEach(m => {
    const isReview = (m.lesson_name || '').includes('まとめテスト') || (m.lesson_name || '').toLowerCase().includes('check test');
    const isUT = !isReview && (m.item_type === 'unit_test' || (m.lesson_name && (m.lesson_name.includes('単元確認テスト') || m.lesson_name.includes('単元テスト'))));
    if (isUT) {
      unitTestIdSet.add(String(m.id).trim());
      if (m.sort_order !== undefined) {
        unitTestIdSet.add(String(m.sort_order).trim());
        unitTestIdSet.add(`STEP ${m.sort_order}`.trim());
      }
      if (m.lesson_name) unitTestIdSet.add(m.lesson_name.trim());
    }
  });

  // 既知の未合格単元テストID（算数 STEP 5, 44, 62 等）
  const knownUntestedUnitIds = [
    '5', 'STEP 5', 'cm-kazu-test', 'cm-auto-ut-5',
    'cm-auto-ut-算数-小1-かずと すうじ', 'cm-auto-ut-算数-小1-かずと　すうじ',
    'かずと すうじ - 単元確認テスト', 'かずと　すうじ - 単元確認テスト',
    '1章 かずとすうじ - 単元確認テスト', 'cm-auto-ut-算数-小1-1章 かずとすうじ',
    '44', 'STEP 44', 'cm-auto-ut-44', '62', 'STEP 62', 'cm-auto-ut-62'
  ];
  knownUntestedUnitIds.forEach(id => unitTestIdSet.add(id));

  // (1) ローカル生徒の修復
  for (const student of students) {
    const original = [...(student.completed_lesson_ids || [])];
    const studentTests = allMiniTests.filter(t => t.student_id === student.id || t.student_id === student.student_id);
    const passedTestContents = new Set<string>();
    studentTests.forEach(t => {
      const isPassed = t.passed === true || t.status === 'passed' || (t.score !== null && t.score !== undefined && t.score >= 80);
      if (isPassed) {
        if (t.test_content) passedTestContents.add(t.test_content.trim());
        if (t.unit_name) passedTestContents.add(t.unit_name.trim());
      }
    });

    const sanitized = original.filter(id => {
      const sId = String(id).trim();
      const isUnitTest = unitTestIdSet.has(sId) || sId.includes('単元確認テスト') || sId.includes('auto-ut');
      if (isUnitTest) {
        const hasPassed = passedTestContents.has(sId) || Array.from(passedTestContents).some(c => sId.includes(c) || c.includes(sId));
        return hasPassed;
      }
      return true;
    });

    if (sanitized.length !== original.length) {
      console.log(`  ✓ 生徒 ${student.name} (${student.id}) の未合格単元テストIDを削除: ${original.length}件 -> ${sanitized.length}件`);
      student.completed_lesson_ids = sanitized;
      await db.saveStudent(student);
      repairedCount++;
    }
  }

  // (2) Supabase 生徒の修復
  for (const s of supabaseStudents) {
    const original: string[] = s.completed_lesson_ids || [];
    const studentTests = allMiniTests.filter(t => t.student_id === s.id || t.student_id === s.student_id);
    const passedTestContents = new Set<string>();
    studentTests.forEach(t => {
      const isPassed = t.passed === true || t.status === 'passed' || (t.score !== null && t.score !== undefined && t.score >= 80);
      if (isPassed) {
        if (t.test_content) passedTestContents.add(t.test_content.trim());
        if (t.unit_name) passedTestContents.add(t.unit_name.trim());
      }
    });

    const sanitized = original.filter(id => {
      const sId = String(id).trim();
      const isUnitTest = unitTestIdSet.has(sId) || sId.includes('単元確認テスト') || sId.includes('auto-ut');
      if (isUnitTest) {
        const hasPassed = passedTestContents.has(sId) || Array.from(passedTestContents).some(c => sId.includes(c) || c.includes(sId));
        return hasPassed;
      }
      return true;
    });

    if (sanitized.length !== original.length) {
      console.log(`  ✓ [Supabase] 生徒 ${s.name} (${s.id}) の未合格単元テストIDを削除: ${original.length}件 -> ${sanitized.length}件`);
      await supabase.from('students').update({ completed_lesson_ids: sanitized }).eq('id', s.id);
      repairedCount++;
    }
  }

  // -----------------------------------------------------------------------------
  // [B] 中尾くん（student24295）の全教科データ個別修復＆再同期
  // -----------------------------------------------------------------------------
  console.log('\n[Step 2] 中尾くん（student24295）の全教科データ整合性修復中...');

  const nakaoLocal = students.find(s => s.student_id === 'student24295' || s.id === '57185cba-972c-42dd-880d-8de7c2174a75');
  const nakaoSupabase = supabaseStudents.find(s => s.student_id === 'student24295' || s.id === '57185cba-972c-42dd-880d-8de7c2174a75');
  const nakaoId = nakaoSupabase?.id || nakaoLocal?.id || '57185cba-972c-42dd-880d-8de7c2174a75';

  // 1. 英語の修復: STEP 4〜6 が未受講のため、STEP 7以降の飛び石完了をリセットし STEP 4 開始に同期
  console.log('  - 英語: STEP 1〜3 完了維持、STEP 4 開始同期、STEP 7以降飛び石リセット');
  const engStep1to3 = ['cm-1786672798566-1', 'cm-1786672798566-2', 'cm-1786672798566-3'];
  const engStep4Id = 'cm-1786672798566-4';
  const engStep4Name = "I am ~.  わたしは〜です。 - I’m  a 〜.     わたしは〜がくせい（学生）です。";

  // 2. 国語の修復: 2年生 STEP 1〜7 完了、STEP 8〜10 (かきじゅん まとめテスト(1)〜(3)) を現在地として接続
  console.log('  - 国語: STEP 1〜7 完了、STEP 8〜10 (かきじゅん まとめテスト) 接続、未来飛び石リセット');
  const jpStep1to7 = [
    'cm-1786672452619-1', 'cm-1786672452619-2', 'cm-1786672452619-3',
    'cm-1786672452619-4', 'cm-1786672452619-5', 'cm-1786672452619-6',
    'cm-1786672452619-7'
  ];

  // 3. 算数の修復: STEP 5 (かずと すうじ 単元確認テスト), 44, 62 解除
  console.log('  - 算数: STEP 5, 44, 62 等の未受講単元テスト完了解除');
  const mathRemedialClean = [
    'task-remedial-57185cba-972c-42dd-880d-8de7c2174a75-1791344673093',
    'task-remedial-57185cba-972c-42dd-880d-8de7c2174a75-1791350314847',
    'task-remedial-57185cba-972c-42dd-880d-8de7c2174a75-1791356162904',
    'task-remedial-57185cba-972c-42dd-880d-8de7c2174a75-1791361218755'
  ];

  // 中尾くんの正規 completed_lesson_ids を構築（英語 STEP 1〜3、国語 STEP 1〜7、算数過去正常完了のみ）
  const nakaoCleanedCompletedIds = Array.from(new Set([
    ...engStep1to3,
    ...jpStep1to7,
    ...mathRemedialClean
  ])).filter(id => {
    if (id.includes('1786672798566-')) {
      const num = parseInt(id.replace('cm-1786672798566-', ''), 10);
      if (num >= 4) return false;
    }
    if (id.includes('1786672452619-')) {
      const num = parseInt(id.replace('cm-1786672452619-', ''), 10);
      if (num >= 8) return false;
    }
    if (knownUntestedUnitIds.includes(id)) return false;
    if (id.includes('国語') && id.includes('sum')) return false;
    return true;
  });

  // Supabase 中尾くんのレコード更新
  if (supabase && nakaoSupabase) {
    await supabase.from('students').update({
      completed_lesson_ids: nakaoCleanedCompletedIds
    }).eq('id', nakaoSupabase.id);

    // 偽の未受講単元テスト合格レコードがあれば Supabase mini_test_results から削除
    await supabase.from('mini_test_results')
      .delete()
      .eq('student_id', nakaoSupabase.id)
      .eq('date', '2026-10-16');

    // 10/16 タスクの同期 (国語: かきじゅん まとめテスト(1)〜(3)、英語: STEP 4、算数: 未受講状態)
    const kakijunDisplaySteps = [
      'cm-auto-sum1-国語-小2-かきじゅん',
      'cm-auto-sum2-国語-小2-かきじゅん',
      'cm-auto-sum3-国語-小2-かきじゅん'
    ];

    // 国語コマ3
    await supabase.from('learning_tasks').upsert([{
      id: `task-${nakaoId}-2026-10-16-3`,
      student_id: nakaoId,
      scheduled_date: '2026-10-16',
      period: 3,
      subject: '国語',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      unit_id: kakijunDisplaySteps[0],
      start_lesson_name: 'かきじゅん - まとめテスト(1)',
      end_lesson_name: 'かきじゅん - まとめテスト(3)',
      start_lesson_id: kakijunDisplaySteps[0],
      end_lesson_id: kakijunDisplaySteps[2],
      lesson_range: 'かきじゅん - まとめテスト(1) 〜 かきじゅん - まとめテスト(3)',
      custom_unit_name: 'かきじゅん - まとめテスト(1) 〜 かきじゅん - まとめテスト(3)'
    }]);

    // 英語コマ2
    await supabase.from('learning_tasks').upsert([{
      id: `task-${nakaoId}-2026-10-16-2`,
      student_id: nakaoId,
      scheduled_date: '2026-10-16',
      period: 2,
      subject: '英語',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      unit_id: engStep4Id,
      start_lesson_name: engStep4Name,
      end_lesson_name: engStep4Name,
      start_lesson_id: engStep4Id,
      end_lesson_id: engStep4Id,
      lesson_range: engStep4Name,
      custom_unit_name: engStep4Name
    }]);

    // 算数コマ1
    await supabase.from('learning_tasks').upsert([{
      id: `task-${nakaoId}-2026-10-16-1`,
      student_id: nakaoId,
      scheduled_date: '2026-10-16',
      period: 1,
      subject: '算数',
      status: 'unstarted',
      video_watched: false,
      test_passed: false,
      unit_id: 'cm-auto-sum1-算数-小1-かずと　すうじ',
      start_lesson_name: 'かずと　すうじ - まとめテスト（１）',
      end_lesson_name: 'かずと　すうじ - まとめテスト（３）',
      start_lesson_id: 'cm-auto-sum1-算数-小1-かずと　すうじ',
      end_lesson_id: 'cm-auto-sum3-算数-小1-かずと　すうじ',
      lesson_range: 'かずと　すうじ - まとめテスト（１） 〜 かずと　すうじ - まとめテスト（３）',
      custom_unit_name: 'かずと　すうじ - まとめテスト（１） 〜 かずと　すうじ - まとめテスト（３）'
    }]);

    repairedCount++;
  }

  // ローカル中尾くんのレコード更新
  if (nakaoLocal) {
    nakaoLocal.completed_lesson_ids = nakaoCleanedCompletedIds;
    await db.saveStudent(nakaoLocal);
    repairedCount++;
  }

  console.log('\n========================================================================');
  console.log(`✓ 全生徒・全教科データの一括自動スキャン＆整合性修復完了 (修復処理数: ${repairedCount})`);
  console.log('========================================================================\n');

  return { success: true, repairedCount };
}

if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('heal-all-curriculum'))) {
  healAllCurriculum()
    .then(res => {
      console.log('Finished successfully:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error in healAllCurriculum:', err);
      process.exit(1);
    });
}
