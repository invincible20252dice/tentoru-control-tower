import { db, CurriculumUnit, CurriculumMaster, LearningTask, Student, ExamThresholdMaster, MilestonePlan, BranchAIRules, DEFAULT_BRANCH_AI_RULES, StudentLessonProgress, MiniTestResult } from './db';

export const schedulerConfig = {
  maxDailyTasksDefault: 3,
};

/**
 * 授業範囲文字列のフォーマット ("開始 〜 目標" または "開始")
 */
export function formatLessonRange(startName?: string | null, endName?: string | null): string {
  if (!startName && !endName) return '';
  if (startName && endName && startName !== endName) {
    return `${startName} 〜 ${endName}`;
  }
  return startName || endName || '';
}

/**
 * 単元名やテスト名の表記揺れを吸収し、比較用の正規化文字列を生成する
 * - 全角英数・記号の半角化
 * - 全角空白 (\u3000) を半角空白に変換し、連続空白を1つに縮約・トリム
 * - ハイフン・ダッシュ類の統一
 * - 先頭の教科プレフィックス（「算数:」「英語:」等）や【再テスト対策・総】【弱点補強】等の除去
 * - 「- 単元確認テスト」「- 単元テスト」「（再テスト）」「ーやり直しー」等の装飾接尾辞を除去
 */
export function normalizeUnitName(name?: string | null): string {
  if (!name) return '';
  let cleaned = name
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[〜～~]/g, '~')
    .replace(/[\s\u3000]+/g, ' ')
    .trim()
    .replace(/[-−ー―]/g, '-');

  // 先頭の教科プレフィックスや角括弧装飾を再帰的に除去
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    cleaned = cleaned
      .replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '')
      .replace(/^【(?:再テスト[^】]*|弱点補強[^】]*|やり直し[^】]*|総復習[^】]*|復習[^】]*|補習[^】]*|テスト[^】]*|単元[^】]*)】\s*/i, '')
      .replace(/^【[^】]+】\s*/i, '')
      .replace(/^\[[^\]]+\]\s*/i, '')
      .trim();
  }

  return cleaned
    .replace(/\s*-\s*(単元確認テスト|単元テスト|確認テスト|テスト|やり直し|再テスト|まとめテスト).*$/i, '')
    .replace(/[（(](再テスト|やり直し|復習|テスト)[）)]/g, '')
    .replace(/[-−ー―]やり直し[-−ー―]/g, '')
    .trim();
}

/**
 * 単元名やテスト内容が同一単元・同一テストを指しているか判定する
 */
