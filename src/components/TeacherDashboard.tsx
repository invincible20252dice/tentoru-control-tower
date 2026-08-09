import React, { useState, useEffect, useRef } from 'react';
import styles from './TeacherDashboard.module.css';
import { StudentScheduleConfigForm } from './StudentScheduleConfigForm';
import { HorizontalDatePicker } from './HorizontalDatePicker';
import { BranchManagement } from './BranchManagement';
import { Building2 } from 'lucide-react';
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
  CustomClass,
  MilestonePlan,
  MilestoneTemplate,
  TargetSchoolItem,
  GRADES,
  StudentInteraction,
  getSchoolYear,
  Branch,
  UserRole
} from '../lib/db';
import { 
  rescheduleDelayedTasks, 
  reorganizeFutureTasks, 
  rescheduleFutureUncompletedTasks,
  calculateMockExamPassRate, 
  learnFromTeacherCorrections, 
  generateAIReportText,
  PersonalStyle,
  calculateProgressGap,
  getYearMonthWeek
} from '../lib/scheduler';
import html2canvas from 'html2canvas';
import { getGeminiApiKey, saveGeminiApiKey, analyzeReportCardImage } from '../lib/gemini';

interface TeacherDashboardProps {
  onBackToPortal: () => void;
  onLogout?: () => void;
  onViewStudentScreen?: (student: Student) => void;
  theme?: 'light' | 'dark';
  teacherType?: 'elementary' | 'junior_high' | 'high_school';
  initialRole?: UserRole;
  initialBranchId?: string;
}

