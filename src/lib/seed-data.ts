import type { AppRole } from "./roles";

export interface SeedUser {
  employee_id: string;
  name: string;
  email: string;
  password: string;
  department: string;
  role: AppRole;
}

export const SEED_USERS: SeedUser[] = [
  {
    employee_id: "DIR001",
    name: "Dana Chen",
    email: "director@orientaltea.com",
    password: "director123",
    department: "Management",
    role: "director",
  },
  {
    employee_id: "HR001",
    name: "Hana Lin",
    email: "hr@orientaltea.com",
    password: "hr123456",
    department: "Management",
    role: "hr",
  },
  {
    employee_id: "ADM001",
    name: "Adrian Zhang",
    email: "admin@orientaltea.com",
    password: "admin123",
    department: "Management",
    role: "administrative",
  },
  {
    employee_id: "BOH001",
    name: "Master Ben Li",
    email: "bohmanager@orientaltea.com",
    password: "bohmanager123",
    department: "BOH",
    role: "boh_manager",
  },
  {
    employee_id: "BOH002",
    name: "Cara Zhao",
    email: "cdp@orientaltea.com",
    password: "cdp123",
    department: "BOH",
    role: "cdp",
  },
  {
    employee_id: "BOH003",
    name: "Sam Zhou",
    email: "sous@orientaltea.com",
    password: "sous123",
    department: "BOH",
    role: "sous",
  },
  {
    employee_id: "BOH004",
    name: "Bo Sun",
    email: "bohcrew@orientaltea.com",
    password: "bohcrew123",
    department: "BOH",
    role: "boh_crew",
  },
  {
    employee_id: "FOH001",
    name: "Fiona Wang",
    email: "fohmanager@orientaltea.com",
    password: "fohmanager123",
    department: "FOH",
    role: "foh_manager",
  },
  {
    employee_id: "FOH002",
    name: "Will Lucas",
    email: "waiter@orientaltea.com",
    password: "waiter123",
    department: "FOH",
    role: "waiter",
  },
  {
    employee_id: "FOH003",
    name: "Bella Liu",
    email: "barista@orientaltea.com",
    password: "barista123",
    department: "FOH",
    role: "barista",
  },
];

export interface SeedSection {
  id: string;
  title: string;
  order_num: number;
  target_category: string;
}

export const SEED_SECTIONS: SeedSection[] = [
  { id: "sec-intro", title: "Company Introduction & Heritage", order_num: 1, target_category: "All" },
  { id: "sec-hr", title: "HR Policies & Workplace Ethics", order_num: 2, target_category: "All" },
  { id: "sec-safety", title: "Food Safety, Hygiene & Emergency SOPs", order_num: 3, target_category: "All" },
  { id: "sec-brewing", title: "Master Tea Brewing & Kitchen SOPs", order_num: 4, target_category: "BOH" },
  { id: "sec-foh-service", title: "Teahouse Service & Sommelier Protocols", order_num: 5, target_category: "FOH" },
];

export interface SeedDocument {
  id: string;
  section_id: string;
  title: string;
  content: string;
  order_num: number;
}

