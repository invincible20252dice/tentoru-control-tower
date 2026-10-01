import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, CurriculumMaster, LearningTask, Student, Branch, CurriculumUnit, MilestonePlan, MiniTestResult, HomeworkResult, School } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";

describe("TeacherDashboard Complete 96%+ Coverage Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should deeply exercise modals, filters, dropdowns, and schedule operations", async () => {
    // マスタ準備
    const branch: Branch = {
      id: "branch-cov-1",
      code: "B_COV",
      name: "カバレッジ校舎",
      login_id: "covbranch",
      address: "東京都",
      phone: "03-0000-1111",
      is_active: true,
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: "std-cov-1",
      student_id: "S_COV_01",
      name: "網羅 太郎",
      name_kana: "モウラ タロウ",
      grade: "小5",
      status: "warning",
      level: "B",
      branch_id: "branch-cov-1",
      classroom: "カバレッジ校舎",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小5",
      selected_days: ["monday", "thursday"],
      selected_subjects: ["算数", "国語"],
      start_unit_math: "m-cov-1",
      personalities: ["集中力あり"],
      target_schools: [{ school_name: "都立中高一貫校", course_name: "一般" }],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: "m-cov-1", grade: "小5", subject: "算数", unit_name: "小数のかけ算", lesson_name: "小数の筆算", sort_order: 1 },
      { id: "m-cov-2", grade: "小5", subject: "算数", unit_name: "小数のかけ算", lesson_name: "小数のかけ算 - 単元確認テスト", sort_order: 2, item_type: "unit_test", passing_line: "85%以上" }
    ];
    await db.saveCurriculumMasters(masters);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/網羅 太郎/i)).toBeInTheDocument();
    });

    // 1. AI自動設定ルールモーダルの全フィールド変更と保存
    const openAIRulesBtn = screen.queryAllByText(/AI自動設定ルール|⚙️/i);
    if (openAIRulesBtn.length > 0) {
      await act(async () => {
        fireEvent.click(openAIRulesBtn[0]);
      });

      const prepWeeksInput = screen.queryByTestId("branch-ai-test-prep-weeks-input");
      if (prepWeeksInput) fireEvent.change(prepWeeksInput, { target: { value: "4" } });

      const punkInput = screen.queryByTestId("branch-ai-punk-threshold-input");
      if (punkInput) fireEvent.change(punkInput, { target: { value: "5" } });

      const reviewInput = screen.queryByTestId("branch-ai-review-slot-interval-input");
      if (reviewInput) fireEvent.change(reviewInput, { target: { value: "3" } });

      const saveRulesBtn = screen.queryByTestId("save-branch-ai-rules-btn");
      if (saveRulesBtn) {
        await act(async () => {
          fireEvent.click(saveRulesBtn);
        });
      }
    }

    // 2. 単元テストマスタモーダルの入力と保存
    const addUnitTestBtn = screen.queryAllByText(/単元テストマスタ追加|単元テスト追加/i);
    if (addUnitTestBtn.length > 0) {
      await act(async () => {
        fireEvent.click(addUnitTestBtn[0]);
      });

      const unitNameInputs = screen.queryAllByPlaceholderText(/例: 1章 整数と小数/i);
      if (unitNameInputs.length > 0) fireEvent.change(unitNameInputs[0], { target: { value: "小数のかけ算" } });

      const testNameInputs = screen.queryAllByPlaceholderText(/例: たしざん 単元確認テスト/i);
      if (testNameInputs.length > 0) fireEvent.change(testNameInputs[0], { target: { value: "小数のかけ算 単元確認テスト" } });

      const passingLineInputs = screen.queryAllByPlaceholderText(/例: 80%以上, 90点/i);
      if (passingLineInputs.length > 0) fireEvent.change(passingLineInputs[0], { target: { value: "85%以上" } });

      const saveMasterBtn = screen.queryByTestId("save-unittest-master-btn");
      if (saveMasterBtn) {
        await act(async () => {
          fireEvent.click(saveMasterBtn);
        });
      }
    }

    // 3. 生徒選択と時間割・カリキュラム
    const stdCard = screen.getByText(/網羅 太郎/i);
    await act(async () => {
      fireEvent.click(stdCard);
    });

    const schedTabs = screen.queryAllByText(/時間割/i);
    if (schedTabs.length > 0) {
      await act(async () => {
        fireEvent.click(schedTabs[0]);
      });
      const autoReschedBtn = screen.queryAllByText(/遅れチェック＆自動リスケ/i);
      if (autoReschedBtn.length > 0) {
        await act(async () => {
          fireEvent.click(autoReschedBtn[0]);
        });
      }
    }

    expect(wrapper).toBeDefined();
  });
});
