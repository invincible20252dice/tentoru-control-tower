import { CurriculumUnit, LearningTask, Student, ExamThresholdMaster, MilestonePlan } from './db';

export const schedulerConfig = {
  maxDailyTasksDefault: 3,
};

// -------------------------------------------------------------
// 0. 日付・進捗ギャップユーティリティ
// -------------------------------------------------------------
export function getYearMonthWeek(dateStr: string): { month: number; week_number: number } {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const dayOfMonth = date.getDate();
  
  // 月曜日を週の始まりとする (0:日, 1:月, ..., 6:土)
  const firstDay = new Date(year, date.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const adjFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const weekNum = Math.ceil((dayOfMonth + adjFirstDay) / 7);
  
  return {
    month,
    week_number: Math.min(4, weekNum)
  };
}

export function calculateProgressGap(
  student: Student,
  allTasks: LearningTask[],
  milestonePlans: MilestonePlan[],
  curriculumUnits: CurriculumUnit[],
  currentDateStr: string,
  subject: string
): { gapWeeks: number; status: 'normal' | 'fast' | 'warning' } {
  const { month: currMonth, week_number: currWeek } = getYearMonthWeek(currentDateStr);
  
  const matchedPlans = milestonePlans
    .filter(p => p.grade === student.grade && p.subject === subject && p.course === 'standard')
    .sort((a, b) => {
      const monthOrder = (m: number) => m >= 3 ? m : m + 12;
      const am = monthOrder(a.month);
      const bm = monthOrder(b.month);
      if (am !== bm) return am - bm;
      return a.week_number - b.week_number;
    });

  if (matchedPlans.length === 0) {
    return { gapWeeks: 0, status: 'normal' };
  }

  const todayIdx = matchedPlans.findIndex(p => p.month === currMonth && p.week_number === currWeek);
  if (todayIdx === -1) {
    return { gapWeeks: 0, status: 'normal' };
  }

  const studentTasks = allTasks.filter(t => t.student_id === student.id && t.status === 'completed');
  const subjectUnits = curriculumUnits.filter(u => u.subject === subject);
  const subjectUnitIds = new Set(subjectUnits.map(u => u.id));
  const completedSubjectTasks = studentTasks.filter(t => subjectUnitIds.has(t.unit_id));
  
  let currentSequence = 0;
  if (completedSubjectTasks.length > 0) {
    const completedUnitIds = completedSubjectTasks.map(t => t.unit_id);
    const completedUnits = subjectUnits.filter(u => completedUnitIds.includes(u.id));
    currentSequence = Math.max(0, ...completedUnits.map(u => u.sequence_order));
  } else {
    let startUnitId: string | null | undefined = null;
    const sub = subject;
    if (sub === '数学' || sub === '算数') startUnitId = student.start_unit_math;
    else if (sub === '英語') startUnitId = student.start_unit_english;
    else if (sub === '理科') startUnitId = student.start_unit_science;
    else if (sub === '社会' || sub === '歴史' || sub === '地理') startUnitId = student.start_unit_social;
    else if (sub === '国語') startUnitId = student.start_unit_japanese;

    if (!startUnitId) startUnitId = student.start_unit_id;

    if (startUnitId) {
      const startUnit = subjectUnits.find(u => u.id === startUnitId);
      if (startUnit) {
        currentSequence = startUnit.sequence_order - 1;
      }
    }
  }

  let studentIdx = -1;
  for (let i = 0; i < matchedPlans.length; i++) {
    const target = matchedPlans[i].target_sequence_order ?? 0;
    if (target <= currentSequence) {
      studentIdx = i;
    } else {
      break;
    }
  }

  const gapWeeks = studentIdx - todayIdx;

  let status: 'normal' | 'fast' | 'warning' = 'normal';
  if (gapWeeks <= -1) {
    status = 'warning';
  } else if (gapWeeks >= 1) {
    status = 'fast';
  }

  return { gapWeeks, status };
}

// -------------------------------------------------------------
// 1. カリキュラム順序変更時の未来タスク再編成
// -------------------------------------------------------------
export function reorganizeFutureTasks(
  studentId: string,
  subject: string,
  allTasks: LearningTask[],
  newUnits: CurriculumUnit[]
): LearningTask[] {
  // 当該生徒・当該教科のタスクのみをフィルタリング
  const studentTasks = allTasks.filter(t => t.student_id === studentId);
  const subjectUnitIds = new Set(newUnits.filter(u => u.subject === subject).map(u => u.id));
  
  // 対象のタスク
  const subjectTasks = studentTasks.filter(t => subjectUnitIds.has(t.unit_id));
  const otherTasks = allTasks.filter(t => !subjectTasks.some(st => st.id === t.id));

  // 完了済みのタスク（日付は固定）
  const completedTasks = subjectTasks.filter(t => t.status === 'completed');
  // 未完了のタスク（順序変更の影響を受ける）
  const futureTasks = subjectTasks.filter(t => t.status !== 'completed');

  if (futureTasks.length === 0) {
    return allTasks;
  }

  // 未来タスクの予定日リストを取得（昇順）
  const futureDates = futureTasks
    .map(t => t.scheduled_date)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // 新しい単元順序に従って未来の単元をソート
  // 新しいカリキュラム順での単元IDリスト
  const sortedUnitIds = newUnits
    .filter(u => u.subject === subject)
    .sort((a, b) => a.sequence_order - b.sequence_order)
    .map(u => u.id);

  // 未来タスクを新しい順序にソート
  const sortedFutureTasks = [...futureTasks].sort((a, b) => {
    return sortedUnitIds.indexOf(a.unit_id) - sortedUnitIds.indexOf(b.unit_id);
  });

  // 未来タスクに対して、元のスケジュール日を順番に再割り当て
  const reorganizedFutureTasks = sortedFutureTasks.map((task, index) => {
    // 日付リストの上限を超えないように安全に割り当て
    const date = futureDates[index];
    return {
      ...task,
      scheduled_date: date,
    };
  });

  return [...otherTasks, ...completedTasks, ...reorganizedFutureTasks];
}

// -------------------------------------------------------------
// 2. 遅れ時の自動リスケジュール & パンクアラート
// -------------------------------------------------------------
export function rescheduleDelayedTasks(
  student: Student,
  allTasks: LearningTask[],
  currentDate: string,
  futureDates: string[],
  maxDailyTasks: number = schedulerConfig.maxDailyTasksDefault,
  milestonePlans: MilestonePlan[] = [],
  curriculumUnits: CurriculumUnit[] = []
): { updatedTasks: LearningTask[]; updatedStudent: Student; isPunked: boolean } {
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  // 1. 進捗ギャップ（遅れ週）の確認
  let maxWeeksBehind = 0;
  if (milestonePlans.length > 0 && curriculumUnits.length > 0) {
    const subjects = Array.from(new Set(curriculumUnits.map(u => u.subject)));
    for (const sub of subjects) {
      const { gapWeeks } = calculateProgressGap(student, allTasks, milestonePlans, curriculumUnits, currentDate, sub);
      if (gapWeeks < 0) {
        maxWeeksBehind = Math.max(maxWeeksBehind, Math.abs(gapWeeks));
      }
    }
  }

  // 2. 2日連続未達成のチェック
  const currentMs = new Date(currentDate).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayDate = new Date(currentMs - oneDayMs).toISOString().split('T')[0];

  const yesterdayTasks = studentTasks.filter(t => t.scheduled_date === yesterdayDate);
  const todayTasks = studentTasks.filter(t => t.scheduled_date === currentDate);

  const yesterdayUncompleted = yesterdayTasks.length > 0 && yesterdayTasks.every(t => t.status !== 'completed');
  const todayUncompleted = todayTasks.length > 0 && todayTasks.every(t => t.status !== 'completed');

  const is2DaysConsecutiveUncompleted = yesterdayUncompleted && todayUncompleted;

  // 遅れがなく、かつ2日連続未達成でもない場合は何もしない
  if (maxWeeksBehind === 0 && !is2DaysConsecutiveUncompleted) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 未完了タスクの抽出
  const uncompletedTasks = studentTasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');
  const completedTasks = studentTasks.filter(t => t.status === 'completed' || t.status === 'skipped');

  if (uncompletedTasks.length === 0 || futureDates.length === 0) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 3. デッドライン（目標期日：今週の週末日曜日）の特定
  const currDateObj = new Date(currentDate);
  const day = currDateObj.getDay();
  const diffToSunday = day === 0 ? 0 : 7 - day;
  const deadlineSunday = new Date(currDateObj.getTime() + diffToSunday * oneDayMs);
  const deadlineDateStr = deadlineSunday.toISOString().split('T')[0];

  // 4. 休校週の日付を除外した、デッドラインまでの有効な割り当て可能日を抽出
  const validFutureDates = futureDates.filter(dStr => {
    if (dStr > deadlineDateStr) return false;

    const { month: dMonth, week_number: dWeek } = getYearMonthWeek(dStr);
    const isHoliday = milestonePlans.some(p => 
      p.grade === student.grade && 
      p.course === 'standard' && 
      p.month === dMonth && 
      p.week_number === dWeek && 
      p.is_holiday
    );
    return !isHoliday;
  });

  // もしデッドラインまでに割り当て可能な日がない場合は、全体から休校週を除外した日付を使用
  let targetDates = validFutureDates;
  if (targetDates.length === 0) {
    targetDates = futureDates.filter(dStr => {
      const { month: dMonth, week_number: dWeek } = getYearMonthWeek(dStr);
      return !milestonePlans.some(p => 
        p.grade === student.grade && 
        p.course === 'standard' && 
        p.month === dMonth && 
        p.week_number === dWeek && 
        p.is_holiday
      );
    });
  }

  if (targetDates.length === 0) {
    targetDates = futureDates;
  }

  // 1日あたりの必要タスク数を算出
  const totalTasks = uncompletedTasks.length;
  const daysCount = targetDates.length;
  const tasksPerDay = Math.ceil(totalTasks / daysCount);

  // パンク判定
  if (tasksPerDay > maxDailyTasks) {
    const updatedStudent: Student = {
      ...student,
      status: 'warning',
    };
    return { updatedTasks: allTasks, updatedStudent, isPunked: true };
  }

  // 均等配分する
  const rescheduledTasks = uncompletedTasks.map((task, index) => {
    const dateIndex = Math.floor(index / tasksPerDay);
    const scheduled_date = targetDates[Math.min(dateIndex, targetDates.length - 1)];
    return {
      ...task,
      scheduled_date,
    };
  });

  const updatedStudent: Student = {
    ...student,
    status: 'normal',
  };

  return {
    updatedTasks: [...otherTasks, ...completedTasks, ...rescheduledTasks],
    updatedStudent,
    isPunked: false,
  };
}

// -------------------------------------------------------------
// 3. 前倒しと爆速通知
// -------------------------------------------------------------
export function handleForwardTasks(
  student: Student,
  allTasks: LearningTask[],
  currentDate: string,
  weekEndDate: string
): { updatedTasks: LearningTask[]; updatedStudent: Student } {
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  // 今週期限（currentDate 〜 weekEndDate）までの未完了タスクがあるか確認
  const thisWeekTasks = studentTasks.filter(t => {
    const d = new Date(t.scheduled_date).getTime();
    const start = new Date(currentDate).getTime();
    const end = new Date(weekEndDate).getTime();
    return d >= start && d <= end;
  });

  const allCompletedThisWeek = thisWeekTasks.length > 0 && thisWeekTasks.every(t => t.status === 'completed');

  if (!allCompletedThisWeek) {
    return { updatedTasks: allTasks, updatedStudent: student };
  }

  // 今週のタスクが全て完了しているため、来週以降（weekEndDateより後）の未完了タスクを探す
  const futureUncompletedTasks = studentTasks
    .filter(t => new Date(t.scheduled_date).getTime() > new Date(weekEndDate).getTime() && t.status !== 'completed' && t.status !== 'skipped')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());

  if (futureUncompletedTasks.length === 0) {
    return { updatedTasks: allTasks, updatedStudent: student };
  }

  // 最も近い未来のタスクを今日（currentDate）に前倒し
  const targetTask = futureUncompletedTasks[0];
  const updatedTasks = allTasks.map(t => {
    if (t.id === targetTask.id) {
      return {
        ...t,
        scheduled_date: currentDate,
      };
    }
    return t;
  });

  const updatedStudent: Student = {
    ...student,
    status: 'fast', // 爆速ステータス
  };

  return { updatedTasks, updatedStudent };
}

