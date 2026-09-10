import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db, normalizeStandardGrade, isElementaryStudent, isJuniorHighStudent, isHighSchoolStudent } from "../lib/db";
import TeacherDashboard from "../components/TeacherDashboard";

describe("TeacherDashboard Supabase Student List & Filter Robustness", () => {
  const mockStudents = [
    {
      id: "std-kenshin-1",
      name: "中尾 謙信",
      grade: "小1",
      school_id: "sch-elem-1",
      school_name: "川尻校",
      branch_id: null,
      classroom: null,
      level: "A" as const,
      created_at: "2026-05-01T00:00:00Z"
    },
    {
      id: "std-yui-1",
      name: "鈴木 結衣",
      grade: "小学6年生",
      school_id: "sch-elem-1",
      school_name: "テントル小学校",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      level: "B" as const,
      created_at: "2026-05-02T00:00:00Z"
    },
    {
      id: "std-taro-jhs",
      name: "山田 中学太郎",
      grade: "中2",
      school_id: "sch-jhs-1",
      school_name: "テントル中学校",
      branch_id: "branch-2",
      classroom: "渋谷教室",
      level: "A" as const,
      created_at: "2026-05-03T00:00:00Z"
    },
    {
      id: "std-hanako-high",
      name: "佐藤 高校花子",
      grade: "高1",
      school_id: "sch-high-1",
      school_name: "テントル高校",
      branch_id: "branch-1",
      classroom: "恵比寿教室",
      level: "A" as const,
      created_at: "2026-05-04T00:00:00Z"
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    for (const s of mockStudents) {
      await db.saveStudent(s as any);
    }
  });

  it("should correctly classify grade formats across elementary, junior high, and high school", () => {
    expect(normalizeStandardGrade("小1")).toBe("小1");
    expect(normalizeStandardGrade("小学5年")).toBe("小5");
    expect(normalizeStandardGrade("5年生")).toBe("小5");
    expect(normalizeStandardGrade("elementary_6")).toBe("小6");
    expect(normalizeStandardGrade("園児")).toBe("園児");
    expect(normalizeStandardGrade("幼児")).toBe("園児");

    expect(isElementaryStudent("小5")).toBe(true);
    expect(isElementaryStudent("小学6年生")).toBe(true);
    expect(isElementaryStudent("1年生")).toBe(true);
    expect(isElementaryStudent("園児")).toBe(true);
    expect(isElementaryStudent("中2")).toBe(false);

    expect(isJuniorHighStudent("中2")).toBe(true);
    expect(isJuniorHighStudent("中学3年")).toBe(true);
    expect(isJuniorHighStudent("8年生")).toBe(true);
    expect(isJuniorHighStudent("小5")).toBe(false);

    expect(isHighSchoolStudent("高1")).toBe(true);
    expect(isHighSchoolStudent("高校2年生")).toBe(true);
    expect(isHighSchoolStudent("既卒")).toBe(true);
    expect(isHighSchoolStudent("11年生")).toBe(true);
    expect(isHighSchoolStudent("中1")).toBe(false);
  });

  it("should render both 中尾 謙信 and 鈴木 結衣 in elementary view and show Supabase debug banner", async () => {
    await act(async () => {
      render(<TeacherDashboard teacherType="elementary" />);
    });

    // 1. Check debug banner visibility
    await waitFor(() => {
      expect(screen.getByTestId("supabase-debug-banner")).toBeInTheDocument();
      expect(screen.getByText(/Supabase DB接続・生徒データ取得診断バナー/)).toBeInTheDocument();
    });

    // 2. Verify elementary students are rendered
    await waitFor(() => {
      expect(screen.getAllByText(/中尾 謙信/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/鈴木 結衣/).length).toBeGreaterThan(0);
      expect(screen.getByTestId("student-card-std-kenshin-1")).toBeInTheDocument();
      expect(screen.getByTestId("student-card-std-yui-1")).toBeInTheDocument();
    });

    // 3. Verify JHS and High school students cards are not displayed in elementary mode
    expect(screen.queryByTestId("student-card-std-taro-jhs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("student-card-std-hanako-high")).not.toBeInTheDocument();
  });

  it("should display all students across all grades and branches when all filter is selected", async () => {
    await act(async () => {
      render(<TeacherDashboard />);
    });

    // Switch to すべて (All) filter button
    const allFilterBtn = screen.getByTestId("filter-type-all");
    await act(async () => {
      fireEvent.click(allFilterBtn);
    });

    // All students cards should be visible
    await waitFor(() => {
      expect(screen.getByTestId("student-card-std-kenshin-1")).toBeInTheDocument();
      expect(screen.getByTestId("student-card-std-yui-1")).toBeInTheDocument();
      expect(screen.getByTestId("student-card-std-taro-jhs")).toBeInTheDocument();
      expect(screen.getByTestId("student-card-std-hanako-high")).toBeInTheDocument();
    });
  });
});
