// Broad occupation groups. Specific roles precede general words such as
// "engineer", "associate", "product" and "operations".
export const jobCategories = [
  "Frontend", "Backend", "Full Stack", "Mobile", "DevOps", "QA", "AI / ML", "Data",
  "Cybersecurity", "IT & Infrastructure", "Software Engineering",
  "Engineering", "Construction & Trades", "Manufacturing & Production",
  "Logistics & Supply Chain", "Retail & Hospitality", "Healthcare", "Education",
  "Finance & Accounting", "Legal & Compliance", "HR & Recruiting", "Customer Service",
  "Sales", "Marketing", "Design", "Product", "Project Management",
  "Operations & Administration", "Consulting", "Science & Research", "Other",
] as const;

type Category = (typeof jobCategories)[number];
const rules: readonly [Category, RegExp][] = [
  ["Full Stack", /full[ -]?stack|fullstack/i],
  ["Frontend", /front[ -]?end|frontend|react developer|vue developer|angular developer/i],
  ["Backend", /back[ -]?end|backend|server[ -]?side developer/i],
  ["Mobile", /\b(?:ios|android|mobile app|flutter|react native)\b/i],
  ["DevOps", /devops|site reliability|\bsre\b|platform engineer|cloud infrastructure/i],
  ["QA", /\bqa\b|quality assurance|software test(?:er|ing)?|test automation engineer/i],
  ["Cybersecurity", /cyber ?security|information security|security engineer(?:ing)?|secops|penetration test|\bciso\b/i],
  ["AI / ML", /machine learning|artificial intelligence|\bai\b|\bml\b|deep learning|computer vision/i],
  ["Data", /\bdata\b|analytics engineer|business intelligence|\bbi analyst\b/i],
  ["IT & Infrastructure", /\bit\b|information technology|service desk|help ?desk|systems? administrator|network engineer|technical support engineer|solutions? architect|technical services/i],
  ["Software Engineering", /software|programmer|programmist|web developer|application developer|entwickler|développeur|desarrollador|golang engineer|\bc\+\+\b|java engineer/i],
  ["Construction & Trades", /construction|building services|civil engineer|structural engineer|architectural|\barchitecte\b|bauingenieur|bauleiter|bautechnik|gebäude|versorgungstechnik|\btga\b|electrician|elektroniker|plumber|carpenter|schweißer|électricien|albañil/i],
  ["Manufacturing & Production", /manufactur|production|factory|plant manager|machine operator|maintenance technician|instandhaltung|fertigung|produktion|qualitätskontrolle|industrial engineer/i],
  ["Logistics & Supply Chain", /logistic|supply chain|warehouse|delivery|dispatch|driver|courier|procurement|purchasing|sourcing|transportation|inventory|lager|liefer|chauffeur/i],
  ["Retail & Hospitality", /retail|grocery|store (?:associate|manager)|shop assistant|cashier|restaurant|hotel|hospitality|kiosk|sauna|chef\b|cook\b|barista|waiter|waitress|vendeur|verkäufer|camarero/i],
  ["Healthcare", /healthcare|medical|nurs|physician|doctor|dentist|therapist|pharmac|clinical|patient|pflege|arzt|ärzt|medizini|soignant/i],
  ["Education", /teacher|teaching|tutor|lecturer|professor|educator|instructor|pädagog|lehrer|enseignant|docente/i],
  ["Finance & Accounting", /finance|financial|accounting|accountant|accounts? receivable|bookkeep|payroll|tax\b|treasury|controller|auditor|prüfung|buchhalt|steuerberater|comptable|contabilidad/i],
  ["Legal & Compliance", /legal|lawyer|attorney|counsel|compliance|privacy|datenschutz|jurist|rechtsanwalt|avocat|abogado/i],
  ["HR & Recruiting", /human resources|\bhr\b|recruit|talent acquisition|people (?:partner|operations|specialist)|personalwesen|personalreferent/i],
  ["Customer Service", /customer (?:support|success|service|care|experience)|support associate|support specialist|client service|service representative|kundenservice|kundenberater|call center|centre d.appels/i],
  ["Sales", /\bsales\b|account executive|account (?:manager|director)|business development|partner development|partnerships? manager|\bbdr\b|\bsdr\b|commercial director|vertrieb|verkauf|ventas|vendedor|vente/i],
  ["Marketing", /marketing|social media|\bseo\b|content (?:manager|creator|strategist)|growth (?:manager|marketer)|brand (?:manager|strategist|analyst)|communication manager|events? manager/i],
  ["Design", /design|\bux\b|\bui\b|creative|art director|video editor|videographer|copywriter|graphic|fotograf|photograph/i],
  ["Product", /product (?:manager|owner|lead|director|specialist)|produktmanager/i],
  ["Project Management", /project manager|program manager|programme manager|program management|projektleiter|projektmanager|chef de projet|gestor de proyectos/i],
  ["Consulting", /consultant|consulting|advisor|advisory|berater|conseiller|consultor/i],
  ["Science & Research", /research|scientist|laboratory|\blab\b|wissenschaft|chercheur|investigador/i],
  ["Engineering", /engineer|ingenieur|ingeniero|ingénieur|technician|techniker|technologist|mechanical|electrical|robotic|hardware|embedded|automation|optics/i],
  ["Operations & Administration", /operations|administrat|office manager|workplace manager|facility management|coordinator|assistant|chief of staff|receptionist|administrator|sachbearbeit|verwaltung/i],
];

