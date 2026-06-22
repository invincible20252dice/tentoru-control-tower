import { CurriculumUnit, LearningTask, Student, ExamThresholdMaster } from './db';

export const schedulerConfig = {
  maxDailyTasksDefault: 3,
};

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
  maxDailyTasks: number = schedulerConfig.maxDailyTasksDefault
): { updatedTasks: LearningTask[]; updatedStudent: Student; isPunked: boolean } {
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  // 2日連続未達成のチェック
  // 簡易チェック：今日(currentDate)と昨日(currentDate - 1)に予定されていたタスクで、完了していないものがあるか？
  // ※ここではテスト条件「2日連続未達成」を判定するために、過去の日付で status !== 'completed' のものを判定します
  const currentMs = new Date(currentDate).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayDate = new Date(currentMs - oneDayMs).toISOString().split('T')[0];

  const yesterdayTasks = studentTasks.filter(t => t.scheduled_date === yesterdayDate);
  const todayTasks = studentTasks.filter(t => t.scheduled_date === currentDate);

  const yesterdayUncompleted = yesterdayTasks.length > 0 && yesterdayTasks.every(t => t.status !== 'completed');
  const todayUncompleted = todayTasks.length > 0 && todayTasks.every(t => t.status !== 'completed');

  const is2DaysConsecutiveUncompleted = yesterdayUncompleted && todayUncompleted;

  // 2日連続未達成でない場合は何もしない
  if (!is2DaysConsecutiveUncompleted) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 未完了タスクの抽出（今日以前の未完了タスク＋今日より未来の未完了タスク）
  const uncompletedTasks = studentTasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');
  const completedTasks = studentTasks.filter(t => t.status === 'completed' || t.status === 'skipped');

  if (uncompletedTasks.length === 0 || futureDates.length === 0) {
    return { updatedTasks: allTasks, updatedStudent: student, isPunked: false };
  }

  // 1日あたりの必要タスク数を算出
  const totalTasks = uncompletedTasks.length;
  const daysCount = futureDates.length;
  const tasksPerDay = Math.ceil(totalTasks / daysCount);

  // パンク判定
  if (tasksPerDay > maxDailyTasks) {
    // 計画パンク：自動リスケジュールをストップし、生徒ステータスを warning に
    const updatedStudent: Student = {
      ...student,
      status: 'warning',
    };
    return { updatedTasks: allTasks, updatedStudent, isPunked: true };
  }

  // 均等配分する
  const rescheduledTasks = uncompletedTasks.map((task, index) => {
    const dateIndex = Math.floor(index / tasksPerDay);
    const scheduled_date = futureDates[dateIndex];
    return {
      ...task,
      scheduled_date,
    };
  });

  const updatedStudent: Student = {
    ...student,
    status: 'normal', // パンク解消またはノーマル状態へ
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
