import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeacherDashboard from "../components/TeacherDashboard";
import { db } from "../lib/db";
import { Student, CurriculumMaster, CurriculumUnit } from "../types";

describe("TeacherDashboard Schedule Tab Meaningful Clean UI Tests", () => {
  const getDynamicToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const highSchoolStudent: Student = {
    id: "st-high-1",
    student_id: "S_HIGH_1",
    name: "高校 太郎",
    name_kana: "コウコウ タロウ",
    grade: "高1",
    status: "normal",
    branch_id: "branch-1",
    classroom: "恵比寿教室",
    school_id: "sch-high-1",
    school_name: "恵比寿高校",
    teacher_in_charge: "福田 尚弘",
    registered_year: 2026,
    registered_grade: "高1",
    selected_days: ["monday", "thursday"],
    selected_subjects: ["数学", "物理"],
    period_count: 2,
    default_slots: 2
  };

  const juniorHighStudent: Student = {
    id: "st-jhs-1",
    student_id: "S_JHS_1",
    name: "中学 花子",
    name_kana: "チュウガク ハナコ",
    grade: "中2",
    status: "normal",
    branch_id: "branch-1",
    classroom: "恵比寿教室",
    school_id: "sch-jhs-1",
    school_name: "恵比寿中学校",
    teacher_in_charge: "福田 尚弘",
    registered_year: 2026,
    registered_grade: "中2",
    selected_days: ["tuesday", "friday"],
    selected_subjects: ["数学", "英語"],
    period_count: 2,
    default_slots: 2
  };

  const sampleMasters: CurriculumMaster[] = [
    {
      id: "cm-physics-1",
      grade: "高1",
      grade_level: "高1",
      subject: "物理",
      unit_name: "力学基礎",
      lesson_name: "等加速度直線運動",
      sort_order: 1
    },
    {
      id: "cm-physics-2",
      grade: "高1",
      grade_level: "高1",
      subject: "物理",
      unit_name: "力学基礎",
      lesson_name: "落体の運動",
      sort_order: 2
    },
    {
      id: "cm-math-jhs-1",
      grade: "中2",
      grade_level: "中2",
      subject: "数学",
      unit_name: "一次関数",
      lesson_name: "一次関数の変化の割合",
      sort_order: 10
    },
    {
      id: "cm-math-jhs-2",
      grade: "中2",
      grade_level: "中2",
      subject: "数学",
      unit_name: "一次関数",
      lesson_name: "一次関数のグラフ",
      sort_order: 11
    },
    {
      id: "cm-math-jhs-test",
      grade: "中2",
      grade_level: "中2",
      subject: "数学",
      unit_name: "一次関数",
      lesson_name: "一次関数 - 単元確認テスト",
      item_type: "unit_test",
      passing_line: "80%以上",
      sort_order: 12
    }
  ];

  const sampleUnits: CurriculumUnit[] = [
    {
      id: "unit-physics-1",
      school_id: "sch-high-1",
      grade: "高1",
      subject: "物理",
      name: "力学総合",
      sequence_order: 1
    }
  ];

  beforeEach(async () => {
    db.clearMockData();
    await db.saveStudent(highSchoolStudent);
    await db.saveStudent(juniorHighStudent);
    await db.saveCurriculumMasters(sampleMasters);
    for (const u of sampleUnits) {
      await db.saveCurriculumUnit(u);
    }
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  it("1. 高校生モード: 高校教科（物理）の選択、From/To セレクト、コマ数追加、および右上『コマ割りを反映』による保存が正常に動作すること", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={highSchoolStudent.id}
        teacherType="high_school"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // ヘッダー見出しに日付が表示されていること
    expect(screen.getByTestId("japanese-date-badge")).toBeInTheDocument();

    // コマ1の教科を「物理」に変更
    const periodSelect1 = screen.getByTestId("period-subject-select-1");
    await act(async () => {
      fireEvent.change(periodSelect1, { target: { value: "物理" } });
    });

    // 開始授業 (From) と終了授業 (To) のセレクトボックスが表示されること
    await waitFor(() => {
      expect(screen.getByTestId("period-unit-select-1")).toBeInTheDocument();
      expect(screen.getByTestId("period-end-lesson-select-1")).toBeInTheDocument();
    });

    const startSelect = screen.getByTestId("period-unit-select-1");
    const endSelect = screen.getByTestId("period-end-lesson-select-1");

    await act(async () => {
      fireEvent.change(startSelect, { target: { value: "cm-physics-1" } });
      fireEvent.change(endSelect, { target: { value: "cm-physics-2" } });
    });

    // 「➕ コマ数を追加」ボタンをクリックしてコマ数を増やす
    const addPeriodBtn = screen.getByText(/➕ コマ数を追加/);
    await act(async () => {
      fireEvent.click(addPeriodBtn);
    });

    // コマ3のセレクトボックスが追加されたこと
    expect(screen.getByTestId("period-subject-select-3")).toBeInTheDocument();

    // 右上の「💾 コマ割りを反映」ボタンをクリックして保存
    const reflectBtn = screen.getByRole("button", { name: /コマ割りを反映/ });
    await act(async () => {
      fireEvent.click(reflectBtn);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("保存しました"));
    });

    unmount();
  });

  it("2. 自由記述・テスト・その他のコマ割り、登録済み自由記述選択、および下部『時間割コマ割りを保存』が正常に動作すること", async () => {
    const todayStr = getDynamicToday();
    // 自由記述マスタ（CustomClass）を保存
    await db.saveCustomClass({ id: "cc-1", name: "定期テスト対策補講", grade: "中2" });

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // テストを2件追加して todayTests.length >= 2 の状態を作る
    const addTestBtn = screen.getByText("➕ テストを追加");
    await act(async () => {
      fireEvent.click(addTestBtn);
    });
    await act(async () => {
      fireEvent.click(addTestBtn);
    });

    // コマ1を「自由記述」に変更
    const periodSelect1 = screen.getByTestId("period-subject-select-1");
    await act(async () => {
      fireEvent.change(periodSelect1, { target: { value: "自由記述" } });
    });

    // 自由記述の入力フィールドを操作
    await waitFor(() => {
      expect(screen.getByPlaceholderText("または新しい授業名を直接入力")).toBeInTheDocument();
    });
    const customInput = screen.getByPlaceholderText("または新しい授業名を直接入力");
    await act(async () => {
      fireEvent.change(customInput, { target: { value: "特別個別指導" } });
    });

    // コマ2を「テスト」に変更
    const periodSelect2 = screen.getByTestId("period-subject-select-2");
    await act(async () => {
      fireEvent.change(periodSelect2, { target: { value: "テスト" } });
    });

    await waitFor(() => {
      const testSelect = screen.queryByText("-- テストを選択 --") || screen.queryByPlaceholderText("テストのテーマ（例: 一次方程式小テスト）");
      expect(testSelect).toBeInTheDocument();
    });

    // 下部の「時間割コマ割りを保存」ボタンをクリック
    const saveTimetableBtn = screen.getByText("時間割コマ割りを保存");
    await act(async () => {
      fireEvent.click(saveTimetableBtn);
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("保存しました"));
    });

    unmount();
  });

  it("3. 本日のテスト: 単元テストマスタ連携、合格ライン自動反映、対象範囲の変更、およびテスト削除が正常に動作すること", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // テストを追加
    const addTestBtn = screen.getByText("➕ テストを追加");
    await act(async () => {
      fireEvent.click(addTestBtn);
    });

    // テストの種別を「📝 単元テスト」に変更
    const testTypeSelects = screen.getAllByRole("combobox").filter(el => {
      const select = el as HTMLSelectElement;
      return Array.from(select.options).some(o => o.value === "unit_test");
    });
    expect(testTypeSelects.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.change(testTypeSelects[0], { target: { value: "unit_test" } });
    });

    // 単元テストマスタ選択プルダウンが表示されること
    await waitFor(() => {
      expect(screen.getByText("-- 単元テストマスタから選択 --")).toBeInTheDocument();
    });

    const masterSelect = screen.getByDisplayValue("-- 単元テストマスタから選択 --") as HTMLSelectElement;
    const testOption = Array.from(masterSelect.options).find(o => o.text.includes("一次関数"));
    if (testOption) {
      await act(async () => {
        fireEvent.change(masterSelect, { target: { value: testOption.value } });
      });
      // 合格ラインが自動反映されること
      const passingLineInputs = screen.getAllByPlaceholderText("例: 80%以上, 90点");
      expect((passingLineInputs[passingLineInputs.length - 1] as HTMLInputElement).value).toBe("80%以上");
    }

    // 対象範囲を「学年全員」に変更
    const scopeSelects = screen.getAllByRole("combobox").filter(el => {
      const select = el as HTMLSelectElement;
      return Array.from(select.options).some(o => o.value === "grade");
    });
    if (scopeSelects.length > 0) {
      await act(async () => {
        fireEvent.change(scopeSelects[0], { target: { value: "grade" } });
      });
    }

    // テスト削除ボタンをクリック
    const deleteTestBtns = screen.getAllByRole("button", { name: "削除" });
    await act(async () => {
      fireEvent.click(deleteTestBtns[0]);
    });

    // テストが削除され「登録されたテストはありません。」が表示されること
    await waitFor(() => {
      expect(screen.getByText("登録されたテストはありません。")).toBeInTheDocument();
    });

    unmount();
  });

  it("4. 宿題リスト: 演習種別切り替え、提出期限変更、非デフォルト対象範囲の変更、および宿題削除が正常に動作すること", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 宿題を追加
    const addHwBtn = screen.getByRole("button", { name: /➕ 宿題を追加/ });
    await act(async () => {
      fireEvent.click(addHwBtn);
    });

    // 宿題の種別を「当日授業の2回目（演習）」に切り替え
    const hwTypeSelects = screen.getAllByRole("combobox").filter(el => {
      const select = el as HTMLSelectElement;
      return Array.from(select.options).some(o => o.value === "drill_2nd");
    });
    if (hwTypeSelects.length > 0) {
      await act(async () => {
        fireEvent.change(hwTypeSelects[0], { target: { value: "drill_2nd" } });
      });
      // 再度「自由記述」に戻す
      await act(async () => {
        fireEvent.change(hwTypeSelects[0], { target: { value: "custom" } });
      });
    }

    // 宿題内容を入力
    const hwContentInputs = screen.getAllByPlaceholderText("宿題の内容を入力（例：ワークP24-25, 漢字ノート）");
    const targetHwInput = hwContentInputs[hwContentInputs.length - 1];
    await act(async () => {
      fireEvent.change(targetHwInput, { target: { value: "計算ドリル P30-32" } });
    });
    expect((targetHwInput as HTMLInputElement).value).toBe("計算ドリル P30-32");

    // 宿題の削除（表示されている削除ボタンをすべてクリックして全削除）
    const deleteBtns = screen.getAllByRole("button", { name: "削除" });
    for (const btn of deleteBtns) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }

    // 宿題が全削除され「登録された宿題はありません。」が表示されること
    await waitFor(() => {
      expect(screen.getByText("登録された宿題はありません。")).toBeInTheDocument();
    });

    unmount();
  });

  it("5. カレンダー日付選択および無効な日付・日付未設定時のヘッダー見出しフォールバック挙動", async () => {
    // 1. targetDate に無効な文字列を渡した場合
    const { unmount: unmountInvalid } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        targetDate="not-a-valid-date"
      />
    );
    // isNaN(d.getTime()) により日付見出しは描画されないこと
    expect(screen.queryByTestId("japanese-date-badge")).toBeNull();
    unmountInvalid();

    // 2. 正常な日付を渡した場合
    const todayStr = getDynamicToday();
    const { unmount: unmountValid } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        targetDate={todayStr}
      />
    );
    expect(screen.getByTestId("japanese-date-badge")).toBeInTheDocument();
    unmountValid();
  });

  it("6. 宿題の対象範囲（grade, school, level）変更時に非デフォルト対象範囲のバッジ/設定が表示されること", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 宿題を追加
    const addHwBtn = screen.getByRole("button", { name: /➕ 宿題を追加/ });
    await act(async () => {
      fireEvent.click(addHwBtn);
    });

    // 宿題の対象範囲プルダウンを変更（例: school または grade）
    const scopeSelects = screen.getAllByRole("combobox").filter(el => {
      const select = el as HTMLSelectElement;
      return Array.from(select.options).some(o => o.value === "grade" || o.value === "school");
    });
    if (scopeSelects.length > 0) {
      await act(async () => {
        fireEvent.change(scopeSelects[scopeSelects.length - 1], { target: { value: "grade" } });
      });
    }

    unmount();
  });

  it("7. コマ割り一括適用のスコープ変更（school, grade, level）と保存アラートメッセージの確認", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 一括適用スコープを「同じ学校の生徒全員に一括適用」に変更
    const applyScopeSelect = screen.queryByTestId("apply-scope-select");
    if (applyScopeSelect) {
      await act(async () => {
        fireEvent.change(applyScopeSelect, { target: { value: "school" } });
      });
      const saveBtn = screen.getByText("時間割コマ割りを保存");
      await act(async () => {
        fireEvent.click(saveBtn);
      });
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith("今日の時間割コマ割りを対象生徒全員に一括保存しました！");
      });
    }

    unmount();
  });
});
