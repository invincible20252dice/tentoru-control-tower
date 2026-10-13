import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqwnciwyzstiqszdgekr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd25jaXd5enN0aXFzemRnZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTYyOTgsImV4cCI6MjEwMDg5MjI5OH0.eGbXPVamL-6hMOehuViThOrkG1I_HGSajdLbGQE7c8M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanNakaoMath() {
  console.log('=== [中尾くん（student24295）算数不正完了データ浄化開始] ===');

  // 1. 中尾くんのレコード取得
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', 'student24295')
    .single();

  if (studentErr || !student) {
    console.error('中尾くんの生徒レコード取得失敗:', studentErr);
    process.exit(1);
  }

  console.log(`取得成功: ${student.name} (UUID: ${student.id}, student_id: ${student.student_id})`);
  console.log('更新前の completed_lesson_ids:', student.completed_lesson_ids);

  // 算数で除外すべき不正な完了ID（STEP 19〜25のたしざんID、STEP 5以降の全未受講単元テスト・未来まとめテスト）
  const mathInvalidIds = new Set([
    // たしざん (STEP 19〜25) の各ID
    'cm-1786673232230-7',
    'cm-1786673232230-8',
    'cm-1786673232230-9',
    'cm-1786673232230-10',
    'cm-1786673232230-11',
    'cm-1786673232230-12',
    'cm-1786673232230-13',
    'cm-auto-sum1-算数-小1-たしざん',
    'cm-auto-sum2-算数-小1-たしざん',
    'cm-auto-sum3-算数-小1-たしざん',
    'cm-auto-ut-算数-小1-たしざん',
    'cm-p1-m3',
    'cm-p1-m4',
    'cm-auto-sum1-算数-小1-2章 たしざんとひきざん',
    'cm-auto-sum2-算数-小1-2章 たしざんとひきざん',
    'cm-auto-sum3-算数-小1-2章 たしざんとひきざん',
    'cm-auto-ut-算数-小1-2章 たしざんとひきざん',
    // 20までの かず (STEP 18等)
    'cm-1786673232230-18',
    'cm-auto-ut-算数-小1-20までの　かず',
    'cm-auto-ut-算数-小1-20までの かず',
    // とけい(2) (STEP 45等)
    'cm-1786673232230-45',
    'cm-auto-sum1-算数-小1-とけい(2)',
    'cm-auto-sum2-算数-小1-とけい(2)',
    'cm-auto-sum3-算数-小1-とけい(2)',
    'cm-auto-ut-算数-小1-とけい(2)',
    // くりさがりのあるひきざん
    'cm-auto-ut-算数-小1-くりさがりのあるひきざん',
    // かずと すうじ 単元確認テスト (STEP 5 / 未受講・未合格)
    'cm-ut-1787296184118',
    'cm-auto-ut-算数-小1-かずと すうじ',
    'cm-auto-ut-算数-小1-かずと　すうじ',
    'cm-auto-ut-算数-小1-1章 かずとすうじ',
    'cm-kazu-test',
    '5',
    'STEP 5',
    'かずと すうじ - 単元確認テスト',
    'かずと　すうじ - 単元確認テスト'
  ]);

  const rawCompleted: string[] = student.completed_lesson_ids || [];
  const cleanedCompleted = rawCompleted.filter(id => !mathInvalidIds.has(String(id).trim()));

  const { data: updatedStudent, error: studentUpdateErr } = await supabase
    .from('students')
    .update({ completed_lesson_ids: cleanedCompleted })
    .eq('id', student.id)
    .select()
    .single();

  if (studentUpdateErr) {
    console.error('students.completed_lesson_ids 更新失敗:', studentUpdateErr);
    process.exit(1);
  }

  console.log('✅ students.completed_lesson_ids 更新完了:', updatedStudent.completed_lesson_ids);

  // 2. learning_tasks の不正完了タスクをリセット
  // たしざん、とけい(2)、くりさがりのあるひきざん、かずとすうじ単元確認テストの完了タスク
  const corruptTaskIds = [
    'task-57185cba-972c-42dd-880d-8de7c2174a75-2026-09-29-1-1790994692348-1jxjf', // たしざん
    'task-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-06-1-1791620719537-fa4pj', // とけい(2)
    'task-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-16-1-1791862003577-gkmcq', // かずとすうじ 単元確認テスト
    'task-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-30-1-1791430105205-diyof'  // くりさがりのあるひきざん
  ];

  for (const taskId of corruptTaskIds) {
    const { error: taskErr } = await supabase
      .from('learning_tasks')
      .update({
        status: 'unstarted',
        test_passed: false,
        completed_lesson_ids: []
      })
      .eq('id', taskId);

    if (taskErr) {
      console.warn(`タスク ${taskId} のリセット失敗 (存在しない可能性あり):`, taskErr);
    } else {
      console.log(`✅ 不正完了タスク ${taskId} を unstarted / test_passed: false にリセット`);
    }
  }

  // 3. mini_test_results の未受講なのに passed=true となっている不正レコードを削除
  const invalidTestIds = [
    'mini-unit-57185cba-972c-42dd-880d-8de7c2174a75-task-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-30-1-1791430105205-diyof', // くりさがりのあるひきざん
    'test-auto-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-05-1-1791174365377' // 20までの かず
  ];

  for (const testId of invalidTestIds) {
    const { error: delErr } = await supabase
      .from('mini_test_results')
      .delete()
      .eq('id', testId);

    if (delErr) {
      console.warn(`テストレコード ${testId} 削除失敗:`, delErr);
    } else {
      console.log(`✅ 不正単元テスト結果 ${testId} を物理削除`);
    }
  }

  // 4. 検証: 再取得して確認
  const { data: verifyStudent } = await supabase
    .from('students')
    .select('completed_lesson_ids')
    .eq('id', student.id)
    .single();

  console.log('=== [クリーンアップ完了後の検証結果] ===');
  console.log('検証 completed_lesson_ids:', verifyStudent?.completed_lesson_ids);
  const stillHasCorrupt = (verifyStudent?.completed_lesson_ids || []).some((id: string) => mathInvalidIds.has(id));
  if (stillHasCorrupt) {
    console.error('❌ 検証失敗: 不正IDがまだ残っています！');
    process.exit(1);
  }

  console.log('🎉 中尾くんの算数不正完了データは実DBから完全に物理削除・浄化されました！');
}

cleanNakaoMath().catch(err => {
  console.error('スクリプト例外:', err);
  process.exit(1);
});
