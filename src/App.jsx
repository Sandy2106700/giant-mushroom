import React, { useEffect, useMemo, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "請貼上你的 apiKey",
  authDomain: "請貼上你的 authDomain",
  projectId: "請貼上你的 projectId",
  storageBucket: "請貼上你的 storageBucket",
  messagingSenderId: "請貼上你的 messagingSenderId",
  appId: "請貼上你的 appId",
};

function getNow() {
  return Date.now();
}

function formatCountdown(ms) {
  if (ms <= 0) return "已結束";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return `${days}天 ${hours}小時 ${minutes}分`;
}

function getCountdownColor(ms) {
  if (ms <= 0) return "#999";
  if (ms <= 60 * 60 * 1000) return "#d32f2f";
  if (ms <= 3 * 60 * 60 * 1000) return "#f57c00";
  return "#333";
}

function initFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const colRef = collection(db, "giantMushrooms");
  const q = query(colRef, orderBy("endTime", "asc"));

  return {
    subscribe(onData, onError) {
      return onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }));
          onData(data);
        },
        (error) => {
          if (onError) onError(error);
        }
      );
    },
    async add(data) {
      await addDoc(colRef, data);
    },
    async remove(id) {
      await deleteDoc(doc(db, "giantMushrooms", id));
    },
  };
}

export default function App() {
  const [list, setList] = useState([]);
  const [fb, setFb] = useState(null);
  const [tick, setTick] = useState(getNow());
  const [status, setStatus] = useState("連線中...");
  const [submitting, setSubmitting] = useState(false);

  const [opener, setOpener] = useState("");
  const [form, setForm] = useState({
    spot: "",
    coord: "",
    days: "0",
    hours: "0",
    minutes: "0",
    mega: false,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(getNow());
    }, 1000);

    let unsubscribe = null;

    try {
      const helper = initFirebase();
      setFb(helper);
      setStatus("已連上 Firebase");

      unsubscribe = helper.subscribe(
        (data) => {
          setList(data);
          setStatus("已連上 Firebase");
        },
        (error) => {
          console.error(error);
          setStatus(`讀取失敗：${error.message}`);
        }
      );
    } catch (error) {
      console.error(error);
      setStatus(`Firebase 初始化失敗：${error.message}`);
    }

    return () => {
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const sortedList = useMemo(() => {
    return [...list].sort((a, b) => a.endTime - b.endTime);
  }, [list]);

  async function handleAdd() {
    if (!opener.trim() || !form.spot.trim() || !form.coord.trim()) {
      setStatus("請先填寫開菇人、菇點名稱、座標");
      return;
    }

    const days = Number(form.days || 0);
    const hours = Number(form.hours || 0);
    const minutes = Number(form.minutes || 0);

    if ([days, hours, minutes].some((n) => Number.isNaN(n))) {
      setStatus("剩餘時間請填數字");
      return;
    }

    if (days < 0 || hours < 0 || minutes < 0) {
      setStatus("剩餘時間不能輸入負數");
      return;
    }

    if (hours > 23) {
      setStatus("小時請填 0 到 23");
      return;
    }

    if (minutes > 59) {
      setStatus("分鐘請填 0 到 59");
      return;
    }

    const totalMinutes = days * 24 * 60 + hours * 60 + minutes;

    if (totalMinutes <= 0) {
      setStatus("請至少填入 1 分鐘以上的剩餘時間");
      return;
    }

    if (!fb) {
      setStatus("Firebase 尚未連線完成，請稍後再試");
      return;
    }

    const now = getNow();
    const endTime = now + totalMinutes * 60 * 1000;

    const payload = {
      reporter: opener.trim(),
      spotName: form.spot.trim(),
      coord: form.coord.trim(),
      megaphone: form.mega,
      createdAt: now,
      endTime,
    };

    try {
      setSubmitting(true);
      await fb.add(payload);
      setForm({
        spot: "",
        coord: "",
        days: "0",
        hours: "0",
        minutes: "0",
        mega: false,
      });
      setStatus("新增成功");
    } catch (error) {
      console.error(error);
      setStatus(`新增失敗：${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!fb) return;

    try {
      await fb.remove(id);
      setStatus("刪除成功");
    } catch (error) {
      console.error(error);
      setStatus(`刪除失敗：${error.message}`);
    }
  }

  return (
    <div
      style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: 20,
        fontFamily:
          'Arial, "Noto Sans TC", "Microsoft JhengHei", sans-serif',
        color: "#333",
      }}
    >
      <h1 style={{ textAlign: "center", marginBottom: 24 }}>巨菇共用板</h1>

      <div style={{ display: "grid", gap: 12 }}>
        <input
          placeholder="開菇人"
          value={opener}
          onChange={(e) => setOpener(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="菇點名稱"
          value={form.spot}
          onChange={(e) => setForm({ ...form, spot: e.target.value })}
          style={inputStyle}
        />

        <input
          placeholder="座標"
          value={form.coord}
          onChange={(e) => setForm({ ...form, coord: e.target.value })}
          style={inputStyle}
        />

        <div style={{ textAlign: "center", marginTop: 4 }}>剩餘時間</div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="number"
            min="0"
            placeholder="日"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
            style={{ ...inputStyle, width: 80, textAlign: "center" }}
          />
          <span>天</span>

          <input
            type="number"
            min="0"
            max="23"
            placeholder="小時"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            style={{ ...inputStyle, width: 90, textAlign: "center" }}
          />
          <span>小時</span>

          <input
            type="number"
            min="0"
            max="59"
            placeholder="分"
            value={form.minutes}
            onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            style={{ ...inputStyle, width: 80, textAlign: "center" }}
          />
          <span>分</span>
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 16,
          }}
        >
          <input
            type="checkbox"
            checked={form.mega}
            onChange={(e) => setForm({ ...form, mega: e.target.checked })}
          />
          有開大聲公
        </label>

        <button
          onClick={handleAdd}
          disabled={submitting}
          style={{
            width: 80,
            padding: "10px 0",
            border: "1px solid #999",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          {submitting ? "新增中" : "新增"}
        </button>

        <div
          style={{
            textAlign: "center",
            fontSize: 14,
            color: status.includes("失敗") ? "#c62828" : "#555",
            minHeight: 20,
          }}
        >
          {status}
        </div>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <div style={{ display: "grid", gap: 16 }}>
        {sortedList.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888" }}>目前還沒有資料</div>
        ) : (
          sortedList.map((item) => {
            const left = item.endTime - tick;

            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: 18,
                    marginBottom: 10,
                    color: getCountdownColor(left),
                    textAlign: "left",
                  }}
                >
                  ⏳ 剩餘時間：{formatCountdown(left)}
                </div>

                <div style={{ textAlign: "left", lineHeight: 1.8 }}>
                  <div style={{ fontWeight: "bold", fontSize: 18 }}>
                    {item.spotName}
                  </div>
                  <div>👤 開菇人：{item.reporter}</div>
                  <div>📍 座標：{item.coord}</div>
                  <div>📢 大聲公：{item.megaphone ? "有" : "無"}</div>
                </div>

                <button
                  onClick={() => handleDelete(item.id)}
                  style={{
                    marginTop: 12,
                    padding: "6px 14px",
                    border: "1px solid #999",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  刪除
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  border: "1px solid #999",
  boxSizing: "border-box",
  fontSize: 16,
};