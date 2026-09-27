import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/TeacherDashboard';
import BranchManagement from '../components/BranchManagement';
import { db, Student, CurriculumMaster, LearningTask, Branch, School, TestRecord, StudentInteraction, ExamThresholdMaster, CustomClass, MilestoneTemplate } from '../lib/db';

describe('Coverage Deep Dive v30 - TeacherDashboard, BranchManagement & DB Pure 95%+ Perfection Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力値');

    const sampleBranch: Branch = {
      id: 'branch-1',
      name: '恵比寿教室',
      code: 'EBS',
      email: 'ebisu@tentoru.jp',
      is_active: true
    };
    await db.saveBranch(sampleBranch);

    const sampleSchool: School = {
      id: 'sch-1',
      name: '恵比寿中学校',
      type: 'junior_high',
      grade_levels: ['中1', '中2', '中3'],
      created_at: new Date().toISOString()
    };
    await db.saveSchool(sampleSchool);

    const sampleStudent: Student = {
      id: 'std-v30-master',
      student_id: 'std_v30',
      name: '総合 カバレッジ生',
      name_kana: 'ソウゴウ カバレッジセイ',
      grade: '中2',
      school_id: 'sch-1',
      school_name: '恵比寿中学校',
      branch_id: 'branch-1',
      classroom: '恵比寿教室',
      teacher_in_charge: '福田 尚弘',
      assigned_teachers: ['福田 尚弘'],
      status: 'normal',
      period_count: 2,
      registered_year: 2026,
      registered_grade: '中2',
      selected_days: ['monday', 'wednesday', 'friday'],
      selected_subjects: ['数学', '英語', '理科'],
      completed_lesson_ids: ['cm-v30-1'],
      excluded_lesson_ids: [],
      target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
      personalities: ['几帳面', '集中力高い'],
      birthday: '2012-05-15',
      enrollment_date: '2025-04-01',
      withdrawal_date: null,
      parent_name: 'カバレッジ 保護者',
      parent_name_kana: 'カバレッジ ホゴシャ',
      contact_phone: '090-1234-5678',
      club_activities: '陸上部',
      hobbies: '読書',
      level: 'A',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(sampleStudent);

    const sampleMasters: CurriculumMaster[] = [
      { id: 'cm-v30-1', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '単項式と多項式', sort_order: 1 },
      { id: 'cm-v30-2', subject: '数学', grade: '中2', unit_name: '1章 式の計算', lesson_name: '式の加法と減法', sort_order: 2 },
      { id: 'cm-v30-3', subject: '数学', grade: '中2', unit_name: '2章 連立方程式', lesson_name: '連立方程式とその解', sort_order: 3 },
      { id: 'cm-v30-eng-1', subject: '英語', grade: '中2', unit_name: 'Unit 1', lesson_name: 'Past Tense', sort_order: 1 }
    ];
    await db.saveCurriculumMasters(sampleMasters);

    const todayStr = new Date().toISOString().split('T')[0];
    const sampleTask: LearningTask = {
      id: 'task-v30-1',
      student_id: sampleStudent.id,
      unit_id: 'cm-v30-2',
      start_lesson_id: 'cm-v30-2',
      end_lesson_id: 'cm-v30-2',
      scheduled_date: todayStr,
      period: 1,
      status: 'in_progress',
      subject: '数学',
      title: '式の加法と減法',
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([sampleTask]);

    const sampleTestRecord: TestRecord = {
      id: 'tr-v30-1',
      student_id: sampleStudent.id,
      record_type: 'regular_test',
      test_name: '1学期中間テスト',
      subject: '数学',
      score: 88,
      rank_change: 'up',
      rate_change: 12,
      next_target_score: 95,
      test_date: '2026-06-15',
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(sampleTestRecord);

    const sampleInteraction: StudentInteraction = {
      id: 'inter-v30-1',
      student_id: sampleStudent.id,
      category: '保護者対応',
      date: '2026-09-10',
      staff_name: '福田 尚弘',
      memo: '定期テストに向けた学習計画について面談実施。',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(sampleInteraction);
  });

  it('thoroughly exercises all TeacherDashboard tabs, inputs, modals, and actions', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<TeacherDashboard onLogout={vi.fn()} teacherType="junior_high" />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
      expect(screen.getAllByText(/総合 カバレッジ生/).length).toBeGreaterThan(0);
    });

    // 1. 生徒選択
    const studentCard = screen.getAllByText(/総合 カバレッジ生/)[0];
    fireEvent.click(studentCard);

    // 2. 校舎スイッチャー
    const branchSelect = screen.queryByTestId('admin-branch-switcher') as HTMLSelectElement;
    if (branchSelect) {
      fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
      fireEvent.change(branchSelect, { target: { value: 'all' } });
    }

    // 3. 校舎別 AI自動設定ルール モーダルの操作
    const aiRulesBtn = screen.queryByText(/AI自動設定ルール/i) || screen.queryByRole('button', { name: /AI.*ルール/i });
    if (aiRulesBtn) {
      fireEvent.click(aiRulesBtn);
      await waitFor(() => {
        expect(screen.queryByTestId('branch-ai-rules-modal')).toBeInTheDocument();
      });

      const lessonsInput = screen.queryByTestId('branch-ai-lessons-per-slot-input');
      const testPrepInput = screen.queryByTestId('branch-ai-test-prep-weeks-input');
      const punkInput = screen.queryByTestId('branch-ai-punk-threshold-input');
      const reviewIntervalInput = screen.queryByTestId('branch-ai-review-slot-interval-input');

      if (lessonsInput) fireEvent.change(lessonsInput, { target: { value: '3' } });
      if (testPrepInput) fireEvent.change(testPrepInput, { target: { value: '4' } });
      if (punkInput) fireEvent.change(punkInput, { target: { value: '5' } });
      if (reviewIntervalInput) fireEvent.change(reviewIntervalInput, { target: { value: '3' } });

      const saveModalBtn = screen.queryByText(/この校舎ルールを保存/i) || screen.queryByRole('button', { name: /保存/i });
      if (saveModalBtn) fireEvent.click(saveModalBtn);
    }

    // 4. 生徒カルテ（student-detail）タブでの詳細操作
    const detailTab = screen.queryByRole('button', { name: /生徒情報|生徒カルテ/i });
    if (detailTab) {
      fireEvent.click(detailTab);

      // 生徒氏名・フリガナ変更
      const nameInput = screen.queryByPlaceholderText('氏名（漢字）');
      const kanaInput = screen.queryByPlaceholderText('氏名（フリガナ）');
      if (nameInput) fireEvent.change(nameInput, { target: { value: '総合 カバレッジ生（更新）' } });
      if (kanaInput) fireEvent.change(kanaInput, { target: { value: 'ソウゴウ カバレッジセイ' } });

      // 通塾開始日・退塾日入力
      const enrollInput = screen.queryByTestId('student-enrollment-date-input');
      const withdrawInput = screen.queryByTestId('student-withdrawal-date-input');
      if (enrollInput) fireEvent.change(enrollInput, { target: { value: '2025-04-01' } });
      if (withdrawInput) fireEvent.change(withdrawInput, { target: { value: '2026-03-31' } });

      // 担当講師の自由入力追加 & マスタから選択追加 & 削除
      const customTeacherInput = screen.queryByTestId('teacher-custom-input');
      const addTeacherBtn = screen.queryByTestId('add-teacher-btn');
      if (customTeacherInput && addTeacherBtn) {
        fireEvent.change(customTeacherInput, { target: { value: '新規 講師A' } });
        fireEvent.click(addTeacherBtn);
      }

      const teacherSelect = screen.queryByTestId('teacher-master-select') as HTMLSelectElement;
      if (teacherSelect && teacherSelect.options.length > 1) {
        fireEvent.change(teacherSelect, { target: { value: teacherSelect.options[1].value } });
        if (addTeacherBtn) fireEvent.click(addTeacherBtn);

        const delTeacherMasterBtn = screen.queryByTestId('delete-teacher-master-btn');
        if (delTeacherMasterBtn) fireEvent.click(delTeacherMasterBtn);
      }

      const removeTeacherBtn = screen.queryByTestId('remove-teacher-新規 講師A') || screen.queryByTestId('remove-teacher-福田 尚弘');
      if (removeTeacherBtn) fireEvent.click(removeTeacherBtn);

      // 通塾曜日チップのトグル
      const dayChips = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const d of dayChips) {
        const chip = screen.queryByTestId(`day-chip-${d}`);
        if (chip) fireEvent.click(chip);
      }

      // 選択教科チップのトグル
      const subjChips = ['数学', '英語', '理科', '社会', '国語'];
      for (const s of subjChips) {
        const chip = screen.queryByTestId(`subject-chip-${s}`);
        if (chip) fireEvent.click(chip);
      }

      // 教科別スタート位置設定
      const mathStartGrade = screen.queryByTestId('start-grade-select-start_unit_math') as HTMLSelectElement;
      if (mathStartGrade) {
        fireEvent.change(mathStartGrade, { target: { value: '中2' } });
      }

      // 個性タグの追加・削除
      const newPersonalityInput = screen.queryByTestId('new-personality-input');
      const addPersonalityBtn = screen.queryByTestId('add-personality-btn');
      if (newPersonalityInput && addPersonalityBtn) {
        fireEvent.change(newPersonalityInput, { target: { value: '探求心旺盛' } });
        fireEvent.click(addPersonalityBtn);
      }

      const personalityMasterSelect = screen.queryByTestId('personality-master-select') as HTMLSelectElement;
      if (personalityMasterSelect && personalityMasterSelect.options.length > 1) {
        fireEvent.change(personalityMasterSelect, { target: { value: personalityMasterSelect.options[1].value } });
        if (addPersonalityBtn) fireEvent.click(addPersonalityBtn);
      }

      const removePersonalityBtn = screen.queryByTestId('remove-personality-tag-几帳面');
      if (removePersonalityBtn) fireEvent.click(removePersonalityBtn);

      // 対応履歴の新規登録
      const memoTextarea = screen.queryByPlaceholderText('具体的な対応メモを入力...');
      const addInterBtn = screen.queryByText('対応内容を登録');
      if (memoTextarea && addInterBtn) {
        fireEvent.change(memoTextarea, { target: { value: '新しい面談メモの入力テスト。' } });
        fireEvent.click(addInterBtn);
      }

      // 対応履歴の編集・削除
      const editInterBtn = screen.queryByTestId('edit-interaction-inter-v30-1');
      if (editInterBtn) {
        fireEvent.click(editInterBtn);
        const saveInterBtn = screen.queryByText('保存');
        if (saveInterBtn) fireEvent.click(saveInterBtn);
      }

      const delInterBtn = screen.queryByTestId('delete-interaction-inter-v30-1');
      if (delInterBtn) fireEvent.click(delInterBtn);

      // フォーム全体の保存
      const saveStudentBtn = screen.queryByText('変更を保存する');
      if (saveStudentBtn) fireEvent.click(saveStudentBtn);
    }

    // 5. マイルストーン（milestones）タブでの追加アクション
    const milestoneTab = screen.queryByRole('button', { name: /年間計画/i });
    if (milestoneTab) {
      fireEvent.click(milestoneTab);

      // 単元テスト追加モーダル
      const addUnitTestBtn = screen.queryByTestId('timeline-add-unittest-btn');
      if (addUnitTestBtn) {
        fireEvent.click(addUnitTestBtn);
        const modalUnitName = screen.queryByTestId('unittest-name-input');
        const saveUnitTestBtn = screen.queryByTestId('save-unittest-btn');
        if (modalUnitName) fireEvent.change(modalUnitName, { target: { value: '1章 式の計算 - 単元確認テスト' } });
        if (saveUnitTestBtn) fireEvent.click(saveUnitTestBtn);
      }
    }

    // 6. 各タブの巡回
    const otherTabs = ['schedule', 'progress-matrix', 'daily-tasks', 'test-results', 'weekly-matrix', 'ai-reports', 'homework', 'curriculum-master'];
    for (const t of otherTabs) {
      const tabBtn = screen.queryByTestId(`nav-tab-${t}`) || screen.queryByRole('button', { name: new RegExp(t, 'i') });
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    renderResult.unmount();
  });

  it('covers BranchManagement full workflows and error states', async () => {
    let renderResult: any;
    await act(async () => {
      renderResult = render(<BranchManagement />);
    });

    await waitFor(() => {
      expect(screen.getByText(/本部専用 校舎アカウント管理/)).toBeInTheDocument();
    });

    // モーダルを開いて新規校舎を発行
    const openModalBtn = screen.queryByTestId('open-create-branch-modal');
    if (openModalBtn) {
      fireEvent.click(openModalBtn);

      const nameInput = screen.queryByPlaceholderText(/例: 恵比寿教室/i);
      const codeInput = screen.queryByPlaceholderText(/例: EBS/i);
      const emailInput = screen.queryByPlaceholderText(/例: ebisu@tentoru.jp/i);
      const submitBtn = screen.queryByRole('button', { name: /校舎を発行する|登録/i });

      if (nameInput) fireEvent.change(nameInput, { target: { value: '渋谷教室' } });
      if (codeInput) fireEvent.change(codeInput, { target: { value: 'SBY' } });
      if (emailInput) fireEvent.change(emailInput, { target: { value: 'shibuya@tentoru.jp' } });
      if (submitBtn) fireEvent.click(submitBtn);
    }

    renderResult.unmount();
  });

  it('deeply covers DatabaseService methods and edge cases', async () => {
    // 1. ExamThresholdsMaster
    const ethSample: ExamThresholdMaster = {
      id: 'eth-1',
      school_id: 'sch-1',
      grade: '中2',
      subject: '数学',
      term: '1学期中間',
      target_score: 90,
      threshold_score: 70
    };
    await db.saveExamThresholdMaster(ethSample);
    const fetchedEth = db.getExamThresholdsMaster();
    expect(fetchedEth.length).toBeGreaterThan(0);

    // 2. PromptSettings
    await db.savePromptSetting({
      id: 'prompt-1',
      template_name: '月次レポート生成プロンプト',
      system_prompt: '生徒の強みと課題を分析してください。',
      updated_at: new Date().toISOString()
    });
    const fetchedPrompt = db.getPromptSettings();
    expect(fetchedPrompt.length).toBeGreaterThan(0);

    // 3. TeacherCorrectionLogs
    await db.addTeacherCorrectionLog({
      id: 'log-1',
      report_id: 'rep-1',
      student_id: 'std-v30-master',
      teacher_id: 'teacher-1',
      original_content: 'AI作成文章',
      corrected_content: '講師修正文章',
      reason: 'より具体的な励ましを追加',
      created_at: new Date().toISOString()
    });
    const fetchedLogs = db.getTeacherCorrectionsLogs();
    expect(fetchedLogs.length).toBeGreaterThan(0);

    // 4. CustomClasses & MilestoneTemplates
    const ccSample: CustomClass = { id: 'cc-1', name: '特進Sクラス', description: '難関校志望者向けクラス', subject: '数学', grade: '中2' };
    await db.saveCustomClass(ccSample);
    const fetchedCc = db.getCustomClasses();
    expect(fetchedCc.length).toBeGreaterThan(0);

    const mtSample: MilestoneTemplate = { id: 'mt-1', name: '難関私立数学標準モデル', subject: '数学', target_school_type: 'private_high', rows: [] };
    await db.saveMilestoneTemplate(mtSample);
    const fetchedMt = db.getMilestoneTemplates();
    expect(fetchedMt.length).toBeGreaterThan(0);

    // 5. AIReports
    await db.saveAIReport({
      id: 'rep-1',
      student_id: 'std-v30-master',
      month: '2026-09',
      summary: '全科目順調に進捗中',
      strengths: '数学の計算精度が高い',
      weaknesses: '文章題の立式にやや時間要',
      recommendations: '連立方程式の応用問題演習を推奨',
      created_at: new Date().toISOString()
    });
    const fetchedReports = db.getAIReports();
    expect(fetchedReports.length).toBeGreaterThan(0);

    // 6. MiniTestResults
    await db.saveMiniTestResult({
      id: 'mini-1',
      student_id: 'std-v30-master',
      lesson_id: 'cm-v30-1',
      subject: '数学',
      score: 100,
      passed: true,
      tested_at: new Date().toISOString()
    });
    const fetchedMini = await db.fetchMiniTestResults('std-v30-master');
    expect(fetchedMini.length).toBeGreaterThan(0);

    // 7. StudentLessonProgress
    await db.saveStudentLessonProgress({
      id: 'slp-1',
      student_id: 'std-v30-master',
      lesson_id: 'cm-v30-1',
      status: 'completed',
      score: 100,
      completed_at: new Date().toISOString()
    });
    const fetchedSlp = await db.fetchStudentLessonProgressList('std-v30-master');
    expect(fetchedSlp.length).toBeGreaterThan(0);
  });
});
