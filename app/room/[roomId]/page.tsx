"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
import { useSearchParams } from "next/navigation";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;
  
  // URLの「?admin=true」を読み取る
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get("admin") === "true";

  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState("waiting"); // waiting, reveal, result

  useEffect(() => {
    // 1. 初回のデータ取得（部屋の状態と回答一覧）
    const fetchData = async () => {
      // 部屋の状態を取得
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (roomData) setRoomStatus(roomData.status);
      else if (isAdmin) {
        // 管理者が初めて入った時、部屋データがなければ作成する
        await supabase.from("rooms").insert([{ id: roomId, status: "waiting" }]);
      }

      // 回答を取得
      const { data: ansData } = await supabase.from("answers").select("*").eq("room_id", roomId);
      if (ansData) setAnswers(ansData);
    };

    fetchData();

    // 2. リアルタイム更新（回答の追加と、部屋の状態変更を監視）
    const roomChannel = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, 
        (payload) => setRoomStatus(payload.new.status)
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` }, 
        (payload) => setAnswers((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => { supabase.removeChannel(roomChannel); };
  }, [roomId, isAdmin]);

  // 回答送信
  const submitAnswer = async () => {
    if (!name || !answer) return alert("名前と回答を入力してね");
    setLoading(true);
    await supabase.from("answers").insert([{ room_id: roomId, author_name: name, content: answer }]);
    setLoading(false);
    alert("送信完了！");
    setAnswer("");
  };

  // 【管理者用】部屋の状態を更新する関数
  const updateStatus = async (status: string) => {
    await supabase.from("rooms").update({ status }).eq("id", roomId);
  };

  // シャッフル（表示用）
  const shuffleAnswers = () => {
    setAnswers([...answers].sort(() => Math.random() - 0.5));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen font-serif">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">文芸たほいや</h1>
        <p className="text-sm text-gray-500 italic">Room ID: {roomId} {isAdmin && "(管理者モード)"}</p>
      </header>

      {/* 管理者用コントローラー */}
      {isAdmin && (
        <div className="bg-black text-white p-4 rounded-xl space-y-3">
          <p className="font-bold border-b border-gray-700 pb-1">🔧 運営パネル</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => updateStatus("waiting")} className={`px-3 py-1 rounded ${roomStatus==='waiting'?'bg-blue-600':'bg-gray-700'}`}>1.回答受付中</button>
            <button onClick={() => { updateStatus("reveal"); shuffleAnswers(); }} className={`px-3 py-1 rounded ${roomStatus==='reveal'?'bg-blue-600':'bg-gray-700'}`}>2.回答を一覧表示（匿名）</button>
            <button onClick={() => updateStatus("result")} className={`px-3 py-1 rounded ${roomStatus==='result'?'bg-blue-600':'bg-gray-700'}`}>3.正解発表（名前公開）</button>
          </div>
        </div>
      )}

      {/* 1. 回答入力フェーズ */}
      {roomStatus === "waiting" && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-blue-500">
          <h2 className="text-xl font-bold mb-4">✍️ あなたの回答を投稿</h2>
          <div className="space-y-4">
            <input type="text" placeholder="あなたの名前" className="w-full border p-3 rounded-lg" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="小説の書き出しを考えて..." className="w-full border p-3 rounded-lg h-32" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
            <button onClick={submitAnswer} disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold">
              {loading ? "送信中..." : "回答を送信する"}
            </button>
          </div>
        </div>
      )}

      {/* 2. 一覧表示フェーズ（匿名 or 名前あり） */}
      {(roomStatus === "reveal" || roomStatus === "result") && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">ーー 届いた回答 ーー</h2>
          <div className="grid gap-4">
            {answers.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-lg shadow border-l-4 border-gray-800">
                <p className="text-lg leading-relaxed">{item.content}</p>
                {roomStatus === "result" && (
                  <p className="text-right text-blue-600 font-bold mt-2">ー {item.author_name}</p>
                )}
              </div>
            ))}
          </div>
          {answers.length === 0 && <p className="text-center text-gray-400">まだ回答がありません</p>}
        </div>
      )}
    </div>
  );
}