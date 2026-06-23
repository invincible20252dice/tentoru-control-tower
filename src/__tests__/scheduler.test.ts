import { describe, it, expect, beforeEach } from 'vitest';
import { 
  rescheduleDelayedTasks, 
  handleForwardTasks, 
  reorganizeFutureTasks, 
  calculateMockExamPassRate,
  generateAIReportText,
  learnFromTeacherCorrections,
  schedulerConfig,
  getYearMonthWeek,
  calculateProgressGap
} from '../lib/scheduler';
import { CurriculumUnit, LearningTask, Student, TestRecord, ExamThresholdMaster, MilestonePlan } from '../lib/db';

describe('Scheduler and Core Logic Tests', () => {

  // Test 1: カリキュラム順序変更時の未来計画更新
  it('should reorganize only future tasks when curriculum order changes', () => {
    // 既存のタスク定義 (順序: unitA -> unitB -> unitC -> unitD)
    // unitA: 完了済み
    // unitB: 完了済み
    // unitC: 未着手 (今日)
    // unitD: 未着手 (明日)
    const units: CurriculumUnit[] = [
      { id: 'u-A', school_id: 'sch-1', subject: '数学', name: '単元A', sequence_order: 1, created_at: '' },
      { id: 'u-B', school_id: 'sch-1', subject: '数学', name: '単元B', sequence_order: 2, created_at: '' },
      { id: 'u-C', school_id: 'sch-1', subject: '数学', name: '単元C', sequence_order: 3, created_at: '' },
      { id: 'u-D', school_id: 'sch-1', subject: '数学', name: '単元D', sequence_order: 4, created_at: '' },
    ];

    const tasks: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-17', period: null, status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-18', period: null, status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-3', student_id: 'std-1', unit_id: 'u-C', scheduled_date: '2026-06-19', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-4', student_id: 'std-1', unit_id: 'u-D', scheduled_date: '2026-06-20', period: null, status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    ];

    // 単元の順序を変更: C と D を入れ替え (Dを先にする)
    const newUnits: CurriculumUnit[] = [
      { id: 'u-A', school_id: 'sch-1', subject: '数学', name: '単元A', sequence_order: 1, created_at: '' },
      { id: 'u-B', school_id: 'sch-1', subject: '数学', name: '単元B', sequence_order: 2, created_at: '' },
      { id: 'u-D', school_id: 'sch-1', subject: '数学', name: '単元D', sequence_order: 3, created_at: '' }, // sequence_order: 3
      { id: 'u-C', school_id: 'sch-1', subject: '数学', name: '単元C', sequence_order: 4, created_at: '' }, // sequence_order: 4
    ];

    const resultTasks = reorganizeFutureTasks('std-1', '数学', tasks, newUnits);

    // 検証: 
    // - t-1 (u-A) と t-2 (u-B) の日付やステータスは変化しないこと (過去/完了済みのため)
    // - 未完了の u-D (以前は20日に予定) と u-C (以前は19日に予定) の日付順が入れ替わること
    const t1 = resultTasks.find(t => t.id === 't-1');
    const t2 = resultTasks.find(t => t.id === 't-2');
    const t3 = resultTasks.find(t => t.id === 't-3'); // u-C
    const t4 = resultTasks.find(t => t.id === 't-4'); // u-D

    expect(t1?.scheduled_date).toBe('2026-06-17');
    expect(t2?.scheduled_date).toBe('2026-06-18');
    
    // 入れ替わって u-D (t-4) が先に (19日)、u-C (t-3) が後に (20日) なっていること
    expect(t4?.scheduled_date).toBe('2026-06-19');
    expect(t3?.scheduled_date).toBe('2026-06-20');
  });

  // Test 2: 遅れ時の自動リスケジュール & パンクアラート
  it('should reschedule remaining tasks to future dates if student is 2 days consecutive uncompleted', () => {
    // 6/17 (完了), 6/18 (未完了), 6/19 (未完了) -> 2日連続未完了
    // 期間内の残りの予定日: 6/20, 6/21 (計2日)
    // 未達成分も含めて残りの未達成タスク: unitB (未完了), unitC (未完了), unitD (予定), unitE (予定) = 計4タスク
    // 1日あたりの最大タスク数を 3 とする
    const tasks: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-17', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-18', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-3', student_id: 'std-1', unit_id: 'u-C', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-4', student_id: 'std-1', unit_id: 'u-D', scheduled_date: '2026-06-20', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-5', student_id: 'std-1', unit_id: 'u-E', scheduled_date: '2026-06-21', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    ];

    const student: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };

    // リスケジュール実行
    // 今日は 6/19 とし、6/18, 6/19 が未達成 (2日連続)
    // 未来の有効日: 6/20, 6/21 (2日間)
    // 4つのタスクを2日間に配分 -> 1日あたり2タスク。上限3未満なのでパンクしない。
    const currentDate = '2026-06-19';
    const { updatedTasks, updatedStudent, isPunked } = rescheduleDelayedTasks(
      student,
      tasks,
      currentDate,
      ['2026-06-20', '2026-06-21'], // 未来の目標日リスト
      3 // 1日あたりの上限タスク数
    );

    expect(isPunked).toBe(false);
    expect(updatedStudent.status).toBe('normal');

    // 未完了の t-2, t-3, t-4, t-5 が 6/20 と 6/21 に均等に配分されているか (各2個ずつ)
    const taskDates = updatedTasks
      .filter(t => t.status === 'unstarted')
      .reduce((acc: Record<string, number>, t) => {
        acc[t.scheduled_date] = (acc[t.scheduled_date] || 0) + 1;
        return acc;
      }, {});

    expect(taskDates['2026-06-20']).toBe(2);
    expect(taskDates['2026-06-21']).toBe(2);
  });

  it('should trigger punk alert if daily tasks exceed limit after rescheduling', () => {
    // 4つのタスクがあり、未来の目標日が 6/20 の1日しかない場合
    // 4タスク / 1日 = 1日4タスク。上限3を超えるため、パンク状態になる。
    const tasks: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-17', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-18', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-3', student_id: 'std-1', unit_id: 'u-C', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-4', student_id: 'std-1', unit_id: 'u-D', scheduled_date: '2026-06-20', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-5', student_id: 'std-1', unit_id: 'u-E', scheduled_date: '2026-06-21', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    ];

    const student: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };

    const currentDate = '2026-06-19';
    const { updatedTasks, updatedStudent, isPunked } = rescheduleDelayedTasks(
      student,
      tasks,
      currentDate,
      ['2026-06-20'], // 未来の目標日が1日のみ
      3 // 上限3
    );

    // 上限を超えるためパンクアラート発火し、自動リスケジュールはストップして元の状態を保つか、あるいは警告ステータスになること
    expect(isPunked).toBe(true);
    expect(updatedStudent.status).toBe('warning'); // warning = 計画パンクアラート
  });

  // Test 3: 前倒しと爆速通知
  it('should pull forward next weeks tasks and mark student as fast if current target is met early', () => {
    // 今週のタスク (t-1: 6/19 予定)
    // 来週のタスク (t-2: 6/26 予定、t-3: 6/25 予定)
    // t-1を今日 (6/19) に完了させた場合
    const tasks: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-19', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-26', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-3', student_id: 'std-1', unit_id: 'u-C', scheduled_date: '2026-06-25', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
    ];

    const student: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };

    const currentDate = '2026-06-19';
    const { updatedTasks, updatedStudent } = handleForwardTasks(
      student,
      tasks,
      currentDate,
      '2026-06-21' // 今週の最終期限日
    );

    expect(updatedStudent.status).toBe('fast'); // 爆速ステータス
    // 来週の予定だった t-3 (u-C, 6/25予定が最も近い未来) が前倒しされ、今日 (6/19) に予定されること
    const t3 = updatedTasks.find(t => t.id === 't-3');
    expect(t3?.scheduled_date).toBe('2026-06-19'); // 前倒し日付
  });

  // Test 4: 志望校判定合格％算出
  it('should calculate passing probability percentage correctly based on mock exam scores', () => {
    const thresholds: ExamThresholdMaster[] = [
      { id: 'th-1', school_code: 'sch-A', min_score: 350, max_score: 500, probability: 80 },
      { id: 'th-2', school_code: 'sch-A', min_score: 300, max_score: 349, probability: 60 },
      { id: 'th-3', school_code: 'sch-A', min_score: 250, max_score: 299, probability: 40 },
      { id: 'th-4', school_code: 'sch-A', min_score: 0, max_score: 249, probability: 20 },
    ];

    const probability = calculateMockExamPassRate(320, 'sch-A', thresholds);
    expect(probability).toBe(60); // 320は 300-349 の範囲なので 60%

    // 閾値に穴（隙間）があるケースのテスト
    const gappyThresholds: ExamThresholdMaster[] = [
      { id: 'gth-1', school_code: 'sch-G', min_score: 100, max_score: 200, probability: 20 },
      { id: 'gth-2', school_code: 'sch-G', min_score: 300, max_score: 400, probability: 80 },
    ];
    // 250 は 100〜400 の範囲内だが、個別範囲（100-200, 300-400）のいずれにも合致しない
    const gappyProb = calculateMockExamPassRate(250, 'sch-G', gappyThresholds);
    expect(gappyProb).toBe(0);
  });

  // Test 5: AI文体パーソナライズの簡易学習
  it('should adjust AI generated text tone based on teacher correction history', () => {
    // 初期のAI生成テキスト
    const baseText = "佐藤君は今月、非常によく頑張りました。テストでは平均80%でした。一次方程式で少し間違えましたが、全体としてよくできました。";
    
    // 講師が修正した履歴: 
    // 講師は「一歩」「成長」「すばらしい」「動画に集中」のようなより情熱的な言葉と、
    // 文末に「！」を多用する傾向があるとする。
    const corrections = [
      {
        original: "テストでは平均80%でした。全体としてよくできました。",
        corrected: "テストでは見事平均80%を達成しました！素晴らしい成長の一歩です！"
      },
      {
        original: "一次方程式で少し間違えました。",
        corrected: "一次方程式で間違えた問題もありましたが、そこから逃げずに動画で学び直す姿勢がすばらしいです！"
      }
    ];

    // 補正器のモデルをトレーニング
    const learnedStyle = learnFromTeacherCorrections(corrections);

    // テキスト生成に学習結果を適用
    const newReport = generateAIReportText(baseText, learnedStyle);

    // 期待値: 
    // - 文末に「！」が含まれていること
    // - ポジティブ表現「素晴らしい」「すばらしい」「一歩」「成長」などが織り交ぜられていること
    expect(newReport).toContain('！');
    expect(
      newReport.includes('成長') || 
      newReport.includes('素晴らしい') || 
      newReport.includes('すばらしい') || 
      newReport.includes('一歩')
    ).toBe(true);
  });

  // Edge cases tests for coverage
  it('should handle edge cases in scheduler and pass rates', () => {
    const student: Student = {
      id: 'std-1',
      student_id: 'student101',
      name: '佐藤 拓海',
      email: 'student101@tentoru.com',
      grade: '中3',
      school_id: 'sch-1',
      status: 'normal',
      start_unit_id: null,
      created_at: ''
    };

    // 1. rescheduleDelayedTasks without 2 consecutive days uncompleted (no change)
    const tasks1: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-18', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-19', status: 'completed', video_watched: true, test_passed: true, created_at: '' }
    ];
    const res1 = rescheduleDelayedTasks(student, tasks1, '2026-06-19', ['2026-06-20']);
    expect(res1.isPunked).toBe(false);

    // 2. rescheduleDelayedTasks with empty futureDates (early return)
    const tasks2: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-18', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    const res2 = rescheduleDelayedTasks(student, tasks2, '2026-06-19', []);
    expect(res2.isPunked).toBe(false);

    // 3. rescheduleDelayedTasks with no uncompleted tasks (early return)
    const tasks3: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-18', status: 'completed', video_watched: true, test_passed: true, created_at: '' },
      { id: 't-2', student_id: 'std-1', unit_id: 'u-B', scheduled_date: '2026-06-19', status: 'completed', video_watched: true, test_passed: true, created_at: '' }
    ];
    const res3 = rescheduleDelayedTasks(student, tasks3, '2026-06-19', ['2026-06-20']);
    expect(res3.updatedTasks).toEqual(tasks3);

    // 4. handleForwardTasks with no tasks in current week (early return)
    const res4 = handleForwardTasks(student, [], '2026-06-19', '2026-06-21');
    expect(res4.updatedStudent.status).toBe('normal');

    // 5. handleForwardTasks with some uncompleted tasks this week (early return)
    const tasks5: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-19', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
    ];
    const res5 = handleForwardTasks(student, tasks5, '2026-06-19', '2026-06-21');
    expect(res5.updatedStudent.status).toBe('normal');

    // 6. handleForwardTasks with no future tasks to pull forward (early return)
    const tasks6: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-19', status: 'completed', video_watched: true, test_passed: true, created_at: '' }
    ];
    const res6 = handleForwardTasks(student, tasks6, '2026-06-19', '2026-06-21');
    expect(res6.updatedStudent.status).toBe('normal');

    // 7. calculateMockExamPassRate empty thresholds or school code not found
    const res7 = calculateMockExamPassRate(300, 'sch-not-found', []);
    expect(res7).toBe(0);

    // 8. calculateMockExamPassRate values outside range bounds
    const thresholds = [
      { id: 'th-1', school_code: 'sch-A', min_score: 300, max_score: 400, probability: 80 },
      { id: 'th-2', school_code: 'sch-A', min_score: 100, max_score: 200, probability: 40 }
    ];
    expect(calculateMockExamPassRate(50, 'sch-A', thresholds)).toBe(40); // lower than min (100)
    expect(calculateMockExamPassRate(500, 'sch-A', thresholds)).toBe(80); // higher than max (400)
    expect(calculateMockExamPassRate(250, 'sch-B', thresholds)).toBe(0);   // wrong code

    // 9. learnFromTeacherCorrections with empty corrections or no exclamations
    const res9 = learnFromTeacherCorrections([]);
    expect(res9.exclamationsCount).toBe(0);
    expect(res9.positiveWords).toContain('成長');

    const res9b = learnFromTeacherCorrections([{ original: 'テスト', corrected: 'テスト。' }]);
    expect(res9b.exclamationsCount).toBe(0);

    // 10. reorganizeFutureTasks with no future tasks (early return)
    const tasks10: LearningTask[] = [
      { id: 't-1', student_id: 'std-1', unit_id: 'u-A', scheduled_date: '2026-06-19', status: 'completed', video_watched: true, test_passed: true, created_at: '' }
    ];
    const res10 = reorganizeFutureTasks('std-1', '数学', tasks10, []);
    expect(res10).toEqual(tasks10);

    // 11. generateAIReportText with no trailing punctuation
    const unpunctuatedText = "テスト結果は良好";
    const reportRes = generateAIReportText(unpunctuatedText, { exclamationsCount: 1, positiveWords: [] });
    expect(reportRes.endsWith('！')).toBe(true);

    const reportResNoEx = generateAIReportText(unpunctuatedText, { exclamationsCount: 0, positiveWords: [] });
    expect(reportResNoEx.endsWith('。')).toBe(true);
  });

  // 新機能: 年間計画（マイルストーン）逆算型自動スケジューリング機能のテスト
  describe('Milestone-based Reverse Scheduling & Progress Gap Tests', () => {
    it('should correctly calculate year, month, and week number from a date string', () => {
      // 2026-06-01: 月曜日 (6月の第1週)
      expect(getYearMonthWeek('2026-06-01')).toEqual({ month: 6, week_number: 1 });
      // 2026-06-08: 月曜日 (6月の第2週)
      expect(getYearMonthWeek('2026-06-08')).toEqual({ month: 6, week_number: 2 });
      // 2026-03-01: 日曜日 (3月の第1週 - adjFirstDayが日曜日のケース)
      expect(getYearMonthWeek('2026-03-01')).toEqual({ month: 3, week_number: 1 });
      // 2026-06-30: 火曜日 (6月の第5週 -> 4週にクランプされる)
      expect(getYearMonthWeek('2026-06-30').week_number).toBe(4);
    });

    it('should calculate progress gap correctly based on milestone plans and student progress', () => {
      const student: Student = {
        id: 'std-test',
        student_id: 'test',
        name: 'テスト生徒',
        email: 'test@example.com',
        grade: '中3',
        school_id: 'sch-1',
        status: 'normal',
        start_unit_id: null,
        created_at: ''
      };

      // 1月・2月のマイルストーンを混ぜて monthOrder (m < 3) のソートブランチをカバー
      const milestonePlans: MilestonePlan[] = [
        { id: 'mp-1', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 1, target_sequence_order: 10, is_holiday: false },
        { id: 'mp-2', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 2, target_sequence_order: 20, is_holiday: false },
        { id: 'mp-3', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 3, target_sequence_order: 30, is_holiday: false },
        { id: 'mp-jan', grade: '中3', subject: '数学', course: 'standard', month: 1, week_number: 1, target_sequence_order: 40, is_holiday: false },
        { id: 'mp-feb', grade: '中3', subject: '数学', course: 'standard', month: 2, week_number: 1, target_sequence_order: 50, is_holiday: false },
        { id: 'mp-holiday', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 4, is_holiday: true } // target_sequence_order is undefined
      ];

      const curriculumUnits: CurriculumUnit[] = [
        { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 10, created_at: '' },
        { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '単元2', sequence_order: 20, created_at: '' },
        { id: 'u-3', school_id: 'sch-1', subject: '数学', name: '単元3', sequence_order: 30, created_at: '' }
      ];

      // タスク履歴：単元1まで完了 (sequence_order = 10)
      const tasks: LearningTask[] = [
        { id: 't-1', student_id: 'std-test', unit_id: 'u-1', status: 'completed', video_watched: true, test_passed: true, scheduled_date: '2026-06-01', created_at: '' }
      ];

      const result = calculateProgressGap(student, tasks, milestonePlans, curriculumUnits, '2026-06-08', '数学');
      expect(result.gapWeeks).toBe(-1);
      expect(result.status).toBe('warning');

      const result2 = calculateProgressGap(student, tasks, milestonePlans, curriculumUnits, '2026-06-01', '数学');
      expect(result2.gapWeeks).toBe(0);
      expect(result2.status).toBe('normal');

      const tasksLead: LearningTask[] = [
        { id: 't-1', student_id: 'std-test', unit_id: 'u-1', status: 'completed', video_watched: true, test_passed: true, scheduled_date: '2026-06-01', created_at: '' },
        { id: 't-2', student_id: 'std-test', unit_id: 'u-2', status: 'completed', video_watched: true, test_passed: true, scheduled_date: '2026-06-02', created_at: '' }
      ];
      const result3 = calculateProgressGap(student, tasksLead, milestonePlans, curriculumUnits, '2026-06-01', '数学');
      expect(result3.gapWeeks).toBe(1);
      expect(result3.status).toBe('fast');

      // マイルストーン定義外（例：12月）の日付の場合 (todayIdx === -1)
      const resultEmpty = calculateProgressGap(student, tasks, milestonePlans, curriculumUnits, '2026-12-01', '数学');
      expect(resultEmpty.gapWeeks).toBe(0);
      expect(resultEmpty.status).toBe('normal');
    });

    it('should fallback target_sequence_order to 0 if null or undefined', () => {
      const student: Student = {
        id: 'std-test',
        student_id: 'test',
        name: 'テスト生徒',
        email: 'test@example.com',
        grade: '中3',
        school_id: 'sch-1',
        status: 'normal',
        start_unit_id: null,
        created_at: ''
      };

      const milestonePlans: MilestonePlan[] = [
        { id: 'mp-holiday', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 1, is_holiday: true } // target_sequence_order is undefined
      ];

      const curriculumUnits: CurriculumUnit[] = [
        { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 10, created_at: '' }
      ];

      const tasks: LearningTask[] = [];

      const result = calculateProgressGap(student, tasks, milestonePlans, curriculumUnits, '2026-06-01', '数学');
      expect(result.gapWeeks).toBe(0);
      expect(result.status).toBe('normal');
    });

    it('should reschedule tasks up to current week deadline and skip holiday weeks during reverse scheduling', () => {
      const student: Student = {
        id: 'std-test',
        student_id: 'test',
        name: 'テスト生徒',
        email: 'test@example.com',
        grade: '中3',
        school_id: 'sch-1',
        status: 'normal',
        start_unit_id: null,
        created_at: ''
      };

      const milestonePlans: MilestonePlan[] = [
        { id: 'mp-1', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 1, target_sequence_order: 10, is_holiday: false },
        { id: 'mp-2', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 2, target_sequence_order: 20, is_holiday: false },
        { id: 'mp-3', grade: '中3', subject: '数学', course: 'standard', month: 6, week_number: 3, target_sequence_order: 20, is_holiday: true, holiday_name: 'お休み' }
      ];

      const curriculumUnits: CurriculumUnit[] = [
        { id: 'u-1', school_id: 'sch-1', subject: '数学', name: '単元1', sequence_order: 10, created_at: '' },
        { id: 'u-2', school_id: 'sch-1', subject: '数学', name: '単元2', sequence_order: 20, created_at: '' }
      ];

      const tasks: LearningTask[] = [
        { id: 't-1', student_id: 'std-test', unit_id: 'u-1', scheduled_date: '2026-06-07', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' },
        { id: 't-2', student_id: 'std-test', unit_id: 'u-2', scheduled_date: '2026-06-08', status: 'unstarted', video_watched: false, test_passed: false, created_at: '' }
      ];

      const futureDates = ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-15'];

      const { updatedTasks, updatedStudent, isPunked } = rescheduleDelayedTasks(
        student,
        tasks,
        '2026-06-08',
        futureDates,
        3,
        milestonePlans,
        curriculumUnits
      );

      expect(isPunked).toBe(false);
      const holidayTask = updatedTasks.find(t => t.scheduled_date === '2026-06-15');
      expect(holidayTask).toBeUndefined();

      const validDates = ['2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'];
      updatedTasks.filter(t => t.student_id === student.id && t.status !== 'completed').forEach(t => {
        expect(validDates).toContain(t.scheduled_date);
      });

      // currentDate が日曜日 (2026-06-14) である場合をテスト (diffToSunday の day === 0 パス)
      const resSunday = rescheduleDelayedTasks(
        student,
        tasks,
        '2026-06-14',
        futureDates,
        3,
        milestonePlans,
        curriculumUnits
      );
      expect(resSunday.isPunked).toBeDefined();
    });
  });
});
