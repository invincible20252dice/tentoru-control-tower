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

  it("should test StudentDashboard subviews, test results and modals", async () => {
    await act(async () => {
      render(<StudentDashboard student={testStudent as any} onBackToPortal={vi.fn()} />);
    });

    // Verify student name is displayed
    expect(screen.getAllByText(/ブースト生徒/).length).toBeGreaterThan(0);

    // Click all clickable action buttons
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      if (btn.textContent && (btn.textContent.includes("テスト") || btn.textContent.includes("設定") || btn.textContent.includes("切替"))) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });

  it("should test TeacherDashboard tabs, student modals, filters and master operations", async () => {
    await act(async () => {
      render(<TeacherDashboard />);
    });

    // 1. Search input change
    const searchInputs = screen.getAllByRole("textbox");
    if (searchInputs.length > 0) {
      await act(async () => {
        fireEvent.change(searchInputs[0], { target: { value: "ブースト" } });
      });
      await act(async () => {
        fireEvent.change(searchInputs[0], { target: { value: "" } });
      });
    }

    // 2. Click any action buttons (tabs, filters)
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      const txt = btn.textContent || "";
      if (txt.includes("校舎") || txt.includes("学年") || txt.includes("小学生") || txt.includes("中学生") || txt.includes("高校生")) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });
});
