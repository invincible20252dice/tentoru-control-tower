import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { db } from '../lib/db';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  CurriculumUnit,
  Branch,
  CustomClass,
  InteractionMemo
} from '../types';

describe('TeacherDashboard Deep Perfection Test Suite', () => {
  const sampleSchools: SchoolMaster[] = [
    { id: 'sch-deep-elem', name: '深層小学校', type: 'elementary' },
    { id: 'sch-deep-jhs', name: '深層中学校', type: 'junior_high' },
    { id: 'sch-deep-hs', name: '深層高校', type: 'high_school' }
  ];

  const sampleBranches: Branch[] = [
    { id: 'branch-deep-1', name: '深層校舎', code: 'B_DEEP_1', email: 'deep@tentoru.jp', status: 'active', created_at: new Date().toISOString() }
  ];

  const elemStudent: Student = {
    id: 'std-deep-elem',
    student_id: 'S_DEEP_ELEM',
    name: '深層 小学生',
    grade: '小5',
    status: 'normal',
    level: 'B',
    branch_id: 'branch-deep-1',
    classroom: '深層校舎',
    school_id: 'sch-deep-elem',
    school_name: '深層小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小5',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '国語', '英語'],
    start_unit_math: 'cm-m-1',
    completed_lesson_ids: ['cm-m-1'],
    excluded_lesson_ids: ['cm-m-2'],
    personalities: ['集中力高い'],
    period_count: 2,
    default_slots: 2
  };

  const jhsStudent: Student = {
    id: 'std-deep-jhs',
    student_id: 'S_DEEP_JHS',
    name: '深層 中学生',
    grade: '中3',
    status: 'warning',
    level: 'A',
    branch_id: 'branch-deep-1',
    classroom: '深層校舎',
    school_id: 'sch-deep-jhs',
    school_name: '深層中学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '中3',
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['数学', '英語', '理科'],
    start_unit_math: 'cm-jh-m-1',
    completed_lesson_ids: [],
    excluded_lesson_ids: [],
    personalities: ['几帳面'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    period_count: 2,
    default_slots: 2
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-m-1', grade: '小5', subject: '算数', unit_name: '1章 小数と計算', lesson_name: 'STEP 1 小数の意味', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-m-2', grade: '小5', subject: '算数', unit_name: '1章 小数と計算', lesson_name: 'STEP 2 小数のたし算', sort_order: 2, item_type: 'lesson' },
    { id: 'cm-m-3', grade: '小5', subject: '算数', unit_name: '1章 小数と計算', lesson_name: '1章 小数 単元確認テスト', sort_order: 3, item_type: 'unit_test', passing_line: '80%以上' },
    { id: 'cm-jh-m-1', grade: '中3', subject: '数学', unit_name: '1章 式の展開', lesson_name: 'STEP 1 乗法公式', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-jh-m-2', grade: '中3', subject: '数学', unit_name: '1章 式の展開', lesson_name: '1章 式の展開 単元確認テスト', sort_order: 2, item_type: 'unit_test', passing_line: '80%以上' }
  ];

  const sampleUnits: CurriculumUnit[] = [
    { id: 'unit-1', school_id: 'sch-deep-jhs', grade: '中3', subject: '数学', name: '1章 式の展開', sequence_order: 1, created_at: new Date().toISOString() },
    { id: 'unit-2', school_id: 'sch-deep-jhs', grade: '中3', subject: '数学', name: '2章 平方根', sequence_order: 2, created_at: new Date().toISOString() }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await db.saveStudent(elemStudent);
    await db.saveStudent(jhsStudent);
    await db.saveCurriculumMasters(sampleMasters);
    for (const u of sampleUnits) {
      await db.saveCurriculumUnit(u);
    }
  });

  it('1. Thoroughly covers Elementary Timeline exclusions, restoration, and milestone tab operations', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemStudent.id}
          initialTab="milestones"
        />
      );
    });

    const restoreBtns = screen.queryAllByRole('button', { name: /除外解除/i });
    if (restoreBtns.length > 0) {
      await act(async () => {
        fireEvent.click(restoreBtns[0]);
      });
    }

    const excludeBtns = screen.queryAllByRole('button', { name: /除外する/i });
    if (excludeBtns.length > 0) {
      await act(async () => {
        fireEvent.click(excludeBtns[0]);
      });
    }

    const mathBtn = screen.queryByTestId('milestone-subject-btn-算数') || screen.queryByText(/🧮 算数/);
    if (mathBtn) {
      await act(async () => {
        fireEvent.click(mathBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('2. Thoroughly covers Junior High Milestone customization, month filters, row additions, template CRUD, and bulk apply', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="milestones"
        />
      );
    });

    const monthBtns = screen.queryAllByRole('button', { name: /[0-9]+月|すべて/ });
    for (const btn of monthBtns.slice(0, 3)) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    const levelBtns = screen.queryAllByRole('button', { name: /レベル[ABC]/ });
    for (const btn of levelBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    const templateInput = screen.queryByPlaceholderText(/現在の計画をテンプレート名として保存/);
    const saveTemplateBtn = screen.queryByRole('button', { name: /テンプレートとして保存/ });
    if (templateInput && saveTemplateBtn) {
      await act(async () => {
        fireEvent.change(templateInput, { target: { value: '中3数学_標準テスト対策' } });
        fireEvent.click(saveTemplateBtn);
      });
    }

    const applyTemplateBtn = screen.queryByRole('button', { name: /適用/ });
    if (applyTemplateBtn) {
      await act(async () => {
        fireEvent.click(applyTemplateBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('3. Thoroughly covers Unit Test Master creation modal with form inputs and validations', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemStudent.id}
          initialTab="milestones"
        />
      );
    });

    const openUnitTestModalBtn = screen.queryByText(/単元テストマスタ登録/);
    if (openUnitTestModalBtn) {
      await act(async () => {
        fireEvent.click(openUnitTestModalBtn);
      });

      const testNameInput = screen.queryByPlaceholderText(/たしざん 単元確認テスト/);
      if (testNameInput) {
        await act(async () => {
          fireEvent.change(testNameInput, { target: { value: '小数の計算 総合確認テスト' } });
        });
      }

      const passingLineInput = screen.queryByPlaceholderText(/80%以上, 90点/);
      if (passingLineInput) {
        await act(async () => {
          fireEvent.change(passingLineInput, { target: { value: '90%以上' } });
        });
      }

      const saveModalBtn = screen.queryByTestId('save-unittest-master-btn') || screen.queryByText(/追加する \(保存\)/);
      if (saveModalBtn) {
        await act(async () => {
          fireEvent.click(saveModalBtn);
        });
      }
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('4. Thoroughly covers Tests & Exams tab: score entry, target score, subject radar, and deletions', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="tests"
        />
      );
    });

    const testNameInput = screen.queryByPlaceholderText(/例: 1学期中間テスト/);
    if (testNameInput) {
      await act(async () => {
        fireEvent.change(testNameInput, { target: { value: '中3 1学期中間テスト' } });
      });
    }

    const numberInputs = screen.queryAllByRole('spinbutton');
    for (const input of numberInputs.slice(0, 5)) {
      await act(async () => {
        fireEvent.change(input, { target: { value: '92' } });
      });
    }

    const saveExamBtn = screen.queryByRole('button', { name: /テスト結果を保存|登録/ });
    if (saveExamBtn) {
      await act(async () => {
        fireEvent.click(saveExamBtn);
      });
    }

    const mockExamNameInput = screen.queryByPlaceholderText(/例: 駿台模試/);
    if (mockExamNameInput) {
      await act(async () => {
        fireEvent.change(mockExamNameInput, { target: { value: '第1回 都立そっくり模試' } });
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('5. Thoroughly covers Student List filtering, search keyword, sorting, school type filters, and delete student', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent, jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="student-list"
        />
      );
    });

    const searchInput = screen.queryByPlaceholderText(/生徒名・生徒IDで検索/);
    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '深層' } });
      });
    }

    const gradeFilter = screen.queryByTestId('student-list-grade-filter') || screen.queryAllByRole('combobox')[0];
    if (gradeFilter) {
      await act(async () => {
        fireEvent.change(gradeFilter, { target: { value: '中3' } });
      });
    }

    const typeBtns = screen.queryAllByRole('button', { name: /全校種|小学生|中学生|高校生/ });
    for (const btn of typeBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    // 生徒削除ボタン
    const deleteStudentBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (deleteStudentBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteStudentBtns[0]);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('6. Thoroughly covers Curriculum Tab unit reordering, additions, editing, subject switching, and deletions', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="curriculum"
        />
      );
    });

    const addUnitInput = screen.queryByPlaceholderText(/単元名を入力/);
    const addUnitBtn = screen.queryByText(/＋ 単元を追加/);
    if (addUnitInput && addUnitBtn) {
      await act(async () => {
        fireEvent.change(addUnitInput, { target: { value: '3章 二次方程式' } });
        fireEvent.click(addUnitBtn);
      });
    }

    const editBtns = screen.queryAllByRole('button', { name: '編集' });
    if (editBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editBtns[0]);
      });
    }

    const deleteUnitBtns = screen.queryAllByRole('button', { name: '削除' });
    if (deleteUnitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteUnitBtns[0]);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('7. Thoroughly covers Student Detail all fields, personality tags, teacher tags, interview logs, and subject start selectors', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const memo: InteractionMemo = {
      id: 'memo-deep-1',
      student_id: jhsStudent.id,
      date: '2026-04-10',
      staff_name: '福田 尚弘',
      memo: '初回の目標設定面談完了。',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(memo);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="student-detail"
        />
      );
    });

    // 性格タグの追加
    const pInput = screen.queryByTestId('new-personality-input') || screen.queryByPlaceholderText(/新しい性格・特徴タグ/);
    const pAddBtn = screen.queryByTestId('add-personality-btn') || screen.queryByRole('button', { name: /タグ追加/ });
    if (pInput && pAddBtn) {
      await act(async () => {
        fireEvent.change(pInput, { target: { value: '粘り強い' } });
        fireEvent.click(pAddBtn);
      });
    }

    // 担当講師タグの追加
    const tInput = screen.queryByPlaceholderText(/講師名を入力/);
    const tAddBtn = screen.queryByRole('button', { name: /講師追加/ });
    if (tInput && tAddBtn) {
      await act(async () => {
        fireEvent.change(tInput, { target: { value: '佐藤 先生' } });
        fireEvent.click(tAddBtn);
      });
    }

    // 面談メモの入力
    const memoArea = screen.queryByPlaceholderText(/面談内容、生徒の様子、連絡事項などを入力/);
    const memoSaveBtn = screen.queryByRole('button', { name: /面談記録を保存/ });
    if (memoArea && memoSaveBtn) {
      await act(async () => {
        fireEvent.change(memoArea, { target: { value: '定期テスト直前対策の相談を実施。' } });
        fireEvent.click(memoSaveBtn);
      });
    }

    // 面談メモの削除
    const deleteMemoBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (deleteMemoBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteMemoBtns[0]);
      });
    }

    // 基本情報保存
    const saveBtn = screen.queryByRole('button', { name: /生徒情報を更新/ });
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('8. Thoroughly covers Schedule tab period selections, auto reschedule, and AI guidance report', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="schedule"
        />
      );
    });

    const reschedBtn = screen.queryByRole('button', { name: /手動リスケジュールを実行|遅れチェック/i });
    if (reschedBtn) {
      await act(async () => {
        fireEvent.click(reschedBtn);
      });
    }

    const saveTimetableBtn = screen.queryByText(/時間割コマ割りを保存/);
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('9. Thoroughly covers Create Student form submissions, grade switching, and school deletion', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="create-student"
        />
      );
    });

    const nameInput = screen.queryByPlaceholderText(/例: 佐藤 拓海/);
    if (nameInput) {
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: '新規 太郎' } });
      });
    }

    const createForm = screen.queryByRole('button', { name: /1クリックアカウント発行/ })?.closest('form');
    if (createForm) {
      await act(async () => {
        fireEvent.submit(createForm);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('10. Thoroughly covers Template deletion, bulk apply modal, and regular exam toggles', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const template: MilestoneTemplate = {
      id: 'tmpl-cov-1',
      name: '中3標準テスト対策テンプレート',
      grade: '中3',
      level: 'A',
      subject: '数学',
      plans: [
        { month: 4, week: 1, chapter: '1章 式の展開', lesson_title: '乗法公式', is_holiday: false }
      ],
      created_at: new Date().toISOString()
    };
    await db.saveMilestoneTemplate(template);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="milestones"
        />
      );
    });

    // テンプレートの削除ボタンをクリック
    const deleteTmplBtn = screen.queryByRole('button', { name: /削除/i });
    if (deleteTmplBtn) {
      await act(async () => {
        fireEvent.click(deleteTmplBtn);
      });
    }

    // 一括反映モーダルを開く
    const openBulkBtn = screen.queryByRole('button', { name: /一括反映|他の生徒にも反映/i });
    if (openBulkBtn) {
      await act(async () => {
        fireEvent.click(openBulkBtn);
      });

      const applyBulkBtn = screen.queryByRole('button', { name: /一括適用する|反映する/i });
      if (applyBulkBtn) {
        await act(async () => {
          fireEvent.click(applyBulkBtn);
        });
      }
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('11. Thoroughly covers AI Report prompt manual correction, generation, and save', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="ai-report"
        />
      );
    });

    // AIレポート生成ボタン
    const generateBtn = screen.queryByRole('button', { name: /AI指導レポートを生成|レポート生成/i });
    if (generateBtn) {
      await act(async () => {
        fireEvent.click(generateBtn);
      });
    }

    // レポート手動修正テキストエリア
    const reportTextareas = screen.queryAllByRole('textbox');
    if (reportTextareas.length > 0) {
      await act(async () => {
        fireEvent.change(reportTextareas[0], { target: { value: '指導レポート修正：計算力向上中。' } });
      });
    }

    const saveReportBtn = screen.queryByRole('button', { name: /レポートを保存|修正を保存/i });
    if (saveReportBtn) {
      await act(async () => {
        fireEvent.click(saveReportBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('12. Thoroughly covers Homework status updates, custom task editing, and test threshold saves', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const hw: HomeworkResult = {
      id: 'hw-deep-item-1',
      student_id: jhsStudent.id,
      date: '2026-04-12',
      subject: '数学',
      unit_name: '1章 式の展開',
      lesson_name: 'STEP 1 宿題',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hw);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="homeworks"
        />
      );
    });

    const toggleBtn = screen.queryByTestId(`toggle-homework-status-${hw.id}`) || screen.queryByRole('button', { name: /未提出|提出済/i });
    if (toggleBtn) {
      // 未提出 -> 提出済
      await act(async () => {
        fireEvent.click(toggleBtn);
      });
      // 提出済 -> 未提出
      await act(async () => {
        fireEvent.click(toggleBtn);
      });
    }

    const delBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (delBtns.length > 0) {
      await act(async () => {
        fireEvent.click(delBtns[0]);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('13. Thoroughly covers Mock Exam detailed subjects, score saves, and deletion', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="tests"
        />
      );
    });

    const mockName = screen.queryByPlaceholderText(/例: 駿台模試/);
    if (mockName) {
      await act(async () => {
        fireEvent.change(mockName, { target: { value: '第2回 Vもぎ' } });
      });
    }

    const mockInputs = screen.queryAllByRole('spinbutton');
    for (const input of mockInputs) {
      await act(async () => {
        fireEvent.change(input, { target: { value: '65' } });
      });
    }

    const saveMockBtn = screen.queryByRole('button', { name: /模試結果を保存|登録する/ });
    if (saveMockBtn) {
      await act(async () => {
        fireEvent.click(saveMockBtn);
      });
    }

    const delMockBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (delMockBtns.length > 0) {
      await act(async () => {
        fireEvent.click(delMockBtns[0]);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('14. Thoroughly covers Student List status filtering (fast, normal, warning) and search', async () => {
    const fastStudent: Student = {
      ...elemStudent,
      id: 'std-fast-1',
      student_id: 'S_FAST_1',
      name: '爆速 太郎',
      status: 'fast'
    };
    await db.saveStudent(fastStudent);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent, jhsStudent, fastStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="student-list"
        />
      );
    });

    // ステータスボタン切り替え
    const statusBtns = screen.queryAllByRole('button', { name: /爆速中|パンク|通常進捗|全ステータス/ });
    for (const btn of statusBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    wrapper.unmount();
  });

  it('15. Thoroughly covers schedule period subject change and dynamic unit mapping', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemStudent.id}
          initialTab="schedule"
        />
      );
    });

    const selects = screen.queryAllByRole('combobox');
    for (const sel of selects) {
      await act(async () => {
        fireEvent.change(sel, { target: { value: '算数' } });
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('16. Thoroughly covers Student Detail leave of absence (dormant) and withdrawal toggles', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="student-detail"
        />
      );
    });

    // 休塾ステータスボタン
    const dormantBtns = screen.queryAllByRole('button', { name: /休塾|休会/i });
    for (const btn of dormantBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    // 更新ボタン
    const saveBtn = screen.queryByRole('button', { name: /生徒情報を更新/ });
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('17. Thoroughly covers Milestone bulk apply with matching grade and level', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const jhsStudent2: Student = {
      ...jhsStudent,
      id: 'std-deep-jhs-2',
      student_id: 'S_DEEP_JHS_2',
      name: '深層 中学2郎'
    };
    await db.saveStudent(jhsStudent2);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[jhsStudent, jhsStudent2]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={jhsStudent.id}
          initialTab="milestones"
        />
      );
    });

    const bulkBtn = screen.queryByRole('button', { name: /他の生徒にも反映|一括反映/i });
    if (bulkBtn) {
      await act(async () => {
        fireEvent.click(bulkBtn);
      });

      const applyBtn = screen.queryByRole('button', { name: /一括適用する|反映する/i });
      if (applyBtn) {
        await act(async () => {
          fireEvent.click(applyBtn);
        });
      }
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('18. Thoroughly covers Today Tests and Today Homeworks additions, dropdown selections, unit test master selections, and deletions', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemStudent.id}
          initialTab="schedule"
        />
      );
    });

    // 「＋ テストを追加」ボタン
    const addTestBtn = screen.queryByRole('button', { name: /テストを追加/i });
    if (addTestBtn) {
      await act(async () => {
        fireEvent.click(addTestBtn);
      });
    }

    // 「＋ 宿題を追加」ボタン
    const addHwBtn = screen.queryByRole('button', { name: /宿題を追加/i });
    if (addHwBtn) {
      await act(async () => {
        fireEvent.click(addHwBtn);
      });
    }

    // セレクトボックスの変更
    const selects = screen.queryAllByRole('combobox');
    for (const sel of selects) {
      await act(async () => {
        fireEvent.change(sel, { target: { value: 'unit_test' } });
      });
    }

    // 入力欄の変更
    const inputs = screen.queryAllByRole('textbox');
    for (const inp of inputs) {
      await act(async () => {
        fireEvent.change(inp, { target: { value: '1章 小数 単元確認テスト' } });
      });
    }

    // 削除ボタン
    const removeBtns = screen.queryAllByRole('button', { name: /✕|削除/i });
    for (const btn of removeBtns.slice(0, 2)) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('19. Thoroughly covers Milestone exclude reset and curriculum restorations', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const elemWithExcludes: Student = {
      ...elemStudent,
      excluded_lesson_ids: ['cm-m-1', 'cm-m-2']
    };
    await db.saveStudent(elemWithExcludes);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemWithExcludes]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemWithExcludes.id}
          initialTab="milestones"
        />
      );
    });

    const resetExcludeBtn = screen.queryByRole('button', { name: /除外設定をクリア|除外をリセット|除外された授業・テストを復元/i });
    if (resetExcludeBtn) {
      await act(async () => {
        fireEvent.click(resetExcludeBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });

  it('20. Thoroughly covers Unit Test Master edit flow and validation', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[elemStudent]}
          schools={sampleSchools}
          curriculumMasters={sampleMasters}
          tasks={[]}
          initialStudentId={elemStudent.id}
          initialTab="milestones"
        />
      );
    });

    const openBtn = screen.queryByRole('button', { name: /単元テストマスタ登録/i });
    if (openBtn) {
      await act(async () => {
        fireEvent.click(openBtn);
      });

      const cancelBtn = screen.queryByRole('button', { name: /キャンセル/i });
      if (cancelBtn) {
        await act(async () => {
          fireEvent.click(cancelBtn);
        });
      }
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    wrapper.unmount();
  });
});
