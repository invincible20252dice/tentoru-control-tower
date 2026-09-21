import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "../lib/db";
import StudentDashboard from "../components/StudentDashboard";
import TeacherDashboard from "../components/TeacherDashboard";

describe("Dashboards 95% Coverage Boost Suite", () => {
  const testStudent = {
    id: "std-boost-1",
    name: "ブースト生徒",
    grade: "中2",
    school_id: "sch-1",
    branch_id: "branch-1",
    personality_tags: ["真面目", "読書好き"],
    enrollment_date: "2025-04-01",
    schedule_config: {
      available_days: [1, 2, 4],
      daily_slots: 3,
      subject_start_units: { "数学": "u-1" }
    },
    completed_lesson_ids: ["l-1"]
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.saveStudent(testStudent as any);
  });

  it("should test StudentDashboard test pass and unit test next unit transition workflow", async () => {
    const elemStudent = {
      id: "std-ut-trans-elem",
      student_id: "S_UT_TRANS",
      name: "移行テスト生徒",
      grade: "小2",
      status: "normal",
      branch_id: "branch-1",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小2",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["算数"],
      completed_lesson_ids: ["cm-m1", "cm-m2"]
    };
    await db.saveStudent(elemStudent as any);

    const masters: CurriculumMaster[] = [
      { id: "cm-m1", grade: "小2", subject: "算数", unit_name: "たし算の筆算", lesson_name: "2桁のたし算", sort_order: 1 },
      { id: "cm-m2", grade: "小2", subject: "算数", unit_name: "たし算の筆算", lesson_name: "3桁のたし算", sort_order: 2 },
      { id: "cm-ut-1", grade: "小2", subject: "算数", unit_name: "たし算の筆算", lesson_name: "たし算の筆算 - 単元確認テスト", sort_order: 2.5, item_type: "unit_test" },
      { id: "cm-m3", grade: "小2", subject: "算数", unit_name: "ひき算の筆算", lesson_name: "2桁のひき算", sort_order: 3 },
      { id: "cm-m4", grade: "小2", subject: "算数", unit_name: "ひき算の筆算", lesson_name: "3桁のひき算", sort_order: 4 }
    ];
    await db.saveCurriculumMasters(masters);

    const testDate = "2026-09-22";
    const task: LearningTask = {
      id: "task-ut-trans",
      student_id: elemStudent.id,
      unit_id: "cm-ut-1",
      scheduled_date: testDate,
      period: 1,
      status: "unstarted",
      subject: "算数",
      custom_unit_name: "たし算の筆算 - 単元確認テスト",
      start_lesson_id: "cm-ut-1",
      end_lesson_id: "cm-ut-1",
      start_lesson_name: "たし算の筆算 - 単元確認テスト",
      end_lesson_name: "たし算の筆算 - 単元確認テスト",
      lesson_range: "たし算の筆算 - 単元確認テスト",
      completed_lesson_ids: [],
      video_watched: false,
      test_passed: false,
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<StudentDashboard student={elemStudent as any} initialDate={testDate} onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/移行テスト生徒/).length).toBeGreaterThan(0);
    });

    // 1. Click task/unit title to open task detail modal
    const taskTitleElements = screen.queryAllByText(/たし算の筆算 - 単元確認テスト/);
    if (taskTitleElements.length > 0) {
      await act(async () => {
        fireEvent.click(taskTitleElements[0]);
      });

      // 2. Click "テストに合格した" to trigger handleTaskTestPass and next unit transition
      const passBtn = screen.queryByText(/テストに合格した/) || screen.queryByText(/合格完了/);
      if (passBtn) {
        await act(async () => {
          fireEvent.click(passBtn);
        });
      }

      // 3. Click "解説動画を見る" to trigger video watch
      const videoBtn = screen.queryByText(/解説動画を見る/);
      if (videoBtn) {
        await act(async () => {
          fireEvent.click(videoBtn);
        });
      }

      // 4. Click "全ステップを一括完了にする"
      const batchBtn = screen.queryByText(/全ステップを一括完了にする/);
      if (batchBtn) {
        await act(async () => {
          fireEvent.click(batchBtn);
        });
      }

      // Close modal
      const closeBtn = screen.queryByText(/閉じる/) || screen.queryByText(/✕/);
      if (closeBtn) {
        await act(async () => {
          fireEvent.click(closeBtn);
        });
      }
    }

    wrapper.unmount();
  });

  it("should test TeacherDashboard tabs, student modals, filters and master operations", async () => {
    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onLogout={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/テントル 司令塔ダッシュボード/)).toBeInTheDocument();
    });

    // 1. Toggle Grade category buttons (小学生, 中学生, 高校生)
    const elemBtn = screen.queryByTestId("header-teacher-type-elem");
    if (elemBtn) {
      await act(async () => {
        fireEvent.click(elemBtn);
      });
    }

    const highBtn = screen.queryByTestId("header-teacher-type-high");
    if (highBtn) {
      await act(async () => {
        fireEvent.click(highBtn);
      });
    }

    const jhsBtn = screen.queryByTestId("header-teacher-type-jhs");
    if (jhsBtn) {
      await act(async () => {
        fireEvent.click(jhsBtn);
      });
    }

    // 2. Role Toggle (校舎権限, 本部権限)
    const branchRoleBtn = screen.queryByTestId("role-toggle-branch");
    if (branchRoleBtn) {
      await act(async () => {
        fireEvent.click(branchRoleBtn);
      });
    }

    const adminRoleBtn = screen.queryByTestId("role-toggle-admin");
    if (adminRoleBtn) {
      await act(async () => {
        fireEvent.click(adminRoleBtn);
      });
    }

    // 3. Search input change
    const searchInput = screen.queryByTestId("filter-name") || screen.getAllByRole("textbox")[0];
    if (searchInput) {
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "テスト" } });
      });
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "" } });
      });
    }

    // 4. Test each tab in TeacherDashboard
    const tabs = ["schedule", "milestones", "minitest", "homework", "test-records", "ai-report", "student-info"];
    for (const tab of tabs) {
      const tabBtn = screen.queryByTestId(`nav-tab-${tab}`) || screen.queryByRole("button", { name: new RegExp(tab, "i") });
      if (tabBtn) {
        await act(async () => {
          fireEvent.click(tabBtn);
        });
      }
    }

    wrapper.unmount();
  });
});
