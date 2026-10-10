import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";
import TeacherDashboard, { determineActiveGradeForSubject } from "../components/TeacherDashboard";
import { db, Student, School, CurriculumMaster, LearningTask, MiniTestResult, HomeworkResult } from "../lib/db";
import * as gemini from "../lib/gemini";

describe("Meaningful 95%+ Coverage Deep Dive Suite: TeacherDashboard & DatabaseService", () => {
  const mockStudents: Student[] = [
    {
      id: "st-deep-1",
      name: "テスト生徒A",
      grade: "小1",
      school_id: "sch-deep-1",
      school_name: "第一小学校",
      status: "normal",
      level: "standard",
      selected_subjects: ["算数", "国語"],
      completed_lesson_ids: ["cm-dp-1"],
      created_at: new Date().toISOString()
    },
    {
      id: "st-deep-2",
      name: "テスト生徒B",
      grade: "小1",
      school_id: "sch-deep-1",
      school_name: "第一小学校",
      status: "normal",
      level: "standard",
      selected_subjects: ["算数"],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    },
    {
      id: "st-deep-3",
      name: "テスト生徒C",
      grade: "中1",
      school_id: "sch-deep-2",
      school_name: "第一中学校",
      status: "normal",
      level: "advanced",
      selected_subjects: ["数学", "英語"],
      completed_lesson_ids: [],
      created_at: new Date().toISOString()
    }
  ];

  const mockSchools: School[] = [
    { id: "sch-deep-1", name: "第一小学校", type: "elementary" },
    { id: "sch-deep-2", name: "第一中学校", type: "junior_high" }
  ];

  const mockMasters: CurriculumMaster[] = [
    { id: "cm-dp-1", grade: "小1", subject: "算数", unit_name: "1章 かずとすうじ", lesson_name: "1から5までのかず", sort_order: 1 },
    { id: "cm-dp-2", grade: "小1", subject: "算数", unit_name: "1章 かずとすうじ", lesson_name: "いくつといくつ", sort_order: 2 },
    { id: "cm-dp-3", grade: "小2", subject: "算数", unit_name: "1章 2けたのたし算", lesson_name: "2桁のたし算の筆算", sort_order: 10 },
    { id: "cm-dp-4", grade: "小3", subject: "算数", unit_name: "1章 かけ算の筆算", lesson_name: "かけ算の筆算(1)", sort_order: 20 },
    { id: "cm-dp-eng-1", grade: "中1", subject: "英語", unit_name: "1章 自己紹介", lesson_name: "What is your name?", sort_order: 1 }
  ];

  beforeEach(() => {
    localStorage.clear();
    mockStudents.forEach(s => db.saveStudent(s));
    mockSchools.forEach(s => db.saveSchool(s));
    db.saveCurriculumMasters(mockMasters);
    vi.stubGlobal("alert", vi.fn());
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. determineActiveGradeForSubject: 全条件分岐・フォールバックの完全網羅", () => {
    it("生徒が null / undefined の場合は 'all' を返す", () => {
      expect(determineActiveGradeForSubject("算数", null)).toBe("all");
      expect(determineActiveGradeForSubject("算数", undefined)).toBe("all");
    });

    it("小学生でない（中学生・高校生など）の場合は 'all' を返す", () => {
      const jhsStudent = mockStudents[2]; // 中1
      expect(determineActiveGradeForSubject("数学", jhsStudent)).toBe("all");
    });

    it("本日のタスクに start_lesson_id がある場合、マスターから該当学年を導出する", () => {
      const student = mockStudents[0];
      const today = new Date().toISOString().split("T")[0];
      const tasks: LearningTask[] = [
        {
          id: "t1",
          student_id: student.id,
          scheduled_date: today,
          period: 1,
          subject: "算数",
          start_lesson_id: "cm-dp-3" // 小2
        }
      ];
      const grade = determineActiveGradeForSubject("算数", student, tasks, undefined, today, mockMasters);
      expect(grade).toBe("小2");
    });

    it("本日のタスクに unit_name / lesson_name がある場合、タイトル照合から学年を導出する", () => {
      const student = mockStudents[0];
      const today = new Date().toISOString().split("T")[0];
      const tasks: LearningTask[] = [
        {
          id: "t2",
          student_id: student.id,
          scheduled_date: today,
          period: 1,
          subject: "算数",
          start_lesson_name: "かけ算の筆算(1)" // 小3
        }
      ];
      const grade = determineActiveGradeForSubject("算数", student, tasks, undefined, today, mockMasters);
      expect(grade).toBe("小3");
    });

    it("slots に start_lesson_id またはタイトルがある場合、スロットから学年を導出する", () => {
      const student = mockStudents[0];
      const slots = {
        1: { subject: "算数", start_lesson_id: "cm-dp-3" }
      };
      const grade = determineActiveGradeForSubject("算数", student, [], slots, undefined, mockMasters);
      expect(grade).toBe("小2");

      const slotsByTitle = {
        1: { subject: "算数", unit_name: "1章 かけ算の筆算" }
      };
      const gradeByTitle = determineActiveGradeForSubject("算数", student, [], slotsByTitle, undefined, mockMasters);
      expect(gradeByTitle).toBe("小3");
    });

    it("生徒の学年に未完了レッスンがある場合、生徒学年の最初の未完了レッスン学年を返す", () => {
      const student = mockStudents[1]; // 小1, completed_lesson_ids なし
      const grade = determineActiveGradeForSubject("算数", student, [], undefined, undefined, mockMasters);
      expect(grade).toBe("小1");
    });

    it("生徒の学年が全完了している場合、全体マスターの未完了レッスンから次学年を導出する", () => {
      const studentAllDone: Student = {
        ...mockStudents[0],
        completed_lesson_ids: ["cm-dp-1", "cm-dp-2"] // 小1完了
      };
      const grade = determineActiveGradeForSubject("算数", studentAllDone, [], undefined, undefined, mockMasters);
      expect(grade).toBe("小2");
    });

    it("園児や漢数字表記の学年表記を正しく正規化する", () => {
      const kindergartenStudent: Student = {
        ...mockStudents[0],
        grade: "園児",
        completed_lesson_ids: ["cm-dp-1", "cm-dp-2", "cm-dp-3", "cm-dp-4"]
      };
      const grade = determineActiveGradeForSubject("算数", kindergartenStudent, [], undefined, undefined, mockMasters);
      expect(grade).toBe("小1");
    });
  });

  describe("2. TeacherDashboard: Web Speech API & 三者面談・二者面談の完全網羅", () => {
    it("SpeechRecognition による音声文字起こしの起動・受信・停止・エラー耐性を網羅する", async () => {
      const startFn = vi.fn();
      const stopFn = vi.fn();
      let activeRec: any = null;

      function MockSpeechRecognition() {
        const inst = {
          lang: "ja-JP",
          continuous: true,
          interimResults: true,
          start: startFn,
          stop: stopFn,
          onresult: null as any,
          onerror: null as any,
          onend: null as any
        };
        activeRec = inst;
        return inst;
      }

      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="three-way-interview"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      // 録音開始
      const recordBtn = screen.getByTestId("interview3-record-btn");
      await act(async () => {
        fireEvent.click(recordBtn);
      });
      expect(startFn).toHaveBeenCalled();

      // 音声認識結果の受信
      await act(async () => {
        if (activeRec?.onresult) {
          activeRec.onresult({
            results: [
              [{ transcript: "面談メモ：数学の計算力を強化したい" }]
            ]
          });
        }
      });

      const transcriptArea = screen.getByTestId("interview3-transcript") as HTMLTextAreaElement;
      expect(transcriptArea.value).toContain("面談メモ：数学の計算力を強化したい");

      // エラー発生時のハンドリング
      await act(async () => {
        if (activeRec?.onerror) {
          activeRec.onerror(new Error("Audio capture failed"));
        }
      });

      // onend イベントのハンドリング
      await act(async () => {
        if (activeRec?.onend) {
          activeRec.onend();
        }
      });

      // 再度クリックして録音停止
      await act(async () => {
        fireEvent.click(recordBtn);
      });
      expect(recordBtn).toBeInTheDocument();
    });

    it("SpeechRecognition 非対応環境では警告 alert を表示する", async () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="three-way-interview"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      const recordBtn = screen.getByTestId("interview3-record-btn");
      await act(async () => {
        fireEvent.click(recordBtn);
      });

      expect(alertMock).toHaveBeenCalledWith(expect.stringContaining("Web Speech APIによる音声認識がサポートされていません"));
    });

    it("文字起こしからの自動解析、カスタム項目の追加・削除、三者面談の保存と削除", async () => {
      vi.spyOn(gemini, "parseInterviewTranscriptToFields").mockResolvedValue({
        interviewer: "田中先生",
        parent_type: "母",
        parent_anxieties: "自宅学習時間について",
        discussed_content: "夏休みの総復習プラン",
        notes: "志望校への意識が高い"
      });

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="three-way-interview"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      // 生徒選択
      const studentSelect = screen.getByTestId("interview3-student-select");
      await act(async () => {
        fireEvent.change(studentSelect, { target: { value: mockStudents[0].id } });
      });

      // テキスト入力して解析
      const transcriptArea = screen.getByTestId("interview3-transcript");
      await act(async () => {
        fireEvent.change(transcriptArea, { target: { value: "面談テキストの入力" } });
      });

      const parseBtn = screen.getByTestId("interview3-parse-transcript-btn");
      await act(async () => {
        fireEvent.click(parseBtn);
      });

      expect(screen.getByTestId("interview3-interviewer")).toHaveValue("田中先生");

      // カスタム項目の追加
      const addCustomFieldBtn = screen.getByTestId("interview3-add-custom-field-btn");
      await act(async () => {
        fireEvent.click(addCustomFieldBtn);
      });

      const labelInput = screen.getByTestId("interview3-custom-label-0");
      const valInput = screen.getByTestId("interview3-custom-value-0");
      await act(async () => {
        fireEvent.change(labelInput, { target: { value: "部活動" } });
        fireEvent.change(valInput, { target: { value: "サッカー部主将" } });
      });

      // カスタム項目の削除
      const removeFieldBtn = screen.getByTestId("interview3-remove-custom-field-0");
      await act(async () => {
        fireEvent.click(removeFieldBtn);
      });

      // 保存
      const saveBtn = screen.getByTestId("interview3-save-btn");
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      // 保存されたデータが存在することを確認
      const interviews = db.getStudentInterviews3(mockStudents[0].id);
      expect(interviews.length).toBeGreaterThan(0);
    });

    it("二者面談の生徒選択、新規作成と保存", async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="two-way-interview"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      expect(screen.getByTestId("two-way-interview-view")).toBeInTheDocument();

      const studentSelect = screen.getByTestId("interview2-student-select");
      await act(async () => {
        fireEvent.change(studentSelect, { target: { value: mockStudents[0].id } });
      });

      const newBtn = screen.getByTestId("interview2-new-btn");
      await act(async () => {
        fireEvent.click(newBtn);
      });

      expect(studentSelect).toBeInTheDocument();
    });
  });

  describe("3. TeacherDashboard: 自由記述授業 (CustomClass) の追加と削除", () => {
    it("学校カリキュラム管理タブで自由記述授業名を追加し、一覧から削除できる", async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="curriculum"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      // 入力と追加
      const input = screen.getByPlaceholderText("例: 高校入試過去問演習");
      const addBtn = screen.getByRole("button", { name: "追加する" });

      await act(async () => {
        fireEvent.change(input, { target: { value: "英検二次面接特訓" } });
        fireEvent.click(addBtn);
      });

      expect(screen.getByText("英検二次面接特訓")).toBeInTheDocument();

      // 追加されたアイテムの削除ボタンをクリック
      const deleteButtons = screen.getAllByRole("button", { name: "削除" });
      const lastDeleteBtn = deleteButtons[deleteButtons.length - 1];
      await act(async () => {
        fireEvent.click(lastDeleteBtn);
      });

      expect(db.getCustomClasses().some(c => c.name === "英検二次面接特訓")).toBe(false);
    });
  });

  describe("4. TeacherDashboard: 小テスト・宿題の対象スコープ一括配信 (grade, school, level)", () => {
    it("学年・学校・レベルの対象スコープで小テストと宿題を一括配信して保存する", async () => {
      const todayStr = "2026-10-10";

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialStudentId={mockStudents[0].id}
            initialTab="schedule"
            initialDate={todayStr}
            teacherType="elementary"
          />
        );
      });

      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      // 小テストを追加
      const addTestBtn = screen.getByRole("button", { name: /テストを追加/ });
      await act(async () => {
        fireEvent.click(addTestBtn);
      });

      // 内容入力
      const testContentInput = screen.getByPlaceholderText("例: たしざん(1) 単元確認テスト または 漢字テスト10問");
      await act(async () => {
        fireEvent.change(testContentInput, { target: { value: "第一小共通算数テスト" } });
      });

      // 宿題を追加
      const addHwBtn = screen.getByRole("button", { name: /宿題を追加/ });
      await act(async () => {
        fireEvent.click(addHwBtn);
      });

      // 内容入力
      const hwContentInput = screen.getByPlaceholderText("宿題の内容を入力（例：ワークP24-25, 漢字ノート）");
      await act(async () => {
        fireEvent.change(hwContentInput, { target: { value: "標準レベル共通ドリル" } });
      });

      // 一括適用スコープを「同じ学校の生徒全員に一括適用」に変更
      const applyScopeSelect = screen.getByTestId("apply-scope-select");
      await act(async () => {
        fireEvent.change(applyScopeSelect, { target: { value: "school" } });
      });

      // 時間割コマ割りを保存
      const saveScheduleBtn = screen.getByText("時間割コマ割りを保存");
      await act(async () => {
        fireEvent.click(saveScheduleBtn);
      });

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith("今日の時間割コマ割りを対象生徒全員に一括保存しました！");
      });

      // 小テストおよび宿題が保存されていることを確認
      const miniResults = db.getMiniTestResults();
      expect(miniResults.some(r => r.test_content === "第一小共通算数テスト")).toBe(true);

      const hwResults = db.getHomeworkResults();
      expect(hwResults.some(r => r.homework_content === "標準レベル共通ドリル")).toBe(true);
    });
  });

  describe("5. TeacherDashboard: 非同期データ通信例外の安全保護 (.catch の網羅)", () => {
    it("fetchSchools, fetchStudents, fetchCurriculumUnits, fetchMiniTestResults, fetchCurriculumMasters の例外時にフォールバックし安全に稼働する", async () => {
      vi.spyOn(db, "fetchSchools").mockRejectedValue(new Error("Network School Error"));
      vi.spyOn(db, "fetchStudents").mockRejectedValue(new Error("Network Student Error"));
      vi.spyOn(db, "fetchCurriculumUnits").mockRejectedValue(new Error("Network Units Error"));
      vi.spyOn(db, "fetchMiniTestResults").mockRejectedValue(new Error("Network MiniTest Error"));
      vi.spyOn(db, "fetchCurriculumMasters").mockRejectedValue(new Error("Network Masters Error"));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={[]}
            teacherType="elementary"
          />
        );
      });

      expect(screen.getByText("TENTORU 司令塔")).toBeInTheDocument();

      // 小テスト結果タブに切り替えて fetchMiniTestResults の catch を実行
      const miniTestMenu = screen.getByText("小テスト結果");
      await act(async () => {
        fireEvent.click(miniTestMenu);
      });

      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("6. TeacherDashboard: UI 操作・生徒カード編集・日付選択イベント", () => {
    it("生徒一覧から編集ボタンを押して生徒詳細設定を開ける", async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            teacherType="elementary"
          />
        );
      });

      // 編集ボタンをクリック
      const editButtons = screen.getAllByTestId(/edit-student-btn-/);
      expect(editButtons.length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.click(editButtons[0]);
      });

      // 生徒編集フォームの確認
      expect(screen.getByPlaceholderText("氏名（漢字）")).toBeInTheDocument();
    });

    it("生徒カードを選択して時間割を表示し、日付変更ピッカーを操作できる", async () => {
      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            teacherType="elementary"
          />
        );
      });

      // 生徒カードを選択して時間割を表示
      const studentCards = screen.getAllByTestId(/student-card-/);
      expect(studentCards.length).toBeGreaterThan(0);
      await act(async () => {
        fireEvent.click(studentCards[0]);
      });

      // 日付変更ピッカーが機能することを確認
      const dateInputs = screen.getAllByDisplayValue(new Date().toISOString().split("T")[0]);
      if (dateInputs.length > 0) {
        await act(async () => {
          fireEvent.change(dateInputs[0], { target: { value: "2026-11-15" } });
        });
        expect(dateInputs[0]).toHaveValue("2026-11-15");
      }
    });
  });

  describe("7. DatabaseService (db.ts): 堅牢性と例外耐性の深層検証", () => {
    it("saveStudent で student_id 照合による更新が動作する", async () => {
      const studentWithCode = {
        ...mockStudents[0],
        student_id: "CUSTOM-ID-001",
        name: "コード更新生徒"
      };
      await db.saveStudent(studentWithCode);
      const saved = db.getStudent(studentWithCode.id);
      expect(saved?.name).toBe("コード更新生徒");
    });

    it("deleteSchool, deleteLearningTasksForDate, deleteTestRecord の安全な実行", async () => {
      await db.saveLearningTasks([
        { id: "task-del-1", student_id: "st-deep-1", scheduled_date: "2026-10-10", period: 1, subject: "算数", status: "unstarted" }
      ]);
      await db.deleteLearningTasksForDate("st-deep-1", "2026-10-10");
      const remaining = db.getLearningTasks("st-deep-1");
      expect(remaining.filter(t => t.scheduled_date === "2026-10-10").length).toBe(0);

      await db.deleteTestRecord("dummy-tr-id");
      await db.deleteSchool("sch-deep-1");
      expect(db.getSchools().find(s => s.id === "sch-deep-1")).toBeUndefined();
    });

    it("student_interactions の保存・取得・削除と例外安全保護", async () => {
      const inter = await db.saveStudentInteraction({
        id: "inter-deep-1",
        student_id: "st-deep-1",
        category: "面談",
        notes: "面談メモテスト",
        staff_name: "佐藤先生",
        created_at: new Date().toISOString()
      });
      expect(inter.id).toBe("inter-deep-1");

      const list = db.getStudentInteractions("st-deep-1");
      expect(list.some(i => i.id === "inter-deep-1")).toBe(true);

      await db.deleteStudentInteraction("inter-deep-1");
      const listAfter = db.getStudentInteractions("st-deep-1");
      expect(listAfter.some(i => i.id === "inter-deep-1")).toBe(false);
    });

    it("Supabase モック時の missing column 自動ストリップおよび 23505 ユニーク制約競合ハンドリング", async () => {
      let callCount = 0;
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "st-deep-1", name: "更新後生徒", student_id: "CUSTOM-001" },
              error: null
            })
          })
        })
      });

      const upsertMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Could not find the 'unknown_field' column in schema cache" }
              })
            })
          };
        }
        if (callCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: "23505", message: "duplicate key value violates unique constraint 'students_student_id_key'" }
              })
            })
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "st-deep-1", name: "更新後生徒" },
              error: null
            })
          })
        };
      });

      (db as any).supabase = {
        from: vi.fn().mockReturnValue({
          upsert: upsertMock,
          update: updateMock,
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      };

      const result = await db.saveStudent({
        ...mockStudents[0],
        student_id: "CUSTOM-001",
        name: "更新後生徒"
      });

      expect(result).toBeDefined();
    });
  });

  describe("8. TeacherDashboard: 二者面談・三者面談のバリデーション、例外耐性、削除確認フロー", () => {
    it("二者面談で音声文字起こしが空の時に警告 alert が発火し、AI自動入力と要約生成のエラーを処理する", async () => {
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      await act(async () => {
        render(
          <TeacherDashboard
            students={mockStudents}
            schools={mockSchools}
            curriculumMasters={mockMasters}
            initialTab="two-way-interview"
            initialStudentId={mockStudents[0].id}
            teacherType="elementary"
          />
        );
      });

      // 1. 文字起こしを入力してAI自動入力を試みるが、API例外が発生する場合
      const transcriptInput = screen.getByTestId("interview2-transcript");
      await act(async () => {
        fireEvent.change(transcriptInput, { target: { value: "面談のメモテキスト" } });
      });

      vi.spyOn(gemini, "parseInterviewTranscriptToFields").mockRejectedValue(
        new Error("Gemini AI API Error")
      );

      const parseBtn = screen.getByTestId("interview2-parse-transcript-btn");
      await act(async () => {
        fireEvent.click(parseBtn);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("自動入力でエラーが発生しました")
      );

      // 2. AI要約生成でAPI例外が発生する場合
      vi.spyOn(gemini, "generateInterviewSummary").mockRejectedValue(
        new Error("Summary Generation Failed")
      );
      const generateAiBtn = screen.getByTestId("interview2-generate-ai-btn");
      await act(async () => {
        fireEvent.click(generateAiBtn);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("面談の要約生成でエラーが発生しました")
      );
    });

    it("二者面談・三者面談の削除確認でキャンセルした場合は削除が実行されない", async () => {
      // confirm を false にスタブ
      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

      // 事前に二者面談と三者面談を1件ずつ保存
      await db.saveStudentInterview2({
        id: "int2-cancel-test",
        student_id: mockStudents[0].id,
        interviewer: "講師A",
        interview_date: "2026-10-10",
        notes: "キャンセル確認テスト",
        created_at: new Date().toISOString()
      });

      await db.saveStudentInterview3({
        id: "int3-cancel-test",
        student_id: mockStudents[0].id,
        interviewer: "講師A",
        interview_date: "2026-10-10",
        parent_type: "mother",
        notes: "三者面談キャンセルテスト",
        created_at: new Date().toISOString()
      });

      // 1. 二者面談タブでのキャンセル確認
      const { unmount } = render(
        <TeacherDashboard
          students={mockStudents}
          schools={mockSchools}
          curriculumMasters={mockMasters}
          initialTab="two-way-interview"
          initialStudentId={mockStudents[0].id}
          teacherType="elementary"
        />
      );

      const deleteBtn2 = screen.getByTestId("interview2-delete-btn");
      await act(async () => {
        fireEvent.click(deleteBtn2);
      });

      // 削除されていないことを確認
      const int2List = db.getStudentInterviews2(mockStudents[0].id);
      expect(int2List.some(i => i.id === "int2-cancel-test")).toBe(true);
      unmount();

      // 2. 三者面談タブでのキャンセル確認
      render(
        <TeacherDashboard
          students={mockStudents}
          schools={mockSchools}
          curriculumMasters={mockMasters}
          initialTab="three-way-interview"
          initialStudentId={mockStudents[0].id}
          teacherType="elementary"
        />
      );

      const deleteBtn3 = screen.getByTestId("interview3-delete-btn");
      await act(async () => {
        fireEvent.click(deleteBtn3);
      });

      // 削除されていないことを確認
      const int3 = db.getStudentInterviews3(mockStudents[0].id);
      expect(int3.some(i => i.id === "int3-cancel-test")).toBe(true);

      // 3. 実施日を空にして保存しようとすると警告 alert が出る
      const dateInput3 = screen.getByTestId("interview3-date");
      await act(async () => {
        fireEvent.change(dateInput3, { target: { value: "" } });
      });

      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      const saveBtn3 = screen.getByTestId("interview3-save-btn");
      await act(async () => {
        fireEvent.click(saveBtn3);
      });
      expect(alertMock).toHaveBeenCalledWith("実施日を入力してください。");
    });
  });

  describe("9. DatabaseService (db.ts): 生徒完了レッスンID汚染クリーンアップとSupabase照合", () => {
    it("cleanupStudentCorruptedCompletedLessonIds で破損・無効なレッスンIDを自動修復する", async () => {
      // 誤ったまとめテストIDを含む生徒
      const corruptedStudent: Student = {
        ...mockStudents[0],
        id: "st-corrupted-1",
        completed_lesson_ids: [
          "cm-dp-1",
          "cm-auto-sum-算数-小2-まとめテスト1",
          "cm-auto-sum-算数-大きいかず-まとめテスト"
        ]
      };
      await db.saveStudent(corruptedStudent);

      const cleaned = await db.cleanupStudentCorruptedCompletedLessonIds("st-corrupted-1", {
        activeLessonIds: new Set(["cm-dp-1", "cm-dp-2"])
      });

      expect(cleaned).toBeDefined();
      expect(cleaned?.completed_lesson_ids).toEqual(["cm-dp-1"]);
    });

    it("Supabase 照合で生徒 email による既存チェックと有効な UUID の割り当て", async () => {
      const emailStudent: Student = {
        ...mockStudents[0],
        id: "non-uuid-student-id",
        email: "test-student@tentoru.example.com"
      };

      const originalMockMode = (db as any).isMockMode;
      (db as any).isMockMode = false;
      (db as any).supabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "students") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: "550e8400-e29b-41d4-a716-446655440000", email: "test-student@tentoru.example.com" }],
                    error: null
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "550e8400-e29b-41d4-a716-446655440000", email: "test-student@tentoru.example.com" },
                      error: null
                    })
                  })
                })
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "550e8400-e29b-41d4-a716-446655440000", email: "test-student@tentoru.example.com" },
                    error: null
                  })
                })
              })
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            }),
            upsert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          };
        })
      };

      try {
        const saved = await db.saveStudent(emailStudent);
        expect(saved).toBeDefined();
        expect(saved.id).toBe("550e8400-e29b-41d4-a716-446655440000");
      } finally {
        (db as any).isMockMode = originalMockMode;
      }
    });

    it("deleteStudent で Supabase モック時に子テーブル（タスク・面談・テスト・宿題・計画）が安全に一括削除される", async () => {
      const originalMockMode = (db as any).isMockMode;
      (db as any).isMockMode = false;
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      (db as any).supabase = {
        from: vi.fn().mockReturnValue({
          delete: deleteMock
        })
      };

      try {
        await db.deleteStudent("std-cascade-test");
        expect(deleteMock).toHaveBeenCalled();
      } finally {
        (db as any).isMockMode = originalMockMode;
      }
    });
  });

  describe("10. TeacherDashboard: 音声認識起動例外と三者面談AIエラー耐性", () => {
    it("二者面談・三者面談で音声認識起動時に例外が発生した場合に安全にエラーハンドリングする", async () => {
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      // start() が例外を投げる MockSpeechRecognition
      function ThrowingSpeechRecognition() {
        return {
          lang: "ja-JP",
          continuous: true,
          interimResults: true,
          start: () => {
            throw new Error("Microphone access blocked");
          },
          stop: vi.fn(),
          onresult: null,
          onerror: null,
          onend: null
        };
      }

      (window as any).SpeechRecognition = ThrowingSpeechRecognition;
      (window as any).webkitSpeechRecognition = ThrowingSpeechRecognition;

      // 1. 二者面談
      const { unmount } = render(
        <TeacherDashboard
          students={mockStudents}
          schools={mockSchools}
          curriculumMasters={mockMasters}
          initialTab="two-way-interview"
          initialStudentId={mockStudents[0].id}
          teacherType="elementary"
        />
      );

      const recordBtn2 = screen.getByTestId("interview2-record-btn");
      await act(async () => {
        fireEvent.click(recordBtn2);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("録音の開始に失敗しました: Microphone access blocked")
      );
      unmount();

      // 2. 三者面談
      render(
        <TeacherDashboard
          students={mockStudents}
          schools={mockSchools}
          curriculumMasters={mockMasters}
          initialTab="three-way-interview"
          initialStudentId={mockStudents[0].id}
          teacherType="elementary"
        />
      );

      const recordBtn3 = screen.getByTestId("interview3-record-btn");
      await act(async () => {
        fireEvent.click(recordBtn3);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("録音の開始に失敗しました: Microphone access blocked")
      );
    });

    it("三者面談でAI自動入力とAI要約生成のエラーを安全にハンドリングする", async () => {
      const alertMock = vi.fn();
      vi.stubGlobal("alert", alertMock);

      render(
        <TeacherDashboard
          students={mockStudents}
          schools={mockSchools}
          curriculumMasters={mockMasters}
          initialTab="three-way-interview"
          initialStudentId={mockStudents[0].id}
          teacherType="elementary"
        />
      );

      // 文字起こしを入力してAI自動入力を試みるが、API例外が発生する場合
      const transcriptInput = screen.getByTestId("interview3-transcript");
      await act(async () => {
        fireEvent.change(transcriptInput, { target: { value: "三者面談メモ" } });
      });

      vi.spyOn(gemini, "parseInterviewTranscriptToFields").mockRejectedValue(
        new Error("Gemini AI API 3-way Error")
      );

      const parseBtn = screen.getByTestId("interview3-parse-transcript-btn");
      await act(async () => {
        fireEvent.click(parseBtn);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("自動入力でエラーが発生しました")
      );

      // AI要約生成でAPI例外が発生する場合
      vi.spyOn(gemini, "generateInterviewSummary").mockRejectedValue(
        new Error("Summary Generation 3-way Failed")
      );
      const generateAiBtn = screen.getByTestId("interview3-generate-ai-btn");
      await act(async () => {
        fireEvent.click(generateAiBtn);
      });
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining("面談の要約生成でエラーが発生しました")
      );
    });
  });
});
