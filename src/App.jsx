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
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCwTB0Rn-jLk3KahCBox0NLbno7ZgvW3Oo",
  authDomain: "pikmin-mushroom-record.firebaseapp.com",
  projectId: "pikmin-mushroom-record",
  storageBucket: "pikmin-mushroom-record.firebasestorage.app",
  messagingSenderId: "742213673504",
  appId: "1:742213673504:web:1e1fcb9962ca846af91245",
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
    async update(id, data) {
      await updateDoc(doc(db, "giantMushrooms", id), data);
    },
  };
}

const emptyForm = {
  spot: "",
  coord: "",
  note: "",
  days: "0",
  hours: "0",
  minutes: "0",
  mega: false,
};

export default function App() {
  const [list, setList] = useState([]);
  const [fb, setFb] = useState(null);
  const [tick, setTick] = useState(getNow());
  const [status, setStatus] = useState("連線中...");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [opener, setOpener] = useState("");
  const [form, setForm] = useState(emptyForm);

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
    return [...list].sort((a, b) => {
      const aEnd = a.endTime ?? Number.MAX_SAFE_INTEGER;
      const bEnd = b.endTime ?? Number.MAX_SAFE_INTEGER;
      return aEnd - bEnd;
    });
  }, [list]);

  async function handleAdd() {
    const openerValue = opener.trim() || "未填寫";
    const spotValue = form.spot.trim() || "未命名菇點";
    const coordValue = form.coord.trim() || "未填寫";
    const noteValue = form.note.trim() || "";

    const days = Number(form.days || 0);
    const hours = Number(form.hours || 0);
    const minutes = Number(form.minutes || 0);

    if (!fb) {
      setStatus("Firebase 尚未連線完成");
      return;
    }

    const totalMinutes = days * 24 * 60 + hours * 60 + minutes;
    const now = getNow();

    const payload = {
      reporter: openerValue,
      spotName: spotValue,
      coord: coordValue,
      note: noteValue,
      megaphone: form.mega,
      createdAt: now,
      endTime: totalMinutes > 0 ? now + totalMinutes * 60 * 1000 : null,
    };

    try {
      setSubmitting(true);

      if (editingId) {
        await fb.update(editingId, payload);
        setStatus("修改成功");
      } else {
        await fb.add(payload);
        setStatus("新增成功");
      }

      setEditingId("");
      setOpener("");
      setForm(emptyForm);
    } catch (error) {
      setStatus("操作失敗");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setOpener(item.reporter);

    setForm({
      spot: item.spotName,
      coord: item.coord,
      note: item.note || "",
      days: "0",
      hours: "0",
      minutes: "0",
      mega: item.megaphone,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>巨菇共用板</h1>

      <input placeholder="開菇人" value={opener} onChange={(e) => setOpener(e.target.value)} style={inputStyle} />
      <input placeholder="菇點名稱" value={form.spot} onChange={(e) => setForm({ ...form, spot: e.target.value })} style={inputStyle} />
      <input placeholder="座標" value={form.coord} onChange={(e) => setForm({ ...form, coord: e.target.value })} style={inputStyle} />

      <input placeholder="備註（可不填）" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={inputStyle} />

      <button onClick={handleAdd}>{editingId ? "儲存修改" : "新增"}</button>

      <hr />

      <div style={{ textAlign: "right", marginBottom: 10 }}>
        巨菇數量：{sortedList.length}
      </div>

      {sortedList.map((item, index) => {
        const left = item.endTime ? item.endTime - tick : null;

        return (
          <div key={item.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
            <div>#{index + 1}</div>
            <div>⏳ {left === null ? "未設定" : formatCountdown(left)}</div>
            <div>{item.spotName}</div>
            <div>開菇人：{item.reporter}</div>
            <div>座標：{item.coord}</div>
            <div>備註：{item.note || "無"}</div>
            <button onClick={() => handleEdit(item)}>修改</button>
          </div>
        );
      })}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginBottom: 8,
  padding: 8,
};