export type SubjectCategory = 'lectures' | 'files' | 'exams' | 'assignments' | 'resources' | 'custom';

export interface EngHubRoute {
  page: string;
  subjectId: string;
  category: SubjectCategory | '';
  lecturerId: string;
  lectureId: string;
  contentNodeId: string;
  profileUid: string;
}

const decode = (value: string | undefined) => {
  if (!value) return '';
  try { return decodeURIComponent(value); } catch { return value; }
};
const encode = (value: string) => encodeURIComponent(value.trim());

export function readEngHubRoute(hash = window.location.hash): EngHubRoute {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
  const [first = 'home'] = parts;
  const base: EngHubRoute = {
    page: first || 'home', subjectId: '', category: '', lecturerId: '', lectureId: '', contentNodeId: '', profileUid: '',
  };
  if (first === 'students') { base.page = 'student-profile'; base.profileUid = parts[1] || ''; return base; }
  if (first !== 'courses') return base;
  base.page = 'courses';
  base.subjectId = parts[1] || '';
  if (parts[2] === 'lectures') {
    base.category = 'lectures';
    if (parts[3] === 'lecturer') base.lecturerId = parts[4] || '';
    if (parts[5] === 'lecture') base.lectureId = parts[6] || '';
  } else if (parts[2] === 'category') {
    const category = parts[3] || '';
    if (['lectures','files','exams','assignments','resources','custom'].includes(category)) {
      base.category = category as SubjectCategory;
    }
    if (parts[4] === 'node') base.contentNodeId = parts[5] || '';
  }
  return base;
}

export function buildEngHubHash(route: EngHubRoute): string {
  if (route.page === 'student-profile') return route.profileUid ? '#/students/' + encode(route.profileUid) : '#/students';
  if (route.page !== 'courses') return '#/' + encode(route.page || 'home');
  if (!route.subjectId) return '#/courses';
  const root = '#/courses/' + encode(route.subjectId);
  if (!route.category) return root;
  if (route.category === 'lectures') {
    if (route.lectureId) return root + '/lectures/lecturer/' + encode(route.lecturerId) + '/lecture/' + encode(route.lectureId);
    if (route.lecturerId) return root + '/lectures/lecturer/' + encode(route.lecturerId);
    return root + '/lectures';
  }
  const category = root + '/category/' + encode(route.category);
  return route.contentNodeId ? category + '/node/' + encode(route.contentNodeId) : category;
}