export default function TeacherDashboard({ onBackToPortal, onLogout, onViewStudentScreen, theme = 'light', teacherType, initialRole, initialBranchId }: TeacherDashboardProps) {
  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [userRole, setUserRole] = useState<UserRole>(initialRole || 'admin');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || 'all');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'curriculum' | 'mini-tests' | 'homeworks' | 'tests' | 'ai-report' | 'milestones' | 'student-list' | 'create-student' | 'student-detail' | 'branches'>('student-list');
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
  const [filterCategory, setFilterCategory] = useState<'all' | 'junior_high' | 'elementary' | 'high_school'>(() => {
    if (teacherType === 'elementary') return 'elementary';
    if (teacherType === 'junior_high') return 'junior_high';
    if (teacherType === 'high_school') return 'high_school';
    return 'all';
  });
  const [filterName, setFilterName] = useState<string>('');

  // Account Issuance State
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState(() => {
    if (teacherType === 'elementary') return '小1';
    if (teacherType === 'high_school') return '高1';
    return '中1';
  });

  useEffect(() => {
    if (teacherType === 'elementary') {
      setFilterCategory('elementary');
      setNewStudentGrade('小1');
    } else if (teacherType === 'junior_high') {
      setFilterCategory('junior_high');
      setNewStudentGrade('中1');
    } else if (teacherType === 'high_school') {
      setFilterCategory('high_school');
      setNewStudentGrade('高1');
    }
  }, [teacherType]);
  const [newStudentSchoolId, setNewStudentSchoolId] = useState('');
  const [newCustomSchoolName, setNewCustomSchoolName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitLinkUrl, setNewUnitLinkUrl] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');
  const [editingUnitLinkUrl, setEditingUnitLinkUrl] = useState('');
  const [customClassesList, setCustomClassesList] = useState<CustomClass[]>([]);
  const [newCustomClassName, setNewCustomClassName] = useState('');

  // Curriculum State
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('数学');
  const [schoolUnits, setSchoolUnits] = useState<CurriculumUnit[]>([]);

  // Daily Scheduler State
  const [scheduleDate, setScheduleDate] = useState('2026-06-19');
  const [studentTasks, setStudentTasks] = useState<LearningTask[]>([]);
  const [applyScope, setApplyScope] = useState<'individual' | 'school' | 'grade' | 'level'>('individual');
  
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
  const [todayTests, setTodayTests] = useState<{ id: string; content: string; passingLine?: string; targetScope?: string }[]>([]);
  const [todayHomeworks, setTodayHomeworks] = useState<{ id: string; content: string; deadline: string; targetScope?: string }[]>([]);
  const [miniTestSearchQuery, setMiniTestSearchQuery] = useState('');
  const [homeworkSearchQuery, setHomeworkSearchQuery] = useState('');
  const [showApiKeySetting, setShowApiKeySetting] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');

  // 小テスト管理用フィルター・ソート State
  const [miniTestGradeFilter, setMiniTestGradeFilter] = useState('all');
  const [miniTestSubjectFilter, setMiniTestSubjectFilter] = useState('all');
  const [miniTestSortOrder, setMiniTestSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'unsubmitted_first' | 'passed_first'>('date_desc');

  // 宿題管理用フィルター・ソート State
  const [homeworkGradeFilter, setHomeworkGradeFilter] = useState('all');
  const [homeworkSubjectFilter, setHomeworkSubjectFilter] = useState('all');
  const [homeworkSortOrder, setHomeworkSortOrder] = useState<'date_desc' | 'date_asc' | 'name_asc' | 'unsubmitted_first' | 'completed_first'>('date_desc');

  // 小テスト結果リスト
  const [miniTestResultsList, setMiniTestResultsList] = useState<MiniTestResult[]>([]);
  const [tempScores, setTempScores] = useState<Record<string, string>>({});
  const [tempPassedStatuses, setTempPassedStatuses] = useState<Record<string, string>>({});

  // 宿題提出状況リスト
  const [homeworkResultsList, setHomeworkResultsList] = useState<HomeworkResult[]>([]);
  const [tempHomeworkStatuses, setTempHomeworkStatuses] = useState<Record<string, 'incomplete' | 'completed' | 'skipped'>>({});

  // Start Unit position State
  const [startUnitId, setStartUnitId] = useState<string>('');

  // Test & Grade State
  const [regularTestName, setRegularTestName] = useState('');
  const [regularScoreJapanese, setRegularScoreJapanese] = useState('');
  const [regularScoreMath, setRegularScoreMath] = useState('');
  const [regularScoreEnglish, setRegularScoreEnglish] = useState('');
  const [regularScoreSocial, setRegularScoreSocial] = useState('');
  const [regularScoreScience, setRegularScoreScience] = useState('');
  const [regularScoreTotal, setRegularScoreTotal] = useState('');
  const [regularClassRank, setRegularClassRank] = useState('');
  const [regularSchoolRank, setRegularSchoolRank] = useState('');
  const [regularDeviation, setRegularDeviation] = useState('');
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

  // 新規生徒アカウント発行時の所属学校の自動初期値セット
  useEffect(() => {
    if (activeTab === 'create-student') {
      if (newStudentSchoolId === 'add_new') return;
      const filtered = schools.filter(s => {
        const isElem = newStudentGrade.startsWith('小') || newStudentGrade === '園児';
        const isJhs = newStudentGrade.startsWith('中') || newStudentGrade.startsWith('高') || newStudentGrade === '既卒';
        if (isElem) return s.type === 'elementary';
        if (isJhs) return s.type === 'junior_high';
        return true;
      });
      if (filtered.length > 0) {
        const exists = filtered.some(s => s.id === newStudentSchoolId);
        if (!exists) {
          setNewStudentSchoolId(filtered[0].id);
        }
      } else {
        setNewStudentSchoolId('add_new');
      }
    }
  }, [activeTab, newStudentGrade, schools, newStudentSchoolId]);

  // Load Initial Data
  const loadData = () => {
    setApplyScope('individual');
    const listSt = db.getStudents();
    const listSch = db.getSchools();
    const listCodes = db.getSchoolCodesMaster();
    const listEth = db.getExamThresholdsMaster();
    const listMps = db.getMilestonePlans();
    const listUnits = db.getCurriculumUnits();
    const listTemplates = db.getMilestoneTemplates();
    const listCc = db.getCustomClasses();
    const listBranches = db.getBranches();

    setStudents(listSt);
    setSchools(listSch);
    setSchoolCodes(listCodes);
    setExamThresholds(listEth);
    setMilestonePlans(listMps);
    setAllCurriculumUnits(listUnits);
    setMilestoneTemplates(listTemplates);
    setCustomClassesList(listCc);
    setBranches(listBranches);

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

        let initialTargetSchools: TargetSchoolItem[] = [];
        if (freshSt.target_schools && Array.isArray(freshSt.target_schools) && freshSt.target_schools.length > 0) {
          initialTargetSchools = freshSt.target_schools;
        } else if (freshSt.target_school) {
          initialTargetSchools = [{ school_name: freshSt.target_school, course_name: '' }];
        } else {
          initialTargetSchools = [{ school_name: '', course_name: '' }];
        }

        setEditForm({
          name: freshSt.name,
          name_kana: freshSt.name_kana || '',
          birthday: freshSt.birthday || '',
          grade: freshSt.grade,
          school_id: freshSt.school_id,
          club_activities: freshSt.club_activities || '',
          hobbies: freshSt.hobbies || '',
          parent_name: freshSt.parent_name || '',
          parent_name_kana: freshSt.parent_name_kana || '',
          parent_image_url: freshSt.parent_image_url || '',
          contact_phone: freshSt.contact_phone || '',
          contact_time: freshSt.contact_time || '',
          image_url: freshSt.image_url || '',
          personalities: freshSt.personalities || [],
          target_school: freshSt.target_school || (initialTargetSchools[0]?.school_name || ''),
          target_schools: initialTargetSchools,
          teacher_in_charge: freshSt.teacher_in_charge || '',
          level: freshSt.level || 'A',
          start_unit_math: (freshSt as any).start_unit_math || null,
          start_unit_english: (freshSt as any).start_unit_english || null,
          start_unit_science: (freshSt as any).start_unit_science || null,
          start_unit_social: (freshSt as any).start_unit_social || null,
          start_unit_japanese: (freshSt as any).start_unit_japanese || null,
          weekly_sessions_count: (freshSt as any).weekly_sessions_count || '2回',
          weekly_duration_minutes: (freshSt as any).weekly_duration_minutes || '120分',
          selected_days: freshSt.selected_days || ['tuesday', 'friday'],
          default_slots: (freshSt as any).default_slots || freshSt.period_count || 2,
          period_count: (freshSt as any).default_slots || freshSt.period_count || 2
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
        const dayOfWeekKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(scheduleDate).getDay()];
        const isAttendanceDay = ((freshSt as any).selected_days || ['tuesday', 'friday']).includes(dayOfWeekKey);
        let loadedPeriodCount = (freshSt as any).default_slots || freshSt.period_count || 2;
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
    const passStatusMap: Record<string, string> = {};
    allMiniResults.forEach(r => {
      scoresMap[r.id] = r.score !== null ? r.score.toString() : '';
      passStatusMap[r.id] = r.passed === true ? 'passed' : r.passed === false ? 'failed' : 'unstarted';
    });
    setTempScores(scoresMap);
    setTempPassedStatuses(passStatusMap);

    // Load all homework results
    const allHwResults = db.getHomeworkResults();
    setHomeworkResultsList(allHwResults);
    const hwStatusMap: Record<string, 'incomplete' | 'completed' | 'skipped'> = {};
    allHwResults.forEach(r => {
      hwStatusMap[r.id] = r.status;
    });
    setTempHomeworkStatuses(hwStatusMap);
    setGeminiApiKey(getGeminiApiKey());
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

    try {
      let targetSchoolId = newStudentSchoolId;

      // 新規学校の自動追加
      if (targetSchoolId === 'add_new') {
        if (!newCustomSchoolName.trim()) {
          alert('学校名を入力してください。');
          return;
        }

        // suffix 補完
        const isElem = newStudentGrade.startsWith('小') || newStudentGrade === '園児';
        const isHigh = newStudentGrade.startsWith('高') || newStudentGrade === '既卒';
        const suffix = isElem ? '小学校' : isHigh ? '高校' : '中学校';
        let finalizedSchoolName = newCustomSchoolName.trim();
        if (!finalizedSchoolName.endsWith('小学校') && !finalizedSchoolName.endsWith('中学校') && !finalizedSchoolName.endsWith('高校') && !finalizedSchoolName.endsWith('学校')) {
          finalizedSchoolName += suffix;
        }

        const allSchools = db.getSchools();
        const existingSchool = allSchools.find(s => s.name === finalizedSchoolName);

        if (existingSchool) {
          targetSchoolId = existingSchool.id;
        } else {
          const newSchoolId = `sch-${Date.now()}`;
          const newSchool = {
            id: newSchoolId,
            name: finalizedSchoolName,
            type: isElem ? ('elementary' as const) : isHigh ? ('high_school' as const) : ('junior_high' as const),
            created_at: new Date().toISOString()
          };
          await db.saveSchool(newSchool);
          targetSchoolId = newSchoolId;
          // schools リストを更新
          setSchools(db.getSchools());
        }
      }

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
        school_id: targetSchoolId,
        status: 'normal',
        start_unit_id: null,
        created_at: new Date().toISOString(),
        level: newStudentLevel
      };

      await db.saveStudent(newStudent);

      // 新規生徒用の初期学習計画(学習タスク)を学校マスターから流し込む
      const allUnits = db.getCurriculumUnits();
      const schoolUnits = allUnits.filter(u => u.school_id === targetSchoolId);
      
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
    } catch (err: any) {
      console.error(err);
      alert(`生徒アカウントの発行に失敗しました。\nエラー: ${err.message || err}`);
    }
  };

  // 生徒情報の保存
  const handleSaveStudentDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    try {
      const rawTargetSchools = (editForm as any).target_schools || [];
      const cleanTargetSchools = rawTargetSchools.filter((s: any) => s.school_name?.trim() || s.course_name?.trim());
      const newSlots = parseInt(String(editForm.period_count || (editForm as any).default_slots || 2)) || 2;
      const updated = {
        ...selectedStudent,
        ...editForm,
        weekly_sessions_count: (editForm as any).weekly_sessions_count || selectedStudent.weekly_sessions_count || '2回',
        weekly_duration_minutes: (editForm as any).weekly_duration_minutes || selectedStudent.weekly_duration_minutes || '120分',
        selected_days: (editForm as any).selected_days || selectedStudent.selected_days || ['tuesday', 'friday'],
        default_slots: newSlots,
        period_count: newSlots,
        target_schools: cleanTargetSchools.length > 0 ? cleanTargetSchools : undefined,
        target_school: cleanTargetSchools[0]?.school_name || (editForm.target_school || '')
      } as Student;
      const saved = await db.saveStudent(updated);
      setSelectedStudent(saved);
      setPeriodCount(saved.default_slots || saved.period_count || newSlots);
      setEditForm({
        ...saved,
        weekly_sessions_count: saved.weekly_sessions_count || '2回',
        weekly_duration_minutes: saved.weekly_duration_minutes || '120分',
        selected_days: saved.selected_days || (editForm as any).selected_days || ['tuesday', 'friday'],
        default_slots: saved.default_slots || saved.period_count || newSlots,
        period_count: saved.default_slots || saved.period_count || newSlots,
        target_schools: (saved as any).target_schools || cleanTargetSchools
      } as any);
      // 生徒リスト自体もリロードして更新を反映
      const listSt = db.getStudents();
      setStudents(listSt);
      loadData();
      alert('生徒情報を保存しました。');
    } catch (err: any) {
      console.error('handleSaveStudentDetail Supabase error:', err);
      const errMsg = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert(`保存中にエラーが発生しました。\nエラー詳細: ${errMsg}`);
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

  // カリキュラム単元の新規登録
  const handleCreateCurriculumUnit = async () => {
    if (!newUnitName) {
      alert('単元名を入力してください。');
      return;
    }
    const allUnits = db.getCurriculumUnits();
    const schoolSubjectUnits = allUnits.filter(u => u.school_id === selectedSchoolId && u.subject === selectedSubject);
    const maxSeq = schoolSubjectUnits.reduce((max, u) => u.sequence_order > max ? u.sequence_order : max, 0);

    const newUnit: CurriculumUnit = {
      id: `unit-${Date.now()}`,
      school_id: selectedSchoolId,
      subject: selectedSubject,
      name: newUnitName,
      sequence_order: maxSeq + 1,
      link_url: newUnitLinkUrl || null,
      created_at: new Date().toISOString()
    };

    await db.saveCurriculumUnit(newUnit);
    alert('授業（単元）を追加しました！');
    setNewUnitName('');
    setNewUnitLinkUrl('');
    loadData();
  };

  // カリキュラム単元の編集保存
  const handleUpdateCurriculumUnit = async () => {
    if (!editingUnitId || !editingUnitName) {
      alert('単元名を入力してください。');
      return;
    }
    const allUnits = db.getCurriculumUnits();
    const target = allUnits.find(u => u.id === editingUnitId);
    if (!target) return;

    const updated: CurriculumUnit = {
      ...target,
      name: editingUnitName,
      link_url: editingUnitLinkUrl || null
    };

    await db.saveCurriculumUnit(updated);
    alert('授業（単元）を更新しました！');
    setEditingUnitId(null);
    setEditingUnitName('');
    setEditingUnitLinkUrl('');
    loadData();
  };

  // カリキュラム単元の削除
  const handleDeleteCurriculumUnit = async (id: string) => {
    if (!window.confirm('この授業（単元）を削除してもよろしいですか？（生徒の学習計画からも削除されます）')) {
      return;
    }
    await db.deleteCurriculumUnit(id);
    alert('授業（単元）を削除しました。');
    loadData();
  };

  // 自由記述授業名の新規登録
  const handleCreateCustomClass = async () => {
    if (!newCustomClassName) {
      alert('自由記述の授業名を入力してください。');
      return;
    }
    const newCc: CustomClass = {
      id: `cc-${Date.now()}`,
      name: newCustomClassName,
      created_at: new Date().toISOString()
    };
    await db.saveCustomClass(newCc);
    setNewCustomClassName('');
    loadData();
  };

  // 自由記述授業名の削除
  const handleDeleteCustomClass = async (id: string) => {
    await db.deleteCustomClass(id);
    loadData();
  };

  // 3. 学習計画のスタート位置設定
  const handleSaveStartUnit = async () => {
    if (!selectedStudent) return;

    // 選択されたスタート位置より前の単元は「スキップ(未着手)」に、以降は「未着手」に戻す
    const allUnits = db.getCurriculumUnits();
    const studentSchoolUnits = allUnits.filter(u => u.school_id === selectedStudent.school_id);
    
    // 5教科のスタート位置を取得
    const startMath = studentSchoolUnits.find(u => u.id === (selectedStudent as any).start_unit_math);
    const startEnglish = studentSchoolUnits.find(u => u.id === (selectedStudent as any).start_unit_english);
    const startScience = studentSchoolUnits.find(u => u.id === (selectedStudent as any).start_unit_science);
    const startSocial = studentSchoolUnits.find(u => u.id === (selectedStudent as any).start_unit_social);
    const startJapanese = studentSchoolUnits.find(u => u.id === (selectedStudent as any).start_unit_japanese);

    const updatedTasks = studentTasks.map(task => {
      const unit = studentSchoolUnits.find(u => u.id === task.unit_id);
      if (!unit) return task;

      // 該当教科のスタート位置を決定
      let activeStartUnit = null;
      if (unit.subject === '数学' || unit.subject === '算数') activeStartUnit = startMath;
      else if (unit.subject === '英語') activeStartUnit = startEnglish;
      else if (unit.subject === '理科') activeStartUnit = startScience;
      else if (unit.subject === '社会') activeStartUnit = startSocial;
      else if (unit.subject === '国語') activeStartUnit = startJapanese;

      if (activeStartUnit) {
        if (unit.sequence_order < activeStartUnit.sequence_order) {
          // スタートより前はスキップ
          if (task.status === 'unstarted') {
            return {
              ...task,
              status: 'skipped' as const,
              office_note: '開始位置指定によりスキップ'
            };
          }
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
    
    alert('教科別スタート位置を設定しました。スタートより前の単元をTodoから除外しました。');
    loadData();
  };

  // 4. コマ割り時間割設定の保存
  const handleSaveTimetable = async () => {
    if (!selectedStudent) return;

    let targetStudents: any[] = [];
    if (applyScope === 'individual') {
      targetStudents = [selectedStudent];
    } else if (applyScope === 'school') {
      targetStudents = students.filter(s => s.school_id === selectedStudent.school_id);
    } else if (applyScope === 'grade') {
      targetStudents = students.filter(s => s.grade === selectedStudent.grade);
    } else if (applyScope === 'level') {
      targetStudents = students.filter(s => s.level === selectedStudent.level);
    }

    // すべてのタスク、ミニテスト結果、宿題結果をDBからロード
    let currentLearningTasks = db.getLearningTasks();
    const allMiniTestResults = db.getMiniTestResults();
    const allHomeworkResults = db.getHomeworkResults();

    for (const student of targetStudents) {
      // 本日の既存のタスクの period を一旦クリア
      let clearedTasks = currentLearningTasks.filter(t => t.student_id === student.id);
      clearedTasks = clearedTasks.map(t => {
        if (t.scheduled_date === scheduleDate) {
          return { ...t, period: null, office_note: '' };
        }
        return t;
      });

      const newCustomTasks: LearningTask[] = [];
      let hasCustomTimetableUnit = false; // カリキュラム以外の授業がコマ割りに入ったかどうか

      // periodSelections の設定を反映
      for (let p = 1; p <= periodCount; p++) {
        const config = periodSelections[p];
        if (!config || !config.subject) {
          continue;
        }

        if (config.subject === 'その他' || config.subject === '自由記述') {
          hasCustomTimetableUnit = true;
        }

        if (config.unitId) {
          const selectedUnit = allCurriculumUnits.find(u => u.id === config.unitId);
          let targetUnitId = config.unitId;

          // 学校が異なる場合、適用先の学校のカリキュラム単元から同じものを探す
          if (selectedUnit && selectedUnit.school_id !== student.school_id) {
            const matchingUnit = allCurriculumUnits.find(
              u => u.school_id === student.school_id &&
                   u.subject === selectedUnit.subject &&
                   u.name === selectedUnit.name
            );
            if (matchingUnit) {
              targetUnitId = matchingUnit.id;
            } else {
              targetUnitId = '';
            }
          }

          if (targetUnitId) {
            const existingTaskIdx = clearedTasks.findIndex(task => task.unit_id === targetUnitId);
            if (existingTaskIdx >= 0) {
              clearedTasks[existingTaskIdx] = {
                ...clearedTasks[existingTaskIdx],
                scheduled_date: scheduleDate,
                period: p,
                subject: config.subject,
                office_note: commonOfficeNote
              };
            } else {
              newCustomTasks.push({
                id: `task-${student.id}-${targetUnitId}-${Date.now()}-${p}`,
                student_id: student.id,
                unit_id: targetUnitId,
                scheduled_date: scheduleDate,
                period: p,
                status: 'unstarted',
                video_watched: false,
                test_passed: false,
                subject: config.subject,
                office_note: commonOfficeNote,
                created_at: new Date().toISOString()
              });
            }
          } else {
            const customUnitId = `custom-${student.id}-${scheduleDate}-${p}`;
            const existingCustomTaskIdx = clearedTasks.findIndex(t => t.unit_id === customUnitId);
            const customThemeName = selectedUnit ? selectedUnit.name : (config.customTheme || '');

            if (existingCustomTaskIdx >= 0) {
              clearedTasks[existingCustomTaskIdx] = {
                ...clearedTasks[existingCustomTaskIdx],
                scheduled_date: scheduleDate,
                period: p,
                subject: config.subject,
                custom_unit_name: customThemeName,
                office_note: commonOfficeNote
              };
            } else {
              newCustomTasks.push({
                id: `task-custom-${Date.now()}-${p}-${student.id}`,
                student_id: student.id,
                unit_id: customUnitId,
                scheduled_date: scheduleDate,
                period: p,
                status: 'unstarted',
                video_watched: false,
                test_passed: false,
                subject: config.subject,
                custom_unit_name: customThemeName,
                office_note: commonOfficeNote,
                created_at: new Date().toISOString()
              });
            }
          }
        } else {
          // 最初からカスタムテーマ指定の場合
          const customUnitId = `custom-${student.id}-${scheduleDate}-${p}`;
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
              id: `task-custom-${Date.now()}-${p}-${student.id}`,
              student_id: student.id,
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

      // メモリ上の全タスクリストをこの生徒向けに更新する
      const studentOtherTasks = currentLearningTasks.filter(t => t.student_id !== student.id);
      let updatedStudentTasks = [...studentOtherTasks, ...clearedTasks, ...newCustomTasks];

      // 【後ろ倒し/リスケジュールの適用】
      // もしカリキュラム以外の授業がコマ割りに入っていたら、本来予定されていた未完了タスクを明日以降に後ろ倒しする
      if (hasCustomTimetableUnit) {
        const tomorrowStr = new Date(new Date(scheduleDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const futureDates: string[] = [];
        const baseDate = new Date(scheduleDate);
        for (let i = 1; i <= 90; i++) {
          const nextDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
          futureDates.push(nextDate.toISOString().split('T')[0]);
        }
        const allUnits = db.getCurriculumUnits();
        
        updatedStudentTasks = rescheduleFutureUncompletedTasks(
          student.id,
          updatedStudentTasks,
          allUnits,
          tomorrowStr,
          futureDates
        );
      }

      currentLearningTasks = updatedStudentTasks;

      // 複数のテスト結果 (MiniTestResult) を一括同期保存 (対象スコープ一括複製対応)
      const existingMiniResultsForToday = allMiniTestResults.filter(r => r.student_id === student.id && r.date === scheduleDate);
      const savedTestIds = new Set<string>();
      for (const test of todayTests) {
        if (!test.content.trim()) continue;

        let relStudents = [student];
        if (test.targetScope === 'grade') {
          relStudents = students.filter(s => s.grade === student.grade);
        } else if (test.targetScope === 'school') {
          relStudents = students.filter(s => s.school_id === student.school_id);
        } else if (test.targetScope === 'level') {
          relStudents = students.filter(s => s.level === student.level);
        }

        for (const relSt of relStudents) {
          const relExisting = allMiniTestResults.find(r => r.student_id === relSt.id && r.date === scheduleDate && r.test_content === test.content);
          const testData: MiniTestResult = {
            id: relExisting?.id || `mini-${relSt.id}-${scheduleDate}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            student_id: relSt.id,
            date: scheduleDate,
            test_content: test.content,
            score: relExisting ? relExisting.score : null,
            passing_line: test.passingLine || null,
            target_scope: test.targetScope || 'individual',
            created_at: relExisting?.created_at || new Date().toISOString()
          };
          await db.saveMiniTestResult(testData);
          if (relSt.id === student.id) {
            savedTestIds.add(testData.id);
          }
        }
      }

      for (const existing of existingMiniResultsForToday) {
        if (!savedTestIds.has(existing.id)) {
          await db.deleteMiniTestResult(existing.id);
        }
      }

      // 複数の宿題結果 (HomeworkResult) を一括同期保存 (対象スコープ一括複製対応)
      const existingHwResultsForToday = allHomeworkResults.filter(r => r.student_id === student.id && r.date === scheduleDate);
      const savedHwIds = new Set<string>();
      for (const hw of todayHomeworks) {
        if (!hw.content.trim()) continue;

        let relStudents = [student];
        if (hw.targetScope === 'grade') {
          relStudents = students.filter(s => s.grade === student.grade);
        } else if (hw.targetScope === 'school') {
          relStudents = students.filter(s => s.school_id === student.school_id);
        } else if (hw.targetScope === 'level') {
          relStudents = students.filter(s => s.level === student.level);
        }

        for (const relSt of relStudents) {
          const relExisting = allHomeworkResults.find(r => r.student_id === relSt.id && r.date === scheduleDate && r.homework_content === hw.content);
          const hwData: HomeworkResult = {
            id: relExisting?.id || `hw-${relSt.id}-${scheduleDate}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            student_id: relSt.id,
            date: scheduleDate,
            homework_content: hw.content,
            homework_deadline: hw.deadline,
            status: relExisting ? relExisting.status : 'incomplete',
            target_scope: hw.targetScope || 'individual',
            created_at: relExisting?.created_at || new Date().toISOString()
          };
          await db.saveHomeworkResult(hwData);
          if (relSt.id === student.id) {
            savedHwIds.add(hwData.id);
          }
        }
      }

      for (const existing of existingHwResultsForToday) {
        if (!savedHwIds.has(existing.id)) {
          await db.deleteHomeworkResult(existing.id);
        }
      }

      // 生徒情報の period_count / default_slots も更新して保存
      const updatedStudent = {
        ...student,
        default_slots: periodCount,
        period_count: periodCount
      };
      await db.saveStudent(updatedStudent);
      if (student.id === selectedStudent.id) {
        setSelectedStudent(updatedStudent);
      }
    }

    // すべての生徒のタスクをマージしたタスクリストを一括保存
    await db.saveLearningTasks(currentLearningTasks);

    alert(
      applyScope === 'individual'
        ? '今日の時間割コマ割りを保存しました！'
        : '今日の時間割コマ割りを対象生徒全員に一括保存しました！'
    );
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
    const passedStr = tempPassedStatuses[result.id] || 'unstarted';
    const passedVal = passedStr === 'passed' ? true : passedStr === 'failed' ? false : null;
    const updated = {
      ...result,
      score: scoreVal,
      passed: passedVal
    };
    await db.saveMiniTestResult(updated);
    alert('小テスト点数・合否を保存しました！');
    loadData();
  };

  const handleSaveApiKey = () => {
    saveGeminiApiKey(geminiApiKey);
    alert('Gemini API キーを保存しました。');
    setShowApiKeySetting(false);
  };

  const handleDeleteApiKey = () => {
    setGeminiApiKey('');
    saveGeminiApiKey('');
    alert('APIキーを消去しました。デモ（モック）モードに戻ります。');
    setShowApiKeySetting(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        if (!reader.result) {
          alert('ファイルの読み込みに失敗しました。');
          return;
        }
        try {
          const base64 = (reader.result as string).split(',')[1];
          const mimeType = file.type;
          const res = await analyzeReportCardImage(base64, mimeType);
          
          // 解析された値をフォームに入力する
          if (res.test_name) setRegularTestName(res.test_name);
          if (res.score_japanese !== null) setRegularScoreJapanese(res.score_japanese.toString());
          if (res.score_math !== null) setRegularScoreMath(res.score_math.toString());
          if (res.score_english !== null) setRegularScoreEnglish(res.score_english.toString());
          if (res.score_social !== null) setRegularScoreSocial(res.score_social.toString());
          if (res.score_science !== null) setRegularScoreScience(res.score_science.toString());
          if (res.score_total !== null) setRegularScoreTotal(res.score_total.toString());
          if (res.class_rank !== null) setRegularClassRank(res.class_rank);
          if (res.school_rank !== null) setRegularSchoolRank(res.school_rank);
          if (res.deviation_value !== null) setRegularDeviation(res.deviation_value.toString());
          
          alert('成績表画像の解析が完了し、点数を自動セットしました！内容をご確認ください。');
        } catch (err) {
          console.error(err);
          alert('解析中にエラーが発生しました。');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      alert(`ファイル処理エラー: ${err.message}`);
    }
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
    alert('宿題提出状況を保存しました！');
    loadData();
  };

  // コマごとの教科変更時
  const handleSubjectChange = (p: number, sub: string) => {
    let initialTheme = '';
    // もし「テスト」が選ばれ、すでにテストが1件だけ登録されているなら、それを自動でセットする
    if (sub === 'テスト' && todayTests.length === 1) {
      initialTheme = todayTests[0].content;
    }
    setPeriodSelections({
      ...periodSelections,
      [p]: { subject: sub, unitId: '', customTheme: initialTheme }
    });
  };

  // コマごとのテーマ変更時（双方向テスト連動を含む）
  const handleThemeChange = (p: number, val: string) => {
    const currentConfig = periodSelections[p];
    setPeriodSelections({
      ...periodSelections,
      [p]: { ...currentConfig, customTheme: val }
    });

    // テストかつ、先入力を「本日のテスト」に自動反映する
    if (currentConfig.subject === 'テスト' && val) {
      const exists = todayTests.some(t => t.content === val);
      if (!exists) {
        const newTestId = `test-${Date.now()}`;
        updateTodayTestsState([...todayTests, { id: newTestId, content: val }]);
      }
    }
  };

  const updateTodayTestsState = (newTests: { id: string; content: string; passingLine?: string; targetScope?: string }[]) => {
    setTodayTests(newTests);
    
    // 双方向連動：テストが1件のとき、時間割で「テスト」が選ばれている全コマにそのテスト名を自動セット
    if (newTests.length === 1 && newTests[0].content) {
      const updatedPeriods = { ...periodSelections };
      let changed = false;
      Object.keys(updatedPeriods).forEach(pKey => {
        const p = Number(pKey);
        if (updatedPeriods[p].subject === 'テスト' && !updatedPeriods[p].customTheme) {
          updatedPeriods[p].customTheme = newTests[0].content;
          changed = true;
        }
      });
      if (changed) {
        setPeriodSelections(updatedPeriods);
      }
    }
  };

  // テストの動的追加・更新・削除
  const handleAddTest = () => {
    updateTodayTestsState([...todayTests, { id: `temp-${Date.now()}-${Math.random()}`, content: '', passingLine: '', targetScope: 'individual' }]);
  };

  const handleUpdateTest = (id: string, field: 'content' | 'passingLine' | 'targetScope', val: string) => {
    const newTests = todayTests.map(t => t.id === id ? { ...t, [field]: val } : t);
    updateTodayTestsState(newTests);
  };

  const handleRemoveTest = (id: string) => {
    updateTodayTestsState(todayTests.filter(t => t.id !== id));
  };

  // 宿題の動的追加・更新・削除
  const handleAddHomework = () => {
    setTodayHomeworks([...todayHomeworks, { id: `temp-${Date.now()}-${Math.random()}`, content: '', deadline: '', targetScope: 'individual' }]);
  };

  const handleUpdateHomework = (id: string, field: 'content' | 'deadline' | 'targetScope', val: string) => {
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
    if (!selectedStudent || !regularTestName) return;

    const record: TestRecord = {
      id: `tr-${Date.now()}`,
      student_id: selectedStudent.id,
      record_type: 'regular_test',
      test_name: regularTestName,
      score_japanese: regularScoreJapanese === '' ? null : parseInt(regularScoreJapanese),
      score_math: regularScoreMath === '' ? null : parseInt(regularScoreMath),
      score_english: regularScoreEnglish === '' ? null : parseInt(regularScoreEnglish),
      score_social: regularScoreSocial === '' ? null : parseInt(regularScoreSocial),
      score_science: regularScoreScience === '' ? null : parseInt(regularScoreScience),
      score_total: regularScoreTotal === '' ? null : parseInt(regularScoreTotal),
      class_rank: regularClassRank || 'ー',
      school_rank: regularSchoolRank || 'ー',
      deviation_value: regularDeviation === '' ? null : parseFloat(regularDeviation),
      improvement_plan: regularImprovement,
      created_at: new Date().toISOString()
    };

    await db.saveTestRecord(record);
    
    // クリア
    setRegularTestName('');
    setRegularScoreJapanese('');
    setRegularScoreMath('');
    setRegularScoreEnglish('');
    setRegularScoreSocial('');
    setRegularScoreScience('');
    setRegularScoreTotal('');
    setRegularClassRank('');
    setRegularSchoolRank('');
    setRegularDeviation('');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          {/* Role badge / switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              data-testid="role-toggle-admin"
              onClick={() => setUserRole('admin')}
              style={{
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: userRole === 'admin' ? '#4f46e5' : 'transparent',
                color: '#ffffff',
                transition: 'all 0.15s ease'
              }}
            >
              本部権限
            </button>
            <button
              type="button"
              data-testid="role-toggle-branch"
              onClick={() => {
                setUserRole('branch');
                if (activeTab === 'branches') setActiveTab('student-list');
              }}
              style={{
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: userRole === 'branch' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                transition: 'all 0.15s ease'
              }}
            >
              校舎権限
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Branch Switcher for Admin */}
          {userRole === 'admin' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>🏢 対象校舎:</span>
              <select
                id="admin-branch-select"
                data-testid="admin-branch-switcher"
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <option value="all">全校舎 (本部一括表示)</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
              🏢 {branches.find(b => b.id === selectedBranchId)?.name || '恵比寿教室'}
            </span>
          )}

          <button onClick={onBackToPortal} className={styles.backBtn}>
            ポータルへ戻る
          </button>

          {onLogout && (
            <button 
              onClick={onLogout} 
              data-testid="header-logout-btn"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              ログアウト
            </button>
          )}
        </div>
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

          {/* Headquarters Group (Admin Only) */}
          {userRole === 'admin' && (
            <div className={styles.menuGroup}>
              <div className={styles.menuTitle}>本部統括管理</div>
              <button
                type="button"
                data-testid="menu-branches"
                className={`${styles.menuItem} ${activeTab === 'branches' ? styles.menuItemActive : ''}`}
                onClick={() => setActiveTab('branches')}
              >
                <Building2 size={16} style={{ marginRight: '8px' }} />
                校舎アカウント管理
              </button>
            </div>
          )}

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
                      <option value="小1">小学1年生</option>
                      <option value="小2">小学2年生</option>
                      <option value="小3">小学3年生</option>
                      <option value="小4">小学4年生</option>
                      <option value="小5">小学5年生</option>
                      <option value="小6">小学6年生</option>
                      <option value="中1">中学1年生</option>
                      <option value="中2">中学2年生</option>
                      <option value="中3">中学3年生</option>
                      <option value="高1">高校1年生</option>
                      <option value="高2">高校2年生</option>
                      <option value="高3">高校3年生</option>
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
                        className={`${styles.segmentBtn} ${filterCategory === 'elementary' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setFilterCategory('elementary')}
                      >
                        小学生
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
                        className={`${styles.segmentBtn} ${filterCategory === 'high_school' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setFilterCategory('high_school')}
                      >
                        高校生
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
                    // Multitenant Branch filtering
                    if (userRole === 'branch') {
                      const isBranchStudent = st.branch_id === 'branch-1' || st.classroom === '恵比寿教室' || !st.branch_id;
                      if (!isBranchStudent) return false;
                    } else if (selectedBranchId !== 'all') {
                      const targetBranch = branches.find(b => b.id === selectedBranchId);
                      const isMatch = st.branch_id === selectedBranchId || (targetBranch && st.classroom === targetBranch.name);
                      if (!isMatch) return false;
                    }

                    if (filterSchoolId && st.school_id !== filterSchoolId) return false;
                    if (filterGrade && st.grade !== filterGrade) return false;
                    
                    const school = schools.find(s => s.id === st.school_id);
                    const isElem = st.grade.startsWith('小') || st.grade === '園児' || school?.type === 'elementary';
                    const isJhs = st.grade.startsWith('中') || school?.type === 'junior_high';
                    const isHigh = st.grade.startsWith('高') || st.grade === '既卒' || school?.type === 'high_school';

                    if (filterCategory === 'elementary' && !isElem) return false;
                    if (filterCategory === 'junior_high' && !isJhs) return false;
                    if (filterCategory === 'high_school' && !isHigh) return false;
                    
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
                    {GRADES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>所属学校</label>
                  <select 
                    value={newStudentSchoolId} 
                    onChange={e => setNewStudentSchoolId(e.target.value)}
                    className={styles.select}
                  >
                    {schools
                      .filter(s => {
                        const isElem = newStudentGrade.startsWith('小') || newStudentGrade === '園児';
                        const isJhs = newStudentGrade.startsWith('中') || newStudentGrade.startsWith('高') || newStudentGrade === '既卒';
                        if (isElem) return s.type === 'elementary';
                        if (isJhs) return s.type === 'junior_high';
                        return true;
                      })
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.type === 'junior_high' ? '中' : '小'})</option>
                      ))}
                    <option value="add_new">➕ 新規学校を追加...</option>
                  </select>
                  {newStudentSchoolId === 'add_new' && (
                    <div className={styles.formGroup} style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>新規学校名 (固有名詞のみ入力)</label>
                      <input
                        type="text"
                        value={newCustomSchoolName}
                        onChange={e => setNewCustomSchoolName(e.target.value)}
                        placeholder="例: 桜丘"
                        className={styles.input}
                        required
                      />
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                        ※小学校・中学校は自動で語尾に補完されます。
                      </p>
                    </div>
                  )}
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

          {/* Branch Account Management (Admin Only) */}
          {activeTab === 'branches' && (
            <div className={styles.card}>
              <BranchManagement
                onSelectBranch={(branch) => {
                  setSelectedBranchId(branch.id);
                  setActiveTab('student-list');
                }}
              />
            </div>
          )}

          {/* Student Specific Tab Screens */}
          {activeTab !== 'student-list' && activeTab !== 'create-student' && activeTab !== 'branches' && (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedStudent.status === 'fast' && <span className={`${styles.badge} ${styles.statusFast}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>爆速中！(先取り前倒し中) ⚡</span>}
                        {selectedStudent.status === 'warning' && <span className={`${styles.badge} ${styles.statusWarning}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>計画パンクアラート！⚠️</span>}
                        {selectedStudent.status === 'normal' && <span className={`${styles.badge} ${styles.statusNormal}`} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>通常進捗</span>}

                        {onViewStudentScreen && (
                          <button
                            type="button"
                            data-testid="banner-view-student-screen-btn"
                            onClick={() => onViewStudentScreen(selectedStudent)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#f8fafc',
                              color: '#0f766e',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            👨‍🎓 生徒画面を開く
                          </button>
                        )}
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



                  {/* Timetable planner */}
                  <div className={styles.schedulerGrid}>
                    <div>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 700 }}>コマ割り設定 (標準2コマ / 最大10コマ)</h4>
                      <HorizontalDatePicker 
                        selectedDate={scheduleDate} 
                        onChangeDate={setScheduleDate} 
                        selectedDays={selectedStudent.selected_days || ['tuesday', 'friday']}
                      />
                      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>対象日付: </label>
                        <input 
                          type="date" 
                          value={scheduleDate} 
                          onChange={e => setScheduleDate(e.target.value)}
                          className={styles.input}
                          style={{ width: 'auto', display: 'inline-block' }}
                        />
                        {scheduleDate && (() => {
                          const d = new Date(scheduleDate);
                          if (isNaN(d.getTime())) return null;
                          const month = d.getMonth() + 1;
                          const date = d.getDate();
                          const days = ['日', '月', '火', '水', '木', '金', '土'];
                          const dayOfWeek = days[d.getDay()];
                          const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
                          const weekNum = Math.ceil((date + firstDay.getDay()) / 7);
                          const dayOfWeekKey = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
                          const isAttendance = (selectedStudent.selected_days || ['tuesday', 'friday']).includes(dayOfWeekKey);

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span 
                                data-testid="japanese-date-badge"
                                style={{ 
                                  padding: '4px 10px', 
                                  background: isAttendance ? '#eff6ff' : '#f1f5f9', 
                                  color: isAttendance ? '#1e40af' : '#475569', 
                                  borderRadius: '6px', 
                                  fontWeight: 600, 
                                  fontSize: '0.82rem',
                                  border: isAttendance ? '1px solid #bfdbfe' : '1px solid #cbd5e1'
                                }}
                              >
                                📅 {d.getFullYear()}年{month}月{date}日 ({dayOfWeek}曜日) / {month}月第{weekNum}週
                              </span>
                              <span
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  backgroundColor: isAttendance ? '#dbeafe' : '#f8fafc',
                                  color: isAttendance ? '#1d4ed8' : '#64748b',
                                  border: isAttendance ? '1px solid #93c5fd' : '1px solid #e2e8f0'
                                }}
                              >
                                {isAttendance ? `📌 通塾設定日 (標準${selectedStudent.default_slots || selectedStudent.period_count || 2}コマ)` : '☕ 休塾設定日（自習）'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      
                      <div className={styles.timetableSetup}>
                        {Array.from({ length: periodCount }, (_, i) => i + 1).map(p => {
                          const currentConfig = periodSelections[p];
                          const isElementary = selectedStudent.grade.startsWith('小') || selectedStudent.grade === '園児';

                          return (
                            <div key={p} className={styles.cellRow} style={{ alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                              <span className={styles.cellNum} style={{ marginTop: '8px' }}>{p}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <select
                                  value={currentConfig.subject}
                                  onChange={e => handleSubjectChange(p, e.target.value)}
                                  className={styles.select}
                                >
                                  <option value="">-- コマ割りなし --</option>
                                  <option value="数学">{isElementary ? '算数' : '数学'}</option>
                                  <option value="英語">英語</option>
                                  <option value="理科">理科</option>
                                  <option value="社会">社会</option>
                                  <option value="国語">国語</option>
                                  <option value="テスト">テスト</option>
                                  <option value="その他">その他</option>
                                  <option value="自由記述">自由記述</option>
                                </select>

                                {currentConfig.subject && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {/* カリキュラム単元選択（数学・英語・理科・社会・国語） */}
                                    {['数学', '英語', '理科', '社会', '国語'].includes(currentConfig.subject) && (
                                      <select
                                        value={currentConfig.unitId}
                                        onChange={e => {
                                          const uId = e.target.value;
                                          setPeriodSelections({
                                            ...periodSelections,
                                            [p]: { ...currentConfig, unitId: uId, customTheme: '' }
                                          });
                                        }}
                                        className={styles.select}
                                      >
                                        <option value="">-- カリキュラム単元から選択 --</option>
                                        {allCurriculumUnits
                                          .filter(u => u.school_id === selectedStudent.school_id && u.subject === currentConfig.subject)
                                          .map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                          ))}
                                      </select>
                                    )}

                                    {/* 「自由記述」が選択された場合：登録済みの自由記述プルダウン ＆ 新規直打ち */}
                                    {currentConfig.subject === '自由記述' && (
                                      <>
                                        <select
                                          value={currentConfig.customTheme}
                                          onChange={e => handleThemeChange(p, e.target.value)}
                                          className={styles.select}
                                        >
                                          <option value="">-- 登録済みの自由記述から選択 --</option>
                                          {customClassesList.map(cc => (
                                            <option key={cc.id} value={cc.name}>{cc.name}</option>
                                          ))}
                                        </select>
                                        <input 
                                          type="text"
                                          placeholder="または新しい授業名を直接入力"
                                          value={currentConfig.customTheme}
                                          onChange={e => handleThemeChange(p, e.target.value)}
                                          className={styles.input}
                                          style={{ fontSize: '0.8rem', padding: '6px' }}
                                        />
                                      </>
                                    )}

                                    {/* 「テスト」が選択された場合：本日のテスト（自由記述）との連動 */}
                                    {currentConfig.subject === 'テスト' && (
                                      <>
                                        {todayTests.length >= 2 ? (
                                          <select
                                            value={currentConfig.customTheme}
                                            onChange={e => handleThemeChange(p, e.target.value)}
                                            className={styles.select}
                                          >
                                            <option value="">-- テストを選択 --</option>
                                            {todayTests.map(t => (
                                              <option key={t.id} value={t.content}>{t.content}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          <input
                                            type="text"
                                            placeholder="テストのテーマ（例: 一次方程式小テスト）"
                                            value={currentConfig.customTheme}
                                            onChange={e => handleThemeChange(p, e.target.value)}
                                            className={styles.input}
                                            style={{ fontSize: '0.8rem', padding: '6px' }}
                                          />
                                        )}
                                      </>
                                    )}

                                    {/* 「その他」が選択された場合 */}
                                    {currentConfig.subject === 'その他' && (
                                      <input
                                        type="text"
                                        placeholder="テーマを入力（例: 面談、宿題指導）"
                                        value={currentConfig.customTheme}
                                        onChange={e => handleThemeChange(p, e.target.value)}
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
                              <div key={test.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="text"
                                    value={test.content}
                                    onChange={e => handleUpdateTest(test.id, 'content', e.target.value)}
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
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>合格点/合格ライン:</span>
                                    <input 
                                      type="text"
                                      value={test.passingLine || ''}
                                      onChange={e => handleUpdateTest(test.id, 'passingLine', e.target.value)}
                                      placeholder="例: -3点, 80%以上, 90点"
                                      className={styles.input}
                                      style={{ fontSize: '0.75rem', padding: '4px 6px', width: '150px' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>対象:</span>
                                    <select
                                      value={test.targetScope || 'individual'}
                                      onChange={e => handleUpdateTest(test.id, 'targetScope', e.target.value)}
                                      className={styles.select}
                                      style={{ fontSize: '0.75rem', padding: '4px 6px', width: 'auto' }}
                                    >
                                      <option value="individual">個人 (この生徒のみ)</option>
                                      <option value="grade">学年全員</option>
                                      <option value="school">中学校 (同じ中学校の同学年)</option>
                                      <option value="level">レベル (同じ学習レベルの同学年)</option>
                                    </select>
                                  </div>
                                </div>
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
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>期限:</span>
                                    <input
                                      type="date"
                                      value={hw.deadline}
                                      onChange={e => handleUpdateHomework(hw.id, 'deadline', e.target.value)}
                                      className={styles.input}
                                      style={{ fontSize: '0.75rem', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', width: 'auto' }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>対象:</span>
                                    <select
                                      value={hw.targetScope || 'individual'}
                                      onChange={e => handleUpdateHomework(hw.id, 'targetScope', e.target.value)}
                                      className={styles.select}
                                      style={{ fontSize: '0.75rem', padding: '4px 6px', width: 'auto' }}
                                    >
                                      <option value="individual">個人 (この生徒のみ)</option>
                                      <option value="grade">学年全員</option>
                                      <option value="school">中学校 (同じ中学校の同学年)</option>
                                      <option value="level">レベル (同じ学習レベルの同学年)</option>
                                    </select>
                                  </div>
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
                      <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: '#0f172a' }}>適用対象の範囲:</label>
                        <select
                          value={applyScope}
                          onChange={e => setApplyScope(e.target.value as any)}
                          className={styles.select}
                          style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          data-testid="apply-scope-select"
                        >
                          <option value="individual">この生徒のみ（個別）</option>
                          <option value="school">同じ学校の生徒全員に一括適用</option>
                          <option value="grade">同じ学年の生徒全員に一括適用</option>
                          <option value="level">同じレベル（{selectedStudent.level}）の生徒全員に一括適用</option>
                        </select>
                        <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>
                          ※一括適用を選択すると、条件に合致するすべての生徒に同じ時間割、テスト、宿題が設定されます。
                        </p>
                      </div>
                      
                      <button onClick={handleSaveTimetable} className={styles.btn} style={{ marginTop: '16px' }}>
                        時間割コマ割りを保存
                      </button>
                    </div>
                  </div>

                  {/* 1週間の学習予定・コマ割り一覧 */}
                  <div style={{ marginTop: '28px', borderTop: '1px solid #e2e8f0', paddingTop: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                        📅 選択週（1週間）の学習予定・コマ割り状況
                      </h4>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        各曜日をクリックしてその日のコマ割りを即座に編集できます
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
                      {(() => {
                        const parts = (scheduleDate || '').split('-');
                        const d = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : new Date();
                        const day = d.getDay();
                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(d.setDate(diff));

                        const dayNames = ['月', '火', '水', '木', '金', '土', '日'];
                        const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                        return Array.from({ length: 7 }, (_, i) => {
                          const itemDate = new Date(monday);
                          itemDate.setDate(monday.getDate() + i);
                          const yr = itemDate.getFullYear();
                          const mo = String(itemDate.getMonth() + 1).padStart(2, '0');
                          const da = String(itemDate.getDate()).padStart(2, '0');
                          const dStr = `${yr}-${mo}-${da}`;
                          const dayKey = dayKeys[i];
                          const dayOfWeek = dayNames[i];
                          const isAttendance = (selectedStudent.selected_days || ['tuesday', 'friday']).includes(dayKey);
                          const isSelectedDate = dStr === scheduleDate;
                          const dayTasks = studentTasks.filter(t => t.scheduled_date === dStr && t.period);
                          const dayTests = db.getMiniTestResults().filter(r => r.student_id === selectedStudent.id && r.date === dStr);
                          const dayHws = db.getHomeworkResults().filter(r => r.student_id === selectedStudent.id && r.date === dStr);

                          return (
                            <div
                              key={dStr}
                              onClick={() => setScheduleDate(dStr)}
                              style={{
                                backgroundColor: isSelectedDate ? '#eff6ff' : (isAttendance ? '#ffffff' : '#f8fafc'),
                                border: isSelectedDate ? '2px solid #3b82f6' : (isAttendance ? '1px solid #bfdbfe' : '1px solid #e2e8f0'),
                                borderRadius: '10px',
                                padding: '10px 8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: '140px',
                                boxShadow: isSelectedDate ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isSelectedDate ? '#1d4ed8' : '#1e293b' }}>
                                  {itemDate.getMonth() + 1}/{itemDate.getDate()} ({dayOfWeek})
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    padding: '1px 4px',
                                    borderRadius: '4px',
                                    backgroundColor: isAttendance ? '#dbeafe' : '#f1f5f9',
                                    color: isAttendance ? '#1d4ed8' : '#64748b',
                                    fontWeight: 700
                                  }}
                                >
                                  {isAttendance ? '通塾' : '休塾'}
                                </span>
                              </div>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem' }}>
                                {dayTasks.length > 0 ? (
                                  dayTasks
                                    .sort((a, b) => (a.period || 0) - (b.period || 0))
                                    .map(t => (
                                      <div
                                        key={t.id}
                                        style={{
                                          backgroundColor: '#f0fdf4',
                                          border: '1px solid #bbf7d0',
                                          borderRadius: '4px',
                                          padding: '2px 4px',
                                          color: '#166534',
                                          fontSize: '0.68rem',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis'
                                        }}
                                        title={`${t.period}コマ: ${t.subject || '自由記述'} ${t.custom_unit_name || ''}`}
                                      >
                                        <strong>{t.period}ｺﾏ:</strong> {t.subject || '自由記述'}
                                      </div>
                                    ))
                                ) : isAttendance ? (
                                  <div style={{ color: '#3b82f6', fontSize: '0.65rem', fontStyle: 'italic', padding: '4px 0' }}>
                                    標準{selectedStudent.default_slots || selectedStudent.period_count || 2}コマ予定
                                  </div>
                                ) : (
                                  <div style={{ color: '#94a3b8', fontSize: '0.65rem', padding: '4px 0' }}>
                                    予定なし
                                  </div>
                                )}

                                {dayTests.length > 0 && (
                                  <div style={{ fontSize: '0.63rem', color: '#7c3aed', background: '#f5f3ff', padding: '2px 4px', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                                    📝 テスト{dayTests.length}件
                                  </div>
                                )}
                                {dayHws.length > 0 && (
                                  <div style={{ fontSize: '0.63rem', color: '#c2410c', background: '#fff7ed', padding: '2px 4px', borderRadius: '4px', border: '1px solid #fed7aa' }}>
                                    🏠 宿題{dayHws.length}件
                                  </div>
                                )}
                              </div>

                              <button
                                type="button"
                                style={{
                                  marginTop: '6px',
                                  width: '100%',
                                  padding: '3px 0',
                                  fontSize: '0.65rem',
                                  backgroundColor: isSelectedDate ? '#3b82f6' : '#ffffff',
                                  color: isSelectedDate ? '#ffffff' : '#3b82f6',
                                  border: '1px solid #3b82f6',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {isSelectedDate ? '編集中' : '選択'}
                              </button>
                            </div>
                          );
                        });
                      })()}
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
                      <div key={unit.id} className={styles.curriculumItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {index + 1}. {unit.name} 
                            {unit.google_drive_url && (
                              <span style={{ color: '#3b82f6', fontSize: '0.75rem', marginLeft: '12px' }}>🔗 印刷リンク有</span>
                            )}
                          </span>
                          
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button 
                              onClick={() => {
                                setEditingUnitId(unit.id);
                                setEditingUnitName(unit.name);
                                setEditingUnitLinkUrl(unit.link_url || '');
                              }}
                              className={styles.btn}
                              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              編集
                            </button>
                            <button 
                              onClick={() => handleDeleteCurriculumUnit(unit.id)}
                              className={styles.btn}
                              style={{ width: 'auto', padding: '4px 8px', backgroundColor: '#ef4444', fontSize: '0.75rem' }}
                            >
                              削除
                            </button>
                            
                            <div className={styles.unitOrderBtns}>
                              <button 
                                onClick={() => moveUnit(index, 'up')} 
                                disabled={index === 0}
                                className={styles.iconBtn}
                                title="上へ移動"
                              >
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
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {editingUnitId === unit.id && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                            <input 
                              id="edit-unit-name-input"
                              type="text"
                              value={editingUnitName}
                              onChange={e => setEditingUnitName(e.target.value)}
                              className={styles.input}
                              style={{ fontSize: '0.8rem' }}
                            />
                            <button 
                              onClick={handleUpdateCurriculumUnit}
                              className={styles.btn}
                              style={{ width: 'auto', padding: '4px 12px', fontSize: '0.75rem' }}
                            >
                              保存
                            </button>
                            <button 
                              onClick={() => setEditingUnitId(null)}
                              className={styles.btn}
                              style={{ width: 'auto', padding: '4px 12px', backgroundColor: '#64748b', fontSize: '0.75rem' }}
                            >
                              キャンセル
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <hr style={{ margin: '30px 0 20px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />
                  
                  <div className={styles.cardTitle}>
                    自由記述用の授業テーマ登録マスター
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <input 
                      type="text"
                      placeholder="例: 高校入試過去問演習"
                      value={newCustomClassName}
                      onChange={e => setNewCustomClassName(e.target.value)}
                      className={styles.input}
                      style={{ maxWidth: '300px' }}
                    />
                    <button 
                      onClick={handleCreateCustomClass}
                      className={styles.btn}
                      style={{ width: 'auto' }}
                    >
                      追加する
                    </button>
                  </div>

                  <div className={styles.curriculumList}>
                    {customClassesList.map(cc => (
                      <div key={cc.id} className={styles.curriculumItem}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {cc.name}
                        </span>
                        <button 
                          onClick={() => handleDeleteCustomClass(cc.id)}
                          className={styles.btn}
                          style={{ width: 'auto', padding: '4px 8px', backgroundColor: '#ef4444', fontSize: '0.75rem' }}
                        >
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: 小テスト結果 */}
              {activeTab === 'mini-tests' && (
                <div className={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <div className={styles.cardTitle} style={{ margin: 0 }}>
                      小テスト結果管理
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {/* 学年選択フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="minitest-grade-filter" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>学年:</label>
                        <select
                          id="minitest-grade-filter"
                          value={miniTestGradeFilter}
                          onChange={e => setMiniTestGradeFilter(e.target.value)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="all">すべての学年</option>
                          <option value="小学生">小学生全員</option>
                          <option value="中学生">中学生全員</option>
                          <option value="高校生">高校生全員</option>
                          {GRADES.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* 教科選択フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="minitest-subject-filter" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>教科:</label>
                        <select
                          id="minitest-subject-filter"
                          value={miniTestSubjectFilter}
                          onChange={e => setMiniTestSubjectFilter(e.target.value)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="all">すべての教科</option>
                          <option value="数学">算数・数学</option>
                          <option value="英語">英語</option>
                          <option value="理科">理科</option>
                          <option value="社会">社会</option>
                          <option value="国語">国語</option>
                        </select>
                      </div>

                      {/* 並び順フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="minitest-sort-order" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>並び順:</label>
                        <select
                          id="minitest-sort-order"
                          value={miniTestSortOrder}
                          onChange={e => setMiniTestSortOrder(e.target.value as any)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="date_desc">日付 (新しい順)</option>
                          <option value="date_asc">日付 (古い順)</option>
                          <option value="name_asc">生徒名 (あいうえお順)</option>
                          <option value="unsubmitted_first">未入力・不合格優先</option>
                          <option value="passed_first">合格優先</option>
                        </select>
                      </div>

                      {/* キーワード検索窓 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label htmlFor="minitest-search" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>検索:</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            id="minitest-search"
                            type="text"
                            placeholder="題名・生徒名・単元で検索..."
                            value={miniTestSearchQuery}
                            onChange={e => setMiniTestSearchQuery(e.target.value)}
                            className={styles.input}
                            style={{ fontSize: '0.8rem', padding: '4px 24px 4px 10px', width: '180px' }}
                          />
                          {miniTestSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setMiniTestSearchQuery('')}
                              style={{
                                position: 'absolute',
                                right: '6px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                padding: '0 2px'
                              }}
                              title="検索をクリア"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {miniTestResultsList
                    .filter(r => {
                      const student = students.find(s => s.id === r.student_id);

                      // 学年フィルター
                      if (miniTestGradeFilter !== 'all') {
                        if (!student) return false;
                        if (miniTestGradeFilter === '小学生' && !(student.grade.startsWith('小') || student.grade === '園児')) return false;
                        if (miniTestGradeFilter === '中学生' && !student.grade.startsWith('中')) return false;
                        if (miniTestGradeFilter === '高校生' && !student.grade.startsWith('高')) return false;
                        if (!['小学生', '中学生', '高校生'].includes(miniTestGradeFilter) && student.grade !== miniTestGradeFilter) return false;
                      }

                      // 教科フィルター
                      if (miniTestSubjectFilter !== 'all') {
                        const targetSub = miniTestSubjectFilter;
                        const matchSubject = r.subject === targetSub || (targetSub === '数学' && (r.subject === '算数' || r.subject === '数学')) || (r.test_content && r.test_content.includes(targetSub));
                        if (!matchSubject) return false;
                      }

                      // 検索クエリ
                      if (!miniTestSearchQuery.trim()) return true;
                      const query = miniTestSearchQuery.toLowerCase().trim();
                      return (
                        (r.test_content && r.test_content.toLowerCase().includes(query)) ||
                        (r.subject && r.subject.toLowerCase().includes(query)) ||
                        (r.passing_line && String(r.passing_line).toLowerCase().includes(query)) ||
                        (student && student.name.toLowerCase().includes(query))
                      );
                    }).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      {miniTestSearchQuery || miniTestGradeFilter !== 'all' || miniTestSubjectFilter !== 'all' ? '該当するテスト・宿題が見つかりませんでした。' : '記録された小テスト結果はありません。'}
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
                            .filter(r => {
                              const student = students.find(s => s.id === r.student_id);

                              // 学年フィルター
                              if (miniTestGradeFilter !== 'all') {
                                if (!student) return false;
                                if (miniTestGradeFilter === '小学生' && !(student.grade.startsWith('小') || student.grade === '園児')) return false;
                                if (miniTestGradeFilter === '中学生' && !student.grade.startsWith('中')) return false;
                                if (miniTestGradeFilter === '高校生' && !student.grade.startsWith('高')) return false;
                                if (!['小学生', '中学生', '高校生'].includes(miniTestGradeFilter) && student.grade !== miniTestGradeFilter) return false;
                              }

                              // 教科フィルター
                              if (miniTestSubjectFilter !== 'all') {
                                const targetSub = miniTestSubjectFilter;
                                const matchSubject = r.subject === targetSub || (targetSub === '数学' && (r.subject === '算数' || r.subject === '数学')) || (r.test_content && r.test_content.includes(targetSub));
                                if (!matchSubject) return false;
                              }

                              // 検索クエリ
                              if (!miniTestSearchQuery.trim()) return true;
                              const query = miniTestSearchQuery.toLowerCase().trim();
                              return (
                                (r.test_content && r.test_content.toLowerCase().includes(query)) ||
                                (r.subject && r.subject.toLowerCase().includes(query)) ||
                                (r.passing_line && String(r.passing_line).toLowerCase().includes(query)) ||
                                (student && student.name.toLowerCase().includes(query))
                              );
                            })
                            .sort((a, b) => {
                              const studentA = students.find(s => s.id === a.student_id);
                              const studentB = students.find(s => s.id === b.student_id);

                              if (miniTestSortOrder === 'date_asc') {
                                return new Date(a.date).getTime() - new Date(b.date).getTime();
                              }
                              if (miniTestSortOrder === 'name_asc') {
                                const nameA = studentA?.name_kana || studentA?.name || '';
                                const nameB = studentB?.name_kana || studentB?.name || '';
                                return nameA.localeCompare(nameB, 'ja');
                              }
                              if (miniTestSortOrder === 'unsubmitted_first') {
                                const isUnsubmittedA = (r: any) => (r.score === null || r.score === undefined) && !tempScores[r.id];
                                const scoreAUnset = isUnsubmittedA(a);
                                const scoreBUnset = isUnsubmittedA(b);
                                if (scoreAUnset && !scoreBUnset) return -1;
                                if (!scoreAUnset && scoreBUnset) return 1;
                              }
                              if (miniTestSortOrder === 'passed_first') {
                                const statusA = tempPassedStatuses[a.id] || (a.score !== null && a.score >= 70 ? 'passed' : 'failed');
                                const statusB = tempPassedStatuses[b.id] || (b.score !== null && b.score >= 70 ? 'passed' : 'failed');
                                if (statusA === 'passed' && statusB !== 'passed') return -1;
                                if (statusA !== 'passed' && statusB === 'passed') return 1;
                              }
                              // デフォルト: 日付新しい順
                              return new Date(b.date).getTime() - new Date(a.date).getTime();
                            })
                            .map(r => {
                              const student = students.find(s => s.id === r.student_id);
                              const stLevel = student?.level || 'A';
                              const passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                              const displayPassingLine = r.passing_line ? r.passing_line : `レベル${stLevel} (${passScore}点)`;

                              return (
                                <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px' }}>{r.date}</td>
                                  <td style={{ padding: '10px', fontWeight: 600 }}>{student ? student.name : '不明な生徒'}</td>
                                  <td style={{ padding: '10px' }}>{r.test_content}</td>
                                  <td style={{ padding: '10px' }}>{displayPassingLine}</td>
                                  <td style={{ padding: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={tempScores[r.id] || ''}
                                        onChange={e => {
                                          const val = e.target.value;
                                          setTempScores({
                                            ...tempScores,
                                            [r.id]: val
                                          });

                                          // 点数入力時の合否自動判定
                                          const scoreVal = parseInt(val);
                                          if (!isNaN(scoreVal)) {
                                            const passScore = stLevel === 'A' ? 90 : stLevel === 'B' ? 80 : 70;
                                            let autoPassed = scoreVal >= passScore;
                                            if (r.passing_line) {
                                              const matchNum = r.passing_line.match(/\d+/);
                                              if (matchNum) {
                                                const limit = parseInt(matchNum[0]);
                                                if (r.passing_line.includes('%') || r.passing_line.includes('割')) {
                                                  const threshold = r.passing_line.includes('割') ? limit * 10 : limit;
                                                  autoPassed = scoreVal >= threshold;
                                                } else if (r.passing_line.includes('点')) {
                                                  autoPassed = scoreVal >= limit;
                                                }
                                              }
                                            }
                                            setTempPassedStatuses(prev => ({
                                              ...prev,
                                              [r.id]: autoPassed ? 'passed' : 'failed'
                                            }));
                                          }
                                        }}
                                        className={styles.input}
                                        style={{ width: '70px', padding: '4px 6px', fontSize: '0.8rem', display: 'inline-block' }}
                                        placeholder="未入力"
                                      />
                                      <span>点</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '10px' }}>
                                    <select
                                      value={tempPassedStatuses[r.id] || 'unstarted'}
                                      onChange={e => {
                                        setTempPassedStatuses({
                                          ...tempPassedStatuses,
                                          [r.id]: e.target.value
                                        });
                                      }}
                                      className={styles.select}
                                      style={{ padding: '4px 6px', fontSize: '0.8rem', width: 'auto' }}
                                    >
                                      <option value="unstarted">未受験</option>
                                      <option value="passed">合格</option>
                                      <option value="failed">不合格</option>
                                    </select>
                                  </td>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <div className={styles.cardTitle} style={{ margin: 0 }}>
                      宿題提出状況管理
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      {/* 学年選択フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="homework-grade-filter" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>学年:</label>
                        <select
                          id="homework-grade-filter"
                          value={homeworkGradeFilter}
                          onChange={e => setHomeworkGradeFilter(e.target.value)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="all">すべての学年</option>
                          <option value="小学生">小学生全員</option>
                          <option value="中学生">中学生全員</option>
                          <option value="高校生">高校生全員</option>
                          {GRADES.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      {/* 教科選択フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="homework-subject-filter" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>教科:</label>
                        <select
                          id="homework-subject-filter"
                          value={homeworkSubjectFilter}
                          onChange={e => setHomeworkSubjectFilter(e.target.value)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="all">すべての教科</option>
                          <option value="数学">算数・数学</option>
                          <option value="英語">英語</option>
                          <option value="理科">理科</option>
                          <option value="社会">社会</option>
                          <option value="国語">国語</option>
                        </select>
                      </div>

                      {/* 並び順フィルター */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <label htmlFor="homework-sort-order" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>並び順:</label>
                        <select
                          id="homework-sort-order"
                          value={homeworkSortOrder}
                          onChange={e => setHomeworkSortOrder(e.target.value as any)}
                          className={styles.select}
                          style={{ fontSize: '0.8rem', padding: '4px 6px', width: 'auto' }}
                        >
                          <option value="date_desc">日付 (新しい順)</option>
                          <option value="date_asc">日付 (古い順)</option>
                          <option value="name_asc">生徒名 (あいうえお順)</option>
                          <option value="unsubmitted_first">未完・未提出優先</option>
                          <option value="completed_first">提出済み優先</option>
                        </select>
                      </div>

                      {/* キーワード検索窓 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label htmlFor="homework-search" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>検索:</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            id="homework-search"
                            type="text"
                            placeholder="題名・生徒名・単元で検索..."
                            value={homeworkSearchQuery}
                            onChange={e => setHomeworkSearchQuery(e.target.value)}
                            className={styles.input}
                            style={{ fontSize: '0.8rem', padding: '4px 24px 4px 10px', width: '180px' }}
                          />
                          {homeworkSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setHomeworkSearchQuery('')}
                              style={{
                                position: 'absolute',
                                right: '6px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                fontSize: '0.85rem',
                                padding: '0 2px'
                              }}
                              title="検索をクリア"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {homeworkResultsList
                    .filter(r => {
                      const student = students.find(s => s.id === r.student_id);

                      // 学年フィルター
                      if (homeworkGradeFilter !== 'all') {
                        if (!student) return false;
                        if (homeworkGradeFilter === '小学生' && !(student.grade.startsWith('小') || student.grade === '園児')) return false;
                        if (homeworkGradeFilter === '中学生' && !student.grade.startsWith('中')) return false;
                        if (homeworkGradeFilter === '高校生' && !student.grade.startsWith('高')) return false;
                        if (!['小学生', '中学生', '高校生'].includes(homeworkGradeFilter) && student.grade !== homeworkGradeFilter) return false;
                      }

                      // 教科フィルター
                      if (homeworkSubjectFilter !== 'all') {
                        const targetSub = homeworkSubjectFilter;
                        const matchSubject = r.subject === targetSub || (targetSub === '数学' && (r.subject === '算数' || r.subject === '数学')) || (r.homework_content && r.homework_content.includes(targetSub));
                        if (!matchSubject) return false;
                      }

                      // 検索クエリ
                      if (!homeworkSearchQuery.trim()) return true;
                      const query = homeworkSearchQuery.toLowerCase().trim();
                      return (
                        (r.homework_content && r.homework_content.toLowerCase().includes(query)) ||
                        (r.subject && r.subject.toLowerCase().includes(query)) ||
                        (r.homework_deadline && r.homework_deadline.toLowerCase().includes(query)) ||
                        (student && student.name.toLowerCase().includes(query))
                      );
                    }).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      {homeworkSearchQuery || homeworkGradeFilter !== 'all' || homeworkSubjectFilter !== 'all' ? '該当するテスト・宿題が見つかりませんでした。' : '記録された宿題はありません。'}
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
                            .filter(r => {
                              const student = students.find(s => s.id === r.student_id);

                              // 学年フィルター
                              if (homeworkGradeFilter !== 'all') {
                                if (!student) return false;
                                if (homeworkGradeFilter === '小学生' && !(student.grade.startsWith('小') || student.grade === '園児')) return false;
                                if (homeworkGradeFilter === '中学生' && !student.grade.startsWith('中')) return false;
                                if (homeworkGradeFilter === '高校生' && !student.grade.startsWith('高')) return false;
                                if (!['小学生', '中学生', '高校生'].includes(homeworkGradeFilter) && student.grade !== homeworkGradeFilter) return false;
                              }

                              // 教科フィルター
                              if (homeworkSubjectFilter !== 'all') {
                                const targetSub = homeworkSubjectFilter;
                                const matchSubject = r.subject === targetSub || (targetSub === '数学' && (r.subject === '算数' || r.subject === '数学')) || (r.homework_content && r.homework_content.includes(targetSub));
                                if (!matchSubject) return false;
                              }

                              // 検索クエリ
                              if (!homeworkSearchQuery.trim()) return true;
                              const query = homeworkSearchQuery.toLowerCase().trim();
                              return (
                                (r.homework_content && r.homework_content.toLowerCase().includes(query)) ||
                                (r.subject && r.subject.toLowerCase().includes(query)) ||
                                (r.homework_deadline && r.homework_deadline.toLowerCase().includes(query)) ||
                                (student && student.name.toLowerCase().includes(query))
                              );
                            })
                            .sort((a, b) => {
                              const studentA = students.find(s => s.id === a.student_id);
                              const studentB = students.find(s => s.id === b.student_id);

                              if (homeworkSortOrder === 'date_asc') {
                                return new Date(a.date).getTime() - new Date(b.date).getTime();
                              }
                              if (homeworkSortOrder === 'name_asc') {
                                const nameA = studentA?.name_kana || studentA?.name || '';
                                const nameB = studentB?.name_kana || studentB?.name || '';
                                return nameA.localeCompare(nameB, 'ja');
                              }
                              if (homeworkSortOrder === 'unsubmitted_first') {
                                const statusA = tempHomeworkStatuses[a.id] || a.status;
                                const statusB = tempHomeworkStatuses[b.id] || b.status;
                                if (statusA === 'incomplete' && statusB !== 'incomplete') return -1;
                                if (statusA !== 'incomplete' && statusB === 'incomplete') return 1;
                              }
                              if (homeworkSortOrder === 'completed_first') {
                                const statusA = tempHomeworkStatuses[a.id] || a.status;
                                const statusB = tempHomeworkStatuses[b.id] || b.status;
                                if (statusA === 'completed' && statusB !== 'completed') return -1;
                                if (statusA !== 'completed' && statusB === 'completed') return 1;
                              }
                              // デフォルト: 日付新しい順
                              return new Date(b.date).getTime() - new Date(a.date).getTime();
                            })
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

                  {/* Gemini API Key Setting */}
                  <div style={{ marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setShowApiKeySetting(!showApiKeySetting)}
                      className={styles.btn}
                      style={{ background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', width: 'auto' }}
                    >
                      🔑 Gemini APIキー設定（成績表画像解析用）
                    </button>
                    {showApiKeySetting && (
                      <div style={{ marginTop: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="password"
                          value={geminiApiKey}
                          onChange={e => setGeminiApiKey(e.target.value)}
                          placeholder="AIzaSy..."
                          className={styles.input}
                          style={{ flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={handleSaveApiKey}
                          className={styles.btn}
                          style={{ width: '80px', background: '#10b981' }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteApiKey}
                          className={styles.btn}
                          style={{ width: '80px', background: '#ef4444' }}
                        >
                          消去
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Image Upload for Analysis */}
                  <div style={{ marginBottom: '20px', padding: '16px', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: '0.9rem', color: '#1e3a8a' }}>📸 成績表・通知表から自動入力</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#3b82f6' }}>
                      成績表や画像ファイルをアップロードすると、AIが点数を解析して自動入力します。
                    </p>
                    <input
                      type="file"
                      id="report-image-upload"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className={styles.input}
                      style={{ fontSize: '0.8rem', padding: '6px' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Regular Test Input */}
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontWeight: 700 }}>定期テスト結果記録</h4>
                      <form onSubmit={handleSaveRegularTest}>
                        <div className={styles.formGroup}>
                          <label>テスト名</label>
                          <input
                            type="text"
                            value={regularTestName}
                            onChange={e => setRegularTestName(e.target.value)}
                            placeholder="例：1学期中間テスト、前期期末テスト"
                            className={styles.input}
                            required
                          />
                        </div>
                        
                        <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                              <th style={{ textAlign: 'left', padding: '4px' }}>項目</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>入力値</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td style={{ padding: '4px' }}>国語得点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreJapanese} onChange={e => setRegularScoreJapanese(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>数学得点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreMath} onChange={e => setRegularScoreMath(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>英語得点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreEnglish} onChange={e => setRegularScoreEnglish(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>社会得点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreSocial} onChange={e => setRegularScoreSocial(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>理科得点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreScience} onChange={e => setRegularScoreScience(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>合計点 (点)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" value={regularScoreTotal} onChange={e => setRegularScoreTotal(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>クラス順位 (位)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="text" value={regularClassRank} onChange={e => setRegularClassRank(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>学年順位 (位)</td>
                              <td style={{ padding: '4px' }}>
                                <input type="text" value={regularSchoolRank} onChange={e => setRegularSchoolRank(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '4px' }}>偏差値</td>
                              <td style={{ padding: '4px' }}>
                                <input type="number" step="0.1" value={regularDeviation} onChange={e => setRegularDeviation(e.target.value)} style={{ width: '100%', padding: '4px' }} className={styles.input} />
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div className={styles.formGroup}>
                          <label>改善点</label>
                          <textarea
                            value={regularImprovement}
                            onChange={e => setRegularImprovement(e.target.value)}
                            className={styles.textarea}
                            style={{ height: '60px' }}
                          ></textarea>
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
                        <div style={{ position: 'relative', width: '76px', height: '76px', flexShrink: 0 }}>
                          <div style={{
                            width: '76px',
                            height: '76px',
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
                          <label title="生徒写真を挿入" style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            backgroundColor: '#3b82f6',
                            color: '#ffffff',
                            borderRadius: '50%',
                            width: '28px',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            border: '2px solid #ffffff'
                          }}>
                            📷
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = evt => {
                                    const res = evt.target?.result as string;
                                    if (res) setEditForm({ ...editForm, image_url: res });
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          {editForm.image_url && (
                            <button
                              type="button"
                              title="生徒写真を削除"
                              onClick={() => setEditForm({ ...editForm, image_url: '' })}
                              style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                backgroundColor: '#ef4444',
                                color: '#ffffff',
                                borderRadius: '50%',
                                width: '22px',
                                height: '22px',
                                border: '2px solid #ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.65rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>氏名（漢字）</label>
                              <input 
                                type="text" 
                                value={editForm.name || ''} 
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className={styles.input} 
                                placeholder="氏名（漢字）"
                                required
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '2px', display: 'block' }}>氏名（フリガナ）</label>
                              <input 
                                type="text" 
                                value={editForm.name_kana || ''} 
                                onChange={e => setEditForm({ ...editForm, name_kana: e.target.value })}
                                className={styles.input} 
                                placeholder="氏名（フリガナ）"
                              />
                            </div>
                          </div>
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
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
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

                      {/* 保護者情報セクション */}
                      <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>👨‍👩‍👧 保護者情報設定</h4>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                          <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
                            <div style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '50%',
                              backgroundColor: '#cbd5e1',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.4rem',
                              fontWeight: 'bold',
                              overflow: 'hidden',
                              position: 'relative'
                            }}>
                              {editForm.parent_image_url ? (
                                <img src={editForm.parent_image_url} alt="保護者アイコン" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (editForm.parent_name || '保').charAt(0)
                              )}
                            </div>
                            <label title="保護者アイコン画像を挿入" style={{
                              position: 'absolute',
                              bottom: '-4px',
                              right: '-4px',
                              backgroundColor: '#3b82f6',
                              color: '#ffffff',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              border: '2px solid #ffffff'
                            }}>
                              📷
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = evt => {
                                      const res = evt.target?.result as string;
                                      if (res) setEditForm({ ...editForm, parent_image_url: res });
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                            {editForm.parent_image_url && (
                              <button
                                type="button"
                                title="保護者アイコンを削除"
                                onClick={() => setEditForm({ ...editForm, parent_image_url: '' })}
                                style={{
                                  position: 'absolute',
                                  top: '-4px',
                                  right: '-4px',
                                  backgroundColor: '#ef4444',
                                  color: '#ffffff',
                                  borderRadius: '50%',
                                  width: '20px',
                                  height: '20px',
                                  border: '2px solid #ffffff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.65rem',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                              <label>保護者氏名（漢字）</label>
                              <input 
                                type="text" 
                                value={editForm.parent_name || ''} 
                                onChange={e => setEditForm({ ...editForm, parent_name: e.target.value })}
                                className={styles.input}
                                placeholder="例: 佐藤 健二"
                              />
                            </div>
                            <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                              <label>保護者氏名（フリガナ）</label>
                              <input 
                                type="text" 
                                value={editForm.parent_name_kana || ''} 
                                onChange={e => setEditForm({ ...editForm, parent_name_kana: e.target.value })}
                                className={styles.input}
                                placeholder="例: サトウ ケンジ"
                              />
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: '12px' }}>
                          <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                            <label>連絡先 (電話番号)</label>
                            <input 
                              type="text" 
                              value={editForm.contact_phone || ''} 
                              onChange={e => setEditForm({ ...editForm, contact_phone: e.target.value })}
                              className={styles.input}
                              placeholder="例: 090-7039-0656"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 志望校設定セクション */}
                      <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>🎯 志望校設定（最大3校まで登録可能）</h4>
                          {((editForm as any).target_schools || []).length < 3 && (
                            <button
                              type="button"
                              onClick={() => {
                                const current = (editForm as any).target_schools || [{ school_name: editForm.target_school || '', course_name: '' }];
                                if (current.length < 3) {
                                  const updated = [...current, { school_name: '', course_name: '' }];
                                  setEditForm({ ...editForm, target_schools: updated, target_school: updated[0]?.school_name || '' } as any);
                                }
                              }}
                              style={{ padding: '4px 10px', fontSize: '0.75rem', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                            >
                              ＋ 志望校を追加
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {((editForm as any).target_schools || [{ school_name: editForm.target_school || '', course_name: '' }]).map((sch: any, idx: number) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5', width: '60px', flexShrink: 0 }}>
                                {idx === 0 ? '第1志望' : idx === 1 ? '第2志望' : '第3志望'}
                              </span>
                              <div style={{ flex: 2 }}>
                                <input
                                  type="text"
                                  placeholder="志望校名（例: 天登星雲高校）"
                                  value={sch.school_name || ''}
                                  onChange={e => {
                                    const current = [...((editForm as any).target_schools || [{ school_name: '', course_name: '' }])];
                                    current[idx] = { ...current[idx], school_name: e.target.value };
                                    setEditForm({ ...editForm, target_schools: current, target_school: current[0]?.school_name || '' } as any);
                                  }}
                                  className={styles.input}
                                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                />
                              </div>
                              <div style={{ flex: 2 }}>
                                <input
                                  type="text"
                                  placeholder="学科・コース名（例: 普通科 特進コース）"
                                  value={sch.course_name || ''}
                                  onChange={e => {
                                    const current = [...((editForm as any).target_schools || [{ school_name: '', course_name: '' }])];
                                    current[idx] = { ...current[idx], course_name: e.target.value };
                                    setEditForm({ ...editForm, target_schools: current, target_school: current[0]?.school_name || '' } as any);
                                  }}
                                  className={styles.input}
                                  style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                                />
                              </div>
                              {((editForm as any).target_schools || []).length > 1 && (
                                <button
                                  type="button"
                                  title="この志望校を削除"
                                  onClick={() => {
                                    const current = [...((editForm as any).target_schools || [])];
                                    current.splice(idx, 1);
                                    setEditForm({ ...editForm, target_schools: current, target_school: current[0]?.school_name || '' } as any);
                                  }}
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                  削除
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 週の回数、1回の時間、コマ数設定 */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '16px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>📅 通塾条件・コマ数設定</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                          <div className={styles.formGroup}>
                            <label htmlFor="edit-weekly-frequency">週の通塾回数</label>
                            <select 
                              id="edit-weekly-frequency"
                              value={(editForm as any).weekly_sessions_count || '2回'} 
                              onChange={e => {
                                const newFreq = e.target.value;
                                const max = newFreq.includes('2') ? 2 : newFreq.includes('3') ? 3 : newFreq.includes('4') ? 4 : newFreq.includes('5') ? 5 : null;
                                let curDays = ((editForm as any).selected_days || ['tuesday', 'friday']);
                                if (max !== null && curDays.length > max) {
                                  curDays = curDays.slice(0, max);
                                }
                                setEditForm({ ...editForm, weekly_sessions_count: newFreq, selected_days: curDays } as any);
                              }}
                              className={styles.select}
                            >
                              <option value="2回">週2回</option>
                              <option value="3回">週3回</option>
                              <option value="4回">週4回</option>
                              <option value="5回">週5回</option>
                              <option value="無制限">無制限</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="edit-weekly-duration">1回の時間</label>
                            <select 
                              id="edit-weekly-duration"
                              value={(editForm as any).weekly_duration_minutes || '120分'} 
                              onChange={e => setEditForm({ ...editForm, weekly_duration_minutes: e.target.value } as any)}
                              className={styles.select}
                            >
                              <option value="60分">60分</option>
                              <option value="90分">90分</option>
                              <option value="120分">120分</option>
                              <option value="180分">180分</option>
                              <option value="240分">240分</option>
                              <option value="無制限">無制限</option>
                            </select>
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="edit-default-slots">標準コマ数</label>
                            <select 
                              id="edit-default-slots"
                              value={editForm.period_count || (editForm as any).default_slots || 2} 
                              onChange={e => {
                                const val = parseInt(e.target.value) || 2;
                                setEditForm({ ...editForm, period_count: val, default_slots: val } as any);
                              }}
                              className={styles.select}
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                <option key={num} value={num}>{num}コマ</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 通塾曜日設定 */}
                        <div style={{ marginTop: '14px', backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block' }}>
                              🗓️ 通塾曜日設定
                            </label>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {(() => {
                                const freq = (editForm as any).weekly_sessions_count || '2回';
                                const max = freq.includes('2') ? 2 : freq.includes('3') ? 3 : freq.includes('4') ? 4 : freq.includes('5') ? 5 : null;
                                const curDays = ((editForm as any).selected_days || ['tuesday', 'friday']);
                                return max !== null ? `選択中: ${curDays.length} / 最大${max}日` : `選択中: ${curDays.length}日 (無制限)`;
                              })()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {[
                              { id: 'monday', label: '月' },
                              { id: 'tuesday', label: '火' },
                              { id: 'wednesday', label: '水' },
                              { id: 'thursday', label: '木' },
                              { id: 'friday', label: '金' },
                              { id: 'saturday', label: '土' },
                              { id: 'sunday', label: '日' }
                            ].map(d => {
                              const curDays = ((editForm as any).selected_days || ['tuesday', 'friday']);
                              const isSelected = curDays.includes(d.id);
                              return (
                                <button
                                  key={d.id}
                                  type="button"
                                  data-testid={`day-chip-${d.id}`}
                                  onClick={() => {
                                    const freq = (editForm as any).weekly_sessions_count || '2回';
                                    const max = freq.includes('2') ? 2 : freq.includes('3') ? 3 : freq.includes('4') ? 4 : freq.includes('5') ? 5 : null;
                                    if (isSelected) {
                                      const filtered = curDays.filter((x: string) => x !== d.id);
                                      setEditForm({ ...editForm, selected_days: filtered } as any);
                                    } else {
                                      if (max !== null && curDays.length >= max) {
                                        alert(`週の通塾回数が「${freq}」のため、選択可能な曜日は最大${max}日です。他の曜日を解除してから選択してください。`);
                                        return;
                                      }
                                      setEditForm({ ...editForm, selected_days: [...curDays, d.id] } as any);
                                    }
                                  }}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    border: isSelected ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                                    backgroundColor: isSelected ? '#3b82f6' : '#ffffff',
                                    color: isSelected ? '#ffffff' : '#334155',
                                    fontWeight: 700,
                                    fontSize: '0.88rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: isSelected ? '0 2px 6px rgba(59, 130, 246, 0.35)' : 'none',
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 教科別スタート位置設定 */}
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 700 }}>教科別学習スタート位置</h4>
                        <p style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#64748b' }}>
                          各教科でカリキュラム自動生成を開始する「基準単元」を設定できます。設定されていない場合は最初から開始されます。
                        </p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {[
                            { key: 'start_unit_math', label: '数学（算数）', subject: '数学' },
                            { key: 'start_unit_english', label: '英語', subject: '英語' },
                            { key: 'start_unit_science', label: '理科', subject: '理科' },
                            { key: 'start_unit_social', label: '社会', subject: '社会' },
                            { key: 'start_unit_japanese', label: '国語', subject: '国語' }
                          ].map(item => {
                            const val = (editForm as any)[item.key] || '';
                            const schoolUnits = allCurriculumUnits.filter(u => u.school_id === selectedStudent.school_id && u.subject === item.subject);
                            
                            return (
                              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, width: '100px' }}>{item.label}:</label>
                                <select
                                  value={val}
                                  onChange={e => setEditForm({ ...editForm, [item.key]: e.target.value || null })}
                                  className={styles.select}
                                  style={{ flex: 1, fontSize: '0.8rem', padding: '4px 6px' }}
                                >
                                  <option value="">-- 最初から開始 --</option>
                                  {schoolUnits.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
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
