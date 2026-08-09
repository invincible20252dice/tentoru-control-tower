import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalDatePickerProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onChangeDate: (dateStr: string) => void;
  selectedDays?: string[]; // e.g. ['tuesday', 'friday'] or ['月', '木']
}

export const HorizontalDatePicker: React.FC<HorizontalDatePickerProps> = ({
  selectedDate,
  onChangeDate,
  selectedDays,
}) => {
  // Safe date parsing helper
  const parseDate = (dStr: string) => {
    const parts = (dStr || '').split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month - 1, day);
      }
    }
    return new Date();
  };

  const currentDateObj = parseDate(selectedDate);

  // Get Monday of the week containing currentDateObj
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sunday
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(date.setDate(diff));
  };

  const mondayObj = getMonday(currentDateObj);

  // Format Date to YYYY-MM-DD
  const formatDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate 7 days (Monday to Sunday)
  const dayNames = ['月', '火', '水', '木', '金', '土', '日'];
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayObj);
    d.setDate(mondayObj.getDate() + i);
    const dateStr = formatDateStr(d);
    const dayOfWeek = dayNames[i];
    const dayKey = dayKeys[i];
    const formattedDay = String(d.getDate()).padStart(2, '0');
    const isAttendanceDay = selectedDays && selectedDays.length > 0
      ? selectedDays.includes(dayKey) || selectedDays.includes(dayOfWeek)
      : false;

    return {
      dateObj: d,
      dateStr,
      dayOfWeek,
      dayKey,
      formattedDay,
      isAttendanceDay,
    };
  });

  // Determine Year-Month Header text
  const startMonth = mondayObj.getMonth() + 1;
  const startYear = mondayObj.getFullYear();
  const sundayObj = new Date(mondayObj);
  sundayObj.setDate(mondayObj.getDate() + 6);
  const endMonth = sundayObj.getMonth() + 1;
  const endYear = sundayObj.getFullYear();

  let headerText = `${startYear}年${startMonth}月`;
  if (startYear !== endYear) {
    headerText = `${startYear}年${startMonth}月 - ${endYear}年${endMonth}月`;
  } else if (startMonth !== endMonth) {
    headerText = `${startYear}年${startMonth}月 - ${endMonth}月`;
  }

  // Navigate to previous week
  const handlePrevWeek = () => {
    const prevMonday = new Date(mondayObj);
    prevMonday.setDate(mondayObj.getDate() - 7);
    const currentDayIdx = (currentDateObj.getDay() + 6) % 7; // Monday=0
    const targetDate = new Date(prevMonday);
    targetDate.setDate(prevMonday.getDate() + currentDayIdx);
    onChangeDate(formatDateStr(targetDate));
  };

  // Navigate to next week
  const handleNextWeek = () => {
    const nextMonday = new Date(mondayObj);
    nextMonday.setDate(mondayObj.getDate() + 7);
    const currentDayIdx = (currentDateObj.getDay() + 6) % 7; // Monday=0
    const targetDate = new Date(nextMonday);
    targetDate.setDate(nextMonday.getDate() + currentDayIdx);
    onChangeDate(formatDateStr(targetDate));
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '12px 16px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Hidden Fallback Input for Accessibility and Backwards Compatibility */}
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => onChangeDate(e.target.value)}
        aria-label="日付選択"
        style={{
          position: 'absolute',
          opacity: 0,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Header: Week Navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <button
          type="button"
          onClick={handlePrevWeek}
          aria-label="前週へ"
          style={{
            background: 'none',
            border: 'none',
            color: '#0066cc',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>

        <span
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#1e293b',
            letterSpacing: '0.02em',
          }}
        >
          {headerText}
        </span>

        <button
          type="button"
          onClick={handleNextWeek}
          aria-label="次週へ"
          style={{
            background: 'none',
            border: 'none',
            color: '#0066cc',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronRight size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* 7-Days Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '8px',
        }}
      >
        {weekDays.map((item) => {
          const isActive = item.dateStr === selectedDate;

          return (
            <button
              key={item.dateStr}
              type="button"
              onClick={() => onChangeDate(item.dateStr)}
              style={{
                width: '100%',
                minHeight: '66px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                backgroundColor: isActive ? '#0066cc' : (item.isAttendanceDay ? '#f0f7ff' : '#ffffff'),
                border: isActive
                  ? '2px solid #0066cc'
                  : (item.isAttendanceDay ? '1.5px solid #93c5fd' : '1px solid #e2e8f0'),
                boxShadow: isActive
                  ? '0 4px 12px rgba(0, 102, 204, 0.35)'
                  : 'none',
                padding: '6px 0',
              }}
            >
              {item.isAttendanceDay ? (
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    borderRadius: '6px',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#dbeafe',
                    color: isActive ? '#ffffff' : '#1d4ed8',
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  通塾
                </span>
              ) : (
                selectedDays && selectedDays.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.6rem',
                      padding: '1px 4px',
                      borderRadius: '6px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : '#f8fafc',
                      color: isActive ? '#cbd5e1' : '#94a3b8',
                      fontWeight: 600,
                      lineHeight: 1.2,
                    }}
                  >
                    休塾
                  </span>
                )
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: isActive ? '#ffffff' : (item.isAttendanceDay ? '#1e40af' : '#475569'),
                }}
              >
                {item.dayOfWeek}
              </span>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: isActive ? '#ffffff' : (item.isAttendanceDay ? '#0066cc' : '#334155'),
                  lineHeight: 1.1,
                }}
              >
                {item.formattedDay}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
