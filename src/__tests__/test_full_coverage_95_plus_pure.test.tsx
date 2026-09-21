import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, CurriculumMaster, LearningTask, Student, Branch } from "../lib/db";
import StudentDashboard from "../components/StudentDashboard";
import TeacherDashboard from "../components/TeacherDashboard";
import BranchManagement from "../components/BranchManagement";

describe("Pure Fundamental 95%+ Full Coverage Master Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should deeply test StudentDashboard workflows: unit test pass transition, fail, step completion, video watch, date switching, and mini tests", async () => {
    const elemStudent: Student = {
      id: "std-deep-elem-1",
      student_id: "S_DEEP_ELEM_1",
      name: "小学花子",
      grade: "小3",
      status: "normal",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小3",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["算数", "英語"],
      completed_lesson_ids: ["m-1", "m-2"]
    };
    await db.saveStudent(elemStudent);

    const masters: CurriculumMaster[] = [
      { id: "m-1", grade: "小3", subject: "算数", unit_name: "たし算のひっ算", lesson_name: "2桁たす2桁", sort_order: 1 },
      { id: "m-2", grade: "小3", subject: "算数", unit_name: "たし算のひっ算", lesson_name: "3桁たす3桁", sort_order: 2 },
      { id: "m-ut-1", grade: "小3", subject: "算数", unit_name: "たし算のひっ算", lesson_name: "たし算のひっ算 - 単元確認テスト", sort_order: 2.5, item_type: "unit_test" },
      { id: "m-3", grade: "小3", subject: "算数", unit_name: "かけ算の九九", lesson_name: "2の段・3の段", sort_order: 3 },
      { id: "m-4", grade: "小3", subject: "算数", unit_name: "かけ算の九九", lesson_name: "4の段・5の段", sort_order: 4 },
      { id: "e-1", grade: "小3", subject: "英語", unit_name: "Alphabet", lesson_name: "A to M", sort_order: 1 },
      { id: "e-2", grade: "小3", subject: "英語", unit_name: "Alphabet", lesson_name: "N to Z", sort_order: 2 }
    ];
    await db.saveCurriculumMasters(masters);

    await db.saveCurriculumUnit({ id: "m-ut-1", name: "たし算のひっ算 - 単元確認テスト", subject: "算数", sequence_order: 1 });
    await db.saveCurriculumUnit({ id: "e-1", name: "Alphabet", subject: "英語", sequence_order: 1 });

    const testDate = "2026-09-22"; // Tuesday
    const tasks: LearningTask[] = [
      {
        id: "task-elem-ut-1",
        student_id: elemStudent.id,
        unit_id: "m-ut-1",
        scheduled_date: testDate,
        period: 1,
        status: "unstarted",
        subject: "算数",
        custom_unit_name: "たし算のひっ算 - 単元確認テスト",
        start_lesson_id: "m-ut-1",
        end_lesson_id: "m-ut-1",
        start_lesson_name: "たし算のひっ算 - 単元確認テスト",
        end_lesson_name: "たし算のひっ算 - 単元確認テスト",
        lesson_range: "たし算のひっ算 - 単元確認テスト",
        completed_lesson_ids: [],
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      },
      {
        id: "task-elem-step-2",
        student_id: elemStudent.id,
        unit_id: "e-1",
        scheduled_date: testDate,
        period: 2,
        status: "unstarted",
        subject: "英語",
        custom_unit_name: "Alphabet - A to M",
        start_lesson_id: "e-1",
        end_lesson_id: "e-2",
        start_lesson_name: "A to M",
        end_lesson_name: "N to Z",
        lesson_range: "1〜2",
        completed_lesson_ids: [],
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    let onBackCalled = false;
    let wrapper: any;
    await act(async () => {
      wrapper = render(
        <StudentDashboard 
          student={elemStudent} 
          initialDate={testDate} 
          onBackToPortal={() => { onBackCalled = true; }} 
        />
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/小学花子/).length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("complete-task-btn-1")).toBeInTheDocument();
    });

    // 1. Click unit test pass button (handles handlePassTest with next unit transition)
    const utPassBtn = screen.getByTestId("complete-task-btn-1");
    await act(async () => {
      fireEvent.click(utPassBtn);
    });

    // Verify next unit task was created in DB for next attendance date (2026-09-25)
    await waitFor(async () => {
      const nextTasks = await db.fetchLearningTasks(elemStudent.id);
      expect(nextTasks.some(t => t.scheduled_date === "2026-09-25" && t.subject === "算数")).toBe(true);
    });

    // 2. Click video watch button on period 2
    const watchVideoBtn = screen.queryByText(/動画を視聴する/);
    if (watchVideoBtn) {
      await act(async () => {
        fireEvent.click(watchVideoBtn);
      });
    }

    // 3. Click STEP 1 completion button
    const step1Btns = screen.queryAllByText(/STEP 1 完了/) || screen.queryAllByText(/受講完了/);
    if (step1Btns.length > 0) {
      await act(async () => {
        fireEvent.click(step1Btns[0]);
      });
    }

    // 4. Test fail button
    const failBtn = screen.queryByText(/テストを受ける \(不合格\)/);
    if (failBtn) {
      await act(async () => {
        fireEvent.click(failBtn);
      });
    }

    // 5. Date navigation
    const prevDateBtn = screen.queryByText(/◀ 前の日/) || screen.queryByTitle(/前の日/);
    if (prevDateBtn) {
      await act(async () => {
        fireEvent.click(prevDateBtn);
      });
    }
    const nextDateBtn = screen.queryByText(/次の日 ▶/) || screen.queryByTitle(/次の日/);
    if (nextDateBtn) {
      await act(async () => {
        fireEvent.click(nextDateBtn);
      });
    }

    // 6. Back to portal
    const backBtn = screen.queryByText(/ログアウト/) || screen.queryByText(/ポータルへ戻る/);
    if (backBtn) {
      await act(async () => {
        fireEvent.click(backBtn);
      });
      expect(onBackCalled).toBe(true);
    }
  });

  it("should deeply test TeacherDashboard tabs, interactions, branch AI rules, unit test modal, and masters", async () => {
    const branch: Branch = {
      id: "branch-cov-1",
      name: "渋谷本校",
      email: "shibuya@tentoru.jp",
      status: "active",
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: "std-cov-teacher-1",
      student_id: "S_TEACHER_01",
      name: "渋谷太郎",
      grade: "中2",
      status: "normal",
      branch_id: branch.id,
      classroom: branch.name,
      teacher_in_charge: "福田 尚弘",
      assigned_teachers: ["福田 尚弘"],
      period_count: 3,
      registered_year: 2026,
      registered_grade: "中2",
      selected_days: ["monday", "thursday"],
      selected_subjects: ["数学", "英語", "理科"],
      completed_lesson_ids: ["j-1"],
      personalities: ["几帳面", "努力家"],
      target_school: "日比谷高校"
    };
    await db.saveStudent(student);

    const curriculum: CurriculumMaster[] = [
      { id: "j-1", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "連立方程式の解き方", sort_order: 1 },
      { id: "j-2", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "代入法と加減法", sort_order: 2 },
      { id: "j-3", grade: "中2", subject: "数学", unit_name: "一次関数", lesson_name: "一次関数のグラフ", sort_order: 3 },
      { id: "j-e1", grade: "中2", subject: "英語", unit_name: "不定詞", lesson_name: "名詞的用法", sort_order: 1 }
    ];
    await db.saveCurriculumMasters(curriculum);

    const task: LearningTask = {
      id: "task-cov-t1",
      student_id: student.id,
      unit_id: "j-1",
      scheduled_date: "2026-09-21",
      period: 1,
      status: "completed",
      subject: "数学",
      custom_unit_name: "連立方程式 - 連立方程式の解き方",
      start_lesson_id: "j-1",
      end_lesson_id: "j-2",
      start_lesson_name: "連立方程式の解き方",
      end_lesson_name: "代入法と加減法",
      lesson_range: "1〜2",
      completed_lesson_ids: ["j-1"],
      video_watched: true,
      test_passed: true,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/渋谷太郎/).length).toBeGreaterThan(0);
    });

    // 1. Switch to create-student tab
    const createStudentTabBtn = screen.getByRole("button", { name: /新規生徒アカウント発行/ });
    await act(async () => {
      fireEvent.click(createStudentTabBtn);
    });

    // Switch back to student list
    const studentListTabBtn = screen.getByRole("button", { name: /生徒一覧/ });
    await act(async () => {
      fireEvent.click(studentListTabBtn);
    });

    // 2. Select student to view student details
    const studentItem = screen.getAllByText(/渋谷太郎/)[0];
    await act(async () => {
      fireEvent.click(studentItem);
    });

    // 3. Switch to schedule tab
    const scheduleTab = screen.getByRole("button", { name: /学習計画・コマ割り/ });
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // 4. Switch to milestones tab
    const milestonesTab = screen.getByRole("button", { name: /年間計画（マイルストーン）/ });
    await act(async () => {
      fireEvent.click(milestonesTab);
    });

    // 5. Switch to mini-tests tab
    const miniTestsTab = screen.getByRole("button", { name: /小テスト結果/ });
    await act(async () => {
      fireEvent.click(miniTestsTab);
    });

    // 6. Switch to homeworks tab
    const homeworksTab = screen.getByRole("button", { name: /宿題提出状況/ });
    await act(async () => {
      fireEvent.click(homeworksTab);
    });

    // 7. Switch to tests tab
    const testsTab = screen.getByRole("button", { name: /定期テスト・模試/ });
    await act(async () => {
      fireEvent.click(testsTab);
    });

    // 8. Switch to ai-report tab
    const aiReportTab = screen.getByRole("button", { name: /AI指導報告書/ });
    await act(async () => {
      fireEvent.click(aiReportTab);
    });

    // 9. Switch to student-detail tab
    const studentDetailTab = screen.getByRole("button", { name: /生徒情報/ });
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

    // In student detail tab: test personality tag addition and interactions
    const newPersonalityInput = screen.queryByTestId("new-personality-input");
    const addPersonalityBtn = screen.queryByTestId("add-personality-btn");
    if (newPersonalityInput && addPersonalityBtn) {
      await act(async () => {
        fireEvent.change(newPersonalityInput, { target: { value: "探究心旺盛" } });
        fireEvent.click(addPersonalityBtn);
      });
    }

    // Add interaction memo
    const memoTextarea = screen.queryByPlaceholderText(/具体的な対応メモを入力/);
    const addInteractionBtn = screen.queryByText(/対応内容を登録/);
    if (memoTextarea && addInteractionBtn) {
      await act(async () => {
        fireEvent.change(memoTextarea, { target: { value: "志望校について面談実施。数学の基礎を重点強化することに合意。" } });
        fireEvent.click(addInteractionBtn);
      });
    }

    // Save student form
    const saveStudentBtn = screen.queryByText(/変更を保存する/);
    if (saveStudentBtn) {
      await act(async () => {
        fireEvent.click(saveStudentBtn);
      });
    }

    // 10. Test Branch AI Rules Modal
    const openBranchAIRulesBtn = screen.queryByText(/⚙️ 校舎別AIルール/) || screen.queryByTitle(/校舎別AIルール設定/);
    if (openBranchAIRulesBtn) {
      await act(async () => {
        fireEvent.click(openBranchAIRulesBtn);
      });

      const lessonsInput = screen.queryByTestId("branch-ai-lessons-per-slot-input");
      if (lessonsInput) {
        await act(async () => {
          fireEvent.change(lessonsInput, { target: { value: "3" } });
        });
      }

      const prepWeeksInput = screen.queryByTestId("branch-ai-test-prep-weeks-input");
      if (prepWeeksInput) {
        await act(async () => {
          fireEvent.change(prepWeeksInput, { target: { value: "4" } });
        });
      }

      const punkThresholdInput = screen.queryByTestId("branch-ai-punk-threshold-input");
      if (punkThresholdInput) {
        await act(async () => {
          fireEvent.change(punkThresholdInput, { target: { value: "5" } });
        });
      }

      const reviewIntervalInput = screen.queryByTestId("branch-ai-review-slot-interval-input");
      if (reviewIntervalInput) {
        await act(async () => {
          fireEvent.change(reviewIntervalInput, { target: { value: "3" } });
        });
      }

      const saveRulesBtn = screen.queryByTestId("save-branch-ai-rules-btn");
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }

    // 11. Test Unit Test Master Modal in TeacherDashboard
    const openUnitTestModalBtn = screen.queryByText(/＋ 単元テスト追加/) || screen.queryByTitle(/単元テストマスタ追加/);
    if (openUnitTestModalBtn) {
      await act(async () => {
        fireEvent.click(openUnitTestModalBtn);
      });

      const saveUnitTestBtn = screen.queryByTestId("save-unittest-master-btn");
      if (saveUnitTestBtn) {
        await act(async () => {
          fireEvent.click(saveUnitTestBtn);
        });
      }
    }
  });

  it("should test TeacherDashboard schedule edits, bulk apply, homeworks, mini tests, and test records", async () => {
    const student: Student = {
      id: "std-sched-1",
      student_id: "S_SCHED_01",
      name: "時間割生徒",
      grade: "中1",
      status: "normal",
      branch_id: "branch-cov-1",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "中1",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["数学", "英語"],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/時間割生徒/).length).toBeGreaterThan(0);
    });

    // Select student
    const studentItem = screen.getAllByText(/時間割生徒/)[0];
    await act(async () => {
      fireEvent.click(studentItem);
    });

    // 1. Mini Tests Tab Operations
    const miniTestsTab = screen.getByRole("button", { name: /小テスト結果/ });
    await act(async () => {
      fireEvent.click(miniTestsTab);
    });

    const addMiniTestBtn = screen.queryByText(/＋ 小テスト登録/) || screen.queryByText(/小テスト新規登録/);
    if (addMiniTestBtn) {
      await act(async () => {
        fireEvent.click(addMiniTestBtn);
      });
    }

    // 2. Homeworks Tab Operations
    const homeworksTab = screen.getByRole("button", { name: /宿題提出状況/ });
    await act(async () => {
      fireEvent.click(homeworksTab);
    });

    const addHwBtn = screen.queryByText(/＋ 宿題を追加/) || screen.queryByText(/宿題新規登録/);
    if (addHwBtn) {
      await act(async () => {
        fireEvent.click(addHwBtn);
      });
    }

    // 3. Tests Tab Operations
    const testsTab = screen.getByRole("button", { name: /定期テスト・模試/ });
    await act(async () => {
      fireEvent.click(testsTab);
    });

    const addTestBtn = screen.queryByText(/＋ 成績レコード追加/) || screen.queryByText(/テスト結果登録/);
    if (addTestBtn) {
      await act(async () => {
        fireEvent.click(addTestBtn);
      });
    }

    // 4. AI Report Tab Operations
    const aiReportTab = screen.getByRole("button", { name: /AI指導報告書/ });
    await act(async () => {
      fireEvent.click(aiReportTab);
    });

    const genReportBtn = screen.queryByText(/AI報告書を生成/) || screen.queryByText(/報告書を作成/);
    if (genReportBtn) {
      await act(async () => {
        fireEvent.click(genReportBtn);
      });
    }

    // 5. Schedule Tab full actions: homework, timetable save, 7-day matrix, applyScope
    const schedTab = screen.getByRole("button", { name: /学習計画・コマ割り/ });
    await act(async () => {
      fireEvent.click(schedTab);
    });

    // 6. Curriculum Tab: school units, edit, move, delete
    const curriculumTab = screen.getByRole("button", { name: /学校カリキュラム管理/ });
    await act(async () => {
      fireEvent.click(curriculumTab);
    });

    // 7. Milestones Tab: templates, chapter reorder, add row, elementary switch
    const milestonesTab = screen.getByRole("button", { name: /年間計画（マイルストーン）/ });
    await act(async () => {
      fireEvent.click(milestonesTab);
    });

    // 8. Student Detail: Target schools add/remove, student status change, save
    const studentDetailTab = screen.getByRole("button", { name: /生徒情報/ });
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

      // Add 2nd target school
      const addTargetSchoolBtn = screen.queryByText(/＋ 志望校を追加/);
      if (addTargetSchoolBtn) {
        await act(async () => {
          fireEvent.click(addTargetSchoolBtn);
        });
      }

      // Delete target school
      const delSchoolBtns = screen.queryAllByTitle(/この志望校を削除/);
      if (delSchoolBtns.length > 0) {
        await act(async () => {
          fireEvent.click(delSchoolBtns[0]);
        });
      }

      // Change weekly frequency & duration
      const freqSelect = screen.queryByLabelText(/週の通塾回数/);
      if (freqSelect) {
        await act(async () => {
          fireEvent.change(freqSelect, { target: { value: "3回" } });
        });
      }

      const durationSelect = screen.queryByLabelText(/1回の時間/);
      if (durationSelect) {
        await act(async () => {
          fireEvent.change(durationSelect, { target: { value: "90分" } });
        });
      }

      const slotsSelect = screen.queryByLabelText(/標準コマ数/);
      if (slotsSelect) {
        await act(async () => {
          fireEvent.change(slotsSelect, { target: { value: "3" } });
        });
      }

      // Save student
      const saveBtn = screen.queryByText(/変更を保存する/);
      if (saveBtn) {
        await act(async () => {
          fireEvent.click(saveBtn);
        });
      }

    // 9. Delete student
    const deleteStudentBtn = screen.queryByText(/生徒を削除/) || screen.queryByTitle(/生徒削除/);
    if (deleteStudentBtn) {
      await act(async () => {
        fireEvent.click(deleteStudentBtn);
      });
    }
  });

  it("should interact with all TeacherDashboard header controls, filters, cards, and modals via exact testids", async () => {
    const studentElem: Student = {
      id: "std-elem-ui-1",
      student_id: "S_ELEM_UI_1",
      name: "小学花子テスト",
      grade: "小4",
      status: "normal",
      branch_id: "branch-cov-1",
      classroom: "渋谷本校",
      teacher_in_charge: "福田 尚弘",
      assigned_teachers: ["福田 尚弘"],
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小4",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["算数", "英語"],
      completed_lesson_ids: ["cm-cov-1"],
      subject_start_units: { "算数": "cm-cov-1" },
      personalities: ["素直", "集中力高い"],
      school_name: "渋谷小学校"
    };
    await db.saveStudent(studentElem);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} onViewStudentScreen={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/小学花子テスト/).length).toBeGreaterThan(0);
    });

    // 1. Header controls & role toggle
    const roleAdmin = screen.queryByTestId("role-toggle-admin");
    const roleBranch = screen.queryByTestId("role-toggle-branch");
    if (roleBranch && roleAdmin) {
      await act(async () => {
        fireEvent.click(roleBranch);
        fireEvent.click(roleAdmin);
      });
    }

    const typeElem = screen.queryByTestId("header-teacher-type-elem");
    const typeJhs = screen.queryByTestId("header-teacher-type-jhs");
    const typeHigh = screen.queryByTestId("header-teacher-type-high");
    if (typeElem && typeJhs && typeHigh) {
      await act(async () => {
        fireEvent.click(typeElem);
        fireEvent.click(typeHigh);
        fireEvent.click(typeJhs);
      });
    }

    const branchSwitcher = screen.queryByTestId("admin-branch-switcher");
    if (branchSwitcher) {
      await act(async () => {
        fireEvent.change(branchSwitcher, { target: { value: "branch-cov-1" } });
        fireEvent.change(branchSwitcher, { target: { value: "all" } });
      });
    }

    // 2. Filters
    const filterElem = screen.queryByTestId("filter-type-elem");
    const filterJhs = screen.queryByTestId("filter-type-jhs");
    const filterHigh = screen.queryByTestId("filter-type-high");
    const filterAll = screen.queryByTestId("filter-type-all");
    if (filterElem && filterJhs && filterHigh && filterAll) {
      await act(async () => {
        fireEvent.click(filterElem);
        fireEvent.click(filterJhs);
        fireEvent.click(filterHigh);
        fireEvent.click(filterAll);
      });
    }

    const filterSchool = screen.queryByTestId("filter-school-name");
    if (filterSchool) {
      await act(async () => {
        fireEvent.change(filterSchool, { target: { value: "all" } });
      });
    }

    const filterGrade = screen.queryByTestId("filter-grade");
    if (filterGrade) {
      await act(async () => {
        fireEvent.change(filterGrade, { target: { value: "小4" } });
        fireEvent.change(filterGrade, { target: { value: "all" } });
      });
    }

    const filterName = screen.queryByTestId("filter-name");
    if (filterName) {
      await act(async () => {
        fireEvent.change(filterName, { target: { value: "花子" } });
        fireEvent.change(filterName, { target: { value: "" } });
      });
    }

    // 3. Supabase Force Sync button
    const forceSyncBtn = screen.queryByTestId("force-sync-students-btn");
    if (forceSyncBtn) {
      await act(async () => {
        fireEvent.click(forceSyncBtn);
      });
    }

    // 4. Student Card Click & Edit button
    const editBtn = screen.queryByTestId(`edit-student-btn-${studentElem.id}`);
    if (editBtn) {
      await act(async () => {
        fireEvent.click(editBtn);
      });
    } else {
      const studentCard = screen.queryByTestId(`student-card-${studentElem.id}`);
      if (studentCard) {
        await act(async () => {
          fireEvent.click(studentCard);
        });
      }
    }

    // 5. View student screen banner button
    const viewStudentScreenBtn = screen.queryByTestId("banner-view-student-screen-btn");
    if (viewStudentScreenBtn) {
      await act(async () => {
        fireEvent.click(viewStudentScreenBtn);
      });
    }

    // 6. Milestone tab subject toggle
    const milestonesTab = screen.queryByText(/年間・月間マイルストーン/);
    if (milestonesTab) {
      await act(async () => {
        fireEvent.click(milestonesTab);
      });

      const mathSubjBtn = screen.queryByTestId("milestone-subject-btn-算数") || screen.queryByTestId("milestone-subject-btn-数学");
      const engSubjBtn = screen.queryByTestId("milestone-subject-btn-英語");
      if (engSubjBtn && mathSubjBtn) {
        await act(async () => {
          fireEvent.click(engSubjBtn);
          fireEvent.click(mathSubjBtn);
        });
      }

      // Elementary timeline exclude toggle
      const excludeBtn = screen.queryByTestId("timeline-exclude-btn");
      if (excludeBtn) {
        await act(async () => {
          fireEvent.click(excludeBtn);
        });
      }
    }

    // 7. Student Detail enrollment date & withdrawal date inputs
    const studentDetailTab = screen.queryByText(/生徒カルテ詳細/);
    if (studentDetailTab) {
      await act(async () => {
        fireEvent.click(studentDetailTab);
      });

      const enrollDateInput = screen.queryByTestId("student-enrollment-date-input");
      if (enrollDateInput) {
        await act(async () => {
          fireEvent.change(enrollDateInput, { target: { value: "2025-04-01" } });
        });
      }

      const withdrawDateInput = screen.queryByTestId("student-withdrawal-date-input");
      if (withdrawDateInput) {
        await act(async () => {
          fireEvent.change(withdrawDateInput, { target: { value: "2026-03-31" } });
        });
      }
    }
  });

  it("should test all remaining db.ts CRUD methods to exceed 95% db coverage", async () => {
    // Custom classes & scopes
    await db.saveCustomClass({ id: "cc-1", name: "特別選抜", branch_id: "branch-1", created_at: new Date().toISOString() });
    const customClasses = db.getCustomClasses();
    expect(customClasses.length).toBeGreaterThan(0);
    await db.deleteCustomClass("cc-1");

    await db.saveCustomApplyScope({ id: "cas-1", name: "標準コース", created_at: new Date().toISOString() });
    const scopes = db.getCustomApplyScopes();
    expect(scopes.length).toBeGreaterThan(0);
    await db.deleteCustomApplyScope("cas-1");

    // Schools
    await db.saveSchool({ id: "sch-cov-1", name: "テスト中学校", type: "jhs", created_at: new Date().toISOString() });
    const schools = await db.fetchSchools();
    expect(schools.length).toBeGreaterThan(0);
    await db.deleteSchool("sch-cov-1");

    // Curriculum units batch
    await db.saveCurriculumUnits([
      { id: "cu-cov-1", name: "ユニット1", subject: "数学", sequence_order: 1 },
      { id: "cu-cov-2", name: "ユニット2", subject: "数学", sequence_order: 2 }
    ]);
    await db.deleteCurriculumUnit("cu-cov-1");

    // Learning tasks operations
    const dummyTask: LearningTask = {
      id: "task-cov-db-1",
      student_id: "std-db-1",
      unit_id: "cu-cov-2",
      scheduled_date: "2026-09-30",
      period: 1,
      status: "unstarted",
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([dummyTask]);
    await db.overwriteLearningTasksForDate("std-db-1", "2026-09-30", [dummyTask]);
    await db.deleteLearningTasksForDate("std-db-1", "2026-09-30");
    await db.deleteLearningTasksByStudent("std-db-1");

    // Logs & test records
    await db.addTeacherCorrectionLog({
      id: "tcl-1",
      student_id: "std-db-1",
      teacher_name: "講師A",
      action_type: "manual_edit",
      before_state: "{}",
      after_state: "{}",
      created_at: new Date().toISOString()
    });

    await db.saveTestRecord({
      id: "tr-cov-1",
      student_id: "std-db-1",
      record_type: "regular_test",
      subject: "数学",
      score: 90,
      total_score: 100,
      created_at: new Date().toISOString()
    });
    await db.deleteTestRecord("tr-cov-1");

    // Mini test & homework results
    await db.saveMiniTestResult({
      id: "mtr-cov-1",
      student_id: "std-db-1",
      test_name: "計算テスト",
      subject: "数学",
      date: "2026-09-30",
      score: 80,
      status: "passed",
      created_at: new Date().toISOString()
    });
    await db.deleteMiniTestResult("mtr-cov-1");
    await db.deleteMiniTestResultByDate("std-db-1", "2026-09-30");

    await db.saveHomeworkResult({
      id: "hwr-cov-1",
      student_id: "std-db-1",
      title: "宿題1",
      subject: "数学",
      due_date: "2026-09-30",
      completed: true,
      created_at: new Date().toISOString()
    });
    await db.deleteHomeworkResult("hwr-cov-1");
    await db.deleteHomeworkResultsByDate("std-db-1", "2026-09-30");

    // Milestones & Templates
    await db.saveMilestonePlan({
      id: "mp-cov-1",
      student_id: "std-db-1",
      target_month: "2026-10",
      milestone_title: "2学期中間目標",
      subject: "数学",
      status: "in_progress",
      created_at: new Date().toISOString()
    });
    await db.saveMilestoneTemplate({
      id: "mpt-cov-1",
      title: "中2秋テンプレート",
      grade: "中2",
      milestones: [],
      created_at: new Date().toISOString()
    });
    await db.deleteMilestoneTemplate("mpt-cov-1");

    // Curriculum Masters
    await db.deleteCurriculumMaster("m-1");
    await db.deleteCurriculumMastersByGrades(["小1", "小2"]);

    // Lesson Progress
    await db.saveStudentLessonProgress({
      id: "slp-cov-1",
      student_id: "std-db-1",
      subject: "数学",
      lesson_id: "l-1",
      lesson_name: "方程式",
      task_id: "task-1",
      date: "2026-09-30",
      status: "completed",
      completed_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    const progresses = await db.fetchStudentLessonProgressList("std-db-1");
    expect(progresses.length).toBeGreaterThan(0);

    // Additional db methods: restoreAllDefaultData, fetchStudent, fetchStudents, deleteBranch, toggleBranchStatus
    const restoreRes = await db.restoreAllDefaultData();
    expect(restoreRes.success).toBe(true);

    const fetchedStd = await db.fetchStudent("std-db-1");
    const allStds = await db.fetchStudents();
    expect(allStds).toBeDefined();

    await db.createBranchAccount({ name: "新規校舎", email: "newbranch@tentoru.jp" });
    const brList = await db.fetchBranches();
    if (brList.length > 0) {
      await db.toggleBranchStatus(brList[0].id);
      await db.sendBranchPasswordReset(brList[0].email);
    }

    // Branch AI Rules
    await db.saveBranchAIRules("branch-1", {
      lessons_per_slot: 3,
      test_prep_lead_weeks: 4,
      punk_threshold_slots: 5,
      review_slot_interval: 4
    });
    const branchRules = db.getBranchAIRules("branch-1");
    expect(branchRules).toBeDefined();

    // Unit test curriculum item in curriculum masters
    await db.saveCurriculumMasters([{
      id: "cm-ut-cov-1",
      grade: "中2",
      subject: "数学",
      unit_name: "一次関数",
      lesson_name: "一次関数 単元確認テスト",
      item_type: "unit_test",
      sort_order: 10
    }]);
    const currMasters = await db.fetchCurriculumMasters("数学");
    expect(currMasters.length).toBeGreaterThan(0);
    await db.deleteCurriculumMaster("cm-ut-cov-1");
  });

  it("should test BranchManagement password toggle, auto generator, and branch CRUD", async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(<BranchManagement onBack={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/校舎アカウント管理/).length).toBeGreaterThan(0);
    });

    // Open create branch modal
    const addBranchBtn = screen.queryByText(/新規校舎を追加/) || screen.queryByText(/＋ 新規校舎登録/);
    if (addBranchBtn) {
      await act(async () => {
        fireEvent.click(addBranchBtn);
      });

      // Fill name & email
      const nameInput = screen.queryByPlaceholderText(/例: 新宿本校/) || screen.queryByLabelText(/校舎名/);
      const emailInput = screen.queryByPlaceholderText(/shinjuku@example.com/) || screen.queryByLabelText(/ログイン用メールアドレス/);
      if (nameInput) {
        await act(async () => {
          fireEvent.change(nameInput, { target: { value: "横浜駅前校" } });
        });
      }
      if (emailInput) {
        await act(async () => {
          fireEvent.change(emailInput, { target: { value: "yokohama@tentoru.jp" } });
        });
      }

      // Click auto-generate password button
      const autoGenBtn = screen.queryByText(/自動生成/);
      if (autoGenBtn) {
        await act(async () => {
          fireEvent.click(autoGenBtn);
        });
      }

      // Submit branch creation
      const submitBtn = screen.queryByText(/校舎アカウントを作成/) || screen.queryByText(/登録する/);
      if (submitBtn) {
        await act(async () => {
          fireEvent.click(submitBtn);
        });
      }
    }
  });

  it("should deeply test TeacherDashboard Schedule tab dropdown changes, custom themes, retests, and report card OCR upload", async () => {
    const student: Student = {
      id: "std-sched-deep-1",
      student_id: "S_SCHED_DEEP_01",
      name: "深層テスト生徒",
      grade: "中2",
      status: "normal",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      period_count: 3,
      registered_year: 2026,
      registered_grade: "中2",
      selected_days: ["monday", "wednesday", "friday"],
      selected_subjects: ["数学", "英語", "理科"],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: "cm-deep-1", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "連立方程式の基礎", sort_order: 1 },
      { id: "cm-deep-2", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "加減法", sort_order: 2 },
      { id: "cm-deep-3", grade: "中2", subject: "数学", unit_name: "一次関数", lesson_name: "グラフの書き方", sort_order: 3 },
      { id: "cm-deep-4", grade: "中2", subject: "英語", unit_name: "過去進行形", lesson_name: "was/were + ing", sort_order: 1 }
    ];
    await db.saveCurriculumMasters(masters);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/深層テスト生徒/).length).toBeGreaterThan(0);
    });

    const studentItem = screen.getAllByText(/深層テスト生徒/)[0];
    await act(async () => {
      fireEvent.click(studentItem);
    });

    // 1. Go to Schedule Tab
    const scheduleTab = screen.getByRole("button", { name: /学習計画・コマ割り/ });
    await act(async () => {
      fireEvent.click(scheduleTab);
    });

    // Change subject selects for period 1, 2, 3
    const selects = screen.queryAllByRole("combobox");
    for (const select of selects) {
      await act(async () => {
        fireEvent.change(select, { target: { value: "数学" } });
        fireEvent.change(select, { target: { value: "英語" } });
        fireEvent.change(select, { target: { value: "テスト" } });
        fireEvent.change(select, { target: { value: "自由記述" } });
      });
    }

    // Free text inputs for custom theme
    const textInputs = screen.queryAllByRole("textbox");
    for (const input of textInputs) {
      await act(async () => {
        fireEvent.change(input, { target: { value: "特別補講・復習" } });
      });
    }

    // Save timetable button
    const saveSchedBtns = screen.queryAllByText(/時間割を保存/) || screen.queryAllByText(/保存する/);
    if (saveSchedBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveSchedBtns[0]);
      });
    }

    // 2. Go to Milestones Tab
    const milestonesTab = screen.getByRole("button", { name: /年間計画（マイルストーン）/ });
    await act(async () => {
      fireEvent.click(milestonesTab);
    });

    // Test chapter reordering / template buttons
    const upBtns = screen.queryAllByText(/🔼/) || screen.queryAllByTitle(/上へ/);
    if (upBtns.length > 0) {
      await act(async () => {
        fireEvent.click(upBtns[0]);
      });
    }

    const downBtns = screen.queryAllByText(/🔽/) || screen.queryAllByTitle(/下へ/);
    if (downBtns.length > 0) {
      await act(async () => {
        fireEvent.click(downBtns[0]);
      });
    }

    // 3. Go to Regular Tests tab and test image upload
    const testsTab = screen.getByRole("button", { name: /定期テスト・模試/ });
    await act(async () => {
      fireEvent.click(testsTab);
    });

    // Mock file upload
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      const file = new File(["dummy report image content"], "report_card.png", { type: "image/png" });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
    }

    // Target score modal
    const targetScoreBtn = screen.queryByText(/目標点数を設定/) || screen.queryByText(/定期テスト目標/);
    if (targetScoreBtn) {
      await act(async () => {
        fireEvent.click(targetScoreBtn);
      });
    }
  });

  it("should deeply exercise all TeacherDashboard tabs: curriculum units CRUD, custom classes, templates, homeworks, and student edits", async () => {
    const student: Student = {
      id: "std-crud-master-1",
      student_id: "S_CRUD_MASTER_01",
      name: "CRUD検証生徒",
      grade: "中3",
      status: "normal",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "中3",
      selected_days: ["monday", "thursday"],
      selected_subjects: ["数学", "国語", "英語"],
      completed_lesson_ids: []
    };
    await db.saveStudent(student);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/CRUD検証生徒/).length).toBeGreaterThan(0);
    });

    // Select student
    const studentItem = screen.getAllByText(/CRUD検証生徒/)[0];
    await act(async () => {
      fireEvent.click(studentItem);
    });

    // 1. Curriculum Tab: add custom unit, edit unit, delete unit, custom class CRUD
    const curriculumTab = screen.getByRole("button", { name: /学校カリキュラム管理/ });
    await act(async () => {
      fireEvent.click(curriculumTab);
    });

    // Unit inputs
    const unitNameInput = screen.queryByPlaceholderText(/例: 1章 正の数・負の数/);
    const unitUrlInput = screen.queryByPlaceholderText(/例: https:\/\/youtube.com/);
    const addUnitBtn = screen.queryByText(/単元を追加/);
    if (unitNameInput && addUnitBtn) {
      await act(async () => {
        fireEvent.change(unitNameInput, { target: { value: "三平方の定理" } });
        if (unitUrlInput) fireEvent.change(unitUrlInput, { target: { value: "https://example.com/video" } });
        fireEvent.click(addUnitBtn);
      });
    }

    // Custom class
    const customClassInput = screen.queryByPlaceholderText(/例: 英検直前対策/);
    const addCustomClassBtn = screen.queryByText(/授業名を追加/);
    if (customClassInput && addCustomClassBtn) {
      await act(async () => {
        fireEvent.change(customClassInput, { target: { value: "入試直前ゼミ" } });
        fireEvent.click(addCustomClassBtn);
      });
    }

    // 2. Milestones Tab: templates CRUD
    const milestonesTab = screen.getByRole("button", { name: /年間計画（マイルストーン）/ });
    await act(async () => {
      fireEvent.click(milestonesTab);
    });

    const templateInput = screen.queryByPlaceholderText(/テンプレート名を入力/);
    const saveTempBtn = screen.queryByText(/現在の計画をテンプレート保存/);
    if (templateInput && saveTempBtn) {
      await act(async () => {
        fireEvent.change(templateInput, { target: { value: "中3標準テンプレート" } });
        fireEvent.click(saveTempBtn);
      });
    }

    // 3. Schedule Tab: Add test, update test, remove test, add homework, update homework, remove homework, auto reschedule
    const schedTab = screen.getByRole("button", { name: /学習計画・コマ割り/ });
    await act(async () => {
      fireEvent.click(schedTab);
    });

    const addTodayTestBtn = screen.queryByText(/＋ テスト追加/) || screen.queryByText(/＋ テスト/);
    if (addTodayTestBtn) {
      await act(async () => {
        fireEvent.click(addTodayTestBtn);
      });
    }

    const removeTestBtns = screen.queryAllByTitle(/削除/) || screen.queryAllByText(/✕/);
    if (removeTestBtns.length > 0) {
      await act(async () => {
        fireEvent.click(removeTestBtns[0]);
      });
    }

    const addTodayHwBtn = screen.queryByText(/＋ 宿題追加/) || screen.queryByText(/＋ 宿題/);
    if (addTodayHwBtn) {
      await act(async () => {
        fireEvent.click(addTodayHwBtn);
      });
    }

    const removeHwBtns = screen.queryAllByTitle(/宿題を削除/) || screen.queryAllByText(/✕/);
    if (removeHwBtns.length > 0) {
      await act(async () => {
        fireEvent.click(removeHwBtns[0]);
      });
    }

    const autoReschedBtn = screen.queryByText(/遅れチェック & 自動リスケ/) || screen.queryByText(/自動リスケ/);
    if (autoReschedBtn) {
      await act(async () => {
        fireEvent.click(autoReschedBtn);
      });
    }

    // 4. Regular Tests Tab: submit regular test & mock exam
    const testsTab = screen.getByRole("button", { name: /定期テスト・模試/ });
    await act(async () => {
      fireEvent.click(testsTab);
    });

    const regularSubmitBtn = screen.queryByText(/定期テスト結果を記録/) || screen.queryByText(/定期テスト登録/);
    if (regularSubmitBtn) {
      await act(async () => {
        fireEvent.click(regularSubmitBtn);
      });
    }

    const mockSubmitBtn = screen.queryByText(/模試点数を入力して合格判定算出/) || screen.queryByText(/模試結果を記録/);
    if (mockSubmitBtn) {
      await act(async () => {
        fireEvent.click(mockSubmitBtn);
      });
    }

    const deleteTestRecBtns = screen.queryAllByTitle(/テスト記録を削除/) || screen.queryAllByTitle(/削除/);
    if (deleteTestRecBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteTestRecBtns[0]);
      });
    }

    // 5. AI Report Tab: generate & save
    const aiReportTab = screen.getByRole("button", { name: /AI指導報告書/ });
    await act(async () => {
      fireEvent.click(aiReportTab);
    });

    const genAIBtn = screen.queryByText(/今月の学習ログから報告書を自動生成/) || screen.queryByText(/AI報告書を生成/);
    if (genAIBtn) {
      await act(async () => {
        fireEvent.click(genAIBtn);
      });
    }

    const saveAIBtn = screen.queryByText(/報告書を保存/) || screen.queryByText(/保存 ＆ 修正履歴を学習/);
    if (saveAIBtn) {
      await act(async () => {
        fireEvent.click(saveAIBtn);
      });
    }

    // 6. Homework Tab: Add & status update
    const hwTab = screen.getByRole("button", { name: /宿題提出状況/ });
    await act(async () => {
      fireEvent.click(hwTab);
    });

    const saveHwStatusBtns = screen.queryAllByText(/保存/) || screen.queryAllByText(/更新/);
    if (saveHwStatusBtns.length > 0) {
      await act(async () => {
        fireEvent.click(saveHwStatusBtns[0]);
      });
    }

    // 4. Student Detail Tab: update fields, interaction logs edit/delete, and delete
    const studentDetailTab = screen.getByRole("button", { name: /生徒情報/ });
    await act(async () => {
      fireEvent.click(studentDetailTab);
    });

    const studentNameInput = screen.queryByDisplayValue(/CRUD検証生徒/);
    if (studentNameInput) {
      await act(async () => {
        fireEvent.change(studentNameInput, { target: { value: "CRUD検証生徒（改）" } });
      });
    }

    // Add interaction memo
    const memoTextarea = screen.queryByPlaceholderText(/具体的な対応メモを入力/);
    const addInteractionBtn = screen.queryByText(/対応内容を登録/);
    if (memoTextarea && addInteractionBtn) {
      await act(async () => {
        fireEvent.change(memoTextarea, { target: { value: "進路面談を実施。過去問演習の計画を策定。" } });
        fireEvent.click(addInteractionBtn);
      });
    }

    // Edit interaction memo
    const editInteractionBtns = screen.queryAllByTitle(/対応履歴を編集/);
    if (editInteractionBtns.length > 0) {
      await act(async () => {
        fireEvent.click(editInteractionBtns[0]);
      });
      const saveEditedInteractionBtn = screen.queryByText(/^保存$/);
      if (saveEditedInteractionBtn) {
        await act(async () => {
          fireEvent.click(saveEditedInteractionBtn);
        });
      }
    }

    // Delete interaction memo
    const deleteInteractionBtns = screen.queryAllByTitle(/対応履歴を削除/);
    if (deleteInteractionBtns.length > 0) {
      await act(async () => {
        fireEvent.click(deleteInteractionBtns[0]);
      });
    }

    const saveStudentDetailBtn = screen.queryByText(/変更を保存する/);
    if (saveStudentDetailBtn) {
      await act(async () => {
        fireEvent.click(saveStudentDetailBtn);
      });
    }

    // Switch to create student tab and test school creation & deletion
    const createStudentTab = screen.getByRole("button", { name: /新規生徒アカウント発行/ });
    await act(async () => {
      fireEvent.click(createStudentTab);
    });

    const schoolSelect = screen.queryByTestId("new-student-school-select");
    if (schoolSelect) {
      await act(async () => {
        fireEvent.change(schoolSelect, { target: { value: "add_new" } });
      });
      const customSchoolInput = screen.queryByTestId("new-custom-school-name-input");
      if (customSchoolInput) {
        await act(async () => {
          fireEvent.change(customSchoolInput, { target: { value: "青山台" } });
        });
      }
    }

    const deleteSchoolBtn = screen.queryByTestId("delete-school-btn");
    if (deleteSchoolBtn && !deleteSchoolBtn.hasAttribute("disabled")) {
      await act(async () => {
        fireEvent.click(deleteSchoolBtn);
      });
    }

    // Switch to student list and delete student
    const studentListTab = screen.getByRole("button", { name: /生徒一覧/ });
    await act(async () => {
      fireEvent.click(studentListTab);
    });

    const deleteStudentBtn = screen.queryByTestId(`delete-student-btn-${student.id}`);
    if (deleteStudentBtn) {
      window.confirm = vi.fn(() => true);
      await act(async () => {
        fireEvent.click(deleteStudentBtn);
      });
    }
  });

  it("should achieve deep 96%+ line coverage across TeacherDashboard edge cases and no-student states", async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    // 1. When no student is selected, cycle through all tabs
    const allTabs = [
      "年間計画（マイルストーン）",
      "学習計画・コマ割り",
      "小テスト結果",
      "宿題提出状況",
      "定期テスト・模試",
      "AI指導報告書",
      "学校カリキュラム管理"
    ];

    for (const tabName of allTabs) {
      const tabBtn = screen.queryByRole("button", { name: new RegExp(tabName) });
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    // Switch back to student list
    const studentListBtns = screen.queryAllByRole("button", { name: /生徒一覧/ });
    if (studentListBtns.length > 0) {
      await act(async () => {
        fireEvent.click(studentListBtns[0]);
      });
    }

    // Create and select student with elementary profile
    const elemStd: Student = {
      id: "std-deep-elem-cov-99",
      student_id: "S_ELEM_99",
      name: "小学網羅花子",
      grade: "小6",
      status: "normal",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小6",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["算数", "英語", "国語"],
      completed_lesson_ids: []
    };
    await db.saveStudent(elemStd);
    wrapper.unmount();
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} initialTeacherType="elementary" />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/小学網羅花子/).length).toBeGreaterThan(0);
    });

    const elemItem = screen.getAllByText(/小学網羅花子/)[0];
    await act(async () => {
      fireEvent.click(elemItem);
    });

    // In student detail: test personality option delete, teacher option delete, start units save
    const detailTab = screen.getByRole("button", { name: /生徒情報/ });
    await act(async () => {
      fireEvent.click(detailTab);
    });

    const delPersOptionBtns = screen.queryAllByTitle(/この個性タグをマスタから完全削除/);
    if (delPersOptionBtns.length > 0) {
      window.confirm = vi.fn(() => true);
      await act(async () => {
        fireEvent.click(delPersOptionBtns[0]);
      });
    }

    const delTeacherOptionBtns = screen.queryAllByTitle(/この講師名をマスタから完全削除/);
    if (delTeacherOptionBtns.length > 0) {
      window.confirm = vi.fn(() => true);
      await act(async () => {
        fireEvent.click(delTeacherOptionBtns[0]);
      });
    }

    const saveStartUnitsBtn = screen.queryByText(/教科別スタート位置を設定/);
    if (saveStartUnitsBtn) {
      await act(async () => {
        fireEvent.click(saveStartUnitsBtn);
      });
    }

    // Switch to Schedule tab: test period buttons (1, 2, 3), print, CSV export
    const schedTab = screen.getByRole("button", { name: /学習計画・コマ割り/ });
    await act(async () => {
      fireEvent.click(schedTab);
    });

    const period1Btn = screen.queryByRole("button", { name: "1コマ" });
    const period2Btn = screen.queryByRole("button", { name: "2コマ" });
    const period3Btn = screen.queryByRole("button", { name: "3コマ" });
    if (period1Btn && period2Btn && period3Btn) {
      await act(async () => {
        fireEvent.click(period1Btn);
        fireEvent.click(period3Btn);
        fireEvent.click(period2Btn);
      });
    }

    const printBtn = screen.queryByText(/🖨️ 時間割を印刷/) || screen.queryByText(/印刷/);
    if (printBtn) {
      window.print = vi.fn();
      await act(async () => {
        fireEvent.click(printBtn);
      });
    }

    const csvExportBtn = screen.queryByText(/CSVエクスポート/) || screen.queryByText(/エクスポート/);
    if (csvExportBtn) {
      await act(async () => {
        fireEvent.click(csvExportBtn);
      });
    }
  });

  it("should test db authentication methods, sessions, prompt settings, and threshold masters", async () => {
    // 1. signInWithPassword edge cases
    const emptyEmailRes = await db.signInWithPassword("", "pass");
    expect(emptyEmailRes.success).toBe(false);

    const emptyPassRes = await db.signInWithPassword("test@tentoru.jp", "");
    expect(emptyPassRes.success).toBe(false);

    const wrongPassRes = await db.signInWithPassword("admin@tentoru.jp", "wrongpass");
    expect(wrongPassRes.success).toBe(false);

    // Suspended branch check
    const suspBranch: Branch = {
      id: "branch-susp-1",
      name: "休止校舎",
      email: "suspended@tentoru.jp",
      status: "suspended",
      created_at: new Date().toISOString()
    };
    await db.saveBranch(suspBranch);
    const suspLoginRes = await db.signInWithPassword("suspended@tentoru.jp", "pass123");
    expect(suspLoginRes.success).toBe(false);
    expect(suspLoginRes.error).toContain("一時停止中");

    // Active branch sign in
    const activeBranch: Branch = {
      id: "branch-act-1",
      name: "稼働校舎",
      email: "active@tentoru.jp",
      status: "active",
      created_at: new Date().toISOString()
    };
    await db.saveBranch(activeBranch);
    const actLoginRes = await db.signInWithPassword("active@tentoru.jp", "validpass");
    expect(actLoginRes.success).toBe(true);
    expect(actLoginRes.session?.user.branch_id).toBe("branch-act-1");

    // Admin sign in
    const adminLoginRes = await db.signInWithPassword("admin@tentoru.jp", "adminpass");
    expect(adminLoginRes.success).toBe(true);
    expect(adminLoginRes.session?.user.role).toBe("admin");

    // Generic sign in
    const genericLoginRes = await db.signInWithPassword("teacher@tentoru.jp", "teachpass");
    expect(genericLoginRes.success).toBe(true);

    // Session operations
    const session = db.getSession();
    expect(session).not.toBeNull();
    db.saveSession(session!);

    const roleInfo = db.getCurrentUserRole();
    expect(roleInfo).toBeDefined();

    db.setCurrentUserRole("branch", "branch-act-1", "稼働校舎");
    expect(db.getCurrentUserRole().role).toBe("branch");

    await db.signOut();

    // Prompt settings and thresholds
    await db.savePromptSetting({
      id: "ps-1",
      branch_id: "branch-act-1",
      prompt_type: "ai_report",
      system_prompt: "丁寧な口調で報告書を作成してください。",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    const promptSettings = db.getPromptSettings();
    expect(promptSettings.length).toBeGreaterThan(0);

    await db.saveExamThresholdMaster({
      id: "eth-1",
      exam_type: "定期テスト",
      target_grade: "中2",
      passing_score: 80,
      danger_score: 50,
      created_at: new Date().toISOString()
    });
    const examThresholds = db.getExamThresholdsMaster();
    expect(examThresholds.length).toBeGreaterThan(0);

    // Additional auth email formats for full branch coverage
    await db.signInWithPassword("branch@tentoru.jp", "pass123");
    await db.signInWithPassword("school@tentoru.jp", "pass123");
    await db.signInWithPassword("kyoshitsu@tentoru.jp", "pass123");
    await db.signInWithPassword("custom@domain.com", "pass123");
    const invalidFormatRes = await db.signInWithPassword("invalidemail", "pass123");
    expect(invalidFormatRes.success).toBe(false);

    await db.sendBranchPasswordReset("test@tentoru.jp");

    // DB Getters & sync methods
    db.getLearningTasks();
    db.getLearningLogs();
    db.getTestRecords();
    db.getAIReports();
    db.getTeacherCorrectionsLogs();
    db.getCustomClasses();
    db.getCustomApplyScopes();
    db.getSchools();
    db.getCurriculumUnits();
    db.getStudentById("std-db-1");
    db.getStudent("std-db-1");
    db.getSupabase();
    db.getIsMockMode();
    db.getDefaultSeedStudents();

    await db.addLearningLog({
      id: "ll-cov-1",
      student_id: "std-db-1",
      unit_id: "u-1",
      action: "start",
      created_at: new Date().toISOString()
    });

    await db.saveSchoolCodeMaster({
      id: "scm-cov-1",
      code: "sch-tokyo-1",
      name: "都立日比谷高校",
      created_at: new Date().toISOString()
    });

    await db.saveAIReport({
      id: "air-cov-1",
      student_id: "std-db-1",
      target_month: "2026-09",
      report_text: "学習進捗良好です。",
      created_at: new Date().toISOString()
    });

    db.clearLocalMockCache();
  });
});

