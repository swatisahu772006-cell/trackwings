export interface Habit {
  id?: string;
  name: string;
  icon: string;
  color: string;
  userId: string;
  createdAt: any;
}

export interface Completion {
  id?: string;
  habitId: string;
  date: string; // ISO string YYYY-MM-DD
  userId: string;
  createdAt: any;
}

export interface DailyStats {
  date: string;
  completed: number;
  total: number;
}
