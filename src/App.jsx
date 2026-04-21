import React, { useEffect, useState } from "react";

const USE_FIREBASE = true;

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
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

async function initFirebase() {
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
  } = await import("firebase/firestore");

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const col = collection(db, "giantMushrooms");

  return {
    subscribe(setter, onError) {
      return onSnapshot(
        col,
        (snap) => {
          setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        },
        (error) => {
          if (onError) onError(error);
        }
      );
    },
    add: (data) => addDoc(col, data),
    remove: (id) => deleteDoc(doc(db, "giantMushrooms", id)),
  };
}

export default function App() {
  const [list, setList] = useState([]);
  const [tick, setTick] = useState(getNow());
  const [opener, setOpener] = useState("");
  const [form, setForm] = useState({
    spot: "",
    coord: "",
    days: "0",
    hours: "0",
    minutes: "0",
    mega: false,
  });
  const [fb, setFb] = useState(null);
  const [status, setStatus] = useState("連線中...");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick(getNow()), 1000);

    let unsubscribe = null;

    if (USE_FIREBASE) {
      initFirebase()
        .then((helper) => {
          setFb(helper);
          setStatus("已連上 Firebase");
          unsubscribe = helper.subscribe(
            setList,
            (error) => setStatus(`讀取失敗：${error.message}`)
          );
        })
        .catch((error) => {
          setStatus(`Firebase 初始化失敗：${error.message}`);
        });
    }

    return () => {
      clearInterval(timer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  async function add() {
    if (!opener || !form.spot || !form.coord) {
      setStatus("請先填寫開菇人、菇點名稱、座標");
      return;
    }

    const days = Number(form.days || 0);
    const hours = Number(form.hours || 0);
    const minutes = Number(form.minutes || 0);

    if (days < 0 || hours < 0 || minutes < 0) {
      setStatus("剩餘時間不能輸入負數");
      return;
    }

    const totalMinutes = days * 24 * 60 + hours * 60 + minutes;

    if (totalMinutes <= 0) {
      setStatus("請至少填入 1 分鐘以上的剩餘時間");
      return;
    }

    if (!fb) {
      setStatus("Firebase 尚未連線完成，請稍等一下再試");
      return;
    }

    const endTime = getNow() + totalMinutes * 60000;

    const data = {
      reporter: opener,
      spotName: form.spot,
      coord: form.coord,
      megaphone: form.mega,
      endTime,
      createdAt: getNow(),
    };

    try {
      setSubmitting(true);
      await fb.add(data);
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
      setStatus(`新增失敗：${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "auto", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>巨菇共用板</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="開菇人"
          value={opener}
          onChange={(e) => setOpener(e.target.value)}
          style={{ padding: 10 }}
        />

        <input
          placeholder="菇點名稱"
          value={form.spot}
          onChange={(e) => setForm({ ...form, spot: e.target.value })}
          style={{ padding: 10 }}
        />

        <input
          placeholder="座標"
          value={form.coord}
          onChange={(e) => setForm({ ...form, coord: e.target.value })}
          style={{ padding: 10 }}
        />

        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          剩餘時間
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="number"
            min="0"
            placeholder="日"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
            style={{ padding: 10, width: 60 }}
          />
          <span>天</span>

          <input
            type="number"
            min="0"
            placeholder="小時"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            style={{ padding: 10, width: 70 }}
          />
          <span>小時</span>

          <input
            type="number"
            min="0"
            placeholder="分"
            value={form.minutes}
            onChange={(e) => setForm({ ...form, minutes: e.target.value })}
            style={{ padding: 10, width: 60 }}
          />
          <span>分</span>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={form.mega}
            onChange={(e) => setForm({ ...form, mega: e.target.checked })}
          />
          有開大聲公
        </label>

        <button onClick={add} disabled={submitting} style={{ padding: "10px 16px", width: 80 }}>
          {submitting ? "新增中" : "新增"}
        </button>

        <div style={{ fontSize: 14, color: status.includes("失敗") ? "#c62828" : "#555" }}>{status}</div>
      </div>

      <hr style={{ margin: "20px 0" }} />

      {list.map((i) => {
        const left = i.endTime - tick;
        return (
          <div
            key={i.id}
            style={{
              border: "1px solid #ccc",
              padding: 12,
              marginTop: 12,
              borderRadius: 8,
            }}
          >
            <div style={{ fontWeight: "bold", fontSize: 16, marginBottom: 6 }}>
              ⏳ 剩餘時間：{formatCountdown(left)}
            </div>

            <div style={{ textAlign: "left", lineHeight: "1.6" }}>
              <div style={{ fontWeight: "bold", fontSize: 18 }}>{i.spotName}</div>
              <div>👤 開菇人：{i.reporter}</div>
              <div>📍 座標：{i.coord}</div>
              <div>📢 大聲公：{i.megaphone ? "有" : "無"}</div>
            </div>

            <button
              onClick={() => fb && fb.remove(i.id)}
              style={{ marginTop: 10 }}
            >
              刪除
            </button>
          </div>
        );
      })}
    </div>
  );
}
