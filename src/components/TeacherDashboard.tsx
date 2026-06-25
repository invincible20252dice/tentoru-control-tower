import React, { useState, useEffect, useRef } from 'react';
import styles from './TeacherDashboard.module.css';
import { 
  db, 
  Student, 
  School, 
  CurriculumUnit, 
  LearningTask, 
  LearningLog, 
  TestRecord, 
  SchoolCodeMaster, 
  ExamThresholdMaster, 
  AIReport, 
  PromptSetting,
  TeacherCorrectionLog,
  MiniTestResult,
  HomeworkResult,
  MilestonePlan,
  MilestoneTemplate,
  GRADES,
  StudentInteraction,
  getSchoolYear
} from '../lib/db';
import { 
  rescheduleDelayedTasks, 
  reorganizeFutureTasks, 
  calculateMockExamPassRate, 
  learnFromTeacherCorrections, 
  generateAIReportText,
  PersonalStyle,
  calculateProgressGap,
  getYearMonthWeek
} from '../lib/scheduler';
import html2canvas from 'html2canvas';

interface TeacherDashboardProps {
  onBackToPortal: () => void;
  theme?: 'light' | 'dark';
}

export default function TeacherDashboard({ onBackToPortal, theme = 'light' }: TeacherDashboardProps) {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'curriculum' | 'mini-tests' | 'homeworks' | 'tests' | 'ai-report' | 'milestones' | 'student-list' | 'create-student' | 'student-detail'>('student-list');
  const [milestonePlans, setMilestonePlans] = useState<MilestonePlan[]>([]);

  // 生徒詳細（生徒情報）画面用 State
  const [interactions, setInteractions] = useState<StudentInteraction[]>([]);
  const [personalityOptions, setPersonalityOptions] = useState<string[]>([]);
  const [interactionCategory, setInteractionCategory] = useState<'保護者対応' | '人生相談' | '勉強相談' | '学校相談' | 'その他'>('その他');
  const [interactionMemo, setInteractionMemo] = useState('');
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPersonalityInput, setNewPersonalityInput] = useState('');
  const [selectedPersonalityFromMaster, setSelectedPersonalityFromMaster] = useState('');
  const [editForm, setEditForm] = useState<Partial<Student>>({});
  const [allCurriculumUnits, setAllCurriculumUnits] = useState<CurriculumUnit[]>([]);

  // レベル別・テンプレート機能用 State
  const [newStudentLevel, setNewStudentLevel] = useState<'A' | 'B' | 'C'>('A');
  const [selectedLevel, setSelectedLevel] = useState<'A' | 'B' | 'C'>('A');
  const [milestoneTemplates, setMilestoneTemplates] = useState<MilestoneTemplate[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState('');
  const [addMonth, setAddMonth] = useState<number>(4);
  const [addWeek, setAddWeek] = useState<number>(1);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<'all' | number>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // 検索フィルター用のState
  const [filterSchoolId, setFilterSchoolId] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'junior_high' | 'elementary'>('all');
  const [filterName, setFilterName] = useState<string>('');

  // Account Issuance State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('中1');
  const [newStudentSchoolId, setNewStudentSchoolId] = useState('');

  // Curriculum State
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('数学');
  const [schoolUnits, setSchoolUnits] = useState<CurriculumUnit[]>([]);

  // Daily Scheduler State
  const [scheduleDate, setScheduleDate] = useState('2026-06-19');
  const [studentTasks, setStudentTasks] = useState<LearningTask[]>([]);
  
  // 各コマの選択状態：教科、単元ID、カスタムテーマ
  const [periodSelections, setPeriodSelections] = useState<Record<number, { subject: string; unitId: string; customTheme: string; }>>({
    1: { subject: '', unitId: '', customTheme: '' },
    2: { subject: '', unitId: '', customTheme: '' },
    3: { subject: '', unitId: '', customTheme: '' },
    4: { subject: '', unitId: '', customTheme: '' },
    5: { subject: '', unitId: '', customTheme: '' },
    6: { subject: '', unitId: '', customTheme: '' },
    7: { subject: '', unitId: '', customTheme: '' },
    8: { subject: '', unitId: '', customTheme: '' },
    9: { subject: '', unitId: '', customTheme: '' },
    10: { subject: '', unitId: '', customTheme: '' }
  });
  const [periodCount, setPeriodCount] = useState<number>(2);
  const [commonOfficeNote, setCommonOfficeNote] = useState<string>('');

  // 宿題・テスト用の State
  const [todayTests, setTodayTests] = useState<{ id: string; content: string }[]>([]);
  const [todayHomeworks, setTodayHomeworks] = useState<{ id: string; content: string; deadline: string }[]>([]);

  // 小テスト結果リスト
  const [miniTestResultsList, setMiniTestResultsList] = useState<MiniTestResult[]>([]);
  const [tempScores, setTempScores] = useState<Record<string, string>>({});

  // 宿題提出状況リスト
  const [homeworkResultsList, setHomeworkResultsList] = useState<HomeworkResult[]>([]);
  const [tempHomeworkStatuses, setTempHomeworkStatuses] = useState<Record<string, 'incomplete' | 'completed' | 'skipped'>>({});

  // Start Unit position State
  const [startUnitId, setStartUnitId] = useState<string>('');

  // Test & Grade State
  const [regularSubject, setRegularSubject] = useState('数学');
  const [regularScore, setRegularScore] = useState('');
  const [regularRankChange, setRegularRankChange] = useState<'up' | 'down' | 'keep'>('keep');
  const [regularRateChange, setRegularRateChange] = useState('');
  const [regularNextTarget, setRegularNextTarget] = useState('');
  const [regularImprovement, setRegularImprovement] = useState('');

  const [mockSubject, setMockSubject] = useState('総合');
  const [mockScore, setMockScore] = useState('');
  const [mockTargetSchool, setMockTargetSchool] = useState('');
  const [schoolCodes, setSchoolCodes] = useState<SchoolCodeMaster[]>([]);
  const [examThresholds, setExamThresholds] = useState<ExamThresholdMaster[]>([]);
  const [testRecordsList, setTestRecordsList] = useState<TestRecord[]>([]);

  // AI Report State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiReportText, setAiReportText] = useState<string>('');
  const [teacherNotes, setTeacherNotes] = useState<string>('');
  const [originalAiText, setOriginalAiText] = useState<string>('');
  const [finalReportText, setFinalReportText] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isPromptEditing, setIsPromptEditing] = useState(false);

  // HTML Element Ref for html2canvas
  const reportRef = useRef<HTMLDivElement>(null);

  // Load Initial Data
  const loadData = () => {
    const listSt = db.getStudents();
    const listSch = db.getSchools();
    const listCodes = db.getSchoolCodesMaster();
    const listEth = db.getExamThresholdsMaster();
    const listMps = db.getMilestonePlans();
    const listUnits = db.getCurriculumUnits();
    const listTemplates = db.getMilestoneTemplates();

    setStudents(listSt);
    setSchools(listSch);
    setSchoolCodes(listCodes);
    setExamThresholds(listEth);
    setMilestonePlans(listMps);
    setAllCurriculumUnits(listUnits);
    setMilestoneTemplates(listTemplates);

    if (listSch.length > 0 && !newStudentSchoolId) {
      setNewStudentSchoolId(listSch[0].id);
    }
    if (listSch.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(listSch[0].id);
    }

    if (selectedStudent) {
      // Re-find selected student to get fresh state
      const freshSt = listSt.find(s => s.id === selectedStudent.id);
      if (freshSt) {
        setSelectedStudent(freshSt);
        setSelectedLevel(freshSt.level || 'A');
        
        // Load interactions & personality options for student detail
        const listInteractions = db.getStudentInteractions(freshSt.id);
        setInteractions(listInteractions);
        const listPersonalities = db.getPersonalityOptions();
        setPersonalityOptions(listPersonalities);

        setEditForm({
          name: freshSt.name,
          name_kana: freshSt.name_kana || '',
          birthday: freshSt.birthday || '',
          grade: freshSt.grade,
          school_id: freshSt.school_id,
          club_activities: freshSt.club_activities || '',
          hobbies: freshSt.hobbies || '',
          parent_name: freshSt.parent_name || '',
          contact_phone: freshSt.contact_phone || '',
          contact_time: freshSt.contact_time || '',
          image_url: freshSt.image_url || '',
          personalities: freshSt.personalities || [],
          target_school: freshSt.target_school || '',
          classroom: freshSt.classroom || '',
          teacher_in_charge: freshSt.teacher_in_charge || '',
          level: freshSt.level || 'A'
        });

        const allTasks = db.getLearningTasks();
        const freshTasks = allTasks.filter(t => t.student_id === freshSt.id);
        setStudentTasks(freshTasks);
        setStartUnitId(freshSt.start_unit_id || '');

        // Load today's periods values
        const today = freshTasks.filter(t => t.scheduled_date === scheduleDate);
        const newPeriods: Record<number, { subject: string; unitId: string; customTheme: string; }> = {};
        for (let i = 1; i <= 10; i++) {
          newPeriods[i] = { subject: '', unitId: '', customTheme: '' };
        }
        let loadedPeriodCount = freshSt.period_count || 2;
        let foundCommonNote = '';
        
        today.forEach(t => {
          if (t.period) {
            const units = db.getCurriculumUnits();
            const unit = units.find(u => u.id === t.unit_id);
            if (unit) {
              newPeriods[t.period] = {
                subject: t.subject || unit.subject,
                unitId: t.unit_id,
                customTheme: ''
              };
            } else {
              newPeriods[t.period] = {
                subject: t.subject || 'テスト',
                unitId: '',
                customTheme: t.custom_unit_name || ''
              };
            }
            if (t.period > loadedPeriodCount) {
              loadedPeriodCount = t.period;
            }
          }
          if (t.office_note) {
            foundCommonNote = t.office_note;
          }
        });
        setPeriodSelections(newPeriods);
        setPeriodCount(loadedPeriodCount);
        setCommonOfficeNote(foundCommonNote);

        // Load MiniTestResults (multiple) for today
        const miniResults = db.getMiniTestResults();
        const todayMiniResults = miniResults.filter(r => r.student_id === freshSt.id && r.date === scheduleDate);
        setTodayTests(todayMiniResults.map(r => ({ id: r.id, content: r.test_content })));

        // Load HomeworkResults (multiple) for today
        const hwResults = db.getHomeworkResults();
        const todayHwResults = hwResults.filter(r => r.student_id === freshSt.id && r.date === scheduleDate);
        setTodayHomeworks(todayHwResults.map(r => ({ id: r.id, content: r.homework_content, deadline: r.homework_deadline })));

        // Load test records
        const allTests = db.getTestRecords();
        setTestRecordsList(allTests.filter(tr => tr.student_id === freshSt.id));

        // Load AI Report
        const allReports = db.getAIReports();
        const currentReport = allReports.find(r => r.student_id === freshSt.id && r.month === '2026-06');
        if (currentReport) {
          setAiReportText(currentReport.analysis_text);
          setOriginalAiText(currentReport.original_ai_text || currentReport.analysis_text);
          setTeacherNotes(currentReport.teacher_notes || '');
          setFinalReportText(currentReport.final_text || '');
        } else {
          setAiReportText('');
          setTeacherNotes('');
          setFinalReportText('');
        }
      }
    }

    // Load curriculum units
    const allUnits = db.getCurriculumUnits();
    const targetSchoolId = selectedSchoolId || (listSch.length > 0 ? listSch[0].id : '');
    const filteredUnits = allUnits
      .filter(u => u.school_id === targetSchoolId && u.subject === selectedSubject)
      .sort((a, b) => a.sequence_order - b.sequence_order);
    setSchoolUnits(filteredUnits);

    // Load AI Prompt template
    const prompts = db.getPromptSettings();
    if (prompts.length > 0) {
      setAiPrompt(prompts[0].prompt_template);
    }

    // Load all mini test results
    const allMiniResults = db.getMiniTestResults();
    setMiniTestResultsList(allMiniResults);
    const scoresMap: Record<string, string> = {};
    allMiniResults.forEach(r => {
      scoresMap[r.id] = r.score !== null ? r.score.toString() : '';
    });
    setTempScores(scoresMap);

    // Load all homework results
    const allHwResults = db.getHomeworkResults();
    setHomeworkResultsList(allHwResults);
    const hwStatusMap: Record<string, 'incomplete' | 'completed' | 'skipped'> = {};
    allHwResults.forEach(r => {
      hwStatusMap[r.id] = r.status;
    });
    setTempHomeworkStatuses(hwStatusMap);
  };

  useEffect(() => {
    loadData();
  }, [selectedSchoolId, selectedSubject, selectedStudent?.id, scheduleDate]);

  useEffect(() => {
    if (selectedStudent) {
      const isJuniorHigh = selectedStudent.grade.startsWith('中');
      if (isJuniorHigh) {
        const juniorSubjects = ['数学', '英語', '理科', '歴史', '地理', '国語'];
        if (!juniorSubjects.includes(selectedSubject)) {
          setSelectedSubject('数学');
        }
      } else {
        setSelectedSubject('算数');
      }
    }
    setSelectedTemplateId('');

    // スケジュール日付から現在の月を取得して初期表示フィルターにする
    if (scheduleDate) {
      const currentMonth = new Date(scheduleDate).getMonth() + 1;
      const validMonths = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
      if (validMonths.includes(currentMonth)) {
        setSelectedMonthFilter(currentMonth);
      } else {
        setSelectedMonthFilter('all');
      }
    } else {
      setSelectedMonthFilter('all');
    }
  }, [selectedStudent?.id, scheduleDate]);

  useEffect(() => {
    setSelectedTemplateId('');
  }, [selectedSubject, selectedLevel]);

  // 1. 1クリックアカウント発行
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName) return;

    // 生徒IDをランダム生成
    const randId = Math.floor(10000 + Math.random() * 90000); // 5桁
    const studentId = `student${randId}`;
    const email = `${studentId}@tentoru-student.com`;

    const newStudent: Student = {
      id: `std-${Date.now()}`,
      student_id: studentId,
      name: newStudentName,
      email,
      grade: newStudentGrade,
      school_id: newStudentSchoolId,
      status: 'normal',
      start_unit_id: null,
      created_at: new Date().toISOString(),
      level: newStudentLevel
    };

    await db.saveStudent(newStudent);

    // 新規生徒用の初期学習計画(学習タスク)を学校マスターから流し込む
    const allUnits = db.getCurriculumUnits();
    const schoolUnits = allUnits.filter(u => u.school_id === newStudentSchoolId);
    
    // 中学生なら数学・英語、小学生なら算数
    const subjects = newStudentGrade.startsWith('中') ? ['数学', '英語'] : ['算数'];
    const initialTasks: LearningTask[] = [];

    // 日付を明日から順次設定する
    let dayCount = 0;
    const startMs = Date.now() + 24 * 60 * 60 * 1000; // 明日

    subjects.forEach(subject => {
      const units = schoolUnits
        .filter(u => u.subject === subject)
        .sort((a, b) => a.sequence_order - b.sequence_order);

      units.forEach((unit, index) => {
        // デモ用日程: 3日に1回のペースで単元をこなすスケジュールを仮設定
        const date = new Date(startMs + dayCount * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        initialTasks.push({
          id: `task-${Date.now()}-${unit.id}`,
          student_id: newStudent.id,
          unit_id: unit.id,
          scheduled_date: date,
          period: null,
          status: 'unstarted',
          video_watched: false,
          test_passed: false,
          created_at: new Date().toISOString()
        });
        dayCount++;
      });
    });

    await db.saveLearningTasks(initialTasks);

    setNewStudentName('');
    alert(`生徒アカウントを発行しました！\nログインID: ${studentId}\nメールアドレス: ${email}`);
    loadData();
  };

  // 生徒情報の保存
  const handleSaveStudentDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      const updated = {
        ...selectedStudent,
        ...editForm
      } as Student;
      const saved = await db.saveStudent(updated);
      setSelectedStudent(saved);
      // 生徒リスト自体もリロードして更新を反映
      const listSt = db.getStudents();
      setStudents(listSt);
      loadData();
      alert('生徒情報を保存しました。');
    } catch (err) {
      console.error(err);
      alert('保存中にエラーが発生しました。');
    }
  };

  // 個性の追加
  const handleAddPersonality = async () => {
    if (!selectedStudent) return;
    const tagToAdd = newPersonalityInput.trim() || selectedPersonalityFromMaster;
    if (!tagToAdd) return;
    
    const currentTags = editForm.personalities!;
    if (currentTags.includes(tagToAdd)) {
      alert('この個性は既に登録されています。');
      return;
    }

    try {
      if (newPersonalityInput.trim()) {
        await db.addPersonalityOption(tagToAdd);
        const listPersonalities = db.getPersonalityOptions();
        setPersonalityOptions(listPersonalities);
      }
      
      const updatedTags = [...currentTags, tagToAdd];
      setEditForm({ ...editForm, personalities: updatedTags });
      setNewPersonalityInput('');
      setSelectedPersonalityFromMaster('');
    } catch (err) {
      console.error(err);
    }
  };

  // 個性の削除
  const handleRemovePersonality = (tagToRemove: string) => {
    const currentTags = editForm.personalities!;
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    setEditForm({ ...editForm, personalities: updatedTags });
  };

  // 対応履歴の登録
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !interactionMemo.trim()) return;
    try {
      const staffName = editForm.teacher_in_charge || '福田';
      const newInteraction: StudentInteraction = {
        id: `si-${selectedStudent.id}-${Date.now()}`,
        student_id: selectedStudent.id,
        category: interactionCategory,
        memo: interactionMemo,
        date: interactionDate,
        staff_name: staffName.split(' ')[0], // 苗字部分だけを表示する
        created_at: new Date().toISOString()
      };
      
      await db.saveStudentInteraction(newInteraction);
      setInteractionMemo('');
      // リロード
      const listInteractions = db.getStudentInteractions(selectedStudent.id);
      setInteractions(listInteractions);
      alert('対応内容を登録しました。');
    } catch (err) {
      console.error(err);
      alert('登録中にエラーが発生しました。');
    }
  };

  // 2. カリキュラム単元の順序変更（年度途中）
  const moveUnit = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === schoolUnits.length - 1) return;

    const newOrder = [...schoolUnits];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // スワップ
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIdx];
    newOrder[targetIdx] = temp;

    // sequence_order を再割り当て
    const updatedUnits = newOrder.map((unit, idx) => ({
      ...unit,
      sequence_order: idx + 1
    }));

    // 保存
    await db.saveCurriculumUnits(updatedUnits);

    // 【重要】影響を受ける全生徒の「未着手・スキップ部分の未来の計画のみ」自動で再編成
    const allStudents = db.getStudents();
    const subjectStudents = allStudents.filter(s => s.school_id === selectedSchoolId);
    
    const allTasks = db.getLearningTasks();
    let updatedTasks = [...allTasks];

    for (const student of subjectStudents) {
      updatedTasks = reorganizeFutureTasks(student.id, selectedSubject, updatedTasks, updatedUnits);
    }

    await db.saveLearningTasks(updatedTasks);
    
    alert('カリキュラムの順序を更新し、対象生徒の未来の学習計画を再編しました。(過去の完了ログは維持されています)');
    loadData();
  };

  // 3. 学習計画のスタート位置設定
  const handleSaveStartUnit = async () => {
    if (!selectedStudent) return;

    // 選択されたスタート位置より前の単元は「スキップ(未着手)」に、以降は「未着手」に戻す
    const allUnits = db.getCurriculumUnits();
    const studentSchoolUnits = allUnits.filter(u => u.school_id === selectedStudent.school_id);
    
    // 教科ごとに判定
    const updatedTasks = studentTasks.map(task => {
      const unit = studentSchoolUnits.find(u => u.id === task.unit_id);
      if (!unit) return task;

      // 講師がスタート位置を指定した教科のみ適用
      // スタート位置単元の順序
      const startUnit = studentSchoolUnits.find(u => u.id === startUnitId);
      if (startUnit && unit.subject === startUnit.subject) {
        if (unit.sequence_order < startUnit.sequence_order) {
          // スタートより前はスキップ
          return {
            ...task,
            status: 'skipped' as const,
            office_note: '開始位置指定によりスキップ'
          };
        } else if (task.status === 'skipped') {
          // スタート以降で過去にスキップされていたものは未着手にリセット
          return {
            ...task,
            status: 'unstarted' as const,
            office_note: ''
          };
        }
      }
      return task;
    });

    await db.saveLearningTasks(updatedTasks);
    
    // 生徒情報のスタート位置を更新
    await db.saveStudent({
      ...selectedStudent,
      start_unit_id: startUnitId
    });

    alert('学習スタート位置を設定しました。スタートより前の単元をTodoから除外しました。');
    loadData();
  };

  // 4. コマ割り時間割設定の保存
  const handleSaveTimetable = async () => {
    if (!selectedStudent) return;

    // 本日の既存のタスクの period を一旦クリア
    let clearedTasks = studentTasks.map(t => {
      if (t.scheduled_date === scheduleDate) {
        return { ...t, period: null, office_note: '' };
      }
      return t;
    });

    const newCustomTasks: LearningTask[] = [];

    // periodSelections の設定を反映
    for (let p = 1; p <= periodCount; p++) {
      const config = periodSelections[p];
      if (!config || !config.subject) {
        continue;
      }

      if (config.unitId) {
        clearedTasks = clearedTasks.map(task => {
          if (task.unit_id === config.unitId) {
            return {
              ...task,
              scheduled_date: scheduleDate,
              period: p,
              subject: config.subject,
              office_note: commonOfficeNote
            };
          }
          return task;
        });
      } else {
        const customUnitId = `custom-${selectedStudent.id}-${scheduleDate}-${p}`;
        const existingCustomTaskIdx = clearedTasks.findIndex(t => t.unit_id === customUnitId);
        
        if (existingCustomTaskIdx >= 0) {
          clearedTasks[existingCustomTaskIdx] = {
            ...clearedTasks[existingCustomTaskIdx],
            scheduled_date: scheduleDate,
            period: p,
            subject: config.subject,
            custom_unit_name: config.customTheme,
            office_note: commonOfficeNote
          };
        } else {
          newCustomTasks.push({
            id: `task-custom-${Date.now()}-${p}`,
            student_id: selectedStudent.id,
            unit_id: customUnitId,
            scheduled_date: scheduleDate,
            period: p,
            status: 'unstarted',
            video_watched: false,
            test_passed: false,
            subject: config.subject,
            custom_unit_name: config.customTheme,
            office_note: commonOfficeNote,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    const allTasksToSave = [...clearedTasks, ...newCustomTasks];
    await db.saveLearningTasks(allTasksToSave);

    // 複数のテスト結果 (MiniTestResult) を一括同期保存
    const miniResults = db.getMiniTestResults();
    const existingMiniResultsForToday = miniResults.filter(r => r.student_id === selectedStudent.id && r.date === scheduleDate);

    const savedTestIds = new Set<string>();
    for (const test of todayTests) {
      if (!test.content.trim()) continue;
      const existing = existingMiniResultsForToday.find(r => r.id === test.id || r.test_content === test.content);
      const testData: MiniTestResult = {
        id: existing?.id || (test.id.startsWith('temp-') ? `mini-${selectedStudent.id}-${scheduleDate}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : test.id),
        student_id: selectedStudent.id,
        date: scheduleDate,
        test_content: test.content,
        score: existing ? existing.score : null,
        created_at: existing?.created_at || new Date().toISOString()
      };
      await db.saveMiniTestResult(testData);
      savedTestIds.add(testData.id);
    }

    for (const existing of existingMiniResultsForToday) {
      if (!savedTestIds.has(existing.id)) {
        await db.deleteMiniTestResult(existing.id);
      }
    }

    // 複数の宿題結果 (HomeworkResult) を一括同期保存
    const hwResults = db.getHomeworkResults();
    const existingHwResultsForToday = hwResults.filter(r => r.student_id === selectedStudent.id && r.date === scheduleDate);

    const savedHwIds = new Set<string>();
    for (const hw of todayHomeworks) {
      if (!hw.content.trim()) continue;
      const existing = existingHwResultsForToday.find(r => r.id === hw.id || r.homework_content === hw.content);
      const hwData: HomeworkResult = {
        id: existing?.id || (hw.id.startsWith('temp-') ? `hw-${selectedStudent.id}-${scheduleDate}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` : hw.id),
        student_id: selectedStudent.id,
        date: scheduleDate,
        homework_content: hw.content,
        homework_deadline: hw.deadline,
        status: existing ? existing.status : 'incomplete',
        created_at: existing?.created_at || new Date().toISOString()
      };
      await db.saveHomeworkResult(hwData);
      savedHwIds.add(hwData.id);
    }

    for (const existing of existingHwResultsForToday) {
      if (!savedHwIds.has(existing.id)) {
        await db.deleteHomeworkResult(existing.id);
      }
    }

    // 生徒情報の period_count も更新して保存
    const updatedStudent = {
      ...selectedStudent,
      period_count: periodCount
    };
    await db.saveStudent(updatedStudent);
    setSelectedStudent(updatedStudent);

    alert('今日の時間割コマ割りを保存しました！');
    loadData();
  };

  // 小テスト結果の保存
  const handleSaveMiniTestScore = async (result: MiniTestResult) => {
    const scoreStr = tempScores[result.id] || '';
    const scoreVal = scoreStr === '' ? null : parseInt(scoreStr);
    if (scoreVal !== null && (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100)) {
      alert('点数は0〜100の範囲で入力してください。');
      return;
    }
    const updated = {
      ...result,
      score: scoreVal
    };
    await db.saveMiniTestResult(updated);
    alert('小テスト点数を保存しました！');
    loadData();
  };

  // 宿題提出状況の保存
  const handleSaveHomeworkStatus = async (result: HomeworkResult) => {
    const statusVal = tempHomeworkStatuses[result.id] || 'incomplete';
    const updated = {
      ...result,
      status: statusVal
    };
    await db.saveHomeworkResult(updated);
    alert('宿題提出状況を保存しました！');
    loadData();
  };

  // テストの動的追加・更新・削除
  const handleAddTest = () => {
    setTodayTests([...todayTests, { id: `temp-${Date.now()}-${Math.random()}`, content: '' }]);
  };

  const handleUpdateTest = (id: string, val: string) => {
    setTodayTests(todayTests.map(t => t.id === id ? { ...t, content: val } : t));
  };

  const handleRemoveTest = (id: string) => {
    setTodayTests(todayTests.filter(t => t.id !== id));
  };

  // 宿題の動的追加・更新・削除
  const handleAddHomework = () => {
    setTodayHomeworks([...todayHomeworks, { id: `temp-${Date.now()}-${Math.random()}`, content: '', deadline: '' }]);
  };

  const handleUpdateHomework = (id: string, field: 'content' | 'deadline', val: string) => {
    setTodayHomeworks(todayHomeworks.map(h => h.id === id ? { ...h, [field]: val } : h));
  };

  const handleRemoveHomework = (id: string) => {
    setTodayHomeworks(todayHomeworks.filter(h => h.id !== id));
  };

  // 5. 自動リスケジュール実行 (遅れ発生時)
  const handleAutoReschedule = async () => {
    if (!selectedStudent) return;

    // 未来の予定日リストを仮に作成 (土日を除く翌日からの5日間)
    const futureDates: string[] = [];
    let checkDate = new Date(scheduleDate);
    while (futureDates.length < 5) {
      checkDate.setDate(checkDate.getDate() + 1);
      const day = checkDate.getDay();
      if (day !== 0 && day !== 6) { // 土日を除く
        futureDates.push(checkDate.toISOString().split('T')[0]);
      }
    }

    const { updatedTasks, updatedStudent, isPunked } = rescheduleDelayedTasks(
      selectedStudent,
      db.getLearningTasks(),
      scheduleDate,
      futureDates,
      periodCount,
      milestonePlans,
      allCurriculumUnits
    );

    if (isPunked) {
      alert(`【要判断：計画パンクアラート発火】\n自動リスケジュールを試みましたが、1日あたりのタスク量が現在の設定コマ数(${periodCount}コマ)を超えたため、自動適用をストップしました。目標期日の変更や単元の間引きを検討してください。生徒ステータスが警告(パンク)に更新されます。`);
    } else {
      alert('2日連続未達成を検出し、自動リスケジュールを実行しました。未達成タスクを残りの日程に均等配分しました。');
    }

    await db.saveLearningTasks(updatedTasks);
    await db.saveStudent(updatedStudent);
    
    // 反映
    setSelectedStudent(updatedStudent);
    loadData();
  };

  // 6. 定期テスト結果記録
  const handleSaveRegularTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !regularScore) return;

    const record: TestRecord = {
      id: `tr-${Date.now()}`,
      student_id: selectedStudent.id,
      record_type: 'regular_test',
      subject: regularSubject,
      score: parseInt(regularScore),
      rank_change: regularRankChange,
      rate_change: parseFloat(regularRateChange || '0'),
      next_target_score: parseInt(regularNextTarget || '0'),
      improvement_plan: regularImprovement,
      created_at: new Date().toISOString()
    };

    await db.saveTestRecord(record);
    setRegularScore('');
    setRegularRateChange('');
    setRegularNextTarget('');
    setRegularImprovement('');
    alert('定期テスト結果を記録しました。');
    loadData();
  };

  // 7. 模試＆志望校判定の合格％自動算出
  const handleSaveMockExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !mockScore || !mockTargetSchool) return;

    const scoreNum = parseInt(mockScore);
    
    // 合格％算出
    const probability = calculateMockExamPassRate(scoreNum, mockTargetSchool, examThresholds);

    const record: TestRecord = {
      id: `tr-${Date.now()}`,
      student_id: selectedStudent.id,
      record_type: 'mock_exam',
      subject: mockSubject,
      score: scoreNum,
      target_school_code: mockTargetSchool,
      improvement_plan: `志望校合格可能性: ${probability}%`,
      created_at: new Date().toISOString()
    };

    await db.saveTestRecord(record);
    setMockScore('');
    alert(`模試結果を記録しました。\n判定: ${probability}%`);
    loadData();
  };

  // 8. AI指導報告書自動生成
  const handleGenerateAIReport = async () => {
    const student = selectedStudent!;
    setIsGeneratingAI(true);

    // 学習ログを集計 (動画視聴時間、合格単元数、平均点、苦手ジャンル)
    const allLogs = db.getLearningLogs();
    const studentLogs = allLogs.filter(l => l.student_id === student.id);
    
    const videoDuration = Math.round(
      studentLogs
        .filter(l => l.log_type === 'video_view')
        .reduce((sum, l) => sum + (l.duration_seconds || 0), 0) / 60
    );

    const testLogs = studentLogs.filter(l => l.log_type === 'test_result');
    const passScore = student.level === 'A' ? 90 : student.level === 'B' ? 80 : 70;
    const passedUnitsCount = testLogs.filter(l => (l.score || 0) >= passScore).length;
    
    const averageScore = testLogs.length > 0 
      ? Math.round(testLogs.reduce((sum, l) => sum + (l.score || 0), 0) / testLogs.length)
      : 0;

    const incorrectGenresSet = new Set<string>();
    testLogs.forEach(l => {
      l.incorrect_genres?.forEach(g => incorrectGenresSet.add(g));
    });
    const incorrectGenres = Array.from(incorrectGenresSet).join(', ') || '特になし';

    const corrections = db.getTeacherCorrectionsLogs()
      .filter(l => l.student_id === student.id)
      .map(c => ({
        original: c.original_text,
        corrected: c.corrected_text
      }));
    const learnedStyle: PersonalStyle = learnFromTeacherCorrections(corrections);

    // AIプロンプトのシミュレート（環境変数があれば本物のAPI、なければルールベース）
    setTimeout(() => {
      // テンプレート変数置換
      let rawReport = aiPrompt
        .replace('{video_duration}', videoDuration.toString())
        .replace('{passed_units_count}', passedUnitsCount.toString())
        .replace('{average_score}', averageScore.toString())
        .replace('{incorrect_genres}', incorrectGenres);

      // モックAI生成
      let generatedText = `【今月の頑張り報告】\n${student.name}君は今月、塾で大変すばらしい取り組みを見せました！動画を合計${videoDuration}分間、非常に集中して視聴し、自走する学習習慣が身についてきています。テストでは平均${averageScore}%をマークし、合格単元数は${passedUnitsCount}つに上ります。${incorrectGenres !== '特になし' ? `苦手な「${incorrectGenres}」で少しミスが見られましたが` : '苦手単元も特になく'}、全体的に意欲の高さがうかがえます。素晴らしい成長です！`;

      // 講師の修正癖（トーン）を注入
      const personalizedText = generateAIReportText(generatedText, learnedStyle);

      setAiReportText(personalizedText);
      setOriginalAiText(personalizedText);
      setTeacherNotes('');
      setFinalReportText(personalizedText); // 初期値はポジティブ分析のみ

      setIsGeneratingAI(false);
      alert('AI報告書の文章を自動生成しました！');
    }, 1500);
  };

  // 面談備考が変更されたら最終出力テキストを構築
  useEffect(() => {
    if (aiReportText) {
      const combined = `${aiReportText}\n\n【二者面談結果・今後の目標】\n${teacherNotes}`;
      setFinalReportText(combined);
    }
  }, [aiReportText, teacherNotes]);

  // AI指導報告書の保存 & 修正学習
  const handleSaveAIReport = async () => {
    const student = selectedStudent!;
    if (!aiReportText) return;

    // もし講師が生成されたポジティブ分析を編集（手動修正）している場合、修正履歴をデータベースに蓄積して学習させる
    // 画面上の aiReportText が originalAiText と異なる場合は、手動修正が発生したとみなす
    if (aiReportText !== originalAiText) {
      const correctionLog: TeacherCorrectionLog = {
        id: `cor-${Date.now()}`,
        student_id: student.id,
        original_text: originalAiText,
        corrected_text: aiReportText,
        created_at: new Date().toISOString()
      };
      await db.addTeacherCorrectionLog(correctionLog);
    }

    const report: AIReport = {
      id: `rep-${Date.now()}`,
      student_id: student.id,
      month: '2026-06',
      analysis_text: aiReportText,
      teacher_notes: teacherNotes,
      original_ai_text: originalAiText,
      final_text: finalReportText,
      created_at: new Date().toISOString()
    };

    await db.saveAIReport(report);
    alert('指導報告書を保存し、文体修正履歴を学習しました！');
    loadData();
  };

  // プロンプトテンプレートの保存
  const handleSavePromptTemplate = async () => {
    const prompts = db.getPromptSettings();
    if (prompts.length > 0) {
      await db.savePromptSetting({
        ...prompts[0],
        prompt_template: aiPrompt
      });
      setIsPromptEditing(false);
      alert('AIプロンプトテンプレートを更新しました！');
    }
  };

  // 保護者への共有用に報告書を画像化してダウンロード
  const handleExportAsImage = () => {
    /* v8 ignore next */
    if (!reportRef.current) return;

    // html2canvasで画像化してダウンロード
    html2canvas(reportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fdfbf7'
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = `指導報告書_${selectedStudent?.name}_2026-06.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  };

  // --- 年間計画（マイルストーン）カスタマイズ & テンプレート用ヘルパー関数 ---
  const getFilteredMilestones = () => {
    const currentGrade = selectedStudent!.grade;
    return milestonePlans
      .filter(p => p.grade === currentGrade && p.subject === selectedSubject && p.level === selectedLevel && p.course === 'standard')
      .sort((a, b) => {
        const monthOrder = (m: number) => m >= 3 ? m : m + 12;
        const am = monthOrder(a.month);
        const bm = monthOrder(b.month);
        if (am !== bm) return am - bm;
        return a.week_number - b.week_number;
      });
  };

  const getDisplayMilestones = () => {
    const filtered = getFilteredMilestones();
    if (selectedMonthFilter === 'all') {
      return filtered;
    }
    return filtered.filter(p => p.month === selectedMonthFilter);
  };

  const handleAddMilestoneRow = async (month: number, week: number) => {
    const currentGrade = selectedStudent!.grade;
    const newPlan: MilestonePlan = {
      id: `mp-custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      grade: currentGrade,
      subject: selectedSubject,
      course: 'standard',
      month,
      week_number: week,
      is_holiday: false,
      level: selectedLevel,
      chapter: '',
      unit_name: '',
      target_theme_name: '',
      target_sequence_order: 0,
      created_at: new Date().toISOString()
    };
    const updated = [...milestonePlans, newPlan];
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
    alert('新しいマイルストーン行を追加しました。');
    loadData();
  };

  const handleDeleteMilestoneRow = async (id: string) => {
    const updated = milestonePlans.filter(p => p.id !== id);
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
    alert('マイルストーン行を削除しました。');
    loadData();
  };

  const handleReorderMilestones = async (activeId: string, targetId: string) => {
    const allList = getFilteredMilestones();
    const activeIdx = allList.findIndex(p => p.id === activeId);
    const targetIdx = allList.findIndex(p => p.id === targetId);
    if (activeIdx === -1 || targetIdx === -1 || activeIdx === targetIdx) return;

    // 現在の日付枠を取得
    const locations = allList.map(p => ({
      month: p.month,
      week_number: p.week_number
    }));

    // 要素を並び替え
    const newAllList = [...allList];
    const [draggedItem] = newAllList.splice(activeIdx, 1);
    newAllList.splice(targetIdx, 0, draggedItem);

    // 新しい順序に従って日付枠を割り当て直す
    const reorderedItems = newAllList.map((item, idx) => ({
      ...item,
      month: locations[idx].month,
      week_number: locations[idx].week_number
    }));

    // milestonePlans 全体のステートを更新する
    const updatedPlans = milestonePlans.map(p => {
      const match = reorderedItems.find(item => item.id === p.id);
      return match ? match : p;
    });

    setMilestonePlans(updatedPlans);
    await db.saveMilestonePlans(updatedPlans);
    loadData();
  };

  const handleToggleHoliday = async (id: string) => {
    const updated = milestonePlans.map(p => {
      if (p.id === id) {
        const nextIsHoliday = !p.is_holiday;
        return {
          ...p,
          is_holiday: nextIsHoliday,
          holiday_name: nextIsHoliday ? '休校日' : '',
          target_sequence_order: nextIsHoliday ? 0 : p.target_sequence_order
        };
      }
      return p;
    });
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
    loadData();
  };

  const handleUpdateHolidayName = async (id: string, name: string) => {
    const updated = milestonePlans.map(p => {
      if (p.id === id) {
        return { ...p, holiday_name: name, unit_name: name };
      }
      return p;
    });
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
  };

  const handleUpdateMilestoneField = async (id: string, field: 'chapter' | 'unit_name' | 'target_theme_name', value: string) => {
    const schoolUnits = allCurriculumUnits.filter(u => u.subject === selectedSubject);
    const updated = milestonePlans.map(p => {
      if (p.id === id) {
        const nextPlan = { ...p, [field]: value };
        if (field === 'target_theme_name') {
          const matchedUnit = schoolUnits.find(u => u.name === value);
          if (matchedUnit) {
            nextPlan.target_sequence_order = matchedUnit.sequence_order;
          }
        }
        return nextPlan;
      }
      return p;
    });
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
  };

  const handleUpdateMilestoneTargetOrder = async (id: string, order: number) => {
    const updated = milestonePlans.map(p => {
      if (p.id === id) {
        return { ...p, target_sequence_order: order };
      }
      return p;
    });
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
  };

  const handleMoveChapter = async (chapterName: string, direction: 'up' | 'down') => {
    const filtered = getFilteredMilestones();
    const chapters = Array.from(new Set(filtered.map(p => p.chapter).filter(Boolean))) as string[];
    const idx = chapters.indexOf(chapterName);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === chapters.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const targetChapter = chapters[targetIdx];

    const newChapters = [...chapters];
    newChapters[idx] = targetChapter;
    newChapters[targetIdx] = chapterName;

    const getChapterIndex = (ch?: string) => {
      const index = ch ? newChapters.indexOf(ch) : -1;
      return index === -1 ? 999 : index;
    };

    const sortedContent = [...filtered].sort((a, b) => {
      const idxA = getChapterIndex(a.chapter);
      const idxB = getChapterIndex(b.chapter);
      if (idxA !== idxB) return idxA - idxB;
      return 0;
    });

    const updatedPlans = filtered.map((orig, i) => {
      const content = sortedContent[i];
      return {
        ...orig,
        chapter: content.chapter,
        unit_name: content.unit_name,
        target_theme_name: content.target_theme_name,
        target_sequence_order: content.target_sequence_order,
        is_holiday: content.is_holiday,
        holiday_name: content.holiday_name
      };
    });

    const newAllPlans = milestonePlans.map(p => {
      const match = updatedPlans.find(up => up.id === p.id);
      return match || p;
    });

    setMilestonePlans(newAllPlans);
    await db.saveMilestonePlans(newAllPlans);
    alert(`章の順序を入れ替えました。`);
    loadData();
  };

  const handleSaveTemplate = async (name: string) => {
    if (!name.trim()) return;
    const currentGrade = selectedStudent!.grade;
    const filtered = getFilteredMilestones();
    const template: MilestoneTemplate = {
      id: `temp-${Date.now()}`,
      name,
      grade: currentGrade,
      subject: selectedSubject,
      level: selectedLevel,
      plans: filtered.map(p => ({ ...p, id: `mp-temp-item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` })),
      created_at: new Date().toISOString()
    };
    await db.saveMilestoneTemplate(template);
    setNewTemplateName('');
    alert('テンプレートを保存しました。');
    loadData();
  };

  const handleApplyTemplate = async (templateId: string) => {
    const templates = db.getMilestoneTemplates();
    const target = templates.find(t => t.id === templateId)!;

    const currentGrade = selectedStudent!.grade;

    const filteredOut = milestonePlans.filter(p => 
      !(p.grade === currentGrade && p.subject === selectedSubject && p.level === selectedLevel && p.course === 'standard')
    );

    const newPlans = target.plans.map((p, idx) => ({
      ...p,
      id: `mp-applied-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      grade: currentGrade,
      subject: selectedSubject,
      level: selectedLevel
    }));

    const updated = [...filteredOut, ...newPlans];
    setMilestonePlans(updated);
    await db.saveMilestonePlans(updated);
    alert(`テンプレート「${target.name}」を適用しました。`);
    loadData();
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await db.deleteMilestoneTemplate(templateId);
    alert('テンプレートを削除しました。');
    loadData();
  };

  const handleUpdateTemplateName = async (templateId: string, newName: string) => {
    if (!newName.trim()) return;
    const templates = db.getMilestoneTemplates();
    const target = templates.find(t => t.id === templateId)!;
    const updated = { ...target, name: newName };
    await db.saveMilestoneTemplate(updated);
    setEditingTemplateId(null);
    setEditingTemplateName('');
    alert('テンプレート名を更新しました。');
    loadData();
  };

  const containerClass = `${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`;

  return (
    <div className={containerClass}>
      <div className={styles.header}>
        <h1>
          {/* Dashboard Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="9" x2="21" y2="9" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          テントル 司令塔ダッシュボード (講師用)
        </h1>
        <button onClick={onBackToPortal} className={styles.backBtn}>
          ポータルへ戻る
        </button>
      </div>

      <div className={styles.mainLayout}>
        {/* Sidebar: Vertical Navigation Menu */}
        <div className={styles.sidebar}>
          
          {/* Student Management Group */}
          <div className={styles.menuGroup}>
            <div className={styles.menuTitle}>生徒管理</div>
            <button
              className={`${styles.menuItem} ${activeTab === 'student-list' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('student-list')}
            >
              {/* User Group Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              生徒一覧
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'create-student' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('create-student')}
            >
              {/* Add User Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
              新規生徒アカウント発行
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'student-detail' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('student-detail')}
            >
              {/* User Card Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              生徒情報
            </button>
          </div>

          {/* Individual Settings Group */}
          <div className={styles.menuGroup}>
            <div className={styles.menuTitle}>個別指導・学習計画設定</div>
            <button
              className={`${styles.menuItem} ${activeTab === 'schedule' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              学習計画・コマ割り
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'milestones' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('milestones')}
            >
              年間計画（マイルストーン）
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'curriculum' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('curriculum')}
            >
              学校カリキュラム管理
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'mini-tests' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('mini-tests')}
            >
              小テスト結果
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'homeworks' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('homeworks')}
            >
              宿題提出状況
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'tests' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              定期テスト・模試
            </button>
            <button
              className={`${styles.menuItem} ${activeTab === 'ai-report' ? styles.menuItemActive : ''}`}
              onClick={() => setActiveTab('ai-report')}
            >
              AI指導報告書
            </button>
          </div>

          {/* Selected Student Panel Preview */}
          {selectedStudent && (
            <div className={styles.sidebarCard} style={{ marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>選択中の生徒:</span>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setActiveTab('student-list');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  解除
                </button>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>{selectedStudent.name} ({selectedStudent.grade})</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                <label htmlFor="student-level-select" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>学習レベル:</label>
                <select
                  id="student-level-select"
                  value={selectedStudent.level || 'A'}
                  onChange={async e => {
                    const nextLevel = e.target.value as 'A' | 'B' | 'C';
                    const updated = { ...selectedStudent, level: nextLevel };
                    await db.saveStudent(updated);
                    setSelectedStudent(updated);
                    setSelectedLevel(nextLevel);
                    alert(`生徒の学習レベルを レベル${nextLevel} に更新しました。`);
                    loadData();
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#1e293b',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  <option value="A">レベルA (発展)</option>
                  <option value="B">レベルB (標準)</option>
                  <option value="C">レベルC (基礎)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Main workspace */}
        <div className={styles.contentArea}>
          
          {/* Student List View */}
          {activeTab === 'student-list' && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>生徒一覧</div>

              {/* Search Filters */}
              <div className={styles.filterArea}>
                <div className={styles.filterGrid}>
                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label htmlFor="filter-school" style={{ fontSize: '0.75rem', fontWeight: 600 }}>中学校・小学校</label>
                    <select
                      id="filter-school"
                      value={filterSchoolId}
                      onChange={e => setFilterSchoolId(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">すべて</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label htmlFor="filter-grade" style={{ fontSize: '0.75rem', fontWeight: 600 }}>学年</label>
                    <select
                      id="filter-grade"
                      value={filterGrade}
                      onChange={e => setFilterGrade(e.target.value)}
                      className={styles.select}
                    >
                      <option value="">すべて</option>
                      <option value="小5">小学5年生</option>
                      <option value="小6">小学6年生</option>
                      <option value="中1">中学1年生</option>
                      <option value="中2">中学2年生</option>
                      <option value="中3">中学3年生</option>
                    </select>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>区分トグル</label>
                    <div className={styles.segmentControl}>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${filterCategory === 'all' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setFilterCategory('all')}
                      >
                        すべて
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${filterCategory === 'junior_high' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setFilterCategory('junior_high')}
                      >
                        中学生
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${filterCategory === 'elementary' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setFilterCategory('elementary')}
                      >
                        小学生
                      </button>
                    </div>
                  </div>

                  <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                    <label htmlFor="filter-name" style={{ fontSize: '0.75rem', fontWeight: 600 }}>生徒名検索</label>
                    <input
                      id="filter-name"
                      type="text"
                      placeholder="名前を入力..."
                      value={filterName}
                      onChange={e => setFilterName(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>
              </div>

              {/* Student Cards Grid */}
              <div className={styles.studentGrid}>
                {students
                  .filter(st => {
                    if (filterSchoolId && st.school_id !== filterSchoolId) return false;
                    if (filterGrade && st.grade !== filterGrade) return false;
                    
                    const school = schools.find(s => s.id === st.school_id);
                    if (filterCategory === 'junior_high' && (!school || school.type !== 'junior_high')) return false;
                    if (filterCategory === 'elementary' && (!school || school.type !== 'elementary')) return false;
                    
                    if (filterName && !st.name.includes(filterName)) return false;
                    return true;
                  })
                  .map(st => {
                    let statusClass = styles.statusNormal;
                    if (st.status === 'fast') statusClass = styles.statusFast;
                    if (st.status === 'warning') statusClass = styles.statusWarning;

                    const sub = st.grade.startsWith('中') ? '数学' : '算数';
                    const allTasks = db.getLearningTasks();
                    const { gapWeeks } = calculateProgressGap(st, allTasks, milestonePlans, allCurriculumUnits, scheduleDate, sub);
                    
                    let gapBadge = null;
                    if (gapWeeks < 0) {
                      gapBadge = <span style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fee2e2' }}>{Math.abs(gapWeeks)}週遅れ ⚠️</span>;
                    } else if (gapWeeks > 0) {
                      gapBadge = <span style={{ fontSize: '0.75rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', border: '1px solid #dcfce7' }}>{gapWeeks}週進み ⚡</span>;
                    } else {
                      gapBadge = <span style={{ fontSize: '0.75rem', backgroundColor: '#f8fafc', color: '#475569', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>順調</span>;
                    }

                    const schoolName = schools.find(s => s.id === st.school_id)?.name || '未所属';

                    return (
                      <div
                        key={st.id}
                        className={styles.studentCard}
                        onClick={() => {
                          setSelectedStudent(st);
                          setStartUnitId(st.start_unit_id || '');
                          setActiveTab('schedule');
                        }}
                      >
                        <div>
                          <div className={styles.studentCardHeader}>
                            <span className={styles.studentCardName}>{st.name} ({st.grade})</span>
                            <span className={`${styles.statusIcon} ${statusClass}`} title={`状況: ${st.status}`} />
                          </div>
                          <div className={styles.studentCardSchool}>{schoolName}</div>
                        </div>
                        <div className={styles.studentCardFooter}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>進捗状況:</span>
                          {gapBadge}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Account Generation Form View */}
          {activeTab === 'create-student' && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>新規生徒アカウント発行</div>
              <form onSubmit={handleCreateAccount} style={{ maxWidth: '500px' }}>
                <div className={styles.formGroup}>
                  <label>生徒氏名</label>
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={e => setNewStudentName(e.target.value)}
                    placeholder="例: 佐藤 拓海" 
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>学年</label>
                  <select 
                    value={newStudentGrade} 
                    onChange={e => setNewStudentGrade(e.target.value)}
                    className={styles.select}
                  >
                    <option value="小5">小学5年生</option>
                    <option value="小6">小学6年生</option>
                    <option value="中1">中学1年生</option>
                    <option value="中2">中学2年生</option>
                    <option value="中3">中学3年生</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>所属学校</label>
                  <select 
                    value={newStudentSchoolId} 
                    onChange={e => setNewStudentSchoolId(e.target.value)}
                    className={styles.select}
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.type === 'junior_high' ? '中' : '小'})</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>学習レベル</label>
                  <select 
                    value={newStudentLevel} 
                    onChange={e => setNewStudentLevel(e.target.value as any)}
                    className={styles.select}
                  >
                    <option value="A">レベルA (発展)</option>
                    <option value="B">レベルB (標準)</option>
                    <option value="C">レベルC (基礎)</option>
                  </select>
                </div>
                <button type="submit" className={styles.btn} style={{ marginTop: '16px' }}>
                  1クリックアカウント発行
                </button>
              </form>
            </div>
          )}

          {/* Student Specific Tab Screens */}
          {activeTab !== 'student-list' && activeTab !== 'create-student' && (
            !selectedStudent ? (
              <div className={`${styles.card} ${styles.noStudentSelected}`}>
                {/* Info Icon */}
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <p>生徒が選択されていません。左のメニューから「生徒一覧」を表示し、生徒を選択してください。</p>
                <button
                  onClick={() => setActiveTab('student-list')}
                  className={styles.btn}
                  style={{ width: 'auto', marginTop: '16px', background: '#4f46e5' }}
                >
                  生徒一覧へ
                </button>
              </div>
            ) : (
              <>
                {/* Selected Student Profile Banner */}
                {activeTab !== 'student-detail' && (
                  <div className={styles.card} style={{ borderLeft: '6px solid #4f46e5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h2 style={{ margin: '0 0 6px 0', fontSize: '1.3rem' }}>{selectedStudent.name} (ID: {selectedStudent.student_id})</h2>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>所属学校: {schools.find(s => s.id === selectedStudent.school_id)?.name}</span>
                      </div>
                      <div>
                        {selectedStudent.status === 'fast' && <span className={`${styles.badge} ${styles.statusFast}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>爆速中！(先取り前倒し中) ⚡</span>}
                        {selectedStudent.status === 'warning' && <span className={`${styles.badge} ${styles.statusWarning}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>計画パンクアラート！⚠️</span>}
                        {selectedStudent.status === 'normal' && <span className={`${styles.badge} ${styles.statusNormal}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>通常進捗</span>}
                      </div>
                    </div>
                  </div>
                )}

              {/* Tab 1: 学習計画・時間割 (司令塔設定) */}
              {activeTab === 'schedule' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    <span>学習計画の個別管理 & 自動最適化</span>
                    {selectedStudent.status === 'warning' && (
                      <button onClick={handleAutoReschedule} className={styles.btn} style={{ width: 'auto', background: '#e11d48' }}>
                        手動リスケジュールを実行
                      </button>
                    )}
                    {selectedStudent.status !== 'warning' && (
                      <button onClick={handleAutoReschedule} className={styles.btn} style={{ width: 'auto', background: '#10b981' }}>
                        遅れチェック ＆ 自動リスケ
                      </button>
                    )}
                  </div>

                  {/* Start Position Config */}
                  <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>学習スタート位置の設定</h4>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <select 
                        value={startUnitId} 
                        onChange={e => setStartUnitId(e.target.value)}
                        className={styles.select}
                        style={{ maxWidth: '300px' }}
                      >
                        <option value="">-- 最初からスタートする --</option>
                        {db.getCurriculumUnits()
                          .filter(u => u.school_id === selectedStudent.school_id)
                          .map(u => (
                            <option key={u.id} value={u.id}>[{u.subject}] {u.name}</option>
                          ))}
                      </select>
                      <button onClick={handleSaveStartUnit} className={styles.btn} style={{ width: 'auto' }}>
                        適用する
                      </button>
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                      ※指定した開始単元より前の範囲は「スキップ（未着手）」ステータスとして生徒画面にビジュアルとして残し、日々のタスクからは除外します。
                    </p>
                  </div>

                  {/* Timetable planner */}
                  <div className={styles.schedulerGrid}>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700 }}>コマ割り設定 (標準2コマ / 最大10コマ)</h4>
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>対象日付: </label>
                        <input 
                          type="date" 
                          value={scheduleDate} 
                          onChange={e => setScheduleDate(e.target.value)}
                          className={styles.input}
                          style={{ width: 'auto', display: 'inline-block' }}
                        />
                      </div>
                      
                      <div className={styles.timetableSetup}>
                        {Array.from({ length: periodCount }, (_, i) => i + 1).map(p => {
                          const currentConfig = periodSelections[p];
                          const showUnitSelect = currentConfig.subject === '数学' || currentConfig.subject === '英語';

                          return (
                            <div key={p} className={styles.cellRow} style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                              <span className={styles.cellNum} style={{ marginTop: '8px' }}>{p}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <select
                                  value={currentConfig.subject}
                                  onChange={e => {
                                    const sub = e.target.value;
                                    setPeriodSelections({
                                      ...periodSelections,
                                      [p]: { subject: sub, unitId: '', customTheme: '' }
                                    });
                                  }}
                                  className={styles.select}
                                >
                                  <option value="">-- コマ割りなし --</option>
                                  <option value="数学">数学</option>
                                  <option value="英語">英語</option>
                                  <option value="理科">理科</option>
                                  <option value="社会">社会</option>
                                  <option value="国語">国語</option>
                                  <option value="テスト">テスト</option>
                                </select>

                                {currentConfig.subject && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {showUnitSelect ? (
                                      <>
                                        <select
                                          value={currentConfig.unitId}
                                          onChange={e => {
                                            const uId = e.target.value;
                                            setPeriodSelections({
                                              ...periodSelections,
                                              [p]: { ...currentConfig, unitId: uId, customTheme: uId ? '' : currentConfig.customTheme }
                                            });
                                          }}
                                          className={styles.select}
                                        >
                                          <option value="">-- カリキュラム単元から選択 --</option>
                                          {db.getCurriculumUnits()
                                            .filter(u => u.school_id === selectedStudent.school_id && u.subject === currentConfig.subject)
                                            .map(u => (
                                              <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                        <input
                                          type="text"
                                          placeholder="またはテーマを自由に入力"
                                          value={currentConfig.customTheme}
                                          disabled={!!currentConfig.unitId}
                                          onChange={e => {
                                            setPeriodSelections({
                                              ...periodSelections,
                                              [p]: { ...currentConfig, customTheme: e.target.value }
                                            });
                                          }}
                                          className={styles.input}
                                          style={{ fontSize: '0.8rem', padding: '6px' }}
                                        />
                                      </>
                                    ) : (
                                      <input
                                        type="text"
                                        placeholder="テーマを入力（例: 歴史・電流など）"
                                        value={currentConfig.customTheme}
                                        onChange={e => {
                                          setPeriodSelections({
                                            ...periodSelections,
                                            [p]: { ...currentConfig, customTheme: e.target.value }
                                          });
                                        }}
                                        className={styles.input}
                                        style={{ fontSize: '0.8rem', padding: '6px' }}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {periodCount < 10 && (
                        <button 
                          onClick={() => setPeriodCount(prev => Math.min(prev + 1, 10))} 
                          className={styles.btn} 
                          style={{ marginTop: '12px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}
                        >
                          ➕ コマ数を追加 (最大10コマ)
                        </button>
                      )}

                      {/* 本日のテスト (複数追加対応) */}
                      <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#0f172a' }}>本日のテスト (自由記述):</label>
                        {todayTests.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>登録されたテストはありません。</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                            {todayTests.map((test) => (
                              <div key={test.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="text"
                                  value={test.content}
                                  onChange={e => handleUpdateTest(test.id, e.target.value)}
                                  placeholder="例: 二次方程式10問"
                                  className={styles.input}
                                  style={{ fontSize: '0.8rem', flex: 1, padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTest(test.id)}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 8px', background: '#ef4444', color: '#fff', fontSize: '0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                  削除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleAddTest}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '4px 12px', background: '#3b82f6', color: '#fff', fontSize: '0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          ➕ テストを追加
                        </button>
                      </div>

                      {/* 宿題 (複数追加対応) */}
                      <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#0f172a' }}>宿題:</label>
                        {todayHomeworks.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '8px' }}>登録された宿題はありません。</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                            {todayHomeworks.map((hw) => (
                              <div key={hw.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <textarea
                                    value={hw.content}
                                    onChange={e => handleUpdateHomework(hw.id, 'content', e.target.value)}
                                    placeholder="宿題の内容を入力（例：ワークP24-25）"
                                    className={styles.textarea}
                                    style={{ height: '40px', fontSize: '0.8rem', flex: 1, padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveHomework(hw.id)}
                                    className={styles.btn}
                                    style={{ width: 'auto', padding: '4px 8px', background: '#ef4444', color: '#fff', fontSize: '0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-start' }}
                                  >
                                    削除
                                  </button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>期限:</span>
                                  <input
                                    type="date"
                                    value={hw.deadline}
                                    onChange={e => handleUpdateHomework(hw.id, 'deadline', e.target.value)}
                                    className={styles.input}
                                    style={{ fontSize: '0.8rem', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: 'auto' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleAddHomework}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '4px 12px', background: '#3b82f6', color: '#fff', fontSize: '0.75rem', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          ➕ 宿題を追加
                        </button>
                      </div>

                      <div style={{ marginTop: '16px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>業務連絡 (本日共通):</label>
                        <textarea
                          value={commonOfficeNote}
                          onChange={e => setCommonOfficeNote(e.target.value)}
                          placeholder="業務連絡（例：提出ワーク忘れずに）"
                          className={styles.textarea}
                          style={{ height: '60px', fontSize: '0.8rem', width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      
                      <button onClick={handleSaveTimetable} className={styles.btn} style={{ marginTop: '16px' }}>
                        時間割コマ割りを保存
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: 学校カリキュラム管理 */}
              {activeTab === 'curriculum' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    学校単位のマスターカリキュラム設定 (並び順変更)
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ width: '200px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>対象学校</label>
                      <select 
                        value={selectedSchoolId}
                        onChange={e => setSelectedSchoolId(e.target.value)}
                        className={styles.select}
                      >
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: '200px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>対象教科</label>
                      <select 
                        value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}
                        className={styles.select}
                      >
                        {(() => {
                          const targetSchool = schools.find(s => s.id === selectedSchoolId);
                          const isJuniorHigh = targetSchool ? targetSchool.type === 'junior_high' : true;
                          return isJuniorHigh ? (
                            <>
                              <option value="数学">数学</option>
                              <option value="英語">英語</option>
                              <option value="理科">理科</option>
                              <option value="歴史">歴史</option>
                              <option value="地理">地理</option>
                              <option value="国語">国語</option>
                            </>
                          ) : (
                            <option value="算数">算数</option>
                          );
                        })()}
                      </select>
                    </div>
                  </div>

                  <div className={styles.curriculumList}>
                    {schoolUnits.map((unit, index) => (
                      <div key={unit.id} className={styles.curriculumItem}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {index + 1}. {unit.name} 
                          {unit.google_drive_url && (
                            <span style={{ color: '#3b82f6', fontSize: '0.75rem', marginLeft: '12px' }}>🔗 印刷リンク有</span>
                          )}
                        </span>
                        
                        <div className={styles.unitOrderBtns}>
                          <button 
                            onClick={() => moveUnit(index, 'up')} 
                            disabled={index === 0}
                            className={styles.iconBtn}
                            title="上へ移動"
                          >
                            {/* Up Icon */}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => moveUnit(index, 'down')} 
                            disabled={index === schoolUnits.length - 1}
                            className={styles.iconBtn}
                            title="下へ移動"
                          >
                            {/* Down Icon */}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: 小テスト結果 */}
              {activeTab === 'mini-tests' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    小テスト結果管理
                  </div>
                  
                  {miniTestResultsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      記録された小テスト結果はありません。
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>日付</th>
                            <th style={{ padding: '10px' }}>生徒名</th>
                            <th style={{ padding: '10px' }}>テスト内容</th>
                            <th style={{ padding: '10px', width: '100px' }}>レベル/合格点</th>
                            <th style={{ padding: '10px', width: '120px' }}>点数</th>
                            <th style={{ padding: '10px', width: '100px' }}>合否</th>
                            <th style={{ padding: '10px', width: '80px' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miniTestResultsList
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(r => {
                              const student = students.find(s => s.id === r.student_id);
                              const stLevel = student?.level || 'A';
                              const passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                              const currentScore = r.score;
                              let statusBadge = null;
                              if (currentScore !== null && currentScore !== undefined) {
                                const isPassed = currentScore >= passScore;
                                statusBadge = isPassed ? (
                                  <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>合格</span>
                                ) : (
                                  <span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>不合格</span>
                                );
                              } else {
                                statusBadge = <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>未受験</span>;
                              }
                              return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px' }}>{r.date}</td>
                                  <td style={{ padding: '10px', fontWeight: 600 }}>{student ? student.name : '不明な生徒'}</td>
                                  <td style={{ padding: '10px' }}>{r.test_content}</td>
                                  <td style={{ padding: '10px' }}>レベル{stLevel} ({passScore}点)</td>
                                  <td style={{ padding: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={tempScores[r.id] || ''}
                                        onChange={e => {
                                          setTempScores({
                                            ...tempScores,
                                            [r.id]: e.target.value
                                          });
                                        }}
                                        className={styles.input}
                                        style={{ width: '70px', padding: '4px 6px', fontSize: '0.8rem', display: 'inline-block' }}
                                        placeholder="未入力"
                                      />
                                      <span>点</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px' }}>{statusBadge}</td>
                                  <td style={{ padding: '10px' }}>
                                    <button
                                      onClick={() => handleSaveMiniTestScore(r)}
                                      className={styles.btn}
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto', background: '#3b82f6' }}
                                    >
                                      保存
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: 宿題提出状況 */}
              {activeTab === 'homeworks' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    宿題提出状況管理
                  </div>
                  
                  {homeworkResultsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      記録された宿題はありません。
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>日付</th>
                            <th style={{ padding: '10px' }}>生徒名</th>
                            <th style={{ padding: '10px' }}>宿題内容</th>
                            <th style={{ padding: '10px' }}>提出期限</th>
                            <th style={{ padding: '10px', width: '150px' }}>提出状況</th>
                            <th style={{ padding: '10px', width: '80px' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {homeworkResultsList
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map(r => {
                              const student = students.find(s => s.id === r.student_id);
                              return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px' }}>{r.date}</td>
                                  <td style={{ padding: '10px', fontWeight: 600 }}>{student ? student.name : '不明な生徒'}</td>
                                  <td style={{ padding: '10px' }}>{r.homework_content}</td>
                                  <td style={{ padding: '10px' }}>{r.homework_deadline || 'なし'}</td>
                                  <td style={{ padding: '10px' }}>
                                    <select
                                      value={tempHomeworkStatuses[r.id]}
                                      onChange={e => {
                                        setTempHomeworkStatuses({
                                          ...tempHomeworkStatuses,
                                          [r.id]: e.target.value as any
                                        });
                                      }}
                                      className={styles.select}
                                      style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                                    >
                                      <option value="incomplete">未完</option>
                                      <option value="completed">提出済み</option>
                                      <option value="skipped">スキップ</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <button
                                      onClick={() => handleSaveHomeworkStatus(r)}
                                      className={styles.btn}
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto', background: '#10b981' }}
                                    >
                                      保存
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: 定期テスト・模試・合格判定 */}
              {activeTab === 'tests' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    定期テスト・模試成績管理 ＆ 志望校合格可能性算出
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Regular Test Input */}
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>定期テスト結果記録</h4>
                      <form onSubmit={handleSaveRegularTest}>
                        <div className={styles.formGroup}>
                          <label>教科</label>
                          <select value={regularSubject} onChange={e => setRegularSubject(e.target.value)} className={styles.select}>
                            <option value="数学">数学</option>
                            <option value="英語">英語</option>
                            <option value="国語">国語</option>
                            <option value="理科">理科</option>
                            <option value="社会">社会</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>得点 (点)</label>
                          <input type="number" value={regularScore} onChange={e => setRegularScore(e.target.value)} className={styles.input} required />
                        </div>
                        <div className={styles.formGroup}>
                          <label>順位の上下</label>
                          <select value={regularRankChange} onChange={e => setRegularRankChange(e.target.value as any)} className={styles.select}>
                            <option value="up">上昇 (UP)</option>
                            <option value="down">下降 (DOWN)</option>
                            <option value="keep">維持 (KEEP)</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>上昇率 (%)</label>
                          <input type="number" step="0.1" value={regularRateChange} onChange={e => setRegularRateChange(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                          <label>次回目標点 (点)</label>
                          <input type="number" value={regularNextTarget} onChange={e => setRegularNextTarget(e.target.value)} className={styles.input} />
                        </div>
                        <div className={styles.formGroup}>
                          <label>改善点</label>
                          <textarea value={regularImprovement} onChange={e => setRegularImprovement(e.target.value)} className={styles.textarea} style={{ height: '60px' }}></textarea>
                        </div>
                        <button type="submit" className={styles.btn}>定期テスト結果を記録</button>
                      </form>
                    </div>

                    {/* Mock Exam Input */}
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>模試結果 ＆ 志望校判定</h4>
                      <form onSubmit={handleSaveMockExam}>
                        <div className={styles.formGroup}>
                          <label>模試名</label>
                          <input type="text" value={mockSubject} onChange={e => setMockSubject(e.target.value)} className={styles.input} required />
                        </div>
                        <div className={styles.formGroup}>
                          <label>総合得点 (点)</label>
                          <input type="number" value={mockScore} onChange={e => setMockScore(e.target.value)} className={styles.input} required />
                        </div>
                        <div className={styles.formGroup}>
                          <label>判定志望校</label>
                          <select value={mockTargetSchool} onChange={e => setMockTargetSchool(e.target.value)} className={styles.select} required>
                            <option value="">-- 志望校を選択 --</option>
                            {schoolCodes.map(sc => (
                              <option key={sc.code} value={sc.code}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className={styles.btn}>模試点数を入力して合格判定算出</button>
                      </form>
                    </div>
                  </div>

                  {/* Test history table */}
                  <div style={{ marginTop: '24px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>成績履歴一覧</h4>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>種類</th>
                          <th>教科 / 模試名</th>
                          <th>得点</th>
                          <th>順位上下 / 判定</th>
                          <th>上昇率</th>
                          <th>改善点 / メモ</th>
                          <th>記録日時</th>
                        </tr>
                      </thead>
                      <tbody>
                        {testRecordsList.map(tr => (
                          <tr key={tr.id}>
                            <td>{tr.record_type === 'regular_test' ? '定期テスト' : '模試'}</td>
                            <td>{tr.subject}</td>
                            <td>{tr.score}点</td>
                            <td>
                              {tr.record_type === 'regular_test' ? (
                                tr.rank_change === 'up' ? '🟢 上昇' : tr.rank_change === 'down' ? '🔴 下降' : '🟡 維持'
                              ) : (
                                <strong>{tr.improvement_plan}</strong>
                              )}
                            </td>
                            <td>{tr.rate_change ? `+${tr.rate_change}%` : '-'}</td>
                            <td>{tr.record_type === 'regular_test' ? tr.improvement_plan : '-'}</td>
                            <td>{new Date(tr.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 4: AI指導報告書生成機能 */}
              {activeTab === 'ai-report' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    <span>AI指導報告書生成機能（文体学習＆画像化）</span>
                    <button 
                      onClick={() => setIsPromptEditing(!isPromptEditing)} 
                      className={styles.btn} 
                      style={{ width: 'auto', background: '#64748b' }}
                    >
                      {isPromptEditing ? 'チューニング閉じる' : '校舎長プロンプト調整 (パターンA)'}
                    </button>
                  </div>

                  {/* Prompt Tuning area */}
                  {isPromptEditing && (
                    <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>校舎長プロンプトの調整・チューニング (パターンA)</h4>
                      <textarea
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        className={styles.textarea}
                        style={{ height: '180px', fontFamily: 'monospace' }}
                      />
                      <button onClick={handleSavePromptTemplate} className={styles.btn} style={{ width: 'auto', marginTop: '10px' }}>
                        プロンプトテンプレートを保存
                      </button>
                    </div>
                  )}

                  <div className={styles.reportFlex}>
                    {/* Inputs & actions */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>分析・生成エンジン</h4>
                      <button 
                        onClick={handleGenerateAIReport} 
                        disabled={isGeneratingAI}
                        className={styles.btn} 
                        style={{ background: 'linear-gradient(135deg, #ea580c, #f97316)', height: '48px', fontSize: '0.95rem' }}
                      >
                        {isGeneratingAI ? '学習ログをAI解析中...' : '今月の学習ログから報告書を自動生成 (AI分析ステップ)'}
                      </button>

                      {aiReportText && (
                        <div style={{ marginTop: '20px' }}>
                          <div className={styles.formGroup}>
                            <label><strong>ポジティブ分析 (AI生成された文章。手動修正で校舎長文体を学習します)</strong></label>
                            <textarea
                              value={aiReportText}
                              onChange={e => setAiReportText(e.target.value)}
                              className={styles.textarea}
                              style={{ height: '140px' }}
                            />
                            <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                              ※この文章を修正して保存すると、表現の癖がデータベースに蓄積され、使えば使うほど校舎長の文体に自動パーソナライズされます (パターンB)。
                            </p>
                          </div>

                          <div className={styles.formGroup}>
                            <label><strong>二者面談結果・目標 (講師が手動で別枠追加します)</strong></label>
                            <textarea
                              value={teacherNotes}
                              onChange={e => setTeacherNotes(e.target.value)}
                              className={styles.textarea}
                              placeholder="例：二者面談を実施し、来月の定期テストに向けて数学の一次方程式ワークを毎日2ページ進める目標をすり合わせました。"
                              style={{ height: '80px' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={handleSaveAIReport} className={styles.btn}>
                              報告書を保存 ＆ 修正履歴を学習 (パターンB)
                            </button>
                            <button onClick={handleExportAsImage} className={styles.btn} style={{ background: '#10b981' }}>
                              LINE送信用画像ファイルで出力 💾
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Preview (Paper layout) */}
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>保護者向け画像プレビュー (公式LINE送信用)</h4>
                      <div className={styles.reportImagePreview}>
                        <div ref={reportRef} className={styles.previewPaper}>
                          <div className={styles.previewHeader}>
                            <span className={styles.previewLogo}>個別指導テントル</span>
                            <span style={{ fontSize: '0.75rem' }}>2026年6月度 指導報告書</span>
                          </div>

                          <div className={styles.previewTitle}>
                            <strong>{selectedStudent.name}</strong> 殿
                          </div>

                          <div className={styles.previewSection}>
                            <div className={styles.previewSecTitle}>今月の頑張り・行動の成長 (AI分析)</div>
                            <div className={styles.previewSecContent}>
                              {aiReportText || '「自動生成」を実行してください。学習動画の総視聴時間やテスト合格結果からポジティブなトーンで作成されます。'}
                            </div>
                          </div>

                          {teacherNotes && (
                            <div className={styles.previewSection}>
                              <div className={styles.previewSecTitle}>面談結果・今後の目標</div>
                              <div className={styles.previewSecContent}>{teacherNotes}</div>
                            </div>
                          )}

                          <div style={{ borderTop: '1px solid #ea580c', paddingTop: '10px', marginTop: '30px', fontSize: '0.65rem', color: '#78716c', textAlign: 'center' }}>
                            © Individual Learning Management System - Tentoru Control Tower
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 7: 年間計画 (マイルストーン可視化) */}
              {activeTab === 'milestones' && (
                <div className={styles.card}>
                  <div className={styles.cardTitle}>
                    <span>年間基準計画（マイルストーン）カスタマイズ設定</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>
                      レベル別に出し分け、章や単元（授業テーマ）の順序調整・削除・追加、休校日設定、およびテンプレート保存・呼び出しが可能です。
                    </span>
                  </div>

                  <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Subject select */}
                      <div>
                        <label style={{ marginRight: '8px', fontSize: '0.85rem', fontWeight: 600 }}>対象教科:</label>
                        <select 
                          value={selectedSubject} 
                          onChange={e => setSelectedSubject(e.target.value)} 
                          className={styles.select}
                          style={{ width: '120px', padding: '6px' }}
                        >
                          {selectedStudent.grade.startsWith('中') ? (
                            <>
                              <option value="数学">数学</option>
                              <option value="英語">英語</option>
                              <option value="理科">理科</option>
                              <option value="歴史">歴史</option>
                              <option value="地理">地理</option>
                              <option value="国語">国語</option>
                            </>
                          ) : (
                            <option value="算数">算数</option>
                          )}
                        </select>
                      </div>

                      {/* Level Toggle switch */}
                      <div>
                        <label style={{ marginRight: '8px', fontSize: '0.85rem', fontWeight: 600 }}>学習レベル:</label>
                        <div className={styles.segmentControl} style={{ display: 'inline-flex' }}>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${selectedLevel === 'A' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setSelectedLevel('A')}
                          >
                            レベルA (発展)
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${selectedLevel === 'B' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setSelectedLevel('B')}
                          >
                            レベルB (標準)
                          </button>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${selectedLevel === 'C' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setSelectedLevel('C')}
                          >
                            レベルC (基礎)
                          </button>
                        </div>
                      </div>

                      {/* Month filter toggle */}
                      <div>
                        <label style={{ marginRight: '8px', fontSize: '0.85rem', fontWeight: 600 }}>表示月:</label>
                        <div className={styles.segmentControl} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '2px' }}>
                          <button
                            type="button"
                            className={`${styles.segmentBtn} ${selectedMonthFilter === 'all' ? styles.segmentBtnActive : ''}`}
                            onClick={() => setSelectedMonthFilter('all')}
                            style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                          >
                            すべて
                          </button>
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => (
                            <button
                              key={m}
                              type="button"
                              className={`${styles.segmentBtn} ${selectedMonthFilter === m ? styles.segmentBtnActive : ''}`}
                              onClick={() => setSelectedMonthFilter(m)}
                              style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                            >
                              {m}月
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.9rem' }}>
                        現在の日付: <strong style={{ color: '#4f46e5' }}>{scheduleDate}</strong>
                      </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />

                    {/* Template theme Save & Apply CRUD section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ margin: '0', fontSize: '0.9rem', fontWeight: 700 }}>授業テーマ・計画テンプレート管理</h4>
                      
                      {/* Save Template */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          placeholder="現在の計画をテンプレート名として保存（自由記述）..."
                          value={newTemplateName}
                          onChange={e => setNewTemplateName(e.target.value)}
                          className={styles.input}
                          style={{ maxWidth: '350px', fontSize: '0.85rem' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTemplate(newTemplateName)}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem', background: '#3b82f6' }}
                        >
                          計画テンプレートを保存
                        </button>
                      </div>

                      {/* Saved Templates Dropdown & Actions */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>保存済みテンプレート:</label>
                        <select
                          value={selectedTemplateId}
                          onChange={e => {
                            setSelectedTemplateId(e.target.value);
                            setEditingTemplateId(null);
                          }}
                          className={styles.select}
                          style={{ width: '380px', padding: '6px', fontSize: '0.85rem' }}
                        >
                          <option value="">-- テンプレートを選択 --</option>
                          {milestoneTemplates
                            .map(t => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.grade} {t.subject} レベル{t.level === 'A' ? 'A (発展)' : t.level === 'B' ? 'B (標準)' : 'C (基礎)'} - {t.plans.length}行)
                              </option>
                            ))}
                        </select>

                        {selectedTemplateId && (
                          <>
                            {editingTemplateId === selectedTemplateId ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={editingTemplateName}
                                  onChange={e => setEditingTemplateName(e.target.value)}
                                  className={styles.input}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', width: '200px' }}
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleUpdateTemplateName(selectedTemplateId, editingTemplateName);
                                    setEditingTemplateId(null);
                                  }}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', background: '#10b981' }}
                                >
                                  保存
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTemplateId(null)}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 10px', fontSize: '0.75rem', background: '#64748b' }}
                                >
                                  キャンセル
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleApplyTemplate(selectedTemplateId)}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem', background: '#10b981' }}
                                >
                                  呼び出して適用
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const t = milestoneTemplates.find(x => x.id === selectedTemplateId);
                                    if (t) {
                                      setEditingTemplateId(t.id);
                                      setEditingTemplateName(t.name);
                                    }
                                  }}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem', background: '#e2e8f0', color: '#0f172a', border: '1px solid #cbd5e1' }}
                                >
                                  名称変更
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm('このテンプレートを削除してもよろしいですか？')) {
                                      await handleDeleteTemplate(selectedTemplateId);
                                      setSelectedTemplateId('');
                                    }
                                  }}
                                  className={styles.btn}
                                  style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem', background: '#ef4444' }}
                                >
                                  削除
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />

                    {/* Chapter Ordering section */}
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 700 }}>章ごと(単元ごと)での順番変更</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {Array.from(new Set(getFilteredMilestones().map(p => p.chapter).filter(Boolean))).map((chName) => (
                          <div key={chName as string} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                            <span>{chName as string}</span>
                            <button
                              type="button"
                              onClick={() => handleMoveChapter(chName as string, 'up')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                              title="章を上へ移動"
                            >
                              🔼
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveChapter(chName as string, 'down')}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}
                              title="章を下へ移動"
                            >
                              🔽
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />

                    {/* Add Milestone Row form */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: '0', fontSize: '0.9rem', fontWeight: 700 }}>行の追加:</h4>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select 
                          id="add-month-select"
                          value={addMonth} 
                          onChange={e => setAddMonth(parseInt(e.target.value))}
                          className={styles.select} 
                          style={{ width: '80px', padding: '4px' }}
                        >
                          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3].map(m => (
                            <option key={m} value={m}>{m}月</option>
                          ))}
                        </select>
                        <select 
                          id="add-week-select"
                          value={addWeek} 
                          onChange={e => setAddWeek(parseInt(e.target.value))}
                          className={styles.select} 
                          style={{ width: '80px', padding: '4px' }}
                        >
                          {[1, 2, 3, 4, 5].map(w => (
                            <option key={w} value={w}>{w}週目</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleAddMilestoneRow(addMonth, addWeek)}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '4px 12px', fontSize: '0.8rem', background: '#10b981' }}
                        >
                          ➕ 行を追加
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* スプレッドシート風グリッド */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #cbd5e1', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '70px', textAlign: 'center' }}>月</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '70px', textAlign: 'center' }}>週</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '180px', textAlign: 'left' }}>章</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '380px', textAlign: 'left' }}>単元名</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '130px', textAlign: 'center' }}>進捗</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '10px', width: '160px', textAlign: 'center' }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDisplayMilestones()
                          .map((plan, idx, arr) => {
                            const { month: currMonth, week_number: currWeek } = getYearMonthWeek(scheduleDate);
                            const isTodayWeek = plan.month === currMonth && plan.week_number === currWeek;
 
                            // 生徒の現在進捗を取得
                            const studentCompletedTasks = studentTasks.filter(t => t.status === 'completed');
                            const subjectUnits = allCurriculumUnits.filter(u => u.subject === selectedSubject);
                            const subjectUnitIds = new Set(subjectUnits.map(u => u.id));
                            const completedSubjectTasks = studentCompletedTasks.filter(t => subjectUnitIds.has(t.unit_id));
 
                            let studentSeq = 0;
                            if (completedSubjectTasks.length > 0) {
                              const completedUnitIds = completedSubjectTasks.map(t => t.unit_id);
                              const completedUnits = subjectUnits.filter(u => completedUnitIds.includes(u.id));
                              studentSeq = Math.max(0, ...completedUnits.map(u => u.sequence_order));
                            } else if (selectedStudent && selectedStudent.start_unit_id) {
                              const startUnit = subjectUnits.find(u => u.id === selectedStudent.start_unit_id);
                              if (startUnit) {
                                studentSeq = startUnit.sequence_order - 1;
                              }
                            }
 
                            const target = plan.target_sequence_order || 0;
                            const isStudentCompleted = studentSeq >= target;
 
                            let rowBg = '#ffffff';
                            let rowBorder = '1px solid #cbd5e1';
                            if (plan.is_holiday) {
                              rowBg = '#fef2f2';
                            } else if (isTodayWeek) {
                              rowBg = '#eff6ff';
                              rowBorder = '2px solid #3b82f6';
                            }
 
                            // 文字数に応じてフォントサイズを動的に決定
                            const themeName = plan.target_theme_name || '';
                            const selectFontSize = themeName.length > 25 ? '0.65rem' : (themeName.length > 18 ? '0.7rem' : (themeName.length > 12 ? '0.75rem' : '0.8rem'));
 
                            return (
                              <tr 
                                key={plan.id} 
                                style={{ 
                                  backgroundColor: rowBg, 
                                  fontWeight: isTodayWeek ? 'bold' : 'normal',
                                  border: rowBorder,
                                  cursor: 'grab',
                                  opacity: draggedId === plan.id ? 0.4 : 1
                                }}
                                draggable="true"
                                onDragStart={(e) => {
                                  setDraggedId(plan.id);
                                  if (e.dataTransfer) {
                                    e.dataTransfer.effectAllowed = 'move';
                                  }
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  if (draggedId && draggedId !== plan.id) {
                                    handleReorderMilestones(draggedId, plan.id);
                                  }
                                  setDraggedId(null);
                                }}
                                onDragEnd={() => setDraggedId(null)}
                              >
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                                  {plan.month}月
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                                  {plan.week_number}週
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                                  <input
                                    type="text"
                                    value={plan.chapter || ''}
                                    placeholder="例: 第1章 正の数・負の数"
                                    disabled={plan.is_holiday}
                                    onChange={e => handleUpdateMilestoneField(plan.id, 'chapter', e.target.value)}
                                    className={styles.input}
                                    style={{ fontSize: '0.8rem', padding: '4px' }}
                                  />
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px' }}>
                                  {!plan.is_holiday ? (
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      <select
                                        value={plan.target_theme_name || ''}
                                        onChange={e => handleUpdateMilestoneField(plan.id, 'target_theme_name', e.target.value)}
                                        className={styles.select}
                                        style={{ fontSize: selectFontSize, width: '320px', padding: '4px' }}
                                      >
                                        <option value="">-- テーマを選択 --</option>
                                        {subjectUnits.map(u => (
                                          <option key={u.id} value={u.name}>({u.sequence_order}) {u.name}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        value={plan.target_sequence_order || 0}
                                        onChange={e => handleUpdateMilestoneTargetOrder(plan.id, parseInt(e.target.value) || 0)}
                                        className={styles.input}
                                        style={{ width: '50px', fontSize: '0.8rem', padding: '4px' }}
                                        title="目標到達シーケンス順序"
                                      />
                                    </div>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      <span style={{ color: '#be123c', fontSize: '0.75rem', fontWeight: 'bold', marginRight: '8px' }}>
                                        🎉 {plan.holiday_name || '休校日'}
                                      </span>
                                      <input
                                        type="text"
                                        value={plan.holiday_name || ''}
                                        placeholder="休校理由を入力"
                                        onChange={e => handleUpdateHolidayName(plan.id, e.target.value)}
                                        className={styles.input}
                                        style={{ fontSize: '0.8rem', padding: '4px', flex: 1 }}
                                      />
                                    </div>
                                  )}
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                                  {!plan.is_holiday ? (
                                    <span 
                                      style={{ 
                                        display: 'inline-block', 
                                        backgroundColor: '#10b981', 
                                        color: '#ffffff', 
                                        padding: '4px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.75rem', 
                                        fontWeight: 'bold' 
                                      }}
                                    >
                                      {`📍 ${studentSeq}テーマ`}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    {(() => {
                                      const allFiltered = getFilteredMilestones();
                                      const globalIdx = allFiltered.findIndex(x => x.id === plan.id);
                                      const isFirstGlobal = globalIdx === 0;
                                      const isLastGlobal = globalIdx === allFiltered.length - 1;
                                      return (
                                        <>
                                          <button
                                            type="button"
                                            disabled={isFirstGlobal}
                                            onClick={() => handleReorderMilestones(plan.id, allFiltered[globalIdx - 1].id)}
                                            className={styles.btn}
                                            style={{ padding: '2px 6px', fontSize: '0.75rem', width: 'auto', background: '#cbd5e1', color: '#0f172a' }}
                                            title="上へ"
                                          >
                                            ▲
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isLastGlobal}
                                            onClick={() => handleReorderMilestones(plan.id, allFiltered[globalIdx + 1].id)}
                                            className={styles.btn}
                                            style={{ padding: '2px 6px', fontSize: '0.75rem', width: 'auto', background: '#cbd5e1', color: '#0f172a' }}
                                            title="下へ"
                                          >
                                            ▼
                                          </button>
                                        </>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleHoliday(plan.id)}
                                      className={styles.btn}
                                      style={{ padding: '2px 6px', fontSize: '0.75rem', width: 'auto', background: plan.is_holiday ? '#475569' : '#e2e8f0', color: plan.is_holiday ? '#fff' : '#0f172a', border: '1px solid #cbd5e1' }}
                                      title="休校日の切り替え"
                                    >
                                      📅
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMilestoneRow(plan.id)}
                                      className={styles.btn}
                                      style={{ padding: '2px 6px', fontSize: '0.75rem', width: 'auto', background: '#ef4444' }}
                                      title="行削除"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
                    <p style={{ margin: '0 0 4px 0' }}><strong>💡 マイルストーン計画のカスタマイズについて:</strong></p>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      <li>各セルのテキストボックスやプルダウンから、章名・単元名・到達順序をインラインで直接編集できます。</li>
                      <li><strong>📅 ボタン:</strong> その週を休校日（イベント日）にトグル切り替えします。オンの時は `holiday_name` が入力可能になります。</li>
                      <li><strong>📍バッジ:</strong> 選択された生徒が今日までに完了したテーマ数（現在地）を示しています。</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'student-detail' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
                  
                  {/* Left Column: Basic Information & Personality */}
                  <div className={styles.card}>
                    <div className={styles.cardTitle} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                      <span>基本情報・属性設定</span>
                    </div>

                    <form onSubmit={handleSaveStudentDetail}>
                      {/* Avatar and Name */}
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{
                          width: '72px',
                          height: '72px',
                          borderRadius: '50%',
                          backgroundColor: '#4f46e5',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.8rem',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          overflow: 'hidden'
                        }}>
                          {editForm.image_url ? (
                            <img src={editForm.image_url} alt="顔写真" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            selectedStudent.name.charAt(0)
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ flex: 2 }}>
                              <input 
                                type="text" 
                                value={editForm.name || ''} 
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className={styles.input} 
                                placeholder="氏名（漢字）"
                                required
                              />
                            </div>
                            <div style={{ flex: 2 }}>
                              <input 
                                type="text" 
                                value={editForm.name_kana || ''} 
                                onChange={e => setEditForm({ ...editForm, name_kana: e.target.value })}
                                className={styles.input} 
                                placeholder="氏名（フリガナ）"
                              />
                            </div>
                          </div>
                          <input 
                            type="text" 
                            value={editForm.image_url || ''} 
                            onChange={e => setEditForm({ ...editForm, image_url: e.target.value })}
                            className={styles.input} 
                            placeholder="顔写真画像URL (ダミー画像URLなど)"
                            style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                          />
                        </div>
                      </div>

                      {/* Detail Form Fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className={styles.formGroup}>
                          <label>学校名</label>
                          <input 
                            type="text" 
                            value={editForm.school_name || schools.find(s => s.id === editForm.school_id)?.name || ''} 
                            onChange={e => {
                              const typedName = e.target.value;
                              const matched = schools.find(s => s.name === typedName);
                              setEditForm({ 
                                ...editForm, 
                                school_name: typedName,
                                school_id: matched ? matched.id : editForm.school_id 
                              });
                            }}
                            className={styles.input}
                            placeholder="学校名"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="student-grade">学年（登録時の学年を反映）</label>
                          <select 
                            id="student-grade"
                            value={editForm.grade} 
                            onChange={e => setEditForm({ ...editForm, grade: e.target.value })}
                            className={styles.select}
                          >
                            {GRADES.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className={styles.formGroup}>
                          <label htmlFor="edit-student-birthday">生年月日</label>
                          <input 
                            id="edit-student-birthday"
                            type="date" 
                            value={editForm.birthday || ''} 
                            onChange={e => setEditForm({ ...editForm, birthday: e.target.value })}
                            className={styles.input}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="edit-student-level">学習レベル</label>
                          <select 
                            id="edit-student-level"
                            value={editForm.level} 
                            onChange={e => setEditForm({ ...editForm, level: e.target.value as any })}
                            className={styles.select}
                          >
                            <option value="A">レベルA (発展)</option>
                            <option value="B">レベルB (標準)</option>
                            <option value="C">レベルC (基礎)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className={styles.formGroup}>
                          <label>教室</label>
                          <select 
                            value={editForm.classroom} 
                            onChange={e => setEditForm({ ...editForm, classroom: e.target.value })}
                            className={styles.select}
                          >
                            <option value="">-- 指定なし --</option>
                            <option value="恵比寿教室">恵比寿教室</option>
                            <option value="渋谷教室">渋谷教室</option>
                            <option value="新宿教室">新宿教室</option>
                          </select>
                        </div>
                        <div className={styles.formGroup}>
                          <label>担当講師</label>
                          <select 
                            value={editForm.teacher_in_charge} 
                            onChange={e => setEditForm({ ...editForm, teacher_in_charge: e.target.value })}
                            className={styles.select}
                          >
                            <option value="">-- 指定なし --</option>
                            <option value="福田 尚弘">福田 尚弘</option>
                            <option value="鈴木 健太郎">鈴木 健太郎</option>
                            <option value="佐藤 舞">佐藤 舞</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className={styles.formGroup}>
                          <label>部活（自由記述）</label>
                          <input 
                            type="text" 
                            value={editForm.club_activities || ''} 
                            onChange={e => setEditForm({ ...editForm, club_activities: e.target.value })}
                            className={styles.input}
                            placeholder="例: サッカー部"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>趣味（自由記述）</label>
                          <input 
                            type="text" 
                            value={editForm.hobbies || ''} 
                            onChange={e => setEditForm({ ...editForm, hobbies: e.target.value })}
                            className={styles.input}
                            placeholder="例: 将棋・動画編集"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                        <div className={styles.formGroup}>
                          <label>保護者名</label>
                          <input 
                            type="text" 
                            value={editForm.parent_name || ''} 
                            onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })}
                            className={styles.input}
                            placeholder="例: 佐藤 健二"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>志望校</label>
                          <input 
                            type="text" 
                            value={editForm.target_school || ''} 
                            onChange={e => setEditForm({ ...editForm, target_school: e.target.value })}
                            className={styles.input}
                            placeholder="例: 天登星雲高校"
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div className={styles.formGroup}>
                          <label>連絡先 (電話番号)</label>
                          <input 
                            type="text" 
                            value={editForm.contact_phone || ''} 
                            onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })}
                            className={styles.input}
                            placeholder="例: 090-7039-0656"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label>連絡可能時間帯</label>
                          <input 
                            type="text" 
                            value={editForm.contact_time || ''} 
                            onChange={e => setEditForm({ ...editForm, contact_time: e.target.value })}
                            className={styles.input}
                            placeholder="例: 18:00 - 21:00"
                          />
                        </div>
                      </div>

                      {/* Personality Tag Area */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>個性</h4>
                        
                        {/* Selected Tags list */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                          {editForm.personalities!.length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>個性タグが登録されていません。</span>
                          ) : (
                            editForm.personalities!.map((tag, i) => {
                              const colors = [
                                { bg: '#e0e7ff', text: '#3730a3', border: '#4338ca' },
                                { bg: '#dcfce7', text: '#166534', border: '#15803d' },
                                { bg: '#fef3c7', text: '#92400e', border: '#b45309' },
                                { bg: '#f3e8ff', text: '#6b21a8', border: '#7e22ce' },
                                { bg: '#ffe4e6', text: '#9f1239', border: '#be123c' }
                              ];
                              const color = colors[i % colors.length];
                              return (
                                <span 
                                  key={tag} 
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    backgroundColor: color.bg,
                                    color: color.text,
                                    padding: '4px 10px',
                                    borderRadius: '16px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    border: `1px solid ${color.bg}`
                                  }}
                                >
                                  {tag}
                                  <button 
                                    type="button"
                                    onClick={() => handleRemovePersonality(tag)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: color.text,
                                      cursor: 'pointer',
                                      padding: 0,
                                      fontSize: '0.85rem',
                                      lineHeight: 1,
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })
                          )}
                        </div>

                        {/* Add tags interface */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ flex: 1 }}>
                            <label htmlFor="personality-master" style={{ fontSize: '0.75rem', color: '#475569', display: 'block', marginBottom: '4px' }}>マスタから選ぶ</label>
                            <select 
                              id="personality-master"
                              value={selectedPersonalityFromMaster} 
                              onChange={e => {
                                setSelectedPersonalityFromMaster(e.target.value);
                                setNewPersonalityInput('');
                              }}
                              className={styles.select}
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            >
                              <option value="">-- 選択肢から選ぶ --</option>
                              {personalityOptions.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', color: '#475569', display: 'block', marginBottom: '4px' }}>新しく書いて追加</label>
                            <input 
                              type="text" 
                              value={newPersonalityInput} 
                              onChange={e => {
                                setNewPersonalityInput(e.target.value);
                                setSelectedPersonalityFromMaster('');
                              }}
                              placeholder="新しい個性を入力..."
                              className={styles.input}
                              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={handleAddPersonality}
                            className={styles.btn}
                            style={{ width: 'auto', padding: '6px 12px', background: '#3b82f6', height: '34px', display: 'flex', alignItems: 'center' }}
                          >
                            ＋ 追加
                          </button>
                        </div>
                      </div>

                      <button type="submit" className={styles.btn} style={{ background: '#10b981' }}>
                        変更を保存する
                      </button>
                    </form>
                  </div>

                  {/* Right Column: Interaction Logs & Test Records */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* Test Results Summary Card */}
                    <div className={styles.card}>
                      <div className={styles.cardTitle} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                        <span>直近のテスト・模試実績</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        
                        {/* Regular Test card */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>定期テスト（最新）</h4>
                          {(() => {
                            const latestRegularTest = testRecordsList
                              .filter(r => r.student_id === selectedStudent.id && r.record_type === 'regular_test')
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                            return latestRegularTest ? (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' }}>{latestRegularTest.subject}</span>
                                  <span style={{ fontSize: '1.8rem', fontWeight: 'extrabold', color: '#4f46e5' }}>{latestRegularTest.score}<span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}> 点</span></span>
                                </div>
                                {latestRegularTest.rank_change && (
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '8px' }}>
                                    <span>順位変動: 
                                      <span style={{ 
                                        color: latestRegularTest.rank_change === 'up' ? '#10b981' : latestRegularTest.rank_change === 'down' ? '#ef4444' : '#64748b',
                                        fontWeight: 'bold',
                                        marginLeft: '4px'
                                      }}>
                                        {latestRegularTest.rank_change === 'up' ? '▲ 上昇' : latestRegularTest.rank_change === 'down' ? '▼ 下降' : 'キープ'}
                                      </span>
                                    </span>
                                    {latestRegularTest.rate_change && (
                                      <span>({latestRegularTest.rate_change > 0 ? '+' : ''}{latestRegularTest.rate_change}%)</span>
                                    )}
                                  </div>
                                )}
                                {latestRegularTest.next_target_score && (
                                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '6px' }}>
                                    次回目標: <strong>{latestRegularTest.next_target_score}点</strong>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>定期テスト記録がありません。</span>
                            );
                          })()}
                        </div>

                        {/* Mock Exam card */}
                        <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#475569', fontWeight: 'bold' }}>模試実績（最新）</h4>
                          {(() => {
                            const latestMockExam = testRecordsList
                              .filter(r => r.student_id === selectedStudent.id && r.record_type === 'mock_exam')
                              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                            return latestMockExam ? (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1e293b' }}>{latestMockExam.subject}</span>
                                  <span style={{ fontSize: '1.8rem', fontWeight: 'extrabold', color: '#059669' }}>{latestMockExam.score}<span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}> 点</span></span>
                                </div>
                                {latestMockExam.target_school_code && (
                                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    志望校: <strong>{schoolCodes.find(c => c.code === latestMockExam.target_school_code)?.name || latestMockExam.target_school_code}</strong>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>模試の記録がありません。</span>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Learning Status */}
                      <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#eef2f6', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: '#334155', fontWeight: 'bold' }}>現在の学習状況</h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                          <span>完了単元数: <strong>{studentTasks.filter(t => t.status === 'completed').length}</strong> / {studentTasks.length}</span>
                          <span>進捗率: <strong>{studentTasks.length > 0 ? Math.round((studentTasks.filter(t => t.status === 'completed').length / studentTasks.length) * 100) : 0}%</strong></span>
                          <span>アラート失敗数: <strong style={{ color: studentTasks.filter(t => t.status === 'failed').length > 0 ? '#ef4444' : '#475569' }}>{studentTasks.filter(t => t.status === 'failed').length}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Interactions Card */}
                    <div className={styles.card}>
                      <div className={styles.cardTitle} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                        <span>対応入力</span>
                      </div>

                      <form onSubmit={handleAddInteraction} style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div className={styles.formGroup}>
                            <label htmlFor="interaction-category">種別</label>
                            <select 
                              id="interaction-category"
                              value={interactionCategory} 
                              onChange={e => setInteractionCategory(e.target.value as any)}
                              className={styles.select}
                            >
                              <option value="保護者対応">保護者対応</option>
                              <option value="人生相談">人生相談</option>
                              <option value="勉強相談">勉強相談</option>
                              <option value="学校相談">学校相談</option>
                              <option value="その他">その他</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="interaction-date">日付</label>
                            <input 
                              id="interaction-date"
                              type="date" 
                              value={interactionDate} 
                              onChange={e => setInteractionDate(e.target.value)}
                              className={styles.input}
                            />
                          </div>
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '12px' }}>
                          <label>メモ</label>
                          <textarea 
                            value={interactionMemo} 
                            onChange={e => setInteractionMemo(e.target.value)}
                            className={styles.textarea}
                            placeholder="具体的な対応メモを入力..."
                            rows={3}
                            required
                          />
                        </div>
                        <button type="submit" className={styles.btn} style={{ background: '#22c55e' }}>
                          対応内容を登録
                        </button>
                      </form>

                      {/* Interaction Timeline List */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700 }}>対応履歴</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                          {interactions.length === 0 ? (
                            <span style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>対応履歴はまだありません。</span>
                          ) : (
                            interactions.map(item => (
                              <div 
                                key={item.id} 
                                style={{
                                  backgroundColor: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  position: 'relative'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                      {item.date.replace(/-/g, '/')}
                                    </span>
                                    <span style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold',
                                      backgroundColor: item.category === '保護者対応' ? '#ffe4e6' : item.category === '人生相談' ? '#f3e8ff' : item.category === '勉強相談' ? '#e0e7ff' : item.category === '学校相談' ? '#dcfce7' : '#f1f5f9',
                                      color: item.category === '保護者対応' ? '#9f1239' : item.category === '人生相談' ? '#6b21a8' : item.category === '勉強相談' ? '#3730a3' : item.category === '学校相談' ? '#166534' : '#334155',
                                      padding: '2px 8px',
                                      borderRadius: '4px'
                                    }}>
                                      {item.category}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    backgroundColor: '#3b82f6',
                                    color: '#ffffff',
                                    padding: '2px 8px',
                                    borderRadius: '12px'
                                  }}>
                                    {item.staff_name}
                                  </span>
                                </div>
                                <div style={{ 
                                  fontSize: '0.85rem', 
                                  color: '#334155', 
                                  whiteSpace: 'pre-wrap', 
                                  lineHeight: 1.5 
                                }}>
                                  {item.memo}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                    </div>

                  </div>
                </div>
              )}
            </>
          )
          )}
        </div>
      </div>
    </div>
  );
}