// -------------------------------------------------------------
// 4. 志望校判定合格％算出
// -------------------------------------------------------------
export function calculateMockExamPassRate(
  score: number,
  schoolCode: string,
  thresholds: ExamThresholdMaster[]
): number {
  const schoolThresholds = thresholds.filter(t => t.school_code === schoolCode);
  if (schoolThresholds.length === 0) return 0;

  // スコアが合致する閾値を探す
  const matched = schoolThresholds.find(t => score >= t.min_score && score <= t.max_score);
  if (matched) {
    return matched.probability;
  }

  // 範囲外の場合の極値補正
  const minThreshold = schoolThresholds.reduce((prev, curr) => prev.min_score < curr.min_score ? prev : curr);
  const maxThreshold = schoolThresholds.reduce((prev, curr) => prev.max_score > curr.max_score ? prev : curr);

  if (score < minThreshold.min_score) {
    return minThreshold.probability;
  }
  if (score > maxThreshold.max_score) {
    return maxThreshold.probability;
  }

  return 0;
}

// -------------------------------------------------------------
// 5. AI文体パーソナライズの簡易学習 & 補正ロジック
// -------------------------------------------------------------
export interface PersonalStyle {
  exclamationsCount: number; // 「！」の使用傾向
  positiveWords: string[];   // 好んで使うポジティブワード
}

