import * as fs from 'fs';
import * as path from 'path';

const csvDir = '/Users/satouhideki/Desktop/開発/テンアップ/CSV小学生テントルカリキュラム';
const csvFiles = [
  '算数-grades_rows.csv',
  '国語-grades_rows.csv',
  '英語-grades_rows.csv',
  '理科-grades_rows.csv',
  '社会-grades_rows.csv'
];

interface CsvMasterRow {
  id: string;
  grade: string;
  subject: string;
  unit_name: string;
  lesson_name: string;
  sort_order: number;
  item_type: 'lesson' | 'unit_test';
}

function parseCsv(filePath: string, defaultSubject: string): CsvMasterRow[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r\n|\n|\r/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return [];

  const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const subjectIdx = header.findIndex(h => h === '教科');
  const gradeIdx = header.findIndex(h => h === '学年');
  const unitIdx = header.findIndex(h => h === '単元' || h === '単元名');
  const lessonIdx = header.findIndex(h => h === '授業名' || h === '授業' || h === 'テスト名');

  const rows: CsvMasterRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const cells: string[] = [];
    let inQuotes = false;
    let cur = '';
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"' || ch === "'") inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim().replace(/^["']|["']$/g, ''));
        cur = '';
      } else cur += ch;
    }
    cells.push(cur.trim().replace(/^["']|["']$/g, ''));

    let subject = (subjectIdx >= 0 ? cells[subjectIdx] : '') || defaultSubject;
    let grade = (gradeIdx >= 0 ? cells[gradeIdx] : '') || '1年生';
    let unit_name = (unitIdx >= 0 ? cells[unitIdx] : '') || '単元未設定';
    let lesson_name = (lessonIdx >= 0 ? cells[lessonIdx] : '') || '授業未設定';

    // 学年の正規化 (例: '1年生' -> '小1', '5年生' -> '小5')
    const gMatch = grade.match(/([1-6])/);
    const normalizedGrade = gMatch ? `小${gMatch[1]}` : grade;

    // 単元テスト判定
    const isUnitTest = lesson_name.includes('単元確認テスト') || 
                       lesson_name.includes('単元テスト') || 
                       lesson_name.includes('まとめテスト') || 
                       lesson_name.includes('確認テスト');
    const item_type = isUnitTest ? 'unit_test' : 'lesson';

    // 一意なIDの生成 (例: cm-算数-小1-1)
    const id = `cm-${subject}-${normalizedGrade}-${rows.length + 1}`;

    rows.push({
      id,
      grade: normalizedGrade,
      subject,
      unit_name,
      lesson_name,
      sort_order: rows.length + 1,
      item_type
    });
  }
  return rows;
}

let allRows: CsvMasterRow[] = [];
for (const file of csvFiles) {
  const defaultSub = file.split('-')[0];
  const fullPath = path.join(csvDir, file);
  const rows = parseCsv(fullPath, defaultSub);
  console.log(`Parsed ${file}: ${rows.length} rows`);
  allRows = allRows.concat(rows);
}
console.log(`Total parsed from CSVs: ${allRows.length} rows`);

// SQL の構築
let sql = `-- ==============================================================================
-- 1. curriculum_masters テーブルの作成と権限開放
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.curriculum_masters (
    id TEXT PRIMARY KEY,
    grade TEXT NOT NULL,
    grade_level TEXT,
    subject TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    lesson_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    item_type TEXT DEFAULT 'lesson',
    passing_line TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT ALL ON public.curriculum_masters TO anon, authenticated;
ALTER TABLE public.curriculum_masters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to curriculum_masters" ON public.curriculum_masters;
CREATE POLICY "Allow all access to curriculum_masters" ON public.curriculum_masters
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 2. CSV小学生テントルカリキュラム（全950単元・レッスン）の一括シード
-- ==============================================================================
INSERT INTO public.curriculum_masters (id, grade, subject, unit_name, lesson_name, sort_order, item_type)
VALUES
`;

const valueRows = allRows.map((r, idx) => {
  const id = r.id.replace(/'/g, "''");
  const grade = r.grade.replace(/'/g, "''");
  const subject = r.subject.replace(/'/g, "''");
  const unit = r.unit_name.replace(/'/g, "''");
  const lesson = r.lesson_name.replace(/'/g, "''");
  const order = idx + 1;
  const itemType = r.item_type;
  return `  ('${id}', '${grade}', '${subject}', '${unit}', '${lesson}', ${order}, '${itemType}')`;
});

sql += valueRows.join(',\n');
sql += `
ON CONFLICT (id) DO UPDATE SET
  grade = EXCLUDED.grade,
  subject = EXCLUDED.subject,
  unit_name = EXCLUDED.unit_name,
  lesson_name = EXCLUDED.lesson_name,
  sort_order = EXCLUDED.sort_order,
  item_type = EXCLUDED.item_type;

-- スキーマキャッシュ更新
NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync('scripts/import_official_csv_curriculum.sql', sql, 'utf8');
console.log('Saved scripts/import_official_csv_curriculum.sql successfully!');
