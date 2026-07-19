import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCURACY_MAX, SPEED_MAX } from "../domain/game/score.ts";
import { getAllHighScores, getHighScore, recordHighScore } from "./highScores.ts";

const STORAGE_KEY = "junior-typing:high-scores:v1";
const MAX_SCORE = ACCURACY_MAX + SPEED_MAX;

// node の unit プロジェクトで動かすため、Storage 互換の in-memory 実装を毎テスト差し込む。
// browser の実装差異（SecurityError 等）はテスト対象コード側の try/catch で守っているので、
// ここでは値の入出力とキー空間の分離だけを検証する。
class FakeStorage implements Storage {
  private readonly store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

let storage: FakeStorage;
// globalThis.localStorage の元の記述子を退避しておき、afterEach で必ず戻す。
// node 環境では未定義なのが通常だが、将来 --experimental-webstorage が有効化された
// 環境でテストを回しても状態が漏れないようにする。
let originalDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  storage = new FakeStorage();
  originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, "localStorage", originalDescriptor);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

describe("getHighScore", () => {
  it("未登録の setId には null を返す", () => {
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("recordHighScore で書き込まれた値を読み出せる", () => {
    recordHighScore("hiragana-a-ka", 800);
    expect(getHighScore("hiragana-a-ka")).toBe(800);
  });

  it("破損 JSON が入っていたら null を返す", () => {
    storage.setItem(STORAGE_KEY, "{ not-json");
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("トップレベルが配列だと破損扱いで null を返す", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("トップレベルが null 文字列だと破損扱いで null を返す", () => {
    storage.setItem(STORAGE_KEY, "null");
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("値が非整数のエントリは無視する", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ "hiragana-a-ka": 700.5 }));
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("値が文字列のエントリは無視する", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ "hiragana-a-ka": "700" }));
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("値が負のエントリは無視する", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ "hiragana-a-ka": -1 }));
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("値が上限（1000）を超えるエントリは無視する", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ "hiragana-a-ka": MAX_SCORE + 1 }));
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("満点（1000）はそのまま読み出せる", () => {
    recordHighScore("hiragana-a-ka", MAX_SCORE);
    expect(getHighScore("hiragana-a-ka")).toBe(MAX_SCORE);
  });

  it("0 点もそのまま読み出せる", () => {
    recordHighScore("hiragana-a-ka", 0);
    expect(getHighScore("hiragana-a-ka")).toBe(0);
  });

  it("破損エントリと正常エントリが混在するとき、正常な方だけ生き残る", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ good: 500, bad: "oops", "also-bad": -5 }));
    expect(getHighScore("good")).toBe(500);
    expect(getHighScore("bad")).toBeNull();
    expect(getHighScore("also-bad")).toBeNull();
  });

  it("localStorage が未定義でもクラッシュせず null を返す", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("localStorage の参照アクセス自体が throw してもクラッシュしない", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });
});

describe("getAllHighScores", () => {
  it("未保存なら空オブジェクトを返す", () => {
    expect(getAllHighScores()).toEqual({});
  });

  it("複数セット分のスコアをまとめて返す", () => {
    recordHighScore("a", 100);
    recordHighScore("b", 200);
    recordHighScore("c", 300);
    expect(getAllHighScores()).toEqual({ a: 100, b: 200, c: 300 });
  });

  it("破損時は空オブジェクトを返す", () => {
    storage.setItem(STORAGE_KEY, "not json");
    expect(getAllHighScores()).toEqual({});
  });

  it("破損エントリだけ落として正常エントリを返す", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ good: 500, bad: null }));
    expect(getAllHighScores()).toEqual({ good: 500 });
  });
});

describe("recordHighScore", () => {
  it("未登録の setId に対しては新記録として書き込む", () => {
    const result = recordHighScore("hiragana-a-ka", 500);
    expect(result).toEqual({ previousHigh: null, isNewHigh: true });
    expect(getHighScore("hiragana-a-ka")).toBe(500);
  });

  it("既存より高いスコアは新記録として上書きする", () => {
    recordHighScore("hiragana-a-ka", 500);
    const result = recordHighScore("hiragana-a-ka", 800);
    expect(result).toEqual({ previousHigh: 500, isNewHigh: true });
    expect(getHighScore("hiragana-a-ka")).toBe(800);
  });

  it("既存と同点のスコアは更新しない", () => {
    recordHighScore("hiragana-a-ka", 500);
    const result = recordHighScore("hiragana-a-ka", 500);
    expect(result).toEqual({ previousHigh: 500, isNewHigh: false });
    expect(getHighScore("hiragana-a-ka")).toBe(500);
  });

  it("既存より低いスコアは更新しない", () => {
    recordHighScore("hiragana-a-ka", 800);
    const result = recordHighScore("hiragana-a-ka", 300);
    expect(result).toEqual({ previousHigh: 800, isNewHigh: false });
    expect(getHighScore("hiragana-a-ka")).toBe(800);
  });

  it("既存より低いスコアのときは storage への書き込みを起こさない", () => {
    recordHighScore("hiragana-a-ka", 800);
    const setItemSpy = vi.spyOn(storage, "setItem");
    recordHighScore("hiragana-a-ka", 300);
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("複数の setId は互いに干渉しない", () => {
    recordHighScore("hiragana-a-ka", 400);
    recordHighScore("hiragana-sa-ta", 900);
    expect(getHighScore("hiragana-a-ka")).toBe(400);
    expect(getHighScore("hiragana-sa-ta")).toBe(900);
    // どちらか一方を上書きしてももう一方は保持される
    recordHighScore("hiragana-a-ka", 500);
    expect(getHighScore("hiragana-a-ka")).toBe(500);
    expect(getHighScore("hiragana-sa-ta")).toBe(900);
  });

  it("setItem が例外を投げてもクラッシュせず、書き込みは失敗するが以降の読み出しは継続できる", () => {
    // QuotaExceededError / SecurityError 相当を setItem がスローするケース。
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    // recordHighScore 自体は throw しない。
    expect(() => recordHighScore("hiragana-a-ka", 500)).not.toThrow();
    // 書き込み失敗しているので getHighScore は null のまま。
    expect(getHighScore("hiragana-a-ka")).toBeNull();
  });

  it("localStorage が未定義でもクラッシュしない（書き込みは無視される）", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(() => recordHighScore("hiragana-a-ka", 500)).not.toThrow();
  });
});
