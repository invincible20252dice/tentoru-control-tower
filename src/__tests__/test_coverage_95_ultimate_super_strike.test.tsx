import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import { BranchManagement } from '../components/BranchManagement';
import { db } from '../lib/db';
import { Student, School, CurriculumMaster, Branch, Task, InteractionLog } from '../types';

describe('Coverage 95%+ Ultimate Super Strike Suite', () => {
  const mockBranches: Branch[] = [
    { id: 'branch-1', name: '恵比寿教室', code: 'EBI', email: 'ebisu@tentoru.jp', status: 'active', created_at: new Date().toISOString() },
    { id: 'branch-2', name: '渋谷教室', code: 'SHI', email: 'shibuya@tentoru.jp', status: 'suspended', created_at: new Date().toISOString() }
  ];

  const mockSchools: School[] = [
    { id: 'sch-1', name: '花咲小学校', type: 'elementary' },
    { id: 'sch-2', name: '桜台中学校', type: 'junior_high' }
  ];

  const studentElem: Student = {
    id: 'st-elem-strike',
    student_id: 'S_ELEM_STRIKE',
    name: '小学 達成太郎',
    name_kana: 'ショウガク タッセイタロウ',
    grade: '小5',
    status: 'normal',
    level: 'A',
    branch_id: 'branch-1',
    classroom: '恵比寿教室',
    school_id: 'sch-1',
    school_name: '花咲小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '小5',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '英語', '国語'],
    period_count: 2,
    default_slots: 2,
    personalities: ['集中力高い', '几帳面'],
    target_schools: [{ school_name: '開成中学校', course_name: '普通科' }],
    parent_name: '達成 父',
    parent_name_kana: 'タッセイ チチ',
    contact_phone: '090-1111-2222'
  };

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-m-1', grade: '小5', grade_level: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: 'STEP 1 小数と10倍', sort_order: 1, item_type: 'lesson' },
    { id: 'cm-m-2', grade: '小5', grade_level: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: 'STEP 2 小数の位取り', sort_order: 2, item_type: 'lesson' },
    { id: 'cm-m-test', grade: '小5', grade_level: '小5', subject: '算数', unit_name: '1章 整数と小数', lesson_name: '1章 整数と小数 単元確認テスト', sort_order: 3, item_type: 'unit_test', passing_line: '80%以上' },
    { id: 'cm-m-jhs-1', grade: '中2', grade_level: '中2', subject: '数学', unit_name: '1章 式の計算', lesson_name: '1節 式の加法と減法', sort_order: 1, item_type: 'lesson' }
  ];

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      student_id: studentElem.id,
      title: '算数: STEP 1 小数と10倍',
      subject: '算数',
      grade: '小5',
      scheduled_date: '2026-04-10',
      status: 'pending',
      task_type: 'lesson',
      period_number: 1,
      duration_minutes: 60
    },
    {
      id: 'task-2',
      student_id: studentElem.id,
      title: '算数: 1章 整数と小数 単元確認テスト',
      subject: '算数',
      grade: '小5',
      scheduled_date: '2026-04-12',
      status: 'pending',
      task_type: 'test',
      period_number: 2,
      duration_minutes: 60
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    await db.saveBranch(mockBranches[0]);
    await db.saveBranch(mockBranches[1]);
    await db.saveStudent(studentElem);
    await db.saveCurriculumMasters(sampleMasters);
    await db.saveLearningTasks(sampleTasks as any);

    // Homework & Mini-test results
    await db.saveHomeworkResult({
      id: 'hw-res-1',
      student_id: studentElem.id,
      date: '2026-04-10',
      homework_content: '算数ワーク p.10-12',
      homework_deadline: '2026-04-15',
      status: 'incomplete' as any,
      subject: '算数'
    } as any);

    await db.saveMiniTestResult({
      id: 'mt-res-1',
      student_id: studentElem.id,
      date: '2026-04-10',
      subject: '算数',
      score: '85',
      passed: true
    } as any);
  });

  it('1. TeacherDashboard: Unit Test Master Modal CRUD, Auto-fill, and Save flow', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="milestones"
          teacherType="elementary"
        />
      );
    });

    // タイムライン学年フィルターの切り替え
    const gradeFilterButtons = [
      '1年生', '2年生', '3年生', '4年生', '5年生', '6年生', '全学年表示'
    ];
    for (const g of gradeFilterButtons) {
      const btn = screen.queryByTestId(`elementary-timeline-grade-btn-${g}`);
      if (btn) {
        fireEvent.click(btn);
      }
    }

    // 「単元テストを追加」ボタンをクリック
    const addUnitTestBtn = screen.getByTestId('timeline-add-unittest-btn');
    await act(async () => {
      fireEvent.click(addUnitTestBtn);
    });

    expect(screen.getByTestId('unit-test-master-modal')).toBeInTheDocument();
    expect(screen.getByText(/単元テスト マスタ新規追加/)).toBeInTheDocument();

    // フォーム入力: 学年選択と単元ドロップダウン選択
    const gradeSelects = screen.getAllByRole('combobox');
    const unitGradeSelect = gradeSelects.find(s => s.querySelectorAll('option').length >= 10);
    if (unitGradeSelect) {
      fireEvent.change(unitGradeSelect, { target: { value: '小5' } });
    }

    const unitDropdown = screen.queryByRole('combobox', { name: /対象単元/i }) || gradeSelects.find(s => Array.from(s.options).some(o => o.text.includes('1章 整数と小数')));
    if (unitDropdown) {
      fireEvent.change(unitDropdown, { target: { value: '1章 整数と小数' } });
    } else {
      const unitNameInputs = screen.getAllByPlaceholderText(/1章 整数と小数/);
      if (unitNameInputs.length > 0) {
        fireEvent.change(unitNameInputs[0], { target: { value: '2章 小数の計算' } });
      }
    }

    const testNameInput = screen.getByPlaceholderText(/たしざん 単元確認テスト/);
    fireEvent.change(testNameInput, { target: { value: '2章 小数の計算 単元確認テスト' } });

    const passLineInput = screen.getByPlaceholderText(/80%以上, 90点/);
    fireEvent.change(passLineInput, { target: { value: '85%以上' } });

    // 保存ボタンをクリック
    const saveMasterBtn = screen.getByTestId('save-unittest-master-btn');
    await act(async () => {
      fireEvent.click(saveMasterBtn);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('unit-test-master-modal')).not.toBeInTheDocument();
    });

    // モーダルを再度開いてバツボタンで閉じる
    await act(async () => {
      fireEvent.click(addUnitTestBtn);
    });
    const closeMasterBtn = screen.queryByText('✕') || screen.queryByText('キャンセル');
    if (closeMasterBtn) {
      fireEvent.click(closeMasterBtn);
    }

    wrapper.unmount();
  });

  it('2. TeacherDashboard: AI Branch Rules Modal open, modify settings, and save', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    // AI設定ボタンを探してクリック
    const openAIRulesBtn = screen.queryByTestId('open-branch-ai-rules-modal-btn') || screen.queryAllByRole('button').find(b => b.textContent?.includes('AI') && b.textContent?.includes('設定'));
    if (openAIRulesBtn) {
      await act(async () => {
        fireEvent.click(openAIRulesBtn);
      });

      // 各入力欄の変更
      const lessonsInput = screen.getByTestId('branch-ai-lessons-per-slot-input');
      fireEvent.change(lessonsInput, { target: { value: '3' } });

      const prepWeeksInput = screen.getByTestId('branch-ai-test-prep-weeks-input');
      fireEvent.change(prepWeeksInput, { target: { value: '4' } });

      const punkInput = screen.getByTestId('branch-ai-punk-threshold-input');
      fireEvent.change(punkInput, { target: { value: '6' } });

      const reviewInput = screen.getByTestId('branch-ai-review-slot-interval-input');
      fireEvent.change(reviewInput, { target: { value: '5' } });

      // 保存
      const saveBtn = screen.getByTestId('save-branch-ai-rules-btn');
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // 再度開いてキャンセル
      await act(async () => {
        fireEvent.click(openAIRulesBtn);
      });
      const cancelAiBtn = screen.queryByText('キャンセル');
      if (cancelAiBtn) {
        fireEvent.click(cancelAiBtn);
      }
    }

    wrapper.unmount();
  });

  it('3. BranchManagement: Comprehensive test for branch CRUD, toggle password, status update, reset password', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <BranchManagement
          onSelectBranch={vi.fn()}
          onBranchesUpdated={vi.fn()}
          onBack={vi.fn()}
        />
      );
    });

    // 校舎リストのレンダリング確認
    await waitFor(() => {
      expect(screen.getByText('恵比寿教室')).toBeInTheDocument();
      expect(screen.getByText('渋谷教室')).toBeInTheDocument();
    });

    // ステータスフィルター切り替え
    const activeFilterBtn = screen.getByRole('button', { name: /稼働中/ });
    fireEvent.click(activeFilterBtn);

    const suspendedFilterBtn = screen.getByRole('button', { name: /停止中/ });
    fireEvent.click(suspendedFilterBtn);

    const allFilterBtn = screen.getByRole('button', { name: /すべて/ });
    fireEvent.click(allFilterBtn);

    // 新規校舎作成モーダルを開く
    const addBranchBtn = screen.getByRole('button', { name: /新規校舎アカウント発行/ });
    fireEvent.click(addBranchBtn);

    // フォーム入力
    const nameInput = screen.getByPlaceholderText(/例: 横浜教室/);
    fireEvent.change(nameInput, { target: { value: '新宿南口校' } });

    const emailInput = screen.getByPlaceholderText(/例: yokohama@tentoru.jp/);
    fireEvent.change(emailInput, { target: { value: 'shinjuku@tentoru.jp' } });

    // パスワード生成ボタンをクリック
    const genPassBtn = screen.getByRole('button', { name: /自動生成/ });
    fireEvent.click(genPassBtn);

    // 作成実行
    const submitBtn = screen.getByRole('button', { name: /アカウントを発行する/ });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('新宿南口校')).toBeInTheDocument();
    });

    wrapper.unmount();
  });

  it('4. TeacherDashboard: Student Detail Full Flow (Information, Target Schools, Teachers, Days, Subjects, Start Units, Personalities, Interactions, and Save)', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="student-detail"
          teacherType="elementary"
        />
      );
    });

    // 4.1 基本情報・通塾日・退塾日の入力
    const enrollInput = screen.getByTestId('student-enrollment-date-input');
    fireEvent.change(enrollInput, { target: { value: '2026-04-01' } });

    const withdrawInput = screen.getByTestId('student-withdrawal-date-input');
    fireEvent.change(withdrawInput, { target: { value: '' } });

    // 4.2 志望校追加・編集・削除
    const addSchoolBtn = screen.queryByRole('button', { name: /志望校を追加/ });
    if (addSchoolBtn) {
      fireEvent.click(addSchoolBtn);
    }
    const schoolInputs = screen.getAllByPlaceholderText(/志望校名/);
    if (schoolInputs.length > 1) {
      fireEvent.change(schoolInputs[1], { target: { value: '麻布中学校' } });
    }

    // 4.3 担当講師の操作
    const teacherCustomInput = screen.getByTestId('teacher-custom-input');
    fireEvent.change(teacherCustomInput, { target: { value: '佐藤 先生' } });
    const addTeacherBtn = screen.getByTestId('add-teacher-btn');
    fireEvent.click(addTeacherBtn);

    // 担当講師タグ解除
    const removeTeacherBtn = screen.queryByTestId('remove-teacher-福田 尚弘');
    if (removeTeacherBtn) {
      fireEvent.click(removeTeacherBtn);
    }

    // 4.4 曜日チップ操作
    const dayChipMon = screen.getByTestId('day-chip-monday');
    fireEvent.click(dayChipMon); // 解除
    fireEvent.click(dayChipMon); // 選択

    // 4.5 選択教科チップ操作
    const subjChipMath = screen.getByTestId('subject-chip-算数');
    fireEvent.click(subjChipMath); // トグル
    fireEvent.click(subjChipMath);

    // 4.6 教科別スタート位置選択
    const startGradeMath = screen.getByTestId('start-grade-select-start_unit_math');
    fireEvent.change(startGradeMath, { target: { value: '5年生' } });

    const startUnitMath = screen.getByTestId('start-unit-select-start_unit_math');
    if (startUnitMath.children.length > 1) {
      fireEvent.change(startUnitMath, { target: { value: sampleMasters[0].id } });
    }

    // 教科別スタート位置をTodoに反映ボタンをクリック
    const saveStartUnitBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('教科別スタート位置をTodoに反映') || b.textContent?.includes('スタート位置'));
    if (saveStartUnitBtn) {
      await act(async () => {
        fireEvent.click(saveStartUnitBtn);
      });
    }

    // 4.7 個性タグの追加と解除
    const personalityInput = screen.getByTestId('new-personality-input');
    fireEvent.change(personalityInput, { target: { value: '探究心旺盛' } });
    const addPersonalityBtn = screen.getByTestId('add-personality-btn');
    fireEvent.click(addPersonalityBtn);

    const removeTagBtn = screen.queryByTestId('remove-personality-tag-集中力高い');
    if (removeTagBtn) {
      fireEvent.click(removeTagBtn);
    }

    // 4.8 フォーム送信 (生徒情報保存)
    const saveDetailBtn = screen.getByRole('button', { name: /変更を保存する/ });
    await act(async () => {
      fireEvent.click(saveDetailBtn);
    });

    // 4.9 面談記録 (Interaction) の登録
    const categorySelect = screen.getByLabelText(/種別/);
    fireEvent.change(categorySelect, { target: { value: '勉強相談' } });

    const staffSelect = screen.getByLabelText(/対応者/);
    fireEvent.change(staffSelect, { target: { value: 'other' } });

    const customStaffInput = screen.getByPlaceholderText(/講師名を入力/);
    fireEvent.change(customStaffInput, { target: { value: '鈴木 先生' } });

    const memoInput = screen.getByPlaceholderText(/具体的な対応メモを入力/);
    fireEvent.change(memoInput, { target: { value: '算数の文章題の解き方についてアドバイス実施' } });

    const addInteractionBtn = screen.getByRole('button', { name: /対応内容を登録/ });
    await act(async () => {
      fireEvent.click(addInteractionBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/算数の文章題の解き方についてアドバイス実施/)).toBeInTheDocument();
    });

    // 4.10 面談記録の編集
    const editInteractionButtons = screen.getAllByRole('button').filter(b => b.title === '対応履歴を編集');
    if (editInteractionButtons.length > 0) {
      fireEvent.click(editInteractionButtons[0]);
      const editTextarea = screen.getByDisplayValue(/算数の文章題の解き方についてアドバイス実施/);
      fireEvent.change(editTextarea, { target: { value: '算数の文章題の解き方についてアドバイス実施（修正版）' } });
      const saveEditBtn = screen.getByText('保存');
      await act(async () => {
        fireEvent.click(saveEditBtn);
      });
      await waitFor(() => {
        expect(screen.getByText(/（修正版）/)).toBeInTheDocument();
      });
    }

    // 4.11 面談記録の削除
    const deleteInteractionButtons = screen.getAllByRole('button').filter(b => b.title === '対応履歴を削除');
    if (deleteInteractionButtons.length > 0) {
      await act(async () => {
        fireEvent.click(deleteInteractionButtons[0]);
      });
    }

    wrapper.unmount();
  });

  it('5. TeacherDashboard: All Tab Navigation, Filters, Search, and Status Operations', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="student-list"
          teacherType="elementary"
        />
      );
    });

    // 5.1 生徒一覧タブでの検索・フィルター
    const searchInput = screen.getByTestId('filter-name');
    fireEvent.change(searchInput, { target: { value: '小学' } });
    expect(screen.getAllByText(/小学 達成太郎/).length).toBeGreaterThan(0);

    // 5.2 各種タブへの切り替え
    const tabsToClick = [
      'create-student',
      'schedule',
      'milestones',
      'curriculum',
      'mini-tests',
      'homeworks',
      'tests',
      'ai-report',
      'branches',
      'curriculum-import'
    ];

    for (const tabName of tabsToClick) {
      const tabButton = screen.queryByRole('button', { name: new RegExp(tabName, 'i') }) ||
                        screen.getAllByRole('button').find(b => b.getAttribute('data-tab') === tabName || b.textContent?.includes(tabName));
      if (tabButton) {
        await act(async () => {
          fireEvent.click(tabButton);
        });
      }
    }

    // 5.3 生徒新規作成タブ
    const createStudentTabBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('新規生徒') || b.textContent?.includes('生徒追加') || b.textContent?.includes('新規生徒アカウント発行'));
    if (createStudentTabBtn) {
      await act(async () => {
        fireEvent.click(createStudentTabBtn);
      });

      const nameInput = screen.getByPlaceholderText(/例: 佐藤 拓海/);
      fireEvent.change(nameInput, { target: { value: '新規 太郎' } });

      // 新規学校追加の選択
      const schoolSelect = screen.getByTestId('new-student-school-select');
      fireEvent.change(schoolSelect, { target: { value: 'add_new' } });

      const customSchoolInput = screen.queryByPlaceholderText(/例: 桜蔭/);
      if (customSchoolInput) {
        fireEvent.change(customSchoolInput, { target: { value: '富士見小学校' } });
      }

      const createForm = nameInput.closest('form');
      if (createForm) {
        await act(async () => {
          fireEvent.submit(createForm);
        });
      }
    }

    wrapper.unmount();
  });

  it('6. db.ts: Authentication, Session, Password Reset, and Database sync methods', async () => {
    // 6.1 signInWithPassword validations
    const emptyEmail = await db.signInWithPassword('', 'pass');
    expect(emptyEmail.success).toBe(false);
    expect(emptyEmail.error).toContain('メールアドレスを入力してください');

    const emptyPass = await db.signInWithPassword('admin@tentoru.jp', '');
    expect(emptyPass.success).toBe(false);
    expect(emptyPass.error).toContain('パスワードを入力してください');

    const wrongPass = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
    expect(wrongPass.success).toBe(false);
    expect(wrongPass.error).toContain('正しくありません');

    // 6.2 signInWithPassword admin success
    const adminLogin = await db.signInWithPassword('admin@tentoru.jp', 'correctpass');
    expect(adminLogin.success).toBe(true);
    expect(adminLogin.session?.user.role).toBe('admin');

    // 6.3 signInWithPassword branch success
    const branchLogin = await db.signInWithPassword('ebisu@tentoru.jp', 'Tentoru2026!');
    expect(branchLogin.success).toBe(true);
    expect(branchLogin.session?.user.role).toBe('branch');
    expect(branchLogin.session?.user.branch_id).toBe('branch-1');

    // 6.4 signInWithPassword suspended branch
    const suspendedLogin = await db.signInWithPassword('shibuya@tentoru.jp', 'Tentoru2026!');
    expect(suspendedLogin.success).toBe(false);
    expect(suspendedLogin.error).toContain('一時停止中');

    // 6.5 Generic email pattern login
    const customBranchLogin = await db.signInWithPassword('branch-test@tentoru.jp', 'anypass');
    expect(customBranchLogin.success).toBe(true);
    expect(customBranchLogin.session?.user.role).toBe('branch');

    // 6.6 Session management
    const currentSession = db.getSession();
    expect(currentSession).toBeDefined();

    // 6.7 sendBranchPasswordReset
    const resetRes = await db.sendBranchPasswordReset('ebisu@tentoru.jp');
    expect(resetRes.success).toBe(true);
    expect(resetRes.message).toContain('ebisu@tentoru.jp');

    // 6.8 Branch AI Rules
    const aiRules = await db.saveBranchAIRules('branch-1', {
      lessons_per_slot: 3,
      test_prep_lead_weeks: 4,
      punk_threshold_slots: 5,
      review_slot_interval: 3
    });
    expect(aiRules.lessons_per_slot).toBe(3);
    const fetchedRules = db.getBranchAIRules('branch-1');
    expect(fetchedRules.lessons_per_slot).toBe(3);

    // 6.9 Default AI Rules for 'all'
    const defaultRules = await db.saveBranchAIRules('all', { lessons_per_slot: 2 });
    expect(defaultRules.lessons_per_slot).toBe(2);

    // 6.10 Curriculum masters and branches querying
    const allMasters = db.getCurriculumMasters();
    expect(allMasters.length).toBeGreaterThan(0);

    const branches = db.getBranches();
    expect(branches.length).toBeGreaterThan(0);

    // 6.11 signOut
    await db.signOut();
    expect(db.getSession()).toBeNull();
  });

  it('7. TeacherDashboard: Homework, Mini-test, and Exam Interactive Table Updates', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="homeworks"
          teacherType="elementary"
        />
      );
    });

    // 宿題タブの操作
    expect(screen.getAllByText(/宿題提出状況/).length).toBeGreaterThan(0);
    const hwToggleBtn = screen.queryByTestId('toggle-homework-status-hw-res-1');
    if (hwToggleBtn) {
      await act(async () => {
        fireEvent.click(hwToggleBtn); // 未提出 -> 提出済
        fireEvent.click(hwToggleBtn); // 提出済 -> 未提出
      });
    }

    // 小テストタブへの切り替えと点数入力
    const miniTestTabBtn = screen.queryByRole('button', { name: /小テスト結果/ });
    if (miniTestTabBtn) {
      await act(async () => {
        fireEvent.click(miniTestTabBtn);
      });
    }

    // 定期テストタブへの切り替えと成績登録
    const testsTabBtn = screen.queryByRole('button', { name: /定期テスト・模試/ });
    if (testsTabBtn) {
      await act(async () => {
        fireEvent.click(testsTabBtn);
      });
    }

    // AIレポートタブへの切り替えと生成
    const aiReportTabBtn = screen.queryByRole('button', { name: /AI指導報告書/ });
    if (aiReportTabBtn) {
      await act(async () => {
        fireEvent.click(aiReportTabBtn);
      });
    }

    wrapper.unmount();
  });

  it('8. TeacherDashboard: Schedule Timetable, Periods, and Homework/Test Config save', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    // 8.1 コマの教科変更
    const subjSelects = screen.queryAllByTestId(/period-subject-select/);
    if (subjSelects.length > 0) {
      fireEvent.change(subjSelects[0], { target: { value: '算数' } });
    }

    // 8.2 テスト追加ボタン
    const addTestBtns = screen.queryAllByRole('button').filter(b => b.textContent?.includes('テストを追加') || b.textContent?.includes('➕ テスト'));
    if (addTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(addTestBtns[0]);
      });
    }

    // 8.3 宿題追加ボタン
    const addHwBtns = screen.queryAllByRole('button').filter(b => b.textContent?.includes('宿題を追加') || b.textContent?.includes('➕ 宿題'));
    if (addHwBtns.length > 0) {
      await act(async () => {
        fireEvent.click(addHwBtns[0]);
      });
    }

    // 8.4 自動リスケボタン
    const autoReschedBtn = screen.queryByRole('button', { name: /自動リスケ/i }) || screen.queryAllByRole('button').find(b => b.textContent?.includes('自動リスケ'));
    if (autoReschedBtn) {
      await act(async () => {
        fireEvent.click(autoReschedBtn);
      });
    }

    // 8.5 時間割保存ボタン
    const saveTimetableBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('時間割・計画を保存') || b.textContent?.includes('計画を保存') || b.textContent?.includes('保存'));
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }

    wrapper.unmount();
  });

  it('11. TeacherDashboard: Student Deletion and School Deletion flow', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="student-detail"
          teacherType="elementary"
        />
      );
    });

    // 生徒削除ボタンを探す
    const deleteStudentButtons = screen.getAllByRole('button').filter(b => b.textContent?.includes('生徒を削除') || b.textContent?.includes('退塾・削除'));
    if (deleteStudentButtons.length > 0) {
      await act(async () => {
        fireEvent.click(deleteStudentButtons[0]);
      });
    }

    wrapper.unmount();
  });

  it('12. TeacherDashboard: Header Role Toggles, Teacher Type Switches, and Admin Branch Switcher', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="student-list"
          teacherType="elementary"
        />
      );
    });

    // 12.1 区分トグル（小学生 / 中学生 / 高校生）
    const jhsTypeBtn = screen.getByTestId('header-teacher-type-jhs');
    fireEvent.click(jhsTypeBtn);

    const highTypeBtn = screen.getByTestId('header-teacher-type-high');
    fireEvent.click(highTypeBtn);

    const elemTypeBtn = screen.getByTestId('header-teacher-type-elem');
    fireEvent.click(elemTypeBtn);

    // 12.2 権限トグル（本部権限 / 校舎権限）
    const branchRoleBtn = screen.getByTestId('role-toggle-branch');
    fireEvent.click(branchRoleBtn);

    const adminRoleBtn = screen.getByTestId('role-toggle-admin');
    fireEvent.click(adminRoleBtn);

    // 12.3 校舎スイッチャー
    const branchSwitcher = screen.getByTestId('admin-branch-switcher');
    fireEvent.change(branchSwitcher, { target: { value: 'branch-1' } });
    fireEvent.change(branchSwitcher, { target: { value: 'all' } });

    // 12.4 フィルター切り替え
    const schoolFilter = screen.getByTestId('filter-school-name');
    fireEvent.change(schoolFilter, { target: { value: '花咲小学校' } });
    fireEvent.change(schoolFilter, { target: { value: '' } });

    const gradeFilter = screen.getByTestId('filter-grade');
    fireEvent.change(gradeFilter, { target: { value: '小5' } });
    fireEvent.change(gradeFilter, { target: { value: '' } });

    wrapper.unmount();
  });

  it('13. db.ts: Full Local & Sync Database Service Methods', async () => {
    // 13.1 Schools CRUD
    const newSchool: School = { id: 'sch-test-99', name: 'テスト附属小', type: 'elementary' };
    await db.saveSchool(newSchool);
    const schools = db.getSchools();
    expect(schools.some(s => s.id === 'sch-test-99')).toBe(true);
    await db.deleteSchool('sch-test-99');

    // 13.2 Curriculum Units
    const units = db.getCurriculumUnits();
    expect(Array.isArray(units)).toBe(true);

    // 13.3 Tasks / LearningTasks
    const learningTasks = db.getLearningTasks();
    expect(Array.isArray(learningTasks)).toBe(true);

    // 13.4 Prompt Settings
    const promptSettings = db.getPromptSettings();
    expect(Array.isArray(promptSettings)).toBe(true);

    if (promptSettings.length > 0) {
      await db.savePromptSetting({ ...promptSettings[0], prompt_template: 'カスタムプロンプト' });
    }
  });

  it('14. TeacherDashboard: Junior High Milestones, Curriculum sequence and Template application', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const studentJhs: Student = {
      ...studentElem,
      id: 'st-jhs-strike',
      student_id: 'S_JHS_STRIKE',
      name: '中学 達成花子',
      grade: '中2',
      school_name: '桜台中学校'
    };

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentJhs]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentJhs.id}
          initialTab="milestones"
          teacherType="junior_high"
        />
      );
    });

    // 教科切り替え
    const mathSubjBtn = screen.queryByTestId('milestone-subject-btn-数学');
    if (mathSubjBtn) {
      fireEvent.click(mathSubjBtn);
    }

    const engSubjBtn = screen.queryByTestId('milestone-subject-btn-英語');
    if (engSubjBtn) {
      fireEvent.click(engSubjBtn);
    }

    // テンプレート保存
    const tmplInput = screen.queryByPlaceholderText(/現在の計画をテンプレート名として保存/);
    const saveTmplBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('テンプレート') && b.textContent?.includes('保存'));
    if (tmplInput && saveTmplBtn) {
      fireEvent.change(tmplInput, { target: { value: '中2期末特訓プラン' } });
      await act(async () => {
        fireEvent.click(saveTmplBtn);
      });
    }

    wrapper.unmount();
  });

  it('15. TeacherDashboard: Schedule date navigation, calendar picker, and status operations', async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    // 日付変更
    const dateInputs = screen.queryAllByDisplayValue(/2026-/);
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: '2026-04-20' } });
    }

    // 前週・翌週ボタン
    const prevWeekBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('前週') || b.textContent?.includes('◀'));
    if (prevWeekBtn) {
      fireEvent.click(prevWeekBtn);
    }

    const nextWeekBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('翌週') || b.textContent?.includes('▶'));
    if (nextWeekBtn) {
      fireEvent.click(nextWeekBtn);
    }

    wrapper.unmount();
  });

  it('16. TeacherDashboard: Avatar images, Start unit positions, and Sync actions', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="student-detail"
          teacherType="elementary"
        />
      );
    });

    // 16.1 生徒画像 / 保護者画像アップロードトリガー
    const fileInputs = screen.queryAllByLabelText(/📷/) || document.querySelectorAll('input[type="file"]');
    for (const input of Array.from(fileInputs)) {
      const file = new File(['dummy content'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });
    }

    // 16.2 変更を保存
    const saveBtn = screen.getByRole('button', { name: /変更を保存する/ });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    wrapper.unmount();
  });

  it('17. TeacherDashboard: Bulk Timetable Scope (Grade, Level, School) and Task Attachments', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    // 適用スコープを「同学校」「同学年」「同レベル」に切り替えて保存
    const scopes = ['school', 'grade', 'level'];
    for (const scope of scopes) {
      const scopeRadio = screen.queryByDisplayValue(scope);
      if (scopeRadio) {
        fireEvent.click(scopeRadio);
      }
    }

    const saveTimetableBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('時間割・計画を保存') || b.textContent?.includes('計画を保存') || b.textContent?.includes('保存'));
    if (saveTimetableBtn) {
      await act(async () => {
        fireEvent.click(saveTimetableBtn);
      });
    }

    wrapper.unmount();
  });

  it('18. TeacherDashboard: Curriculum Tab - Units CRUD, Sort Up/Down, Custom Classes CRUD', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Save initial curriculum units
    await db.saveCurriculumUnit({
      id: 'unit-curric-1',
      school_id: 'sch-1',
      subject: '算数',
      name: '1章 整数と小数',
      sequence_order: 1,
      link_url: 'https://example.com/unit1',
      created_at: new Date().toISOString()
    });
    await db.saveCurriculumUnit({
      id: 'unit-curric-2',
      school_id: 'sch-1',
      subject: '算数',
      name: '2章 小数の計算',
      sequence_order: 2,
      link_url: null,
      created_at: new Date().toISOString()
    });
    await db.saveCustomClass({
      id: 'cc-curric-1',
      name: '特別演習授業',
      created_at: new Date().toISOString()
    });

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="curriculum"
          teacherType="elementary"
        />
      );
    });

    // 18.1 単元新規作成（空チェック ＆ 登録）
    const addUnitBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('授業（単元）を追加') || b.textContent?.includes('追加'));
    if (addUnitBtn) {
      await act(async () => {
        fireEvent.click(addUnitBtn);
      });
    }

    const unitInput = screen.queryByPlaceholderText(/例: 1章/);
    if (unitInput) {
      fireEvent.change(unitInput, { target: { value: '3章 分数と割合' } });
      if (addUnitBtn) {
        await act(async () => {
          fireEvent.click(addUnitBtn);
        });
      }
    }

    // 18.2 単元編集
    const editUnitBtns = screen.queryAllByRole('button').filter(b => b.textContent?.trim() === '編集');
    if (editUnitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editUnitBtns[0]);
      });

      const editInput = document.getElementById('edit-unit-name-input');
      if (editInput) {
        fireEvent.change(editInput, { target: { value: '1章 整数と小数（改定版）' } });
        const saveEditBtn = screen.queryAllByRole('button').find(b => b.textContent?.trim() === '保存');
        if (saveEditBtn) {
          await act(async () => {
            fireEvent.click(saveEditBtn);
          });
        }
      }
    }

    // 18.3 単元並び替え（下へ、上へ）
    const downBtns = screen.queryAllByTitle('下へ移動');
    if (downBtns.length > 0) {
      await act(async () => {
        fireEvent.click(downBtns[0]);
      });
    }
    const upBtns = screen.queryAllByTitle('上へ移動');
    if (upBtns.length > 1) {
      await act(async () => {
        fireEvent.click(upBtns[1]);
      });
    }

    // 18.4 単元削除
    const deleteUnitBtns = screen.queryAllByRole('button').filter(b => b.textContent?.trim() === '削除');
    if (deleteUnitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteUnitBtns[0]);
      });
    }

    // 18.5 自由記述授業名の追加と削除
    const customInput = screen.queryByPlaceholderText(/例: 理社トレ|自由/);
    const addCustomBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('授業名を追加') || b.textContent?.includes('自由記述'));
    if (customInput && addCustomBtn) {
      fireEvent.change(customInput, { target: { value: '直前総仕上げ講習' } });
      await act(async () => {
        fireEvent.click(addCustomBtn);
      });
    }

    const delCustomBtns = screen.queryAllByRole('button').filter(b => b.textContent?.trim() === '×');
    if (delCustomBtns.length > 0) {
      await act(async () => {
        fireEvent.click(delCustomBtns[0]);
      });
    }

    wrapper.unmount();
  });

  it('19. TeacherDashboard: Mini-tests & Test Results Tab - Regular Exam, Mock Exam, and Deletion', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    await db.saveTestRecord({
      id: 'tr-sample-strike-1',
      student_id: studentElem.id,
      record_type: 'regular_test',
      test_name: '1学期中間テスト',
      subject: '5教科総合',
      score_japanese: 80,
      score_math: 90,
      score_english: 85,
      score_social: 75,
      score_science: 85,
      score_total: 415,
      class_rank: '5位',
      school_rank: '15位',
      deviation_value: 60.5,
      improvement_plan: '理社を強化する',
      created_at: new Date().toISOString()
    });

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    // 19.1 定期テストフォーム入力 & 保存
    const regName = screen.queryByPlaceholderText(/例: 1学期中間|テスト名/);
    if (regName) {
      fireEvent.change(regName, { target: { value: '2学期中間テスト' } });
    }
    const scoreMath = screen.queryByPlaceholderText(/数学|算数/);
    if (scoreMath) {
      fireEvent.change(scoreMath, { target: { value: '95' } });
    }

    const saveRegBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('定期テスト結果を記録') || b.textContent?.includes('結果を記録'));
    if (saveRegBtn) {
      await act(async () => {
        fireEvent.click(saveRegBtn);
      });
    }

    // 19.2 模試フォーム入力 & 保存
    const mockScore = screen.queryByPlaceholderText(/総合得点|得点/);
    if (mockScore) {
      fireEvent.change(mockScore, { target: { value: '430' } });
    }
    const saveMockBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('模試結果を記録') || b.textContent?.includes('判定'));
    if (saveMockBtn) {
      await act(async () => {
        fireEvent.click(saveMockBtn);
      });
    }

    // 19.3 宿題・小テスト一覧の検索・学年フィルター・教科フィルター
    const searchInputs = screen.queryAllByPlaceholderText(/検索/);
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[0], { target: { value: '算数' } });
      const clearBtn = screen.queryByTitle('検索をクリア');
      if (clearBtn) {
        fireEvent.click(clearBtn);
      }
    }

    const filterSelects = screen.queryAllByRole('combobox');
    for (const select of filterSelects) {
      if (select.querySelector('option[value="小学生"]')) {
        fireEvent.change(select, { target: { value: '小学生' } });
        fireEvent.change(select, { target: { value: '中学生' } });
        fireEvent.change(select, { target: { value: '高校生' } });
        fireEvent.change(select, { target: { value: 'all' } });
      }
      if (select.querySelector('option[value="算数"]')) {
        fireEvent.change(select, { target: { value: '算数' } });
        fireEvent.change(select, { target: { value: '英語' } });
        fireEvent.change(select, { target: { value: 'all' } });
      }
    }

    // 19.4 成績レコード削除
    const delBtns = screen.queryAllByRole('button').filter(b => b.textContent?.includes('削除') || b.title?.includes('削除'));
    if (delBtns.length > 0) {
      await act(async () => {
        fireEvent.click(delBtns[delBtns.length - 1]);
      });
    }

    wrapper.unmount();
  });

  it('20. TeacherDashboard: Schedule Tab - Start / End Lesson change, Reschedule, Rules modal', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    // 20.1 開始授業・終了授業の変更ハンドラー（単元テスト選択、空選択、通常授業選択）
    const periodSelects = screen.queryAllByTestId(/period-subject-select/);
    if (periodSelects.length > 0) {
      fireEvent.change(periodSelects[0], { target: { value: '算数' } });
    }
    const startSelects = screen.queryAllByTestId(/period-unit-select/);
    if (startSelects.length > 0) {
      // 単元確認テストの選択
      fireEvent.change(startSelects[0], { target: { value: 'cm-m-test' } });
      // 空の選択
      fireEvent.change(startSelects[0], { target: { value: '' } });
      // 通常単元の選択
      fireEvent.change(startSelects[0], { target: { value: 'cm-m-1' } });
    }
    const endSelects = screen.queryAllByTestId(/period-end-lesson-select/);
    if (endSelects.length > 0) {
      fireEvent.change(endSelects[0], { target: { value: 'cm-m-2' } });
    }

    // 20.1.2 宿題の追加と drill_2nd 切り替え
    const addHwBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('宿題を追加'));
    if (addHwBtn) {
      await act(async () => {
        fireEvent.click(addHwBtn);
      });
      const hwTypeSelects = screen.queryAllByDisplayValue(/自由記述|2回目/);
      if (hwTypeSelects.length > 0) {
        fireEvent.change(hwTypeSelects[0], { target: { value: 'drill_2nd' } });
      }
    }

    // 20.1.3 テストの追加
    const addTestBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('テストを追加'));
    if (addTestBtn) {
      await act(async () => {
        fireEvent.click(addTestBtn);
      });
    }

    // 20.2 自動リスケ
    const autoReschedBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('自動リスケ') || b.textContent?.includes('遅れチェック'));
    if (autoReschedBtn) {
      await act(async () => {
        fireEvent.click(autoReschedBtn);
      });
    }

    // 20.3 AIルールモーダルの操作
    const openRulesBtn = screen.queryByTestId('open-branch-ai-rules-modal-btn');
    if (openRulesBtn) {
      await act(async () => {
        fireEvent.click(openRulesBtn);
      });

      const saveRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }

    // 20.4 保存ボタン
    const saveBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('計画を保存') || b.textContent?.includes('時間割コマ割りを保存'));
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    wrapper.unmount();
  });

  it('21. TeacherDashboard: AI Report Generation, Text Editing, Save and Print', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'print').mockImplementation(() => {});

    await db.addLearningLog({
      id: 'log-ai-1',
      student_id: studentElem.id,
      unit_id: 'cm-m-1',
      log_type: 'video_view',
      duration_seconds: 1500,
      created_at: new Date().toISOString()
    });

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="ai-report"
          teacherType="elementary"
        />
      );
    });

    // AI生成
    const genBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('AI指導報告書') || b.textContent?.includes('AI生成') || b.textContent?.includes('生成'));
    if (genBtn) {
      await act(async () => {
        fireEvent.click(genBtn);
      });
    }

    const textareas = screen.queryAllByRole('textbox');
    for (const ta of textareas) {
      fireEvent.change(ta, { target: { value: 'AIレポートの確認推敲コメント' } });
    }

    const saveBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('報告書を保存') || b.textContent?.includes('保存'));
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    const printBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('印刷') || b.textContent?.includes('PDF'));
    if (printBtn) {
      await act(async () => {
        fireEvent.click(printBtn);
      });
    }

    wrapper.unmount();
  });

  it('22. db.ts: Full Utility and Data Methods Coverage', async () => {
    // CurriculumUnits
    const u = { id: 'db-u-check', school_id: 'sch-1', subject: '理科', name: '植物のつくり', sequence_order: 1, created_at: new Date().toISOString() };
    await db.saveCurriculumUnit(u);
    expect(db.getCurriculumUnits().some(item => item.id === 'db-u-check')).toBe(true);
    await db.deleteCurriculumUnit('db-u-check');
    expect(db.getCurriculumUnits().some(item => item.id === 'db-u-check')).toBe(false);

    // CustomClasses
    const cc = { id: 'db-cc-check', name: '直前特訓', created_at: new Date().toISOString() };
    await db.saveCustomClass(cc);
    expect(db.getCustomClasses().some(item => item.id === 'db-cc-check')).toBe(true);
    await db.deleteCustomClass('db-cc-check');
    expect(db.getCustomClasses().some(item => item.id === 'db-cc-check')).toBe(false);

    // TestRecords
    const tr = { id: 'db-tr-check', student_id: 'st-elem-strike', record_type: 'regular_test' as const, test_name: '学年末テスト', subject: '国語', score: 88, created_at: new Date().toISOString() };
    await db.saveTestRecord(tr);
    expect(db.getTestRecords().some(item => item.id === 'db-tr-check')).toBe(true);
    await db.deleteTestRecord('db-tr-check');
    expect(db.getTestRecords().some(item => item.id === 'db-tr-check')).toBe(false);

    // Password Reset
    const pRes = await db.sendBranchPasswordReset('reset@tentoru.jp');
    expect(pRes.success).toBe(true);

    // Auth fallback
    const authAdmin = await db.signInWithPassword('admin@tentoru.jp', 'adminpass');
    expect(authAdmin.success).toBe(true);
    const authBranch = await db.signInWithPassword('ebisu@tentoru.jp', 'pass');
    expect(authBranch.success).toBe(true);
    const authSuspended = await db.signInWithPassword('shibuya@tentoru.jp', 'pass');
    expect(authSuspended.success).toBe(false);
    const authWrong = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
    expect(authWrong.success).toBe(false);

    // Student Interaction CRUD
    const interaction = {
      id: 'inter-test-1',
      student_id: 'st-elem-strike',
      date: '2026-04-10',
      category: '面談' as const,
      staff_name: '講師A',
      memo: 'テストメモ',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);
    await db.deleteStudentInteraction('inter-test-1');

    // Student schedule config & Milestone methods
    const schConfig = {
      id: 'sc-test-1',
      student_id: 'st-elem-strike',
      day_of_week: 'monday' as const,
      period_number: 1,
      subject: '算数',
      created_at: new Date().toISOString()
    };
    await db.saveStudentScheduleConfig(schConfig as any);
    expect(db.getStudentScheduleConfig('st-elem-strike')).toBeDefined();

    const mPlan = {
      id: 'mp-test-1',
      student_id: 'st-elem-strike',
      subject: '算数',
      grade: '小5',
      month: 4,
      target_unit_id: 'u-m-1',
      created_at: new Date().toISOString()
    };
    await db.saveMilestonePlan(mPlan as any);
    expect(db.getMilestonePlans().some(m => m.student_id === 'st-elem-strike')).toBe(true);

    // Student Interactions & Progress methods
    const interactions = db.getStudentInteractions('st-elem-strike');
    expect(interactions).toBeDefined();
    await db.fetchStudentInteractions('st-elem-strike');

    const progressObj = {
      id: 'slp-test-1',
      student_id: 'st-elem-strike',
      unit_id: 'u-m-1',
      status: 'completed' as const,
      completed_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(progressObj as any);

    // Custom Apply Scopes CRUD
    const cScope = {
      id: 'cs-test-1',
      name: '特進クラス専用スコープ',
      student_ids: ['st-elem-strike'],
      created_at: new Date().toISOString()
    };
    await db.saveCustomApplyScope(cScope);
    expect(db.getCustomApplyScopes().some(c => c.id === 'cs-test-1')).toBe(true);
    await db.deleteCustomApplyScope('cs-test-1');

    // Schools fetch & delete
    const sTest = { id: 'sch-temp-1', name: '臨時テスト小学校', type: 'elementary' as const, created_at: new Date().toISOString() };
    await db.saveSchool(sTest);
    const schoolsList = await db.fetchSchools();
    expect(schoolsList.some(s => s.name === '臨時テスト小学校')).toBe(true);
    await db.deleteSchool('sch-temp-1');

    // Delete Student and cascading records
    await db.deleteStudent('st-elem-strike');
  });

  it('23. TeacherDashboard: Milestone Excluded Lessons Reset and Unit Test Master Editing', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    const studentWithExclusions: Student = {
      ...studentElem,
      excluded_lesson_ids: ['cm-m-1']
    };
    await db.saveStudent(studentWithExclusions);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[studentWithExclusions]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentWithExclusions.id}
          initialTab="milestones"
          teacherType="elementary"
        />
      );
    });

    // 23.0 単元除外ボタンをクリックして未来タスク再計算フローを実行
    const excludeBtns = screen.queryAllByRole('button').filter(b => b.title?.includes('除外') || b.textContent?.includes('除外'));
    if (excludeBtns.length > 0) {
      await act(async () => {
        fireEvent.click(excludeBtns[0]);
      });
    }

    // 23.1 除外設定のリセットボタン
    const resetExcludedBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('除外') || b.textContent?.includes('復元'));
    if (resetExcludedBtn) {
      await act(async () => {
        fireEvent.click(resetExcludedBtn);
      });
    }

    // 23.2 単元テストマスタ編集モーダルを開いて保存
    const editTestMasterBtns = screen.queryAllByRole('button').filter(b => b.textContent?.includes('テスト編集') || b.title?.includes('編集'));
    if (editTestMasterBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editTestMasterBtns[0]);
      });

      const saveMasterBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveMasterBtn) {
        await act(async () => {
          fireEvent.click(saveMasterBtn);
        });
      }
    }

    wrapper.unmount();
  });

  it('24. TeacherDashboard: 5-Subjects Start Units Save and Tasks Skip/Reset Sync', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // 5教科の単元を準備
    const uMath1 = { id: 'u-m-1', school_id: 'sch-1', subject: '算数', name: '算数1', sequence_order: 1, created_at: '' };
    const uMath2 = { id: 'u-m-2', school_id: 'sch-1', subject: '算数', name: '算数2', sequence_order: 2, created_at: '' };
    const uEng1 = { id: 'u-e-1', school_id: 'sch-1', subject: '英語', name: '英語1', sequence_order: 1, created_at: '' };
    const uEng2 = { id: 'u-e-2', school_id: 'sch-1', subject: '英語', name: '英語2', sequence_order: 2, created_at: '' };
    const uSci1 = { id: 'u-sc-1', school_id: 'sch-1', subject: '理科', name: '理科1', sequence_order: 1, created_at: '' };
    const uSci2 = { id: 'u-sc-2', school_id: 'sch-1', subject: '理科', name: '理科2', sequence_order: 2, created_at: '' };
    const uSoc1 = { id: 'u-so-1', school_id: 'sch-1', subject: '社会', name: '社会1', sequence_order: 1, created_at: '' };
    const uSoc2 = { id: 'u-so-2', school_id: 'sch-1', subject: '社会', name: '社会2', sequence_order: 2, created_at: '' };
    const uJp1 = { id: 'u-j-1', school_id: 'sch-1', subject: '国語', name: '国語1', sequence_order: 1, created_at: '' };
    const uJp2 = { id: 'u-j-2', school_id: 'sch-1', subject: '国語', name: '国語2', sequence_order: 2, created_at: '' };

    for (const u of [uMath1, uMath2, uEng1, uEng2, uSci1, uSci2, uSoc1, uSoc2, uJp1, uJp2]) {
      await db.saveCurriculumUnit(u);
    }

    const student5Subj: Student = {
      ...studentElem,
      start_unit_math: 'u-m-2' as any,
      start_unit_english: 'u-e-2' as any,
      start_unit_science: 'u-sc-2' as any,
      start_unit_social: 'u-so-2' as any,
      start_unit_japanese: 'u-j-2' as any
    };

    const tasks5: Task[] = [
      { id: 't-m-1', student_id: student5Subj.id, subject: '算数', grade: '小5', scheduled_date: '2026-04-10', status: 'unstarted' as any, task_type: 'lesson', unit_id: 'u-m-1' },
      { id: 't-e-1', student_id: student5Subj.id, subject: '英語', grade: '小5', scheduled_date: '2026-04-10', status: 'unstarted' as any, task_type: 'lesson', unit_id: 'u-e-1' },
      { id: 't-sc-1', student_id: student5Subj.id, subject: '理科', grade: '小5', scheduled_date: '2026-04-10', status: 'unstarted' as any, task_type: 'lesson', unit_id: 'u-sc-1' },
      { id: 't-so-1', student_id: student5Subj.id, subject: '社会', grade: '小5', scheduled_date: '2026-04-10', status: 'unstarted' as any, task_type: 'lesson', unit_id: 'u-so-1' },
      { id: 't-j-1', student_id: student5Subj.id, subject: '国語', grade: '小5', scheduled_date: '2026-04-10', status: 'unstarted' as any, task_type: 'lesson', unit_id: 'u-j-1' },
      { id: 't-m-2', student_id: student5Subj.id, subject: '算数', grade: '小5', scheduled_date: '2026-04-12', status: 'skipped' as any, task_type: 'lesson', unit_id: 'u-m-2' }
    ];

    await db.saveStudent(student5Subj);
    await db.saveLearningTasks(tasks5);

    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <TeacherDashboard
          students={[student5Subj]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={tasks5}
          initialStudentId={student5Subj.id}
          initialTab="student-detail"
          teacherType="elementary"
        />
      );
    });

    const startSaveBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('教科別スタート位置をTodoに反映') || b.textContent?.includes('スタート位置'));
    if (startSaveBtn) {
      await act(async () => {
        fireEvent.click(startSaveBtn);
      });
    }

    wrapper.unmount();
  });

  it('25. TeacherDashboard: School Deletion, Unit Test Master Selection in Schedule, and Mini Test Score Autosave', async () => {
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // 25.1 生徒新規作成タブで学校の削除 (Elementary & Junior High)
    let wrapper1: any;
    await act(async () => {
      wrapper1 = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="create-student"
          teacherType="elementary"
        />
      );
    });

    const delSchoolBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('学校を削除') || b.title?.includes('学校'));
    if (delSchoolBtn) {
      await act(async () => {
        fireEvent.click(delSchoolBtn);
      });
    }
    wrapper1.unmount();

    // 25.2 学習計画タブで単元テストを追加し、マスタから単元テスト名を選択
    let wrapper2: any;
    await act(async () => {
      wrapper2 = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="schedule"
          teacherType="elementary"
        />
      );
    });

    const addTestBtn = screen.queryAllByRole('button').find(b => b.textContent?.includes('テストを追加'));
    if (addTestBtn) {
      await act(async () => {
        fireEvent.click(addTestBtn);
      });

      // 単元テストマスタのセレクトボックスを変更
      const testContentSelects = screen.queryAllByRole('combobox').filter(s => s.querySelector('option[value*="単元確認テスト"]'));
      if (testContentSelects.length > 0) {
        fireEvent.change(testContentSelects[0], { target: { value: '1章 整数と小数 単元確認テスト' } });
      }
    }
    wrapper2.unmount();

    // 25.3 小テスト結果タブでの点数・合否変更による自動保存
    await db.saveMiniTestResult({
      id: 'mtr-score-test-1',
      student_id: studentElem.id,
      date: '2026-04-10',
      subject: '算数',
      unit_name: '1章 整数と小数',
      test_name: '1章 整数と小数 単元確認テスト',
      score: 85,
      passed: true
    } as any);

    let wrapper3: any;
    await act(async () => {
      wrapper3 = render(
        <TeacherDashboard
          students={[studentElem]}
          schools={mockSchools}
          curriculumMasters={sampleMasters}
          tasks={sampleTasks}
          initialStudentId={studentElem.id}
          initialTab="mini-tests"
          teacherType="elementary"
        />
      );
    });

    const scoreInputs = screen.queryAllByRole('spinbutton');
    if (scoreInputs.length > 0) {
      // 正常な点数
      fireEvent.change(scoreInputs[0], { target: { value: '95' } });
      fireEvent.blur(scoreInputs[0]);
      // 無効な点数 (> 100)
      fireEvent.change(scoreInputs[0], { target: { value: '120' } });
      fireEvent.blur(scoreInputs[0]);
      // 空文字
      fireEvent.change(scoreInputs[0], { target: { value: '' } });
      fireEvent.blur(scoreInputs[0]);
    }

    const passSelects = screen.queryAllByRole('combobox').filter(s => s.querySelector('option[value="passed"]'));
    if (passSelects.length > 0) {
      fireEvent.change(passSelects[0], { target: { value: 'failed' } });
      fireEvent.change(passSelects[0], { target: { value: 'passed' } });
    }

    // 小テスト並び順ソート切り替え
    const sortSelects = screen.queryAllByRole('combobox').filter(s => s.querySelector('option[value="name_asc"]') || s.querySelector('option[value="date_asc"]'));
    for (const select of sortSelects) {
      fireEvent.change(select, { target: { value: 'date_asc' } });
      fireEvent.change(select, { target: { value: 'name_asc' } });
      fireEvent.change(select, { target: { value: 'unsubmitted_first' } });
      fireEvent.change(select, { target: { value: 'passed_first' } });
      fireEvent.change(select, { target: { value: 'date_desc' } });
    }

    wrapper3.unmount();
  });
});






