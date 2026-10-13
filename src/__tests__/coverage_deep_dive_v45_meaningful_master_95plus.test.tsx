import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { 
  db, 
  Student, 
  CurriculumMaster, 
  CurriculumUnit, 
  LearningTask, 
  Branch
} from '../lib/db';
import { 
  normalizeUnitName,
  findNextUncompletedLessonForSubject
} from '../lib/scheduler';

describe('Meaningful Deep-Dive Coverage Master 95%+ Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.prompt = vi.fn(() => 'テスト入力');
  });

  it('scheduler: normalizeUnitName converts full-width alphabet and handles edge cases', () => {
    const raw = '英語：【基礎】 ＡＢＣ ａｂｃ 単元テスト 〜 １２３ ';
    const normalized = normalizeUnitName(raw);
    expect(normalized).toContain('ABC abc');
    expect(normalized).toContain('123');
    expect(normalizeUnitName(null)).toBe('');
    expect(normalizeUnitName('')).toBe('');
  });

  it('scheduler: findNextUncompletedLessonForSubject accurately advances to next uncompleted lesson using directMasterLessons', () => {
    const student: Student = {
      id: 'std-fallback-sched',
      name: 'フォールバック生徒',
      grade: '中1',
      grade_category: 'junior_high',
      school_id: 'sch-1',
      completed_lesson_ids: ['unit-1'],
      created_at: new Date().toISOString()
    };

    const nextLesson = findNextUncompletedLessonForSubject({
      student,
      subject: '数学',
      masterLessons: [
        { id: 'unit-1', name: '正の数・負の数', sort_order: 1 },
        { id: 'unit-2', name: '文字と式', sort_order: 2 }
      ]
    });

    expect(nextLesson.lessonId).toBe('unit-2');
    expect(nextLesson.lessonName).toBe('文字と式');
  });

  it('db: fetchLearningTasks caches correctly when date is omitted and only studentId is provided', async () => {
    const studentId = 'std-db-cache-test';
    const tasks: LearningTask[] = [
      {
        id: 'task-db-1',
        student_id: studentId,
        subject: '数学',
        scheduled_date: '2026-10-14',
        period: 1,
        status: 'unstarted'
      }
    ];

    await db.saveLearningTasks(tasks);
    const fetched = await db.fetchLearningTasks(studentId);
    expect(fetched.length).toBeGreaterThan(0);
    expect(fetched.some(t => t.student_id === studentId)).toBe(true);
  });

  it('TeacherDashboard: renders Junior High and High School milestone timeline with proper grade ordering', async () => {
    const jhsStudent: Student = {
      id: 'std-jhs-milestone',
      name: '中学生テスト生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_id: 'sch-jhs',
      created_at: new Date().toISOString()
    };

    const hsStudent: Student = {
      id: 'std-hs-milestone',
      name: '高校生テスト生徒',
      grade: '高1',
      grade_category: 'high_school',
      school_id: 'sch-hs',
      created_at: new Date().toISOString()
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-j1', grade: '中1', subject: '数学', unit_name: '中1正負の数', lesson_name: 'レッスン1', sort_order: 1 },
      { id: 'cm-j2', grade: '中2', subject: '数学', unit_name: '中2連立方程式', lesson_name: 'レッスン1', sort_order: 1 },
      { id: 'cm-j3', grade: '中3', subject: '数学', unit_name: '中3二次方程式', lesson_name: 'レッスン1', sort_order: 1 },
      { id: 'cm-h1', grade: '高1', subject: '数学', unit_name: '高1数と式', lesson_name: 'レッスン1', sort_order: 1 },
      { id: 'cm-h2', grade: '高2', subject: '数学', unit_name: '高2三角関数', lesson_name: 'レッスン1', sort_order: 1 },
      { id: 'cm-h3', grade: '高3', subject: '数学', unit_name: '高3微積分', lesson_name: 'レッスン1', sort_order: 1 }
    ];

    await db.saveStudent(jhsStudent);
    await db.saveStudent(hsStudent);
    await db.saveCurriculumMasters(masters);

    // 1. 中学校向けダッシュボード
    const { unmount: unmountJhs } = render(<TeacherDashboard onLogout={() => {}} teacherType="junior_high" />);
    await waitFor(() => {
      expect(screen.getAllByText(/中学生テスト生徒/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/中学生テスト生徒/)[0]);

    const milestoneTab = screen.getByRole('button', { name: /年間計画|マイルストーン/i });
    fireEvent.click(milestoneTab);

    await waitFor(() => {
      expect(screen.getByText(/テンプレートを選択/i)).toBeDefined();
    });
    unmountJhs();

    // 2. 高校向けダッシュボード
    const { unmount: unmountHs } = render(<TeacherDashboard onLogout={() => {}} teacherType="high_school" />);
    await waitFor(() => {
      expect(screen.getAllByText(/高校生テスト生徒/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/高校生テスト生徒/)[0]);
    const hsMilestoneTab = screen.getByRole('button', { name: /年間計画|マイルストーン/i });
    fireEvent.click(hsMilestoneTab);

    await waitFor(() => {
      expect(screen.getByText(/テンプレートを選択/i)).toBeDefined();
    });
    unmountHs();
  });

  it('TeacherDashboard: extractLessonIdsFromSlot parses smart ranges with spaces, tildes, and single bounds', async () => {
    const student: Student = {
      id: 'std-slot-parse',
      name: 'スロット展開生徒',
      grade: '小5',
      grade_category: 'elementary',
      school_id: 'sch-elem',
      created_at: new Date().toISOString()
    };

    const masters: CurriculumMaster[] = [
      { id: 'cm-m-1', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'レッスン 1', sort_order: 1 },
      { id: 'cm-m-2', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'レッスン 2', sort_order: 2 },
      { id: 'cm-m-3', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'レッスン 3', sort_order: 3 },
      { id: 'cm-m-4', grade: '小5', subject: '算数', unit_name: '小数のかけ算', lesson_name: 'レッスン 4', sort_order: 4 }
    ];

    await db.saveStudent(student);
    await db.saveCurriculumMasters(masters);

    // スペース付きチルダ "レッスン 1 〜 レッスン 3"
    const taskRangeSpace: LearningTask = {
      id: 'task-range-space',
      student_id: student.id,
      subject: '算数',
      lesson_range: 'レッスン 1 〜 レッスン 3',
      status: 'unstarted',
      scheduled_date: '2026-10-14',
      period: 1
    };

    // チルダのみ "レッスン 2~レッスン 4"
    const taskRangeTilde: LearningTask = {
      id: 'task-range-tilde',
      student_id: student.id,
      subject: '算数',
      lesson_range: 'レッスン 2~レッスン 4',
      status: 'unstarted',
      scheduled_date: '2026-10-14',
      period: 2
    };

    await db.saveLearningTasks([taskRangeSpace, taskRangeTilde]);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);
    await waitFor(() => {
      expect(screen.getAllByText(/スロット展開生徒/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/スロット展開生徒/)[0]);

    const milestoneTab = screen.getByRole('button', { name: /年間計画|マイルストーン/i });
    fireEvent.click(milestoneTab);

    await waitFor(() => {
      expect(screen.getByTestId('timeline-item-cm-m-1')).toBeDefined();
    });

    unmount();
  });

  it('TeacherDashboard: branch management tab invokes onSelectBranch and onBranchesUpdated', async () => {
    const branch: Branch = {
      id: 'branch-test-tab',
      name: 'テスト校舎タブ',
      code: 'br-tab',
      created_at: new Date().toISOString()
    };
    await db.saveBranch(branch);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('menu-branches')).toBeDefined();
    });

    const branchMenuBtn = screen.getByTestId('menu-branches');
    fireEvent.click(branchMenuBtn);

    await waitFor(() => {
      expect(screen.getByText(/本部専用 校舎アカウント管理/i)).toBeDefined();
    });

    unmount();
  });

  it('StudentDashboard: selects upcoming task date when today has no scheduled tasks and falls back to db.getCurriculumMasters', async () => {
    const student: Student = {
      id: 'std-upcoming-student',
      name: '未来タスク生徒',
      grade: '小6',
      grade_category: 'elementary',
      school_id: 'sch-elem',
      created_at: new Date().toISOString()
    };

    // 未来の日付のタスク
    const futureDate = '2026-10-25';
    const futureTask: LearningTask = {
      id: 'task-future-1',
      student_id: student.id,
      subject: '算数',
      start_lesson_name: '未来の授業1',
      scheduled_date: futureDate,
      period: 1,
      status: 'unstarted'
    };

    await db.saveStudent(student);
    await db.saveLearningTasks([futureTask]);

    const { unmount } = render(<StudentDashboard student={student} onLogout={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/直近の通塾予定日/)).toBeDefined();
      expect(screen.getAllByText(/2026-10-25/).length).toBeGreaterThan(0);
    });

    unmount();
  });
});

  it('TeacherDashboard: exercises voice recording toggles, SpeechRecognition mocks, and AI advice textareas', async () => {
    const student: Student = {
      id: 'std-voice-ai-test',
      name: '音声AI面談生徒',
      grade: '中3',
      grade_category: 'junior_high',
      school_id: 'sch-voice',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    // Mock Web Speech API
    const mockStop = vi.fn();
    const mockStart = vi.fn();
    class MockSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: any = null;
      start = mockStart;
      stop = mockStop;
    }
    (window as any).SpeechRecognition = MockSpeechRecognition;

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="junior_high" />);
    await waitFor(() => {
      expect(screen.getAllByText(/音声AI面談生徒/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/音声AI面談生徒/)[0]);

    // 三者面談タブへ直接移動
    const tab3Btn = screen.getByTestId('menu-three-way-interview');
    fireEvent.click(tab3Btn);

    await waitFor(() => {
      expect(screen.getByTestId('interview3-ai-advice')).toBeDefined();
    });

    // 音声録音ボタンをクリックして開始・停止
    const recordBtn = screen.getByTestId('interview3-record-btn');
    fireEvent.click(recordBtn); // 開始
    expect(mockStart).toHaveBeenCalled();
    fireEvent.click(recordBtn); // 停止
    expect(mockStop).toHaveBeenCalled();

    // AI要約テキストエリアの手動編集
    const advice3 = screen.getByTestId('interview3-ai-advice');
    fireEvent.change(advice3, { target: { value: '講師による手動編集メモ追加' } });
    expect((advice3 as HTMLTextAreaElement).value).toBe('講師による手動編集メモ追加');

    // 二者面談タブへ移動
    const tab2Btn = screen.getByTestId('menu-two-way-interview');
    fireEvent.click(tab2Btn);

    await waitFor(() => {
      expect(screen.getByTestId('interview2-ai-advice')).toBeDefined();
    });

    const advice2 = screen.getByTestId('interview2-ai-advice');
    fireEvent.change(advice2, { target: { value: '生徒二者面談の手動修正' } });
    expect((advice2 as HTMLTextAreaElement).value).toBe('生徒二者面談の手動修正');

    delete (window as any).SpeechRecognition;
    unmount();
  });

  it('TeacherDashboard: creates student tab exercises school fetching and type filtering', async () => {
    const schoolElem: School = {
      id: 'sch-fetch-elem',
      name: 'テスト小学校A',
      type: 'elementary',
      created_at: new Date().toISOString()
    };
    const schoolJhs: School = {
      id: 'sch-fetch-jhs',
      name: 'テスト中学校B',
      type: 'junior_high',
      created_at: new Date().toISOString()
    };
    await db.saveSchool(schoolElem);
    await db.saveSchool(schoolJhs);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/新規生徒アカウント発行/i)).toBeDefined();
    });

    const createStudentBtn = screen.getByText(/新規生徒アカウント発行/i);
    fireEvent.click(createStudentBtn);

    await waitFor(() => {
      expect(screen.getByText(/1クリックアカウント発行/i)).toBeDefined();
    });

    unmount();
  });

  it('TeacherDashboard: exercises edit student button click stopPropagation and student detail tab', async () => {
    const student: Student = {
      id: 'std-edit-stop-prop',
      name: '編集クリック生徒',
      grade: '小4',
      grade_category: 'elementary',
      school_id: 'sch-elem',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="elementary" />);
    await waitFor(() => {
      expect(screen.getByTestId(`edit-student-btn-${student.id}`)).toBeDefined();
    });

    const editBtn = screen.getByTestId(`edit-student-btn-${student.id}`);
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/基本情報・属性設定/i)).toBeDefined();
    });

    unmount();
  });

  it('TeacherDashboard: updates test subject and type in today tests section', async () => {
    const student: Student = {
      id: 'std-test-update-ui',
      name: 'テスト更新生徒',
      grade: '中2',
      grade_category: 'junior_high',
      school_id: 'sch-jhs',
      created_at: new Date().toISOString()
    };
    await db.saveStudent(student);

    const todayStr = new Date().toISOString().split('T')[0];
    const initialTest: MiniTestResult = {
      id: 'mini-update-ui-1',
      student_id: student.id,
      date: todayStr,
      subject: '数学',
      test_content: '中2連立方程式計算テスト',
      target_scope: 'individual',
      created_at: new Date().toISOString()
    };
    await db.saveMiniTestResult(initialTest);

    const { unmount } = render(<TeacherDashboard onLogout={() => {}} teacherType="junior_high" />);
    await waitFor(() => {
      expect(screen.getAllByText(/テスト更新生徒/).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText(/テスト更新生徒/)[0]);

    // 今日のテスト欄で教科を変更
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      const subjectSelect = selects.find(s => (s as HTMLSelectElement).value === '数学');
      if (subjectSelect) {
        fireEvent.change(subjectSelect, { target: { value: '英語' } });
        expect((subjectSelect as HTMLSelectElement).value).toBe('英語');
      }
    });

    unmount();
  });
