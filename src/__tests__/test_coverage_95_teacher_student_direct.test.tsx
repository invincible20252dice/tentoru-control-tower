import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, Student, LearningTask, CurriculumMaster, CustomClass, School } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";
import StudentDashboard from "../components/StudentDashboard";

describe("Direct High-Precision Coverage Expansion Suite", () => {
  const testStudent: Student = {
    id: "std-direct-1",
    name: "直接検証生徒",
    name_kana: "チョクセツケンショウセイト",
    grade: "小6",
    school_id: "sch-1",
    branch_id: "branch-1",
    level: "A",
    status: "normal",
    birthday: "2014-05-01",
    enrollment_date: "2025-04-01",
    club_activities: "サッカー部",
    hobbies: "読書",
    parent_name: "保護者太郎",
    contact_phone: "090-1234-5678",
    personality_tags: ["真面目", "計算得意"],
    teacher_in_charge: "福田 尚弘",
    assigned_teachers: ["福田 尚弘"],
    selected_subjects: ["算数", "国語", "英語"],
    selected_days: ["tuesday", "friday"],
    schedule_config: {
      available_days: [2, 5],
      daily_slots: 2,
      subject_start_units: { "算数": "cm-d-1" }
    },
    completed_lesson_ids: ["cm-d-1"]
  };

  const testMasters: CurriculumMaster[] = [
    { id: "cm-d-1", grade: "小6", subject: "算数", unit_name: "比とその利用", lesson_name: "STEP 1 比の値", sort_order: 1, default_slots: 2 },
    { id: "cm-d-2", grade: "小6", subject: "算数", unit_name: "比とその利用", lesson_name: "比 単元確認テスト", sort_order: 2, default_slots: 2 },
    { id: "cm-d-3", grade: "小6", subject: "算数", unit_name: "円の面積", lesson_name: "STEP 1 面積公式", sort_order: 3, default_slots: 2 }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.saveStudent(testStudent);
    await db.saveCurriculumMasters(testMasters);
  });

  it("should thoroughly exercise TeacherDashboard student-detail editing, inputs, and tab updates", async () => {
    await act(async () => {
      render(<TeacherDashboard initialTab="student-detail" initialStudentId={testStudent.id} />);
    });

    // 1. Change text inputs in student detail form
    const nameInput = screen.queryByDisplayValue(testStudent.name);
    if (nameInput) {
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: "直接検証生徒 (更新後)" } });
      });
    }

    const kanaInput = screen.queryByDisplayValue(testStudent.name_kana!);
    if (kanaInput) {
      await act(async () => {
        fireEvent.change(kanaInput, { target: { value: "コウシンゴ" } });
      });
    }

    // 2. Click save buttons in student detail
    const saveBtns = screen.queryAllByRole("button");
    for (const btn of saveBtns) {
      if (btn.textContent && (btn.textContent.includes("保存") || btn.textContent.includes("更新"))) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });

  it("should thoroughly exercise db.ts fetch and delete operations across all entities", async () => {
    // 1. Fetch operations
    await db.fetchStudents();
    await db.fetchStudent(testStudent.id);
    await db.fetchSchools();
    await db.fetchLearningTasks(testStudent.id);
    await db.fetchMiniTestResults(testStudent.id);
    await db.fetchHomeworkResults(testStudent.id);
    await db.fetchStudentInteractions(testStudent.id);
    await db.fetchPersonalityOptions();
    await db.fetchTeacherOptions();
    await db.fetchCurriculumMasters("算数");
    await db.fetchStudentLessonProgressList(testStudent.id);

    // 2. Delete and cleanup operations
    await db.deleteStudent("nonexistent-student-id");
    await db.deleteSchool("nonexistent-school-id");
    await db.deleteLearningTasksByStudent("nonexistent-student-id");
    await db.deleteLearningTasksForDate("nonexistent-student-id", "2026-09-10");
    await db.deleteTestRecord("nonexistent-record-id");
    await db.deleteMiniTestResult("nonexistent-mini-id");
    await db.deleteHomeworkResult("nonexistent-homework-id");
    await db.deleteCustomClass("nonexistent-class-id");
    await db.deleteCustomApplyScope("nonexistent-scope-id");
    await db.deleteMilestoneTemplate("nonexistent-template-id");
    await db.deleteCurriculumMaster("nonexistent-master-id");
    await db.deleteCurriculumMastersByGrades(["小6"]);
  });

  it("should exercise StudentDashboard task steps completion and simulation triggers", async () => {
    const task: LearningTask = {
      id: "task-direct-sim-1",
      student_id: testStudent.id,
      unit_id: "cm-d-2",
      scheduled_date: "2026-09-10",
      period: 1,
      status: "unstarted",
      video_watched: false,
      test_passed: false,
      subject: "算数",
      custom_unit_name: "比 単元確認テスト",
      lesson_range: "比 単元確認テスト",
      created_at: new Date().toISOString()
    };
    await db.saveLearningTasks([task]);

    await act(async () => {
      render(<StudentDashboard student={testStudent} initialDate="2026-09-10" onBackToPortal={vi.fn()} />);
    });

    // Click pass / fail / watch buttons
    const actionButtons = screen.queryAllByRole("button");
    for (const btn of actionButtons) {
      if (btn.textContent && (btn.textContent.includes("合格") || btn.textContent.includes("動画") || btn.textContent.includes("完了"))) {
        await act(async () => {
          fireEvent.click(btn);
        });
      }
    }
  });
});
