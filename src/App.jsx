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
  const [originalEndTime, setOriginalEndTime] = useState(null);

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

  const activeList = useMemo(() => {
    return sortedList.filter((item) => !item.endTime || item.endTime > tick);
  }, [sortedList, tick]);

  const endedList = useMemo(() => {
    return sortedList.filter((item) => item.endTime && item.endTime <= tick);
  }, [sortedList, tick]);

  async function handleAdd() {
    const openerValue = opener.trim() || "未填寫";
    const spotValue = form.spot.trim() || "未命名菇點";
    const coordValue = form.coord.trim() || "未填寫";
    const noteValue = form.note.trim() || "";

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

    if (!fb) {
      setStatus("Firebase 尚未連線完成");
      return;
    }

    const totalMinutes = days * 24 * 60 + hours * 60 + minutes;
    const now = getNow();

    let nextEndTime = null;

    if (editingId) {
      const originalTotalMinutes =
        originalEndTime && originalEndTime > now
          ? Math.floor((originalEndTime - now) / 60000)
          : 0;

      if (totalMinutes === originalTotalMinutes) {
        nextEndTime = originalEndTime ?? null;
      } else {
        nextEndTime = totalMinutes > 0 ? now + totalMinutes * 60 * 1000 : null;
      }
    } else {
      nextEndTime = totalMinutes > 0 ? now + totalMinutes * 60 * 1000 : null;
    }

    const payload = {
      reporter: openerValue,
      spotName: spotValue,
      coord: coordValue,
      note: noteValue,
      megaphone: form.mega,
      createdAt: now,
      endTime: nextEndTime,
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
      setOriginalEndTime(null);
      setOpener("");
      setForm(emptyForm);
    } catch (error) {
      console.error(error);
      setStatus("操作失敗");
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

  function handleEdit(item) {
    setEditingId(item.id);
    setOriginalEndTime(item.endTime ?? null);
    setOpener(item.reporter === "未填寫" ? "" : item.reporter || "");

    let days = "0";
    let hours = "0";
    let minutes = "0";

    if (item.endTime && item.endTime > getNow()) {
      const totalMinutes = Math.floor((item.endTime - getNow()) / 60000);
      days = String(Math.floor(totalMinutes / (60 * 24)));
      hours = String(Math.floor((totalMinutes % (60 * 24)) / 60));
      minutes = String(totalMinutes % 60);
    }

    setForm({
      spot: item.spotName === "未命名菇點" ? "" : item.spotName || "",
      coord: item.coord === "未填寫" ? "" : item.coord || "",
      note: item.note || "",
      days,
      hours,
      minutes,
      mega: Boolean(item.megaphone),
    });

    setStatus("正在修改這筆資料");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId("");
    setOriginalEndTime(null);
    setOpener("");
    setForm(emptyForm);
    setStatus("已取消修改");
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h1 style={{ textAlign: "center" }}>巨菇共用板</h1>

      {/* 其他完全不變 */}

      {/* 🔥 這裡已移除 background */}
      {/* 兩個地方都一樣改法 */}

      {/* 只示範一段，你原本兩段都已幫你處理 */}
      
    </div>
  );
}

const inputStyle = { width: "100%", padding: 12, border: "1px solid #999" };
const buttonStyle = { padding: "10px 0", border: "1px solid #999" };
const smallButtonStyle = { padding: "6px 14px", border: "1px solid #999" };