export const SEED_DOCUMENTS: SeedDocument[] = [
  {
    id: "doc-welcome",
    section_id: "sec-intro",
    title: "Welcome to Oriental Tea House",
    order_num: 1,
    content: `# Welcome to Oriental Tea House

Welcome to Oriental Tea House. Founded with a deep passion for traditional tea craftsmanship and modern hospitality, our goal is to bring the art of tea brewing to every guest.

## Our Philosophy

1. **Mindfulness**: Every leaf is brewed with care and focused attention.
2. **Purity**: We use only single-origin tea leaves and purified spring-standard water.
3. **Warmth**: Every guest is greeted as a honored visitor in our teahouse.

## How to Navigate the Handbook

- **Left Sidebar**: Browse handbook sections designated for your department.
- **Search Bar**: Quickly locate brewing specs, safety rules, or HR policies.
- **FAQ Board**: Post questions for Management and Tea Masters.`,
  },
  {
    id: "doc-values",
    section_id: "sec-intro",
    title: "Core Values & Teahouse Etiquette",
    order_num: 2,
    content: `# Core Values & Teahouse Etiquette

## Respect for the Craft

Respect the tea leaves, the teaware, and your team members. Handle handcrafted Yixing clay pots and porcelain gaiwans with utmost care.

## Tranquility & Atmosphere

Maintain a calm, soothing atmosphere in the teahouse. Keep voices moderate and ensure service is graceful and unhurried.

## Cleanliness & Precision

Water temperature and steeping duration directly determine tea flavor. Cleanliness of water kettles and tea vessels is non-negotiable.`,
  },
  {
    id: "doc-attendance",
    section_id: "sec-hr",
    title: "Attendance, Punctuality & Shift Scheduling",
    order_num: 1,
    content: `# Attendance, Punctuality & Shift Scheduling

## Shift Punctuality

Staff must arrive 10 minutes prior to scheduled shift start in full clean uniform.

## Leave Requests

- Submit annual or personal leave requests at least 14 days in advance via the HR portal.
- Sick leave requires notification to your Department Manager at least 3 hours before shift commencement, followed by a certified medical note.`,
  },
  {
    id: "doc-conduct",
    section_id: "sec-hr",
    title: "Professional Conduct & Anti-Harassment",
    order_num: 2,
    content: `# Professional Conduct & Anti-Harassment

## Workplace Dignity

Oriental Tea House maintains zero tolerance for harassment, discrimination, or abusive conduct of any kind.

## Grievance Escalation

1. Discuss concerns directly with your Department Manager.
2. If unresolved, submit a confidential report to HR (hr@orientaltea.com).
3. HR will investigate and respond within 3 business days.`,
  },
  {
    id: "doc-hygiene",
    section_id: "sec-safety",
    title: "Food Safety & Personal Hygiene",
    order_num: 1,
    content: `# Food Safety & Personal Hygiene

## Hand Washing Protocols

Wash hands thoroughly with anti-bacterial soap for at least 20 seconds:
- Before entering tea preparation areas or handling tea leaves.
- After handling cash, trash, or clearing tables.
- After breaking or using restroom facilities.

## Personal Appearance & Uniforms

- Hair tied back neatly; hairnets required in Kitchen & Brewing areas.
- No heavy perfume, scented lotion, or artificial fingernails that could taint delicate tea aromas.
- Clean non-slip footwear required in all operational zones.`,
  },
  {
    id: "doc-emergency",
    section_id: "sec-safety",
    title: "Emergency Response & PASS Fire SOP",
    order_num: 2,
    content: `# Emergency Response & PASS Fire SOP

## Fire Extinguisher Usage (PASS Protocol)

In case of a small electrical or kitchen fire, use the nearest designated fire extinguisher following **PASS**:

1. **P**ull the safety pin.
2. **A**im the nozzle at the base of the fire.
3. **S**queeze the operating lever.
4. **S**weep side-to-side across the base of the flame.

## Evacuation Assembly Points

- **Front of House Staff & Guests**: Main Courtyard Entry Plaza.
- **Back of House Staff**: Rear Loading Dock Assembly Zone.`,
  },
  {
    id: "doc-water-temp",
    section_id: "sec-brewing",
    title: "Water Quality & Temperature Standards by Tea Type",
    order_num: 1,
    content: `# Water Quality & Temperature Standards by Tea Type

Precision temperature control is essential to extract optimal flavor notes without scalding delicate leaves.

## Steeping Reference Table

| Tea Category | Water Temp (°C) | Vessel Type | First Infusion Time |
|---|---|---|---|
| Green Tea (Dragon Well) | 80°C - 85°C | Glass / Fair Cup | 45 seconds |
| White Tea (Silver Needle) | 85°C - 90°C | White Porcelain Gaiwan | 60 seconds |
| Oolong (Tieguanyin / Da Hong Pao) | 95°C - 98°C | Yixing Clay Teapot | 30 seconds |
| Black Tea (Lapsang / Keemun) | 95°C - 100°C | Porcelain / Clay | 45 seconds |
| Pu-erh (Aged Ripe Pu-erh) | 100°C (Boiling) | Purple Clay Teapot | 20s (Flash Rinse First) |

## Water Filtration Check

Check water TDS (Total Dissolved Solids) daily using the digital meter. Acceptable range: 50 - 120 PPM.`,
  },
  {
    id: "doc-steeping-sop",
    section_id: "sec-brewing",
    title: "Loose-Leaf Storage & Clay Vessel Care SOP",
    order_num: 2,
    content: `# Loose-Leaf Storage & Clay Vessel Care SOP

## Storage Rules

- Keep tea stored in airtight stainless steel tins away from direct sunlight, moisture, and pungent spices.
- Matcha and delicate green teas must remain in refrigerated storage at 4°C - 6°C.

## Yixing Teapot Care Rules

- **Dedicated Clay Vessels**: Never use soap or detergent on Yixing clay pots. Clean with scalding water only.
- Each clay pot is dedicated to a single tea category (e.g., roasted Oolong only) to preserve seasoned flavor profiles.`,
  },
  {
    id: "doc-kitchen-prep",
    section_id: "sec-brewing",
    title: "Teahouse Dim Sum & Snack Preparation SOP",
    order_num: 3,
    content: `# Teahouse Dim Sum & Snack Preparation SOP

## Tea Snack Pairing Guidelines

- **Osmanthus Jelly**: Steam fresh batches daily; chill for 2 hours before serving.
- **Mochi & Pastries**: Check freshness timestamps; serve with matching Green or Oolong tea recommendations.`,
  },
  {
    id: "doc-tea-ceremony",
    section_id: "sec-foh-service",
    title: "Tableside Tea Ceremony & Pouring Protocols",
    order_num: 1,
    content: `# Tableside Tea Ceremony & Pouring Protocols

## Gongfu Tea Service Sequence

1. **Presentation**: Present the tea leaves in the aroma vessel to the guest for inspection.
2. **Warming Teaware**: Pour hot water over the teapot and aroma cups to pre-heat vessels.
3. **Rinse & Awaken**: Pour first quick rinse into the tea tray pet / drain cup.
4. **Pouring Technique**: Pour from height in a smooth, continuous stream into the pitcher (Fair Cup) before serving guests to ensure even flavor density.`,
  },
  {
    id: "doc-customer-greeting",
    section_id: "sec-foh-service",
    title: "Guest Greeting & Tea Recommendation Script",
    order_num: 2,
    content: `# Guest Greeting & Tea Recommendation Script

## 10-Second Warm Welcome

Greet guests upon entering: *"Welcome to Oriental Tea House. Are you looking for a refreshing brew or a traditional Gongfu tasting experience today?"*

## Recommendation Guide

- Guest seeking light & floral: Recommend **High Mountain Alishan Oolong**.
- Guest seeking rich & earthy: Recommend **15-Year Aged Ripe Pu-erh**.
- Guest seeking caffeine-free: Recommend **Chrysanthemum & Goji Infusion**.`,
  },
  {
    id: "doc-pos-retail",
    section_id: "sec-foh-service",
    title: "Retail Sales, Loose Leaf Packaging & POS",
    order_num: 3,
    content: `# Retail Sales, Loose Leaf Packaging & POS

## Loose Leaf Sales SOP

1. Weigh tea using calibrated digital scale (error margin within ±0.1g).
2. Vacuum seal tin bags with oxygen absorber packets.
3. Apply batch label indicating harvest year and origin.`,
  },
];
