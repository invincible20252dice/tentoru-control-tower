import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, Student, LearningTask, CurriculumMaster, CurriculumUnit } from '../lib/db';
import TeacherDashboard, {
  findPendingUnitTestForPeriodOrSubject,
  extractUnitTestsFromPeriodSelections,
  resolveLessonsForSubject,
  resolveSubjectIcon,
  resolveAvailableSubjectsForStudent,
  resolveChapterSortIndex,
  formatErrorMessage,
  formatRankDisplay,
  deduplicateTodayTests,
  filterSchoolsByGrade,
  resolveMiniTestPassedStatus,
  resolveMiniTestPassedStatusWithFallback,
  resolveInterviewerName,
  resolveStudentPersonalities,
  resolveDefaultSubject,
  parseWeeklyAttendanceLimit,
  matchesTimelineUnit,
  resolveStudentSchoolName,
  matchesGradeCategory,
  matchesSubjectFilter,
  resolveFailedUnitTestKey,
  resolvePassingScoreByLevel,
  resolvePassingLineDisplay,
  resolveSelectedSchoolId,
  resolveTestType,
  resolveHomeworkType,
  isUnitTestCurriculumItem,
  reorderCurriculumUnits,
  resolvePeriodSlots,
  resolveFormArrayWithFallback,
  resolvePeriodSubject,
  resolveSchoolTypeForStudent,
  resolveStudentSortName,
  evaluateAutoPassStatus,
  resolveNextAttendanceDateForStudent,
  sortGradeOptions,
  inferSelectedStartGrade,
  resolveAutoDrillHomeworkText,
  buildDailyTaskFromTimetableConfig,
  applyTranscriptFieldsToInterview2,
  applyTranscriptFieldsToInterview3,
  buildInterview2Payload,
  buildInterview3Payload,
  formatTaskConfigDisplayName,
  resolveSyncLog,
  formatRescheduleErrorMessage,
  sortTasksByPeriod,
  matchesMiniTestQuery,
  sortMiniTestResults,
  matchesHomeworkQuery,
  sortHomeworkResults,
  sortMilestonePlans,
  adjustTasksForStartUnits,
  resolveSavedStudentEditForm
} from '../components/TeacherDashboard';
import { ensureMathEnglishUnitTests } from '../lib/scheduler';

