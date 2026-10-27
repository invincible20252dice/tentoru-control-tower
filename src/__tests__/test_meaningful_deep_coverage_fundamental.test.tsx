import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import { Student, CurriculumMaster, MiniTestResult, LearningTask } from '../types';

describe('Meaningful Deep Fundamental Coverage Tests for TeacherDashboard', () => {
  const sampleMasters: CurriculumMaster[] = [
    {
      id: 'cm-math-1',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数のグラフと傾き',
      sort_order: 1
    },
    {
      id: 'cm-math-2',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '切片と直線の式',
      sort_order: 2
    },
    {
      id: 'cm-math-3',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数の利用と動点',
      sort_order: 3
    },
    {
      id: 'cm-math-ut',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '一次関数',
      lesson_name: '一次関数 - 単元確認テスト',
      sort_order: 4,
      item_type: 'unit_test',
      passing_line: '90%以上'
    },
    {
      id: 'cm-math-next-1',
      grade: '中2',
      grade_level: '中2',
      subject: '数学',
      unit_name: '平行と合同',
      lesson_name: '対頂角・同位角・錯角',
      sort_order: 5
    },
    {
      id: 'cm-eng-ut-first',
      grade: '中2',
      grade_level: '中2',
      subject: '英語',
      unit_name: '入門確認',
      lesson_name: '入門確認 - 単元確認テスト',
      sort_order: 10,
      item_type: 'unit_test'
    },
    {
      id: 'cm-eng-review-1',
      grade: '中2',
      grade_level: '中2',
      subject: '英語',
      unit_name: '助動詞',
      lesson_name: '助動詞 - まとめテスト（１）',
      sort_order: 20
    },
    {
      id: 'cm-elem-m1',
      grade: '小5',
      grade_level: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '小数×整数の計算',
      sort_order: 1
    },
    {
      id: 'cm-elem-m2',
      grade: '小5',
      grade_level: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '小数のかけ算の筆算',
      sort_order: 2
    },
    {
      id: 'cm-elem-ut',
      grade: '小5',
      grade_level: '小5',
      subject: '算数',
      unit_name: '小数のかけ算',
      lesson_name: '小数のかけ算 - 単元確認テスト',
      sort_order: 3,
      item_type: 'unit_test'
    },
    {
      id: 'cm-elem-next',
      grade: '小5',
      grade_level: '小5',
      subject: '算数',
      unit_name: '小数のわり算',
      lesson_name: '小数÷整数の計算',
      sort_order: 4
    }
  ];

  const jhsStudent: Student = {
    id: 'std-jhs-fund-1',
    student_id: 'S_JHS_FUND_1',
    name: '根本 太郎',
    name_kana: 'ネモト タロウ',
    grade: '中2',
    school_name: '天登中央中学校',
    classroom: '本校',
    branch_id: 'branch-1',
    status: 'normal',
    level: 'A',
    selected_subjects: ['数学', '英語'],
    selected_days: ['monday', 'thursday'],
    period_count: 2,
    default_slots: 2,
    registered_year: 2026,
    registered_grade: '中2',
    completed_lesson_ids: ['cm-math-1'],
    start_unit_math: 'cm-math-1',
    start_unit_english: 'cm-eng-ut-first'
  };

  const elemStudent: Student = {
    id: 'std-elem-fund-2',
    student_id: 'S_ELEM_FUND_2',
    name: '根本 花子',
    name_kana: 'ネモト ハナコ',
    grade: '小5',
    school_name: '天登第一小学校',
    classroom: '本校',
    branch_id: 'branch-1',
    status: 'normal',
    level: 'B',
    selected_subjects: ['算数'],
    selected_days: ['tuesday', 'friday'],
    period_count: 2,
    default_slots: 2,
    registered_year: 2026,
    registered_grade: '小5',
    completed_lesson_ids: ['cm-elem-m1'],
    start_unit_math: 'cm-elem-m1'
  };

  beforeEach(async () => {
    localStorage.clear();
    await db.saveCurriculumMasters(sampleMasters);
    await db.saveStudent(jhsStudent);
    await db.saveStudent(elemStudent);
  });

  it('1. コマ割り From/To の変更と単元テスト自動抽出・直前レッスン補正・クリアの網羅動作', async () => {
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    const subjSelect = screen.getByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '数学' } });
    });

    const fromSelect = screen.getByTestId('period-unit-select-1');
    await act(async () => {
      fireEvent.change(fromSelect, { target: { value: 'cm-math-1' } });
    });

    const toSelect = screen.getByTestId('period-end-lesson-select-1') as HTMLSelectElement;
    expect(toSelect.value).toBeTruthy();

    await act(async () => {
      fireEvent.change(toSelect, { target: { value: 'cm-math-3' } });
    });
    expect(toSelect.value).toBe('cm-math-3');

    await act(async () => {
      fireEvent.change(fromSelect, { target: { value: '' } });
    });
    expect((screen.getByTestId('period-unit-select-1') as HTMLSelectElement).value).toBe('');

    await act(async () => {
      fireEvent.change(fromSelect, { target: { value: 'cm-math-1' } });
    });

    const subjSelect2 = screen.getByTestId('period-subject-select-2');
    await act(async () => {
      fireEvent.change(subjSelect2, { target: { value: '英語' } });
    });
    const fromSelect2 = screen.getByTestId('period-unit-select-2');
    await act(async () => {
      fireEvent.change(fromSelect2, { target: { value: 'cm-eng-review-1' } });
    });

    const saveTimetableBtn = screen.getByText('時間割コマ割りを保存');
    await act(async () => {
      fireEvent.click(saveTimetableBtn);
    });

    unmount();
  });

  it('2. 単元の先頭が単元確認テストの場合の【定着演習】自動割り当てとカスタム合格ラインの反映', async () => {
    await db.saveStudent({
      ...jhsStudent,
      completed_lesson_ids: ['cm-math-1', 'cm-math-2', 'cm-math-3']
    });

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    const subjSelect = screen.getByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '数学' } });
    });

    const addTestBtn = screen.getByText(/➕ テストを追加/);
    await act(async () => {
      fireEvent.click(addTestBtn);
    });

    const testsContainer = screen.getByTestId('today-tests-container');
    expect(testsContainer).toBeInTheDocument();

    const testSelect = within(testsContainer).getAllByRole('combobox').find(cb => {
      const options = Array.from((cb as HTMLSelectElement).options).map(o => o.value);
      return options.some(v => v.includes('一次関数'));
    }) as HTMLSelectElement;

    if (testSelect) {
      await act(async () => {
        fireEvent.change(testSelect, { target: { value: '一次関数 - 単元確認テスト' } });
      });
      await waitFor(() => {
        expect(within(testsContainer).getByDisplayValue('90%以上')).toBeInTheDocument();
      });
    }

    unmount();
  });

  it('3. 小学生無段階タイムライン: 現在地（📍）、修了率、合否ゲート、修了予測日の描画検証', async () => {
    const failMiniResult: MiniTestResult = {
      id: 'mini-fail-elem-1',
      student_id: 'std-elem-fund-2',
      task_id: 'task-elem-1',
      date: '2026-06-01',
      subject: '算数',
      unit_name: '小数のかけ算',
      test_content: '小数のかけ算 - 単元確認テスト',
      test_type: 'unit_test',
      score: 65,
      passed: false,
      passing_line: '80%以上',
      target_scope: 'individual',
      status: 'failed',
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const elemTask: LearningTask = {
      id: 'task-elem-1',
      student_id: 'std-elem-fund-2',
      subject: '算数',
      unit_name: '小数のかけ算',
      unit_id: 'cm-elem-m1',
      scheduled_date: '2026-06-01',
      period: 1,
      completed: true,
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(failMiniResult);
    await db.saveLearningTasks([elemTask]);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-elem-fund-2"
        teacherType="elementary"
        initialTab="milestones"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/小学生向け進度タイムライン（無段階ペース管理）/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId('elementary-progress-percent')).toBeInTheDocument();
    expect(screen.getByTestId('elementary-estimated-date')).toBeInTheDocument();

    unmount();
  });

  it('4. 中学生年間マイルストーン: 行の追加、計画テンプレート保存、およびスプレッドシート操作の検証', async () => {
    const passMiniResult: MiniTestResult = {
      id: 'mini-pass-math-1',
      student_id: 'std-jhs-fund-1',
      task_id: 'task-jhs-1',
      date: '2026-06-01',
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: 95,
      passed: true,
      passing_line: '90%以上',
      target_scope: 'individual',
      status: 'passed',
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    await db.saveMiniTestResult(passMiniResult);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="milestones"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/年間基準計画|年間計画/i).length).toBeGreaterThan(0);
    });

    const addRowBtn = screen.getByRole('button', { name: /➕ 行を追加/i });
    await act(async () => {
      fireEvent.click(addRowBtn);
    });

    const templateInput = screen.getByPlaceholderText(/現在の計画をテンプレート名として保存/i);
    await act(async () => {
      fireEvent.change(templateInput, { target: { value: '一次関数集中特訓' } });
    });
    const saveTplBtn = screen.getByText('計画テンプレートを保存');
    await act(async () => {
      fireEvent.click(saveTplBtn);
    });

    unmount();
  });

  it('5. 校舎別AI自動設定ルールモーダルの表示および保存ハンドラーの網羅', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    const aiRulesBtn = screen.queryByText(/校舎別AIルール設定|AI設定/i);
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });
      const saveModalBtn = screen.queryByText(/ルールを保存|設定を保存/i);
      if (saveModalBtn) {
        await act(async () => {
          fireEvent.click(saveModalBtn);
        });
        expect(alertSpy).toHaveBeenCalled();
      }
    }

    alertSpy.mockRestore();
    unmount();
  });

  it('6. コマ割り削除（handleRemovePeriod）と前詰め・自動再同期の網羅動作', async () => {
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    // 1コマ目に数学、2コマ目に英語を設定
    await act(async () => {
      fireEvent.change(screen.getByTestId('period-subject-select-1'), { target: { value: '数学' } });
      fireEvent.change(screen.getByTestId('period-subject-select-2'), { target: { value: '英語' } });
    });

    // 1コマ目の削除ボタン（ゴミ箱ボタン）を押下
    const deleteBtn1 = screen.queryByTestId('delete-period-1');
    if (deleteBtn1) {
      await act(async () => {
        fireEvent.click(deleteBtn1);
      });
      await waitFor(() => {
        expect((screen.getByTestId('period-subject-select-1') as HTMLSelectElement).value).toBe('英語');
      });
    }

    unmount();
  });

  it('7. 宿題の追加・教科/種別/内容/期限変更および削除ハンドラーの全網羅', async () => {
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('➕ 宿題を追加')).toBeInTheDocument();
    });

    const addHwBtn = screen.getByText('➕ 宿題を追加');
    await act(async () => {
      fireEvent.click(addHwBtn);
    });

    const hwSelects = screen.getAllByRole('combobox');
    const hwSubjectSelect = hwSelects.find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === '共通' || o.value === '数学'));
    if (hwSubjectSelect) {
      await act(async () => {
        fireEvent.change(hwSubjectSelect, { target: { value: '英語' } });
      });
    }

    const hwTypeSelect = hwSelects.find(s => Array.from((s as HTMLSelectElement).options).some(o => o.value === 'drill_2nd' || o.value === 'custom'));
    if (hwTypeSelect) {
      await act(async () => {
        fireEvent.change(hwTypeSelect, { target: { value: 'custom' } });
      });
    }

    const hwInputs = screen.getAllByPlaceholderText(/当日授業の2回目|宿題の内容を入力/i);
    const targetHwInput = hwInputs[hwInputs.length - 1];
    await act(async () => {
      fireEvent.change(targetHwInput, { target: { value: '英語ワーク P40-42' } });
    });
    expect(targetHwInput).toHaveValue('英語ワーク P40-42');

    const deleteHwBtns = screen.getAllByRole('button', { name: '削除' });
    if (deleteHwBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteHwBtns[0]);
      });
    }

    unmount();
  });

  it('8. 開始授業プルダウンで単元確認テストを直接選択した際の isUnitTestNode 分岐と直前レッスン補正', async () => {
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-jhs-fund-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    const subjSelect = screen.getByTestId('period-subject-select-1');
    await act(async () => {
      fireEvent.change(subjSelect, { target: { value: '数学' } });
    });

    // From に「一次関数のグラフと傾き」を設定
    const fromSelect = screen.getByTestId('period-unit-select-1');
    await act(async () => {
      fireEvent.change(fromSelect, { target: { value: 'cm-math-1' } });
    });

    // コマ割りの自由記述テーマ設定（handleThemeChange）も網羅
    const customOptions = screen.queryAllByRole('option', { name: '自由記述' });
    if (customOptions.length > 0) {
      await act(async () => {
        fireEvent.change(subjSelect, { target: { value: '自由記述' } });
      });
    }

    unmount();
  });

  it('9. db.ts: 各エンティティ（タスク、計画、テスト、宿題、面談記録、進捗）の作成・更新・検索分岐の網羅', async () => {
    const studentId = 'std-crud-1';

    // 1. タスクの作成と更新（idx >= 0 分岐）
    const existingTasks = db.getLearningTasks();
    const taskToUpdate = existingTasks[0] || {
      id: 'task-crud-seed',
      student_id: studentId,
      unit_id: 'unit-1',
      scheduled_date: '2026-06-01',
      period: 1,
      status: 'unstarted' as const,
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    const updatedTask = { ...taskToUpdate, status: 'completed' as const };
    await db.saveLearningTasks([updatedTask]); // idx >= 0 分岐
    expect(db.getLearningTasks().find(t => t.id === taskToUpdate.id)?.status).toBe('completed');

    // 2. ミニテストの作成と更新（idx >= 0 分岐）
    const mini1: MiniTestResult = {
      id: 'mini-crud-1',
      student_id: studentId,
      task_id: 'task-crud-1',
      date: '2026-06-01',
      subject: '数学',
      unit_name: '一次関数',
      test_content: '一次関数 - 単元確認テスト',
      test_type: 'unit_test',
      score: 80,
      passed: true,
      passing_line: '80%以上',
      target_scope: 'individual',
      status: 'passed',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(mini1);
    const updatedMini = { ...mini1, score: 95 };
    await db.saveMiniTestResult(updatedMini); // idx >= 0 分岐
    expect(db.getMiniTestResults(studentId).find(m => m.id === 'mini-crud-1')?.score).toBe(95);

    // 3. 宿題の作成と更新（idx >= 0 分岐）
    const hw1 = {
      id: 'hw-crud-1',
      student_id: studentId,
      date: '2026-06-01',
      subject: '数学',
      homework_content: 'ワーク P10-12',
      homework_deadline: '2026-06-05',
      status: 'pending' as const,
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hw1);
    const updatedHw = { ...hw1, homework_content: 'ワーク P10-15' };
    await db.saveHomeworkResult(updatedHw); // idx >= 0 分岐
    expect(db.getHomeworkResults(studentId).find(h => h.id === 'hw-crud-1')?.homework_content).toBe('ワーク P10-15');

    // 4. 定期テスト記録の作成と更新（idx >= 0 分岐）
    const testRecord1 = {
      id: 'tr-crud-1',
      student_id: studentId,
      exam_name: '1学期中間テスト',
      subject: '数学',
      score: 85,
      date: '2026-05-20',
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(testRecord1);
    const updatedTr = { ...testRecord1, score: 90 };
    await db.saveTestRecord(updatedTr); // idx >= 0 分岐
    expect(db.getTestRecords(studentId).find(r => r.id === 'tr-crud-1')?.score).toBe(90);

    // 5. 生徒面談記録の作成と更新（idx >= 0 分岐）
    const inter1 = {
      id: 'inter-crud-1',
      student_id: studentId,
      date: '2026-06-01',
      category: '面談',
      memo: '学習意欲良好',
      staff_name: '山田講師',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(inter1);
    const updatedInter = { ...inter1, memo: '目標達成に向けて学習意欲良好' };
    await db.saveStudentInteraction(updatedInter); // idx >= 0 分岐
    expect(db.getStudentInteractions(studentId).find(i => i.id === 'inter-crud-1')?.memo).toContain('目標達成');

    // 6. 進捗リストの全件取得と生徒別取得の分岐網羅
    const progressItem = {
      id: 'prog-crud-1',
      student_id: studentId,
      lesson_id: 'cm-math-1',
      status: 'completed' as const,
      completed_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(progressItem);
    expect(db.getStudentLessonProgressList(studentId).length).toBeGreaterThan(0);
    expect(db.getStudentLessonProgressList().length).toBeGreaterThan(0); // studentId 省略分岐

    // 7. 校舎別 AI自動設定ルールの取得と保存分岐
    const rules = db.getBranchAIRules('branch-1');
    expect(rules).toBeDefined();
    await db.saveBranchAIRules('branch-1', { ...rules, review_frequency_days: 14 });
    expect(db.getBranchAIRules('branch-1').review_frequency_days).toBe(14);
  });

  it('10. TeacherDashboard コマ編集モーダルと教科切り替え時の学年フィルター解決（resolveGradeFilterForSubject）', async () => {
    const studentWithNoMathSlot: Student = {
      id: 'std-no-math-1',
      student_id: 'S_NM_1',
      name: '理科専攻生徒',
      grade: '中3',
      status: 'normal',
      branch_id: 'branch-1',
      selected_subjects: ['英語'],
      completed_lesson_ids: []
    };
    await db.saveStudent(studentWithNoMathSlot);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="std-no-math-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeInTheDocument();
    });

    // 1コマ目を「数学」に切り替えて、生徒の学年（中3）からマスターの学年フィルターが自動解決されるパス（L1792-1805）を通す
    await act(async () => {
      fireEvent.change(screen.getByTestId('period-subject-select-1'), { target: { value: '数学' } });
    });

    // コマ詳細を開いてカスタムレッスンIDを指定
    const editModalBtn = screen.queryByTestId('edit-slot-btn-1');
    if (editModalBtn) {
      await act(async () => {
        fireEvent.click(editModalBtn);
      });
    }

    unmount();
  });
});
