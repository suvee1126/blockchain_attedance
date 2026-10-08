import { generateBlockchainHash } from './utils';

// ─── Sections & Years ───
export const initialSections = [];

// ─── Subjects ───
export const initialSubjects = [];

// ─── Teachers (with assigned subjects & sections) ───
export const initialTeachers = [];

// ─── Students ───
export const initialStudents = [];

// ─── Generate empty attendance record template ───
export function generateSubjectAttendance(studentId, subjectIds) {
  const result = {};
  subjectIds.forEach((subId) => {
    result[subId] = {
      records: [],
      totalClasses: 0,
      presentCount: 0,
      absentCount: 0,
      percentage: 0,
    };
  });
  return result;
}

// ─── System stats (Reset to zero) ───
export const systemStats = {
  totalSessions: 0,
  totalUsers: 0,
  totalTransactions: 0,
  activeToday: 0,
  networkHealth: 100.0,
};
