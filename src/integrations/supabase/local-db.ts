import { SEED_DOCUMENTS, SEED_SECTIONS, SEED_USERS } from "@/lib/seed-data";

export interface LocalTableData {
  profiles: any[];
  user_roles: any[];
  libraries: any[];
  sections: any[];
  documents: any[];
  faq_threads: any[];
  faq_replies: any[];
  audit_logs: any[];
}

const STORAGE_KEY = "oriental_tea_local_db_v1";
const SESSION_KEY = "oriental_tea_current_user_id";

function getInitialData(): LocalTableData {
  const profiles = SEED_USERS.map((u) => ({
    id: `usr-${u.employee_id.toLowerCase()}`,
    employee_id: u.employee_id,
    name: u.name,
    email: u.email,
    department: u.department,
    status: "Active",
    outlets: ["Oriental Tea Flagship", "Oriental Tea Pavilion", "Oriental Tea KLCC"],
    stations: ["Station 1", "Station 2", "Station 3", "Station 4", "Station 5"],
    departments: [],
    last_login_at: new Date().toISOString(),
  }));

  const user_roles = SEED_USERS.map((u) => ({
    user_id: `usr-${u.employee_id.toLowerCase()}`,
    role: u.role,
    is_primary: true,
  }));

  const libraries = [
    {
      id: "handbook",
      slug: "handbook",
      title: "Handbook",
      order_num: 1,
      visibility: "public",
      target_departments: [],
    },
  ];

  const sections = SEED_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    order_num: s.order_num,
    target_category: s.target_category,
    target_stations: [],
    created_by: null,
    library_id: "handbook",
  }));

  const documents = SEED_DOCUMENTS.map((d) => ({
    id: d.id,
    section_id: d.section_id,
    title: d.title,
    content: d.content,
    order_num: d.order_num,
    last_updated: new Date().toISOString(),
    target_outlets: [],
    target_stations: [],
    target_departments: [],
    target_roles: [],
    created_by: null,
  }));

  const faq_threads = [
    {
      id: "thread-welcome",
      author_id: "usr-dir001",
      author_name: "Dana Chen",
      title: "Welcome to Oriental Tea House FAQ Board",
      created_at: new Date().toISOString(),
      resolved: false,
      pinned_reply_id: null,
    },
  ];

  const faq_replies = [
    {
      id: "reply-welcome",
      thread_id: "thread-welcome",
      author_id: "usr-hr001",
      author_name: "Hana Lin",
      content: "Feel free to ask any questions regarding tea brewing, department policies, or shift schedules here!",
      created_at: new Date().toISOString(),
    },
  ];

  const audit_logs: any[] = [];

  return {
    profiles,
    user_roles,
    libraries,
    sections,
    documents,
    faq_threads,
    faq_replies,
    audit_logs,
  };
}

let memoryDb: LocalTableData = getInitialData();
let memoryCurrentUserId: string | null = "usr-dir001"; // Default to Director on local load if unauthenticated

function loadDb(): LocalTableData {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
      const init = getInitialData();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(init));
      return init;
    } catch {
      return memoryDb;
    }
  }
  return memoryDb;
}

function saveDb(data: LocalTableData) {
  memoryDb = data;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

function getCurrentUserId(): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(SESSION_KEY) ?? memoryCurrentUserId;
    } catch {
      return memoryCurrentUserId;
    }
  }
  return memoryCurrentUserId;
}

function setCurrentUserId(id: string | null) {
  memoryCurrentUserId = id;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (id) window.localStorage.setItem(SESSION_KEY, id);
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

class QueryBuilder {
  private tableName: keyof LocalTableData;
  private filters: ((row: any) => boolean)[] = [];
  private sortFn?: (a: any, b: any) => number;
  private limitCount?: number;
  private isSingle = false;
  private isMaybeSingle = false;
  private isInsert = false;
  private isUpdate = false;
  private isDelete = false;
  private payload: any = null;

  constructor(tableName: keyof LocalTableData) {
    this.tableName = tableName;
  }

  select(_cols?: string, _opts?: any) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => row[col] === val);
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((row) => row[col] !== val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((row) => vals.includes(row[col]));
    return this;
  }

  order(col: string, { ascending = true }: { ascending?: boolean } = {}) {
    this.sortFn = (a, b) => {
      if (a[col] < b[col]) return ascending ? -1 : 1;
      if (a[col] > b[col]) return ascending ? 1 : -1;
      return 0;
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.payload = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  private execute() {
    const db = loadDb();
    let table = db[this.tableName] || [];

    if (this.isInsert) {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      table = [...table, ...items];
      db[this.tableName] = table;
      saveDb(db);
      return { data: this.payload, error: null };
    }

    let matchingIndices: number[] = [];
    table.forEach((row, idx) => {
      if (this.filters.every((f) => f(row))) {
        matchingIndices.push(idx);
      }
    });

    if (this.isDelete) {
      const remaining = table.filter((_, idx) => !matchingIndices.includes(idx));
      db[this.tableName] = remaining;
      saveDb(db);
      return { data: null, error: null };
    }

    if (this.isUpdate) {
      matchingIndices.forEach((idx) => {
        table[idx] = { ...table[idx], ...this.payload };
      });
      db[this.tableName] = table;
      saveDb(db);
      return { data: null, error: null };
    }

    let rows = table.filter((row) => this.filters.every((f) => f(row)));

    if (this.sortFn) {
      rows.sort(this.sortFn);
    }

    if (this.limitCount !== undefined) {
      rows = rows.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return {
        data: rows[0] ?? null,
        error: rows.length > 0 ? null : { message: `No record found in ${this.tableName}` },
      };
    }

    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null };
    }

    return { data: rows, error: null };
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const result = this.execute();
      return Promise.resolve(result).then(onfulfilled, onrejected);
    } catch (err) {
      return Promise.reject(err).catch(onrejected);
    }
  }

  catch(onrejected?: (reason: any) => any) {
    return this.then(undefined, onrejected);
  }
}

