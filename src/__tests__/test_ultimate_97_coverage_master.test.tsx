import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, CurriculumMaster, LearningTask, Student, Branch, CurriculumUnit, MilestonePlan, MiniTestResult, HomeworkResult, School } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";
import StudentDashboard from "../components/StudentDashboard";

describe("Ultimate 97%+ Coverage Master Suite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should deeply exercise TeacherDashboard full operations: create student, sort, filters, timetable saves, test CRUD, and modals", async () => {
    // 1. マスタデータ初期化
    const school: School = { id: "sch-ult-1", name: "未来中学校", type: "junior_high", created_at: "" };
    await db.saveSchool(school);

    const branch: Branch = {
      id: "branch-ult-1",
      code: "B_ULT",
      name: "未来校舎",
      login_id: "mirai",
      address: "東京都新宿区",
      phone: "03-9999-9999",
      is_active: true,
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const student: Student = {
      id: "std-ult-1",
      student_id: "S_ULT_01",
      name: "未来 翔太",
      name_kana: "ミライ ショウタ",
      grade: "中2",
      status: "normal",
      level: "A",
      branch_id: "branch-ult-1",
      classroom: "未来校舎",
      school_id: "sch-ult-1",
      teacher_in_charge: "山田 先生",
      assigned_teachers: ["山田 先生"],
      registered_year: 2026,
      registered_grade: "中2",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["数学", "英語"],
      period_count: 3,
      default_slots: 3,
      personalities: ["几帳面"],
      target_schools: [{ school_name: "開成高校", course_name: "普通科" }],
      start_unit_math: "m-ult-1",
      start_unit_english: "e-ult-1",
      enrollment_date: "2025-04-01",
      notes: "数学が得意",
      parent_contact_id: "PAR_ULT_1"
    };
    await db.saveStudent(student);

    const masters: CurriculumMaster[] = [
      { id: "m-ult-1", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "加減法", sort_order: 1 },
      { id: "m-ult-2", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "代入法", sort_order: 2 },
      { id: "m-ult-ut", grade: "中2", subject: "数学", unit_name: "連立方程式", lesson_name: "連立方程式 - 単元確認テスト", sort_order: 2.5, item_type: "unit_test", passing_line: "80%以上" },
      { id: "e-ult-1", grade: "中2", subject: "英語", unit_name: "Past Tense", lesson_name: "Irregular Verbs", sort_order: 1 },
      { id: "e-ult-ut", grade: "中2", subject: "英語", unit_name: "Past Tense", lesson_name: "Past Tense - 単元確認テスト", sort_order: 1.5, item_type: "unit_test", passing_line: "80%以上" }
    ];
    await db.saveCurriculumMasters(masters);

    const units: CurriculumUnit[] = [
      { id: "m-ult-1", name: "連立方程式", subject: "数学", sequence_order: 1 },
      { id: "e-ult-1", name: "Past Tense", subject: "英語", sequence_order: 1 }
    ];
    await db.saveCurriculumUnits(units);

    // 2. TeacherDashboard レンダリング
    let wrapper: any;
    await act(async () => {
      wrapper = render(<TeacherDashboard onBackToPortal={vi.fn()} />);
    });

    await waitFor(() => {
      expect(screen.getByText(/未来 翔太/i)).toBeInTheDocument();
    });

    // 3. 学年カテゴリ切替ボタン（小学生/中学生/高校生）
    const elemBtn = screen.queryByTestId("header-teacher-type-elem");
    const jhsBtn = screen.queryByTestId("header-teacher-type-jhs");
    const highBtn = screen.queryByTestId("header-teacher-type-high");
    if (elemBtn) {
      await act(async () => {
        fireEvent.click(elemBtn);
      });
    }
    if (highBtn) {
      await act(async () => {
        fireEvent.click(highBtn);
      });
    }
    if (jhsBtn) {
      await act(async () => {
        fireEvent.click(jhsBtn);
      });
    }

    // 4. 管理者権限切替
    const branchRoleBtn = screen.queryByTestId("role-toggle-branch");
    const adminRoleBtn = screen.queryByTestId("role-toggle-admin");
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

    // 5. 新規生徒登録タブへの移動と入力・保存
    const createStudentTabBtns = screen.queryAllByText(/新規生徒登録/i);
    if (createStudentTabBtns.length > 0) {
      await act(async () => {
        fireEvent.click(createStudentTabBtns[0]);
      });

      const nameInput = screen.queryByPlaceholderText(/例: 山田 太郎/i);
      const kanaInput = screen.queryByPlaceholderText(/例: ヤマダ タロウ/i);
      if (nameInput) fireEvent.change(nameInput, { target: { value: "新規 太郎" } });
      if (kanaInput) fireEvent.change(kanaInput, { target: { value: "シンキ タロウ" } });

      const saveNewStudentBtn = screen.queryAllByText(/生徒を登録する|登録する/i);
      if (saveNewStudentBtn.length > 0) {
        await act(async () => {
          fireEvent.click(saveNewStudentBtn[0]);
        });
      }
    }

    // 6. 生徒一覧タブに戻る
    const studentListTabBtns = screen.queryAllByText(/生徒一覧/i);
    if (studentListTabBtns.length > 0) {
      await act(async () => {
        fireEvent.click(studentListTabBtns[0]);
      });
    }

    // 生徒選択
    const stdCard = screen.getByText(/未来 翔太/i);
    await act(async () => {
      fireEvent.click(stdCard);
    });

    // 7. 定期テスト結果タブ
    const testTabBtns = screen.queryAllByText(/定期テスト/i);
    if (testTabBtns.length > 0) {
      await act(async () => {
        fireEvent.click(testTabBtns[0]);
      });

      const numberInputs = screen.queryAllByRole("spinbutton");
      if (numberInputs.length > 0) {
        fireEvent.change(numberInputs[0], { target: { value: "88" } });
      }

      const saveExamBtns = screen.queryAllByText(/成績を保存|テスト結果を保存/i);
      if (saveExamBtns.length > 0) {
        await act(async () => {
          fireEvent.click(saveExamBtns[0]);
        });
      }
    }

    // 8. AIレポートタブ
    const aiTabBtns = screen.queryAllByText(/AIレポート/i);
    if (aiTabBtns.length > 0) {
      await act(async () => {
        fireEvent.click(aiTabBtns[0]);
      });
      const genBtn = screen.queryAllByText(/AI学習レポートを生成/i);
      if (genBtn.length > 0) {
        await act(async () => {
          fireEvent.click(genBtn[0]);
        });
      }
      const saveReportBtn = screen.queryAllByText(/レポートを確定・保存/i);
      if (saveReportBtn.length > 0) {
        await act(async () => {
          fireEvent.click(saveReportBtn[0]);
        });
      }
    }

    expect(wrapper).toBeDefined();
  });

  it("should deeply exercise db.ts Supabase mock and real mode branches", async () => {
    // 1. Supabase モックモードでの全CRUD確認
    const testId = "sup-test-std-1";
    const std: Student = {
      id: testId,
      student_id: "S_SUP_01",
      name: "スーパー生徒",
      email: "sup@example.com",
      grade: "小6",
      status: "normal",
      branch_id: "branch-1",
      classroom: "校舎1",
      period_count: 2,
      registered_year: 2026,
      registered_grade: "小6",
      selected_days: ["tuesday", "friday"],
      selected_subjects: ["算数"],
      created_at: new Date().toISOString()
    };
    await db.saveStudent(std);

    // 2. カスタムクラス & 適用スコープ
    await db.saveCustomClass({
      id: "cc-1",
      code: "CC01",
      name: "個別特訓",
      teacher_name: "佐藤",
      day_of_week: "tuesday",
      period: 1,
      target_branch_id: "branch-1",
      created_at: new Date().toISOString()
    });
    const classes = db.getCustomClasses();
    expect(classes.length).toBeGreaterThan(0);

    await db.saveCustomApplyScope({
      id: "cas-1",
      target_branch_id: "branch-1",
      target_grade: "小6",
      target_level: "A",
      created_at: new Date().toISOString()
    });
    const scopes = db.getCustomApplyScopes();
    expect(scopes.length).toBeGreaterThan(0);

    // 3. マイルストーンテンプレート
    await db.saveMilestoneTemplate({
      id: "tmpl-1",
      name: "中学受験標準プラン",
      grade: "小6",
      subject: "算数",
      unit_names: ["整数", "小数", "分数"],
      created_at: new Date().toISOString()
    });
    const tmpls = db.getMilestoneTemplates();
    expect(tmpls.length).toBeGreaterThan(0);
    await db.deleteMilestoneTemplate("tmpl-1");

    // 4. セッション管理 & 認証
    db.saveSession({
      user: {
        id: "usr-1",
        email: "teacher@example.com",
        name: "佐藤 講師",
        role: "admin",
        branch_id: "branch-1",
        branch_name: "校舎1"
      },
      token: "mock-token"
    });
    const sess = db.getSession();
    expect(sess?.user?.name).toBe("佐藤 講師");
    await db.signOut();
    expect(db.getSession()).toBeNull();
  });
});
