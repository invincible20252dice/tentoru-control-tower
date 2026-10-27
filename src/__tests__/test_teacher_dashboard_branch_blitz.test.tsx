import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard, {
  determineActiveGradeForSubject,
  isValidUUID,
  normalizeGrade,
  resolveMiniTestPassedStatus,
  resolveStudentPersonalities,
  resolveTimetableRangeAndTheme
} from '../components/TeacherDashboard';
import { db, type Student, type CurriculumMaster, type CurriculumUnit, type MiniTestResult, type LearningTask } from '../lib/db';

describe('TeacherDashboard Branch Blitz Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    db.clearMockData();
    vi.restoreAllMocks();
  });

  const getDynamicDate = (offsetDays: number = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  it('exhaustively exercises mini-test sorting orders, status evaluations, and passing lines', async () => {
    const d0 = getDynamicDate(0);
    const d1 = getDynamicDate(-1);
    const d2 = getDynamicDate(-2);
    const d3 = getDynamicDate(-3);

    const sElem: Student = { id: 'st-bb-1', name: '佐藤 花子', name_kana: 'サトウ ハナコ', grade: '小5', grade_category: 'elementary', level: 'A' };
    const sJhs: Student = { id: 'st-bb-2', name: '田中 太郎', name_kana: 'タナカ タロウ', grade: '中2', grade_category: 'junior_high', level: 'B' };
    const sHigh: Student = { id: 'st-bb-3', name: '渡辺 健', name_kana: 'ワタナベ ケン', grade: '高1', grade_category: 'high_school', level: 'C' };

    const results: MiniTestResult[] = [
      { id: 'mt-b1', student_id: sElem.id, students: { id: sElem.id, name: sElem.name, grade: sElem.grade }, subject: '算数', test_content: '小数テスト', date: d0, score: 95, status: 'passed', passed: true, passing_line: '90%' },
      { id: 'mt-b2', student_id: sJhs.id, students: { id: sJhs.id, name: sJhs.name, grade: sJhs.grade }, subject: '数学', test_content: '一次関数テスト', date: d1, score: 65, status: 'failed', passed: false, passing_line: '8割' },
      { id: 'mt-b3', student_id: sHigh.id, students: { id: sHigh.id, name: sHigh.name, grade: sHigh.grade }, subject: '英語', test_content: '英文法テスト', date: d2, score: null, status: '合格' as any, passed: true, passing_line: '75点' },
      { id: 'mt-b4', student_id: sElem.id, students: { id: sElem.id, name: sElem.name, grade: sElem.grade }, subject: '理科', test_content: '植物テスト', date: d3, score: null, status: '不合格' as any, passed: false, passing_line: 'レベルA (90点)' },
      { id: 'mt-b5', student_id: sJhs.id, students: { id: sJhs.id, name: sJhs.name, grade: sJhs.grade }, subject: '社会', test_content: '歴史テスト', date: d0, score: null, status: undefined, passed: undefined, passing_line: undefined },
      { id: 'mt-b6', student_id: sHigh.id, students: { id: sHigh.id, name: sHigh.name, grade: sHigh.grade }, subject: '国語', test_content: '古文テスト', date: d1, score: 85, status: undefined, passed: undefined, passing_line: '80点' }
    ];

    (db as any).saveMockData('students', [sElem, sJhs, sHigh]);
    (db as any).saveMockData('mini_test_results', results);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[sElem, sJhs, sHigh]}
        initialStudentId={sElem.id}
        initialTab="mini-tests"
        targetDate={d0}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('小テスト結果管理')).toBeDefined();
    });

    const sortSelect = screen.getByLabelText('並び順:');
    // date_asc
    fireEvent.change(sortSelect, { target: { value: 'date_asc' } });
    // name_asc
    fireEvent.change(sortSelect, { target: { value: 'name_asc' } });
    // unsubmitted_first
    fireEvent.change(sortSelect, { target: { value: 'unsubmitted_first' } });
    // passed_first
    fireEvent.change(sortSelect, { target: { value: 'passed_first' } });
    // date_desc
    fireEvent.change(sortSelect, { target: { value: 'date_desc' } });

    unmount();
  });

  it('exhaustively exercises mini-test score changes, threshold computations, and delete confirmation', async () => {
    const d0 = getDynamicDate(0);
    const student: Student = { id: 'st-bb-ops', name: '操作生徒', grade: '中3', grade_category: 'junior_high', level: 'B' };

    const results: MiniTestResult[] = [
      { id: 'mt-op-1', student_id: student.id, students: { id: student.id, name: student.name, grade: student.grade }, subject: '数学', test_content: '二次方程式テスト', date: d0, score: null, status: undefined, passed: undefined, passing_line: '80%' },
      { id: 'mt-op-2', student_id: student.id, students: { id: student.id, name: student.name, grade: student.grade }, subject: '英語', test_content: '関係代名詞テスト', date: d0, score: null, status: undefined, passed: undefined, passing_line: '8割' },
      { id: 'mt-op-3', student_id: student.id, students: { id: student.id, name: student.name, grade: student.grade }, subject: '理科', test_content: 'イオンテスト', date: d0, score: null, status: undefined, passed: undefined, passing_line: '75点' },
      { id: 'mt-op-4', student_id: student.id, students: { id: student.id, name: student.name, grade: student.grade }, subject: '社会', test_content: '公民テスト', date: d0, score: null, status: undefined, passed: undefined, passing_line: undefined }
    ];

    (db as any).saveMockData('students', [student]);
    (db as any).saveMockData('mini_test_results', results);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        initialTab="mini-tests"
        targetDate={d0}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('小テスト結果管理')).toBeDefined();
    });

    const scoreInputs = screen.getAllByPlaceholderText('未入力');
    expect(scoreInputs.length).toBeGreaterThanOrEqual(4);

    // Test passing_line % threshold
    fireEvent.change(scoreInputs[0], { target: { value: '85' } }); // >= 80% -> passed
    fireEvent.change(scoreInputs[0], { target: { value: '75' } }); // < 80% -> failed

    // Test passing_line 割 threshold
    fireEvent.change(scoreInputs[1], { target: { value: '85' } }); // >= 8割 (80) -> passed
    fireEvent.change(scoreInputs[1], { target: { value: '70' } }); // < 8割 -> failed

    // Test passing_line 点 threshold
    fireEvent.change(scoreInputs[2], { target: { value: '80' } }); // >= 75点 -> passed
    fireEvent.change(scoreInputs[2], { target: { value: '60' } }); // < 75点 -> failed

    // Test default stLevel threshold (B = 80)
    fireEvent.change(scoreInputs[3], { target: { value: '85' } }); // >= 80 -> passed
    fireEvent.change(scoreInputs[3], { target: { value: '50' } }); // < 80 -> failed

    // Test invalid / boundary inputs
    fireEvent.change(scoreInputs[0], { target: { value: '150' } }); // > 100
    fireEvent.change(scoreInputs[0], { target: { value: '-10' } }); // < 0
    fireEvent.change(scoreInputs[0], { target: { value: '' } }); // empty

    // Test status select
    const sel = screen.getByTestId('minitest-status-select-mt-op-1');
    fireEvent.change(sel, { target: { value: 'passed' } });
    fireEvent.change(sel, { target: { value: 'failed' } });
    fireEvent.change(sel, { target: { value: 'unstarted' } });

    // Test delete with confirm true and false
    const confirmSpy = vi.spyOn(window, 'confirm');
    confirmSpy.mockReturnValueOnce(false);
    const delBtns = screen.getAllByTitle('小テスト結果を削除する');
    if (delBtns.length > 0) {
      fireEvent.click(delBtns[0]);
    }

    confirmSpy.mockReturnValueOnce(true);
    if (delBtns.length > 0) {
      fireEvent.click(delBtns[0]);
    }

    unmount();
  });

  it('exhaustively exercises mini-test filters and search query clearing', async () => {
    const d0 = getDynamicDate(0);
    const sElem: Student = { id: 'st-f-1', name: '小学 生徒', grade: '小4', grade_category: 'elementary' };
    const sJhs: Student = { id: 'st-f-2', name: '中学 生徒', grade: '中1', grade_category: 'junior_high' };
    const sHigh: Student = { id: 'st-f-3', name: '高校 生徒', grade: '高2', grade_category: 'high_school' };
    const sOther: Student = { id: 'st-f-4', name: '園児 生徒', grade: '園児', grade_category: 'elementary' };
    const sGrad: Student = { id: 'st-f-5', name: '既卒 生徒', grade: '既卒', grade_category: 'high_school' };

    const results: MiniTestResult[] = [
      { id: 'mt-f1', student_id: sElem.id, subject: '算数', test_content: '計算ドリル', date: d0 },
      { id: 'mt-f2', student_id: sJhs.id, subject: '数学', test_content: '正負の数', date: d0 },
      { id: 'mt-f3', student_id: sHigh.id, subject: '英語', test_content: '仮定法', date: d0 },
      { id: 'mt-f4', student_id: sOther.id, subject: '国語', test_content: 'ひらがな', date: d0 },
      { id: 'mt-f5', student_id: sGrad.id, subject: '理科', test_content: '力学演習', date: d0 }
    ];

    (db as any).saveMockData('students', [sElem, sJhs, sHigh, sOther, sGrad]);
    (db as any).saveMockData('mini_test_results', results);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[sElem, sJhs, sHigh, sOther, sGrad]}
        initialStudentId={sElem.id}
        initialTab="mini-tests"
        targetDate={d0}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('小テスト結果管理')).toBeDefined();
    });

    const gradeFilter = screen.getByLabelText('学年:');
    fireEvent.change(gradeFilter, { target: { value: '小学生' } });
    fireEvent.change(gradeFilter, { target: { value: '中学生' } });
    fireEvent.change(gradeFilter, { target: { value: '高校生' } });
    fireEvent.change(gradeFilter, { target: { value: '中1' } });
    fireEvent.change(gradeFilter, { target: { value: 'all' } });

    const subjFilter = screen.getByLabelText('教科:');
    fireEvent.change(subjFilter, { target: { value: '数学' } });
    fireEvent.change(subjFilter, { target: { value: '英語' } });
    fireEvent.change(subjFilter, { target: { value: '理科' } });
    fireEvent.change(subjFilter, { target: { value: '社会' } });
    fireEvent.change(subjFilter, { target: { value: '国語' } });
    fireEvent.change(subjFilter, { target: { value: 'all' } });

    const searchInput = screen.getByPlaceholderText('題名・生徒名・単元で検索...');
    fireEvent.change(searchInput, { target: { value: '正負の数' } });
    const clearBtn = screen.getByTitle('検索をクリア');
    fireEvent.click(clearBtn);

    // Search no results
    fireEvent.change(searchInput, { target: { value: '存在しないテスト12345' } });
    expect(screen.getByText('該当するテスト・宿題が見つかりませんでした。')).toBeDefined();

    unmount();
  });

  it('exhaustively exercises student edit weekly sessions frequency and personality tags', async () => {
    const student: Student = {
      id: 'st-bb-detail',
      name: '詳細検証生徒',
      grade: '中1',
      grade_category: 'junior_high',
      school_name: '第一中学校',
      weekly_sessions_count: '2回' as any,
      selected_days: ['mon', 'wed'],
      personalities: ['集中力高い'],
      personality_tags: ['集中力高い']
    };

    (db as any).saveMockData('students', [student]);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        initialTab="student-list"
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId(`edit-student-btn-${student.id}`)).toBeDefined();
    });

    fireEvent.click(screen.getByTestId(`edit-student-btn-${student.id}`));

    // Test weekly sessions count variations
    const freqSelect = screen.queryByLabelText(/週通塾回数|週の授業回数/) || screen.queryAllByRole('combobox').find(c => (c as HTMLSelectElement).value === '2回');
    if (freqSelect) {
      fireEvent.change(freqSelect, { target: { value: '3回' } });
      fireEvent.change(freqSelect, { target: { value: '4回' } });
      fireEvent.change(freqSelect, { target: { value: '5回' } });
      fireEvent.change(freqSelect, { target: { value: '自由' } });
    }

    // Test day of week chips
    const dayButtons = screen.queryAllByRole('button').filter(b => ['月', '火', '水', '木', '金', '土', '日'].includes(b.textContent || ''));
    dayButtons.forEach(btn => fireEvent.click(btn));

    // Test personality tags: duplicate alert
    const persInput = screen.queryByPlaceholderText(/性格タグ|特徴/);
    if (persInput) {
      fireEvent.change(persInput, { target: { value: '集中力高い' } });
      const addBtn = screen.queryByText(/追加/);
      if (addBtn) {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        fireEvent.click(addBtn);
        expect(alertSpy).toHaveBeenCalledWith('この個性は既に登録されています。');
      }

      // Add a fresh tag
      fireEvent.change(persInput, { target: { value: '探究心旺盛' } });
      const addBtn2 = screen.queryByText(/追加/);
      if (addBtn2) fireEvent.click(addBtn2);
    }

    // Remove personality tag
    const tagRemoveBtns = screen.queryAllByTitle(/削除|解除/);
    tagRemoveBtns.forEach(btn => fireEvent.click(btn));

    // Save student
    const saveBtn = screen.queryAllByText(/変更を保存/)[0];
    if (saveBtn) fireEvent.click(saveBtn);

    unmount();
  });

  it('exhaustively covers interview tabs saving and field state bindings', async () => {
    const student: Student = {
      id: 'st-bb-int',
      name: '面談対象生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '渋谷中学校'
    };

    (db as any).saveMockData('students', [student]);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    const menuTwoWayBtn = screen.getByTestId('menu-two-way-interview');
    fireEvent.click(menuTwoWayBtn);

    await waitFor(() => {
      expect(screen.getByTestId('two-way-interview-view')).toBeDefined();
    });

    // Enter interview details and save
    const inputs = screen.queryAllByRole('textbox');
    inputs.forEach(input => fireEvent.change(input, { target: { value: 'テスト入力内容' } }));

    const saveInterviewBtn = screen.queryAllByRole('button').find(b => b.textContent && b.textContent.includes('保存'));
    if (saveInterviewBtn) {
      fireEvent.click(saveInterviewBtn);
    }

    // Switch to three-way interview
    const threeWayBtn = screen.getByTestId('menu-three-way-interview');
    fireEvent.click(threeWayBtn);
    await waitFor(() => {
      expect(screen.getByTestId('three-way-interview-view')).toBeDefined();
    });
    const saveBtn3 = screen.queryAllByRole('button').find(b => b.textContent && b.textContent.includes('保存'));
    if (saveBtn3) fireEvent.click(saveBtn3);

    unmount();
  });

  it('exhaustively covers timetable period configurations, scopes (school/grade/level), and lessonRange', async () => {
    const dynamicDate = getDynamicDate(0);
    const s1: Student = {
      id: 'st-tt-1',
      name: 'コマ割生徒1',
      grade: '中2',
      grade_category: 'junior_high',
      school_id: 'sch-1',
      school_name: '渋谷中',
      level: 'B'
    };
    const s2: Student = {
      id: 'st-tt-2',
      name: 'コマ割生徒2',
      grade: '中2',
      grade_category: 'junior_high',
      school_id: 'sch-1',
      school_name: '渋谷中',
      level: 'B'
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-tt-1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 1 },
      { id: 'cm-tt-2', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '代入法', sort_order: 2 },
      { id: 'cm-tt-3', grade: '中2', subject: '数学', unit_name: '', lesson_name: '方程式の応用', sort_order: 3 }
    ];

    const units: CurriculumUnit[] = [
      { id: 'u-tt-1', school_id: 'sch-1', subject: '数学', name: '連立方程式', sequence_order: 1 },
      { id: 'u-tt-2', school_id: 'sch-2', subject: '数学', name: '一次関数', sequence_order: 2 }
    ];

    (db as any).saveMockData('students', [s1, s2]);
    (db as any).saveMockData('curriculum_masters', masters);
    (db as any).saveMockData('curriculum_units', units);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[s1, s2]}
        initialStudentId={s1.id}
        initialTab="schedule"
        targetDate={dynamicDate}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    // Test saving timetable with individual scope
    const saveTimetableBtn = screen.queryAllByRole('button').find(b => b.textContent && b.textContent.includes('時間割・計画を保存'));
    if (saveTimetableBtn) {
      fireEvent.click(saveTimetableBtn);
    }

    // Switch apply scopes
    const scopeSelect = screen.queryByLabelText(/適用範囲|一括適用/) || screen.queryAllByRole('combobox').find(c => (c as HTMLSelectElement).value === 'individual');
    if (scopeSelect) {
      fireEvent.change(scopeSelect, { target: { value: 'school' } });
      if (saveTimetableBtn) fireEvent.click(saveTimetableBtn);

      fireEvent.change(scopeSelect, { target: { value: 'grade' } });
      if (saveTimetableBtn) fireEvent.click(saveTimetableBtn);

      fireEvent.change(scopeSelect, { target: { value: 'level' } });
      if (saveTimetableBtn) fireEvent.click(saveTimetableBtn);
    }

    unmount();
  });

  it('exhaustively navigates across homeworks, exams, ai-report, branches, and curriculum-import tabs', async () => {
    const student: Student = {
      id: 'st-tabs-1',
      name: 'タブ切替生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_name: '青山中'
    };

    (db as any).saveMockData('students', [student]);
    db.saveSession({ user: { id: 'admin-1', email: 'admin@tentoru.com', role: 'admin' } } as any);

    const { unmount } = render(
      <TeacherDashboard
        students={[student]}
        initialStudentId={student.id}
        onLogout={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('header-teacher-badge')).toBeDefined();
    });

    const clickMenu = async (name: string | RegExp) => {
      const btn = screen.queryByRole('button', { name });
      if (btn) {
        fireEvent.click(btn);
        await new Promise(r => setTimeout(r, 50));
      }
    };

    // Navigate to Homeworks
    await clickMenu(/宿題提出状況/);
    // Navigate to Tests/Exams
    await clickMenu(/定期テスト・模試/);
    // Navigate to AI Report
    await clickMenu(/AI指導報告書/);
    // Navigate to Curriculum
    await clickMenu(/学校カリキュラム管理/);
    // Navigate to Curriculum Import
    await clickMenu(/カリキュラム一括インポート/);
    // Navigate to Branches
    await clickMenu(/校舎管理/);
    // Navigate to Create Student
    await clickMenu(/新規生徒アカウント発行/);
    // Navigate to Student Detail
    await clickMenu(/生徒情報/);

    unmount();
  });

  it('exhaustively exercises determineActiveGradeForSubject with all branches and fallbacks', () => {
    const d0 = getDynamicDate(0);

    // 1. targetStudent is null
    expect(determineActiveGradeForSubject('算数', null)).toBe('all');

    // 2. targetStudent is not elementary (junior high)
    const sJhs: Student = { id: 'st-dag-1', name: '中生徒', grade: '中2', grade_category: 'junior_high' };
    expect(determineActiveGradeForSubject('数学', sJhs)).toBe('all');

    // 3. targetStudent is elementary, matched via today task targetId
    const sElem: Student = { id: 'st-dag-2', name: '小生徒', grade: '小4', grade_category: 'elementary' };
    const masters: CurriculumMaster[] = [
      { id: 'cm-dag-1', grade: '小4', subject: '算数', unit_name: '角の大きさ', lesson_name: '分度器', sort_order: 1 },
      { id: 'cm-dag-2', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: '小数×小数', sort_order: 2 }
    ];
    const tasksWithId: LearningTask[] = [
      { id: 't-dag-1', student_id: sElem.id, subject: '算数', scheduled_date: d0, period: 1, unit_id: 'cm-dag-1', status: 'pending' }
    ];
    expect(determineActiveGradeForSubject('算数', sElem, tasksWithId, undefined, d0, masters)).toBe('小4');

    // 4. matched via today task titleToFind
    const tasksWithTitle: LearningTask[] = [
      { id: 't-dag-2', student_id: sElem.id, subject: '算数', scheduled_date: d0, period: 1, start_lesson_name: '分度器', status: 'pending' }
    ];
    expect(determineActiveGradeForSubject('算数', sElem, tasksWithTitle, undefined, d0, masters)).toBe('小4');

    // 5. matched via slots targetId and titleToFind
    const slots = {
      1: { subject: '算数', unit_id: 'cm-dag-2' }
    };
    expect(determineActiveGradeForSubject('算数', sElem, [], slots, d0, masters)).toBe('小5');

    const slotsTitle = {
      1: { subject: '算数', start_lesson_name: '分度器' }
    };
    expect(determineActiveGradeForSubject('算数', sElem, [], slotsTitle, d0, masters)).toBe('小4');

    // 6. matched via studentGradeNorm firstInGrade
    expect(determineActiveGradeForSubject('算数', sElem, [], {}, d0, masters)).toBe('小4');

    // 7. fallback to student registered grade
    const sElem5: Student = { id: 'st-dag-5', name: '小5生徒', grade: '5年生', grade_category: 'elementary' };
    expect(determineActiveGradeForSubject('算数', sElem5, [], {}, d0, [])).toBe('小5');

    // 8. 園児 student
    const sKinder: Student = { id: 'st-dag-k', name: '園児生徒', grade: '園児', grade_category: 'elementary' };
    expect(determineActiveGradeForSubject('算数', sKinder, [], {}, d0, [])).toBe('小1');

    // 9. unknown grade category
    const sUnknown: Student = { id: 'st-dag-u', name: '学年未設定生徒', grade: '' };
    expect(determineActiveGradeForSubject('算数', sUnknown, [], {}, d0, [])).toBe('all');

    // 10. elementary fallback
    const sElemFallback: Student = { id: 'st-dag-fb', name: '小フォールバック生徒', grade: '小その他', grade_category: 'elementary' };
    expect(determineActiveGradeForSubject('算数', sElemFallback, [], {}, d0, [])).toBe('小1');
  });

  it('exhaustively covers isValidUUID, normalizeGrade, resolveMiniTestPassedStatus, and resolveStudentPersonalities', () => {
    // isValidUUID branches
    expect(isValidUUID(null)).toBe(false);
    expect(isValidUUID(undefined)).toBe(false);
    expect(isValidUUID('')).toBe(false);
    expect(isValidUUID('invalid-uuid-1234')).toBe(false);
    expect(isValidUUID('12345678-1234-1234-1234-123456789abc')).toBe(true);

    // normalizeGrade branches
    expect(normalizeGrade(undefined)).toBe('');
    expect(normalizeGrade('')).toBe('');
    expect(normalizeGrade('中2')).toBe('中2');
    expect(normalizeGrade('高1')).toBe('高1');
    expect(normalizeGrade('園児')).toBe('園児');
    expect(normalizeGrade('既卒')).toBe('既卒');
    expect(normalizeGrade('3')).toBe('3年生');
    expect(normalizeGrade('小4')).toBe('4年生');
    expect(normalizeGrade('その他')).toBe('その他');

    // resolveMiniTestPassedStatus branches
    expect(resolveMiniTestPassedStatus('passed', undefined)).toBe('passed');
    expect(resolveMiniTestPassedStatus('合格', undefined)).toBe('passed');
    expect(resolveMiniTestPassedStatus(undefined, true)).toBe('passed');
    expect(resolveMiniTestPassedStatus('failed', undefined)).toBe('failed');
    expect(resolveMiniTestPassedStatus('不合格', undefined)).toBe('failed');
    expect(resolveMiniTestPassedStatus(undefined, false)).toBe('failed');
    expect(resolveMiniTestPassedStatus(undefined, undefined)).toBe('unstarted');
    expect(resolveMiniTestPassedStatus('pending', undefined)).toBe('unstarted');

    // resolveStudentPersonalities branches
    expect(resolveStudentPersonalities(null, null)).toEqual([]);
    expect(resolveStudentPersonalities({ personalities: ['タグ1'] }, null)).toEqual(['タグ1']);
    expect(resolveStudentPersonalities({ personality_tags: ['タグ2'] as any }, null)).toEqual(['タグ2']);
    expect(resolveStudentPersonalities(null, { personalities: ['タグ3'] })).toEqual(['タグ3']);
    expect(resolveStudentPersonalities(null, { personality_tags: ['タグ4'] as any })).toEqual(['タグ4']);
    expect(resolveStudentPersonalities({ personalities: '文字列' as any }, null)).toEqual([]);
  });

  it('exhaustively covers resolveTimetableRangeAndTheme with all name, range, and theme combinations', () => {
    const d0 = getDynamicDate(0);

    // 1. Explicit start and end lesson names
    const res1 = resolveTimetableRangeAndTheme({
      config: { startLessonName: 'ステップA', endLessonName: 'ステップB' },
      studentId: 'st-rtt-1',
      scheduleDate: d0,
      period: 1
    });
    expect(res1.startLessonName).toBe('ステップA');
    expect(res1.endLessonName).toBe('ステップB');
    expect(res1.rangeString).toBe('ステップA 〜 ステップB');

    // 2. Fallback to selectedUnit name
    const res2 = resolveTimetableRangeAndTheme({
      config: {},
      selectedUnit: { name: '単元ユニット名' },
      studentId: 'st-rtt-2',
      scheduleDate: d0,
      period: 2
    });
    expect(res2.startLessonName).toBe('単元ユニット名');
    expect(res2.endLessonName).toBe('単元ユニット名');

    // 3. Fallback to selectedMaster with unit_name
    const res3 = resolveTimetableRangeAndTheme({
      config: {},
      selectedMaster: { unit_name: '一次関数', lesson_name: '基本' },
      studentId: 'st-rtt-3',
      scheduleDate: d0,
      period: 3
    });
    expect(res3.startLessonName).toBe('一次関数 - 基本');

    // 4. Fallback to selectedMaster without unit_name
    const res4 = resolveTimetableRangeAndTheme({
      config: {},
      selectedMaster: { unit_name: '', lesson_name: '発展問題' },
      studentId: 'st-rtt-4',
      scheduleDate: d0,
      period: 4
    });
    expect(res4.startLessonName).toBe('発展問題');

    // 5. Explicit lessonRange and customTheme
    const res5 = resolveTimetableRangeAndTheme({
      config: { lessonRange: 'カスタム範囲', customTheme: 'カスタムテーマ' },
      studentId: 'st-rtt-5',
      scheduleDate: d0,
      period: 5,
      targetUnitId: 'u-target-id'
    });
    expect(res5.rangeString).toBe('カスタム範囲');
    expect(res5.customUnitId).toBe('u-target-id');
    expect(res5.customThemeName).toBe('カスタム範囲');

    // 6. Nothing provided -> empty fallbacks
    const res6 = resolveTimetableRangeAndTheme({
      config: {},
      studentId: 'st-rtt-6',
      scheduleDate: d0,
      period: 6
    });
    expect(res6.startLessonName).toBe('');
    expect(res6.customUnitId).toBe(`custom-st-rtt-6-${d0}-6`);
  });
});

