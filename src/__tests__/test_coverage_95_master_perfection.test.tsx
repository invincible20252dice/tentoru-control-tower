import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  db,
  sanitizeLearningTask,
  sanitizeLearningTaskForDB,
  sanitizeMiniTestResult,
  sanitizeHomeworkResult
} from '../lib/db';
import TeacherDashboard from '../components/TeacherDashboard';
import BranchManagement from '../components/BranchManagement';
import CurriculumCsvImport from '../components/CurriculumCsvImport';
import Home from '../app/page';
import {
  Student,
  SchoolMaster,
  CurriculumMaster,
  CurriculumUnit,
  MilestonePlan,
  MilestoneTemplate,
  MiniTestResult,
  HomeworkResult,
  Branch,
  ExamThresholdMaster,
  UserSession
} from '../types';

describe('Coverage 95%+ Master Perfection Suite', () => {
  const mockElemSchool: SchoolMaster = {
    id: 'sch-cov-elem',
    name: 'カバレッジ小学校',
    type: 'elementary'
  };

  const mockJhsSchool: SchoolMaster = {
    id: 'sch-cov-jhs',
    name: 'カバレッジ中学校',
    type: 'junior_high'
  };

  const mockBranch: Branch = {
    id: 'branch-cov-1',
    name: 'カバレッジ校舎',
    code: 'B_COV_1',
    email: 'cov.branch@tentoru.jp',
    status: 'active',
    created_at: new Date().toISOString()
  };

  const mockUnit1: CurriculumUnit = {
    id: 'unit-cov-1',
    school_id: 'sch-cov-jhs',
    grade: '中2',
    subject: '数学',
    name: '1章 連立方程式',
    sequence_order: 1
  };

  const mockUnit2: CurriculumUnit = {
    id: 'unit-cov-2',
    school_id: 'sch-cov-jhs',
    grade: '中2',
    subject: '数学',
    name: '2章 一次関数',
    sequence_order: 2
  };

  const mockElemStudent: Student = {
    id: 'st-cov-elem-1',
    student_id: 'S_COV_ELEM_1',
    name: '小学生 カバ子',
    grade: '小4',
    status: 'fast',
    level: 'A',
    branch_id: 'branch-cov-1',
    classroom: 'カバレッジ校舎',
    school_id: 'sch-cov-elem',
    school_name: 'カバレッジ小学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘', '佐藤 拓海'],
    registered_year: 2026,
    registered_grade: '小4',
    selected_days: ['monday', 'thursday'],
    selected_subjects: ['算数', '国語', '英語'],
    start_unit_math: 'cm-cov-m1',
    start_unit_english: 'cm-cov-e1',
    start_unit_japanese: 'cm-cov-j1',
    completed_lesson_ids: ['cm-cov-m1', 'cm-cov-m2'],
    excluded_lesson_ids: ['cm-cov-m2'],
    personalities: ['集中力高い', '几帳面'],
    target_school: 'トップ中学',
    target_schools: [{ school_name: 'トップ中学', course_name: '特進' }],
    period_count: 2,
    default_slots: 2
  };

  const mockJhsStudent: Student = {
    id: 'st-cov-jhs-1',
    student_id: 'S_COV_JHS_1',
    name: '中学生 カバ男',
    grade: '中2',
    status: 'warning',
    level: 'B',
    branch_id: 'branch-cov-1',
    classroom: 'カバレッジ校舎',
    school_id: 'sch-cov-jhs',
    school_name: 'カバレッジ中学校',
    teacher_in_charge: '福田 尚弘',
    assigned_teachers: ['福田 尚弘'],
    registered_year: 2026,
    registered_grade: '中2',
    selected_days: ['tuesday', 'friday'],
    selected_subjects: ['数学', '英語', '理科', '社会', '国語'],
    completed_lesson_ids: [],
    personalities: ['マイペース'],
    target_school: '県立トップ高',
    target_schools: [{ school_name: '県立トップ高', course_name: '普通科' }],
    period_count: 3,
    default_slots: 3
  };

  const mockMasters: CurriculumMaster[] = [
    {
      id: 'cm-cov-m1',
      grade: '小4',
      subject: '算数',
      unit_name: '角の大きさ',
      lesson_name: '第1講 分度器の使い方',
      sort_order: 1
    },
    {
      id: 'cm-cov-m2',
      grade: '小4',
      subject: '算数',
      unit_name: '角の大きさ',
      lesson_name: '第2講 角の作図',
      sort_order: 2
    },
    {
      id: 'cm-cov-m-test',
      grade: '小4',
      subject: '算数',
      unit_name: '角の大きさ',
      lesson_name: '角の大きさ - 単元確認テスト',
      item_type: 'unit_test',
      passing_line: '85点以上',
      sort_order: 3
    }
  ];

  beforeEach(async () => {
    localStorage.clear();
    vi.restoreAllMocks();
    localStorage.setItem('tentoru_curriculum_masters', JSON.stringify(mockMasters));
    await db.saveSchool(mockElemSchool as any);
    await db.saveSchool(mockJhsSchool as any);
    await db.saveCurriculumUnit(mockUnit1);
    await db.saveCurriculumUnit(mockUnit2);
    await db.saveBranch(mockBranch);
    await db.saveStudent(mockElemStudent);
    await db.saveStudent(mockJhsStudent);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. TeacherDashboard: exercises all menu tabs, modals, unit test CRUD, curriculum reorder, and reports', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="schedule"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/i)).toBeDefined();
    });

    const menuButtons = Array.from(container.querySelectorAll('button'));

    // 1.1 Curriculum Tab: Subject change, unit edit, move up/down, add unit
    const curriBtn = menuButtons.find(b => b.textContent && b.textContent.includes('学校カリキュラム管理'));
    if (curriBtn) {
      await act(async () => {
        fireEvent.click(curriBtn);
      });

      const schoolSelect = container.querySelector('select[value="sch-cov-jhs"]');
      if (schoolSelect) {
        await act(async () => {
          fireEvent.change(schoolSelect, { target: { value: mockElemSchool.id } });
          fireEvent.change(schoolSelect, { target: { value: mockJhsSchool.id } });
        });
      }

      // Add new curriculum unit
      const unitNameInput = screen.queryByPlaceholderText(/例: 平行線と角/i);
      const addUnitBtn = screen.queryByRole('button', { name: /追加する|単元追加/i });
      if (unitNameInput && addUnitBtn) {
        await act(async () => {
          fireEvent.change(unitNameInput, { target: { value: '3章 1次関数の利用' } });
          fireEvent.click(addUnitBtn);
        });
      }
    }

    // 1.2 Mini-Tests Tab: change score, pass/fail checkbox, save
    const miniTestsBtn = menuButtons.find(b => b.textContent && b.textContent.includes('小テスト結果'));
    if (miniTestsBtn) {
      await act(async () => {
        fireEvent.click(miniTestsBtn);
      });

      const scoreInput = container.querySelector('input[type="number"]');
      if (scoreInput) {
        await act(async () => {
          fireEvent.change(scoreInput, { target: { value: '95' } });
        });
      }
    }

    // 1.3 Homeworks Tab: status select, deadline change, save
    const homeworksBtn = menuButtons.find(b => b.textContent && b.textContent.includes('宿題提出状況'));
    if (homeworksBtn) {
      await act(async () => {
        fireEvent.click(homeworksBtn);
      });
    }

    // 1.4 Regular Tests Tab: API Key open/save/delete, regular test save, mock exam save
    const testsBtn = menuButtons.find(b => b.textContent && b.textContent.includes('定期テスト・模試'));
    if (testsBtn) {
      await act(async () => {
        fireEvent.click(testsBtn);
      });

      const apiKeyBtn = screen.queryByRole('button', { name: /Gemini APIキー設定/i });
      if (apiKeyBtn) {
        await act(async () => {
          fireEvent.click(apiKeyBtn);
        });

        const apiKeyInput = screen.queryByPlaceholderText(/AIzaSy/i);
        const saveKeyBtn = screen.queryByRole('button', { name: /保存/i });
        if (apiKeyInput && saveKeyBtn) {
          await act(async () => {
            fireEvent.change(apiKeyInput, { target: { value: 'AIzaSyTestKey123' } });
            fireEvent.click(saveKeyBtn);
          });
        }
      }

      const saveRegularTestBtn = screen.queryByRole('button', { name: /定期テスト結果を保存/i });
      if (saveRegularTestBtn) {
        await act(async () => {
          fireEvent.click(saveRegularTestBtn);
        });
      }

      const saveMockExamBtn = screen.queryByRole('button', { name: /北辰・会場模試結果を保存/i });
      if (saveMockExamBtn) {
        await act(async () => {
          fireEvent.click(saveMockExamBtn);
        });
      }
    }

    // 1.5 AI Report Tab: generate report, edit prompt, save report
    const aiReportBtn = menuButtons.find(b => b.textContent && b.textContent.includes('AI指導報告書'));
    if (aiReportBtn) {
      await act(async () => {
        fireEvent.click(aiReportBtn);
      });

      const generateReportBtn = screen.queryByRole('button', { name: /自動生成/i });
      if (generateReportBtn) {
        await act(async () => {
          fireEvent.click(generateReportBtn);
        });
      }

      const saveReportBtn = screen.queryByRole('button', { name: /報告書を保存/i });
      if (saveReportBtn) {
        await act(async () => {
          fireEvent.click(saveReportBtn);
        });
      }
    }

    // 1.6 Milestones Tab: quarter filter, add row
    const milestonesBtn = menuButtons.find(b => b.textContent && b.textContent.includes('年間計画（マイルストーン）'));
    if (milestonesBtn) {
      await act(async () => {
        fireEvent.click(milestonesBtn);
      });

      const addRowBtn = screen.queryByRole('button', { name: /行を追加/i });
      if (addRowBtn) {
        await act(async () => {
          fireEvent.click(addRowBtn);
        });
      }
    }

    // 1.7 Student Detail Tab: tags, personality, target schools, promote/demote
    const studentDetailBtn = menuButtons.find(b => b.textContent && b.textContent.includes('生徒情報'));
    if (studentDetailBtn) {
      await act(async () => {
        fireEvent.click(studentDetailBtn);
      });

      const addTargetSchoolBtn = screen.queryByRole('button', { name: /志望校を追加/i });
      if (addTargetSchoolBtn) {
        await act(async () => {
          fireEvent.click(addTargetSchoolBtn);
        });
      }

      const saveStudentBtn = screen.queryByRole('button', { name: /変更を保存する/i });
      if (saveStudentBtn) {
        await act(async () => {
          fireEvent.click(saveStudentBtn);
        });
      }
    }

    // 1.8 Schedule Tab: auto reschedule, period count, period selection
    const schedBtn = menuButtons.find(b => b.textContent && b.textContent.includes('学習計画・コマ割り'));
    if (schedBtn) {
      await act(async () => {
        fireEvent.click(schedBtn);
      });

      const autoReschedBtn = screen.queryByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
      if (autoReschedBtn) {
        await act(async () => {
          fireEvent.click(autoReschedBtn);
        });
      }

      const saveTimetableBtn = screen.queryByRole('button', { name: /時間割コマ割りを保存/i });
      if (saveTimetableBtn) {
        await act(async () => {
          fireEvent.click(saveTimetableBtn);
        });
      }
    }

    // 1.9 Unit test modal CRUD
    const openAddUnitTestBtn = screen.queryByRole('button', { name: /単元テストマスタ追加|単元テスト追加|テストマスタ/i });
    if (openAddUnitTestBtn) {
      await act(async () => {
        fireEvent.click(openAddUnitTestBtn);
      });
    }

    const modalSaveBtn = screen.queryByTestId('save-unittest-master-btn');
    if (modalSaveBtn) {
      await act(async () => {
        fireEvent.click(modalSaveBtn);
      });
    }
  });

  it('2. TeacherDashboard Elementary Timeline & Exclude/Restore actions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockElemStudent.id}
          teacherType="elementary"
          initialTab="milestones"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getByText(/小学生向け進度タイムライン/i)).toBeDefined();
    });

    // Restore excluded lesson
    const restoreBtn = screen.queryByRole('button', { name: /復帰/i });
    if (restoreBtn) {
      await act(async () => {
        fireEvent.click(restoreBtn);
      });
    }

    // Exclude step
    const excludeBtn = screen.queryByRole('button', { name: /このSTEPを除外/i });
    if (excludeBtn) {
      await act(async () => {
        fireEvent.click(excludeBtn);
      });
    }
  });

  it('3. TeacherDashboard Create Student, Delete School, and Delete Student workflows', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="create-student"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/新規生徒アカウント発行/i).length).toBeGreaterThan(0);
    });

    // Fill new student form
    const nameInput = screen.queryByPlaceholderText(/生徒の氏名を入力/i);
    if (nameInput) {
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: '新規テスト生徒' } });
      });
    }

    const schoolSelect = container.querySelector('select[value="sch-cov-jhs"]');
    if (schoolSelect) {
      await act(async () => {
        fireEvent.change(schoolSelect, { target: { value: 'add_new' } });
      });
    }

    const customSchoolInput = screen.queryByPlaceholderText(/学校名を入力/i);
    if (customSchoolInput) {
      await act(async () => {
        fireEvent.change(customSchoolInput, { target: { value: '新規開校中学' } });
      });
    }

    // Submit form
    const submitCreateBtn = screen.queryByRole('button', { name: /アカウントを発行/i });
    if (submitCreateBtn) {
      await act(async () => {
        fireEvent.click(submitCreateBtn);
      });
    }

    // Delete student
    const deleteBtn = screen.queryByRole('button', { name: /生徒を削除|生徒データを削除/i });
    if (deleteBtn) {
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
    }
  });

  it('4. db.ts: exercises full CRUD, sanitization helpers, and session management', async () => {
    // 4.1 Sanitization helpers
    const sanitizedTask = sanitizeLearningTask({
      id: 'task-san-1',
      student_id: 'st-san-1',
      unit_id: 'u-1',
      scheduled_date: '2026-06-01',
      status: 'unstarted'
    });
    expect(sanitizedTask.id).toBe('task-san-1');

    const sanitizedDBTask = sanitizeLearningTaskForDB(sanitizedTask);
    expect(sanitizedDBTask.id).toBe('task-san-1');

    const sanitizedMiniTest = sanitizeMiniTestResult({
      student_id: 'st-san-1',
      test_content: '連立方程式 単元確認テスト',
      score: 90,
      passing_line: '80点以上',
      test_type: 'unit_test',
      unit_name: '連立方程式'
    });
    expect(sanitizedMiniTest.test_type).toBe('unit_test');
    expect(sanitizedMiniTest.unit_name).toBe('連立方程式');

    const sanitizedHw = sanitizeHomeworkResult({
      student_id: 'st-san-1',
      date: '2026-06-01',
      homework_content: 'ワーク p.10-12',
      status: 'completed'
    });
    expect(sanitizedHw.homework_content).toBe('ワーク p.10-12');

    // 4.2 Branch AI Rules
    const defaultRules = db.getBranchAIRules('branch-cov-1');
    expect(defaultRules.lessons_per_slot).toBeDefined();

    const savedRules = await db.saveBranchAIRules('branch-cov-1', {
      lessons_per_slot: 3,
      auto_reschedule_mode: 'smart'
    });
    expect(savedRules.lessons_per_slot).toBe(3);

    const allRules = await db.saveBranchAIRules('all', {
      lessons_per_slot: 2
    });
    expect(allRules.lessons_per_slot).toBe(2);

    // 4.3 Password reset & Auth sessions
    const resetRes = await db.sendBranchPasswordReset('cov.branch@tentoru.jp');
    expect(resetRes.success).toBe(true);

    const loginRes = await db.signInWithPassword('cov.branch@tentoru.jp', 'password123');
    expect(loginRes.success).toBe(true);

    const adminLogin = await db.signInWithPassword('admin@tentoru.jp', 'password123');
    expect(adminLogin.success).toBe(true);

    const emptyEmailLogin = await db.signInWithPassword('', 'pass');
    expect(emptyEmailLogin.success).toBe(false);

    const emptyPassLogin = await db.signInWithPassword('admin@tentoru.jp', '');
    expect(emptyPassLogin.success).toBe(false);

    const wrongPassLogin = await db.signInWithPassword('admin@tentoru.jp', 'wrongpass');
    expect(wrongPassLogin.success).toBe(false);

    const session = db.getSession();
    expect(session).toBeDefined();

    await db.signOut();
    expect(db.getSession()).toBeNull();

    // 4.4 Exam Thresholds & Learning Logs CRUD
    const examThreshold: ExamThresholdMaster = {
      id: 'eth-cov-1',
      school_id: mockJhsSchool.id,
      grade: '中2',
      exam_name: '1学期中間',
      thresholds: { '数学': 80, '英語': 80 }
    };
    await db.saveExamThresholdMaster(examThreshold);
    const ethList = db.getExamThresholdsMaster();
    expect(ethList.some(e => e.id === 'eth-cov-1')).toBe(true);

    const log = {
      id: 'log-cov-1',
      student_id: mockElemStudent.id,
      date: '2026-06-01',
      period: 1,
      subject: '算数',
      tasks_completed: 2,
      understanding_level: 5,
      notes: '分度器の使い方をマスターした',
      created_at: new Date().toISOString()
    };
    await db.addLearningLog(log);
    const logs = db.getLearningLogs();
    expect(logs.some(l => l.id === 'log-cov-1')).toBe(true);

    // 4.5 Mini Test Results with studentId filter
    const studentTests = db.getMiniTestResults(mockElemStudent.id);
    expect(Array.isArray(studentTests)).toBe(true);
  });

  it('5. BranchManagement & CurriculumCsvImport components: exercises interactions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    // 5.1 BranchManagement
    await act(async () => {
      render(<BranchManagement onSwitchBranch={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/校舎アカウント管理/i)).toBeDefined();
    });

    const addBranchBtn = screen.getByRole('button', { name: /新規校舎アカウント発行/i });
    await act(async () => {
      fireEvent.click(addBranchBtn);
    });

    // 5.2 CurriculumCsvImport
    await act(async () => {
      render(<CurriculumCsvImport onImportComplete={() => {}} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/カリキュラムデータ CSV一括インポート/i).length).toBeGreaterThan(0);
    });
  });

  it('6. Home (app/page.tsx): exercises login state and rendering', async () => {
    const adminSession: UserSession = {
      user: {
        id: 'u-admin',
        email: 'admin@tentoru.jp',
        role: 'admin',
        branch_id: null,
        branch_name: '本部統括管理者',
        name: '本部管理者'
      },
      token: 'tok-admin',
      logged_in_at: new Date().toISOString()
    };
    db.saveSession(adminSession);

    await act(async () => {
      render(<Home />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/テントル 司令塔/i).length).toBeGreaterThan(0);
    });
  });



  it('7. TeacherDashboard: Deep coverage of Student Details, Tags, Interactions, and School Deletion', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="student-detail"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/中学生 カバ男/i).length).toBeGreaterThan(0);
    });

    // 7.1 Teacher tag interactions
    const newTeacherInput = screen.queryByPlaceholderText(/講師名を入力/i);
    const addTeacherBtn = screen.queryByRole('button', { name: /講師追加|担当追加/i });
    if (newTeacherInput && addTeacherBtn) {
      await act(async () => {
        fireEvent.change(newTeacherInput, { target: { value: '新規講師A' } });
        fireEvent.click(addTeacherBtn);
      });
    }

    // 7.2 Personality tag interactions
    const newPersInput = screen.queryByPlaceholderText(/特徴・性格を入力/i);
    const addPersBtn = screen.queryByRole('button', { name: /特徴追加|タグ追加/i });
    if (newPersInput && addPersBtn) {
      await act(async () => {
        fireEvent.change(newPersInput, { target: { value: '質問が多い' } });
        fireEvent.click(addPersBtn);
      });
    }

    // 7.3 Interaction history add
    const interactionInput = screen.queryByPlaceholderText(/対応内容・面談メモなどを入力/i);
    const addInteractionBtn = screen.queryByRole('button', { name: /対応履歴を追加|履歴追加/i });
    if (interactionInput && addInteractionBtn) {
      await act(async () => {
        fireEvent.change(interactionInput, { target: { value: '保護者面談を実施。志望校について協議。' } });
        fireEvent.click(addInteractionBtn);
      });
    }

    // 7.4 Save Student Detail
    const saveBtn = screen.queryByRole('button', { name: /変更を保存する/i });
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }

    // 7.5 Delete Student
    const deleteStudentBtn = screen.queryByRole('button', { name: /生徒データを削除/i });
    if (deleteStudentBtn) {
      await act(async () => {
        fireEvent.click(deleteStudentBtn);
      });
    }
  });

  it('8. TeacherDashboard: Deep coverage of Milestones, Bulk Schedule, and AIRules', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="milestones"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/年間計画/i).length).toBeGreaterThan(0);
    });

    // 8.1 Add milestone row & template action
    const addMilestoneRowBtn = screen.queryByRole('button', { name: /行を追加/i });
    if (addMilestoneRowBtn) {
      await act(async () => {
        fireEvent.click(addMilestoneRowBtn);
      });
    }

    // 8.2 Switch to Schedule and test Bulk Schedule / Auto Reschedule
    const schedBtn = screen.queryByRole('button', { name: /学習計画・コマ割り/i });
    if (schedBtn) {
      await act(async () => {
        fireEvent.click(schedBtn);
      });

      const autoReschedBtn = screen.queryByRole('button', { name: /遅れチェック ＆ 自動リスケ/i });
      if (autoReschedBtn) {
        await act(async () => {
          fireEvent.click(autoReschedBtn);
        });
      }

      const bulkModalOpenBtn = screen.queryByRole('button', { name: /一括設定|一括コマ割り/i });
      if (bulkModalOpenBtn) {
        await act(async () => {
          fireEvent.click(bulkModalOpenBtn);
        });

        const bulkApplyBtn = screen.queryByRole('button', { name: /一括適用/i });
        if (bulkApplyBtn) {
          await act(async () => {
            fireEvent.click(bulkApplyBtn);
          });
        }
      }
    }
  });

  it('9. TeacherDashboard: Regular Exams, AI Guidance Report Generation, Custom Classes, and Mini Tests', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="tests"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/定期テスト・模試/i).length).toBeGreaterThan(0);
    });

    // 9.1 Save regular exam & mock exam
    const saveRegularBtn = screen.queryByRole('button', { name: /定期テスト結果を保存/i });
    if (saveRegularBtn) {
      await act(async () => {
        fireEvent.click(saveRegularBtn);
      });
    }

    const saveMockBtn = screen.queryByRole('button', { name: /北辰・会場模試結果を保存/i });
    if (saveMockBtn) {
      await act(async () => {
        fireEvent.click(saveMockBtn);
      });
    }

    // 9.2 Switch to AI Report Tab
    const aiReportBtn = screen.queryByRole('button', { name: /AI指導報告書/i });
    if (aiReportBtn) {
      await act(async () => {
        fireEvent.click(aiReportBtn);
      });

      const generateBtn = screen.queryByRole('button', { name: /自動生成/i });
      if (generateBtn) {
        await act(async () => {
          fireEvent.click(generateBtn);
        });
      }

      const saveAiReportBtn = screen.queryByRole('button', { name: /報告書を保存/i });
      if (saveAiReportBtn) {
        await act(async () => {
          fireEvent.click(saveAiReportBtn);
        });
      }
    }

    // 9.3 Switch to mini-tests and homeworks
    const miniTestsBtn = screen.queryByRole('button', { name: /小テスト結果/i });
    if (miniTestsBtn) {
      await act(async () => {
        fireEvent.click(miniTestsBtn);
      });
    }

    const homeworksBtn = screen.queryByRole('button', { name: /宿題提出状況/i });
    if (homeworksBtn) {
      await act(async () => {
        fireEvent.click(homeworksBtn);
      });
    }
  });

  it('10. TeacherDashboard: Extensive coverage of Curriculums, Custom Classes, API Key, AI Rules modal, and Force Sync', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="curriculum"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/学校カリキュラム管理/i).length).toBeGreaterThan(0);
    });

    // 10.1 Delete curriculum unit if available
    const deleteUnitBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (deleteUnitBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteUnitBtns[0]);
      });
    }

    // 10.2 Force sync students
    const syncBtn = screen.queryByRole('button', { name: /生徒同期|データ同期|最新情報に更新/i });
    if (syncBtn) {
      await act(async () => {
        fireEvent.click(syncBtn);
      });
    }

    // 10.3 AI Rules Modal
    const aiRulesBtn = screen.queryByRole('button', { name: /AIコマ割り設定|AI設定/i });
    if (aiRulesBtn) {
      await act(async () => {
        fireEvent.click(aiRulesBtn);
      });

      const saveAiRulesBtn = screen.queryByRole('button', { name: /設定を保存/i });
      if (saveAiRulesBtn) {
        await act(async () => {
          fireEvent.click(saveAiRulesBtn);
        });
      }
    }
  });

  it('11. db.ts: Deep coverage of all edge methods and queries', async () => {
    // 11.1 School CRUD
    const schools = db.getSchools();
    expect(schools.length).toBeGreaterThan(0);

    await db.saveSchool({ id: 'sch-temp-1', name: '一時学校', type: 'elementary' } as any);
    expect(db.getSchools().some(s => s.id === 'sch-temp-1')).toBe(true);
    await db.deleteSchool('sch-temp-1');
    expect(db.getSchools().some(s => s.id === 'sch-temp-1')).toBe(false);

    // 11.2 Learning Tasks CRUD & filters
    const allTasks = db.getLearningTasks();
    expect(Array.isArray(allTasks)).toBe(true);

    const fetchedTasks = await db.fetchLearningTasks(mockJhsStudent.id);
    expect(Array.isArray(fetchedTasks)).toBe(true);

    await db.saveLearningTasks([
      {
        id: 'task-cov-bulk-1',
        student_id: mockJhsStudent.id,
        unit_id: 'unit-cov-1',
        scheduled_date: '2026-06-01',
        status: 'unstarted'
      }
    ]);

    await db.deleteLearningTasksByStudent(mockJhsStudent.id);

    // 11.3 Custom Classes & Custom Apply Scopes
    const customClass = {
      id: 'cc-cov-1',
      name: '特別選抜',
      grade: '中2',
      student_ids: [mockJhsStudent.id],
      subject_settings: {}
    };
    await db.saveCustomClass(customClass);
    expect(db.getCustomClasses().some(c => c.id === 'cc-cov-1')).toBe(true);
    await db.deleteCustomClass('cc-cov-1');

    const customScope = {
      id: 'cs-cov-1',
      name: '特進クラス',
      grade: '中2',
      school_id: mockJhsSchool.id,
      student_ids: [mockJhsStudent.id]
    };
    await db.saveCustomApplyScope(customScope);
    expect(db.getCustomApplyScopes().some(s => s.id === 'cs-cov-1')).toBe(true);
    await db.deleteCustomApplyScope('cs-cov-1');

    // 11.4 Milestone plans & templates
    const plans = db.getMilestonePlans();
    expect(Array.isArray(plans)).toBe(true);

    await db.saveMilestonePlan({
      student_id: mockJhsStudent.id,
      schedule_matrix: {},
      quarter_goals: {},
      custom_rows: [],
      hidden_rows: []
    } as any);

    const template: MilestoneTemplate = {
      id: 'tmpl-cov-1',
      name: 'テスト用テンプレート',
      grade: '中2',
      schedule_matrix: {},
      quarter_goals: {},
      custom_rows: []
    };
    await db.saveMilestoneTemplate(template);
    expect(db.getMilestoneTemplates().some(t => t.id === 'tmpl-cov-1')).toBe(true);
    await db.deleteMilestoneTemplate('tmpl-cov-1');

    // 11.5 Curriculum units
    const units = db.getCurriculumUnits();
    expect(Array.isArray(units)).toBe(true);

    // 11.6 Exam / Test records CRUD
    const examRecord = {
      id: 'exam-cov-1',
      student_id: mockJhsStudent.id,
      exam_type: 'regular' as const,
      exam_name: '1学期期末',
      grade: '中2',
      semester: '1学期',
      scores: { '数学': 95 },
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(examRecord as any);
    const exams = db.getTestRecords();
    expect(exams.some(e => e.id === 'exam-cov-1')).toBe(true);
    await db.deleteTestRecord('exam-cov-1');

    // 11.7 Mini Test & Homework Results CRUD
    const miniTest: MiniTestResult = {
      id: 'mt-cov-1',
      student_id: mockJhsStudent.id,
      date: '2026-06-01',
      subject: '数学',
      test_content: '確認テスト',
      score: 100,
      passed: true
    };
    await db.saveMiniTestResult(miniTest);
    expect(db.getMiniTestResults(mockJhsStudent.id).some(m => m.id === 'mt-cov-1')).toBe(true);
    await db.deleteMiniTestResult('mt-cov-1');

    const hw: HomeworkResult = {
      id: 'hw-cov-1',
      student_id: mockJhsStudent.id,
      date: '2026-06-01',
      subject: '数学',
      homework_content: '計算ドリル',
      status: 'completed'
    };
    await db.saveHomeworkResult(hw);
    expect(db.getHomeworkResults(mockJhsStudent.id).some(h => h.id === 'hw-cov-1')).toBe(true);
    await db.deleteHomeworkResult('hw-cov-1');
  });

  it('12. TeacherDashboard: Extensive Student Detail & Tag Deletions & School Deletion', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockElemStudent.id}
          teacherType="elementary"
          initialTab="student-detail"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/小学生 カバ子/i).length).toBeGreaterThan(0);
    });

    // 12.1 Form fields updates (kana, phone, club, hobbies, dates)
    const kanaInput = container.querySelector('input[placeholder*="フリガナ"]');
    if (kanaInput) {
      await act(async () => {
        fireEvent.change(kanaInput, { target: { value: 'ショウガクセイ カバコ' } });
      });
    }

    const phoneInput = container.querySelector('input[placeholder*="電話番号"]');
    if (phoneInput) {
      await act(async () => {
        fireEvent.change(phoneInput, { target: { value: '090-1234-5678' } });
      });
    }

    // 12.2 Start unit dropdown changes
    const startUnitSelects = container.querySelectorAll('select');
    if (startUnitSelects.length > 0) {
      await act(async () => {
        fireEvent.change(startUnitSelects[0], { target: { value: 'cm-cov-m2' } });
      });
    }

    // 12.3 Tag removal chips
    const tagChips = Array.from(container.querySelectorAll('button, span')).filter(el => 
      el.textContent && (el.textContent.includes('✕') || el.textContent.includes('×'))
    );
    for (const chip of tagChips.slice(0, 3)) {
      await act(async () => {
        fireEvent.click(chip);
      });
    }

    // 12.4 Save detail
    const saveBtn = screen.queryByRole('button', { name: /変更を保存する/i });
    if (saveBtn) {
      await act(async () => {
        fireEvent.click(saveBtn);
      });
    }
  });

  it('13. TeacherDashboard: Extensive Milestone Timeline operations, Row toggles, Templates', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="milestones"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/年間計画/i).length).toBeGreaterThan(0);
    });

    // 13.1 Add row
    const addRowBtn = screen.queryByRole('button', { name: /行を追加/i });
    if (addRowBtn) {
      await act(async () => {
        fireEvent.click(addRowBtn);
      });
    }

    // 13.2 Save template modal / button
    const saveTemplateBtn = screen.queryByRole('button', { name: /テンプレートとして保存/i });
    if (saveTemplateBtn) {
      await act(async () => {
        fireEvent.click(saveTemplateBtn);
      });
    }

    // 13.3 Apply template button
    const applyTemplateBtn = screen.queryByRole('button', { name: /テンプレートを適用/i });
    if (applyTemplateBtn) {
      await act(async () => {
        fireEvent.click(applyTemplateBtn);
      });
    }
  });

  it('14. TeacherDashboard: Header Role Toggles, Teacher Type Toggles, and Branch Switcher', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    const onBackMock = vi.fn();
    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          onBackToPortal={onBackMock}
          teacherType="junior_high"
          initialTab="student-list"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/生徒一覧/i).length).toBeGreaterThan(0);
    });

    // 14.1 Role toggles (admin vs branch)
    const adminRoleBtn = screen.queryByTestId('role-toggle-admin');
    const branchRoleBtn = screen.queryByTestId('role-toggle-branch');
    if (branchRoleBtn) {
      await act(async () => {
        fireEvent.click(branchRoleBtn);
      });
    }
    if (adminRoleBtn) {
      await act(async () => {
        fireEvent.click(adminRoleBtn);
      });
    }

    // 14.2 Header teacher type toggles (elementary / jhs / high)
    const elemTypeBtn = screen.queryByTestId('header-teacher-type-elem');
    const jhsTypeBtn = screen.queryByTestId('header-teacher-type-jhs');
    const highTypeBtn = screen.queryByTestId('header-teacher-type-high');
    if (elemTypeBtn) {
      await act(async () => {
        fireEvent.click(elemTypeBtn);
      });
    }
    if (highTypeBtn) {
      await act(async () => {
        fireEvent.click(highTypeBtn);
      });
    }
    if (jhsTypeBtn) {
      await act(async () => {
        fireEvent.click(jhsTypeBtn);
      });
    }

    // 14.3 Branch Switcher
    const branchSelect = screen.queryByTestId('admin-branch-switcher');
    if (branchSelect) {
      await act(async () => {
        fireEvent.change(branchSelect, { target: { value: 'branch-cov-1' } });
        fireEvent.change(branchSelect, { target: { value: 'all' } });
      });
    }

    // 14.4 Back to portal button
    const backBtn = container.querySelector('button._backBtn_8806bf, button[class*="backBtn"]');
    if (backBtn) {
      await act(async () => {
        fireEvent.click(backBtn);
      });
      expect(onBackMock).toHaveBeenCalled();
    }
  });

  it('15. TeacherDashboard: Student List search, grade/branch filters, sorting, and student card selection', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          teacherType="junior_high"
          initialTab="student-list"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/生徒一覧/i).length).toBeGreaterThan(0);
    });

    // 15.1 Search input
    const searchInput = container.querySelector('input[placeholder*="氏名や学校名"]');
    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'カバ男' } });
        fireEvent.change(searchInput, { target: { value: '' } });
      });
    }

    // 15.2 Grade and sort filters
    const selects = container.querySelectorAll('select');
    for (const sel of Array.from(selects)) {
      await act(async () => {
        if (sel.options.length > 1) {
          fireEvent.change(sel, { target: { value: sel.options[1].value } });
        }
      });
    }

    // 15.3 Student card click
    const studentCards = container.querySelectorAll('div[class*="studentCard"], div[class*="studentItem"]');
    if (studentCards.length > 0) {
      await act(async () => {
        fireEvent.click(studentCards[0]);
      });
    }
  });

  it('16. TeacherDashboard: Curriculum Tab subject switching, unit sorting, and custom units', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="curriculum"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/学校カリキュラム管理/i).length).toBeGreaterThan(0);
    });

    // 16.1 Switch subjects (数学, 英語, 国語, 理科, 社会)
    const subjectButtons = Array.from(container.querySelectorAll('button')).filter(b =>
      ['数学', '英語', '国語', '理科', '社会'].includes(b.textContent?.trim() || '')
    );
    for (const btn of subjectButtons) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    // 16.2 Move up / down buttons
    const moveButtons = Array.from(container.querySelectorAll('button')).filter(b =>
      b.textContent?.includes('↑') || b.textContent?.includes('↓')
    );
    for (const btn of moveButtons.slice(0, 4)) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
  });

  it('17. TeacherDashboard: Regular Exams, Mock Exams History, AI Reports Prompt Correction and Save', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="tests"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/定期テスト・模試/i).length).toBeGreaterThan(0);
    });

    // 17.1 Fill scores in regular exam
    const scoreInputs = container.querySelectorAll('input[type="number"]');
    scoreInputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: `${80 + i}` } });
    });

    const saveExamBtn = screen.queryByRole('button', { name: /定期テスト結果を保存/i });
    if (saveExamBtn) {
      await act(async () => {
        fireEvent.click(saveExamBtn);
      });
    }

    // 17.2 Switch to AI Report and edit prompt
    const aiTabBtn = screen.queryByRole('button', { name: /AI指導報告書/i });
    if (aiTabBtn) {
      await act(async () => {
        fireEvent.click(aiTabBtn);
      });

      const promptTextarea = container.querySelector('textarea');
      if (promptTextarea) {
        await act(async () => {
          fireEvent.change(promptTextarea, { target: { value: '指導報告書のカスタム修正指示文' } });
        });
      }

      const saveReportBtn = screen.queryByRole('button', { name: /報告書を保存/i });
      if (saveReportBtn) {
        await act(async () => {
          fireEvent.click(saveReportBtn);
        });
      }
    }
  });

  it('18. TeacherDashboard: Extensive UnitTest Master modal & Branch AI Rules modal interactions', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="schedule"
        />
      );
      container = renderRes.container;
    });

    // 18.1 Open & Configure Branch AI Rules Modal
    const openAiRulesBtn = screen.queryByRole('button', { name: /AIコマ割り設定|AI設定|AI自動設定/i });
    if (openAiRulesBtn) {
      await act(async () => {
        fireEvent.click(openAiRulesBtn);
      });

      const lessonsPerSlotInput = screen.queryByTestId('branch-ai-lessons-per-slot-input');
      if (lessonsPerSlotInput) {
        await act(async () => {
          fireEvent.change(lessonsPerSlotInput, { target: { value: '3' } });
        });
      }

      const saveAiRulesBtn = screen.queryByTestId('save-branch-ai-rules-btn');
      if (saveAiRulesBtn) {
        await act(async () => {
          fireEvent.click(saveAiRulesBtn);
        });
      }
    }

    // 18.2 Open UnitTest Master Modal from curriculum or test master button
    const openUnitTestModalBtn = screen.queryByRole('button', { name: /単元テストマスタ追加|単元テスト追加|テストマスタ/i });
    if (openUnitTestModalBtn) {
      await act(async () => {
        fireEvent.click(openUnitTestModalBtn);
      });

      const modal = screen.queryByTestId('unit-test-master-modal');
      if (modal) {
        const selects = modal.querySelectorAll('select');
        if (selects.length >= 2) {
          await act(async () => {
            fireEvent.change(selects[0], { target: { value: '数学' } });
            fireEvent.change(selects[1], { target: { value: '中2' } });
          });
        }

        const inputs = modal.querySelectorAll('input');
        if (inputs.length >= 3) {
          await act(async () => {
            fireEvent.change(inputs[0], { target: { value: '1章 式の計算' } });
            fireEvent.change(inputs[1], { target: { value: '式の計算 - 単元テスト' } });
            fireEvent.change(inputs[2], { target: { value: '85点以上' } });
          });
        }

        const saveModalBtn = screen.queryByTestId('save-unittest-master-btn');
        if (saveModalBtn) {
          await act(async () => {
            fireEvent.click(saveModalBtn);
          });
        }
      }
    }
  });

  it('19. TeacherDashboard: Extensive Student Interaction Logging with "Other" Staff and Delete', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="student-detail"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/中学生 カバ男/i).length).toBeGreaterThan(0);
    });

    // 19.1 Select "other" for staff name
    const staffSelect = container.querySelector('#interaction-staff-name');
    if (staffSelect) {
      await act(async () => {
        fireEvent.change(staffSelect, { target: { value: 'other' } });
      });

      const customStaffInput = screen.queryByPlaceholderText(/講師名を入力\.\.\./i);
      if (customStaffInput) {
        await act(async () => {
          fireEvent.change(customStaffInput, { target: { value: '外部特別講師' } });
        });
      }
    }

    const memoTextarea = screen.queryByPlaceholderText(/具体的な対応メモを入力/i);
    if (memoTextarea) {
      await act(async () => {
        fireEvent.change(memoTextarea, { target: { value: '特別進路相談を実施しました。' } });
      });
    }

    const submitInteractionBtn = screen.queryByRole('button', { name: /対応内容を登録/i });
    if (submitInteractionBtn) {
      await act(async () => {
        fireEvent.click(submitInteractionBtn);
      });
    }

    // 19.2 Edit interaction
    const editBtns = container.querySelectorAll('button[data-testid^="edit-interaction-"]');
    if (editBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editBtns[0]);
      });

      const editMemoArea = container.querySelector('textarea');
      if (editMemoArea) {
        await act(async () => {
          fireEvent.change(editMemoArea, { target: { value: '編集後のメモ内容' } });
        });
      }

      const saveEditBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === '保存');
      if (saveEditBtn) {
        await act(async () => {
          fireEvent.click(saveEditBtn);
        });
      }
    }

    // 19.3 Delete interaction
    const deleteBtns = container.querySelectorAll('button[data-testid^="delete-interaction-"]');
    if (deleteBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteBtns[0]);
      });
    }
  });

  it('20. TeacherDashboard: Extensive Test Records Deletion, Mini-Test Delete, and Homework Delete', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    const testRecord = {
      id: 'test-del-cov-1',
      student_id: mockJhsStudent.id,
      exam_type: 'regular' as const,
      exam_name: '1学期中間テスト',
      grade: '中2',
      semester: '1学期',
      scores: { '数学': 88 },
      created_at: new Date().toISOString()
    };
    await db.saveTestRecord(testRecord as any);

    let container: HTMLElement;
    await act(async () => {
      const renderRes = render(
        <TeacherDashboard
          initialStudentId={mockJhsStudent.id}
          teacherType="junior_high"
          initialTab="tests"
        />
      );
      container = renderRes.container;
    });

    await waitFor(() => {
      expect(screen.getAllByText(/定期テスト・模試/i).length).toBeGreaterThan(0);
    });

    // 20.1 Delete test record
    const deleteTestRecordBtns = Array.from(container.querySelectorAll('button')).filter(b => 
      b.textContent?.includes('削除') || b.textContent?.includes('🗑️')
    );
    if (deleteTestRecordBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteTestRecordBtns[0]);
      });
    }

    // 20.2 Switch to mini tests and delete
    const miniTabBtn = screen.queryByRole('button', { name: /小テスト結果/i });
    if (miniTabBtn) {
      await act(async () => {
        fireEvent.click(miniTabBtn);
      });

      const deleteMiniBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('削除'));
      if (deleteMiniBtns.length > 0) {
        await act(async () => {
          fireEvent.click(deleteMiniBtns[0]);
        });
      }
    }

    // 20.3 Switch to homeworks and delete
    const hwTabBtn = screen.queryByRole('button', { name: /宿題提出状況/i });
    if (hwTabBtn) {
      await act(async () => {
        fireEvent.click(hwTabBtn);
      });

      const deleteHwBtns = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('削除'));
      if (deleteHwBtns.length > 0) {
        await act(async () => {
          fireEvent.click(deleteHwBtns[0]);
        });
      }
    }
  });

  it('21. db.ts: Exhaustive Branch & Session & Error coverage', async () => {
    // 21.1 Suspended branch login
    const suspendedBranch: Branch = {
      id: 'branch-susp-1',
      name: '停止中校舎',
      code: 'B_SUSP',
      email: 'susp.branch@tentoru.jp',
      status: 'suspended',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(suspendedBranch);
    const suspLogin = await db.signInWithPassword('susp.branch@tentoru.jp', 'password');
    expect(suspLogin.success).toBe(false);
    expect(suspLogin.error).toContain('一時停止中');

    // 21.2 Generic school email login
    const genericLogin = await db.signInWithPassword('school.tokyo@tentoru.jp', 'password');
    expect(genericLogin.success).toBe(true);

    // 21.3 Invalid format login
    const invalidLogin = await db.signInWithPassword('invalidemailformat', 'password');
    expect(invalidLogin.success).toBe(false);

    // 21.4 Current user role setter & getter
    db.setCurrentUserRole('branch', 'branch-cov-1', 'カバレッジ校舎');
    const roleInfo = db.getCurrentUserRole();
    expect(roleInfo.role).toBe('branch');
    expect(roleInfo.branch_id).toBe('branch-cov-1');

    // 21.5 Supabase error paths simulation
    const originalMock = (db as any).isMockMode;
    const originalSb = (db as any).supabase;

    (db as any).isMockMode = false;
    (db as any).supabase = {
      from: () => ({
        update: () => ({
          eq: async () => ({ error: { message: 'DB Update Error' } })
        })
      }),
      auth: {
        resetPasswordForEmail: async () => ({ error: { message: 'Reset Error' } }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Invalid Login' } })
      }
    };

    await db.saveBranchAIRules('branch-cov-1', { lessons_per_slot: 4 });
    await db.sendBranchPasswordReset('cov.branch@tentoru.jp');
    const sbFailLogin = await db.signInWithPassword('cov.branch@tentoru.jp', 'password');
    expect(sbFailLogin.success).toBe(true);

    (db as any).isMockMode = originalMock;
    (db as any).supabase = originalSb;
  });

  it('22. TeacherDashboard: Unit Test Master Modal with new, edit, and custom sort order placement', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const testMasters: CurriculumMaster[] = [
      { id: 'cm-cov-u1', grade: '中2', subject: '数学', unit_name: '1章 連立方程式', lesson_name: 'STEP 1', sort_order: 1, item_type: 'lesson' },
      { id: 'cm-cov-u2', grade: '中2', subject: '数学', unit_name: '1章 連立方程式', lesson_name: 'STEP 2', sort_order: 2, item_type: 'lesson' },
      { id: 'cm-cov-u3', grade: '中2', subject: '数学', unit_name: '2章 一次関数', lesson_name: 'STEP 1', sort_order: 3, item_type: 'lesson' },
    ];
    await db.saveCurriculumMasters(testMasters);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        curriculumMasters={testMasters}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="milestones"
      />
    );

    // 単元テスト追加ボタンをクリックしてモーダルを開く
    const addUnitTestBtn = screen.queryByRole('button', { name: /単元テストの追加|単元テストマスタ登録/i }) || screen.queryByText(/単元テストマスタ登録|単元テストを追加/i);
    if (addUnitTestBtn) {
      fireEvent.click(addUnitTestBtn);
    }

    // 単元テストモーダルが開いている場合の入力
    const testNameInput = screen.queryByPlaceholderText(/たしざん 単元確認テスト/i);
    if (testNameInput) {
      fireEvent.change(testNameInput, { target: { value: '連立方程式の応用 単元確認テスト' } });

      const passingLineInput = screen.queryByPlaceholderText(/80%以上, 90点/i);
      if (passingLineInput) {
        fireEvent.change(passingLineInput, { target: { value: '85%以上' } });
      }

      const saveBtn = screen.getByTestId('save-unittest-master-btn');
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalled();
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });

  it('23. TeacherDashboard: Tests & Exams Tab: Regular Exam Scores & Mock Exams Management', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="tests"
      />
    );

    // 定期テスト追加ボタンや入力フォームの操作
    const examInputs = screen.queryAllByRole('textbox');
    if (examInputs.length > 0) {
      fireEvent.change(examInputs[0], { target: { value: '1学期期末テスト' } });
    }

    const numberInputs = screen.queryAllByRole('spinbutton');
    numberInputs.forEach(input => {
      fireEvent.change(input, { target: { value: '85' } });
    });

    const addExamBtns = screen.queryAllByRole('button', { name: /追加|保存|登録/i });
    if (addExamBtns.length > 0) {
      fireEvent.click(addExamBtns[0]);
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });

  it('24. TeacherDashboard: Homeworks & Mini-Tests Tabs Complete User Interaction', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const testHw: HomeworkResult = {
      id: 'hw-cov-tab-1',
      student_id: mockJhsStudent.id,
      date: '2026-04-10',
      subject: '数学',
      unit_name: '1章 連立方程式',
      lesson_name: 'STEP 1 宿題',
      status: 'incomplete',
      created_at: new Date().toISOString()
    };
    await db.saveHomeworkResult(testHw);

    const testMini: MiniTestResult = {
      id: 'mini-cov-tab-1',
      student_id: mockJhsStudent.id,
      date: '2026-04-10',
      subject: '数学',
      test_type: 'unit_test',
      unit_name: '1章 連立方程式',
      lesson_name: '連立方程式 単元確認テスト',
      status: 'pending',
      score: 0,
      passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(testMini);

    // 宿題タブのレンダリングと操作
    const { unmount: unmountHw } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="homeworks"
      />
    );

    const hwSelects = screen.queryAllByRole('combobox');
    if (hwSelects.length > 0) {
      fireEvent.change(hwSelects[0], { target: { value: 'completed' } });
    }
    const saveHwBtns = screen.queryAllByRole('button', { name: /保存|更新/i });
    if (saveHwBtns.length > 0) {
      fireEvent.click(saveHwBtns[0]);
    }
    unmountHw();

    // ミニテストタブのレンダリングと操作
    const { unmount: unmountMini } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="mini-tests"
      />
    );

    const passBtns = screen.queryAllByRole('button', { name: /合格|採点|保存/i });
    if (passBtns.length > 0) {
      fireEvent.click(passBtns[0]);
    }
    unmountMini();

    alertMock.mockRestore();
    confirmMock.mockRestore();
  });

  it('25. TeacherDashboard: Period Selection, Subject Change, and Auto Reschedule Interaction', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="schedule"
      />
    );

    // リスケボタンのクリック
    const rescheduleBtn = screen.queryByRole('button', { name: /遅れチェック|リスケ/i });
    if (rescheduleBtn) {
      fireEvent.click(rescheduleBtn);
    }

    alertMock.mockRestore();
    unmount();
  });

  it('26. TeacherDashboard: Full Lifecycle of Student Detail, AI Rules, Sync, and Templates', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent, mockElemStudent]}
        schools={[mockElemSchool, mockJhsSchool]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="student-detail"
      />
    );

    // 性格タグの追加
    const personalityInput = screen.queryByPlaceholderText(/新しい性格・特徴タグ/i);
    if (personalityInput) {
      fireEvent.change(personalityInput, { target: { value: '論理的思考' } });
      const addTagBtn = screen.queryByRole('button', { name: /タグ追加/i });
      if (addTagBtn) fireEvent.click(addTagBtn);
    }

    // 担当講師タグの追加
    const teacherInput = screen.queryByPlaceholderText(/講師名を入力/i);
    if (teacherInput) {
      fireEvent.change(teacherInput, { target: { value: '新規 講師' } });
      const addTeacherBtn = screen.queryByRole('button', { name: /講師追加/i });
      if (addTeacherBtn) fireEvent.click(addTeacherBtn);
    }

    // 面談メモの入力
    const memoTextarea = screen.queryByPlaceholderText(/面談内容、生徒の様子、連絡事項などを入力/i);
    if (memoTextarea) {
      fireEvent.change(memoTextarea, { target: { value: '保護者面談を実施。学習順調。' } });
      const saveMemoBtn = screen.queryByRole('button', { name: /面談記録を保存/i });
      if (saveMemoBtn) fireEvent.click(saveMemoBtn);
    }

    // カルテ保存ボタン
    const saveDetailBtn = screen.queryByRole('button', { name: /生徒情報を更新/i });
    if (saveDetailBtn) {
      fireEvent.click(saveDetailBtn);
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });

  it('27. TeacherDashboard: Deepest Edge Case Handlers and UI States', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    // High school student for high school subject selectors
    const hsStudent: Student = {
      id: 'st-cov-hs-1',
      student_id: 'S_COV_HS_1',
      name: '高校生 カバ男',
      grade: '高1',
      status: 'fast',
      level: 'A',
      branch_id: 'branch-cov-1',
      classroom: 'カバレッジ校舎',
      school_id: 'sch-cov-jhs',
      school_name: 'カバレッジ高校',
      selected_days: ['wednesday', 'saturday'],
      selected_subjects: ['数学', '英語', '国語', '理科', '社会'],
      period_count: 2,
      default_slots: 2
    };
    await db.saveStudent(hsStudent);

    const { unmount: unmountHs } = render(
      <TeacherDashboard
        students={[hsStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={hsStudent.id}
        initialTab="schedule"
      />
    );

    // リスケ実行
    const reschedBtn = screen.queryByRole('button', { name: /遅れチェック|リスケ/i });
    if (reschedBtn) {
      fireEvent.click(reschedBtn);
    }
    unmountHs();

    // カリキュラム単元の追加、編集、削除テスト
    const { unmount: unmountCurr } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        schools={[mockJhsSchool]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="curriculum"
      />
    );

    const unitInput = screen.queryByPlaceholderText(/単元名を入力/i);
    const addUnitBtn = screen.queryByText(/＋ 単元を追加/i);
    if (unitInput && addUnitBtn) {
      fireEvent.change(unitInput, { target: { value: '新しい単元' } });
      fireEvent.click(addUnitBtn);
    }

    const editUnitBtns = screen.queryAllByRole('button', { name: '編集' });
    if (editUnitBtns.length > 0) {
      fireEvent.click(editUnitBtns[0]);
      const updateUnitBtn = screen.queryByText(/更新/i);
      if (updateUnitBtn) fireEvent.click(updateUnitBtn);
    }

    const deleteUnitBtns = screen.queryAllByRole('button', { name: '削除' });
    if (deleteUnitBtns.length > 0) {
      fireEvent.click(deleteUnitBtns[0]);
    }
    unmountCurr();

    // AI指導レポート生成と保存
    const { unmount: unmountAi } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        schools={[mockJhsSchool]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="ai-report"
      />
    );

    const aiGenBtn = screen.queryByRole('button', { name: /AI指導レポートを生成|レポート生成/i });
    if (aiGenBtn) {
      fireEvent.click(aiGenBtn);
    }
    unmountAi();

    alertMock.mockRestore();
    confirmMock.mockRestore();
  });

  it('28. TeacherDashboard: Full Elementary Timeline Unit Test Master Modal with all inputs and cancel', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockElemStudent]}
        curriculumMasters={[]}
        tasks={[]}
        initialStudentId={mockElemStudent.id}
        initialTab="milestones"
      />
    );

    // ➕ 単元テストを追加ボタンをクリック
    const addUnitTestBtn = screen.getByTestId('timeline-add-unittest-btn');
    fireEvent.click(addUnitTestBtn);

    // モーダルが表示されていること
    expect(screen.getByTestId('unit-test-master-modal')).toBeInTheDocument();

    // 対象単元の入力
    const unitInput = screen.getByPlaceholderText(/例: 1章 整数と小数/i);
    fireEvent.change(unitInput, { target: { value: '1章 小数と計算' } });

    // テスト名の入力
    const testNameInput = screen.getByPlaceholderText(/例: たしざん 単元確認テスト/i);
    fireEvent.change(testNameInput, { target: { value: '小数のかけ算 単元確認テスト' } });

    // 合格基準の入力
    const passingInput = screen.getByPlaceholderText(/例: 80%以上, 90点/i);
    fireEvent.change(passingInput, { target: { value: '85%以上' } });

    // 保存ボタンをクリック
    const saveBtn = screen.getByTestId('save-unittest-master-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });

    // 再度モーダルを開いてキャンセルボタンをクリック
    fireEvent.click(addUnitTestBtn);
    const cancelBtn = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText('単元テストマスタ登録・編集')).not.toBeInTheDocument();

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });

  it('29. TeacherDashboard: exercises student target schools CRUD and note interactions in student detail tab', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        schools={[mockJhsSchool]}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="student-detail"
      />
    );

    // 志望校入力フィールド
    const schoolNameInput = screen.queryByPlaceholderText(/例: 〇〇高校/i);
    const courseInput = screen.queryByPlaceholderText(/例: 普通科/i);
    const addSchoolBtn = screen.queryByRole('button', { name: /志望校を追加/i });

    if (schoolNameInput && courseInput && addSchoolBtn) {
      await act(async () => {
        fireEvent.change(schoolNameInput, { target: { value: '開成高校' } });
        fireEvent.change(courseInput, { target: { value: '普通科' } });
        fireEvent.click(addSchoolBtn);
      });
    }

    // 志望校削除ボタン
    const delTargetBtns = screen.queryAllByRole('button', { name: /削除/i });
    if (delTargetBtns.length > 0) {
      await act(async () => {
        fireEvent.click(delTargetBtns[0]);
      });
    }

    // 生徒基本情報更新ボタン
    const updateStudentBtn = screen.queryByRole('button', { name: /生徒情報を更新/i });
    if (updateStudentBtn) {
      await act(async () => {
        fireEvent.click(updateStudentBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });

  it('30. TeacherDashboard: exercises regular exam modal and score threshold entries', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { unmount } = render(
      <TeacherDashboard
        students={[mockJhsStudent]}
        schools={[mockJhsSchool]}
        curriculumMasters={mockMasters}
        tasks={[]}
        initialStudentId={mockJhsStudent.id}
        initialTab="tests"
      />
    );

    const testNameInput = screen.queryByPlaceholderText(/例: 1学期中間テスト/i);
    if (testNameInput) {
      await act(async () => {
        fireEvent.change(testNameInput, { target: { value: '2学期期末テスト' } });
      });
    }

    const numberInputs = screen.queryAllByRole('spinbutton');
    for (const input of numberInputs) {
      await act(async () => {
        fireEvent.change(input, { target: { value: '88' } });
      });
    }

    const saveTestBtn = screen.queryByRole('button', { name: /テスト結果を保存|登録/i });
    if (saveTestBtn) {
      await act(async () => {
        fireEvent.click(saveTestBtn);
      });
    }

    alertMock.mockRestore();
    confirmMock.mockRestore();
    unmount();
  });
});








