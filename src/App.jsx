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
    subscribe(onData) {
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        onData(data);
      });
    },
    add: (data) => addDoc(colRef, data),
    remove: (id) => deleteDoc(doc(db, "giantMushrooms", id)),
    update: (id, data) =>
      updateDoc(doc(db, "giantMushrooms", id), data),
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
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [opener, setOpener] = useState("");
  const [originalEndTime, setOriginalEndTime] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => setTick(getNow()), 1000);
    const helper = initFirebase();
    setFb(helper);
    const unsub = helper.subscribe(setList);

    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const activeList = list.filter(
    (i) => !i.endTime || i.endTime > tick
  );
  const endedList = list.filter(
    (i) => i.endTime && i.endTime <= tick
  );

  async function handleSubmit() {
    const days = Number(form.days || 0);
    const hours = Number(form.hours || 0);
    const minutes = Number(form.minutes || 0);
    const totalMinutes = days * 1440 + hours * 60 + minutes;
    const now = getNow();

    let endTime = null;

    if (editingId) {
      const originalMinutes =
        originalEndTime && originalEndTime > now
          ? Math.floor((originalEndTime - now) / 60000)
          : 0;

      if (totalMinutes === originalMinutes) {
        endTime = originalEndTime;
      } else {
        endTime = totalMinutes > 0 ? now + totalMinutes * 60000 : null;
      }
    } else {
      endTime = totalMinutes > 0 ? now + totalMinutes * 60000 : null;
    }

    const payload = {
      reporter: opener || "未填寫",
      spotName: form.spot || "未命名菇點",
      coord: form.coord || "未填寫",
      note: form.note || "",
      megaphone: form.mega,
      createdAt: now,
      endTime,
    };

    if (editingId) {
      await fb.update(editingId, payload);
    } else {
      await fb.add(payload);
    }

    setEditingId("");
    setOriginalEndTime(null);
    setForm(emptyForm);
    setOpener("");
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setOriginalEndTime(item.endTime);
    setOpener(item.reporter);

    setForm({
      spot: item.spotName,
      coord: item.coord,
      note: item.note,
      days: "0",
      hours: "0",
      minutes: "0",
      mega: item.megaphone,
    });

    window.scrollTo({ top: 0 });
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 20 }}>
      <h2 style={{ textAlign: "center" }}>巨菇共用板</h2>

      <input placeholder="開菇人" value={opener}
        onChange={(e)=>setOpener(e.target.value)} />

      <input placeholder="菇點名稱" value={form.spot}
        onChange={(e)=>setForm({...form, spot:e.target.value})} />

      <input placeholder="座標" value={form.coord}
        onChange={(e)=>setForm({...form, coord:e.target.value})} />

      <input placeholder="備註" value={form.note}
        onChange={(e)=>setForm({...form, note:e.target.value})} />

      <div style={{ textAlign:"center" }}>剩餘時間</div>

      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <input value={form.days} onChange={(e)=>setForm({...form, days:e.target.value})}/>天
        <input value={form.hours} onChange={(e)=>setForm({...form, hours:e.target.value})}/>時
        <input value={form.minutes} onChange={(e)=>setForm({...form, minutes:e.target.value})}/>分
      </div>

      <label>
        <input type="checkbox"
          checked={form.mega}
          onChange={(e)=>setForm({...form, mega:e.target.checked})}/>
        有大聲公
      </label>

      <button onClick={handleSubmit}>
        {editingId ? "儲存修改" : "新增"}
      </button>

      <hr />

      <div style={{ display:"flex", justifyContent:"space-between" }}>
        <div>未結束巨菇數量：{activeList.length}</div>
        <div>已結束巨菇數量：{endedList.length}</div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20,
        marginTop: 20,
      }}>
        {[...activeList, ...endedList].map((item, i) => {
          const left = item.endTime ? item.endTime - tick : null;

          return (
            <div key={item.id}
              style={{
                position:"relative",
                border:"1px solid #ccc",
                padding:"30px 15px 15px",
                borderRadius:10
              }}>

              {/* ✅ 已移除白底 */}
              <div style={{
                position:"absolute",
                top:8,
                right:10,
                fontSize:12,
                padding:"2px 6px",
                borderRadius:5,
                color:"#666"
              }}>
                #{i+1}
              </div>

              <div style={{
                textAlign:"center",
                fontSize:16,
                fontWeight:"bold"
              }}>
                ⏳ {left>0 ? formatCountdown(left) : "已結束"}
              </div>

              <div style={{ fontSize:14, fontWeight:"bold" }}>
                📍 {item.spotName}
              </div>

              <div style={{ fontSize:14 }}>👤 {item.reporter}</div>
              <div style={{ fontSize:14 }}>🧭 {item.coord}</div>
              <div style={{ fontSize:14 }}>📢 {item.megaphone ? "有":"無"}</div>
              <div style={{ fontSize:14 }}>📝 {item.note || "無"}</div>

              <button onClick={()=>handleEdit(item)}>修改</button>
              <button onClick={()=>fb.remove(item.id)}>刪除</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}