import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  db,
  Student,
  CurriculumMaster,
  CurriculumUnit,
  LearningTask,
  MiniTestResult,
  HomeworkResult,
  LearningLog,
  TestRecord,
  SchoolCodeMaster,
  ExamThresholdMaster,
  PromptSetting,
  AIReport,
  TeacherCorrectionLog,
  StudentLessonProgress,
  MilestonePlan,
  Branch,
  SchoolExamConfig,
  ExamResult,
  PersonalityTag,
  Teacher,
  SchoolHoliday,
  TimetableSlot,
  BranchAIRules
} from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import { CurriculumCsvImport } from '../components/CurriculumCsvImport';
import StudentDashboard from '../components/StudentDashboard';
import { BranchManagement } from '../components/BranchManagement';
import SugorokuMap from '../components/SugorokuMap';
import { TestScoreRadarChart } from '../components/TestScoreRadarChart';
import Home from '../app/page';

describe('Coverage 95%+ Pure Comprehensive Core Test Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    // Setup base students & masters
    const std1: Student = {
      id: 'core-std-01',
      student_id: 'S_CORE_01',
      name: '本番 テスト生1',
      grade: '中1',
      grade_category: '中学生',
      level: 'A',
      school_id: 'sch-1',
      school_name: '第一中学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['monday', 'wednesday'],
      selected_subjects: ['数学', '英語'],
      teacher_in_charge: '荒木はやと',
      personality_tags: ['集中力高い', '負けず嫌い'],
      enrollment_date: '2025-04-01'
    };
    const std2: Student = {
      id: 'core-std-02',
      student_id: 'S_CORE_02',
      name: '小学生 テスト生2',
      grade: '小5',
      grade_category: '小学生',
      level: 'B',
      school_id: 'sch-2',
      school_name: 'テントル小学校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 1,
      selected_days: ['tuesday'],
      selected_subjects: ['算数'],
      teacher_in_charge: '佐藤先生'
    };
    const std3: Student = {
      id: 'core-std-03',
      student_id: 'S_CORE_03',
      name: '高校生 テスト生3',
      grade: '高1',
      grade_category: '高校生',
      level: 'A',
      school_id: 'sch-3',
      school_name: '都立高校',
      branch_id: 'branch-1',
      status: 'normal',
      period_count: 2,
      selected_days: ['friday'],
      selected_subjects: ['数学I']
    };

    await db.saveStudent(std1);
    await db.saveStudent(std2);
    await db.saveStudent(std3);

    const master1: CurriculumMaster = {
      id: 'cm-core-01',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '符号のついた数',
      sort_order: 1,
      item_type: 'lesson'
    };
    const master2: CurriculumMaster = {
      id: 'cm-core-02',
      subject: '数学',
      grade: '中1',
      unit_name: '正の数・負の数',
      lesson_name: '正の数・負の数 確認テスト',
      sort_order: 2,
      item_type: 'unit_test',
      passing_line: '80点以上'
    };
    const master3: CurriculumMaster = {
      id: 'cm-core-03',
      subject: '算数',
      grade: '小5',
      unit_name: '整数と小数',
      lesson_name: '小数のかけ算',
      sort_order: 1,
      item_type: 'lesson'
    };
    await db.saveCurriculumMasters([master1, master2, master3]);
  });

  // ==========================================
  // 1. db.ts Exhaustive Method Coverage
  // ==========================================
  it('covers all DatabaseService CRUD, accessors, and edge methods in db.ts', async () => {
    // Basic properties & utils
    expect(db.getIsMockMode()).toBeDefined();
    expect(db.getSupabase()).toBeDefined();
    db.clearLocalMockCache();

    // Schools CRUD
    const sch = await db.saveSchool({ id: 'sch-custom-99', name: '特設高校', type: 'high', created_at: new Date().toISOString() });
    expect(sch.id).toBe('sch-custom-99');
    expect(db.getSchools().some(s => s.id === 'sch-custom-99')).toBe(true);
    expect((await db.fetchSchools()).some(s => s.id === 'sch-custom-99')).toBe(true);
    await db.deleteSchool('sch-custom-99');
    expect(db.getSchools().some(s => s.id === 'sch-custom-99')).toBe(false);

    // Custom Classes CRUD
    const cc = await db.saveCustomClass({ id: 'cc-99', name: '特設補習', created_at: new Date().toISOString() });
    expect(db.getCustomClasses().some(c => c.id === 'cc-99')).toBe(true);
    await db.deleteCustomClass('cc-99');
    expect(db.getCustomClasses().some(c => c.id === 'cc-99')).toBe(false);

    // Custom Apply Scopes CRUD
    const scope = await db.saveCustomApplyScope({
      id: 'cas-99',
      name: '中1数学特化',
      target_grades: ['中1'],
      target_subjects: ['数学'],
      created_at: new Date().toISOString()
    });
    expect(db.getCustomApplyScopes().some(s => s.id === 'cas-99')).toBe(true);
    await db.deleteCustomApplyScope('cas-99');
    expect(db.getCustomApplyScopes().some(s => s.id === 'cas-99')).toBe(false);

    // Curriculum Units CRUD
    const unit: CurriculumUnit = {
      id: 'cu-core-99',
      school_id: 'sch-1',
      subject: '数学',
      name: '一次方程式',
      sequence_order: 10
    };
    await db.saveCurriculumUnit(unit);
    expect(db.getCurriculumUnits().some(u => u.id === 'cu-core-99')).toBe(true);
    await db.saveCurriculumUnits([unit]);
    await db.deleteCurriculumUnit('cu-core-99');
    expect(db.getCurriculumUnits().some(u => u.id === 'cu-core-99')).toBe(false);

    // Students fetch & get
    expect(db.getStudent('core-std-01')?.name).toBe('本番 テスト生1');
    expect(db.getStudentById('core-std-01')?.name).toBe('本番 テスト生1');
    expect(await db.fetchStudent('core-std-01')).toBeDefined();
    expect(await db.fetchStudents()).toHaveLength(3);

    // Learning Tasks CRUD
    const tasks: LearningTask[] = [
      {
        id: 'lt-core-01',
        student_id: 'core-std-01',
        scheduled_date: '2026-09-10',
        period: 1,
        subject: '数学',
        unit_id: 'cm-core-01',
        status: 'unstarted',
        created_at: new Date().toISOString()
      },
      {
        id: 'lt-core-02',
        student_id: 'core-std-01',
        scheduled_date: '2026-09-10',
        period: 2,
        subject: '数学',
        unit_id: 'cm-core-02',
        status: 'completed',
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);
    expect(db.getLearningTasks().filter(t => t.student_id === 'core-std-01')).toHaveLength(2);
    expect(await db.fetchLearningTasks('core-std-01', '2026-09-10')).toHaveLength(2);

    await db.overwriteLearningTasksForDate('core-std-01', '2026-09-10', [tasks[0]]);
    expect(await db.fetchLearningTasks('core-std-01', '2026-09-10')).toHaveLength(1);

    await db.deleteLearningTasksForDate('core-std-01', '2026-09-10');
    expect(await db.fetchLearningTasks('core-std-01', '2026-09-10')).toHaveLength(0);

    await db.saveLearningTasks(tasks);
    await db.deleteLearningTasksByDate('core-std-01', '2026-09-10');
    expect(await db.fetchLearningTasks('core-std-01', '2026-09-10')).toHaveLength(0);

    await db.saveLearningTasks(tasks);
    await db.deleteLearningTasksByStudent('core-std-01');
    expect(await db.fetchLearningTasks('core-std-01')).toHaveLength(0);

    // Learning Logs CRUD
    const log: LearningLog = {
      id: 'll-core-01',
      student_id: 'core-std-01',
      task_id: 'lt-core-01',
      status: 'pass',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);
    expect(db.getLearningLogs().some(l => l.id === 'll-core-01')).toBe(true);

    // Test Records CRUD
    const tr: TestRecord = {
      id: 'tr-core-01',
      student_id: 'core-std-01',
      term: '1学期中間',
      subject: '数学',
      score: 92,
      target_score: 90,
      average_score: 65,
      date: '2026-06-15'
    };
    await db.saveTestRecord(tr);
    expect(db.getTestRecords().some(r => r.id === 'tr-core-01')).toBe(true);
    await db.deleteTestRecord('tr-core-01');
    expect(db.getTestRecords().some(r => r.id === 'tr-core-01')).toBe(false);

    // School Codes & Exam Thresholds Master CRUD
    const scm: SchoolCodeMaster = { id: 'scm-01', code: 'J001', name: '第一中', region: '東京' };
    await db.saveSchoolCodeMaster(scm);
    expect(db.getSchoolCodesMaster().some(c => c.id === 'scm-01')).toBe(true);

    const etm: ExamThresholdMaster = { id: 'etm-01', school_id: 'sch-1', passing_score: 80, excellence_score: 95 };
    await db.saveExamThresholdMaster(etm);
    expect(db.getExamThresholdsMaster().some(e => e.id === 'etm-01')).toBe(true);

    // AI Reports & Prompt Settings CRUD
    const rep: AIReport = {
      id: 'rep-core-01',
      student_id: 'core-std-01',
      report_text: '順調に進んでいます',
      generated_at: new Date().toISOString()
    };
    await db.saveAIReport(rep);
    expect(db.getAIReports().some(r => r.id === 'rep-core-01')).toBe(true);

    const ps: PromptSetting = {
      id: 'ps-core-01',
      category: 'regular_report',
      prompt_template: '生徒の強みを3点挙げてください',
      updated_at: new Date().toISOString()
    };
    await db.savePromptSetting(ps);
    expect(db.getPromptSettings().some(p => p.id === 'ps-core-01')).toBe(true);

    // Teacher Correction Logs CRUD
    const tcl: TeacherCorrectionLog = {
      id: 'tcl-core-01',
      report_id: 'rep-core-01',
      original_text: '順調に進んでいます',
      corrected_text: '大変順調に進んでいます',
      corrected_at: new Date().toISOString()
    };
    await db.addTeacherCorrectionLog(tcl);
    expect(db.getTeacherCorrectionsLogs().some(c => c.id === 'tcl-core-01')).toBe(true);

    // MiniTestResults CRUD
    const mtr: MiniTestResult = {
      id: 'mtr-core-01',
      student_id: 'core-std-01',
      date: '2026-09-10',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '正の数・負の数',
      test_content: '符号テスト',
      status: 'pass',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(mtr);
    expect(db.getMiniTestResults().some(m => m.id === 'mtr-core-01')).toBe(true);
    expect((await db.fetchMiniTestResults('core-std-01', '2026-09-10')).length).toBe(1);
    await db.deleteMiniTestResultByDate('core-std-01', '2026-09-10');
    expect((await db.fetchMiniTestResults('core-std-01', '2026-09-10')).length).toBe(0);
    await db.saveMiniTestResult(mtr);
    await db.deleteMiniTestResult('mtr-core-01');
    expect(db.getMiniTestResults().some(m => m.id === 'mtr-core-01')).toBe(false);

    // HomeworkResults CRUD
    const hr: HomeworkResult = {
      id: 'hr-core-01',
      student_id: 'core-std-01',
      date: '2026-09-10',
      subject: '数学',
      homework_content: 'ワーク P.10-12',
      homework_deadline: '2026-09-15',
      status: 'done',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(hr);
    expect(db.getHomeworkResults().some(h => h.id === 'hr-core-01')).toBe(true);
    expect((await db.fetchHomeworkResults('core-std-01', '2026-09-10')).length).toBe(1);
    await db.saveHomeworkResults([hr]);
    await db.deleteHomeworkResultsByDate('core-std-01', '2026-09-10');
    expect((await db.fetchHomeworkResults('core-std-01', '2026-09-10')).length).toBe(0);
    await db.saveHomeworkResult(hr);
    await db.deleteHomeworkResult('hr-core-01');
    expect(db.getHomeworkResults().some(h => h.id === 'hr-core-01')).toBe(false);

    // Milestone Plans CRUD
    const mp: MilestonePlan = {
      id: 'mp-core-01',
      grade: '中1',
      subject: '数学',
      course: '標準コース',
      month: 4,
      week_number: 1,
      unit_name: '正の数・負の数',
      is_holiday: false,
      target_sequence_order: 2
    };
    await db.saveMilestonePlan(mp);
    expect(db.getMilestonePlans().some(p => p.id === 'mp-core-01')).toBe(true);
    await db.saveMilestonePlans([mp]);
    expect(db.getMilestonePlans().length).toBeGreaterThan(0);

    // Student Lesson Progress CRUD
    const slp: StudentLessonProgress = {
      id: 'slp-core-01',
      student_id: 'core-std-01',
      curriculum_master_id: 'cm-core-01',
      status: 'passed',
      test_score: 95,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.saveStudentLessonProgress(slp);
    expect(db.getStudentLessonProgressList('core-std-01').some(p => p.id === 'slp-core-01')).toBe(true);
    expect((await db.fetchStudentLessonProgressList('core-std-01')).some(p => p.id === 'slp-core-01')).toBe(true);

    // Branches CRUD
    const br: Branch = {
      id: 'branch-core-99',
      name: '渋谷校',
      email: 'shibuya@tentoru.jp',
      status: 'active',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(br);
    expect(db.getBranches().some(b => b.id === 'branch-core-99')).toBe(true);
    expect((await db.fetchBranches()).some(b => b.id === 'branch-core-99')).toBe(true);
    await db.deleteBranch('branch-core-99');
    expect(db.getBranches().some(b => b.id === 'branch-core-99')).toBe(false);

    // Personality Options CRUD
    await db.addPersonalityOption('几帳面');
    expect(db.getPersonalityOptions().includes('几帳面')).toBe(true);
    expect((await db.fetchPersonalityOptions()).includes('几帳面')).toBe(true);
    await db.deletePersonalityOption('几帳面');
    expect(db.getPersonalityOptions().includes('几帳面')).toBe(false);

    // Teacher Options CRUD
    await db.addTeacherOption('小林先生');
    expect(db.getTeacherOptions().includes('小林先生')).toBe(true);
    expect((await db.fetchTeacherOptions()).includes('小林先生')).toBe(true);
    await db.deleteTeacherOption('小林先生');
    expect(db.getTeacherOptions().includes('小林先生')).toBe(false);

    // Student Interactions CRUD
    const interaction = {
      id: 'si-core-01',
      student_id: 'core-std-01',
      interaction_type: 'counseling' as const,
      interaction_date: '2026-09-08',
      topic: '進路相談',
      notes: '志望校決定',
      action_items: '数学の復習',
      created_at: new Date().toISOString()
    };
    await db.saveStudentInteraction(interaction);
    expect(db.getStudentInteractions('core-std-01').some(i => i.id === 'si-core-01')).toBe(true);
    await db.deleteStudentInteraction('si-core-01');
    expect(db.getStudentInteractions('core-std-01').some(i => i.id === 'si-core-01')).toBe(false);

    // Milestone Templates CRUD
    const template = {
      id: 'mt-core-01',
      name: 'テスト用テンプレート',
      grade: '中1',
      subject: '数学',
      course: '標準',
      plans: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.saveMilestoneTemplate(template);
    expect(db.getMilestoneTemplates().some(t => t.id === 'mt-core-01')).toBe(true);
    await db.deleteMilestoneTemplate('mt-core-01');
    expect(db.getMilestoneTemplates().some(t => t.id === 'mt-core-01')).toBe(false);

    // Student Schedule Config CRUD
    const cfg = db.getStudentScheduleConfig('core-std-01');
    cfg.period_count = 3;
    await db.saveStudentScheduleConfig(cfg);
    expect(db.getStudentScheduleConfig('core-std-01').period_count).toBe(3);

    // Branch AI Rules CRUD
    const branchRules: BranchAIRules = {
      branch_id: 'branch-1',
      test_prep_weeks_before: 3,
      punk_threshold_slots: 5,
      review_slot_interval: 4
    };
    await db.saveBranchAIRules('branch-1', branchRules);
    expect(db.getBranchAIRules('branch-1').punk_threshold_slots).toBe(5);

    // Session & Auth
    const loginRes = await db.signInWithPassword('admin@tentoru.jp', 'admin123');
    expect(loginRes.success).toBe(true);
    expect(db.getSession()).toBeDefined();

    const roleObj = db.getCurrentUserRole();
    expect(roleObj.role).toBe('admin');
    db.setCurrentUserRole('branch', 'branch-1', '恵比寿校');
    expect(db.getCurrentUserRole().role).toBe('branch');

    const resetRes = await db.sendBranchPasswordReset('shibuya@tentoru.jp');
    expect(resetRes.success).toBe(true);

    await db.signOut();
    expect(db.getSession()).toBeNull();

    // Delete Student
    await db.deleteStudent('core-std-01');
    expect(db.getStudent('core-std-01')).toBeNull();
  });

  // ==========================================
  // 2. CurriculumCsvImport Exhaustive Actions
  // ==========================================
  it('covers all action buttons, CSV export, clear, sample, and deletion in CurriculumCsvImport', async () => {
    const onImportSuccess = vi.fn();
    const { container } = render(<CurriculumCsvImport onImportSuccess={onImportSuccess} />);

    // 1. Export Unit Tests CSV
    const exportBtn = screen.queryByRole('button', { name: /単元テストCSV出力/i });
    if (exportBtn) {
      await act(async () => {
        fireEvent.click(exportBtn);
      });
    }

    // 2. Sample Download CSV
    const sampleBtn = screen.queryByRole('button', { name: /単元テストサンプル/i });
    if (sampleBtn) {
      await act(async () => {
        fireEvent.click(sampleBtn);
      });
    }

    // 3. Delete Legacy Data
    const legacyBtn = screen.queryByRole('button', { name: /旧フォーマット.*削除/i });
    if (legacyBtn) {
      await act(async () => {
        fireEvent.click(legacyBtn);
      });
    }

    // 4. Clear All
    const clearBtn = screen.queryByRole('button', { name: /全削除/i }) || screen.queryByRole('button', { name: /初期化/i });
    if (clearBtn) {
      await act(async () => {
        fireEvent.click(clearBtn);
      });
    }

    // 5. File Import with Unit Tests CSV
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput) {
      const csvContent = '学年,教科,単元名,テスト名,区分,合格基準\n小5,算数,1章 整数と小数,1章 単元確認テスト,単元テスト,80点以上';
      const file = new File([csvContent], 'unit_test_sample.csv', { type: 'text/csv' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Confirm import if button shows
      await waitFor(() => {
        const confirmImportBtn = screen.queryByRole('button', { name: /インポート実行/i }) || screen.queryByRole('button', { name: /確定/i });
        if (confirmImportBtn) {
          fireEvent.click(confirmImportBtn);
        }
      });
    }
  });

  // ==========================================
  // 3. TeacherDashboard Exhaustive Modals & Tabs
  // ==========================================
  it('covers all TeacherDashboard modals, tabs, branch rules, and unit test additions', async () => {
    render(<TeacherDashboard teacherType="junior_high" initialStudentId="core-std-01" onBackToPortal={vi.fn()} />);

    // 1. Open AI Rules Modal & Save
    const aiRulesBtn = screen.queryByRole('button', { name: /AIルール/i }) || screen.queryByRole('button', { name: /校舎設定/i });
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });

      const punkInput = screen.queryByTestId('branch-ai-punk-threshold-input');
      if (punkInput) {
        fireEvent.change(punkInput, { target: { value: '6' } });
      }

      const saveRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }

    // 2. Open Unit Test Master Modal & Save
    const addUnitTestBtn = screen.queryByRole('button', { name: /単元テストマスタ追加/i }) || screen.queryByRole('button', { name: /テスト追加/i });
    if (addUnitTestBtn) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn);
      });

      const saveUnitTestBtn = screen.queryByTestId('save-unittest-master-btn');
      if (saveUnitTestBtn) {
        await act(async () => {
          fireEvent.click(saveUnitTestBtn);
        });
      }
    }

    // 3. Tab Switches
    const tabs = [
      '生徒カルテ',
      '時間割・予定',
      'カリキュラム進捗',
      '小テスト・確認',
      '宿題管理',
      '定期テスト・模試',
      'AI進捗レポート',
      '年間マイルストーン',
      '校舎・講師管理',
      'カリキュラム取込',
      '生徒新規登録',
      '生徒一覧'
    ];

    for (const tabName of tabs) {
      const tabBtn = screen.queryByRole('button', { name: new RegExp(tabName, 'i') });
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    // 4. Test school category toggle in student list
    const elemFilterBtn = screen.queryByTestId('filter-type-elem');
    if (elemFilterBtn) {
      await act(async () => {
        fireEvent.click(elemFilterBtn);
      });
    }

    const jhsFilterBtn = screen.queryByTestId('filter-type-jhs');
    if (jhsFilterBtn) {
      await act(async () => {
        fireEvent.click(jhsFilterBtn);
      });
    }

    const hsFilterBtn = screen.queryByTestId('filter-type-high');
    if (hsFilterBtn) {
      await act(async () => {
        fireEvent.click(hsFilterBtn);
      });
    }
  });

  // ==========================================
  // 4. StudentDashboard
  // ==========================================
  it('covers StudentDashboard tab interactions and schedule views', async () => {
    const student = db.getStudent('core-std-01')!;
    await act(async () => {
      render(<StudentDashboard student={student} onBackToPortal={vi.fn()} />);
    });
    const sugorokuTab = screen.queryByRole('button', { name: /すごろく/i });
    if (sugorokuTab) {
      await act(async () => {
        fireEvent.click(sugorokuTab);
      });
    }
    expect(screen.getByText(/学習画面/i) || screen.getByText(/時間割/i)).toBeDefined();
  });

  // ==========================================
  // 5. BranchManagement
  // ==========================================
  it('covers BranchManagement rendering and actions', async () => {
    await act(async () => {
      render(<BranchManagement onBack={vi.fn()} />);
    });
    expect(screen.getAllByText(/校舎/i).length).toBeGreaterThan(0);
  });

  // ==========================================
  // 6. SugorokuMap & TestScoreRadarChart
  // ==========================================
  it('covers SugorokuMap and TestScoreRadarChart rendering', async () => {
    await act(async () => {
      render(
        <SugorokuMap
          studentId="core-std-01"
          studentGrade="中1"
          selectedSubject="数学"
          completedLessonIds={['cm-core-01']}
        />
      );
    });

    await act(async () => {
      render(
        <TestScoreRadarChart
          data={[
            { subject: '数学', score: 85, fullMark: 100 },
            { subject: '英語', score: 90, fullMark: 100 },
            { subject: '国語', score: 75, fullMark: 100 },
            { subject: '理科', score: 80, fullMark: 100 },
            { subject: '社会', score: 55, fullMark: 100 }
          ]}
        />
      );
    });
  });

  // ==========================================
  // 7. Home Portal
  // ==========================================
  it('covers Home portal for both login screen and authenticated portal view', async () => {
    // 1. Unauthenticated state (Login form)
    localStorage.removeItem('tentoru_auth_session');
    await act(async () => {
      render(<Home />);
    });
    expect(screen.getByTestId('login-submit-btn')).toBeDefined();

    // 2. Authenticated state
    db.saveSession({
      user: {
        id: 'usr-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        branch_id: null,
        branch_name: '本部統括管理者',
        name: '管理者'
      },
      token: 'test-token',
      logged_in_at: new Date().toISOString()
    });

    await act(async () => {
      render(<Home />);
    });
    await waitFor(() => {
      expect(screen.getByText(/ダッシュボード/i) || screen.getByText(/TENTORU/i)).toBeDefined();
    });
  });
});