export function createLocalSupabaseClient(): any {
  return {
    from(tableName: keyof LocalTableData) {
      return new QueryBuilder(tableName);
    },
    auth: {
      async getUser() {
        const userId = getCurrentUserId();
        if (!userId) return { data: { user: null }, error: null };
        const db = loadDb();
        const profile = db.profiles.find((p) => p.id === userId);
        if (!profile) return { data: { user: null }, error: null };
        return {
          data: {
            user: {
              id: profile.id,
              email: profile.email,
              user_metadata: { name: profile.name },
            },
          },
          error: null,
        };
      },

      async getSession() {
        const { data } = await this.getUser();
        if (!data.user) return { data: { session: null }, error: null };
        return {
          data: {
            session: {
              access_token: "local-token",
              user: data.user,
            },
          },
          error: null,
        };
      },

      async signInWithPassword({ email, password }: { email: string; password?: string }) {
        const db = loadDb();
        const seedMatch = SEED_USERS.find(
          (u) => u.email.toLowerCase() === email.toLowerCase(),
        );
        const profileMatch = db.profiles.find(
          (p) => p.email.toLowerCase() === email.toLowerCase(),
        );

        if (!profileMatch && !seedMatch) {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials." } };
        }

        const validPassword = seedMatch?.password || "password";
        if (password && password !== validPassword && password.length < 3) {
          return { data: { user: null, session: null }, error: { message: "Invalid login credentials." } };
        }

        const userId = profileMatch?.id || `usr-${seedMatch?.employee_id.toLowerCase()}`;
        setCurrentUserId(userId);

        const targetEmail = profileMatch?.email || seedMatch?.email || email;
        const targetName = profileMatch?.name || seedMatch?.name || "Employee";

        return {
          data: {
            user: {
              id: userId,
              email: targetEmail,
              user_metadata: { name: targetName },
            },
            session: { access_token: "local-token" },
          },
          error: null,
        };
      },

      async signOut() {
        setCurrentUserId(null);
        return { error: null };
      },

      async resetPasswordForEmail() {
        return { error: null };
      },

      async updateUser() {
        return { error: null };
      },

      onAuthStateChange(callback: (event: string, session: any) => void) {
        // Run once
        setTimeout(async () => {
          const { data } = await this.getSession();
          callback("INITIAL_SESSION", data.session);
        }, 10);
        return {
          data: {
            subscription: {
              unsubscribe: () => {},
            },
          },
        };
      },

      admin: {
        async createUser(args: { email: string; password?: string; user_metadata?: { name?: string } }) {
          const db = loadDb();
          const newId = `usr-${Date.now().toString(36)}`;
          const newProfile = {
            id: newId,
            employee_id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
            name: args.user_metadata?.name || "New Employee",
            email: args.email,
            department: "FOH",
            status: "Active",
            outlets: ["Oriental Tea Flagship"],
            stations: ["Station 1"],
            departments: [],
            last_login_at: new Date().toISOString(),
          };
          db.profiles.push(newProfile);
          saveDb(db);
          return { data: { user: { id: newId } }, error: null };
        },

        async updateUserById() {
          return { error: null };
        },

        async deleteUser(userId: string) {
          const db = loadDb();
          db.profiles = db.profiles.filter((p) => p.id !== userId);
          db.user_roles = db.user_roles.filter((r) => r.user_id !== userId);
          saveDb(db);
          return { error: null };
        },
      },
    },

    channel() {
      return {
        on() {
          return this;
        },
        subscribe(cb: (status: string) => void) {
          if (cb) cb("SUBSCRIBED");
          return this;
        },
      };
    },

    removeChannel() {},

    async rpc(funcName: string, args: any) {
      if (funcName === "create_app_role") {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
  };
}
