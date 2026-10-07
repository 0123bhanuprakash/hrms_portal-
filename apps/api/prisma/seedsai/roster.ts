/* SeedsAI Technologies — who works here, how the org hangs together. */

export const COMPANY = {
  name: 'SeedsAI Technologies Pvt. Ltd.',
  displayName: 'SeedsAI',
  slug: 'seedsai',
  email: 'hello.seedsai@yopmail.com',
  prefix: 'SAI',
  tagline: 'Growing intelligent software',
  primary: '#15803D',
  secondary: '#ECFDF5',
};

/** Everybody's address: first.last.seedsai@yopmail.com (inbox readable at yopmail.com) */
export const mailOf = (first: string, last: string) =>
  `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '.seedsai@yopmail.com';

export const LOCATIONS = [
  { code: 'HYD', name: 'Hyderabad HQ', address: 'Level 9, Sattva Knowledge City, Raidurg, HITEC City', city: 'Hyderabad', state: 'Telangana', pincode: '500081', isDefault: true },
  { code: 'BLR', name: 'Bengaluru Office', address: '4th Floor, Prestige Tech Park, Marathahalli–Sarjapur Outer Ring Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560103', isDefault: false },
  { code: 'PUN', name: 'Pune Office', address: 'Tower B, Panchshil Business Park, Balewadi High Street', city: 'Pune', state: 'Maharashtra', pincode: '411045', isDefault: false },
] as const;

export const DEPARTMENTS = [
  { code: 'EXEC', name: 'Leadership', parent: null },
  { code: 'HR', name: 'Human Resources', parent: 'EXEC' },
  { code: 'DEL', name: 'Delivery', parent: 'EXEC' },
  { code: 'PMO', name: 'Project Management Office', parent: 'EXEC' },
  { code: 'IT', name: 'IT', parent: 'EXEC' },
  { code: 'DEVOPS', name: 'DevOps', parent: 'EXEC' },
  { code: 'FIN', name: 'Finance', parent: 'EXEC' },
  { code: 'UX', name: 'UI/UX Design', parent: 'EXEC' },
  { code: 'SEC', name: 'Cyber Security', parent: 'EXEC' },
] as const;

/** Higher rank = more senior */
export const LEVELS = [
  { name: 'Executive', rank: 100, color: '#7C3AED' },
  { name: 'Director', rank: 90, color: '#2563EB' },
  { name: 'Head of Department', rank: 85, color: '#0284C7' },
  { name: 'Senior Manager', rank: 75, color: '#0891B2' },
  { name: 'Manager', rank: 70, color: '#0D9488' },
  { name: 'Lead', rank: 60, color: '#059669' },
  { name: 'Senior', rank: 50, color: '#65A30D' },
  { name: 'Professional', rank: 40, color: '#CA8A04' },
  { name: 'Associate', rank: 30, color: '#EA580C' },
  { name: 'Intern', rank: 10, color: '#64748B' },
] as const;
export type Level = (typeof LEVELS)[number]['name'];

export const TITLES: Record<string, Level> = {
  'Chief Executive Officer': 'Executive',
  'Chief Operating Officer': 'Executive',
  'Company Administrator': 'Manager',
  'Delivery Director': 'Director',
  'HR Manager': 'Head of Department',
  'IT Head': 'Head of Department',
  'DevOps Head': 'Head of Department',
  'Finance Head': 'Head of Department',
  'Head of PMO': 'Head of Department',
  'UI/UX Head': 'Head of Department',
  'Cyber Security Head': 'Head of Department',
  'Senior Project Manager': 'Senior Manager',
  'Project Manager': 'Manager',
  'Tech Lead': 'Lead',
  'QA Lead': 'Lead',
  'UI/UX Lead': 'Lead',
  'Security Lead': 'Lead',
  'Senior Software Engineer': 'Senior',
  'Software Engineer': 'Professional',
  'Associate Software Engineer': 'Associate',
  'Software Engineer Intern': 'Intern',
  'Senior QA Engineer': 'Senior',
  'QA Engineer': 'Professional',
  'QA Intern': 'Intern',
  'Business Analyst': 'Professional',
  'Senior Data Engineer': 'Senior',
  'Data Engineer': 'Professional',
  'Senior ML Engineer': 'Senior',
  'ML Engineer': 'Professional',
  'HR Business Partner': 'Senior',
  'Talent Acquisition Specialist': 'Professional',
  'Payroll & Compliance Executive': 'Professional',
  'HR Executive': 'Associate',
  'HR Intern': 'Intern',
  'IT Administrator': 'Senior',
  'IT Support Engineer': 'Associate',
  'IT Intern': 'Intern',
  'Senior DevOps Engineer': 'Senior',
  'DevOps Engineer': 'Professional',
  'DevOps Intern': 'Intern',
  'Senior Accountant': 'Senior',
  Accountant: 'Professional',
  'Financial Analyst': 'Professional',
  'Accounts Executive': 'Associate',
  'Finance Intern': 'Intern',
  'Senior Product Designer': 'Senior',
  'Product Designer': 'Professional',
  'UX Researcher': 'Professional',
  'UI Designer': 'Associate',
  'UI/UX Intern': 'Intern',
  'GRC Specialist': 'Senior',
  'Senior Security Analyst': 'Senior',
  'Security Analyst': 'Professional',
  'Security Intern': 'Intern',
  'PMO Analyst': 'Professional',
};

export type Loc = 'HYD' | 'BLR' | 'PUN';
export type EmpType = 'FT' | 'IN' | 'CT';
export interface Person {
  key: string;
  first: string;
  last: string;
  g: 'M' | 'F';
  dept: string;
  title: string;
  /** Reporting manager's key; null = top of the tree (CEO) or the PMO pool */
  mgr: string | null;
  roles: string[];
  loc: Loc;
  type: EmpType;
  join: string;
  /** Reports to the PMO instead of a person */
  pool?: boolean;
  /** Resigned: notice given on, last day, (left = last day is past) */
  exit?: { notice: string; last: string; reason: 'resigned' | 'let_go' | 'contract_end' };
  /** On maternity leave right now */
  onLeave?: boolean;
  skills?: string[];
  shift?: 'US' | 'NIGHT';
}

const P = (key: string, first: string, last: string, g: 'M' | 'F', dept: string, title: string, mgr: string | null, roles: string[], loc: Loc, type: EmpType, join: string, extra: Partial<Person> = {}): Person =>
  ({ key, first, last, g, dept, title, mgr, roles, loc, type, join, ...extra });

const FE = ['React', 'TypeScript', 'Next.js', 'CSS', 'Jest'];
const BE_JAVA = ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Microservices'];
const BE_NODE = ['Node.js', 'NestJS', 'TypeScript', 'PostgreSQL', 'Redis'];
const PY = ['Python', 'FastAPI', 'PostgreSQL', 'Celery', 'Docker'];
const MOBILE = ['Kotlin', 'Android', 'Swift', 'iOS', 'Flutter'];
const DATA = ['Python', 'Apache Spark', 'Airflow', 'dbt', 'Snowflake', 'SQL'];
const ML = ['Python', 'PyTorch', 'LLMs', 'LangChain', 'Vector databases', 'MLOps'];
const QA = ['Selenium', 'Playwright', 'API testing', 'Postman', 'JMeter', 'Test planning'];
const DESIGN = ['Figma', 'Design systems', 'Prototyping', 'User research', 'Accessibility'];
const OPS = ['AWS', 'Kubernetes', 'Terraform', 'GitHub Actions', 'Prometheus', 'Linux'];
const SECURITY = ['VAPT', 'Burp Suite', 'SIEM', 'ISO 27001', 'OWASP', 'Incident response'];
const s = (base: string[], ...more: string[]) => [...base.slice(0, 4), ...more];

export const PEOPLE: Person[] = [
  // ── Leadership ───────────────────────────────────────────
  P('ceo', 'Aditya', 'Varma', 'M', 'EXEC', 'Chief Executive Officer', null, ['company_admin'], 'HYD', 'FT', '2016-04-01', { skills: ['Strategy', 'Enterprise sales', 'AI products'] }),
  P('coo', 'Meera', 'Krishnan', 'F', 'EXEC', 'Chief Operating Officer', 'ceo', ['company_admin'], 'HYD', 'FT', '2017-06-12', { skills: ['Operations', 'Delivery governance', 'P&L'] }),
  P('admin', 'Rohan', 'Kapoor', 'M', 'EXEC', 'Company Administrator', 'coo', ['company_admin'], 'HYD', 'FT', '2019-01-07', { skills: ['HRMS administration', 'Vendor management'] }),

  // ── HR — everyone reports straight to the HR Manager (no leads) ──
  P('hrm', 'Kavitha', 'Reddy', 'F', 'HR', 'HR Manager', 'ceo', ['hr', 'manager'], 'HYD', 'FT', '2018-09-03', { skills: ['HR strategy', 'Employee relations', 'POSH'] }),
  P('hr1', 'Shruti', 'Bhat', 'F', 'HR', 'HR Business Partner', 'hrm', ['hr'], 'HYD', 'FT', '2021-07-12', { skills: ['Performance management', 'Engagement'] }),
  P('hr2', 'Gautam', 'Sethi', 'M', 'HR', 'HR Business Partner', 'hrm', ['hr'], 'BLR', 'FT', '2022-02-14', { skills: ['Employee relations', 'Compensation'] }),
  P('hr3', 'Ananya', 'Ghosh', 'F', 'HR', 'Talent Acquisition Specialist', 'hrm', ['recruiter'], 'HYD', 'FT', '2023-05-08', { skills: ['Tech hiring', 'Naukri', 'LinkedIn Recruiter'] }),
  P('hr4', 'Harish', 'Gowda', 'M', 'HR', 'Talent Acquisition Specialist', 'hrm', ['recruiter'], 'BLR', 'FT', '2024-08-19', { skills: ['Campus hiring', 'Sourcing'] }),
  P('hr5', 'Swathi', 'Naidu', 'F', 'HR', 'Payroll & Compliance Executive', 'hrm', ['hr', 'payroll_officer'], 'HYD', 'FT', '2020-11-02', { skills: ['Payroll', 'PF & ESI', 'Labour law'] }),
  P('hr6', 'Nisha', 'Pandey', 'F', 'HR', 'HR Executive', 'hrm', ['employee'], 'PUN', 'FT', '2025-12-01', { skills: ['Onboarding', 'HR operations'] }),
  P('hr7', 'Trisha', 'DSouza', 'F', 'HR', 'HR Intern', 'hrm', ['intern'], 'HYD', 'IN', '2026-06-15'),
  P('hr8', 'Kabir', 'Sandhu', 'M', 'HR', 'HR Intern', 'hrm', ['intern'], 'HYD', 'IN', '2026-07-01'),

  // ── Delivery: Directors → PMs → Leads → Engineers ─────────
  P('dd1', 'Sanjay', 'Malhotra', 'M', 'DEL', 'Delivery Director', 'ceo', ['manager'], 'HYD', 'FT', '2017-01-16', { skills: ['Retail', 'BFSI', 'Account management'] }),
  P('dd2', 'Anjali', 'Deshpande', 'F', 'DEL', 'Delivery Director', 'ceo', ['manager'], 'PUN', 'FT', '2018-02-05', { skills: ['Healthcare', 'Insurance', 'Agile at scale'] }),
  P('dd3', 'Farhan', 'Qureshi', 'M', 'DEL', 'Delivery Director', 'ceo', ['manager'], 'BLR', 'FT', '2019-10-14', { skills: ['Data platforms', 'AI products', 'EdTech'] }),

  P('pm1', 'Rahul', 'Bhatia', 'M', 'DEL', 'Senior Project Manager', 'dd1', ['manager'], 'HYD', 'FT', '2019-04-01', { skills: ['Scrum', 'Jira', 'Stakeholder management'] }),
  P('pm2', 'Sneha', 'Kulkarni', 'F', 'DEL', 'Project Manager', 'dd1', ['manager'], 'HYD', 'FT', '2021-01-11', { skills: ['Scrum', 'Banking domain', 'Risk management'] }),
  P('pm3', 'Vivek', 'Nair', 'M', 'DEL', 'Senior Project Manager', 'dd2', ['manager'], 'PUN', 'FT', '2018-11-19', { skills: ['PRINCE2', 'Healthcare', 'Release planning'] }),
  P('pm4', 'Pooja', 'Agarwal', 'F', 'DEL', 'Project Manager', 'dd2', ['manager'], 'PUN', 'FT', '2022-03-07', { skills: ['Insurance domain', 'Kanban'] }),
  P('pm5', 'Arvind', 'Swamy', 'M', 'DEL', 'Project Manager', 'dd3', ['manager'], 'BLR', 'FT', '2020-06-22', { skills: ['Data products', 'OKRs'] }),
  P('pm6', 'Divya', 'Menon', 'F', 'DEL', 'Project Manager', 'dd3', ['manager'], 'BLR', 'FT', '2021-09-13', { skills: ['EdTech', 'Client onboarding'] }),

  // Helix — Northstar Retail (PM Rahul)
  P('l1', 'Varun', 'Rao', 'M', 'DEL', 'Tech Lead', 'pm1', ['team_lead'], 'HYD', 'FT', '2019-07-15', { skills: s(BE_JAVA, 'System design') }),
  P('l2', 'Priya', 'Sharma', 'F', 'DEL', 'Tech Lead', 'pm1', ['team_lead'], 'HYD', 'FT', '2020-03-02', { skills: s(FE, 'Micro-frontends') }),
  P('l3', 'Naveen', 'Goud', 'M', 'DEL', 'QA Lead', 'pm1', ['team_lead'], 'HYD', 'FT', '2021-04-12', { skills: s(QA, 'Test strategy') }),
  P('e01', 'Amit', 'Verma', 'M', 'DEL', 'Senior Software Engineer', 'l1', ['employee'], 'HYD', 'FT', '2020-09-14', { skills: s(BE_JAVA) }),
  P('e02', 'Sowmya', 'Raju', 'F', 'DEL', 'Software Engineer', 'l1', ['employee'], 'HYD', 'FT', '2022-07-04', { skills: s(BE_JAVA) }),
  P('e03', 'Pranav', 'Shetty', 'M', 'DEL', 'Software Engineer', 'l1', ['employee'], 'HYD', 'FT', '2023-01-16', { skills: s(BE_NODE) }),
  P('e04', 'Zubair', 'Ansari', 'M', 'DEL', 'Associate Software Engineer', 'l1', ['employee'], 'HYD', 'FT', '2024-07-22', { skills: ['Java', 'SQL'] }),
  P('e05', 'Kriti', 'Saxena', 'F', 'DEL', 'Software Engineer Intern', 'l1', ['intern'], 'HYD', 'IN', '2026-05-18', { skills: ['Java', 'Git'] }),
  P('e06', 'Rakesh', 'Yadav', 'M', 'DEL', 'Senior Software Engineer', 'l2', ['employee'], 'HYD', 'FT', '2019-11-04', { skills: s(FE), exit: { notice: '2025-12-29', last: '2026-02-27', reason: 'resigned' } }),
  P('e07', 'Harini', 'Venkatesh', 'F', 'DEL', 'Software Engineer', 'l2', ['employee'], 'HYD', 'FT', '2022-10-10', { skills: s(FE), shift: 'US' }),
  P('e08', 'Mohit', 'Chauhan', 'M', 'DEL', 'Software Engineer', 'l2', ['employee'], 'HYD', 'FT', '2023-06-05', { skills: s(FE), shift: 'US' }),
  P('e09', 'Ishita', 'Mathur', 'F', 'DEL', 'Associate Software Engineer', 'l2', ['employee'], 'HYD', 'FT', '2025-10-13', { skills: ['React', 'JavaScript'] }),
  P('e10', 'Tanmay', 'Kohli', 'M', 'DEL', 'Business Analyst', 'l2', ['employee'], 'HYD', 'FT', '2022-04-18', { skills: ['Requirements', 'Retail analytics', 'SQL', 'Power BI'] }),
  P('e11', 'Bhavana', 'Kamath', 'F', 'DEL', 'Senior QA Engineer', 'l3', ['employee'], 'HYD', 'FT', '2021-09-06', { skills: s(QA) }),
  P('e12', 'Sahil', 'Bedi', 'M', 'DEL', 'QA Engineer', 'l3', ['employee'], 'HYD', 'CT', '2024-02-12', { skills: s(QA) }),
  P('e13', 'Keerthi', 'Gopalan', 'F', 'DEL', 'QA Engineer', 'l3', ['employee'], 'HYD', 'FT', '2025-11-03', { skills: ['Playwright', 'API testing'] }),

  // Orbit — Kaveri Bank (PM Sneha)
  P('l4', 'Siddharth', 'Joshi', 'M', 'DEL', 'Tech Lead', 'pm2', ['team_lead'], 'HYD', 'FT', '2020-08-17', { skills: s(MOBILE, 'Mobile architecture') }),
  P('l5', 'Aishwarya', 'Iyer', 'F', 'DEL', 'Tech Lead', 'pm2', ['team_lead'], 'HYD', 'FT', '2021-02-01', { skills: s(BE_NODE, 'Payments') }),
  P('e14', 'Vishal', 'Thakur', 'M', 'DEL', 'Senior Software Engineer', 'l4', ['employee'], 'HYD', 'FT', '2020-12-07', { skills: s(MOBILE), exit: { notice: '2026-09-15', last: '2026-11-13', reason: 'resigned' } }),
  P('e15', 'Ramya', 'Murthy', 'F', 'DEL', 'Software Engineer', 'l4', ['employee'], 'HYD', 'FT', '2022-08-22', { skills: s(MOBILE) }),
  P('e16', 'Nitin', 'Rawat', 'M', 'DEL', 'Software Engineer', 'l4', ['employee'], 'HYD', 'FT', '2023-09-11', { skills: ['Flutter', 'Dart', 'Firebase'] }),
  P('e17', 'Diya', 'Kurian', 'F', 'DEL', 'Associate Software Engineer', 'l4', ['employee'], 'HYD', 'FT', '2026-01-12', { skills: ['Kotlin', 'Android'] }),
  P('e18', 'Joseph', 'Thomas', 'M', 'DEL', 'Senior Software Engineer', 'l4', ['employee'], 'HYD', 'FT', '2021-03-15', { skills: s(MOBILE) }),
  P('e19', 'Sachin', 'Pawar', 'M', 'DEL', 'Software Engineer', 'l5', ['employee'], 'HYD', 'FT', '2023-02-20', { skills: s(BE_NODE) }),
  P('e20', 'Lavanya', 'Natarajan', 'F', 'DEL', 'Software Engineer', 'l5', ['employee'], 'HYD', 'FT', '2024-01-08', { skills: s(BE_NODE) }),
  P('e21', 'Irfan', 'Siddiqui', 'M', 'DEL', 'Associate Software Engineer', 'l5', ['employee'], 'HYD', 'FT', '2025-08-04', { skills: ['Node.js', 'MongoDB'] }),
  P('e22', 'Anusha', 'Prasad', 'F', 'DEL', 'QA Engineer', 'l5', ['employee'], 'HYD', 'FT', '2022-11-21', { skills: s(QA, 'Appium') }),

  // Pulse — MediCore Health (PM Vivek, also Atlas)
  P('l6', 'Kunal', 'Mehta', 'M', 'DEL', 'Tech Lead', 'pm3', ['team_lead'], 'PUN', 'FT', '2019-12-09', { skills: s(PY, 'HL7 FHIR') }),
  P('l7', 'Pallavi', 'Patil', 'F', 'DEL', 'QA Lead', 'pm3', ['team_lead'], 'PUN', 'FT', '2021-06-21', { skills: s(QA) }),
  P('e23', 'Omkar', 'Gaikwad', 'M', 'DEL', 'Senior Software Engineer', 'l6', ['employee'], 'PUN', 'FT', '2020-04-13', { skills: s(PY) }),
  P('e24', 'Sakshi', 'Kale', 'F', 'DEL', 'Software Engineer', 'l6', ['employee'], 'PUN', 'FT', '2022-05-30', { skills: s(FE) }),
  P('e25', 'Yash', 'Desai', 'M', 'DEL', 'Software Engineer', 'l6', ['employee'], 'PUN', 'FT', '2023-07-17', { skills: s(PY) }),
  P('e26', 'Esha', 'Pereira', 'F', 'DEL', 'Software Engineer', 'l6', ['employee'], 'PUN', 'FT', '2024-03-04', { skills: s(FE), onLeave: true }),
  P('e27', 'Parth', 'Trivedi', 'M', 'DEL', 'Associate Software Engineer', 'l6', ['employee'], 'PUN', 'FT', '2026-02-02', { skills: ['Python', 'Django'] }),
  P('e28', 'Gayatri', 'Mahajan', 'F', 'DEL', 'Senior QA Engineer', 'l7', ['employee'], 'PUN', 'FT', '2021-01-25', { skills: s(QA) }),
  P('e29', 'Hemant', 'Pandya', 'M', 'DEL', 'QA Engineer', 'l7', ['employee'], 'PUN', 'FT', '2023-10-09', { skills: s(QA) }),
  P('e30', 'Aniket', 'More', 'M', 'DEL', 'QA Intern', 'l7', ['intern'], 'PUN', 'IN', '2026-06-01', { skills: ['Manual testing', 'Postman'] }),
  P('e31', 'Mitali', 'Banerjee', 'F', 'DEL', 'Business Analyst', 'l7', ['employee'], 'PUN', 'FT', '2022-09-05', { skills: ['Healthcare domain', 'User stories', 'BPMN'] }),

  // Ledger — Trident Insurance (PM Pooja); Madhuri, Chetan, Dinesh came over from Atlas in July
  P('l8', 'Tejas', 'Jadhav', 'M', 'DEL', 'Tech Lead', 'pm4', ['team_lead'], 'PUN', 'FT', '2020-10-05', { skills: s(BE_JAVA, 'Camunda') }),
  P('l9', 'Madhuri', 'Shinde', 'F', 'DEL', 'Tech Lead', 'pm4', ['team_lead'], 'PUN', 'FT', '2022-01-17', { skills: s(BE_NODE, 'Event-driven design') }),
  P('e32', 'Rishabh', 'Khanna', 'M', 'DEL', 'Senior Software Engineer', 'l8', ['employee'], 'PUN', 'FT', '2021-05-10', { skills: s(BE_JAVA) }),
  P('e33', 'Shalini', 'Mishra', 'F', 'DEL', 'Software Engineer', 'l8', ['employee'], 'PUN', 'FT', '2023-03-27', { skills: s(BE_JAVA) }),
  P('e34', 'Chetan', 'Bhatt', 'M', 'DEL', 'Software Engineer', 'l9', ['employee'], 'PUN', 'FT', '2024-06-17', { skills: s(BE_NODE) }),
  P('e35', 'Vaishnavi', 'Deshmukh', 'F', 'DEL', 'Associate Software Engineer', 'l8', ['employee'], 'PUN', 'FT', '2025-07-21', { skills: ['Java', 'Spring Boot'] }),
  P('e36', 'Dinesh', 'Waghmare', 'M', 'DEL', 'Software Engineer', 'l9', ['employee'], 'PUN', 'FT', '2022-12-12', { skills: s(BE_NODE) }),
  P('e37', 'Juhi', 'Sinha', 'F', 'DEL', 'QA Engineer', 'l9', ['employee'], 'PUN', 'FT', '2023-08-14', { skills: s(QA) }),
  P('e38', 'Lokesh', 'Bisht', 'M', 'DEL', 'Software Engineer', 'l8', ['employee'], 'PUN', 'CT', '2025-10-20', { skills: s(PY) }),

  // Nimbus — internal data platform (PM Arvind, also Sprout)
  P('l10', 'Ashwin', 'Ramanathan', 'M', 'DEL', 'Tech Lead', 'pm5', ['team_lead'], 'BLR', 'FT', '2019-05-20', { skills: s(DATA, 'Data architecture') }),
  P('l11', 'Deepika', 'Hegde', 'F', 'DEL', 'Tech Lead', 'pm5', ['team_lead'], 'BLR', 'FT', '2021-08-02', { skills: s(BE_NODE, 'Go') }),
  P('e39', 'Srinivas', 'Iyengar', 'M', 'DEL', 'Senior Data Engineer', 'l10', ['employee'], 'BLR', 'FT', '2020-07-06', { skills: s(DATA) }),
  P('e40', 'Charu', 'Mahapatra', 'F', 'DEL', 'Data Engineer', 'l10', ['employee'], 'BLR', 'FT', '2022-06-13', { skills: s(DATA) }),
  P('e41', 'Gaurav', 'Dhillon', 'M', 'DEL', 'Data Engineer', 'l10', ['employee'], 'BLR', 'FT', '2023-11-20', { skills: s(DATA) }),
  P('e42', 'Venkat', 'Subbarao', 'M', 'DEL', 'Senior Software Engineer', 'l11', ['employee'], 'BLR', 'FT', '2021-10-18', { skills: ['Go', 'gRPC', 'PostgreSQL', 'Kubernetes'] }),
  P('e43', 'Tanvi', 'Shah', 'F', 'DEL', 'Software Engineer', 'l11', ['employee'], 'BLR', 'FT', '2024-09-02', { skills: s(FE) }),
  P('e44', 'Darshan', 'Pai', 'M', 'DEL', 'Software Engineer Intern', 'l10', ['intern'], 'BLR', 'IN', '2026-06-08', { skills: ['Python', 'SQL'] }),

  // Sprout — internal AI assistant (PM Arvind)
  P('l12', 'Abhishek', 'Chakraborty', 'M', 'DEL', 'Tech Lead', 'pm5', ['team_lead'], 'BLR', 'FT', '2020-02-24', { skills: s(ML, 'Model evaluation') }),
  P('e45', 'Raghav', 'Sen', 'M', 'DEL', 'Senior ML Engineer', 'l12', ['employee'], 'BLR', 'FT', '2021-02-15', { skills: s(ML) }),
  P('e46', 'Kavya', 'Rao', 'F', 'DEL', 'ML Engineer', 'l12', ['employee'], 'BLR', 'FT', '2023-04-03', { skills: s(ML) }),
  P('e47', 'Nihal', 'George', 'M', 'DEL', 'ML Engineer', 'l12', ['employee'], 'BLR', 'FT', '2024-10-14', { skills: s(ML) }),
  P('e48', 'Pragya', 'Tiwari', 'F', 'DEL', 'Software Engineer', 'l12', ['employee'], 'BLR', 'FT', '2025-09-08', { skills: s(FE) }),
  P('e49', 'Reyansh', 'Gill', 'M', 'DEL', 'Software Engineer Intern', 'l12', ['intern'], 'BLR', 'IN', '2026-07-13', { skills: ['Python', 'Prompt engineering'] }),

  // Vertex — BrightPath Learning (PM Divya, also Quill); on hold since August
  P('l13', 'Revathi', 'Sundaram', 'F', 'DEL', 'Tech Lead', 'pm6', ['team_lead'], 'BLR', 'FT', '2021-11-08', { skills: s(BE_NODE, 'LMS integrations') }),
  P('e50', 'Ajay', 'Chopra', 'M', 'DEL', 'Software Engineer', 'l13', ['employee'], 'BLR', 'FT', '2022-01-24', { skills: ['Go', 'Node.js', 'PostgreSQL', 'AWS'] }),
  P('e51', 'Uday', 'Bhaskar', 'M', 'DEL', 'QA Engineer', 'l13', ['employee'], 'BLR', 'FT', '2022-03-21', { skills: s(QA) }),
  P('e52', 'Yamini', 'Reddy', 'F', 'DEL', 'Associate Software Engineer', 'l13', ['employee'], 'BLR', 'FT', '2025-10-27', { skills: ['React', 'Node.js'] }),

  // ── PMO and its pool (people between projects report to the PMO) ──
  P('pmo', 'Lakshmi', 'Iyer', 'F', 'PMO', 'Head of PMO', 'ceo', ['pmo', 'pmo_lead', 'manager'], 'HYD', 'FT', '2018-04-16', { skills: ['Resource planning', 'Portfolio management', 'PMP'] }),
  P('pmo1', 'Jatin', 'Arora', 'M', 'PMO', 'PMO Analyst', 'pmo', ['pmo'], 'HYD', 'FT', '2022-08-01', { skills: ['Capacity planning', 'Excel', 'Power BI'] }),
  P('pmo2', 'Radhika', 'Chopra', 'F', 'PMO', 'PMO Analyst', 'pmo', ['pmo'], 'HYD', 'FT', '2023-12-04', { skills: ['Resource allocation', 'Jira'] }),
  P('b1', 'Sudhir', 'Rajan', 'M', 'DEL', 'Senior Software Engineer', null, ['employee'], 'PUN', 'FT', '2019-08-26', { pool: true, skills: s(PY, 'AWS') }),
  P('b2', 'Monika', 'Dubey', 'F', 'DEL', 'Software Engineer', null, ['employee'], 'BLR', 'FT', '2023-05-15', { pool: true, skills: s(FE) }),
  P('b3', 'Arnav', 'Bajaj', 'M', 'DEL', 'Associate Software Engineer', null, ['employee'], 'HYD', 'FT', '2026-09-21', { pool: true, skills: ['Java', 'Spring Boot', 'SQL'] }),
  P('b4', 'Riya', 'Grewal', 'F', 'DEL', 'Associate Software Engineer', null, ['employee'], 'HYD', 'FT', '2026-09-21', { pool: true, skills: ['React', 'TypeScript'] }),
  P('b5', 'Vedant', 'Mishra', 'M', 'DEL', 'QA Engineer', null, ['employee'], 'PUN', 'FT', '2026-08-24', { pool: true, skills: s(QA) }),

  // ── IT ───────────────────────────────────────────────────
  P('ith', 'Manoj', 'Pillai', 'M', 'IT', 'IT Head', 'ceo', ['it_admin', 'manager'], 'HYD', 'FT', '2017-11-06', { skills: ['IT strategy', 'Microsoft 365', 'Networking'] }),
  P('it1', 'Prakash', 'Rodrigues', 'M', 'IT', 'IT Administrator', 'ith', ['it_admin'], 'HYD', 'FT', '2019-09-16', { skills: ['Active Directory', 'Intune', 'Fortinet'] }),
  P('it2', 'Sana', 'Khan', 'F', 'IT', 'IT Administrator', 'ith', ['it_admin'], 'BLR', 'FT', '2021-12-06', { skills: ['Google Workspace', 'Jamf', 'Networking'] }),
  P('it3', 'Ramesh', 'Kumar', 'M', 'IT', 'IT Support Engineer', 'ith', ['it_admin'], 'HYD', 'FT', '2022-05-23', { skills: ['Hardware', 'Windows', 'Ticketing'] }),
  P('it4', 'Lalit', 'Negi', 'M', 'IT', 'IT Support Engineer', 'ith', ['it_admin'], 'PUN', 'FT', '2023-08-07', { skills: ['macOS', 'Printers', 'Wi-Fi'] }),
  P('it5', 'Jyothi', 'Vemula', 'F', 'IT', 'IT Support Engineer', 'ith', ['it_admin'], 'HYD', 'FT', '2024-11-18', { skills: ['Windows', 'Asset tracking'] }),
  P('it6', 'Ehsan', 'Mirza', 'M', 'IT', 'IT Intern', 'ith', ['intern'], 'HYD', 'IN', '2026-06-22'),
  P('it7', 'Preeti', 'Rathore', 'F', 'IT', 'IT Intern', 'ith', ['intern'], 'HYD', 'IN', '2026-07-06'),

  // ── DevOps ───────────────────────────────────────────────
  P('dvh', 'Karthik', 'Subramanian', 'M', 'DEVOPS', 'DevOps Head', 'ceo', ['devops', 'manager'], 'BLR', 'FT', '2018-07-23', { skills: s(OPS, 'SRE') }),
  P('dv1', 'Girish', 'Shenoy', 'M', 'DEVOPS', 'Senior DevOps Engineer', 'dvh', ['devops'], 'BLR', 'FT', '2020-01-13', { skills: s(OPS) }),
  P('dv2', 'Nikita', 'Chawla', 'F', 'DEVOPS', 'DevOps Engineer', 'dvh', ['devops'], 'BLR', 'FT', '2022-09-26', { skills: s(OPS) }),
  P('dv3', 'Pavan', 'Tummala', 'M', 'DEVOPS', 'DevOps Engineer', 'dvh', ['devops'], 'HYD', 'FT', '2023-03-13', { skills: s(OPS), shift: 'NIGHT' }),
  P('dv4', 'Akash', 'Tripathi', 'M', 'DEVOPS', 'DevOps Engineer', 'dvh', ['devops'], 'HYD', 'FT', '2024-04-29', { skills: ['Docker', 'Jenkins', 'Linux', 'Selenium'] }),
  P('dv5', 'Aparna', 'Nambiar', 'F', 'DEVOPS', 'DevOps Intern', 'dvh', ['intern'], 'BLR', 'IN', '2026-06-15', { skills: ['Linux', 'Docker'] }),
  P('dv6', 'Utkarsh', 'Srivastava', 'M', 'DEVOPS', 'DevOps Intern', 'dvh', ['intern'], 'BLR', 'IN', '2026-07-20', { skills: ['Bash', 'AWS basics'] }),

  // ── Finance ──────────────────────────────────────────────
  P('fih', 'Neha', 'Saxena', 'F', 'FIN', 'Finance Head', 'ceo', ['finance', 'payroll_officer', 'manager'], 'HYD', 'FT', '2018-01-22', { skills: ['Financial planning', 'Ind AS', 'Treasury'] }),
  P('fi1', 'Suresh', 'Venkataraman', 'M', 'FIN', 'Senior Accountant', 'fih', ['finance'], 'HYD', 'FT', '2019-06-10', { skills: ['Tally', 'GST', 'TDS'] }),
  P('fi2', 'Ritu', 'Goel', 'F', 'FIN', 'Accountant', 'fih', ['finance'], 'HYD', 'FT', '2022-02-28', { skills: ['Accounts payable', 'Zoho Books'] }),
  P('fi3', 'Mayank', 'Jain', 'M', 'FIN', 'Financial Analyst', 'fih', ['finance'], 'HYD', 'FT', '2023-06-19', { skills: ['FP&A', 'Excel'], exit: { notice: '2026-06-01', last: '2026-07-31', reason: 'resigned' } }),
  P('fi4', 'Shreya', 'Bansal', 'F', 'FIN', 'Accounts Executive', 'fih', ['finance'], 'PUN', 'FT', '2024-12-02', { skills: ['Reimbursements', 'Bank reconciliation'] }),
  P('fi5', 'Keshav', 'Mittal', 'M', 'FIN', 'Financial Analyst', 'fih', ['finance'], 'HYD', 'FT', '2026-08-03', { skills: ['FP&A', 'Power BI'] }),
  P('fi6', 'Tanya', 'Oberoi', 'F', 'FIN', 'Finance Intern', 'fih', ['intern'], 'HYD', 'IN', '2026-06-01'),

  // ── UI/UX ────────────────────────────────────────────────
  P('uxh', 'Ishaan', 'Chatterjee', 'M', 'UX', 'UI/UX Head', 'ceo', ['manager'], 'BLR', 'FT', '2019-03-18', { skills: s(DESIGN, 'Design leadership') }),
  P('ul1', 'Isha', 'Ahluwalia', 'F', 'UX', 'UI/UX Lead', 'uxh', ['team_lead'], 'BLR', 'FT', '2020-11-16', { skills: s(DESIGN) }),
  P('ul2', 'Kevin', 'Mathew', 'M', 'UX', 'UI/UX Lead', 'uxh', ['team_lead'], 'HYD', 'FT', '2021-05-24', { skills: s(DESIGN) }),
  P('ux1', 'Nandini', 'Krishnamurthy', 'F', 'UX', 'Senior Product Designer', 'ul1', ['employee'], 'BLR', 'FT', '2021-08-30', { skills: s(DESIGN) }),
  P('ux2', 'Harsh', 'Kothari', 'M', 'UX', 'Product Designer', 'ul1', ['employee'], 'BLR', 'FT', '2023-01-09', { skills: s(DESIGN) }),
  P('ux3', 'Zoya', 'Ahmed', 'F', 'UX', 'UI/UX Intern', 'ul1', ['intern'], 'BLR', 'IN', '2026-06-15', { skills: ['Figma'] }),
  P('ux4', 'Vinay', 'Shastri', 'M', 'UX', 'UI/UX Intern', 'ul1', ['intern'], 'BLR', 'IN', '2026-07-01', { skills: ['Figma', 'Illustration'] }),
  P('ux5', 'Varsha', 'Pillai', 'F', 'UX', 'Product Designer', 'ul2', ['employee'], 'HYD', 'FT', '2022-10-17', { skills: s(DESIGN) }),
  P('ux6', 'Tushar', 'Wagh', 'M', 'UX', 'UI Designer', 'ul2', ['employee'], 'HYD', 'FT', '2024-05-06', { skills: ['Figma', 'Visual design', 'Icons'] }),
  P('ux7', 'Urvashi', 'Rawal', 'F', 'UX', 'UX Researcher', 'ul2', ['employee'], 'HYD', 'FT', '2023-07-24', { skills: ['User interviews', 'Usability testing', 'Dovetail'] }),
  P('ux8', 'Sameer', 'Patel', 'M', 'UX', 'UI/UX Intern', 'ul2', ['intern'], 'HYD', 'IN', '2026-07-20', { skills: ['Figma'] }),

  // ── Cyber Security ───────────────────────────────────────
  P('sch', 'Rhea', 'Fernandes', 'F', 'SEC', 'Cyber Security Head', 'ceo', ['manager'], 'HYD', 'FT', '2019-02-11', { skills: s(SECURITY, 'CISSP') }),
  P('sl1', 'Vikas', 'Gupta', 'M', 'SEC', 'Security Lead', 'sch', ['team_lead'], 'HYD', 'FT', '2020-05-18', { skills: s(SECURITY) }),
  P('sl2', 'Priyanka', 'Bose', 'F', 'SEC', 'Security Lead', 'sch', ['team_lead'], 'HYD', 'FT', '2021-10-04', { skills: s(SECURITY) }),
  P('sc1', 'Faisal', 'Sheikh', 'M', 'SEC', 'Senior Security Analyst', 'sl1', ['employee'], 'HYD', 'FT', '2021-12-13', { skills: s(SECURITY) }),
  P('sc2', 'Sandeep', 'Rathod', 'M', 'SEC', 'Security Analyst', 'sl1', ['employee'], 'HYD', 'FT', '2023-04-17', { skills: s(SECURITY) }),
  P('sc3', 'Ayesha', 'Shaikh', 'F', 'SEC', 'Security Intern', 'sl1', ['intern'], 'HYD', 'IN', '2026-06-08', { skills: ['Nmap', 'Wireshark'] }),
  P('sc4', 'Bharat', 'Solanki', 'M', 'SEC', 'Security Analyst', 'sl2', ['employee'], 'HYD', 'FT', '2024-01-22', { skills: s(SECURITY) }),
  P('sc5', 'Fatima', 'Ansari', 'F', 'SEC', 'Security Intern', 'sl2', ['intern'], 'HYD', 'IN', '2026-07-01', { skills: ['OWASP', 'Python'] }),
  P('sc6', 'Hari', 'Krishnan', 'M', 'SEC', 'GRC Specialist', 'sch', ['employee'], 'HYD', 'FT', '2022-06-27', { skills: ['ISO 27001', 'SOC 2', 'Risk assessment', 'DPDP Act'] }),
];

/** Department heads */
export const HEADS: Record<string, string> = { EXEC: 'ceo', HR: 'hrm', DEL: 'coo', PMO: 'pmo', IT: 'ith', DEVOPS: 'dvh', FIN: 'fih', UX: 'uxh', SEC: 'sch' };

/**
 * Earlier reporting lines / titles / departments (employment history).
 * [person, kind, from, to, effective, actor, note]
 */
export const HISTORY: Array<[string, string, string, string, string, string, string?]> = [
  ['l5', 'title', 'Senior Software Engineer', 'Tech Lead', '2026-04-01', 'hrm', 'Promoted in the April 2026 appraisal cycle'],
  ['e01', 'title', 'Software Engineer', 'Senior Software Engineer', '2026-04-01', 'hrm', 'Promoted in the April 2026 appraisal cycle'],
  ['e28', 'title', 'QA Engineer', 'Senior QA Engineer', '2026-04-01', 'hrm', 'Promoted in the April 2026 appraisal cycle'],
  ['ux1', 'title', 'Product Designer', 'Senior Product Designer', '2026-04-01', 'hrm', 'Promoted in the April 2026 appraisal cycle'],
  ['l5', 'manager', 'Siddharth Joshi', 'Sneha Kulkarni', '2026-04-01', 'pm2', 'Now leads the payments squad'],
  ['e17', 'type', 'Intern', 'Full-time', '2026-07-01', 'hrm', 'Converted after a strong internship'],
  ['e17', 'title', 'Software Engineer Intern', 'Associate Software Engineer', '2026-07-01', 'hrm'],
  ['dv4', 'department', 'Delivery', 'DevOps', '2026-03-16', 'hrm', 'Internal move: QA automation → DevOps'],
  ['dv4', 'title', 'QA Engineer', 'DevOps Engineer', '2026-03-16', 'hrm'],
  ['dv4', 'manager', 'Naveen Goud', 'Karthik Subramanian', '2026-03-16', 'hrm'],
  ['l9', 'manager', 'Vivek Nair', 'Pooja Agarwal', '2026-07-01', 'dd2', 'Atlas wrapped up; moved to Ledger'],
  ['b1', 'manager', 'Madhuri Shinde', 'PMO', '2026-07-01', 'pm3', 'Released to the PMO pool after Atlas go-live'],
  ['b2', 'manager', 'Revathi Sundaram', 'PMO', '2026-08-17', 'pm6', 'Vertex on hold — released to the PMO pool'],
  ['hr2', 'location', 'Hyderabad HQ', 'Bengaluru Office', '2026-01-05', 'hrm', 'Relocated to support the Bengaluru teams'],
  ['e27', 'probation_extended', '2026-08-01', '2026-10-31', '2026-08-01', 'hrm', 'Probation extended by 3 months — focus on code quality'],
];
