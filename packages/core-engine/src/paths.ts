const SEG = /[^.[\]]+|\[(?<index>\d+)\]/g;

function segments(path: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SEG.source, "g");
  while ((m = re.exec(path)) !== null) {
    if (m.groups?.index !== undefined) out.push(m.groups.index);
    else out.push(m[0]);
  }
  return out;
}

export function getAtPath(root: unknown, path: string): unknown {
  if (path === "") return root;
  let cur: unknown = root;
  for (const s of segments(path)) {
    if (cur === null || cur === undefined) return undefined;
    if (/^\d+$/.test(s)) {
      const i = Number(s);
      cur = Array.isArray(cur) ? cur[i] : undefined;
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[s];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function setAtPath(root: unknown, path: string, value: unknown): unknown {
  const segs = segments(path);
  if (segs.length === 0) return value;
  const clone = deepClone(root);
  let cur: unknown = clone;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i]!;
    const next = segs[i + 1]!;
    if (cur === null || cur === undefined) return clone;
    if (/^\d+$/.test(s)) {
      const arr = ensureArray(cur, Number(s));
      const idx = Number(s);
      cur = ensureIndex(arr, idx);
      /* If the next segment is a property name (not another index), the slot must be an object.
         Otherwise `getParent` is undefined and the final write is skipped (e.g. `contacts[0].name`). */
      if (!/^\d+$/.test(next)) {
        if (cur === undefined || cur === null || typeof cur !== "object" || Array.isArray(cur)) {
          const slot: Record<string, unknown> = {};
          arr[idx] = slot;
          cur = slot;
        }
      }
    } else {
      const obj = ensureObject(cur, s);
      cur = ensureKey(obj, s, /^\d+$/.test(next) ? [] : {});
    }
  }
  const last = segs[segs.length - 1]!;
  if (/^\d+$/.test(last)) {
    const parent = getParent(clone, segs.slice(0, -1));
    const arr = ensureArray(parent, Number(last));
    arr[Number(last)] = value;
  } else {
    const parent = getParent(clone, segs.slice(0, -1));
    if (parent !== null && typeof parent === "object") {
      (parent as Record<string, unknown>)[last] = value;
    }
  }
  return clone;
}

function getParent(root: unknown, segs: string[]): unknown {
  let cur: unknown = root;
  for (const s of segs) {
    if (cur === null || cur === undefined) return cur;
    if (/^\d+$/.test(s)) {
      cur = Array.isArray(cur) ? cur[Number(s)] : undefined;
    } else {
      cur = (cur as Record<string, unknown>)[s];
    }
  }
  return cur;
}

function ensureObject(v: unknown, key: string): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error(`Cannot set property on non-object at "${key}"`);
  }
  return v as Record<string, unknown>;
}

function ensureArray(v: unknown, index: number): unknown[] {
  if (!Array.isArray(v)) throw new Error(`Expected array at index path segment [${index}]`);
  return v;
}

function ensureIndex(arr: unknown[], index: number): unknown {
  while (arr.length <= index) arr.push(undefined);
  return arr[index];
}

function ensureKey(
  obj: Record<string, unknown>,
  key: string,
  defaultChild: unknown
): unknown {
  if (!(key in obj)) obj[key] = defaultChild;
  return obj[key];
}

function deepClone<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(deepClone) as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object)) {
    out[k] = deepClone((v as Record<string, unknown>)[k]);
  }
  return out as T;
}