export function isMatchingUnitOrTest(source?: string | null, target?: string | null): boolean {
  if (!source || !target) return false;
  const sRaw = source.replace(/[〜～~]/g, '~').replace(/[\s\u3000]+/g, ' ').trim();
  const tRaw = target.replace(/[〜～~]/g, '~').replace(/[\s\u3000]+/g, ' ').trim();
  if (sRaw === tRaw) return true;

  const sClean = sRaw.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
  const tClean = tRaw.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
  if (sClean === tClean) return true;

  // まとめテストの判定: 番号（1, 2, 3）や有無のチェック（cm-auto-sum[1-3] も含む）
  const sSummaryMatch = sClean.match(/まとめテスト\s*[（(]?\s*([0-9１-３一二三]+)\s*[）)]?/i) || sRaw.match(/cm-auto-sum([1-3])/i);
  const tSummaryMatch = tClean.match(/まとめテスト\s*[（(]?\s*([0-9１-３一二三]+)\s*[）)]?/i) || tRaw.match(/cm-auto-sum([1-3])/i);

  // 一方がまとめテストで他方がまとめテストでない場合、種別が異なるため一致しない
  if ((sSummaryMatch && !tSummaryMatch) || (!sSummaryMatch && tSummaryMatch)) {
    return false;
  }
  // 両方がまとめテストの場合、番号が異なれば一致しない
  if (sSummaryMatch && tSummaryMatch) {
    const sNum = sSummaryMatch[1].replace(/[１-３]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const tNum = tSummaryMatch[1].replace(/[１-３]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    if (sNum !== tNum) return false;
    // 番号が一致する場合、単元名部分が一致するか検証
    const sUnit = normalizeUnitName(sClean);
    const tUnit = normalizeUnitName(tClean);
    if (!sUnit || !tUnit) return true;
    return sUnit === tUnit || sClean.includes(tClean) || tClean.includes(sClean);
  }

  // Check Testの判定（cm-auto-check も含む）
  const sIsCheck = sClean.toLowerCase().includes('check test') || sRaw.includes('cm-auto-check');
  const tIsCheck = tClean.toLowerCase().includes('check test') || tRaw.includes('cm-auto-check');
  if ((sIsCheck && !tIsCheck) || (!sIsCheck && tIsCheck)) {
    return false;
  }
  if (sIsCheck && tIsCheck) {
    const sUnit = normalizeUnitName(sClean);
    const tUnit = normalizeUnitName(tClean);
    if (!sUnit || !tUnit) return true;
    return sUnit === tUnit || sClean.includes(tClean) || tClean.includes(sClean);
  }

  // 単元確認テストの判定（cm-auto-ut も含む）
  const sIsUnitTest = sClean.includes('単元確認テスト') || sClean.includes('単元テスト') || sRaw.includes('cm-auto-ut-');
  const tIsUnitTest = tClean.includes('単元確認テスト') || tClean.includes('単元テスト') || tRaw.includes('cm-auto-ut-');
  // 一方が単元確認テストで、他方がまとめテストやCheck Test等の別種別の場合は一致しない
  if (sIsUnitTest !== tIsUnitTest) {
    // 単元名そのものとのマッチング（例: unit_name === '0の たしざんと ひきざん' と cid === '...単元確認テスト'）は許容する場合があるが、
    // 授業名（STEP 1, 0のたしざん等）との誤一致は防ぐ
    const otherClean = sIsUnitTest ? tClean : sClean;
    const isOtherLesson = otherClean.includes('STEP') || otherClean.includes('たしざん') || otherClean.includes('ひきざん') || otherClean.includes('かず');
    if (isOtherLesson) return false;
  }

  if (sRaw.includes(tRaw) || tRaw.includes(sRaw)) return true;

  const sNorm = normalizeUnitName(source);
  const tNorm = normalizeUnitName(target);
  if (!sNorm || !tNorm) return false;
  return sNorm === tNorm || sNorm.includes(tNorm) || tNorm.includes(sNorm);
}

/**
 * 生徒の指定教科における最新の単元テスト合否状況（合格/不合格）を取得する
 */
export function getLatestUnitTestStatusForSubject(params: {
  studentId: string;
  subject: string;
  miniTestResults?: MiniTestResult[];
}): {
  hasFailedUnitTest: boolean;
  failedUnitTest: MiniTestResult | null;
  completedUnitTestKeys: Set<string>;
  completedUnitKeys?: Set<string>;
} {
  const { studentId, subject, miniTestResults } = params;
  const results = (miniTestResults && miniTestResults.length > 0) 
    ? miniTestResults 
    : (studentId ? db.getMiniTestResults(studentId) : db.getMiniTestResults());

  const targetSub = subject;
  const studentResults = results
    .filter(r =>
      r.student_id === studentId &&
      (r.test_type === 'unit_test' || r.test_content.includes('テスト') || r.test_content.includes('確認') || r.test_content.toLowerCase().includes('check test')) &&
      (r.subject === targetSub || (!r.subject && (targetSub === '算数' || targetSub === '数学')) || (targetSub === '算数' && r.subject === '数学') || (targetSub === '数学' && r.subject === '算数'))
    )
    .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

  const completedUnitTestKeys = new Set<string>();
  const completedUnitKeys = new Set<string>();
  let failedUnitTest: MiniTestResult | null = null;

  const latestByContent = new Map<string, MiniTestResult>();
  studentResults.forEach(r => {
    const isReviewOrCheck = r.test_content.includes('まとめテスト') || 
                            (r.unit_name && r.unit_name.includes('まとめテスト')) || 
                            r.test_content.toLowerCase().includes('check test') || 
                            (r.unit_name && r.unit_name.toLowerCase().includes('check test'));
    const isUnitTest = !isReviewOrCheck && (
      r.test_type === 'unit_test' || 
      r.test_content.includes('単元確認テスト') || 
      r.test_content.includes('単元テスト') || 
      (r.unit_name && (r.unit_name.includes('単元確認テスト') || r.unit_name.includes('単元テスト')))
    );
    const rawKey = (isUnitTest && r.unit_name) ? r.unit_name : r.test_content;
    const normKey = isUnitTest ? normalizeUnitName(rawKey) : r.test_content.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
    const key = normKey || rawKey;
    if (!key) return;

    const hasEvaluation = (r.score !== null && r.score !== undefined) || r.passed !== undefined || r.status === 'passed' || r.status === 'failed';
    const existing = latestByContent.get(key);
    if (!existing) {
      latestByContent.set(key, r);
    } else {
      const existingHasEval = (existing.score !== null && existing.score !== undefined) || existing.passed !== undefined || existing.status === 'passed' || existing.status === 'failed';
      if (!existingHasEval && hasEvaluation) {
        latestByContent.set(key, r);
      }
    }
  });

  for (const [key, result] of latestByContent.entries()) {
    let passScore = 80;
    if (result.passing_line) {
      const match = result.passing_line.match(/\d+/);
      if (match) passScore = parseInt(match[0], 10);
    }

    const isPassed = result.passed === true || result.status === 'passed' || (result.score !== null && result.score !== undefined && result.score >= passScore);
    const isFailed = result.passed === false || result.status === 'failed' || (result.score !== null && result.score !== undefined && result.score < passScore);

    const isReviewOrCheck = result.test_content.includes('まとめテスト') || 
                            (result.unit_name && result.unit_name.includes('まとめテスト')) || 
                            result.test_content.toLowerCase().includes('check test') || 
                            (result.unit_name && result.unit_name.toLowerCase().includes('check test'));
    const isUnitTest = !isReviewOrCheck && (
      result.test_type === 'unit_test' || 
      result.test_content.includes('単元確認テスト') || 
      result.test_content.includes('単元テスト') || 
      (result.unit_name && (result.unit_name.includes('単元確認テスト') || result.unit_name.includes('単元テスト')))
    );

    if (isPassed) {
      completedUnitTestKeys.add(key);
      completedUnitTestKeys.add(result.test_content);
      const cleanContent = result.test_content.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
      if (cleanContent) completedUnitTestKeys.add(cleanContent);
      if (result.unit_name) {
        completedUnitTestKeys.add(`${result.unit_name} - ${cleanContent}`);
        completedUnitTestKeys.add(`${result.unit_name} - ${result.test_content}`);
      }

      // 単元確認テストの合格の場合のみ、単元全体を修了扱いとする単元キーを登録
      if (isUnitTest) {
        if (result.unit_name) {
          completedUnitTestKeys.add(result.unit_name);
          completedUnitTestKeys.add(normalizeUnitName(result.unit_name));
          const cleanUnit = result.unit_name.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
          if (cleanUnit) {
            completedUnitTestKeys.add(cleanUnit);
            completedUnitKeys.add(cleanUnit);
          }
          completedUnitKeys.add(result.unit_name);
          completedUnitKeys.add(normalizeUnitName(result.unit_name));
        }
        completedUnitTestKeys.add(normalizeUnitName(result.test_content));
        completedUnitKeys.add(normalizeUnitName(result.test_content));
      }
    } else if (isFailed) {
      if (!failedUnitTest) {
        failedUnitTest = result;
      }
    }
  }

  // もし最新不合格テストが存在する場合、その単元キーが過去合格にあっても安全のため合格キーから除外
  if (failedUnitTest) {
    const isFailedReviewOrCheck = failedUnitTest.test_content.includes('まとめテスト') || 
                                  (failedUnitTest.unit_name && failedUnitTest.unit_name.includes('まとめテスト')) || 
                                  failedUnitTest.test_content.toLowerCase().includes('check test') || 
                                  (failedUnitTest.unit_name && failedUnitTest.unit_name.toLowerCase().includes('check test'));
    const isFailedUT = !isFailedReviewOrCheck && (
      failedUnitTest.test_type === 'unit_test' || 
      failedUnitTest.test_content.includes('単元確認テスト') || 
      failedUnitTest.test_content.includes('単元テスト') || 
      (failedUnitTest.unit_name && (failedUnitTest.unit_name.includes('単元確認テスト') || failedUnitTest.unit_name.includes('単元テスト')))
    );

    if (isFailedUT) {
      const fNorm = normalizeUnitName(failedUnitTest.unit_name || failedUnitTest.test_content);
      completedUnitTestKeys.delete(fNorm);
      completedUnitKeys.delete(fNorm);
      if (failedUnitTest.unit_name) {
        completedUnitTestKeys.delete(failedUnitTest.unit_name);
        completedUnitTestKeys.delete(normalizeUnitName(failedUnitTest.unit_name));
        completedUnitKeys.delete(failedUnitTest.unit_name);
        completedUnitKeys.delete(normalizeUnitName(failedUnitTest.unit_name));
        const cleanUnit = failedUnitTest.unit_name.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
        if (cleanUnit) {
          completedUnitTestKeys.delete(cleanUnit);
          completedUnitKeys.delete(cleanUnit);
        }
      }
      completedUnitTestKeys.delete(normalizeUnitName(failedUnitTest.test_content));
      completedUnitKeys.delete(normalizeUnitName(failedUnitTest.test_content));
    }
    completedUnitTestKeys.delete(failedUnitTest.test_content);
    const cleanContent = failedUnitTest.test_content.replace(/^(?:算数|数学|英語|国語|理科|社会)\s*[:：]\s*/i, '').trim();
    if (cleanContent) completedUnitTestKeys.delete(cleanContent);
  }

  return {
    hasFailedUnitTest: Boolean(failedUnitTest),
    failedUnitTest,
    completedUnitTestKeys,
    completedUnitKeys
  };
}

/**
 * 生徒の前回までの完了状況および単元テスト合否に基づき、次回授業日の開始授業 (From: 直近の未完了授業 / 再テスト) を特定する
 */
/**
 * 学年表記の表記揺れを統一正規化する ("1年生", "小学1年" -> "小1" 等)
 */
export function normalizeGrade(grade?: string): string {
  if (!grade) return '';
  const g = grade.trim();
  if (g.includes('1') || g.includes('１')) {
    if (g.startsWith('中')) return '中1';
    if (g.startsWith('高')) return '高1';
    return '小1';
  }
  if (g.includes('2') || g.includes('２')) {
    if (g.startsWith('中')) return '中2';
    if (g.startsWith('高')) return '高2';
    return '小2';
  }
  if (g.includes('3') || g.includes('３')) {
    if (g.startsWith('中')) return '中3';
    if (g.startsWith('高')) return '高3';
    return '小3';
  }
  if (g.includes('4') || g.includes('４')) return '小4';
  if (g.includes('5') || g.includes('５')) return '小5';
  if (g.includes('6') || g.includes('６')) return '小6';
  return g;
}

/**
 * 算数・英語などの全単元末尾に単元テストが未設置の場合、自動的に単元確認テストアイテムを補完・組み込む
 * 重複したテスト（STEP 2, 3, 4等に複数並ぶ不具合）を徹底排除してユニーク化する
 */
export function ensureMathEnglishUnitTests(masters: CurriculumMaster[]): CurriculumMaster[] {
  if (!masters || masters.length === 0) return masters;

  const result: CurriculumMaster[] = [];
  const unitGroups = new Map<string, CurriculumMaster[]>();

  masters.forEach(m => {
    const normGrade = normalizeGrade(m.grade);
    const key = `${m.subject}_${normGrade}_${m.unit_name || ''}`;
    if (!unitGroups.has(key)) {
      unitGroups.set(key, []);
    }
    unitGroups.get(key)!.push(m);
  });

  for (const [, group] of unitGroups.entries()) {
    group.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const firstItem = group[0];
    const normGrade = normalizeGrade(firstItem.grade);
    const isTargetSubject = firstItem.subject === '算数' || firstItem.subject === '数学' || firstItem.subject === '英語';

    const isElem = normGrade.startsWith('小') || 
                   /^[1-6]年生?$/.test(normGrade) || 
                   normGrade === '園児' || 
                   (firstItem.grade ? (firstItem.grade.startsWith('小') || /^[1-6]年生?$/.test(firstItem.grade) || firstItem.grade === '園児') : false) ||
                   (!firstItem.grade && firstItem.subject === '算数');

    // 授業アイテムとテストアイテムを分離
    const lessons: CurriculumMaster[] = [];
    const unitTests: CurriculumMaster[] = [];

    group.forEach(m => {
      const lessonName = m.lesson_name || '';
      const unitName = m.unit_name || '';
      // まとめテストとCheck Testは通常授業レッスンとして扱う（点数入力なし）
      const isReviewOrCheck = lessonName.includes('まとめテスト') || 
                              unitName.includes('まとめテスト') || 
                              lessonName.toLowerCase().includes('check test') || 
                              unitName.toLowerCase().includes('check test');

      const isTest = !isReviewOrCheck && (
        m.item_type === 'unit_test' || 
        lessonName.includes('単元確認テスト') || 
        lessonName.includes('単元テスト') || 
        (lessonName.includes('テスト') && !lessonName.includes('まとめ')) || 
        (unitName.includes('テスト') && !unitName.includes('まとめ'))
      );
      if (isTest) {
        unitTests.push(m);
      } else {
        lessons.push(m);
      }
    });

    // 小学生の全単元に対する「まとめテスト」および「Check Test」の通常授業アイテム補完
    if (isElem && firstItem.unit_name && firstItem.unit_name !== '単元未設定' && group.length >= 1) {
      const lastLessonOrder = lessons.length > 0 ? (lessons[lessons.length - 1].sort_order ?? 0) : (firstItem.sort_order ?? 0);

      // 1. 算数（全単元）: 「まとめテスト（１）」「まとめテスト（２）」「まとめテスト（３）」
      if (firstItem.subject === '算数' || firstItem.subject === '数学') {
        const hasSummary1 = lessons.some(l => l.lesson_name?.includes('まとめテスト（１）') || l.lesson_name?.includes('まとめテスト(1)'));
        const hasSummary2 = lessons.some(l => l.lesson_name?.includes('まとめテスト（２）') || l.lesson_name?.includes('まとめテスト(2)'));
        const hasSummary3 = lessons.some(l => l.lesson_name?.includes('まとめテスト（３）') || l.lesson_name?.includes('まとめテスト(3)'));

        if (!hasSummary1) {
          lessons.push({
            id: `cm-auto-sum1-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（１）',
            sort_order: lastLessonOrder + 0.1,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
        if (!hasSummary2) {
          lessons.push({
            id: `cm-auto-sum2-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（２）',
            sort_order: lastLessonOrder + 0.2,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
        if (!hasSummary3) {
          lessons.push({
            id: `cm-auto-sum3-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（３）',
            sort_order: lastLessonOrder + 0.3,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
      }

      // 2. 英語（全単元）: 「Check Test」
      if (firstItem.subject === '英語') {
        const hasCheck = lessons.some(l => l.lesson_name?.toLowerCase().includes('check test'));
        if (!hasCheck) {
          lessons.push({
            id: `cm-auto-check-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'Check Test',
            sort_order: lastLessonOrder + 0.1,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
      }

      // 3. 国語（全単元）: 各単元の最後に「まとめテスト（１）」「まとめテスト（２）」「まとめテスト（３）」
      if (firstItem.subject === '国語') {
        const hasSummary1 = lessons.some(l => l.lesson_name?.includes('まとめテスト（１）') || l.lesson_name?.includes('まとめテスト(1)'));
        const hasSummary2 = lessons.some(l => l.lesson_name?.includes('まとめテスト（２）') || l.lesson_name?.includes('まとめテスト(2)'));
        const hasSummary3 = lessons.some(l => l.lesson_name?.includes('まとめテスト（３）') || l.lesson_name?.includes('まとめテスト(3)'));

        if (!hasSummary1) {
          lessons.push({
            id: `cm-auto-sum1-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（１）',
            sort_order: lastLessonOrder + 0.1,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
        if (!hasSummary2) {
          lessons.push({
            id: `cm-auto-sum2-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（２）',
            sort_order: lastLessonOrder + 0.2,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
        if (!hasSummary3) {
          lessons.push({
            id: `cm-auto-sum3-${firstItem.subject}-${normGrade || 'elem'}-${firstItem.unit_name}`,
            grade: normGrade || firstItem.grade,
            subject: firstItem.subject,
            unit_name: firstItem.unit_name,
            lesson_name: 'まとめテスト（３）',
            sort_order: lastLessonOrder + 0.3,
            item_type: 'lesson',
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // 授業アイテムを追加
    result.push(...lessons);

    if (unitTests.length > 0) {
      // 既にテストアイテムがある場合は最初の1件のみ採用（二重三重の重複を完全デデュプリケーション）
      const primaryTest = unitTests[0];
      const rawLessonName = primaryTest.lesson_name || '単元確認テスト';
      const cleanName = rawLessonName.replace(/^[^-]+-\s*/, '').trim();
      const formattedLessonName = primaryTest.unit_name 
        ? `${primaryTest.unit_name} - ${cleanName.includes('単元確認テスト') || cleanName.includes('単元テスト') || (cleanName.includes('テスト') && !cleanName.includes('まとめテスト')) ? '単元確認テスト' : cleanName}`
        : rawLessonName;

      // 単元テストの sort_order は通常授業アイテム（まとめテスト等含む）より後に配置されるように調整
      const maxLessonOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.sort_order ?? 0)) : (primaryTest.sort_order ?? 0);
      const testSortOrder = Math.max(primaryTest.sort_order ?? 0, maxLessonOrder + 0.1);

      result.push({
        ...primaryTest,
        lesson_name: formattedLessonName,
        sort_order: testSortOrder,
        item_type: 'unit_test'
      });
    } else if (isTargetSubject && firstItem.unit_name && firstItem.unit_name !== '単元未設定' && group.length >= 1) {
      // テストアイテムが存在しない算数・英語単元には末尾に1件のみ自動生成
      const maxLessonOrder = lessons.length > 0 ? Math.max(...lessons.map(l => l.sort_order ?? 0)) : (firstItem.sort_order ?? 0);
      const autoUnitTest: CurriculumMaster = {
        id: `cm-auto-ut-${firstItem.subject}-${normGrade}-${firstItem.unit_name}`,
        grade: normGrade || firstItem.grade,
        subject: firstItem.subject,
        unit_name: firstItem.unit_name,
        lesson_name: `${firstItem.unit_name} - 単元確認テスト`,
        sort_order: maxLessonOrder + 0.2,
        item_type: 'unit_test',
        passing_line: '80%以上',
        created_at: new Date().toISOString()
      };
      result.push(autoUnitTest);
    }
  }

  return result.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * 生徒の前回までの完了状況および単元テスト合否に基づき、次回授業日の開始授業 (From: 直近の未完了授業 / 再テスト) を特定する
 */
export function findNextUncompletedLessonForSubject(params: {
  student?: Student | null;
  subject: string;
  tasks?: LearningTask[];
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  schoolId?: string;
  lessonProgressList?: StudentLessonProgress[];
  miniTestResults?: MiniTestResult[];
}): {
  lessonId: string | null;
  lessonName: string | null;
  masterIndex: number;
  hasFailedUnitTest?: boolean;
  failedUnitTest?: MiniTestResult | null;
} {
  const {
    student,
    subject,
    tasks = [],
    curriculumMasters: rawMasters = [],
    curriculumUnits: rawUnits = [],
    schoolId = student?.school_id,
    lessonProgressList = [],
    miniTestResults: rawMiniTestResults
  } = params;

  const curriculumMasters = (rawMasters && rawMasters.length > 0) ? rawMasters : db.getCurriculumMasters();
  const curriculumUnits = (rawUnits && rawUnits.length > 0) ? rawUnits : db.getCurriculumUnits();
  const miniTestResults = (rawMiniTestResults && rawMiniTestResults.length > 0)
    ? rawMiniTestResults
    : (student?.id ? db.getMiniTestResults(student.id) : db.getMiniTestResults());

  const isElem = Boolean(
    student?.grade?.startsWith('小') || 
    (student?.grade?.includes('年') && !student?.grade?.startsWith('中') && !student?.grade?.startsWith('高')) ||
    student?.grade === '園児'
  );
  const isJunior = Boolean(student?.grade?.startsWith('中'));
  const isHigh = Boolean(student?.grade?.startsWith('高') || student?.grade === '既卒');

  const filteredMasters = curriculumMasters.filter(m => {
    if (isElem) {
      const isMasterElem = (m.grade || '').startsWith('小') || /^[1-6]年生?$/.test(m.grade || '') || m.grade === '園児';
      if (!isMasterElem) return false;
      if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
        return m.subject === '算数' || m.subject === '数学';
      }
      return m.subject === subject;
    } else if (isJunior) {
      const isMasterJunior = (m.grade || '').startsWith('中') || /^[7-9]年生?$/.test(m.grade || '');
      if (!isMasterJunior) return false;
      if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
        return m.subject === '数学' || m.subject === '算数';
      }
      return m.subject === subject;
    } else if (isHigh) {
      const isMasterHigh = (m.grade || '').startsWith('高') || m.grade === '既卒';
      if (!isMasterHigh) return false;
      return m.subject === subject;
    }
    if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
      return m.subject === '算数' || m.subject === '数学';
    }
    return m.subject === subject;
  });

  let masterLessons: Array<{ id: string; name: string; sort_order: number; unit_name?: string; item_type?: string }> = [];

  const ensuredMasters = ensureMathEnglishUnitTests(filteredMasters);
  if (ensuredMasters.length > 0) {
    masterLessons = ensuredMasters
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(m => ({
        id: m.id,
        name: m.unit_name ? `${m.unit_name} - ${m.lesson_name.replace(/^[^-]+-\s*/, '')}` : m.lesson_name,
        sort_order: m.sort_order ?? 0,
        unit_name: m.unit_name,
        item_type: m.item_type
      }));
  } else {
    const matchingSchoolUnits = curriculumUnits.filter(u => 
      (schoolId ? u.school_id === schoolId : false) &&
      (isElem ? ((subject === '算数' || subject === '数学') ? (u.subject === '算数' || u.subject === '数学') : u.subject === subject) : u.subject === subject)
    );

    if (matchingSchoolUnits.length > 0) {
      masterLessons = matchingSchoolUnits
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map(u => ({
          id: u.id,
          name: u.name,
          sort_order: u.sequence_order ?? 0
        }));
    } else {
      const fallbackUnits = curriculumUnits
        .filter(u => (!schoolId || u.school_id === schoolId || !u.school_id) && 
                     (isElem ? ((subject === '算数' || subject === '数学') ? (u.subject === '算数' || u.subject === '数学') : u.subject === subject) : u.subject === subject))
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map(u => ({
          id: u.id,
          name: u.name,
          sort_order: u.sequence_order ?? 0
        }));
      masterLessons = fallbackUnits;
    }
  }

  if (masterLessons.length === 0) {
    return { lessonId: null, lessonName: null, masterIndex: -1 };
  }

  if (!student) {
    return {
      lessonId: masterLessons[0].id,
      lessonName: masterLessons[0].name,
      masterIndex: 0
    };
  }

  // 2. 完了および除外された授業IDを収集
  const completedIds = new Set<string>();
  if (student.excluded_lesson_ids) {
    student.excluded_lesson_ids.forEach(id => {
      completedIds.add(id);
      completedIds.add(String(id));
    });
  }
  if (student.completed_lesson_ids) {
    student.completed_lesson_ids.forEach(id => {
      completedIds.add(id);
      completedIds.add(String(id));
    });
  }
  if (student.last_completed_lesson_id) {
    completedIds.add(student.last_completed_lesson_id);
    completedIds.add(String(student.last_completed_lesson_id));
    const lastIdx = masterLessons.findIndex(m => m.id === student.last_completed_lesson_id || String(m.sort_order) === String(student.last_completed_lesson_id) || m.name === student.last_completed_lesson_id);
    if (lastIdx >= 0) {
      for (let i = 0; i <= lastIdx; i++) {
        completedIds.add(masterLessons[i].id);
        completedIds.add(String(masterLessons[i].id));
        completedIds.add(masterLessons[i].name);
      }
    }
  }
  lessonProgressList
    .filter(p => p.student_id === student.id && p.status === 'completed')
    .forEach(p => {
      completedIds.add(p.lesson_id);
      completedIds.add(String(p.lesson_id));
      if (p.lesson_name) completedIds.add(p.lesson_name);
    });

  // 完了したタスク内の completed_lesson_ids や unit_id, 範囲内の全レッスン
  const studentCompletedTasks = tasks.filter(t => t.student_id === student.id && (t.status === 'completed' || t.test_passed));
  studentCompletedTasks.forEach(t => {
    if (t.completed_lesson_ids) {
      t.completed_lesson_ids.forEach(id => {
        completedIds.add(id);
        completedIds.add(String(id));
      });
    }
    if (t.unit_id) {
      completedIds.add(t.unit_id);
      completedIds.add(String(t.unit_id));
    }
    if (t.start_lesson_id && t.end_lesson_id) {
      const sIdx = masterLessons.findIndex(m => m.id === t.start_lesson_id || String(m.id) === String(t.start_lesson_id));
      const eIdx = masterLessons.findIndex(m => m.id === t.end_lesson_id || String(m.id) === String(t.end_lesson_id));
      if (sIdx >= 0 && eIdx >= sIdx) {
        for (let idx = sIdx; idx <= eIdx; idx++) {
          completedIds.add(masterLessons[idx].id);
          completedIds.add(String(masterLessons[idx].id));
          completedIds.add(masterLessons[idx].name);
        }
      }
    }
    if (t.start_lesson_id) {
      completedIds.add(t.start_lesson_id);
      completedIds.add(String(t.start_lesson_id));
    }
    if (t.end_lesson_id) {
      completedIds.add(t.end_lesson_id);
      completedIds.add(String(t.end_lesson_id));
    }
    if (t.start_lesson_name) completedIds.add(t.start_lesson_name);
    if (t.end_lesson_name) completedIds.add(t.end_lesson_name);
  });



  // 3. 単元テスト合否判定（不合格時は新単元への進行をストップして再テスト位置に固定）
  const unitTestStatus = getLatestUnitTestStatusForSubject({
    studentId: student.id,
    subject,
    miniTestResults
  });

  // 合格・完了済みの単元テストから単元名を収集（次単元解禁 & 先行レッスン完了保証）
  const completedUnitNames = new Set<string>(unitTestStatus.completedUnitKeys || []);
  completedIds.forEach(cid => {
    if (cid.includes('単元確認テスト') || cid.includes('単元テスト') || cid.includes('cm-auto-ut-')) {
      const uNorm = normalizeUnitName(cid);
      if (uNorm) completedUnitNames.add(uNorm);
    }
  });

  // 単元確認テストが合格・完了している単元内の先行レッスン（Check Test、まとめテスト、授業）を completedIds に追加
  if (completedUnitNames.size > 0) {
    masterLessons.forEach(m => {
      const mUnit = m.unit_name || '';
      const mName = m.name || '';
      const isUnitPassed = Boolean(
        completedUnitNames.has(mUnit) ||
        completedUnitNames.has(normalizeUnitName(mUnit)) ||
        (mUnit && Array.from(completedUnitNames).some(un => isMatchingUnitOrTest(mUnit, un)))
      );
      if (isUnitPassed) {
        completedIds.add(m.id);
        completedIds.add(String(m.id));
        completedIds.add(mName);
      }
    });
  }

  if (unitTestStatus.completedUnitTestKeys) {
    unitTestStatus.completedUnitTestKeys.forEach(k => {
      completedIds.add(k);
      completedIds.add(String(k));
      masterLessons.forEach(m => {
        const mName = m.name || '';
        const mUnit = m.unit_name || '';
        const isTest = m.item_type === 'unit_test' || 
          Boolean(mName && (mName.includes('単元確認テスト') || mName.includes('単元テスト') || mName.includes('確認テスト')));
        const cleanLesson = mName.replace(/^[^-]+-\s*/, '').trim();

        if (isTest) {
          if (mName === k || cleanLesson === k || isMatchingUnitOrTest(mName, k) || mUnit === k || isMatchingUnitOrTest(mUnit, k)) {
            completedIds.add(m.id);
            completedIds.add(String(m.id));
            completedIds.add(mName);
          }
        } else {
          const isReviewOrCheck = mName.includes('まとめテスト') || mName.toLowerCase().includes('check test');
          const isDirectMatch = (!isReviewOrCheck && cleanLesson === k) || mName === k || isMatchingUnitOrTest(mName, k);
          if (isDirectMatch) {
            completedIds.add(m.id);
            completedIds.add(String(m.id));
            completedIds.add(mName);
          }
        }
      });
    });
  }

  // 最新の単元テストが不合格の場合: その単元テスト（再テスト）を直ちに次回開始授業として固定特定
  if (unitTestStatus.hasFailedUnitTest && unitTestStatus.failedUnitTest) {
    const failedTest = unitTestStatus.failedUnitTest;
    const testUnitKey = failedTest.unit_name || failedTest.test_content || '';

    // 1. masterLessons から該当単元の「単元確認テスト」を優先検索
    const failedUnitTestIdx = masterLessons.findIndex(m => {
      const isTest = m.item_type === 'unit_test' || 
        Boolean(m.name && (m.name.includes('単元確認テスト') || m.name.includes('単元テスト') || m.name.includes('確認テスト')));
      if (!isTest) return false;
      return isMatchingUnitOrTest(m.unit_name, testUnitKey) || isMatchingUnitOrTest(m.name, testUnitKey);
    });

    if (failedUnitTestIdx >= 0) {
      return {
        lessonId: masterLessons[failedUnitTestIdx].id,
        lessonName: masterLessons[failedUnitTestIdx].name,
        masterIndex: failedUnitTestIdx,
        hasFailedUnitTest: true,
        failedUnitTest: failedTest
      };
    }

    // 2. 単元確認テスト名が完全一致しない場合でも、該当単元のレッスンアイテムから特定
    const fallbackUnitIdx = masterLessons.findIndex(m => {
      return isMatchingUnitOrTest(m.unit_name, testUnitKey) || isMatchingUnitOrTest(m.name, testUnitKey);
    });
    if (fallbackUnitIdx >= 0) {
      return {
        lessonId: masterLessons[fallbackUnitIdx].id,
        lessonName: masterLessons[fallbackUnitIdx].name,
        masterIndex: fallbackUnitIdx,
        hasFailedUnitTest: true,
        failedUnitTest: failedTest
      };
    }
  }

  // 4. スタート位置設定があれば、その位置より前の授業はスキップ扱い（探索開始位置とする）
  const startUnitId = getStudentStartUnitIdForSubject(student, subject);
  let startThresholdIdx = 0;
  if (startUnitId) {
    const { gradeText, unitName, cleanRaw } = parseStartUnitSetting(startUnitId);

    let sIdx = masterLessons.findIndex(m => {
      if (m.id === startUnitId || String(m.sort_order) === String(startUnitId)) return true;
      if (m.name === startUnitId || m.name === cleanRaw) return true;
      if (unitName && (m.name.includes(unitName) || cleanRaw.includes(m.name))) return true;
      return false;
    });

    if (sIdx < 0 && unitName && unitName.length >= 2) {
      sIdx = masterLessons.findIndex(m => m.name.includes(unitName) || unitName.includes(m.name));
    }

    if (sIdx >= 0) startThresholdIdx = sIdx;
  } else if (isElem && student.grade) {
    const studentGradeNorm = normalizeGrade(student.grade);
    if (studentGradeNorm) {
      const gradeStartIdx = masterLessons.findIndex(m => {
        const rawM = (ensuredMasters || []).find(em => em.id === m.id);
        return rawM && normalizeGrade(rawM.grade) === studentGradeNorm;
      });
      if (gradeStartIdx >= 0) {
        startThresholdIdx = gradeStartIdx;
      }
    }
  }

  for (let i = 0; i < masterLessons.length; i++) {
    const l = masterLessons[i];
    const isReviewOrCheck = (l.name || '').includes('まとめテスト') || (l.name || '').toLowerCase().includes('check test');
    const isUnitTest = !isReviewOrCheck && (
      l.item_type === 'unit_test' || 
      Boolean(l.name && (l.name.includes('単元確認テスト') || l.name.includes('単元テスト') || l.name.includes('確認テスト')))
    );

    if (isUnitTest) {
      if (i < startThresholdIdx) continue;
      const lNorm = normalizeUnitName(l.name);
      const lUnitNorm = normalizeUnitName(l.unit_name);

      const hasFailedRecord = Boolean(
        unitTestStatus.hasFailedUnitTest && unitTestStatus.failedUnitTest && (
          isMatchingUnitOrTest(unitTestStatus.failedUnitTest.unit_name, l.unit_name) ||
          isMatchingUnitOrTest(unitTestStatus.failedUnitTest.test_content, l.name) ||
          isMatchingUnitOrTest(unitTestStatus.failedUnitTest.unit_name, l.name) ||
          isMatchingUnitOrTest(unitTestStatus.failedUnitTest.test_content, l.unit_name)
        )
      );

      // 単元テストの合格判定:
      // 不合格記録がある場合は絶対に合格ではない（!hasFailedRecord）
      // 不合格記録がない場合のみ、テスト合否記録 (completedUnitTestKeys) または 完了リスト (completedIds) を認める
      const isTestPassed = !hasFailedRecord && Boolean(
        unitTestStatus.completedUnitTestKeys.has(l.id) ||
        unitTestStatus.completedUnitTestKeys.has(String(l.id)) ||
        unitTestStatus.completedUnitTestKeys.has(l.name) ||
        (lNorm && unitTestStatus.completedUnitTestKeys.has(lNorm)) ||
        (lUnitNorm && unitTestStatus.completedUnitTestKeys.has(lUnitNorm)) ||
        (l.unit_name && unitTestStatus.completedUnitTestKeys.has(l.unit_name)) ||
        completedIds.has(l.id) ||
        completedIds.has(String(l.id)) ||
        completedIds.has(l.name) ||
        Array.from(completedIds).some(cid => {
          const isCidUnitTest = cid.includes('単元確認テスト') || cid.includes('単元テスト') || cid.includes('確認テスト') || cid.includes('cm-auto-ut-');
          if (isCidUnitTest) {
            return isMatchingUnitOrTest(cid, l.name) || isMatchingUnitOrTest(cid, l.id) || (l.unit_name && isMatchingUnitOrTest(cid, l.unit_name));
          }
          return false;
        })
      );

      // 単元テストが未合格（未受験または不合格）の場合、合否ゲート発動！
      // この単元テストで進行を強制ストップし、以降の授業（新単元等）への進行を厳格に禁止する。
      if (!isTestPassed) {
        return {
          lessonId: l.id,
          lessonName: l.name,
          masterIndex: i,
          hasFailedUnitTest: hasFailedRecord || unitTestStatus.hasFailedUnitTest,
          failedUnitTest: hasFailedRecord ? unitTestStatus.failedUnitTest : (unitTestStatus.hasFailedUnitTest ? unitTestStatus.failedUnitTest : null)
        };
      }
    } else {
      const cleanLessonName = l.name ? l.name.replace(/^[^-]+-\s*/, '').trim() : '';
      const isReviewOrCheckStep = Boolean(
        (l.name || '').includes('まとめテスト') || 
        (l.name || '').toLowerCase().includes('check test') ||
        (cleanLessonName || '').includes('まとめテスト') ||
        (cleanLessonName || '').toLowerCase().includes('check test')
      );

      // まとめテストや Check Test は全単元共通名称のため、単元名を含まない短い cleanLessonName 単体でのマッチングを厳格に禁止！
      // 必ず該当単元の一致（l.id または l.name または isMatchingUnitOrTest）で判定する。
      const isLessonCompleted = Boolean(
        completedIds.has(l.id) || 
        completedIds.has(String(l.id)) || 
        completedIds.has(l.name) ||
        (!isReviewOrCheckStep && cleanLessonName && completedIds.has(cleanLessonName)) ||
        Array.from(completedIds).some(cid => isMatchingUnitOrTest(cid, l.name)) ||
        (unitTestStatus.completedUnitTestKeys && (
          unitTestStatus.completedUnitTestKeys.has(l.id) ||
          unitTestStatus.completedUnitTestKeys.has(String(l.id)) ||
          unitTestStatus.completedUnitTestKeys.has(l.name) ||
          (!isReviewOrCheckStep && cleanLessonName && unitTestStatus.completedUnitTestKeys.has(cleanLessonName))
        ))
      );
      if (i >= startThresholdIdx && !isLessonCompleted) {
        return {
          lessonId: l.id,
          lessonName: l.name,
          masterIndex: i,
          hasFailedUnitTest: unitTestStatus.hasFailedUnitTest,
          failedUnitTest: unitTestStatus.failedUnitTest
        };
      }
    }
  }

  // 全て完了している場合は最後の授業
  const lastLesson = masterLessons[masterLessons.length - 1];
  return {
    lessonId: lastLesson.id,
    lessonName: lastLesson.name,
    masterIndex: masterLessons.length - 1,
    hasFailedUnitTest: unitTestStatus.hasFailedUnitTest,
    failedUnitTest: unitTestStatus.failedUnitTest
  };
}

// 学習レベル（A・B・C）に応じた1コマ進度幅（From〜Toレッスン数）の定義
export const LEVEL_PACE_CONFIG = {
  A: {
    min: 3,
    max: 5,
    defaultPace: 4,
    multiplier: 4.0,
    label: 'レベルA（発展: 3〜5授業/コマ）'
  },
  B: {
    min: 1,
    max: 3,
    defaultPace: 2,
    multiplier: 2.0,
    label: 'レベルB（標準: 1〜3授業/コマ）'
  },
  C: {
    min: 1,
    max: 1,
    defaultPace: 1,
    multiplier: 0.8,
    label: 'レベルC（基礎: 1授業/コマ）'
  }
} as const;

/**
 * 生徒の学習レベル（A: 4, B: 2, C: 1）およびこれまでの消化ペースと校舎ルールを参照し、
 * 次回授業の適切な目標授業（To）を自動決定・推論する
 */
export function inferStudentSubjectPace(params: {
  student?: Student | null;
  subject: string;
  tasks?: LearningTask[];
  branchRules?: BranchAIRules | null;
  lessonProgressList?: StudentLessonProgress[];
}): {
  estimatedLessonsPerSlot: number;
  reason: string;
} {
  const { student, subject, tasks = [], branchRules, lessonProgressList = [] } = params;
  const rawLevel = (student?.level || (student as any)?.learning_level || 'B').toUpperCase();
  const studentLevel = (rawLevel === 'A' || rawLevel === 'B' || rawLevel === 'C') ? rawLevel : 'B';

  const config = LEVEL_PACE_CONFIG[studentLevel as keyof typeof LEVEL_PACE_CONFIG];
  const basePace = config.defaultPace;

  if (!student) {
    return { estimatedLessonsPerSlot: basePace, reason: `標準ペース (${basePace}授業/コマ)` };
  }

  // 1. 直近の完了タスクから消化スピードを算出
  const completedSubjectTasks = tasks.filter(t => 
    t.student_id === student.id &&
    t.status === 'completed' &&
    (t.subject === subject || (!t.subject && (subject === '数学' || subject === '算数')))
  );

  let totalLessonsCompleted = 0;
  let countOfSessions = 0;

  completedSubjectTasks.forEach(task => {
    if (task.completed_lesson_ids && task.completed_lesson_ids.length > 0) {
      totalLessonsCompleted += task.completed_lesson_ids.length;
      countOfSessions++;
    } else if (task.lesson_range && task.lesson_range.includes('〜')) {
      totalLessonsCompleted += basePace + 0.5;
      countOfSessions++;
    } else {
      totalLessonsCompleted += basePace;
      countOfSessions++;
    }
  });

  // もし過去の実績がある場合、その平均値（なければレベル基準値）
  let dynamicPace = countOfSessions > 0 ? (totalLessonsCompleted / countOfSessions) : basePace;

  // 2. 生徒のステータスによる補正
  let reason = '';
  if (student.status === 'fast') {
    dynamicPace = Math.min(config.max, dynamicPace + 1);
    reason = `🚀 爆速進行モード (レベル${studentLevel}): 先取り目標を設定 (${Math.round(dynamicPace)}授業/コマ)`;
  } else if (student.status === 'warning') {
    dynamicPace = Math.max(config.min, dynamicPace - 1);
    reason = `⚠️ 計画パンク防止 (レベル${studentLevel}): 確実な定着のためペースを調整 (${Math.round(dynamicPace)}授業/コマ)`;
  } else if (countOfSessions > 0) {
    reason = `🤖 AI推論: 過去${countOfSessions}回の平均消化実績とレベル${studentLevel}基準 (${dynamicPace.toFixed(1)}授業/コマ) を適用`;
  } else {
    reason = `学習レベル基準 (${config.label}): 1コマ${basePace}授業幅`;
  }

  const boundedPace = Math.max(config.min, Math.min(config.max, Math.round(dynamicPace)));

  return {
    estimatedLessonsPerSlot: boundedPace,
    reason
  };
}

/**
 * 1コマあたりの進捗授業範囲（From 〜 To）を算出する
 */
export function calculateLessonRangeForSlot(params: {
  subject: string;
  startLessonId?: string | null;
  lessonsPerSlot?: number;
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  schoolId?: string;
  student?: Student | null;
  tasks?: LearningTask[];
  branchRules?: BranchAIRules | null;
  lessonProgressList?: StudentLessonProgress[];
  miniTestResults?: MiniTestResult[];
}): {
  start_lesson_id: string | null;
  end_lesson_id: string | null;
  start_lesson_name: string | null;
  end_lesson_name: string | null;
  lesson_range: string | null;
  inferred_pace?: number;
  pace_reason?: string;
} {
  const {
    subject,
    startLessonId,
    lessonsPerSlot,
    curriculumMasters: rawMasters = [],
    curriculumUnits: rawUnits = [],
    schoolId = params.student?.school_id,
    student,
    tasks = [],
    branchRules,
    lessonProgressList = [],
    miniTestResults: rawMiniTestResults
  } = params;

  const curriculumMasters = (rawMasters && rawMasters.length > 0) ? rawMasters : db.getCurriculumMasters();
  const curriculumUnits = (rawUnits && rawUnits.length > 0) ? rawUnits : db.getCurriculumUnits();
  const miniTestResults = (rawMiniTestResults && rawMiniTestResults.length > 0)
    ? rawMiniTestResults
    : (student?.id ? db.getMiniTestResults(student.id) : db.getMiniTestResults());

  const isElem = Boolean(
    student?.grade?.startsWith('小') || 
    (student?.grade?.includes('年') && !student?.grade?.startsWith('中') && !student?.grade?.startsWith('高')) ||
    student?.grade === '園児'
  );
  const isJunior = Boolean(student?.grade?.startsWith('中'));
  const isHigh = Boolean(student?.grade?.startsWith('高') || student?.grade === '既卒');

  // 1. 対象教科の授業リストを抽出 (小学生はカリキュラムマスター全学年ステップを優先)
  const filteredMasters = curriculumMasters.filter(m => {
    if (isElem) {
      const isMasterElem = (m.grade || '').startsWith('小') || /^[1-6]年生?$/.test(m.grade || '') || m.grade === '園児';
      if (!isMasterElem) return false;
      if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
        return m.subject === '算数' || m.subject === '数学';
      }
      return m.subject === subject;
    } else if (isJunior) {
      const isMasterJunior = (m.grade || '').startsWith('中') || /^[7-9]年生?$/.test(m.grade || '');
      if (!isMasterJunior) return false;
      if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
        return m.subject === '数学' || m.subject === '算数';
      }
      return m.subject === subject;
    } else if (isHigh) {
      const isMasterHigh = (m.grade || '').startsWith('高') || m.grade === '既卒';
      if (!isMasterHigh) return false;
      return m.subject === subject;
    }
    if (subject === '算数' || subject === '数学' || subject.toLowerCase() === 'math') {
      return m.subject === '算数' || m.subject === '数学';
    }
    return m.subject === subject;
  });

  let masterLessons: Array<{ id: string; name: string; sort_order: number; unit_name?: string; item_type?: string }> = [];

  const ensuredMasters = ensureMathEnglishUnitTests(filteredMasters);
  if (isElem && ensuredMasters.length > 0) {
    masterLessons = ensuredMasters
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(m => ({
        id: m.id,
        name: m.unit_name ? `${m.unit_name} - ${m.lesson_name.replace(/^[^-]+-\s*/, '')}` : m.lesson_name,
        sort_order: m.sort_order ?? 0,
        unit_name: m.unit_name,
        item_type: m.item_type
      }));
  } else {
    const matchingSchoolUnits = curriculumUnits.filter(u => 
      (schoolId ? u.school_id === schoolId : false) &&
      (isElem ? ((subject === '算数' || subject === '数学') ? (u.subject === '算数' || u.subject === '数学') : u.subject === subject) : u.subject === subject)
    );

    if (matchingSchoolUnits.length > 0) {
      masterLessons = matchingSchoolUnits
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map(u => ({
          id: u.id,
          name: u.name,
          sort_order: u.sequence_order ?? 0
        }));
    } else if (ensuredMasters.length > 0) {
      masterLessons = ensuredMasters
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(m => ({
          id: m.id,
          name: m.unit_name ? `${m.unit_name} - ${m.lesson_name.replace(/^[^-]+-\s*/, '')}` : m.lesson_name,
          sort_order: m.sort_order ?? 0,
          unit_name: m.unit_name,
          item_type: m.item_type
        }));
    } else {
      const fallbackUnits = curriculumUnits
        .filter(u => (!schoolId || u.school_id === schoolId || !u.school_id) && 
                     (isElem ? ((subject === '算数' || subject === '数学') ? (u.subject === '算数' || u.subject === '数学') : u.subject === subject) : u.subject === subject))
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map(u => ({
          id: u.id,
          name: u.name,
          sort_order: u.sequence_order ?? 0
        }));
      masterLessons = fallbackUnits;
    }
  }

  if (masterLessons.length === 0) {
    return {
      start_lesson_id: startLessonId || null,
      end_lesson_id: startLessonId || null,
      start_lesson_name: null,
      end_lesson_name: null,
      lesson_range: null
    };
  }

  let hasFailed = false;
  let failedTestObj: MiniTestResult | null = null;

  // 2. 開始授業の特定 (startLessonId がなければ直近の未完了授業を自動特定)
  let startIdx = 0;
  if (startLessonId) {
    const foundIdx = masterLessons.findIndex(m => m.id === startLessonId || String(m.sort_order) === String(startLessonId));
    if (foundIdx >= 0) {
      startIdx = foundIdx;
    }
  } else if (student) {
    const nextUncompleted = findNextUncompletedLessonForSubject({
      student,
      subject,
      tasks,
      curriculumMasters,
      curriculumUnits,
      schoolId,
      lessonProgressList,
      miniTestResults
    });
    if (nextUncompleted.lessonId || nextUncompleted.lessonName) {
      const idx = masterLessons.findIndex(m => 
        m.id === nextUncompleted.lessonId || 
        String(m.sort_order) === String(nextUncompleted.lessonId) ||
        m.name === nextUncompleted.lessonName
      );
      if (idx >= 0) {
        startIdx = idx;
      } else if (nextUncompleted.masterIndex >= 0) {
        startIdx = Math.min(nextUncompleted.masterIndex, masterLessons.length - 1);
      }
    } else if (nextUncompleted.masterIndex >= 0) {
      startIdx = Math.min(nextUncompleted.masterIndex, masterLessons.length - 1);
    }
    if (nextUncompleted.hasFailedUnitTest && nextUncompleted.failedUnitTest) {
      hasFailed = true;
      failedTestObj = nextUncompleted.failedUnitTest;
    }
  }

  // 3. ペース推論 (lessonsPerSlot が未指定なら AI 推論)
  let effectivePace = lessonsPerSlot;
  let paceReason = '';
  if (!effectivePace) {
    const inference = inferStudentSubjectPace({
      student,
      subject,
      tasks,
      branchRules,
      lessonProgressList
    });
    effectivePace = inference.estimatedLessonsPerSlot;
    paceReason = inference.reason;
  }

  // 単元テストの境界制御:
  // startIdx が通常授業・まとめテスト・Check Test 等の場合、単元テストは同日の連続授業に含めない。
  // （例: まとめテスト(3)やCheck Testまで到達したとしても、単元テストは同日に行わず、必ず次回の授業日に実施する）
  let endIdx = startIdx;
  const maxStep = Math.max(1, effectivePace || 1);
  for (let step = 0; step < maxStep && (startIdx + step) < masterLessons.length; step++) {
    const currentItem = masterLessons[startIdx + step];
    const isReviewOrCheck = (currentItem.name || '').includes('まとめテスト') || (currentItem.name || '').toLowerCase().includes('check test');
    const isUnitTest = !isReviewOrCheck && (
      currentItem.item_type === 'unit_test' || 
      Boolean(
        (currentItem.name || '').includes('単元確認テスト') || 
        (currentItem.name || '').includes('単元テスト') ||
        (currentItem.name || '').includes('確認テスト')
      )
    );
    if (isUnitTest) {
      if (step > 0) {
        // 通常授業やまとめテストから進んできた場合、単元テストの直前（まとめテスト(3)やCheck Test等）で終了する
        endIdx = startIdx + step - 1;
      } else {
        // 開始授業自体が単元テストの場合は、その単元テスト単独（1コマ単独）として受講する
        endIdx = startIdx;
      }
      break;
    }
    endIdx = startIdx + step;
  }

  const startItem = masterLessons[startIdx];
  const endItem = masterLessons[endIdx];

  const isStartReviewOrCheck = (startItem?.name || '').includes('まとめテスト') || (startItem?.name || '').toLowerCase().includes('check test');
  const isStartUnitTest = !isStartReviewOrCheck && (
    startItem?.item_type === 'unit_test' ||
    Boolean(
      (startItem?.name || '').includes('単元確認テスト') ||
      (startItem?.name || '').includes('単元テスト') ||
      (startItem?.name || '').includes('確認テスト')
    )
  );

  let startName = startItem?.name || null;
  let endName = isStartUnitTest ? startName : (endItem?.name || startName);
  let rangeStr = isStartUnitTest ? startName : formatLessonRange(startName, endName);

  if (hasFailed && failedTestObj) {
    const rawLabel = failedTestObj.unit_name || failedTestObj.test_content || '';
    const cleanUnitName = normalizeUnitName(rawLabel) || rawLabel.replace(/^[^-]+-\s*/, '').trim();

    // 不合格となった単元テストアイテムを startItem / endItem として確実に固定
    const utItem = masterLessons[startIdx];
    const utName = utItem?.name || `${cleanUnitName} - 単元確認テスト`;

    startName = `【再テスト対策・総復習】${cleanUnitName}`;
    endName = `【再テスト対策・総復習】${cleanUnitName}`;
    rangeStr = `【弱点補強】${cleanUnitName} 総復習＆再テスト対策`;
    paceReason = `単元テスト不合格のため新単元進行をストップし、${cleanUnitName}の総復習を割り当てました`;
  }

  return {
    start_lesson_id: startItem?.id || null,
    end_lesson_id: (hasFailed && failedTestObj) ? (startItem?.id || null) : (endItem?.id || startItem?.id || null),
    start_lesson_name: startName,
    end_lesson_name: endName,
    lesson_range: rangeStr || null,
    inferred_pace: effectivePace,
    pace_reason: paceReason
  };
}

/**
 * 学年区分と通塾時間から「標準コマ数」を自動算出するユーティリティ関数
 * @param gradeType 'elementary' (小学生) または 'junior_high' (中学生/高校生)
 * @param weeklyDuration 通塾時間 ('60min', '90min', '120min', '180min', '240min', 'unlimited', '120' など)
 * @returns コマ数 (2〜10)
 */
export function calculateDefaultSlots(
  gradeType: 'elementary' | 'junior_high' | string,
  weeklyDuration: string
): number {
  if (gradeType === 'elementary') {
    return 2;
  }

  const durationStr = (weeklyDuration || '').toLowerCase().replace('min', '').trim();
  if (durationStr === '120') return 2;
  if (durationStr === '180') return 3;
  if (durationStr === '240') return 4;
  if (durationStr === 'unlimited' || durationStr === '無制限') return 5;

  const numDuration = parseInt(durationStr, 10);
  if (!isNaN(numDuration)) {
    if (numDuration <= 120) return 2;
    if (numDuration <= 180) return 3;
    if (numDuration <= 240) return 4;
    return Math.min(10, Math.max(2, Math.round(numDuration / 60)));
  }

  return 2;
}

// -------------------------------------------------------------
// 0. 日付・進捗ギャップ・通塾開始連動ユーティリティ
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

/**
 * 通塾開始日・退塾日から在籍期間を自動算出する
 */
export function calculateEnrollmentPeriod(
  startDateStr?: string | null,
  endDateStr?: string | null
): { text: string; isWithdrawn: boolean } | null {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const isWithdrawn = Boolean(endDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();
  if (isNaN(end.getTime())) return null;

  if (end < start) {
    return { text: '在籍期間: 開始日以降の日付を指定してください', isWithdrawn };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let periodStr = '';
  if (years > 0 && months > 0) {
    periodStr = `${years}年${months}ヶ月`;
  } else if (years > 0) {
    periodStr = `${years}年`;
  } else if (months > 0) {
    periodStr = `${months}ヶ月`;
  } else {
    periodStr = '1ヶ月未満';
  }

  const prefix = isWithdrawn ? '在籍期間' : '在籍中';
  return {
    text: `${prefix}: ${periodStr}`,
    isWithdrawn
  };
}

/**
 * 通塾開始日以降で最も早い通塾曜日（Day 1）を特定する
 */
export function getFirstAttendanceDate(
  enrollmentDateStr?: string | null,
  selectedDays?: string[] | null
): string {
  const baseDate = enrollmentDateStr ? new Date(enrollmentDateStr) : new Date();
  if (isNaN(baseDate.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  const days = (selectedDays && selectedDays.length > 0) ? selectedDays : ['tuesday', 'friday'];
  
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, '日': 0, '0': 0,
    'monday': 1, 'mon': 1, '月': 1, '1': 1,
    'tuesday': 2, 'tue': 2, '火': 2, '2': 2,
    'wednesday': 3, 'wed': 3, '水': 3, '3': 3,
    'thursday': 4, 'thu': 4, '木': 4, '4': 4,
    'friday': 5, 'fri': 5, '金': 5, '5': 5,
    'saturday': 6, 'sat': 6, '土': 6, '6': 6,
  };

  const targetDayNums = new Set(
    days.map(d => dayMap[d.toLowerCase()] ?? -1).filter(n => n !== -1)
  );

  if (targetDayNums.size === 0) {
    return baseDate.toISOString().split('T')[0];
  }

  const check = new Date(baseDate.getTime());
  for (let i = 0; i < 14; i++) {
    if (targetDayNums.has(check.getDay())) {
      return check.toISOString().split('T')[0];
    }
    check.setDate(check.getDate() + 1);
  }

  return baseDate.toISOString().split('T')[0];
}

/**
 * 指定された日付が生徒の通塾曜日に該当するか判定する
 */
export function isStudentAttendanceDay(
  student?: Student | null,
  dateStr?: string | null
): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  const dayOfWeek = d.getDay(); // 0: 日, 1: 月, 2: 火, 3: 水, 4: 木, 5: 金, 6: 土

  const rawDays: string[] = (student as any)?.selected_days || (student as any)?.attendance_days;
  const days: string[] = (rawDays && rawDays.length > 0) ? rawDays : ['tuesday', 'friday'];

  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, '日': 0, '0': 0,
    'monday': 1, 'mon': 1, '月': 1, '1': 1,
    'tuesday': 2, 'tue': 2, '火': 2, '2': 2,
    'wednesday': 3, 'wed': 3, '水': 3, '3': 3,
    'thursday': 4, 'thu': 4, '木': 4, '4': 4,
    'friday': 5, 'fri': 5, '金': 5, '5': 5,
    'saturday': 6, 'sat': 6, '土': 6, '6': 6,
  };

  const targetDayNums = new Set(
    days.map(day => dayMap[String(day).toLowerCase()] ?? -1).filter(n => n !== -1)
  );

  return targetDayNums.size > 0 ? targetDayNums.has(dayOfWeek) : true;
}

/**
 * 通塾開始日（Day 1）から始まる通塾日の日付リストを生成する
 */
export function generateAttendanceDates(
  startDateStr: string,
  selectedDays: string[] | null | undefined,
  count: number
): string[] {
  const dates: string[] = [];
  if (count <= 0) return dates;

  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0, '日': 0, '0': 0,
    'monday': 1, 'mon': 1, '月': 1, '1': 1,
    'tuesday': 2, 'tue': 2, '火': 2, '2': 2,
    'wednesday': 3, 'wed': 3, '水': 3, '3': 3,
    'thursday': 4, 'thu': 4, '木': 4, '4': 4,
    'friday': 5, 'fri': 5, '金': 5, '5': 5,
    'saturday': 6, 'sat': 6, '土': 6, '6': 6,
  };
  const targetDayNums = new Set(
    (selectedDays && selectedDays.length > 0 ? selectedDays : ['tuesday', 'friday'])
      .map(d => dayMap[d.toLowerCase()] ?? -1)
      .filter(n => n !== -1)
  );

  const cur = new Date(startDateStr);
  let attempts = 0;
  while (dates.length < count && attempts < 1000) {
    if (targetDayNums.size === 0 || targetDayNums.has(cur.getDay())) {
      dates.push(cur.toISOString().split('T')[0]);
    }
    cur.setDate(cur.getDate() + 1);
    attempts++;
  }

  return dates;
}

/**
 * 生徒の教科ごとの設定文字列（学年/単元名）をパースするヘルパー関数
 */
export function parseStartUnitSetting(rawSetting: string): { gradeText: string | null; unitName: string | null; cleanRaw: string } {
  if (!rawSetting || typeof rawSetting !== 'string') {
    return { gradeText: null, unitName: null, cleanRaw: '' };
  }
  const cleanRaw = rawSetting.trim();
  const parts = cleanRaw.split(/[\/\-—–│|]/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    let gradeText: string | null = null;
    let unitName: string | null = null;

    parts.forEach(p => {
      if (p.includes('年') || p.includes('小') || p.includes('中') || p.includes('高') || p.toLowerCase().includes('grade')) {
        gradeText = p;
      } else {
        unitName = p;
      }
    });

    if (!unitName && parts.length >= 2) {
      unitName = parts[parts.length - 1];
    }

    return { gradeText, unitName: unitName || cleanRaw, cleanRaw };
  }

  return { gradeText: null, unitName: cleanRaw, cleanRaw };
}

/**
 * 生徒の教科ごとのスタート位置（単元ID / 設定文字列）を取得するヘルパー関数
 */
export function getStudentStartUnitIdForSubject(student?: Student | null, subject?: string): string | null {
  if (!student || !subject) return null;
  const sub = subject.trim();

  const getFromDict = (keys: string[]) => {
    for (const k of keys) {
      if (student.start_units && (student.start_units as any)[k]) return (student.start_units as any)[k];
      if (student.subject_start_positions && student.subject_start_positions[k]) return student.subject_start_positions[k];
      if (student.subject_start_units && student.subject_start_units[k]) return student.subject_start_units[k];
    }
    return null;
  };

  if (sub === '数学' || sub === '算数' || sub.toLowerCase() === 'math') {
    return student.start_unit_math || 
           getFromDict(['math', 'Math', '算数', '数学']) || 
           student.start_unit_id || null;
  }
  if (sub === '英語' || sub.toLowerCase() === 'english') {
    return student.start_unit_english || 
           getFromDict(['english', 'English', '英語']) || 
           student.start_unit_id || null;
  }
  if (sub === '理科' || sub.toLowerCase() === 'science') {
    return student.start_unit_science || 
           getFromDict(['science', 'Science', '理科']) || 
           student.start_unit_id || null;
  }
  if (sub === '社会' || sub === '歴史' || sub === '地理' || sub.toLowerCase() === 'social') {
    return student.start_unit_social || 
           getFromDict(['social', 'Social', '社会', '歴史', '地理']) || 
           student.start_unit_id || null;
  }
  if (sub === '国語' || sub.toLowerCase() === 'japanese') {
    return student.start_unit_japanese || 
           getFromDict(['japanese', 'Japanese', '国語']) || 
           student.start_unit_id || null;
  }
  return getFromDict([sub]) || student.start_unit_id || null;
}

/**
 * 生徒の教科別スタート位置に基づき、未完了タスクのスキップ／未着手状態および通塾開始日スケジュールを再配置・再計算する
 */
export function applyStartPositionsToTasks(
  student: Student,
  allTasks: LearningTask[],
  allCurriculumUnits: CurriculumUnit[],
  curriculumMasters?: CurriculumMaster[]
): LearningTask[] {
  const masterUnitsAsCurriculum: CurriculumUnit[] = (curriculumMasters || []).map((m, idx) => ({
    id: m.id,
    school_id: '',
    subject: m.subject,
    name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name,
    sequence_order: m.sort_order ?? (idx + 1),
    created_at: m.created_at || ''
  }));
  const combinedUnits = [...allCurriculumUnits, ...masterUnitsAsCurriculum];
  const studentSchoolUnits = combinedUnits.filter(u => u.school_id === student.school_id || !u.school_id);
  const studentTasks = allTasks.filter(t => t.student_id === student.id);
  const otherTasks = allTasks.filter(t => t.student_id !== student.id);

  let updatedStudentTasks = studentTasks.map(task => {
    // 既に完了したタスクは変更しない
    if (task.status === 'completed') return task;

    const unit = studentSchoolUnits.find(u => u.id === task.unit_id || String(u.sequence_order) === String(task.unit_id));
    if (!unit) return task;

    const startUnitId = getStudentStartUnitIdForSubject(student, unit.subject);
    if (!startUnitId) {
      // スタート位置が指定されていない場合、自動スキップされたものは未着手に復帰
      if (task.status === 'skipped' && (task.office_note?.includes('スタート') || task.office_note?.includes('開始位置'))) {
        return {
          ...task,
          status: 'unstarted' as const,
          office_note: ''
        };
      }
      return task;
    }

    const startUnit = studentSchoolUnits.find(u => 
      u.id === startUnitId || 
      String(u.sequence_order) === String(startUnitId) ||
      u.name === startUnitId ||
      (u.name && startUnitId && (u.name.includes(startUnitId) || startUnitId.includes(u.name)))
    );
    if (!startUnit) return task;

    if (unit.sequence_order < startUnit.sequence_order) {
      // スタート位置より前の単元はスキップ
      if (task.status === 'unstarted') {
        return {
          ...task,
          status: 'skipped' as const,
          office_note: '★ スタートライン指定によりスキップ'
        };
      }
    } else if (task.status === 'skipped' && (task.office_note?.includes('スタート') || task.office_note?.includes('開始位置'))) {
      // スタート位置以降で以前スキップされていたものは未着手にリセット
      return {
        ...task,
        status: 'unstarted' as const,
        office_note: ''
      };
    }
    return task;
  });

  // 通塾開始日 (enrollment_date) が設定されている場合、初回通塾曜日（Day 1）から順にスケジュール日を再割り振り
  if (student.enrollment_date) {
    const firstDay = getFirstAttendanceDate(student.enrollment_date, student.selected_days);
    const activeTasks = updatedStudentTasks.filter(t => t.status === 'unstarted');
    if (activeTasks.length > 0) {
      const attendanceDates = generateAttendanceDates(firstDay, student.selected_days, activeTasks.length);
      let dateIdx = 0;
      updatedStudentTasks = updatedStudentTasks.map(t => {
        if (t.status === 'unstarted' && dateIdx < attendanceDates.length) {
          const newDate = attendanceDates[dateIdx++];
          return {
            ...t,
            scheduled_date: newDate
          };
        }
        return t;
      });
    }
  }

  return [...otherTasks, ...updatedStudentTasks];
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
    const startUnitId = getStudentStartUnitIdForSubject(student, subject);

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
  curriculumUnits: CurriculumUnit[] = [],
  branchRules?: BranchAIRules,
  curriculumMasters: CurriculumMaster[] = []
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

  // 4. 通塾日であり、かつ休校週の日付を除外した、デッドラインまでの有効な割り当て可能日を抽出
  const validFutureDates = futureDates.filter(dStr => {
    if (!isStudentAttendanceDay(student, dStr)) return false;
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

  // もしデッドラインまでに割り当て可能な日がない場合は、全体から通塾日かつ休校週を除外した日付を使用
  let targetDates = validFutureDates;
  if (targetDates.length === 0) {
    targetDates = futureDates.filter(dStr => {
      if (!isStudentAttendanceDay(student, dStr)) return false;
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

  const lessonsPerSlot = branchRules?.lessons_per_slot || 2;

  // 均等配分する
  const rescheduledTasks = uncompletedTasks.map((task, index) => {
    const dateIndex = Math.floor(index / tasksPerDay);
    const scheduled_date = targetDates[Math.min(dateIndex, targetDates.length - 1)];
    
    let taskWithRange = { ...task, scheduled_date };
    if (!task.lesson_range && task.subject) {
      const range = calculateLessonRangeForSlot({
        subject: task.subject,
        startLessonId: task.start_lesson_id || task.unit_id,
        lessonsPerSlot,
        curriculumMasters,
        curriculumUnits,
        schoolId: student.school_id
      });
      if (range.lesson_range) {
        taskWithRange = {
          ...taskWithRange,
          start_lesson_name: task.start_lesson_name || range.start_lesson_name,
          end_lesson_name: task.end_lesson_name || range.end_lesson_name,
          start_lesson_id: task.start_lesson_id || range.start_lesson_id,
          end_lesson_id: task.end_lesson_id || range.end_lesson_id,
          lesson_range: range.lesson_range
        };
      }
    }
    return taskWithRange;
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

/**
 * 生徒の指定教科における進捗率 (0.0 ～ 1.0) を算出する
 */
export function calculateSubjectProgressRate(params: {
  student: Student;
  subject: string;
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  tasks?: LearningTask[];
  lessonProgressList?: StudentLessonProgress[];
}): { progressRate: number; completedCount: number; totalCount: number } {
  const {
    student,
    subject,
    curriculumMasters: rawMasters = [],
    curriculumUnits: rawUnits = [],
    tasks = [],
    lessonProgressList = []
  } = params;

  const curriculumMasters = (rawMasters && rawMasters.length > 0) ? rawMasters : db.getCurriculumMasters();
  const curriculumUnits = (rawUnits && rawUnits.length > 0) ? rawUnits : db.getCurriculumUnits();

  const isElem = Boolean(
    student.grade?.startsWith('小') || 
    (student.grade?.includes('年') && !student.grade?.startsWith('中') && !student.grade?.startsWith('高')) ||
    student.grade === '園児'
  );

  // 対象教科のマスタレッスン一覧
  const filteredMasters = curriculumMasters.filter(m => {
    if (subject === '算数' || subject === '数学') {
      if (isElem) return m.subject === '算数' || (m.subject === '数学' && (m.grade?.startsWith('小') || m.grade?.includes('年')));
      return m.subject === '数学' || m.subject === '算数';
    }
    return m.subject === subject;
  });

  let totalLessons: Array<{ id: string; name: string; sort_order: number }> = [];
  if (isElem && filteredMasters.length > 0) {
    totalLessons = filteredMasters
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(m => ({ id: m.id, name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name, sort_order: m.sort_order ?? 0 }));
  } else {
    const matchingUnits = curriculumUnits.filter(u => 
      (student.school_id ? u.school_id === student.school_id : true) &&
      (isElem ? ((subject === '算数' || subject === '数学') ? (u.subject === '算数' || u.subject === '数学') : u.subject === subject) : u.subject === subject)
    );
    if (matchingUnits.length > 0) {
      totalLessons = matchingUnits
        .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
        .map(u => ({ id: u.id, name: u.name, sort_order: u.sequence_order ?? 0 }));
    } else if (filteredMasters.length > 0) {
      totalLessons = filteredMasters
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(m => ({ id: m.id, name: m.unit_name ? `${m.unit_name} - ${m.lesson_name}` : m.lesson_name, sort_order: m.sort_order ?? 0 }));
    }
  }

  const totalCount = totalLessons.length > 0 ? totalLessons.length : 1;

  // 直近未完了授業のインデックスを取得
  const { masterIndex } = findNextUncompletedLessonForSubject({
    student,
    subject,
    tasks,
    curriculumMasters,
    curriculumUnits,
    lessonProgressList
  });

  // 完了IDに基づく完了数カウント
  const completedSet = new Set<string>();
  if (student.completed_lesson_ids) {
    student.completed_lesson_ids.forEach(id => {
      completedSet.add(id);
      completedSet.add(String(id));
    });
  }
  lessonProgressList
    .filter(p => p.student_id === student.id && p.status === 'completed')
    .forEach(p => {
      completedSet.add(p.lesson_id);
      completedSet.add(String(p.lesson_id));
      if (p.lesson_name) completedSet.add(p.lesson_name);
    });
  tasks
    .filter(t => t.student_id === student.id && t.status === 'completed' && (t.subject === subject || (!t.subject && (subject === '算数' || subject === '数学'))))
    .forEach(t => {
      if (t.unit_id) {
        completedSet.add(t.unit_id);
        completedSet.add(String(t.unit_id));
      }
      if (t.start_lesson_id) {
        completedSet.add(t.start_lesson_id);
        completedSet.add(String(t.start_lesson_id));
      }
    });

  const directMatchCount = totalLessons.filter(l => completedSet.has(l.id) || completedSet.has(String(l.id)) || completedSet.has(String(l.sort_order)) || completedSet.has(l.name)).length;

  let completedCount = directMatchCount;
  if (masterIndex >= 0 && masterIndex > completedCount) {
    completedCount = masterIndex;
  }

  const progressRate = Math.min(1.0, Math.max(0.0, completedCount / totalCount));
  return { progressRate, completedCount, totalCount };
}

// 教科の優先順位定義（数字が小さいほど最優先）
export const SUBJECT_PRIORITY: Record<string, number> = {
  math: 1,       // 算数・数学（最優先）
  算数: 1,
  数学: 1,
  english: 2,    // 英語（第2優先）
  英語: 2,
  japanese: 3,   // 国語
  国語: 3,
  science: 4,    // 理科
  理科: 4,
  social: 5,     // 社会
  社会: 5,
};

/**
 * 選択教科 (selected_subjects) を「算数/数学(1)・英語(2)」最優先 ＋ 進捗率順にソートする
 */
export function getSortedSubjectsByProgressRate(params: {
  student: Student;
  selectedSubjects?: string[];
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  tasks?: LearningTask[];
  lessonProgressList?: StudentLessonProgress[];
}): string[] {
  const {
    student,
    selectedSubjects = student.selected_subjects,
    curriculumMasters = [],
    curriculumUnits = [],
    tasks = [],
    lessonProgressList = []
  } = params;

  const isElem = Boolean(
    student.grade?.startsWith('小') || 
    (student.grade?.includes('年') && !student.grade?.startsWith('中') && !student.grade?.startsWith('高')) ||
    student.grade === '園児'
  );
  const defaultSubjs = isElem ? ['算数', '英語'] : ['数学', '英語'];
  const subjectsToUse = (selectedSubjects && selectedSubjects.length > 0) ? selectedSubjects : defaultSubjs;

  const subjectRates = subjectsToUse.map((sub, originalIdx) => {
    const { progressRate } = calculateSubjectProgressRate({
      student,
      subject: sub,
      curriculumMasters,
      curriculumUnits,
      tasks,
      lessonProgressList
    });
    const priority = SUBJECT_PRIORITY[sub] ?? SUBJECT_PRIORITY[sub.toLowerCase()] ?? 99;
    return { subject: sub, rate: progressRate, priority, originalIdx };
  });

  // 1. 最優先: 教科の固定優先度 (算数・数学=1, 英語=2, 国語=3, 理科=4, 社会=5)
  // 2. 同一優先度内: 進捗率の昇順（低率順）、同率なら元の配列順
  subjectRates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    if (a.rate !== b.rate) {
      return a.rate - b.rate;
    }
    return a.originalIdx - b.originalIdx;
  });

  return subjectRates.map(sr => sr.subject);
}

/**
 * 設定されたコマ数 (periodCount) と 選択教科 (進捗率昇順) に基づき、コマ割りの教科とFrom〜Toを自動生成
 */
export function generateSlotsForSelectedSubjects(params: {
  student: Student;
  periodCount: number;
  selectedSubjects?: string[];
  tasks?: LearningTask[];
  branchRules?: BranchAIRules;
  curriculumMasters?: CurriculumMaster[];
  curriculumUnits?: CurriculumUnit[];
  schoolId?: string;
  lessonProgressList?: StudentLessonProgress[];
  miniTestResults?: MiniTestResult[];
}): Record<number, {
  subject: string;
  unitId: string;
  customTheme: string;
  startLessonId: string;
  endLessonId: string;
  startLessonName: string;
  endLessonName: string;
  lessonRange: string;
}> {
  const {
    student,
    periodCount,
    selectedSubjects,
    tasks = [],
    branchRules,
    curriculumMasters = [],
    curriculumUnits = [],
    schoolId = student.school_id,
    lessonProgressList = [],
    miniTestResults = []
  } = params;

  const sortedSubjs = getSortedSubjectsByProgressRate({
    student,
    selectedSubjects,
    curriculumMasters,
    curriculumUnits,
    tasks,
    lessonProgressList
  });

  const isElem = Boolean(
    student.grade?.startsWith('小') || 
    (student.grade?.includes('年') && !student.grade?.startsWith('中') && !student.grade?.startsWith('高')) ||
    student.grade === '園児'
  );
  const defaultSubjs = isElem ? ['英語', '算数'] : ['数学', '英語'];
  const userSubjs = (selectedSubjects && selectedSubjects.length > 0) ? selectedSubjects : (student.selected_subjects && student.selected_subjects.length > 0 ? student.selected_subjects : defaultSubjs);

  const slots: Record<number, any> = {};
  const subjectReachedUnitTest = new Set<string>();

  for (let p = 1; p <= periodCount; p++) {
    let sub = '';
    if (p <= sortedSubjs.length) {
      sub = sortedSubjs[p - 1];
    } else {
      sub = sortedSubjs[(p - 1) % sortedSubjs.length] || sortedSubjs[0] || '算数';
    }

    // 当日の学習ストッパー: すでに当日単元テストに到達している教科は、同日に次単元を先入れせずテスト・復習位置を維持
    const alreadyTestedToday = subjectReachedUnitTest.has(sub);

    const range = calculateLessonRangeForSlot({
      subject: sub,
      startLessonId: null,
      student,
      tasks,
      branchRules,
      curriculumMasters,
      curriculumUnits,
      schoolId,
      lessonProgressList,
      miniTestResults: miniTestResults.length > 0 ? miniTestResults : db.getMiniTestResults(student.id)
    });

    const isStartReviewOrCheck = (range.start_lesson_name || '').includes('まとめテスト') || (range.start_lesson_name || '').toLowerCase().includes('check test');
    const isStartUnitTest = !isStartReviewOrCheck && (
      Boolean(range.start_lesson_name?.includes('単元確認テスト') || 
              range.start_lesson_name?.includes('単元テスト') ||
              range.start_lesson_name?.includes('確認テスト'))
    );
    const isEndReviewOrCheck = (range.end_lesson_name || '').includes('まとめテスト') || (range.end_lesson_name || '').toLowerCase().includes('check test');
    const isUnitTest = isStartUnitTest || (!isEndReviewOrCheck && Boolean(
      range.end_lesson_name?.includes('単元確認テスト') || 
      range.end_lesson_name?.includes('単元テスト') ||
      range.end_lesson_name?.includes('確認テスト')
    ));

    const isUnitBoundaryReached = isUnitTest || 
      Boolean(range.end_lesson_name?.includes('まとめテスト（３）') || 
              range.end_lesson_name?.includes('まとめテスト(3)') || 
              range.end_lesson_name?.toLowerCase().includes('check test'));

    if (isUnitBoundaryReached || alreadyTestedToday) {
      subjectReachedUnitTest.add(sub);
    }

    // 単元テストの同日連続受講禁止ルール:
    // 同日の先行コマで当該教科の授業（まとめテスト3やCheck Test等）がすでに割り当てられている場合、
    // 単元テストは同日に連続して行わず、必ず次回の授業日に実施する。
    const hasPriorSlotTodayForSubject = Object.values(slots).some(s => s.subject === sub);
    let finalStartId = range.start_lesson_id || '';
    let finalEndId = isStartUnitTest ? finalStartId : (range.end_lesson_id || finalStartId);
    let finalStartName = range.start_lesson_name || '';
    let finalEndName = isStartUnitTest ? finalStartName : (range.end_lesson_name || finalStartName);
    let finalRangeText = range.lesson_range || finalStartName;

    if (hasPriorSlotTodayForSubject && isUnitTest) {
      const priorSlot = Object.values(slots).reverse().find(s => s.subject === sub);
      if (priorSlot) {
        finalStartId = priorSlot.endLessonId || priorSlot.startLessonId;
        finalEndId = finalStartId;
        finalStartName = priorSlot.endLessonName || priorSlot.startLessonName;
        finalEndName = finalStartName;
        finalRangeText = `【定着演習】${finalStartName}`;
      }
    }

    slots[p] = {
      subject: sub,
      unitId: finalStartId,
      customTheme: '',
      startLessonId: finalStartId,
      endLessonId: finalEndId,
      startLessonName: finalStartName,
      endLessonName: finalEndName,
      lessonRange: finalRangeText
    };
  }

  return slots;
}

