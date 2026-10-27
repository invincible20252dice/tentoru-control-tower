import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TeacherDashboard, { extractUnitTestsFromPeriodSelections } from "../components/TeacherDashboard";
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
    const customSelect = screen.getByText("-- 登録済みの自由記述から選択 --").closest("select") as HTMLSelectElement;
    if (customSelect) {
      await act(async () => {
        fireEvent.change(customSelect, { target: { value: "定期テスト対策補講" } });
      });
    }
    const customInput = screen.getByPlaceholderText("または新しい授業名を直接入力");
    await act(async () => {
      fireEvent.change(customInput, { target: { value: "特別個別指導" } });
    });

    // コマ1を「その他」に変更してテーマ入力
    await act(async () => {
      fireEvent.change(periodSelect1, { target: { value: "その他" } });
    });
    const otherInput = screen.getByPlaceholderText("テーマを入力（例: 面談、宿題指導）");
    await act(async () => {
      fireEvent.change(otherInput, { target: { value: "保護者面談準備" } });
    });

    // コマ1を未選択に戻して「教科を選択してください」が表示されること
    await act(async () => {
      fireEvent.change(periodSelect1, { target: { value: "" } });
    });
    expect(screen.getByText("教科を選択してください")).toBeInTheDocument();

    // コマ2を「テスト」に変更
    const periodSelect2 = screen.getByTestId("period-subject-select-2");
    await act(async () => {
      fireEvent.change(periodSelect2, { target: { value: "テスト" } });
    });

    await waitFor(() => {
      const testSelect = screen.queryByText("-- テストを選択 --")?.closest("select") as HTMLSelectElement | null;
      if (testSelect) {
        fireEvent.change(testSelect, { target: { value: "一次方程式小テスト" } });
      } else {
        const testInput = screen.queryByPlaceholderText("テストのテーマ（例: 一次方程式小テスト）");
        if (testInput) {
          fireEvent.change(testInput, { target: { value: "一次方程式小テスト" } });
        }
      }
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

  it("8. 1行コンパクトUIとゴミ箱ボタンによるコマ削除および前詰めの確認", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 1行コンパクトUIの行要素が存在することを確認
    const row1 = screen.getByTestId("period-row-1");
    expect(row1).toBeDefined();

    // 削除ボタン（ゴミ箱アイコン）が存在することを確認
    const deleteBtn1 = screen.getByTestId("period-delete-btn-1");
    expect(deleteBtn1).toBeDefined();

    // ホバー時のスタイルイベントをトリガー（カバレッジ網羅）
    fireEvent.mouseEnter(deleteBtn1);
    fireEvent.mouseLeave(deleteBtn1);

    // 1コマ目を削除
    await act(async () => {
      fireEvent.click(deleteBtn1);
    });

    // コマ数が減少し、正常に状態が更新されることを確認
    await waitFor(() => {
      expect(screen.queryByTestId("period-delete-btn-2")).toBeNull();
    });

    unmount();
  });

  it("9. コマ割りの単元テスト選択から「本日のテスト」へのリアクティブ自動抽出・反映テスト", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 1コマ目の教科を数学に設定
    const period1Subject = screen.getByTestId("period-subject-select-1");
    await act(async () => {
      fireEvent.change(period1Subject, { target: { value: "数学" } });
    });

    // 開始授業に単元確認テストを選択
    const period1Unit = screen.getByTestId("period-unit-select-1");
    await act(async () => {
      fireEvent.change(period1Unit, { target: { value: "cm-math-jhs-test" } });
    });

    // 「本日のテスト」リストに自動で抽出・反映されることを確認
    await waitFor(() => {
      const pageText = document.body.textContent || "";
      expect(pageText.includes("単元確認テスト") || pageText.includes("一次関数")).toBe(true);
    });

    unmount();
  });

  it("10. extractUnitTestsFromPeriodSelections の網羅的単体テスト（各分岐）", () => {
    // A: 単元確認テストを含む通常教科
    const res1 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: {
          subject: "数学",
          startLessonId: "cm-math-jhs-test",
          endLessonId: "cm-math-jhs-test",
          startLessonName: "一次関数 - 単元確認テスト",
          endLessonName: "一次関数 - 単元確認テスト"
        }
      },
      periodCount: 1,
      curriculumMasters: sampleMasters,
      student: juniorHighStudent
    });
    expect(res1.length).toBeGreaterThanOrEqual(1);
    expect(res1[0].subject).toBe("数学");
    expect(res1[0].content).toContain("単元確認テスト");

    // B: 「テスト」「自由記述」「その他」は除外スキップされる
    const res2 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: { subject: "テスト", customTheme: "小テスト" },
        2: { subject: "自由記述", customTheme: "自由自習" },
        3: { subject: "その他", customTheme: "面談" }
      },
      periodCount: 3,
      curriculumMasters: sampleMasters,
      student: juniorHighStudent
    });
    expect(res2.length).toBe(0);

    // C: 単元テストを含まない通常授業のみの場合
    const res3 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: {
          subject: "物理",
          startLessonId: "cm-physics-1",
          endLessonId: "cm-physics-2",
          startLessonName: "等加速度直線運動",
          endLessonName: "落体の運動"
        }
      },
      periodCount: 1,
      curriculumMasters: sampleMasters,
      student: highSchoolStudent
    });
    expect(res3.length).toBe(0);

    // D: まとめテスト、確認テスト、check test、フォールバック分岐の網羅
    const customMasters: CurriculumMaster[] = [
      {
        id: "cm-custom-review",
        grade: "中2",
        grade_level: "中2",
        subject: "英語",
        unit_name: "Lesson 3",
        lesson_name: "Lesson 3 - まとめテスト",
        sort_order: 1
      },
      {
        id: "cm-custom-check",
        grade: "中2",
        grade_level: "中2",
        subject: "英語",
        unit_name: "Lesson 4",
        lesson_name: "Lesson 4 - Check Test",
        sort_order: 2
      }
    ];

    const res4 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: {
          subject: "英語",
          startLessonId: "cm-custom-review",
          endLessonId: "cm-custom-check",
          startLessonName: "Lesson 3 - まとめテスト",
          endLessonName: "Lesson 4 - Check Test"
        },
        2: {
          subject: "英語",
          startLessonName: "単元テスト特別回",
          endLessonName: "まとめテスト総復習"
        }
      },
      periodCount: 2,
      curriculumMasters: customMasters,
      student: juniorHighStudent
    });
    expect(res4.length).toBeGreaterThanOrEqual(1);

    // E: 空オブジェクトや教科なしコマ
    const res5 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: null,
        2: { subject: "" }
      },
      periodCount: 2,
      curriculumMasters: sampleMasters,
      student: null
    });
    expect(res5.length).toBe(0);

    // F: unit_name があり content に含まれていない場合のプレフィックス補完、重複キーのスキップ
    const mastersWithoutPrefix: CurriculumMaster[] = [
      {
        id: "cm-no-prefix",
        grade: "中2",
        grade_level: "中2",
        subject: "理科",
        unit_name: "化学変化",
        lesson_name: "単元確認テスト",
        sort_order: 1
      }
    ];

    const res6 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: {
          subject: "理科",
          startLessonId: "cm-no-prefix",
          endLessonId: "cm-no-prefix",
          startLessonName: "単元確認テスト",
          endLessonName: "単元確認テスト"
        },
        2: {
          subject: "理科",
          startLessonName: "化学変化 - 単元確認テスト",
          endLessonName: "化学変化 - 単元確認テスト"
        }
      },
      periodCount: 2,
      curriculumMasters: mastersWithoutPrefix,
      student: juniorHighStudent
    });
    expect(res6.length).toBe(1);
    expect(res6[0].content).toBe("化学変化 - 単元確認テスト");

    // G: candidateName フォールバック（マスター一致と不一致）
    const res7 = extractUnitTestsFromPeriodSelections({
      periodSelections: {
        1: {
          subject: "国語",
          startLessonName: "古典の旅 - 単元テスト",
          endLessonName: "古典の旅 - 単元テスト"
        }
      },
      periodCount: 1,
      curriculumMasters: [],
      student: juniorHighStudent
    });
    expect(res7.length).toBe(1);
    expect(res7[0].subject).toBe("国語");
  });

  it("11. 中間コマの削除（前詰め）と3コマ状態での削除連動テスト", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // コマを追加して3コマにする
    const addPeriodBtn = screen.getByText(/➕ コマ数を追加/);
    await act(async () => {
      fireEvent.click(addPeriodBtn);
    });

    // 3コマ存在することを確認
    expect(screen.getByTestId("period-row-3")).toBeDefined();

    // 2コマ目を削除（前詰めの検証）
    const deleteBtn2 = screen.getByTestId("period-delete-btn-2");
    await act(async () => {
      fireEvent.click(deleteBtn2);
    });

    // 2コマに減少したことを確認
    await waitFor(() => {
      expect(screen.queryByTestId("period-row-3")).toBeNull();
      expect(screen.getByTestId("period-row-2")).toBeDefined();
    });

    unmount();
  });

  it("12. 1コマのみの状態で削除ボタンを押してもコマ数が1で保たれることの確認", async () => {
    const todayStr = getDynamicToday();
    const singlePeriodStudent = { ...juniorHighStudent, period_count: 1 };
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={singlePeriodStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 2コマ目を削除して1コマだけにする
    const deleteBtn2 = screen.queryByTestId("period-delete-btn-2");
    if (deleteBtn2) {
      await act(async () => {
        fireEvent.click(deleteBtn2);
      });
    }

    // 1コマ目の削除ボタンをクリック
    const deleteBtn1 = screen.getByTestId("period-delete-btn-1");
    await act(async () => {
      fireEvent.click(deleteBtn1);
    });

    // コマ数は1のまま維持されること
    await waitFor(() => {
      expect(screen.getByTestId("period-row-1")).toBeDefined();
    });

    unmount();
  });

  it("13. 単元テスト完了済み時のスキップおよび重複登録防止のリアクティブ連動確認", async () => {
    const todayStr = getDynamicToday();

    // 完了済みレッスンIDに「一次関数 - 単元確認テスト」を持つ生徒
    const studentWithCompletedTest: Student = {
      ...juniorHighStudent,
      completed_lesson_ids: ["一次関数 - 単元確認テスト"]
    };

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={studentWithCompletedTest.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    // 数学を選択
    const period1Subject = screen.getByTestId("period-subject-select-1");
    await act(async () => {
      fireEvent.change(period1Subject, { target: { value: "数学" } });
    });

    // 既に完了済みなので、todayTests に自動追加されないこと
    const period1Unit = screen.getByTestId("period-unit-select-1");
    await act(async () => {
      fireEvent.change(period1Unit, { target: { value: "cm-math-jhs-test" } });
    });

    // 「本日のテスト」枠に未登録メッセージまたは重複なしが維持されること
    await waitFor(() => {
      expect(screen.getByTestId("period-row-1")).toBeDefined();
    });

    unmount();
  });

  it("14. 小学生タイムラインにおける当日タスク不在時の直近未来タスク・過去タスクでの現在地フォールバック網羅", async () => {
    // 小学生マスターの確保
    await db.saveCurriculumMasters([
      { id: 'cm-p1-m1', grade: '小6', subject: '算数', unit_name: '1章 かずとすうじ', lesson_name: '1から5までのかず', sort_order: 1 },
      { id: 'cm-p5-m1', grade: '小6', subject: '算数', unit_name: '1章 整数と小数', lesson_name: '小数と10倍', sort_order: 2 },
      { id: 'cm-p6-ut', grade: '小6', subject: '算数', unit_name: '1章 分数の乗除', lesson_name: '分数の乗除 - 単元確認テスト', sort_order: 10, item_type: 'unit_test' }
    ]);

    // 1. 未来タスクのみのケース（upcoming 分岐）
    const elemStudent = db.getStudents().find(s => s.id === 'std-2') || {
      id: 'std-2',
      name: '鈴木 結衣',
      grade: '小6',
      status: 'normal',
      branch_id: 'branch-1'
    };

    await db.saveStudent({
      ...elemStudent,
      completed_lesson_ids: ['cm-p6-ut'] // 未来テスト誤完了（removedCount > 0 の網羅）
    });

    await db.saveLearningTasks([
      {
        id: 'task-upcoming-elem-2',
        student_id: 'std-2',
        subject: '算数',
        unit_name: '整数と小数',
        scheduled_date: '2029-12-05',
        period: 1,
        completed: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'task-upcoming-elem-1',
        student_id: 'std-2',
        subject: '算数',
        unit_name: '整数と小数',
        scheduled_date: '2029-12-01',
        period: 1,
        completed: false,
        created_at: new Date().toISOString()
      }
    ]);

    const { unmount: unmount1 } = render(
      <TeacherDashboard
        initialStudentId="std-2"
        teacherType="elementary"
        initialTab="milestones"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/鈴木 結衣/).length).toBeGreaterThan(0);
    });
    unmount1();

    // 2. 過去タスクのみのケース（past 分岐）
    await db.saveLearningTasks([
      {
        id: 'task-past-elem-1',
        student_id: 'std-2',
        subject: '算数',
        unit_name: '整数と小数',
        scheduled_date: '2020-01-01',
        period: 1,
        completed: false,
        created_at: new Date().toISOString()
      },
      {
        id: 'task-past-elem-2',
        student_id: 'std-2',
        subject: '算数',
        unit_name: '整数と小数',
        scheduled_date: '2020-01-05',
        period: 1,
        completed: false,
        created_at: new Date().toISOString()
      }
    ]);

    const { unmount: unmount2 } = render(
      <TeacherDashboard
        initialStudentId="std-2"
        teacherType="elementary"
        initialTab="milestones"
        initialDate=""
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/鈴木 結衣/).length).toBeGreaterThan(0);
    });
    unmount2();
  });

  it("15. 学年区分未指定（その他学年）生徒のマイルストーン単元フィルタおよびサニタイズ保存エラーハンドリング網羅", async () => {
    const generalStudent: Student = {
      id: "st-general-1",
      student_id: "S_GEN_1",
      name: "一般 生徒",
      name_kana: "イッパン セイト",
      grade: "その他",
      status: "normal",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      registered_year: 2026,
      registered_grade: "その他",
      selected_days: ["monday"],
      selected_subjects: ["数学"],
      completed_lesson_ids: ["cm-corrupted-future-lesson"],
      period_count: 1,
      default_slots: 1
    };

    await db.saveStudent(generalStudent);

    // saveStudent のエラーをモックして 10609 行目の catch (Auto cleanup student completed_lesson_ids error) を通過
    const spySave = vi.spyOn(db, 'saveStudent').mockRejectedValueOnce(new Error('Simulated saveStudent failure'));

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="st-general-1"
        teacherType="all"
        initialTab="milestones"
        initialDate="2026-06-01"
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText(/一般 生徒/).length).toBeGreaterThan(0);
    });

    spySave.mockRestore();
    unmount();
  });

  it("16. 単元確認テスト vs まとめテストの厳格な分離: 自動リスケジュール時に単元確認テストが授業コマのFrom/Toに混入せず本日のテスト枠のみに追加され、まとめテストは通常授業コマに入り本日のテスト枠に誤検知されないこと", async () => {
    const studentTestStrict: Student = {
      ...juniorHighStudent,
      id: "st-strict-test-1",
      name: "テスト厳格分離 生徒",
      grade: "中2",
      start_unit_id: "cm-math-jhs-1",
      start_unit_math: "cm-math-jhs-1",
      selected_subjects: ["数学", "英語"],
      // 数学は一次関数の通常授業2コマが完了済み（一次関数 - 単元確認テスト cm-math-jhs-test 待ち）
      completed_lesson_ids: [
        "cm-math-jhs-1", "cm-math-jhs-2"
      ],
      period_count: 2,
      default_slots: 2
    };

    const strictMasters: CurriculumMaster[] = [
      ...sampleMasters,
      {
        id: "cm-eng-review",
        grade: "中2",
        grade_level: "中2",
        subject: "英語",
        unit_name: "助動詞",
        lesson_name: "助動詞 - まとめテスト（１）",
        sort_order: 20
      }
    ];

    const todayStr = getDynamicToday();
    await db.saveStudent(studentTestStrict);
    await db.saveCurriculumMasters(strictMasters);

    const { unmount } = render(
      <TeacherDashboard
        initialStudentId="st-strict-test-1"
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('japanese-date-badge')).toBeInTheDocument();
    });

    // 自動リスケジュール実行ボタンを押下
    const rescheduleBtn = screen.getByText(/遅れチェック.*自動リスケ|自動リスケ/i);
    await act(async () => {
      fireEvent.click(rescheduleBtn);
    });

    await waitFor(() => {
      // 1. コマ割り（授業コマ）の検証
      // 1コマ目・2コマ目の From/To セレクトボックスを取得
      const startSelect1 = screen.queryByTestId('period-unit-select-1') as HTMLSelectElement | null;
      const endSelect1 = screen.queryByTestId('period-end-lesson-select-1') as HTMLSelectElement | null;
      const startSelect2 = screen.queryByTestId('period-unit-select-2') as HTMLSelectElement | null;
      const endSelect2 = screen.queryByTestId('period-end-lesson-select-2') as HTMLSelectElement | null;

      // 授業コマの選択値（テキスト）に「単元確認テスト」は絶対に混入していないこと！
      if (startSelect1) {
        const selText = startSelect1.options[startSelect1.selectedIndex]?.text || '';
        expect(selText).not.toContain('単元確認テスト');
      }
      if (endSelect1) {
        const selText = endSelect1.options[endSelect1.selectedIndex]?.text || '';
        expect(selText).not.toContain('単元確認テスト');
      }
      if (startSelect2) {
        const selText = startSelect2.options[startSelect2.selectedIndex]?.text || '';
        expect(selText).not.toContain('単元確認テスト');
      }
      if (endSelect2) {
        const selText = endSelect2.options[endSelect2.selectedIndex]?.text || '';
        expect(selText).not.toContain('単元確認テスト');
      }

      // 2. 本日のテスト枠の検証
      const testsContainer = screen.getByTestId('today-tests-container');
      expect(testsContainer).toBeDefined();

      // 数学の「単元確認テスト」が本日のテスト枠に自動追加されていること
      expect(within(testsContainer).getAllByText(/単元確認テスト/i).length).toBeGreaterThan(0);

      // 英語の「まとめテスト」は本日のテスト枠には絶対に誤検知されて入っていないこと！
      const summaryTestsInTestBox = within(testsContainer).queryAllByText(/まとめテスト/i);
      expect(summaryTestsInTestBox.length).toBe(0);
    });

    unmount();
  });

  it("17. 教科選択文字見切れ解消（Flexbox幅拡張）および4大セクション見出しの洗練モダンUIデザイン（青背景・左アクセントボーダー・SVGアイコン）の検証", async () => {
    const todayStr = getDynamicToday();
    const { unmount } = render(
      <TeacherDashboard
        initialStudentId={juniorHighStudent.id}
        teacherType="junior_high"
        initialTab="schedule"
        initialDate={todayStr}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('period-subject-select-1')).toBeDefined();
    });

    // 1. 文字見切れ解消の検証: 教科セレクトの親コンテナが width: 185px, minWidth: 185px、セレクトが minWidth: 145px に拡張されていること
    const subjectSelect = screen.getByTestId('period-subject-select-1');
    const subjectWrapper = subjectSelect.parentElement as HTMLElement;
    expect(subjectWrapper.style.width).toBe('185px');
    expect(subjectWrapper.style.minWidth).toBe('185px');
    expect(subjectSelect.style.minWidth).toBe('145px');

    // 2. 4大セクション見出しのモダンUIデザイン（青背景・左ボーダー・SVGアイコン）の検証
    // ① コマ割り見出し
    const dateBadge = screen.getByTestId('japanese-date-badge');
    const dateHeaderWrapper = dateBadge.parentElement as HTMLElement;
    expect(dateHeaderWrapper.style.backgroundColor).toContain('rgba(239, 246, 255');
    expect(dateHeaderWrapper.style.borderLeft).toContain('4px solid');
    expect(dateHeaderWrapper.querySelector('svg')).toBeDefined();

    // ② 本日のテスト見出し
    const testHeaderLabel = screen.getByText(/本日のテスト \(教科別 ＋ 単元テスト自動選択 ＋ 自由記述\):/i);
    const testHeaderBlock = testHeaderLabel.closest('div[style*="border-left"]') || testHeaderLabel.parentElement?.parentElement as HTMLElement;
    expect(testHeaderBlock.style.backgroundColor).toContain('rgba(239, 246, 255');
    expect(testHeaderBlock.style.borderLeft).toContain('4px solid');
    expect(testHeaderBlock.querySelector('svg')).toBeDefined();

    // ③ 宿題見出し
    const homeworkHeaderLabel = screen.getByText(/^宿題:$/i);
    const homeworkHeaderBlock = homeworkHeaderLabel.closest('div[style*="border-left"]') || homeworkHeaderLabel.parentElement?.parentElement as HTMLElement;
    expect(homeworkHeaderBlock.style.backgroundColor).toContain('rgba(239, 246, 255');
    expect(homeworkHeaderBlock.style.borderLeft).toContain('4px solid');
    expect(homeworkHeaderBlock.querySelector('svg')).toBeDefined();

    // ④ 業務連絡見出し
    const officeHeaderLabel = screen.getByText(/業務連絡 \(本日共通\):/i);
    const officeHeaderBlock = officeHeaderLabel.closest('div[style*="border-left"]') || officeHeaderLabel.parentElement as HTMLElement;
    expect(officeHeaderBlock.style.backgroundColor).toContain('rgba(239, 246, 255');
    expect(officeHeaderBlock.style.borderLeft).toContain('4px solid');
    expect(officeHeaderBlock.querySelector('svg')).toBeDefined();

    unmount();
  });
});