export function classifyJob(title: string, sourceCategories: readonly string[] = []): Category {
  const specificRules = rules.slice(0, -2);
  for (const [category, rule] of specificRules) if (rule.test(title)) return category;
  // Provider tags are useful for opaque titles, but never override a clear title.
  const tags = sourceCategories.join(" ");
  for (const [category, rule] of specificRules) if (rule.test(tags)) return category;
  for (const [category, rule] of rules.slice(-2)) if (rule.test(title)) return category;
  return "Other";
}

export function classifyExperienceLevel(title: string): "Junior" | "Middle" | "Senior" | "Lead" | null {
  if (/\b(?:lead|principal|staff|head of)\b/i.test(title)) return "Lead";
  if (/\b(?:senior|sr\.?|expert)\b/i.test(title)) return "Senior";
  if (/\b(?:junior|jr\.?|intern|entry[ -]?level|trainee)\b/i.test(title)) return "Junior";
  if (/\b(?:mid[ -]?level|middle|intermediate)\b/i.test(title)) return "Middle";
  return null;
}

export const employmentKinds = [
  "Full-time", "Part-time", "Contract", "Temporary", "Freelance",
  "Internship", "Apprenticeship", "Working student",
] as const;
type EmploymentKind = (typeof employmentKinds)[number];

export function classifyEmploymentType(value: string | null | undefined): EmploymentKind | null {
  if (!value) return null;
  const text = value.toLowerCase();
  const patterns: readonly [EmploymentKind, RegExp][] = [
    ["Working student", /working student|werkstudent|studentische hilfskraft|étudiant salarié/i],
    ["Apprenticeship", /apprentice|apprenticeship|ausbildung|auszubild|alternance/i],
    ["Internship", /intern|internship|praktik|stage\b|prácticas/i],
    ["Freelance", /freelance|freiberuf|self.employ|selbstständig|autónomo/i],
    ["Part-time", /part[ -]?time|teilzeit|temps partiel|media jornada/i],
    ["Temporary", /temporary|tempora|\bbefristet|fixed[ -]?term|saisonnier/i],
    ["Contract", /contract|contractor|\bcdd\b/i],
    ["Full-time", /full[ -]?time|vollzeit|temps plein|jornada completa/i],
  ];
  const matches = patterns.filter(([, pattern]) => pattern.test(text));
  // A source can offer more than one schedule. A singular filter value would
  // misrepresent such a posting, so leave it unclassified for now.
  return matches.length === 1 ? matches[0]![0] : null;
}