describe('小学生カリキュラムにおける単元確認テストの「本日のテスト」自動反映テスト', () => {
  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-算数-小1-1', subject: '算数', grade: '小1', unit_name: 'かずと　すうじ', lesson_name: 'かずとすうじ', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-算数-小1-2', subject: '算数', grade: '小1', unit_name: 'なんばんめ', lesson_name: 'なんばんめ(1)', sort_order: 2, item_type: 'lesson' }
  ];

  const sampleStudent: Student = {
    id: 'std-b-1',
    student_id: 'student43854',
    name: '佐藤　B',
    grade: '小3',
    level: 'B',
    school_id: 'sch-1',
    branch_id: 'branch-1',
    period_count: 2,
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['算数', '英語'],
    start_unit_math: 'cm-算数-小1-1',
    completed_lesson_ids: []
  };

  beforeEach(async () => {
    localStorage.clear();
    await db.saveCurriculumMasters(sampleMasters);
    await db.saveStudent(sampleStudent);
  });

  it('1. findPendingUnitTestForPeriodOrSubject: 単元名またはレッスンから未合格の単元確認テストを正しく特定できること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);
    const result = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      unitName: 'かずと　すうじ',
      student: sampleStudent,
      curriculumMasters: processed
    });

    expect(result).not.toBeNull();
    expect(result?.unitName).toBe('かずと　すうじ');
    expect(result?.content).toBe('かずと　すうじ - 単元確認テスト');
    expect(result?.passingLine).toBe('80%以上');
  });

  it('2. extractUnitTestsFromPeriodSelections: コマ割りがまとめテスト(3)まででも、単元確認テストが自動抽出されること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);
    const periodSelections = {
      1: {
        subject: '算数',
        unitId: 'cm-算数-小1-1',
        startLessonId: 'cm-算数-小1-1',
        startLessonName: 'かずと　すうじ - かずとすうじ',
        endLessonId: 'cm-auto-sum3-算数-小1-かずと　すうじ',
        endLessonName: 'かずと　すうじ - まとめテスト（３）',
        lessonRange: 'かずと　すうじ - かずとすうじ 〜 かずと　すうじ - まとめテスト（３）'
      }
    };

    const extracted = extractUnitTestsFromPeriodSelections({
      periodSelections,
      periodCount: 1,
      curriculumMasters: processed,
      student: sampleStudent
    });

    expect(extracted.length).toBeGreaterThan(0);
    const mathTest = extracted.find(t => t.subject === '算数');
    expect(mathTest).toBeDefined();
    expect(mathTest?.content).toBe('かずと　すうじ - 単元確認テスト');
    expect(mathTest?.unitName).toBe('かずと　すうじ');
  });

  it('3. UIテスト: コマ割りに算数が設定された日付で「本日のテスト」に単元確認テストが自動反映されること', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const today = new Date().toISOString().split('T')[0];

    // 当日のタスクとして算数（かずと　すうじ）を設定
    const task: LearningTask = {
      id: `task-${sampleStudent.id}-${today}-1`,
      student_id: sampleStudent.id,
      scheduled_date: today,
      period: 1,
      subject: '算数',
      unit_id: 'cm-算数-小1-1',
      start_lesson_id: 'cm-算数-小1-1',
      end_lesson_id: 'cm-auto-sum3-算数-小1-かずと　すうじ',
      start_lesson_name: 'かずと　すうじ - かずとすうじ',
      end_lesson_name: 'かずと　すうじ - まとめテスト（３）',
      status: 'unstarted',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    await act(async () => {
      render(
        <TeacherDashboard 
          initialStudentId={sampleStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
    });

    // 「遅れチェック ＆ 自動リスケ」ボタンをクリック
    const autoReschedBtn = await screen.findByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
    await act(async () => {
      fireEvent.click(autoReschedBtn);
    });

    // 本日のテスト枠に「かずと　すうじ - 単元確認テスト」が自動反映されていることを検証
    await waitFor(() => {
      expect(screen.getAllByText(/かずと.*すうじ.*単元確認テスト/i).length).toBeGreaterThan(0);
    });
  });

  it('4. UIテスト: コマ割りのドロップダウンに単元確認テストが表示され、選択時に専用スタイル・バッジが適用されること', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      render(
        <TeacherDashboard 
          initialStudentId={sampleStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
    });

    // 1コマ目の教科を「算数」に変更
    const subjSelect = await screen.findByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '算数' } });
    });

    // 開始授業のドロップダウンに単元確認テストが含まれていること
    const startSelect = await screen.findByTestId('period-unit-select-1');
    const options = Array.from(startSelect.querySelectorAll('option')).map(o => o.textContent || '');
    const hasUnitTestOption = options.some(opt => opt.includes('単元確認テスト') || opt.includes('単元テスト'));
    expect(hasUnitTestOption).toBe(true);

    // 単元確認テストのoptionのvalueを取得して選択
    const utOption = Array.from(startSelect.querySelectorAll('option')).find(o => o.textContent?.includes('単元確認テスト'));
    expect(utOption).toBeDefined();

    if (utOption) {
      await act(async () => {
        fireEvent.change(startSelect, { target: { value: utOption.value } });
      });

      // 単元確認テスト実施コマバッジが表示されること
      await waitFor(() => {
        expect(screen.getByTestId('period-unittest-badge-1')).toBeInTheDocument();
      });

      // コマ割り行（period-row-1）にパープル背景が適用されていること
      const row = screen.getByTestId('period-row-1');
      expect(row.style.backgroundColor).toBe('rgb(250, 245, 255)');
    }
  });

  it('5. resolveLessonsForSubject: includeUnitTests の真偽値による単元確認テスト包含・除外と学校単元・フォールバック単元の完全制御', () => {
    const rawUnits: CurriculumUnit[] = [
      { id: 'cu-1', subject: '算数', grade: '小1', school_id: 'sch-1', name: '学校算数通常', sequence_order: 1 },
      { id: 'cu-ut', subject: '算数', grade: '小1', school_id: 'sch-1', name: '学校算数 単元確認テスト', sequence_order: 2, item_type: 'unit_test' },
      { id: 'cu-fall-ut', subject: '算数', grade: '小1', school_id: undefined, name: 'フォールバック 単元確認テスト', sequence_order: 3, item_type: 'unit_test' }
    ];

    // includeUnitTests: false（デフォルト）の場合、単元確認テストは完全に除外されること
    const excluded = resolveLessonsForSubject({
      subject: '算数',
      selectedStudent: sampleStudent,
      allCurriculumUnits: rawUnits,
      curriculumMastersList: sampleMasters,
      includeUnitTests: false
    });
    expect(excluded.some(l => l.name.includes('単元確認テスト'))).toBe(false);
    expect(excluded.some(l => l.id === 'cu-1')).toBe(true);

    // includeUnitTests: true の場合、学校単元・マスタ単元の単元確認テストが正しく含まれること
    const included = resolveLessonsForSubject({
      subject: '算数',
      selectedStudent: sampleStudent,
      allCurriculumUnits: rawUnits,
      curriculumMastersList: sampleMasters,
      includeUnitTests: true
    });
    expect(included.some(l => l.name.includes('単元確認テスト'))).toBe(true);
    expect(included.some(l => l.id === 'cu-ut')).toBe(true);
  });

  it('6. findPendingUnitTestForPeriodOrSubject: 現在地が単元確認テストの場合のみ自動抽出し、通常授業や完了済み時は除外すること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);
    const utMaster = processed.find(m => m.item_type === 'unit_test' && m.subject === '算数');
    expect(utMaster).toBeDefined();

    // A. unitName / lessonIdOrName なし、かつ現在地が単元テストの場合 -> 抽出される
    const studentAtUT: Student = {
      ...sampleStudent,
      start_unit_math: utMaster!.id
    };
    const atUTResult = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      student: studentAtUT,
      curriculumMasters: processed
    });
    expect(atUTResult).not.toBeNull();
    expect(atUTResult?.masterId).toBe(utMaster!.id);

    // B. 現在地が通常授業で unitName/lessonIdOrName もなし -> 抽出されない（null）
    const studentAtLesson: Student = {
      ...sampleStudent,
      start_unit_math: 'cm-算数-小1-1'
    };
    const atLessonResult = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      student: studentAtLesson,
      curriculumMasters: processed
    });
    expect(atLessonResult).toBeNull();

    // C. 完了済みの場合 -> isCompletedFn が true を返して null になる
    const completedResult = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      unitName: 'かずと　すうじ',
      student: sampleStudent,
      curriculumMasters: processed,
      isCompletedFn: () => true
    });
    expect(completedResult).toBeNull();
  });

  it('7. extractUnitTestsFromPeriodSelections: 通常授業のみのコマ割りではテストを抽出せず、終了目標同期が正しく機能すること', () => {
    const processed = ensureMathEnglishUnitTests(sampleMasters);

    // A. ひきざん(1) などの通常授業のみのコマ割り -> 0件
    const normalPeriod = {
      1: {
        subject: '算数',
        unitId: 'cm-算数-小1-1',
        startLessonName: 'かずとすうじ',
        endLessonName: 'かずとすうじ'
      }
    };
    const emptyResult = extractUnitTestsFromPeriodSelections({
      periodSelections: normalPeriod,
      periodCount: 1,
      curriculumMasters: processed,
      student: sampleStudent
    });
    expect(emptyResult.length).toBe(0);

    // B. candidateName（startLessonName / endLessonName）に直接単元確認テストが指定された場合 -> 抽出される
    const utPeriod = {
      1: {
        subject: '算数',
        unitId: 'cm-算数-小1-1',
        startLessonName: 'かずと　すうじ - 単元確認テスト',
        endLessonName: 'かずと　すうじ - 単元確認テスト'
      }
    };
    const utResult = extractUnitTestsFromPeriodSelections({
      periodSelections: utPeriod,
      periodCount: 1,
      curriculumMasters: processed,
      student: sampleStudent
    });
    expect(utResult.length).toBe(1);
    expect(utResult[0].content).toContain('単元確認テスト');
  });

  it('8. UIテスト: 終了目標授業ドロップダウンで単元確認テストを選択した際、開始授業も同一単元テストに自動同期されること', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await act(async () => {
      render(
        <TeacherDashboard 
          initialStudentId={sampleStudent.id} 
          teacherType="elementary" 
          initialTab="schedule" 
        />
      );
    });

    const subjSelect = await screen.findByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '算数' } });
    });

    // 終了目標授業ドロップダウンを取得
    const selects = screen.getAllByRole('combobox');
    const endSelect = selects.find(s => {
      const opts = Array.from(s.querySelectorAll('option'));
      return opts.some(o => o.textContent?.includes('終了目標授業を選択'));
    });
    expect(endSelect).toBeDefined();

    if (endSelect) {
      const utOption = Array.from(endSelect.querySelectorAll('option')).find(o => o.textContent?.includes('単元確認テスト'));
      expect(utOption).toBeDefined();

      if (utOption) {
        await act(async () => {
          fireEvent.change(endSelect, { target: { value: utOption.value } });
        });

        // 単元確認テスト実施コマバッジが表示されること
        await waitFor(() => {
          expect(screen.getByTestId('period-unittest-badge-1')).toBeInTheDocument();
        });
      }
    }
  });

  it('9. 教科アイコン・対象教科・章ソートインデックスの各種分岐テスト', () => {
    // resolveSubjectIcon
    expect(resolveSubjectIcon('算数')).toBe('🧮');
    expect(resolveSubjectIcon('数学')).toBe('🧮');
    expect(resolveSubjectIcon('国語')).toBe('📖');
    expect(resolveSubjectIcon('英語')).toBe('🌍');
    expect(resolveSubjectIcon('理科')).toBe('🧪');
    expect(resolveSubjectIcon('物理')).toBe('🧪');
    expect(resolveSubjectIcon('化学')).toBe('🧪');
    expect(resolveSubjectIcon('生物')).toBe('🧪');
    expect(resolveSubjectIcon('社会')).toBe('🏛️');
    expect(resolveSubjectIcon('歴史')).toBe('🏛️');
    expect(resolveSubjectIcon('地理')).toBe('🏛️');
    expect(resolveSubjectIcon('日本史')).toBe('🏛️');
    expect(resolveSubjectIcon('世界史')).toBe('🏛️');
    expect(resolveSubjectIcon('音楽')).toBe('📚');
    expect(resolveSubjectIcon(null)).toBe('📚');
    expect(resolveSubjectIcon(undefined)).toBe('📚');

    // resolveAvailableSubjectsForStudent
    const elemSubjs = resolveAvailableSubjectsForStudent(sampleStudent, true);
    expect(elemSubjs).toContain('算数');
    expect(elemSubjs).toContain('国語');

    const jhsStudent: Student = { ...sampleStudent, grade: '中2', selected_subjects: [] };
    const jhsSubjs = resolveAvailableSubjectsForStudent(jhsStudent, false);
    expect(jhsSubjs).toContain('数学');

    const highStudent: Student = { ...sampleStudent, grade: '高1', selected_subjects: [] };
    const highSubjs = resolveAvailableSubjectsForStudent(highStudent, false);
    expect(highSubjs).toContain('数学');

    const customStudent: Student = { ...sampleStudent, selected_subjects: ['物理', '化学'] };
    const customSubjs = resolveAvailableSubjectsForStudent(customStudent, false);
    expect(customSubjs).toContain('物理');
    expect(customSubjs).toContain('化学');

    // resolveChapterSortIndex
    const chapters = ['第1章', '第2章', '第3章'];
    expect(resolveChapterSortIndex('第2章', chapters)).toBe(1);
    expect(resolveChapterSortIndex('第9章', chapters)).toBe(999);
    expect(resolveChapterSortIndex(null, chapters)).toBe(999);
    expect(resolveChapterSortIndex(undefined, chapters)).toBe(999);
  });

  it('10. エラーメッセージ整形・ランク表示・重複排除・学校フィルタの各種分岐テスト', () => {
    // formatErrorMessage
    expect(formatErrorMessage('文字列エラー')).toBe('文字列エラー');
    expect(formatErrorMessage(new Error('例外エラー'))).toBe('例外エラー');
    expect(formatErrorMessage({ message: 'オブジェクトエラー' })).toBe('オブジェクトエラー');
    expect(formatErrorMessage(null)).toBe('不明なエラーが発生しました');
    expect(formatErrorMessage(undefined)).toBe('不明なエラーが発生しました');
    expect(formatErrorMessage(12345)).toBe('12345');

    // formatRankDisplay
    expect(formatRankDisplay(1)).toBe('1位');
    expect(formatRankDisplay('A')).toBe('A位');
    expect(formatRankDisplay(null)).toBe('ー位');
    expect(formatRankDisplay(undefined)).toBe('ー位');

    // deduplicateTodayTests
    const dupTests = [
      { subject: '算数', content: 'テスト1' },
      { subject: '算数', content: 'テスト1' },
      { subject: '国語', content: 'テスト1' },
      { subject: '算数', content: 'テスト2' }
    ];
    const deduped = deduplicateTodayTests(dupTests);
    expect(deduped.length).toBe(3);

    // filterSchoolsByGrade
    const schools = [
      { id: 's1', name: '小1校', type: 'elementary' as const },
      { id: 's2', name: '中1校', type: 'junior_high' as const },
      { id: 's3', name: '高1校', type: 'high_school' as const }
    ];
    expect(filterSchoolsByGrade(schools, '小2')).toHaveLength(1);
    expect(filterSchoolsByGrade(schools, '中3')).toHaveLength(2);
    expect(filterSchoolsByGrade(schools, undefined)).toHaveLength(3);
  });

  it('11. 小テスト合否判定・面談者名・個性タグ・初期教科・通塾上限・単元検索・並び替え等ドメインヘルパー網羅テスト', () => {
    // resolveMiniTestPassedStatus
    expect(resolveMiniTestPassedStatus('passed', true)).toBe('passed');
    expect(resolveMiniTestPassedStatus('failed', false)).toBe('failed');
    expect(resolveMiniTestPassedStatus('unstarted', null)).toBe('unstarted');
    expect(resolveMiniTestPassedStatus(null, true)).toBe('passed');
    expect(resolveMiniTestPassedStatus(null, false)).toBe('failed');
    expect(resolveMiniTestPassedStatus(null, null)).toBe('unstarted');

    // resolveMiniTestPassedStatusWithFallback
    expect(resolveMiniTestPassedStatusWithFallback('passed', null, 85)).toBe('passed');
    expect(resolveMiniTestPassedStatusWithFallback(null, null, 85)).toBe('passed');
    expect(resolveMiniTestPassedStatusWithFallback(null, null, 60)).toBe('failed');
    expect(resolveMiniTestPassedStatusWithFallback(null, null, null)).toBe('unstarted');
    expect(resolveMiniTestPassedStatusWithFallback(null, null, null, 'passed')).toBe('passed');

    // resolveInterviewerName
    expect(resolveInterviewerName('佐藤', '田中', '担当講師')).toBe('佐藤');
    expect(resolveInterviewerName(null, '田中', '担当講師')).toBe('田中');
    expect(resolveInterviewerName(null, null, '担当講師')).toBe('担当講師');

    // resolveStudentPersonalities
    expect(resolveStudentPersonalities({ personality_tags: ['几帳面'] }, {})).toEqual(['几帳面']);
    expect(resolveStudentPersonalities({ personalities: ['努力家'] }, {})).toEqual(['努力家']);
    expect(resolveStudentPersonalities({}, { personality_tags: ['元気'] })).toEqual(['元気']);
    expect(resolveStudentPersonalities(null, null)).toEqual([]);

    // resolveDefaultSubject
    expect(resolveDefaultSubject('小1', '理科')).toBe('理科');
    expect(resolveDefaultSubject('小1', undefined)).toBe('算数');
    expect(resolveDefaultSubject('中1', undefined)).toBe('数学');

    // parseWeeklyAttendanceLimit
    expect(parseWeeklyAttendanceLimit('週3コマ')).toBe(3);
    expect(parseWeeklyAttendanceLimit('週2日')).toBe(2);
    expect(parseWeeklyAttendanceLimit('')).toBe(2);
    expect(parseWeeklyAttendanceLimit(undefined)).toBe(2);
    expect(parseWeeklyAttendanceLimit('無制限')).toBeNull();
    expect(parseWeeklyAttendanceLimit('自由')).toBeNull();

    // matchesTimelineUnit
    const unitObj = { id: 'u-1', name: '一次方程式', lesson_name: '一次方程式の解き方' };
    expect(matchesTimelineUnit(unitObj, '一次方程式')).toBe(true);
    expect(matchesTimelineUnit(unitObj, '', 'u-1')).toBe(true);
    expect(matchesTimelineUnit(unitObj, '二次関数')).toBe(false);

    // resolveStudentSchoolName
    const schoolList = [{ id: 'sch-1', name: '飽田南小' }];
    expect(resolveStudentSchoolName(schoolList, 'sch-1', '')).toBe('飽田南小');
    expect(resolveStudentSchoolName([], 'sch-99', 'フォールバック校')).toBe('フォールバック校');

    // matchesGradeCategory
    expect(matchesGradeCategory('小5', '小学生')).toBe(true);
    expect(matchesGradeCategory('中2', '中学生')).toBe(true);
    expect(matchesGradeCategory('高1', '高校生')).toBe(true);
    expect(matchesGradeCategory('小5', 'all')).toBe(true);
    expect(matchesGradeCategory(null, 'all')).toBe(true);
    expect(matchesGradeCategory('小5', '中学生')).toBe(false);

    // matchesSubjectFilter
    expect(matchesSubjectFilter('算数', '足し算', '算数')).toBe(true);
    expect(matchesSubjectFilter('算数', '足し算', 'all')).toBe(true);
    expect(matchesSubjectFilter('算数', '足し算', null)).toBe(true);
    expect(matchesSubjectFilter('数学', '方程式', '英語')).toBe(false);

    // resolveFailedUnitTestKey
    expect(resolveFailedUnitTestKey({ unit_name: '正負の数' })).toBe('正負の数');
    expect(resolveFailedUnitTestKey({ test_content: '正負の数 - 単元確認テスト' })).toBe('正負の数 - 単元確認テスト');
    expect(resolveFailedUnitTestKey(null)).toBe('');

    // resolvePassingScoreByLevel
    expect(resolvePassingScoreByLevel('A')).toBe(90);
    expect(resolvePassingScoreByLevel('B')).toBe(80);
    expect(resolvePassingScoreByLevel('C')).toBe(70);
    expect(resolvePassingScoreByLevel(undefined)).toBe(70);

    // resolvePassingLineDisplay
    expect(resolvePassingLineDisplay('レベルA (90点)', 'A')).toBe('レベルA (90点)');
    expect(resolvePassingLineDisplay('90点', 'A')).toBe('レベルA (90点)');
    expect(resolvePassingLineDisplay(null, 'A')).toBe('レベルA (90点)');
    expect(resolvePassingLineDisplay(null, 'B')).toBe('レベルB (80点)');

    // resolveSelectedSchoolId
    const sampleSchools = [{ id: 'sch-1', name: '学校1' }, { id: 'sch-2', name: '学校2' }];
    expect(resolveSelectedSchoolId(sampleSchools, 'sch-selected')).toBe('sch-selected');
    expect(resolveSelectedSchoolId(sampleSchools, null, { school_id: 'sch-2' })).toBe('sch-2');
    expect(resolveSelectedSchoolId(sampleSchools, null, null)).toBe('sch-1');
    expect(resolveSelectedSchoolId([], null, null)).toBeUndefined();

    // resolveTestType
    expect(resolveTestType('custom', '単元確認テスト')).toBe('custom');
    expect(resolveTestType(undefined, '単元確認テスト')).toBe('unit_test');
    expect(resolveTestType(undefined, '小テスト')).toBe('custom');

    // resolveHomeworkType
    expect(resolveHomeworkType('custom', '2回目演習')).toBe('custom');
    expect(resolveHomeworkType(undefined, '2回目演習')).toBe('drill_2nd');
    expect(resolveHomeworkType(undefined, '宿題')).toBe('custom');

    // isUnitTestCurriculumItem
    expect(isUnitTestCurriculumItem({ item_type: 'unit_test' })).toBe(true);
    expect(isUnitTestCurriculumItem({ lesson_name: '単元確認テスト' })).toBe(true);
    expect(isUnitTestCurriculumItem({ name: '単元確認テスト' })).toBe(true);
    expect(isUnitTestCurriculumItem({ lesson_name: 'まとめテスト' })).toBe(false);

    // reorderCurriculumUnits
    const uList = [
      { id: '1', sequence_order: 1 },
      { id: '2', sequence_order: 2 }
    ];
    const reordered = reorderCurriculumUnits(uList, 0, 1);
    expect(reordered[0].id).toBe('2');
    expect(reordered[0].sequence_order).toBe(1);
    expect(reordered[1].id).toBe('1');
    expect(reordered[1].sequence_order).toBe(2);
  });

  it('12. コマ枠スロット・フォーム配列フォールバック・学校種別導出・合否判定・次回通塾日算出等の網羅テスト', () => {
    // resolvePeriodSlots
    expect(resolvePeriodSlots(3, 2, 2)).toBe(3);
    expect(resolvePeriodSlots(null, 4, 2)).toBe(4);
    expect(resolvePeriodSlots(null, null, 2)).toBe(2);

    // resolveFormArrayWithFallback
    expect(resolveFormArrayWithFallback(['a'], ['b'], ['c'])).toEqual(['a']);
    expect(resolveFormArrayWithFallback([], ['b'], ['c'])).toEqual(['b']);
    expect(resolveFormArrayWithFallback(null, null, ['c'])).toEqual(['c']);

    // resolvePeriodSubject
    expect(resolvePeriodSubject('理科', '数学', '英語')).toBe('理科');
    expect(resolvePeriodSubject(null, '数学', '英語')).toBe('数学');
    expect(resolvePeriodSubject(null, null, '英語')).toBe('英語');
    expect(resolvePeriodSubject(null, null, null, '国語')).toBe('国語');

    // resolveSchoolTypeForStudent
    expect(resolveSchoolTypeForStudent('小5', undefined, '第一小学校')).toBe('elementary');
    expect(resolveSchoolTypeForStudent('高2', undefined, '第一高校')).toBe('high_school');
    expect(resolveSchoolTypeForStudent('中1', undefined, '第一中学校')).toBe('junior_high');
    expect(resolveSchoolTypeForStudent('小3', undefined, undefined)).toBe('elementary');
    expect(resolveSchoolTypeForStudent('高1', undefined, undefined)).toBe('high_school');
    expect(resolveSchoolTypeForStudent('中2', undefined, undefined)).toBe('junior_high');
    expect(resolveSchoolTypeForStudent(undefined, 'elementary', undefined)).toBe('elementary');

    // resolveStudentSortName
    expect(resolveStudentSortName('田中', null)).toBe('田中');
    expect(resolveStudentSortName(null, { name_kana: 'ヤマダ' })).toBe('ヤマダ');
    expect(resolveStudentSortName(null, { name: '山田' })).toBe('山田');
    expect(resolveStudentSortName(null, null)).toBe('');

    // evaluateAutoPassStatus
    expect(evaluateAutoPassStatus(NaN)).toBe('unstarted');
    expect(evaluateAutoPassStatus(85, '80%以上')).toBe('passed');
    expect(evaluateAutoPassStatus(75, '80%以上')).toBe('failed');
    expect(evaluateAutoPassStatus(85, '8割以上')).toBe('passed');
    expect(evaluateAutoPassStatus(75, '8割以上')).toBe('failed');
    expect(evaluateAutoPassStatus(85, '80点')).toBe('passed');
    expect(evaluateAutoPassStatus(75, '80点')).toBe('failed');
    expect(evaluateAutoPassStatus(90, null, 'A')).toBe('passed');
    expect(evaluateAutoPassStatus(60, null, 'A')).toBe('failed');

    // resolveNextAttendanceDateForStudent
    const nextDate = resolveNextAttendanceDateForStudent('2026-06-01', sampleStudent);
    expect(nextDate).toBeDefined();
    expect(nextDate > '2026-06-01').toBe(true);
    expect(resolveNextAttendanceDateForStudent(undefined, null)).toBeDefined();

    // sortGradeOptions
    const sortedGrades = sortGradeOptions(['中2', '小1', '高3', '小6', '不明学年']);
    expect(sortedGrades[0]).toBe('小1');
    expect(sortedGrades[1]).toBe('小6');
    expect(sortedGrades[2]).toBe('中2');
    expect(sortedGrades[3]).toBe('高3');
    expect(sortedGrades[4]).toBe('不明学年');

    // inferSelectedStartGrade
    expect(inferSelectedStartGrade('中1', null, sampleMasters)).toBe('中1');
    expect(inferSelectedStartGrade(null, 'cm-算数-小1-1', sampleMasters)).toBe('1年生');
    expect(inferSelectedStartGrade(null, null, sampleMasters)).toBe('');
    expect(inferSelectedStartGrade(null, 'unknown-id', sampleMasters)).toBe('');

    // resolveAutoDrillHomeworkText
    expect(resolveAutoDrillHomeworkText('算数', null)).toBe('');
    const periodsMap = {
      1: { subject: '算数', lessonRange: 'たしざん(1) 〜 たしざん(3)' }
    };
    const hwText = resolveAutoDrillHomeworkText('算数', periodsMap, '小1');
    expect(hwText).toContain('たしざん');
  });

  it('13. 単元名プレフィックス結合・園児/既卒学校フィルタ・タスク生成フォールバック等エッジ分岐網羅テスト', () => {
    // 1. filterSchoolsByGrade: 園児・既卒
    const testSchools = [
      { id: 'sc-1', name: '幼小', type: 'elementary' as const },
      { id: 'sc-2', name: '高校', type: 'high_school' as const }
    ];
    expect(filterSchoolsByGrade(testSchools, '園児')).toHaveLength(1);
    expect(filterSchoolsByGrade(testSchools, '既卒')).toHaveLength(1);

    // 2. buildDailyTaskFromTimetableConfig: extractedLessonIds が空で effectiveStartId がある場合
    const taskConfig = {
      period: 1,
      subject: '算数',
      unitId: 'custom-u1',
      startLessonId: 'lesson-start-id',
      customTheme: '特訓授業'
    };
    const dailyTask = buildDailyTaskFromTimetableConfig({
      student: sampleStudent,
      scheduleDate: '2026-06-01',
      p: 1,
      config: taskConfig,
      curriculumMastersList: [],
      allCurriculumUnits: []
    });
    expect(dailyTask.lesson_ids).toEqual(['lesson-start-id']);

    // 3. findPendingUnitTestForPeriodOrSubject: lesson_name に unit_name が含まれていないマスタの結合
    const noPrefixMasters: CurriculumMaster[] = [
      { id: 'm-1', subject: '算数', grade: '小1', unit_name: 'たしざん', lesson_name: '10までのたしざん', sort_order: 1, item_type: 'lesson' },
      { id: 'm-ut-noprefix', subject: '算数', grade: '小1', unit_name: 'たしざん', lesson_name: '単元確認テスト', sort_order: 2, item_type: 'unit_test' }
    ];
    const utRes = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      unitName: 'たしざん',
      student: sampleStudent,
      curriculumMasters: noPrefixMasters
    });
    expect(utRes?.content).toBe('たしざん - 単元確認テスト');

    // 4. findPendingUnitTestForPeriodOrSubject: lessonIdOrName から unit_name が特定されプレフィックスが付与される分岐
    const utFromLesson = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      lessonIdOrName: 'm-1',
      student: sampleStudent,
      curriculumMasters: noPrefixMasters
    });
    expect(utFromLesson?.content).toBe('たしざん - 単元確認テスト');

    // 5. extractUnitTestsFromPeriodSelections: candidateName が「単元確認テスト」で rawUnit がフォールバックされる分岐
    const utPeriodFallback = {
      1: {
        subject: '算数',
        customTheme: 'カスタム単元',
        startLessonName: '単元確認テスト',
        endLessonName: '単元確認テスト'
      }
    };
    const extractedFallback = extractUnitTestsFromPeriodSelections({
      periodSelections: utPeriodFallback,
      periodCount: 1,
      curriculumMasters: noPrefixMasters,
      student: sampleStudent
    });
    expect(extractedFallback.length).toBe(1);
    expect(extractedFallback[0].content).toContain('単元確認テスト');
  });

  it('14. 二者面談・三者面談フィールド反映・ペイロード生成・同期ログ・タスク並び替え等純粋関数網羅テスト', () => {
    // 1. applyTranscriptFieldsToInterview2
    const parsed2Full = {
      interviewer: '佐藤講師',
      target_school: '開成高校',
      dream_goal: '東大合格',
      club_activity: 'サッカー部',
      club_members_count: '30名',
      close_friends: '山田、田中',
      study_anxiety: '数学の応用',
      self_evaluation: '良好',
      student_challenges: '毎日の勉強習慣',
      required_actions: '計算問題毎日10題',
      expectations: '自立学習',
      target_rank: '学年10位',
      target_score: '450点',
      notes: '追加メモ'
    };
    const res2 = applyTranscriptFieldsToInterview2(parsed2Full, '既存メモ');
    expect(res2.interviewer).toBe('佐藤講師');
    expect(res2.target_school).toBe('開成高校');
    expect(res2.dream_goal).toBe('東大合格');
    expect(res2.club_activity).toBe('サッカー部');
    expect(res2.club_members_count).toBe('30名');
    expect(res2.close_friends).toBe('山田、田中');
    expect(res2.study_anxiety).toBe('数学の応用');
    expect(res2.self_evaluation).toBe('良好');
    expect(res2.student_challenges).toBe('毎日の勉強習慣');
    expect(res2.required_actions).toBe('計算問題毎日10題');
    expect(res2.expectations).toBe('自立学習');
    expect(res2.target_rank).toBe('学年10位');
    expect(res2.target_score).toBe('450点');
    expect(res2.updatedNotes).toBe('既存メモ\n\n追加メモ');

    const emptyRes2 = applyTranscriptFieldsToInterview2({}, '');
    expect(emptyRes2.interviewer).toBeUndefined();
    expect(emptyRes2.updatedNotes).toBeUndefined();

    // 2. applyTranscriptFieldsToInterview3
    const parsed3Full = {
      interviewer: '鈴木講師',
      parent_anxieties: '進路選択',
      discussed_content: '夏期講習の受講日程',
      notes: '保護者面談メモ'
    };
    const res3 = applyTranscriptFieldsToInterview3(parsed3Full, '旧メモ');
    expect(res3.interviewer).toBe('鈴木講師');
    expect(res3.parent_anxieties).toBe('進路選択');
    expect(res3.discussed_content).toBe('夏期講習の受講日程');
    expect(res3.updatedNotes).toBe('旧メモ\n\n保護者面談メモ');

    const emptyRes3 = applyTranscriptFieldsToInterview3({}, '');
    expect(emptyRes3.interviewer).toBeUndefined();

    // 3. buildInterview2Payload
    const payload2 = buildInterview2Payload({
      selectedInterview2Id: 'int-2-1',
      studentId: 'std-1',
      interviewDate: '2026-06-15',
      interviewer: '田中講師',
      teacherInCharge: '佐藤講師'
    });
    expect(payload2.id).toBe('int-2-1');
    expect(payload2.interviewer).toBe('田中講師');

    const payload2New = buildInterview2Payload({
      studentId: 'std-1',
      interviewDate: '2026-06-15'
    });
    expect(payload2New.id).toBeDefined();
    expect(payload2New.interviewer).toBe('担当講師');

    // 4. buildInterview3Payload
    const payload3 = buildInterview3Payload({
      selectedInterview3Id: 'int-3-1',
      studentId: 'std-1',
      interviewDate: '2026-06-15',
      interviewer: '田中講師'
    });
    expect(payload3.id).toBe('int-3-1');

    const payload3New = buildInterview3Payload({
      studentId: 'std-1',
      interviewDate: '2026-06-15'
    });
    expect(payload3New.id).toBeDefined();
    expect(payload3New.interviewer).toBe('担当講師');

    // 5. formatTaskConfigDisplayName
    expect(formatTaskConfigDisplayName('レッスンA', 'レッスンB')).toBe('レッスンB');
    expect(formatTaskConfigDisplayName('レッスンA', '')).toBe('レッスンA');
    expect(formatTaskConfigDisplayName(null, null)).toBe('単元確認テスト');

    // 6. resolveSyncLog
    expect(resolveSyncLog('シードログ', null)).toBe('シードログ');
    expect(resolveSyncLog(null, 'DBログ')).toBe('DBログ');
    expect(resolveSyncLog(null, null)).toContain('完全復元完了');

    // 7. formatRescheduleErrorMessage
    expect(formatRescheduleErrorMessage('エラー文字列')).toContain('自動リスケジュール処理中にエラーが発生しました: エラー文字列');
    expect(formatRescheduleErrorMessage(new Error('例外'))).toContain('自動リスケジュール処理中にエラーが発生しました: 例外');

    // 8. sortTasksByPeriod
    const unsortedTasks = [
      { id: 't2', period: 3 } as any,
      { id: 't1', period: 1 } as any,
      { id: 't3', period: 2 } as any
    ];
    const sortedTasks = sortTasksByPeriod(unsortedTasks);
    expect(sortedTasks[0].period).toBe(1);
    expect(sortedTasks[1].period).toBe(2);
    expect(sortedTasks[2].period).toBe(3);
  });

  it('15. TeacherDashboard の検索・ソート・開始単元調整・生徒編集フォーム純粋関数の網羅テスト', () => {
    // 1. matchesMiniTestQuery
    const testRecord = {
      test_content: '連立方程式の計算テスト',
      subject: '数学',
      passing_line: '80%'
    };
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '   ')).toBe(true);
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '方程式')).toBe(true);
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '数学')).toBe(true);
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '80%')).toBe(true);
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '山田')).toBe(true);
    expect(matchesMiniTestQuery(testRecord, '山田太郎', '英語')).toBe(false);
    expect(matchesMiniTestQuery({}, '', '検索語')).toBe(false);

    // 2. sortMiniTestResults
    const miniStudents: Student[] = [
      { id: 'st-1', name: '田中一郎', name_kana: 'タナカイチロウ' } as any,
      { id: 'st-2', name: '佐藤花子', name_kana: 'サトウハナコ' } as any
    ];
    const miniResults = [
      { id: 'r1', date: '2026-11-01', student_id: 'st-1', score: null, status: 'unstarted' },
      { id: 'r2', date: '2026-11-03', student_id: 'st-2', score: 90, status: 'passed', passed: true },
      { id: 'r3', date: '2026-11-02', student_id: 'st-1', score: 50, status: 'failed', passed: false }
    ];

    // date_asc
    const sortedByDateAsc = sortMiniTestResults(miniResults, 'date_asc', miniStudents);
    expect(sortedByDateAsc[0].id).toBe('r1');
    expect(sortedByDateAsc[2].id).toBe('r2');

    // date_desc (default)
    const sortedByDateDesc = sortMiniTestResults(miniResults, 'date_desc', miniStudents);
    expect(sortedByDateDesc[0].id).toBe('r2');
    expect(sortedByDateDesc[2].id).toBe('r1');

    // name_asc
    const sortedByNameAsc = sortMiniTestResults(miniResults, 'name_asc', miniStudents);
    expect(sortedByNameAsc[0].student_id).toBe('st-2'); // 佐藤花子

    // unsubmitted_first
    const sortedByUnsub = sortMiniTestResults(miniResults, 'unsubmitted_first', miniStudents);
    expect(sortedByUnsub[0].id).toBe('r1');

    // tempScores 考慮の unsubmitted_first
    const sortedByUnsubWithTemp = sortMiniTestResults(miniResults, 'unsubmitted_first', miniStudents, { r1: 85 });
    expect(sortedByUnsubWithTemp.length).toBe(3);

    // passed_first
    const sortedByPassed = sortMiniTestResults(miniResults, 'passed_first', miniStudents);
    expect(sortedByPassed[0].id).toBe('r2');

    // tempPassedStatuses 考慮の passed_first
    const sortedByPassedWithTemp = sortMiniTestResults(miniResults, 'passed_first', miniStudents, {}, { r3: 'passed' });
    expect(sortedByPassedWithTemp.length).toBe(3);

    // 3. matchesHomeworkQuery
    const hwRecord = {
      homework_content: '計算ドリル P10-15',
      subject: '数学',
      homework_deadline: '2026-11-10'
    };
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '  ')).toBe(true);
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '計算ドリル')).toBe(true);
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '数学')).toBe(true);
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '11-10')).toBe(true);
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '佐藤')).toBe(true);
    expect(matchesHomeworkQuery(hwRecord, '佐藤花子', '国語')).toBe(false);
    expect(matchesHomeworkQuery({}, '', '検索語')).toBe(false);

    // 4. sortHomeworkResults
    const hwResults = [
      { id: 'h1', date: '2026-11-01', student_id: 'st-1', status: 'pending' },
      { id: 'h2', date: '2026-11-03', student_id: 'st-2', status: 'completed' },
      { id: 'h3', date: '2026-11-02', student_id: 'st-1', status: 'submitted' }
    ];

    // date_asc
    const hwDateAsc = sortHomeworkResults(hwResults, 'date_asc', miniStudents);
    expect(hwDateAsc[0].id).toBe('h1');
    expect(hwDateAsc[2].id).toBe('h2');

    // name_asc
    const hwNameAsc = sortHomeworkResults(hwResults, 'name_asc', miniStudents);
    expect(hwNameAsc[0].student_id).toBe('st-2'); // サトウハナコ

    // unsubmitted_first
    const hwUnsub = sortHomeworkResults(hwResults, 'unsubmitted_first', miniStudents);
    expect(hwUnsub[0].id).toBe('h1');

    // completed_first
    const hwComp = sortHomeworkResults(hwResults, 'completed_first', miniStudents);
    expect(hwComp[0].status === 'completed' || hwComp[0].status === 'submitted').toBe(true);

    // tempHomeworkStatuses 考慮
    const hwTempComp = sortHomeworkResults(hwResults, 'completed_first', miniStudents, { h1: 'completed' });
    expect(hwTempComp.length).toBe(3);

    // 5. sortMilestonePlans
    const plans: any[] = [
      { id: 'p1', month: 4, week_number: 2 },
      { id: 'p2', month: 4, week_number: 1 },
      { id: 'p3', month: 3, week_number: 3 },
      { id: 'p4', month: 1, week_number: 1 }, // 翌年1月 (monthOrder 13)
      { id: 'p5', month: 2, week_number: 2 }  // 翌年2月 (monthOrder 14)
    ];
    const sortedPlans = sortMilestonePlans(plans);
    expect(sortedPlans[0].id).toBe('p3'); // 3月
    expect(sortedPlans[1].id).toBe('p2'); // 4月1週
    expect(sortedPlans[2].id).toBe('p1'); // 4月2週
    expect(sortedPlans[3].id).toBe('p4'); // 1月
    expect(sortedPlans[4].id).toBe('p5'); // 2月

    // 6. adjustTasksForStartUnits
    const schoolUnits: CurriculumUnit[] = [
      { id: 'u1', subject: '数学', sequence_order: 1 } as any,
      { id: 'u2', subject: '数学', sequence_order: 2 } as any,
      { id: 'u3', subject: '英語', sequence_order: 1 } as any,
      { id: 'u4', subject: '理科', sequence_order: 1 } as any,
      { id: 'u5', subject: '社会', sequence_order: 1 } as any,
      { id: 'u6', subject: '国語', sequence_order: 1 } as any
    ];
    const rawTasks: LearningTask[] = [
      { id: 'task-1', unit_id: 'u1', status: 'unstarted' } as any,
      { id: 'task-2', unit_id: 'u2', status: 'skipped' } as any,
      { id: 'task-unknown', unit_id: 'unknown', status: 'unstarted' } as any
    ];
    const startUnitsBySub = {
      math: { id: 'u2', sequence_order: 2 } as any,
      english: { id: 'u3', sequence_order: 1 } as any,
      science: { id: 'u4', sequence_order: 1 } as any,
      social: { id: 'u5', sequence_order: 1 } as any,
      japanese: { id: 'u6', sequence_order: 1 } as any
    };
    const adjusted = adjustTasksForStartUnits(rawTasks, schoolUnits, startUnitsBySub);
    expect(adjusted[0].status).toBe('skipped'); // u1 < u2 なのでスキップ
    expect(adjusted[0].office_note).toContain('スキップ');
    expect(adjusted[1].status).toBe('unstarted'); // u2 >= u2 かつ skipped だったので未着手に復旧
    expect(adjusted[2].id).toBe('task-unknown'); // 未知タスクはそのまま

    // 7. resolveSavedStudentEditForm
    const fullSaved = {
      id: 'st-full',
      name: '完全生徒',
      school_name: '完全小学校',
      default_slots: 3,
      personalities: ['集中力あり'],
      assigned_teachers: ['佐藤講師'],
      teacher_in_charge: '佐藤講師',
      selected_subjects: ['算数', '英語'],
      selected_days: ['monday', 'thursday'],
      weekly_sessions_count: '3回',
      weekly_duration_minutes: '180分',
      enrollment_date: '2026-04-01',
      withdrawal_date: null,
      target_schools: ['完全中学校']
    };
    const resFull = resolveSavedStudentEditForm({ saved: fullSaved as any });
    expect(resFull.resolvedSchool).toBe('完全小学校');
    expect(resFull.resolvedSlots).toBe(3);
    expect(resFull.editForm.teacher_in_charge).toBe('佐藤講師');
    expect(resFull.editForm.personalities).toEqual(['集中力あり']);

    // 最小・フォールバック検証
    const resMinimal = resolveSavedStudentEditForm({
      saved: { id: 'st-min', name: '最小生徒' } as any,
      finalizedSchoolName: '第一志望校',
      newSlots: 4,
      personalityList: ['素直'],
      currentAssignedTeachers: ['高橋講師'],
      currentSelectedSubjects: ['国語'],
      fallbackSelectedDays: ['wednesday'],
      cleanTargetSchools: [{ id: 'target-1' }]
    });
    expect(resMinimal.resolvedSchool).toBe('第一志望校');
    expect(resMinimal.resolvedSlots).toBe(4);
    expect(resMinimal.editForm.teacher_in_charge).toBe('高橋講師');
    expect(resMinimal.editForm.personalities).toEqual(['素直']);
    expect(resMinimal.editForm.selected_subjects).toEqual(['国語']);
    expect(resMinimal.editForm.selected_days).toEqual(['wednesday']);
    expect(resMinimal.editForm.target_schools).toHaveLength(1);
  });

  it('16. 単元確認テスト抽出およびタスク構築の各種プレフィックス結合・フォールバック精密ブランチ網羅テスト', () => {
    // 1. buildDailyTaskFromTimetableConfig: stepLessons が空だが startLessonId がある場合の line 1362 分岐
    const stdDummy: Student = {
      id: 'st-branch-1362',
      name: 'ブランチ生徒',
      grade: '小1',
      classroom: '恵比寿'
    } as any;
    const taskConfig = {
      subject: '算数',
      startLessonId: 'cm-explicit-start',
      lesson_ids: []
    };
    const builtTask = buildDailyTaskFromTimetableConfig({
      student: stdDummy,
      scheduleDate: '2026-11-06',
      period: 1,
      config: taskConfig,
      curriculumMastersList: [],
      allCurriculumUnits: []
    });
    expect(builtTask.lesson_ids).toEqual(['cm-explicit-start']);

    // 2. findPendingUnitTestForPeriodOrSubject: matchedUT.lesson_name に unit_name が含まれていない場合の line 2140
    const separateMaster: CurriculumMaster[] = [
      {
        id: 'cm-ut-sep',
        subject: '算数',
        grade: '小1',
        unit_name: 'たしざん',
        lesson_name: '単元確認テスト', // unit_nameが含まれていない
        item_type: 'unit_test',
        passing_line: '85%以上'
      }
    ];
    const found1 = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      unitName: 'たしざん',
      student: stdDummy,
      curriculumMasters: separateMaster
    });
    expect(found1?.content).toBe('たしざん - 単元確認テスト');
    expect(found1?.passingLine).toBe('85%以上');

    // 3. findPendingUnitTestForPeriodOrSubject: lessonIdOrName から特定し、targetUnit が lesson_name に含まれない場合の line 2166
    const lessonMasters: CurriculumMaster[] = [
      {
        id: 'cm-less-1',
        subject: '算数',
        grade: '小1',
        unit_name: 'ひきざん',
        lesson_name: 'ひきざんのけいさん',
        item_type: 'lesson'
      },
      {
        id: 'cm-ut-hiki',
        subject: '算数',
        grade: '小1',
        unit_name: 'ひきざん',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test'
      }
    ];
    const found2 = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      lessonIdOrName: 'cm-less-1',
      student: stdDummy,
      curriculumMasters: lessonMasters
    });
    expect(found2?.content).toBe('ひきざん - 単元確認テスト');

    // 4. findPendingUnitTestForPeriodOrSubject: 生徒の現在地 start_unit_math が単元テストそのもので unit_name がある/ない場合の lines 2186-2195
    const studentAtUT: Student = {
      id: 'st-ut-start',
      name: '現在地テスト生徒',
      grade: '小1',
      start_unit_math: 'cm-ut-direct'
    } as any;
    const directUTMasters: CurriculumMaster[] = [
      {
        id: 'cm-ut-direct',
        subject: '算数',
        grade: '小1',
        unit_name: 'かけざん',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test',
        passing_line: '90%以上'
      }
    ];
    const found3 = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      student: studentAtUT,
      curriculumMasters: directUTMasters
    });
    expect(found3?.content).toBe('かけざん - 単元確認テスト');
    expect(found3?.passingLine).toBe('90%以上');

    // unit_name が falsy で extractUnitTestUnitName(utContent) にフォールバックするパターン (line 2191)
    const directUTNoUnitMasters: CurriculumMaster[] = [
      {
        id: 'cm-ut-nounit',
        subject: '算数',
        grade: '小1',
        unit_name: '',
        lesson_name: 'わりざん 単元確認テスト',
        item_type: 'unit_test'
      }
    ];
    const studentAtUTNoUnit: Student = {
      id: 'st-ut-start-nounit',
      name: '現在地テスト生徒2',
      grade: '小1',
      start_unit_math: 'cm-ut-nounit'
    } as any;
    const found4 = findPendingUnitTestForPeriodOrSubject({
      subject: '算数',
      student: studentAtUTNoUnit,
      curriculumMasters: directUTNoUnitMasters
    });
    expect(found4?.unitName).toBe('わりざん');

    // 5. extractUnitTestsFromPeriodSelections: steps から unitName と content のプレフィックス結合 (line 2264)
    const periodSelectionsWithStep = {
      1: {
        period: 1,
        subject: '算数',
        startLessonName: '少数のかけ算 - 単元確認テスト',
        endLessonName: '少数のかけ算 - 単元確認テスト'
      }
    };
    const mastersForStep: CurriculumMaster[] = [
      {
        id: 'cm-step-ut',
        subject: '算数',
        grade: '小1',
        unit_name: '少数のかけ算',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test'
      }
    ];
    const extractedStep = extractUnitTestsFromPeriodSelections({
      periodSelections: periodSelectionsWithStep as any,
      periodCount: 1,
      student: stdDummy,
      curriculumMasters: mastersForStep
    });
    expect(extractedStep.length).toBeGreaterThanOrEqual(1);

    // 6. candidateName 由来で unitName と content のプレフィックス結合 (line 2299)
    const periodSelectionsCandidate = {
      1: {
        period: 1,
        subject: '算数',
        startLessonName: '角の大きさ - 単元確認テスト',
        endLessonName: '角の大きさ - 単元確認テスト'
      }
    };
    const mastersCandidate: CurriculumMaster[] = [
      {
        id: 'cm-cand-ut',
        subject: '算数',
        grade: '小1',
        unit_name: '角の大きさ',
        lesson_name: '単元確認テスト',
        item_type: 'unit_test'
      }
    ];
    const extractedCand = extractUnitTestsFromPeriodSelections({
      periodSelections: periodSelectionsCandidate as any,
      periodCount: 1,
      student: stdDummy,
      curriculumMasters: mastersCandidate
    });
    expect(extractedCand.length).toBeGreaterThanOrEqual(1);

    // 7. extractUnitTestUnitName(config.endLessonName) (line 2332)
    const periodSelectionsEndSummary = {
      1: {
        period: 1,
        subject: '算数',
        startLessonName: '分数 - 分数のたしざん(1)',
        endLessonName: '分数 - まとめテスト(1)'
      }
    };
    const mastersEndSummary: CurriculumMaster[] = [
      {
        id: 'cm-bunsu-1',
        subject: '算数',
        grade: '小1',
        unit_name: '分数',
        lesson_name: '分数のたしざん(1)',
        item_type: 'lesson'
      },
      {
        id: 'cm-bunsu-matome',
        subject: '算数',
        grade: '小1',
        unit_name: '分数',
        lesson_name: 'まとめテスト(1)',
        item_type: 'lesson'
      },
      {
        id: 'cm-bunsu-ut',
        subject: '算数',
        grade: '小1',
        unit_name: '分数',
        lesson_name: '分数 - 単元確認テスト',
        item_type: 'unit_test'
      }
    ];
    const extractedSummary = extractUnitTestsFromPeriodSelections({
      periodSelections: periodSelectionsEndSummary as any,
      periodCount: 1,
      student: stdDummy,
      curriculumMasters: mastersEndSummary
    });
    expect(extractedSummary.length).toBeGreaterThanOrEqual(1);
    expect(extractedSummary[0].unitName).toBe('分数');
  });
});
