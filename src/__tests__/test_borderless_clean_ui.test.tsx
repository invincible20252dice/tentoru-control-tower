import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HorizontalDatePicker } from "../components/HorizontalDatePicker";
import TeacherDashboard from "../components/TeacherDashboard";
import { db } from "../lib/db";
import { Student, CurriculumMaster, CurriculumUnit } from "../types";

describe("Borderless Clean UI Tests (枠線削減 & 背景面グルーピング検証)", () => {
  const sampleStudent: Student = {
    id: "st-clean-ui-1",
    student_id: "S_CLEAN_1",
    name: "枠線 整理太郎",
    name_kana: "ワクセエン セイリタロウ",
    grade: "小5",
    status: "normal",
    branch_id: "branch-1",
    classroom: "恵比寿教室",
    school_id: "sch-1",
    school_name: "恵比寿小学校",
    teacher_in_charge: "福田 尚弘",
    registered_year: 2026,
    registered_grade: "小5",
    selected_days: ["monday", "thursday"],
    selected_subjects: ["算数", "英語"],
    period_count: 2,
    default_slots: 2
  };

  const sampleUnits: CurriculumUnit[] = [
    {
      id: "unit-clean-1",
      school_id: "sch-1",
      grade: "小5",
      subject: "算数",
      name: "小数の計算",
      sequence_order: 1
    }
  ];

  const sampleMasters: CurriculumMaster[] = [
    {
      id: "cm-clean-1",
      grade: "小5",
      grade_level: "小5",
      subject: "算数",
      unit_name: "小数のかけ算",
      lesson_name: "小数のかけ算 (1)",
      sort_order: 1
    },
    {
      id: "cm-clean-2",
      grade: "小5",
      grade_level: "小5",
      subject: "算数",
      unit_name: "小数のかけ算",
      lesson_name: "小数のかけ算 - 単元確認テスト",
      item_type: "unit_test",
      sort_order: 2
    }
  ];

  beforeEach(async () => {
    await db.saveStudent(sampleStudent);
    await db.saveCurriculumUnits(sampleUnits);
    await db.saveCurriculumMasters(sampleMasters);
  });

  it("1. HorizontalDatePicker: 曜日ごとの個別枠線が完全撤廃され、非選択日は透明、選択日はbg-blue-600塗りつぶし、通塾日は淡いアクセント塗りであること", () => {
    const handleChangeDate = vi.fn();
    const { container } = render(
      <HorizontalDatePicker
        selectedDate="2026-06-15"
        onChangeDate={handleChangeDate}
        selectedDays={["monday", "thursday"]}
      />
    );

    const buttons = container.querySelectorAll("button[type=\"button\"]");
    const dayButtons = Array.from(buttons).filter(b => b.textContent?.includes("月") || b.textContent?.includes("火"));
    expect(dayButtons.length).toBeGreaterThanOrEqual(2);

    // 月曜日 (選択中・通塾日)
    const mondayBtn = dayButtons.find(b => b.textContent?.includes("月")) as HTMLElement;
    expect(mondayBtn).toBeDefined();
    // 個別枠線（border）が撤廃されていること
    expect(["none", "medium", ""]).toContain(mondayBtn.style.border);
    // 選択中は青色（#2563eb / rgb(37, 99, 235)）で塗りつぶされていること
    expect(mondayBtn.style.backgroundColor).toBe("rgb(37, 99, 235)");

    // 火曜日 (非選択日・非通塾日)
    const tuesdayBtn = dayButtons.find(b => b.textContent?.includes("火")) as HTMLElement;
    expect(tuesdayBtn).toBeDefined();
    expect(["none", "medium", ""]).toContain(tuesdayBtn.style.border);
    // 非選択日は透明背景であること
    expect(tuesdayBtn.style.backgroundColor).toBe("transparent");
  });

  it("2. TeacherDashboard コマ割り設定: 授業進捗範囲の青ボーダーが削除され、薄いテキストラベルとしてシンプルに表示されること", async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={sampleStudent.id}
          teacherType="elementary"
          initialTab="schedule"
        />
      );
    });

    const periodSelect = screen.getByTestId("period-subject-select-1");
    await act(async () => {
      fireEvent.change(periodSelect, { target: { value: "算数" } });
    });

    const startSelect = screen.getByTestId("period-unit-select-1") as HTMLElement;
    expect(startSelect.style.border).toMatch(/e2e8f0|226, 232, 240/);
    expect(startSelect.style.borderRadius).toBe("8px");

    await act(async () => {
      fireEvent.change(startSelect, { target: { value: "cm-clean-1" } });
    });

    const badge = screen.getByTestId("period-lesson-range-badge-1") as HTMLElement;
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain("授業進捗範囲:");
    // 青いボーダー（1px solid #bfdbfe）が完全になく、背景も透明・薄いラベルであること
    expect(badge.style.border).toBe("");
    expect(badge.style.backgroundColor).toBe("");
    expect(badge.style.color).toBe("rgb(100, 116, 139)");
  });

  it("3. TeacherDashboard テスト・宿題エリア: 四角いボックス枠線が廃止され、下部薄仕切り線のRowデザインとborder-slate-200フォーム枠線になっていること", async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={sampleStudent.id}
          teacherType="elementary"
          initialTab="schedule"
        />
      );
    });

    const addTestBtn = screen.getByRole("button", { name: /➕ テストを追加/i });
    await act(async () => {
      fireEvent.click(addTestBtn);
    });

    const testContainer = screen.getByTestId("today-tests-container") as HTMLElement;
    expect(["none", "medium", ""]).toContain(testContainer.style.border);

    const addHwBtn = screen.getByRole("button", { name: /➕ 宿題を追加/i });
    await act(async () => {
      fireEvent.click(addHwBtn);
    });

    const passingLineInputs = screen.getAllByPlaceholderText(/例: 80%以上, 90点/i);
    expect(passingLineInputs.length).toBeGreaterThan(0);
    expect(passingLineInputs[0].style.border).toMatch(/e2e8f0|226, 232, 240/);
    expect(passingLineInputs[0].style.borderRadius).toBe("8px");
  });

  it("4. TeacherDashboard 年間計画タイムライン: 各STEPのボックス枠線が廃止され、ゼブラストライプと極薄仕切り線のテーブルUIになっていること", async () => {
    await act(async () => {
      render(
        <TeacherDashboard
          initialStudentId={sampleStudent.id}
          teacherType="elementary"
          initialTab="milestones"
        />
      );
    });

    const timelineItem = screen.getByTestId("timeline-item-cm-clean-1") as HTMLElement;
    expect(timelineItem).toBeDefined();
    // ボックス枠線が撤廃され、下部薄仕切り線（borderBottom）で区切られていること
    expect(timelineItem.style.borderBottom).toMatch(/f1f5f9|241, 245, 249/);
    // 左端のアクセントライン
    expect(timelineItem.style.borderLeft).toMatch(/2563eb|37, 99, 235/);
  });
});