export function learnFromTeacherCorrections(
  corrections: { original: string; corrected: string }[]
): PersonalStyle {
  let exclamations = 0;
  const wordFrequency: Record<string, number> = {};

  // 講師が好んで使う表現リスト
  const targetWords = [
    '素晴らしい', 'すばらしい', '一歩', '成長', '頑張り', 
    '集中', '見事', '達成', '姿勢', '挑戦', '逃げずに'
  ];

  corrections.forEach(c => {
    // 修正文に含まれる「！」をカウント
    const matches = c.corrected.match(/[！!]/g);
    if (matches) {
      exclamations += matches.length;
    }

    // 特定の言葉が含まれているか
    targetWords.forEach(word => {
      if (c.corrected.includes(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
  });

  // 頻出上位のワードを抽出
  const positiveWords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  return {
    exclamationsCount: exclamations,
    positiveWords: positiveWords.length > 0 ? positiveWords : ['成長', '素晴らしい']
  };
}

export function generateAIReportText(
  baseText: string,
  style: PersonalStyle
): string {
  let text = baseText;

  // 1. 文末の句点「。」を「！」に置換する（exclamationsCount がある場合）
  if (style.exclamationsCount > 0) {
    // 最後の文末だけでなく、いくつかの句点を「！」に
    text = text.replace(/。/g, '！');
    // 重複した「！！」を防ぐ
    text = text.replace(/！+/g, '！');
  }

  // 2. ポジティブワードを文頭や要所に織り交ぜる
  // もしテキストに「頑張りました」があるなら、「素晴らしい成長の一歩です！」などに補正
  if (style.positiveWords.includes('成長') || style.positiveWords.includes('一歩')) {
    text = text.replace(/頑張りました[！。]/g, '頑張りました！これは素晴らしい成長の一歩です！');
  }
  if (style.positiveWords.includes('素晴らしい') || style.positiveWords.includes('すばらしい')) {
    text = text.replace(/よくできました[！。]/g, '非常によく頑張り、姿勢がすばらしいです！');
  }
  if (style.positiveWords.includes('逃げずに') || style.positiveWords.includes('姿勢')) {
    text = text.replace(/間違えましたが/g, '間違えた問題もありましたが、そこから逃げずに動画で学び直す姿勢が見られ');
  }

  // 文末の安全対策
  if (!text.endsWith('！') && !text.endsWith('。')) {
    text += style.exclamationsCount > 0 ? '！' : '。';
  }

  return text;
}

/**
 * 未完了の学習予定タスクを、本来のカリキュラム順序（sequence_order）を守りながら、
 * 指定された日程以降へ順次後ろ倒し（再スケジューリング）します。
 */
export function rescheduleFutureUncompletedTasks(
  studentId: string,
  allTasks: LearningTask[],
  curriculumUnits: CurriculumUnit[],
  startDate: string,
  futureDates: string[]
): LearningTask[] {
  const studentTasks = allTasks.filter(t => t.student_id === studentId);
  const otherTasks = allTasks.filter(t => t.student_id !== studentId);

  const todayMs = new Date(startDate).getTime() - 24 * 60 * 60 * 1000;
  const todayStr = new Date(todayMs).toISOString().split('T')[0];

  const completedTasks = studentTasks.filter(t => t.status === 'completed' || (t.scheduled_date === todayStr && t.period !== null));
  const uncompletedTasks = studentTasks.filter(t => t.status !== 'completed' && !(t.scheduled_date === todayStr && t.period !== null));

  if (uncompletedTasks.length === 0 || futureDates.length === 0) {
    return allTasks;
  }

  // startDate 以降の有効な未来日を抽出・ソート
  const validDates = futureDates
    .filter(d => d >= startDate)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  if (validDates.length === 0) {
    return allTasks;
  }

  // 未完了タスクを教科別 ➔ sequence_order順にソートする
  const sortedUncompleted = [...uncompletedTasks].sort((a, b) => {
    const unitA = curriculumUnits.find(u => u.id === a.unit_id);
    const unitB = curriculumUnits.find(u => u.id === b.unit_id);
    if (!unitA || !unitB) return 0;
    if (unitA.subject !== unitB.subject) {
      return unitA.subject.localeCompare(unitB.subject);
    }
    return unitA.sequence_order - unitB.sequence_order;
  });

  // 日付に対して順次割り当て直す（1日あたり最大2タスクを目安に配置）
  const rescheduled = sortedUncompleted.map((task, index) => {
    const dateIdx = Math.floor(index / 2); // 1日最大2コマ
    const scheduled_date = validDates[Math.min(dateIdx, validDates.length - 1)];
    return {
      ...task,
      scheduled_date,
    };
  });

  return [...otherTasks, ...completedTasks, ...rescheduled];
}
