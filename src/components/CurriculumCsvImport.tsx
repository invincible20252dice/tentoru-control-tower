'use client';

import React, { useState, useEffect, useRef } from 'react';
import { db, CurriculumMaster } from '../lib/db';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  Search,
  ArrowLeft,
  Copy,
  RefreshCw,
  BookOpen,
  Layers,
  Database
} from 'lucide-react';

interface CurriculumCsvImportProps {
  onBack?: () => void;
  onImportCompleted?: () => void;
}

export const CurriculumCsvImport: React.FC<CurriculumCsvImportProps> = ({
  onBack,
  onImportCompleted
}) => {
  const [masters, setMasters] = useState<CurriculumMaster[]>([]);
  const [parsedRows, setParsedRows] = useState<Array<{
    grade: string;
    subject: string;
    unit_name: string;
    lesson_name: string;
    item_type?: 'lesson' | 'unit_test';
    passing_line?: string;
    sort_order: number;
  }>>([]);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'import' | 'list' | 'unit_tests'>('import');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load masters data
  const loadMasters = () => {
    const list = db.getCurriculumMasters();
    setMasters(list);
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Parse CSV text
  const parseCsvText = (text: string) => {
    // Split lines, handling CRLF and LF
    const lines = text.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      showToast('CSVファイルが空です。', 'error');
      return;
    }

    // Header validation
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));

    // Map column indices
    const gradeIdx = headers.findIndex(h => h === '学年' || h.toLowerCase() === 'grade');
    const subjectIdx = headers.findIndex(h => h === '教科' || h.toLowerCase() === 'subject');
    const unitIdx = headers.findIndex(h => h === '単元名' || h === '単元' || h.toLowerCase() === 'unit_name' || h.toLowerCase() === 'unit');
    const lessonIdx = headers.findIndex(h => h === '授業名' || h === '授業' || h === 'テーマ名' || h === 'テスト名' || h.toLowerCase() === 'lesson_name' || h.toLowerCase() === 'test_name');
    const typeIdx = headers.findIndex(h => h === '区分' || h === 'タイプ' || h === '種別' || h.toLowerCase() === 'item_type' || h.toLowerCase() === 'type');
    const passingLineIdx = headers.findIndex(h => h === '合格基準' || h === '合格ライン' || h === '目標点' || h.toLowerCase() === 'passing_line');

    if (gradeIdx === -1 || subjectIdx === -1 || unitIdx === -1 || lessonIdx === -1) {
      showToast('CSVヘッダーに「学年」「教科」「単元名」「授業名（またはテスト名）」が含まれている必要があります。', 'error');
      return;
    }

    const rows: Array<{
      grade: string;
      subject: string;
      unit_name: string;
      lesson_name: string;
      item_type: 'lesson' | 'unit_test';
      passing_line?: string;
      sort_order: number;
    }> = [];

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Handle comma separation with possible quotes
      const cells: string[] = [];
      let inQuotes = false;
      let cur = '';

      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else {
          cur += char;
        }
      }
      cells.push(cur.trim().replace(/^["']|["']$/g, ''));

      const grade = cells[gradeIdx] || '';
      const subject = cells[subjectIdx] || '';
      const unit_name = cells[unitIdx] || '';
      const lesson_name = cells[lessonIdx] || '';
      const typeVal = typeIdx !== -1 ? cells[typeIdx] || '' : '';
      const passing_line = passingLineIdx !== -1 ? cells[passingLineIdx] || '' : undefined;
      const isUnitTest = typeVal.includes('テスト') || typeVal.includes('test') || lesson_name.includes('テスト') || lesson_name.includes('確認');
      const item_type: 'lesson' | 'unit_test' = isUnitTest ? 'unit_test' : 'lesson';

      if (grade || subject || unit_name || lesson_name) {
        rows.push({
          grade: grade || '小5',
          subject: subject || '算数',
          unit_name: unit_name || '単元未設定',
          lesson_name: lesson_name || '授業名未設定',
          item_type,
          passing_line: passing_line || (isUnitTest ? '80%以上' : undefined),
          sort_order: rows.length + 1
        });
      }
    }

    if (rows.length === 0) {
      showToast('インポート可能なデータ行が見つかりませんでした。', 'error');
      return;
    }

    setParsedRows(rows);
    showToast(`${rows.length}件のカリキュラムデータを読み込みました。`, 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      showToast('CSVファイル (.csv) を選択してください。', 'error');
      return;
    }

    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      parseCsvText(content);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Download Sample CSV template
  const handleDownloadSampleCsv = () => {
    const sampleContent = `学年,教科,単元名,授業名
小5,算数,1章 整数と小数,小数と10倍・100倍・1/10
小5,算数,1章 整数と小数,小数の位取りと数の構成
小5,算数,2章 小数の乗除,小数×整数の計算
小5,算数,2章 小数の乗除,小数÷整数の計算
小5,算数,2章 小数の乗除,小数×小数の筆算
小5,算数,2章 小数の乗除,小数÷小数の筆算と余り
小5,国語,1章 言語事項,同音異義語・同訓異字
小5,国語,1章 言語事項,敬語の種類と使い方
中1,数学,1章 正の数・負の数,正の数・負の数の意味
中1,数学,1章 正の数・負の数,数直線と絶対値
中1,数学,1章 正の数・負の数,正負の数の加法と減法
中1,数学,1章 正の数・負の数,正負の数の乗法と除法
中1,英語,1章 Be動詞,Be動詞の肯定文
中1,英語,1章 Be動詞,Be動詞の否定文・疑問文
中3,数学,1章 式の展開と因数分解,多項式の乗法と公式①
中3,数学,1章 式の展開と因数分解,乗法公式②③④と展開の工夫
中3,数学,1章 式の展開と因数分解,因数分解の基本と公式利用
中3,数学,2章 平方根,平方根の意味と根号（√）
中3,数学,2章 平方根,根号を含む式の計算と有理化`;

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_curriculum_master.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy sample text
  const handleCopySample = () => {
    const sample = `学年,教科,単元名,授業名
小5,算数,1章 整数と小数,小数と10倍・100倍・1/10
小5,算数,1章 整数と小数,小数の位取りと数の構成
小5,算数,2章 小数の乗除,小数×整数の計算
中3,数学,1章 式の展開と因数分解,多項式の乗法と公式①`;
    navigator.clipboard.writeText(sample);
    showToast('サンプルCSVフォーマットをクリップボードにコピーしました。', 'success');
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      showToast('インポートするデータがありません。', 'error');
      return;
    }

    setImporting(true);
    try {
      const now = new Date().toISOString();
      const newMasters: CurriculumMaster[] = parsedRows.map((row, idx) => ({
        id: `cm-${Date.now()}-${idx + 1}`,
        grade: row.grade,
        subject: row.subject,
        unit_name: row.unit_name,
        lesson_name: row.lesson_name,
        item_type: row.item_type || 'lesson',
        sort_order: idx + 1,
        created_at: now
      }));

      await db.saveCurriculumMasters(newMasters);

      showToast(`カリキュラムマスター ${newMasters.length}件を正常にインポート・保存しました！`, 'success');
      setParsedRows([]);
      setFileName('');
      setFileSize('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadMasters();
      if (onImportCompleted) onImportCompleted();
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(`インポートに失敗しました: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  // Delete single master
  const handleDeleteMaster = async (id: string) => {
    if (confirm('このカリキュラム項目を削除してもよろしいですか？')) {
      await db.deleteCurriculumMaster(id);
      loadMasters();
      showToast('カリキュラム項目を削除しました。', 'success');
    }
  };

  // Clear all masters
  const handleClearAll = async () => {
    if (confirm('登録されているすべてのカリキュラムマスターを削除してもよろしいですか？')) {
      await db.clearCurriculumMasters();
      loadMasters();
      showToast('カリキュラムマスターをすべて初期化しました。', 'success');
    }
  };

  // Delete legacy format data (小1, 小2, 小3, 小4, 小5, 小6, 中3)
  const handleDeleteLegacyData = async () => {
    const targetGrades = ['小1', '小2', '小3', '小4', '小5', '小6', '中3'];
    if (confirm(`旧フォーマット（${targetGrades.join(', ')}）のカリキュラムマスターデータを一括削除しますか？\n（Supabase DBおよびローカルキャッシュから削除されます）`)) {
      try {
        // 1. Client-side DB delete
        const res = await db.deleteCurriculumMastersByGrades(targetGrades);

        // 2. Server-side API trigger (if online)
        try {
          await fetch('/api/admin/curriculum-masters/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grades: targetGrades })
          });
        } catch (apiErr) {
          console.warn('API cleanup error (ignoring if offline):', apiErr);
        }

        loadMasters();
        showToast(`旧フォーマットデータ（${targetGrades.join(', ')}）を一括削除しました。`, 'success');
      } catch (err: any) {
        console.error('Delete legacy data error:', err);
        showToast(`削除に失敗しました: ${err.message || err}`, 'error');
      }
    }
  };

  // CSV Export for Unit Tests or All
  const exportUnitTestCsv = () => {
    const unitTests = masters.filter(m => m.item_type === 'unit_test' || m.lesson_name.includes('テスト') || m.lesson_name.includes('確認'));
    if (unitTests.length === 0) {
      showToast('エクスポート対象の単元テストマスタデータがありません。', 'error');
      return;
    }

    const headers = ['学年', '教科', '単元名', 'テスト名', '区分', '合格基準'];
    const rows = unitTests.map(m => [
      `"${m.grade}"`,
      `"${m.subject}"`,
      `"${m.unit_name}"`,
      `"${m.lesson_name}"`,
      `"単元テスト"`,
      `"${m.passing_line || '80%以上'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `単元テストマスタ一覧_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('単元テストマスタCSVを出力しました。', 'success');
  };

  const downloadSampleUnitTestCsv = () => {
    const sampleText = `\uFEFF学年,教科,単元名,テスト名,区分,合格基準
小5,算数,1章 整数と小数,1章 整数と小数 単元確認テスト,単元テスト,80点以上
小5,算数,2章 小数の乗除,2章 小数の乗除 単元確認テスト,単元テスト,80点以上
中2,数学,1章 式の計算,1章 式の計算 単元確認テスト,単元テスト,80%以上
中2,英語,1章 Be動詞・一般動詞,1章 Be動詞 単元確認テスト,単元テスト,80%以上`;

    const blob = new Blob([sampleText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `単元テスト_インポートサンプル.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('単元テスト用サンプルCSVをダウンロードしました。', 'success');
  };

  // Filtered list
  const filteredMasters = masters.filter(m => {
    if (filterGrade !== 'all' && m.grade !== filterGrade) return false;
    if (filterSubject !== 'all' && m.subject !== filterSubject) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.unit_name.toLowerCase().includes(q) ||
        m.lesson_name.toLowerCase().includes(q) ||
        m.grade.toLowerCase().includes(q) ||
        m.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unitTestMasters = masters.filter(m => m.item_type === 'unit_test' || m.lesson_name.includes('テスト') || m.lesson_name.includes('確認'));

  const uniqueGrades = Array.from(new Set(masters.map(m => m.grade))).filter(Boolean);
  const uniqueSubjects = Array.from(new Set(masters.map(m => m.subject))).filter(Boolean);

  // Group stats for parsed preview
  const previewGradeStats = parsedRows.reduce((acc, row) => {
    acc[row.grade] = (acc[row.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const previewSubjectStats = parsedRows.reduce((acc, row) => {
    acc[row.subject] = (acc[row.subject] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 0' }}>
      {/* Toast */}
      {toast && (
        <div
          data-testid="curriculum-import-toast"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 100,
            padding: '12px 20px',
            borderRadius: '8px',
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.88rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <ArrowLeft size={16} />
              戻る
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet color="#3b82f6" size={26} />
              カリキュラムデータ CSV一括インポート
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              学年・教科ごとの授業計画および「単元テスト（合格基準付き）」をCSVから一括インポート/エクスポートし、マスター管理します。
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '3px' }}>
          <button
            type="button"
            data-testid="tab-csv-import"
            onClick={() => setActiveTab('import')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'import' ? '#3b82f6' : 'transparent',
              color: activeTab === 'import' ? '#ffffff' : '#475569',
              transition: 'all 0.15s'
            }}
          >
            📥 CSVインポート
          </button>
          <button
            type="button"
            data-testid="tab-unit-tests"
            onClick={() => setActiveTab('unit_tests')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'unit_tests' ? '#8b5cf6' : 'transparent',
              color: activeTab === 'unit_tests' ? '#ffffff' : '#475569',
              transition: 'all 0.15s'
            }}
          >
            📝 単元テスト一括管理＆CSV出力
          </button>
          <button
            type="button"
            data-testid="tab-curriculum-list"
            onClick={() => setActiveTab('list')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: activeTab === 'list' ? '#3b82f6' : 'transparent',
              color: activeTab === 'list' ? '#ffffff' : '#475569',
              transition: 'all 0.15s'
            }}
          >
            📋 登録済みマスター一覧 ({masters.length}件)
          </button>
        </div>
      </div>

      {activeTab === 'unit_tests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Info & Export Card */}
          <div style={{ backgroundColor: '#f3e8ff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #d8b4fe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📝 単元テスト マスタ管理 & CSV入出力
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#7e22ce', lineHeight: 1.5 }}>
                  単元テスト（合格基準付き）の一覧確認、CSV形式でのダウンロード、およびサンプルフォーマットの取得が可能です。<br />
                  インポート時は「CSVインポート」タブから <code>区分: 単元テスト</code> または <code>テスト名</code> を含めてアップロードしてください。
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="download-unit-test-sample-btn"
                  onClick={downloadSampleUnitTestCsv}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #c084fc',
                    backgroundColor: '#ffffff',
                    color: '#6b21a8',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={15} />
                  単元テスト用サンプルCSV
                </button>
                <button
                  type="button"
                  data-testid="export-unit-test-csv-btn"
                  onClick={exportUnitTestCsv}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  <Download size={15} />
                  登録済み単元テストCSVエクスポート ({unitTestMasters.length}件)
                </button>
              </div>
            </div>
          </div>

          {/* Unit Test Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '16px', overflowX: 'auto' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>
              登録済み 単元テストマスタ一覧 ({unitTestMasters.length}件)
            </h4>

            {unitTestMasters.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                登録されている単元テストマスタがありません。「CSVインポート」から単元テストを含むCSVをアップロードするか、年間計画マイルストーン画面から「＋ 単元テストを追加」してください。
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: '80px' }}>学年</th>
                    <th style={{ padding: '10px 12px', width: '80px' }}>教科</th>
                    <th style={{ padding: '10px 12px', width: '220px' }}>対象単元名</th>
                    <th style={{ padding: '10px 12px' }}>単元テスト名</th>
                    <th style={{ padding: '10px 12px', width: '120px' }}>合格基準</th>
                    <th style={{ padding: '10px 12px', width: '80px', textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {unitTestMasters.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.grade}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                          {m.subject}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569', fontWeight: 600 }}>{m.unit_name}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#6b21a8' }}>
                        📝 {m.lesson_name}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                          {m.passing_line || '80%以上'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          data-testid={`delete-unittest-master-${m.id}`}
                          onClick={async () => {
                            if (confirm(`単元テスト「${m.lesson_name}」を削除しますか？`)) {
                              await db.deleteCurriculumMaster(m.id);
                              loadMasters();
                              showToast('単元テストを削除しました。', 'success');
                            }
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #fecaca',
                            backgroundColor: '#fef2f2',
                            color: '#ef4444',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Guidelines & Templates */}
          <div style={{ backgroundColor: '#f0f9ff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 700, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={18} />
                  CSVフォーマット仕様
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                  CSVファイルの先頭行（ヘッダー）には <strong>学年, 教科, 単元名, 授業名</strong> を記載してください。<br />
                  上から順に <code>sort_order: 1, 2, 3...</code> と自動採番され、年間計画およびタイムラインの基準順序となります。
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  data-testid="download-sample-csv-btn"
                  onClick={handleDownloadSampleCsv}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #38bdf8',
                    backgroundColor: '#ffffff',
                    color: '#0284c7',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  サンプルCSVダウンロード
                </button>
                <button
                  type="button"
                  onClick={handleCopySample}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={14} />
                  形式をコピー
                </button>
              </div>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            data-testid="csv-dropzone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{
              border: isDragging ? '2px dashed #3b82f6' : '2px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '36px 24px',
              backgroundColor: isDragging ? '#eff6ff' : '#ffffff',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              data-testid="csv-file-input"
            />
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <UploadCloud size={30} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
              CSVファイルをドラッグ＆ドロップ、またはクリックして選択
            </h3>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#64748b' }}>
              文字コード: UTF-8 / 形式: .csv（ヘッダー: 学年, 教科, 単元名, 授業名）
            </p>

            {fileName && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>
                <FileSpreadsheet size={16} color="#10b981" />
                <span>{fileName}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({fileSize})</span>
              </div>
            )}
          </div>

          {/* Parsed Preview Section */}
          {parsedRows.length > 0 && (
            <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color="#3b82f6" />
                    インポートデータ プレビュー ({parsedRows.length}件)
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    内容を確認し、問題なければ「カリキュラムマスターへ一括登録」ボタンを押してください。
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFileName('');
                      setFileSize('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#64748b',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    キャンセル
                  </button>

                  <button
                    type="button"
                    data-testid="execute-import-btn"
                    onClick={handleExecuteImport}
                    disabled={importing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      cursor: importing ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.3)',
                      opacity: importing ? 0.7 : 1
                    }}
                  >
                    {importing ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                    カリキュラムマスターへ一括登録
                  </button>
                </div>
              </div>

              {/* Stats Summary Badges */}
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>学年別:</span>
                  {Object.entries(previewGradeStats).map(([gr, count]) => (
                    <span key={gr} style={{ fontSize: '0.72rem', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      {gr}: {count}件
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>教科別:</span>
                  {Object.entries(previewSubjectStats).map(([sub, count]) => (
                    <span key={sub} style={{ fontSize: '0.72rem', backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      {sub}: {count}件
                    </span>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px', color: '#475569' }}>順序 (sort_order)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px', color: '#475569' }}>学年</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px', color: '#475569' }}>教科</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', width: '200px', color: '#475569' }}>単元名</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>授業名（テーマ）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#3b82f6' }}>#{row.sort_order}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {row.grade}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {row.subject}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>{row.unit_name}</td>
                        <td style={{ padding: '8px 12px', color: '#1e293b' }}>{row.lesson_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'list' && (
        <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          {/* Top Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="単元・授業名で検索..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              {/* Grade filter */}
              <select
                value={filterGrade}
                onChange={e => setFilterGrade(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#fff' }}
              >
                <option value="all">すべての学年</option>
                {uniqueGrades.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>

              {/* Subject filter */}
              <select
                value={filterSubject}
                onChange={e => setFilterSubject(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#fff' }}
              >
                <option value="all">すべての教科</option>
                {uniqueSubjects.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={loadMasters}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={14} />
                更新
              </button>
              {masters.length > 0 && (
                <>
                  <button
                    type="button"
                    data-testid="delete-legacy-masters-btn"
                    onClick={handleDeleteLegacyData}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fed7aa',
                      backgroundColor: '#fff7ed',
                      color: '#c2410c',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    旧フォーマット一括削除 (小1~小6, 中3)
                  </button>
                  <button
                    type="button"
                    data-testid="clear-all-masters-btn"
                    onClick={handleClearAll}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    全件クリア
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Master Table */}
          {filteredMasters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <FileSpreadsheet size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>登録されたカリキュラムマスターがありません。</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem' }}>「CSVインポート」タブからCSVファイルをアップロードしてください。</p>
            </div>
          ) : (
            <div style={{ maxHeight: '560px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '80px', color: '#475569' }}>順序</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px', color: '#475569' }}>学年</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px', color: '#475569' }}>教科</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', width: '220px', color: '#475569' }}>単元名</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>授業名（テーマ）</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', width: '70px', color: '#475569' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMasters.map((m, i) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#3b82f6' }}>#{m.sort_order}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {m.grade}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', backgroundColor: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {m.subject}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155' }}>{m.unit_name}</td>
                      <td style={{ padding: '8px 12px', color: '#1e293b' }}>{m.lesson_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteMaster(m.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px 4px'
                          }}
                          title="削除"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurriculumCsvImport;
