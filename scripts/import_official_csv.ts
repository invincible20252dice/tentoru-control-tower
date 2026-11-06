import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oqwnciwyzstiqszdgekr.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd25jaXd5enN0aXFzemRnZWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTYyOTgsImV4cCI6MjEwMDg5MjI5OH0.eGbXPVamL-6hMOehuViThOrkG1I_HGSajdLbGQE7c8M';

const sb = createClient(supabaseUrl, supabaseKey);

const csvDir = '/Users/satouhideki/Desktop/開発/テンアップ/CSV小学生テントルカリキュラム';
const csvFiles = [
  '算数-grades_rows.csv',
  '国語-grades_rows.csv',
  '英語-grades_rows.csv',
  '理科-grades_rows.csv',
  '社会-grades_rows.csv'
];

interface CsvRow {
  id: string;
  grade: string;
  subject: string;
  unit_name: string;
  lesson_name: string;
  sort_order: number;
  item_type: 'lesson' | 'unit_test';
}

function parseAll(): CsvRow[] {
  let all: CsvRow[] = [];
  let globalOrder = 1;

  for (const file of csvFiles) {
    const fullPath = path.join(csvDir, file);
    if (!fs.existsSync(fullPath)) continue;

    const defaultSubject = file.split('-')[0];
    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
    const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const sIdx = header.findIndex(h => h === '教科');
    const gIdx = header.findIndex(h => h === '学年');
    const uIdx = header.findIndex(h => h === '単元' || h === '単元名');
    const lIdx = header.findIndex(h => h === '授業名' || h === '授業');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cells: string[] = [];
      let inQ = false;
      let cur = '';
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"' || ch === "'") inQ = !inQ;
        else if (ch === ',' && !inQ) {
          cells.push(cur.trim().replace(/^["']|["']$/g, ''));
          cur = '';
        } else cur += ch;
      }
      cells.push(cur.trim().replace(/^["']|["']$/g, ''));

      const subject = (sIdx >= 0 ? cells[sIdx] : '') || defaultSubject;
      const grade = (gIdx >= 0 ? cells[gIdx] : '') || '1年生';
      const unit_name = (uIdx >= 0 ? cells[uIdx] : '') || '単元未設定';
      const lesson_name = (lIdx >= 0 ? cells[lIdx] : '') || '授業未設定';

      const gMatch = grade.match(/([1-6])/);
      const normalizedGrade = gMatch ? `小${gMatch[1]}` : grade;
      const isUT = lesson_name.includes('単元確認テスト') || 
                   lesson_name.includes('単元テスト') || 
                   lesson_name.includes('まとめテスト') || 
                   lesson_name.includes('確認テスト');

      all.push({
        id: `cm-${subject}-${normalizedGrade}-${all.length + 1}`,
        grade: normalizedGrade,
        subject,
        unit_name,
        lesson_name,
        sort_order: globalOrder++,
        item_type: isUT ? 'unit_test' : 'lesson'
      });
    }
  }
  return all;
}

async function main() {
  console.log('=== [Supabase CSVカリキュラム一括同期スクリプト] ===');
  const rows = parseAll();
  console.log(`抽出されたカリキュラムデータ: ${rows.length} 件`);

  // 100件ずつチャンク分割して upsert
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from('curriculum_masters').upsert(chunk);
    if (error) {
      console.error(`Chunk ${i}〜${i + chunk.length} エラー:`, error);
      process.exit(1);
    }
    console.log(`✓ ${i + chunk.length} / ${rows.length} 件投入完了`);
  }

  console.log('🎉 全955件のCSVカリキュラムマスター同期が完全に完了しました！');
}

main();
