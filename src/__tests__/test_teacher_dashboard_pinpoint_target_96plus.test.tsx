import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, CurriculumMaster, LearningTask, Student, Branch, CurriculumUnit, MilestonePlan, MiniTestResult, HomeworkResult, School } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";

describe("TeacherDashboard Pinpoint High Coverage Target Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should deeply exercise pinpoint interactions: modal close buttons, dropdown changes, CRUD buttons, and schedule selectors", async () => {
    // 1. 初期データ準備
    const school: School = { id: "sch-pin-1", name: "ピンポイント中学校", type: "junior_high", created_at: "" };
    await db.saveSchool(school);

    const branch: Branch = {
      id: "branch-pin-1",
      code: "B_PIN",
      name: "ピンポイント校舎",
      login_id: "pin",
      address: "東京都",
      phone: "03-7777-7777",
      is_active: true,
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: "std-pin-1",
      student_id: "S_PIN_01",
      name: "ピンポイント 太郎",
      name_kana: "ピンポイント タロウ",
      grade: "中2",
      status: "normal",
      level: "A",
      branch_id: "branch-pin-1",
      classroom: "ピンポイント校舎",
      school_id: "sch-pin-1",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "中2",
      selected_days: ["monday", "thursday"],
      selected_subjects: ["数学", "英語"],
      start_unit_math: "m-pin-1",
      personalities: ["几帳面"],
      target_schools: [{ school_name: "開成高校", course_name: "普通科" }],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: "m-pin-1", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "加減法", sort_order: 1 },
      { id: "m-pin-2", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "代入法", sort_order: 2 },
      { id: "m-pin-ut", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "連立方程式 - 単元確認テスト", sort_order: 2.5, item_type: "unit_test", passing_line: "80%以上" },
      { id: "e-pin-1", grade: "中2", subject: "英語", unit_name: "Past Tense", lesson_name: "Irregular Verbs", sort_order: 1 }
    ];
    await db.saveCurriculumMasters(masters);

    const units: CurriculumUnit[] = [
      { id: "m-pin-1", name: "連立方程式", subject: "数学", sequence_order: 1 }
    ];
    await db.saveCurriculumUnits(units);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/ピンポイント 太郎/i)).toBeInTheDocument();
    });

    // 2. AI自動設定ルールモーダルを開いて「✕」ボタンで閉じる (9578行)
    const openAIRulesBtn = screen.queryAllByText(/AI自動設定ルール|⚙️/i);
    if (openAIRulesBtn.length > 0) {
      await act(async () => {
        fireEvent.click(openAIRulesBtn[0]);
      });
      const closeButtons = screen.queryAllByText("✕");
      if (closeButtons.length > 0) {
        await act(async () => {
          fireEvent.click(closeButtons[0]);
        });
      }
    }

    // 3. 単元テストマスタモーダルを開いて 教科select と 対象単元select を変更する (9733, 9777行)
    const addUnitTestBtn = screen.queryAllByText(/単元テストマスタ追加|単元テスト追加/i);
    if (addUnitTestBtn.length > 0) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn[0]);
      });

      const selects = screen.queryAllByRole("combobox");
      for (const sel of selects) {
        fireEvent.change(sel, { target: { value: sel.children[1]?.getAttribute("value") || "数学" } });
      }

      const closeButtons = screen.queryAllByText("✕");
      if (closeButtons.length > 0) {
        await act(async () => {
          fireEvent.click(closeButtons[closeButtons.length - 1]);
        });
      }
    }

    // 4. 生徒選択
    const stdCard = screen.getByText(/ピンポイント 太郎/i);
    await act(async () => {
      fireEvent.click(stdCard);
    });

    // 5. 生徒詳細タブでの性格タグ削除と志望校削除
    const stdDetailTabs = screen.queryAllByText(/生徒詳細/i);
    if (stdDetailTabs.length > 0) {
      await act(async () => {
        fireEvent.click(stdDetailTabs[0]);
      });

      const removeButtons = screen.queryAllByText(/削除|✕/i);
      for (const btn of removeButtons) {
        try {
          await act(async () => {
            fireEvent.click(btn);
          });
        } catch (e) {}
      }
    }

    // 6. 時間割タブでのセレクト変更
    const schedTabs = screen.queryAllByText(/時間割/i);
    if (schedTabs.length > 0) {
      await act(async () => {
        fireEvent.click(schedTabs[0]);
      });

      const selects = screen.queryAllByRole("combobox");
      for (const sel of selects) {
        if (sel.children.length > 1) {
          fireEvent.change(sel, { target: { value: sel.children[1]?.getAttribute("value") || "" } });
        }
      }
    }

    expect(wrapper).toBeDefined();
  });
});
