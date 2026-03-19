"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase"; // srcなし構成なので ../../ です
import { QRCodeCanvas } from "qrcode.react";

type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function RoomPage(props: PageProps) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const roomId = params.roomId;
  const isAdmin = searchParams.admin === "true"; // URLに ?admin=true があるか

  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState("waiting");

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      // 1. 部屋の状態を取得（なければ作成）
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (roomData) {
        setRoomStatus(roomData.status);
      } else if (isAdmin) {
        await supabase.from("rooms").insert([{ id: roomId, status: "waiting" }]);
      }

      // 2. 既存の回答を取得
      const { data: ansData } = await supabase.from("answers").select("*").eq("room_id", roomId);
      if (ansData) setAnswers(ansData);
    };

    fetchData();

    // 3. リアルタイム監視（他人の投稿や管理者のボタン操作を即座に反映）
    const channel = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, 
        (payload: any) => setRoomStatus(payload.new.status)
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` }, 
        (payload: any) => setAnswers((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  // 管理者用：状態更新
  const updateStatus = async (status: string) => {
    await supabase.from("rooms").update({ status }).eq("id", roomId);
  };

  // 管理者用：回答をシャッフルして表示順を変える
  const shuffleAnswers = () => {
    setAnswers([...answers].sort(() => Math.random() - 0.5));
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-orange-50 min-h-screen font-serif text-gray-800">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-2">文芸たほいや</h1>
        <p className="text-sm text-gray-500 italic">Room ID: {roomId}</p>
      </header>

      {/* 🚀 運営パネル（isAdminがtrueの時だけ表示） */}
      {isAdmin && (
        <div className="bg-black text-white p-6 rounded-2xl space-y-4 shadow-2xl">
          <div className="flex justify-between items-start border-b border-gray-700 pb-4">
            <div>
              <p className="font-bold text-orange-400">🔧 運営パネル</p>
              <p className="text-xs text-gray-400">参加者にこのQRをスキャンさせてください</p>
            </div>
            <div className="bg-white p-2 rounded-lg">
              <QRCodeCanvas 
                value={typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}` : ""} 
                size={80}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
            <button 
              onClick={() => updateStatus("waiting")} 
              className={`p-3 rounded-lg font-bold transition ${roomStatus==='waiting'?'bg-orange-600':'bg-gray-800 hover:bg-gray-700'}`}
            >
              1.回答受付中
            </button>
            <button 
              onClick={() => { updateStatus("reveal"); shuffleAnswers(); }} 
              className={`p-3 rounded-lg font-bold transition ${roomStatus==='reveal'?'bg-orange-600':'bg-gray-800 hover:bg-gray-700'}`}
            >
              2.回答一覧表示
            </button>
            <button 
              onClick={() => updateStatus("result")} 
              className={`p-3 rounded-lg font-bold transition ${roomStatus==='result'?'bg-orange-600':'bg-gray-800 hover:bg-gray-700'}`}
            >
              3.正解発表
            </button>
          </div>
        </div>
      )}

      {/* 📝 ステップ1：回答入力フォーム */}
      {roomStatus === "waiting" && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-orange-200">
          <h2 className="text-2xl font-bold mb-6 text-center">✍️ 回答を投稿する</h2>
          <div className="space-y-4">
            <input type="text" placeholder="あなたの名前" className="w-full border-2 p-3 rounded-xl focus:border-orange-500 outline-none" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="小説の書き出しを考えて..." className="w-full border-2 p-3 rounded-xl h-32 focus:border-orange-500 outline-none" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
            <button onClick={submitAnswer} disabled={loading} className="w-full bg-orange-600 text-white p-4 rounded-xl font-bold hover:bg-orange-700 shadow-lg active:scale-95 transition-all">
              {loading ? "送信中..." : "回答を送信する"}
            </button>
          </div>
        </div>
      )}

      {/* 📖 ステップ2 & 3：回答一覧表示 */}
      {(roomStatus === "reveal" || roomStatus === "result") && (
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-center border-b-2 border-orange-200 pb-4">届いた回答</h2>
          <div className="grid gap-6">
            {answers.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-2xl shadow-md border-l-8 border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <p className="text-xl leading-relaxed text-gray-800">{item.content}</p>
                {roomStatus === "result" && (
                  <p className="text-right text-orange-600 font-bold mt-4 pt-2 border-t border-dashed border-orange-200">— {item.author_name}</p>
                )}
              </div>
            ))}
          </div>
          {answers.length === 0 && <p className="text-center text-gray-400 py-10">まだ回答が届いていません...</p>}
        </div>
      )}
    </div>
  );
}