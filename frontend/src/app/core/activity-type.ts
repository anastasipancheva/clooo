// ActivityType на бэкенде 1-индексный: Lecture=1, ControlPoint=2 (КТ), HomeworkSession=3 (ДЗ-сессия).
// Раньше на фронте использовались 0-индексные массивы, из-за чего лекция показывалась как «практика».

export function activityTypeLabel(type: number): string {
  switch (type) {
    case 1: return 'Лекция';
    case 2: return 'КТ';
    case 3: return 'ДЗ-сессия';
    default: return 'Занятие';
  }
}

export function activityTypeIcon(type: number): string {
  switch (type) {
    case 1: return '\u{1F4D6}'; // 📖
    case 2: return '\u{1F4DD}'; // 📝
    case 3: return '\u{1F4DA}'; // 📚
    default: return '\u{1F4C5}'; // 📅
  }
}

export function activityTypeIconBg(type: number): string {
  switch (type) {
    case 1: return 'bg-[#EAF2FF]';
    case 2: return 'bg-[#FEF3C7]';
    case 3: return 'bg-[#F3E8FF]';
    default: return 'bg-[#F3F4F6]';
  }
}

export const ACTIVITY_TYPE_LECTURE = 1;
export const ACTIVITY_TYPE_CONTROLPOINT = 2;
export const ACTIVITY_TYPE_HOMEWORK = 3;
