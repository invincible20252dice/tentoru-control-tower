import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqwnciwyzstiqszdgekr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd25jaXd5enN0aXFzemRnZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTYyOTgsImV4cCI6MjEwMDg5MjI5OH0.eGbXPVamL-6hMOehuViThOrkG1I_HGSajdLbGQE7c8M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== [Supabase 本番DB 直接更新スクリプト実行開始] ===');

  // 1. 中尾くんのレコード取得
  const { data: student, error: fetchErr } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', 'student24295')
    .single();

  if (fetchErr || !student) {
    console.error('中尾くんのレコード取得失敗:', fetchErr);
    process.exit(1);
  }

  console.log(`取得成功: 中尾 謙信 (ID: ${student.id}, student_id: ${student.student_id})`);
  console.log(`更新前 completed_lesson_ids 件数: ${student.completed_lesson_ids?.length || 0}`);

  // STEP 5 (かずと すうじ - 単元確認テスト) および合格実績のない未受講単元テストIDの定義
  const unpassedOrStep5Ids = new Set([
    'cm-ut-1787296184118',
    'cm-ut-1787378063799',
    'cm-ut-1787378069050',
    'cm-auto-ut-算数-小1-かずと すうじ',
    'cm-auto-ut-算数-小1-かずと　すうじ',
    'cm-auto-ut-5',
    'cm-kazu-test',
    'STEP 5',
    '5',
    'かずと すうじ - 単元確認テスト',
    'かずと　すうじ - 単元確認テスト',
    '単元確認テスト: かずと すうじ',
    '1章 かずとすうじ - 単元確認テスト',
    'cm-auto-ut-算数-小1-1章 かずとすうじ'
  ]);

  const originalCompleted: string[] = student.completed_lesson_ids || [];
  const cleanedCompleted = originalCompleted.filter(id => !unpassedOrStep5Ids.has(String(id).trim()));

  const removedIds = originalCompleted.filter(id => unpassedOrStep5Ids.has(String(id).trim()));
  console.log('除外されたID一覧:', removedIds);

  // Supabase students テーブル直接 UPDATE
  const { data: updatedStudent, error: updateErr } = await supabase
    .from('students')
    .update({ completed_lesson_ids: cleanedCompleted })
    .eq('id', student.id)
    .select()
    .single();

  if (updateErr) {
    console.error('中尾くんの completed_lesson_ids UPDATE 失敗:', updateErr);
    process.exit(1);
  }

  console.log(`✅ 中尾くんの completed_lesson_ids を直接 UPDATE 完了！ (残り件数: ${updatedStudent.completed_lesson_ids?.length})`);

  // 2. 10/16 国語タスク (コマ3: 。と、のつかい方 〜 まとめテスト(2)) の lesson_ids を 3ステップ配列で直接 UPDATE
  const jpTask3Id = 'task-57185cba-972c-42dd-880d-8de7c2174a75-2026-10-16-3-1791789287875-urs70';
  const displayStepsIds = [
    'cm-1786672452619-33',
    'cm-auto-sum1-国語-小2-。と、のつかい方',
    'cm-auto-sum2-国語-小2-。と、のつかい方'
  ];

  const { data: updatedTask, error: taskUpdateErr } = await supabase
    .from('learning_tasks')
    .update({
      lesson_ids: displayStepsIds,
      custom_unit_name: '。と、のつかい方 - 。と、のつかい方 〜 。と、のつかい方 - まとめテスト（２）',
      start_lesson_name: '。と、のつかい方 - 。と、のつかい方',
      end_lesson_name: '。と、のつかい方 - まとめテスト（２）'
    })
    .eq('id', jpTask3Id)
    .select()
    .single();

  if (taskUpdateErr) {
    console.error('国語タスク UPDATE 失敗:', taskUpdateErr);
  } else {
    console.log(`✅ 国語タスク (コマ3) の lesson_ids を 3ステップ展開配列で直接 UPDATE 完了！`, updatedTask.lesson_ids);
  }

  // 3. 検証: 再取得して確認
  const { data: verifyStudent } = await supabase
    .from('students')
    .select('completed_lesson_ids')
    .eq('id', student.id)
    .single();

  const stillHasStep5 = (verifyStudent?.completed_lesson_ids || []).some((id: string) => unpassedOrStep5Ids.has(id));
  if (stillHasStep5) {
    console.error('❌ 検証失敗: STEP 5 の ID が依然として残っています！');
    process.exit(1);
  }

  console.log('🎉 [Supabase 実DB 直接更新 & 整合性検証 完了] STEP 5 の ID は完全に排除されました！');
}

main().catch(err => {
  console.error('スクリプト例外:', err);
  process.exit(1);
});
