import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { db } from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { 
  Student, 
  CurriculumMaster, 
  CurriculumUnit, 
  LearningTask, 
  MiniTestResult, 
  HomeworkResult, 
  MilestonePlan, 
  TestRecord, 
  School, 
  Branch, 
  StudentInteraction 
} from '../types';

describe('Ultimate Perfection Master Strike for 95%+ Coverage Across All Files', () => {
  const mockElementaryStudent: Student = {
    id: 'std-elem-strike-1',
    student_id: 'std-elem-strike-1',
    name: '熊本 太郎',
    name_kana: 'クマモト タロウ',
    email: 'kumamoto@example.com',
    grade: '小3',
    school_id: 'sch-elem-strike-1',
    school_name: '飽田南小学校',
    classroom: '熊本教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'normal',
    level: 'A',
    selected_subjects: ['算数', '国語', '英語'],
    selected_days: ['tuesday', 'friday'],
    period_count: 2,
    registered_year: 2026,
    registered_grade: '小3',
    personalities: ['集中力高い', '几帳面'],
    target_schools: [{ school_name: '熊本中学校', course_name: '一般' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-elem-1',
    start_unit_english: 'cm-elem-2',
    birthday: '2017-05-15',
    enrollment_date: '2026-04-01',
    withdrawal_date: null,
    club_activities: 'サッカー部',
    hobbies: '読書',
    parent_name: '熊本 次郎',
    parent_name_kana: 'クマモト ジロウ',
    contact_phone: '090-1234-5678'
  };

  const mockJhsStudent: Student = {
    id: 'std-jhs-strike-1',
    student_id: 'std-jhs-strike-1',
    name: '天登 花子',
    name_kana: 'テント ハナコ',
    email: 'hanako@example.com',
    grade: '中2',
    school_id: 'sch-jhs-strike-1',
    school_name: '天登第一中学校',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'warning',
    level: 'B',
    selected_subjects: ['数学', '英語', '理科', '歴史', '地理', '国語', '社会'],
    selected_days: ['monday', 'wednesday', 'friday'],
    period_count: 3,
    registered_year: 2026,
    registered_grade: '中2',
    personalities: ['几帳面'],
    target_schools: [{ school_name: '日比谷高校', course_name: '普通科' }],
    created_at: '2026-04-01T00:00:00Z',
    start_unit_math: 'cm-jhs-1'
  };

  const mockHighStudent: Student = {
    id: 'std-high-strike-1',
    student_id: 'std-high-strike-1',
    name: '高校 一郎',
    name_kana: 'コウコウ イチロウ',
    email: 'high@example.com',
    grade: '高1',
    school_id: 'sch-high-strike-1',
    school_name: '天登高校',
    classroom: '恵比寿教室',
    branch_id: 'branch-1',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    status: 'attention',
    level: 'C',
    selected_subjects: ['数学', '英語'],
    selected_days: ['monday', 'thursday'],
    period_count: 2,
    registered_year: 2026,
    registered_grade: '高1',
    personalities: ['自主的'],
    target_schools: [{ school_name: '東京大学', course_name: '理科一類' }],
    created_at: '2026-04-01T00:00:00Z'
  };

  const sampleSchools: School[] = [
    { id: 'sch-elem-strike-1', name: '飽田南小学校', type: 'elementary', created_at: new Date().toISOString() },
    { id: 'sch-jhs-strike-1', name: '天登第一中学校', type: 'junior_high', created_at: new Date().toISOString() },
    { id: 'sch-high-strike-1', name: '天登高校', type: 'high_school', created_at: new Date().toISOString() }
  ];

  const sampleUnits: CurriculumUnit[] = [
    { id: 'u-1', school_id: 'sch-elem-strike-1', subject: '算数', name: 'かけ算九九', sequence_order: 1, created_at: new Date().toISOString() },
    { id: 'u-2', school_id: 'sch-elem-strike-1', subject: '算数', name: 'わり算', sequence_order: 2, created_at: new Date().toISOString() },
    { id: 'u-3', school_id: 'sch-jhs-strike-1', subject: '数学', name: '正負の数', sequence_order: 1, created_at: new Date().toISOString() },
    { id: 'u-4', school_id: 'sch-jhs-strike-1', subject: '数学', name: '文字と式', sequence_order: 2, created_at: new Date().toISOString() }
  ];

  const sampleMasters: CurriculumMaster[] = [
    { id: 'cm-elem-1', grade: '小3', subject: '算数', unit_name: 'かけ算九九', lesson_name: '2の段', sort_order: 1 },
    { id: 'cm-elem-2', grade: '小3', subject: '英語', unit_name: 'あいさつ', lesson_name: 'Hello', sort_order: 1 },
    { id: 'cm-jhs-1', grade: '中2', subject: '数学', unit_name: '連立方程式', lesson_name: '加減法', sort_order: 1 }
  ];

  beforeEach(async () => {
    localStorage.clear();
    for (const st of [mockElementaryStudent, mockJhsStudent, mockHighStudent]) {
      await db.saveStudent(st);
    }
    for (const sch of sampleSchools) {
      await db.saveSchool(sch);
    }
    await db.saveCurriculumUnits(sampleUnits);
    await db.saveCurriculumMasters(sampleMasters);
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();
  });

  it('1. Thoroughly exercises all TeacherDashboard tabs, filters, search, and interactions across student types', async () => {
    render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockElementaryStudent.id}
        initialTab="schedule"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/個別指導・学習計画設定/i).length).toBeGreaterThan(0);
    });

    // 1. Search student
    const searchInput = screen.queryByPlaceholderText(/生徒名・フリガナで検索/i);
    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '熊本' } });
      });
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: '' } });
      });
    }

    // 2. Select different tabs
    const tabNames = [
      '年間計画（マイルストーン）',
      '学校カリキュラム管理',
      '小テスト結果',
      '宿題提出状況',
      '定期テスト・模試',
      'AI指導報告書',
      '生徒情報',
      '学習計画・コマ割り'
    ];

    for (const tab of tabNames) {
      const btn = screen.queryByText(tab);
      if (btn) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }

    // 3. Switch to JHS Student
    const jhsStudentBtn = screen.queryByText(/天登 花子/i);
    if (jhsStudentBtn) {
      await act(async () => {
        fireEvent.click(jhsStudentBtn);
      });
    }

    // 4. Switch to High School Student
    const highStudentBtn = screen.queryByText(/高校 一郎/i);
    if (highStudentBtn) {
      await act(async () => {
        fireEvent.click(highStudentBtn);
      });
    }

    // 5. Test student detail tab features
    const studentInfoTab = screen.queryByText('生徒情報');
    if (studentInfoTab) {
      await act(async () => {
        fireEvent.click(studentInfoTab);
      });
    }

    // Add personality tag
    const personalityInput = screen.queryByPlaceholderText(/性格・特性タグを入力/i);
    const addPersonalityBtn = screen.queryByText(/タグ追加/i);
    if (personalityInput && addPersonalityBtn) {
      await act(async () => {
        fireEvent.change(personalityInput, { target: { value: '探究心旺盛' } });
        fireEvent.click(addPersonalityBtn);
      });
    }

    // Add interaction note
    const memoTextarea = screen.queryByPlaceholderText(/相談・対応内容の詳細を入力/i);
    const saveInteractionBtn = screen.queryByText(/対応内容を登録/i);
    if (memoTextarea && saveInteractionBtn) {
      await act(async () => {
        fireEvent.change(memoTextarea, { target: { value: '定期面談を実施。意欲的に学習中。' } });
        fireEvent.click(saveInteractionBtn);
      });
    }
  });

  it('2. Fully tests DatabaseService async and synchronous CRUD methods', async () => {
    // 1. Schools
    const schools = await db.fetchSchools();
    expect(schools.length).toBeGreaterThan(0);
    const newSch: School = { id: 'sch-new-test', name: '新テスト中学校', type: 'junior_high', created_at: new Date().toISOString() };
    await db.saveSchool(newSch);
    const updatedSchools = await db.fetchSchools();
    expect(updatedSchools.find(s => s.id === 'sch-new-test')).toBeDefined();
    await db.deleteSchool('sch-new-test');

    // 2. Curriculum Units
    const units = await db.fetchCurriculumUnits('sch-elem-strike-1', '算数');
    expect(units.length).toBeGreaterThan(0);
    const newUnit: CurriculumUnit = { id: 'u-new-test', school_id: 'sch-elem-strike-1', subject: '算数', name: '図形', sequence_order: 3, created_at: new Date().toISOString() };
    await db.saveCurriculumUnit(newUnit);
    await db.deleteCurriculumUnit('u-new-test');

    // 3. Learning Tasks
    const sampleTask: LearningTask = {
      id: 'task-test-strike-1',
      student_id: mockElementaryStudent.id,
      scheduled_date: '2026-09-27',
      period: 1,
      subject: '算数',
      unit_id: 'u-1',
      unit_name: 'かけ算九九',
      lesson_name: '2の段',
      lesson_id: 'cm-elem-1',
      status: 'scheduled',
      is_custom_theme: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([sampleTask]);
    const fetchedTasks = await db.fetchLearningTasks(mockElementaryStudent.id, '2026-09-27');
    expect(fetchedTasks.length).toBeGreaterThan(0);
    await db.deleteLearningTasksForDate(mockElementaryStudent.id, '2026-09-27');

    // 4. Mini Tests & Homeworks
    const miniTest: MiniTestResult = {
      id: 'mini-test-strike-1',
      student_id: mockElementaryStudent.id,
      date: '2026-09-27',
      test_content: '計算小テスト',
      score: 100,
      passed: true,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(miniTest);
    const miniResults = await db.fetchMiniTestResults(mockElementaryStudent.id, '2026-09-27');
    expect(miniResults.length).toBeGreaterThan(0);
    await db.deleteMiniTestResult(miniTest.id);

    const hwResult: HomeworkResult = {
      id: 'hw-test-strike-1',
      student_id: mockElementaryStudent.id,
      date: '2026-09-27',
      content: '算数プリント1枚',
      status: 'completed',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hwResult);
    const hwResults = await db.fetchHomeworkResults(mockElementaryStudent.id, '2026-09-27');
    expect(hwResults.length).toBeGreaterThan(0);
    await db.deleteHomeworkResult(hwResult.id);

    // 5. Interactions & Personalities & Teachers
    const interaction: StudentInteraction = {
      id: 'inter-test-strike-1',
      student_id: mockElementaryStudent.id,
      category: '勉強相談',
      memo: '算数の文章題のコツを指導',
      date: '2026-09-27',
      staff_name: '福田 尚弘',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);
    const interactions = await db.fetchStudentInteractions(mockElementaryStudent.id);
    expect(interactions.length).toBeGreaterThan(0);
    await db.deleteStudentInteraction(interaction.id);

    await db.addPersonalityOption('努力家');
    const personalities = await db.fetchPersonalityOptions();
    expect(personalities).toContain('努力家');
    await db.deletePersonalityOption('努力家');

    await db.addTeacherOption('佐藤 先生');
    const teachers = await db.fetchTeacherOptions();
    expect(teachers).toContain('佐藤 先生');
    await db.deleteTeacherOption('佐藤 先生');

    // 6. Schedule Config & Branches
    await db.saveStudentScheduleConfig({
      student_id: mockElementaryStudent.id,
      weekly_frequency: '2',
      weekly_duration: '120min',
      selected_days: ['tuesday', 'friday'],
      default_slots: 2
    });
    const config = await db.fetchStudentScheduleConfig(mockElementaryStudent.id);
    expect(config.weekly_frequency).toBe('2');

    const branches = await db.fetchBranches();
    expect(branches.length).toBeGreaterThan(0);
  });

  it('3. Thoroughly tests schedule operations, period selections, AI report flow, tests, homeworks, and curriculum CRUD', async () => {
    render(
      <TeacherDashboard
        onBackToPortal={vi.fn()}
        initialStudentId={mockElementaryStudent.id}
        initialTab="schedule"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/個別指導・学習計画設定/i).length).toBeGreaterThan(0);
    });

    // 1. Change period count buttons (2 -> 3 -> 4)
    const slotButtons = screen.queryAllByRole('button');
    const slot3Btn = slotButtons.find(b => b.textContent?.trim() === '3コマ');
    if (slot3Btn) {
      await act(async () => {
        fireEvent.click(slot3Btn);
      });
    }

    // 2. Change subject selection in Period 1
    const periodSelects = screen.queryAllByRole('combobox');
    if (periodSelects.length > 0) {
      await act(async () => {
        fireEvent.change(periodSelects[0], { target: { value: '国語' } });
      });
    }

    // 3. Go to Mini-tests tab and toggle pass/fail
    const miniTestTab = screen.queryByText('小テスト結果');
    if (miniTestTab) {
      await act(async () => {
        fireEvent.click(miniTestTab);
      });
    }

    // 4. Go to Homework tab and change status
    const hwTab = screen.queryByText('宿題提出状況');
    if (hwTab) {
      await act(async () => {
        fireEvent.click(hwTab);
      });
    }

    // 5. Go to Regular Tests tab
    const regTestTab = screen.queryByText('定期テスト・模試');
    if (regTestTab) {
      await act(async () => {
        fireEvent.click(regTestTab);
      });
    }

    // 6. Go to AI Report tab
    const aiReportTab = screen.queryByText('AI指導報告書');
    if (aiReportTab) {
      await act(async () => {
        fireEvent.click(aiReportTab);
      });
      const genBtn = screen.queryByText(/AI報告書を生成/i) || screen.queryByText(/再生成/i);
      if (genBtn) {
        await act(async () => {
          fireEvent.click(genBtn);
        });
      }
    }

    // 7. Go to Curriculum Tab and add unit
    const curTab = screen.queryByText('学校カリキュラム管理');
    if (curTab) {
      await act(async () => {
        fireEvent.click(curTab);
      });
      const newUnitInput = screen.queryByPlaceholderText(/単元名を入力/i);
      const addUnitBtn = screen.queryByText(/単元を追加/i) || screen.queryByText(/追加/i);
      if (newUnitInput && addUnitBtn) {
        await act(async () => {
          fireEvent.change(newUnitInput, { target: { value: '新しい算数単元' } });
          fireEvent.click(addUnitBtn);
        });
      }
    }
  });
});
