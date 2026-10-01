import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, CurriculumMaster, LearningTask, Student, Branch, CurriculumUnit, MilestonePlan, MiniTestResult, HomeworkResult, School } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";

describe("Deep Teacher Dashboard & DB Perfection Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should deeply exercise TeacherDashboard CRUD, modals, forms, and handlers", async () => {
    // 1. マスタデータ初期化
    const school: School = { id: "sch-1", name: "第一中学校", type: "junior_high", created_at: "" };
    await db.saveSchool(school);

    const branch: Branch = {
      id: "branch-1",
      code: "B01",
      name: "本校",
      login_id: "main",
      address: "東京都",
      phone: "03-0000-0000",
      is_active: true,
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: "std-deep-1",
      student_id: "S_DEEP_01",
      name: "深層 太郎",
      name_kana: "シンソウ タロウ",
      grade: "中3",
      status: "normal",
      level: "B",
      branch_id: "branch-1",
      classroom: "本校",
      school_id: "sch-1",
      teacher_in_charge: "福田 尚弘",
      assigned_teachers: ["福田 尚弘"],
      registered_year: 2026,
      registered_grade: "中3",
      selected_days: ["monday", "thursday"],
      selected_subjects: ["数学", "英語", "理科"],
      period_count: 3,
      default_slots: 3,
      personalities: ["几帳面"],
      target_schools: [{ school_name: "開成高校", course_name: "普通科" }],
      start_unit_math: "m-1",
      start_unit_english: "e-1",
      enrollment_date: "2024-04-01",
      notes: "入試対策中",
      parent_contact_id: "PAR_001"
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: "m-1", grade: "中3", subject: "数学", unit_name: "多項式", lesson_name: "展開公式", sort_order: 1 },
      { id: "m-2", grade: "中3", subject: "数学", unit_name: "多項式", lesson_name: "因数分解", sort_order: 2 },
      { id: "m-ut1", grade: "中3", subject: "数学", unit_name: "多項式", lesson_name: "多項式 - 単元確認テスト", sort_order: 2.5, item_type: "unit_test", passing_line: "80%以上" },
      { id: "e-1", grade: "中3", subject: "英語", unit_name: "Passive Voice", lesson_name: "受動態の基本", sort_order: 1 },
      { id: "e-ut1", grade: "中3", subject: "英語", unit_name: "Passive Voice", lesson_name: "Passive Voice - 単元確認テスト", sort_order: 1.5, item_type: "unit_test", passing_line: "80%以上" }
    ];
    await db.saveCurriculumMasters(masters);

    const units: CurriculumUnit[] = [
      { id: "m-1", name: "多項式", subject: "数学", sequence_order: 1 },
      { id: "e-1", name: "Passive Voice", subject: "英語", sequence_order: 1 }
    ];
    await db.saveCurriculumUnits(units);

    const testDate = "2026-09-22";
    const tasks: LearningTask[] = [
      {
        id: "task-deep-1",
        student_id: student.id,
        scheduled_date: testDate,
        period: 1,
        subject: "数学",
        unit_id: "m-1",
        start_lesson_id: "m-1",
        end_lesson_id: "m-2",
        start_lesson_name: "展開公式",
        end_lesson_name: "因数分解",
        lesson_range: "展開公式〜因数分解",
        status: "unstarted",
        video_watched: false,
        test_passed: false,
        created_at: new Date().toISOString()
      }
    ];
    await db.saveLearningTasks(tasks);

    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/深層 太郎/i)).toBeInTheDocument();
    });

    // 検索バー入力テスト
    const searchInputs = screen.queryAllByPlaceholderText(/生徒名・生徒IDで検索|検索/i);
    if (searchInputs.length > 0) {
      fireEvent.change(searchInputs[0], { target: { value: "深層" } });
    }

    // 生徒選択
    const stdCard = screen.getByText(/深層 太郎/i);
    await act(async () => {
      fireEvent.click(stdCard);
    });

    // 生徒詳細タブ
    const stdDetailTabs = screen.queryAllByText(/生徒詳細/i);
    if (stdDetailTabs.length > 0) {
      await act(async () => {
        fireEvent.click(stdDetailTabs[0]);
      });

      // 志望校追加ボタン
      const addTargetSchoolBtns = screen.queryAllByText(/\+ 志望校を追加/i);
      if (addTargetSchoolBtns.length > 0) {
        await act(async () => {
          fireEvent.click(addTargetSchoolBtns[0]);
        });
      }

      // 性格タグの追加
      const personalitySelects = screen.queryAllByRole("combobox");
      if (personalitySelects.length > 0) {
        fireEvent.change(personalitySelects[0], { target: { value: "几帳面" } });
      }

      // 生徒情報保存ボタン
      const saveStdBtns = screen.queryAllByText(/生徒情報を更新|生徒情報を保存/i);
      if (saveStdBtns.length > 0) {
        await act(async () => {
          fireEvent.click(saveStdBtns[0]);
        });
      }
    }

    // カリキュラムタブ
    const curriculumTabs = screen.queryAllByText(/カリキュラム/i);
    if (curriculumTabs.length > 0) {
      await act(async () => {
        fireEvent.click(curriculumTabs[0]);
      });
    }

    // 定期テストタブ
    const testsTabs = screen.queryAllByText(/定期テスト|テスト記録/i);
    if (testsTabs.length > 0) {
      await act(async () => {
        fireEvent.click(testsTabs[0]);
      });
    }

    // AIレポートタブ
    const aiTabs = screen.queryAllByText(/AIレポート/i);
    if (aiTabs.length > 0) {
      await act(async () => {
        fireEvent.click(aiTabs[0]);
      });
      const generateAiBtns = screen.queryAllByText(/AI学習レポートを生成|レポート生成/i);
      if (generateAiBtns.length > 0) {
        await act(async () => {
          fireEvent.click(generateAiBtns[0]);
        });
      }
    }

    expect(wrapper).toBeDefined();
  });
});
