export type AttendanceRankingRow = {
  memberId: string;
  first_name: string;
  membership_status: 'Active' | 'Inactive';
  attended: number;
  rank: number;
};

export type AttendanceRanking = {
  years: number[];
  rankings: AttendanceRankingRow[];
};
