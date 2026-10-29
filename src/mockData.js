import { generateBlockchainHash } from './utils';

// ─── Sections & Years ───
export const initialSections = [
  { id: 's1', name: 'Section A', year: '4' },
  { id: 's2', name: 'Section B', year: '4' },
  { id: 's3', name: 'Section C', year: '3' },
];

// ─── Subjects ───
export const initialSubjects = [
  { id: 'sub1', name: 'Blockchain Technology & Cryptography', code: 'CS801' },
  { id: 'sub2', name: 'Distributed Cloud Architecture', code: 'CS802' },
  { id: 'sub3', name: 'Machine Learning & Neural Nets', code: 'CS803' },
];

// ─── Teachers (with assigned subjects & sections) ───
export const initialTeachers = [
  {
    id: 't1791443072425',
    name: 'kishan',
    email: 'teach1@gmail.com',
    department: 'CSE',
    assignedSections: ['s1'],
    assignedSubjects: ['sub1'],
    password: 'pass',
  },
  {
    id: 't1791443300120',
    name: 'teach2',
    email: 'teach2@gmail.com',
    department: 'CSE',
    assignedSections: ['s1'],
    assignedSubjects: ['sub1', 'sub3'],
    password: 'teach',
  },
  {
    id: 't1793208183670',
    name: 'teach3',
    email: 'teach3@gmail.com',
    department: 'Information Science',
    assignedSections: ['s1'],
    assignedSubjects: ['sub1'],
    password: '123',
  },
];

// ─── Students ───
export const initialStudents = [
  {
    id: 1791442978581,
    name: 'suhas',
    usn: '123',
    email: 'suhas123@gmail.com',
    sectionId: 's1',
    password: 'suhas',
    parentName: 'Mr. Rajesh Sharma (Father)',
    parentPhone: '+91 9353591776',
    faceRegistered: false,
    faceDescriptor: [],
    faceImage: '',
  },
  {
    id: 1793208906196,
    name: 'ullas',
    usn: '001',
    email: 'stu1@gmail.com',
    sectionId: 's1',
    password: 'pass',
    parentName: 'Mrs. Sunitha M (Mother)',
    parentPhone: '+91 9353902221',
    faceRegistered: true,
    faceImage: '',
  },
];

// ─── Generate empty attendance record template ───
export function generateSubjectAttendance(studentId, subjectIds) {
  const result = {};
  subjectIds.forEach((subId) => {
    result[subId] = {
      records: [
        {
          date: new Date().toISOString().split('T')[0],
          time: '09:00:00',
          status: 'Present',
          txHash: '0x' + Math.random().toString(16).substring(2, 18) + '...',
          verified: true,
          reason: '',
        }
      ],
      totalClasses: 1,
      presentCount: 1,
      absentCount: 0,
      percentage: 100,
    };
  });
  return result;
}

// ─── System stats ───
export const systemStats = {
  totalSessions: 1,
  totalUsers: 6,
  totalTransactions: 12,
  activeToday: 2,
  networkHealth: 100.0,
};
