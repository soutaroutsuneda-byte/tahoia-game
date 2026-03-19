"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
import { QRCodeCanvas } from "qrcode.react"; // ← ファイルの上のほうに追加

// 1. 型の定義（ビルドエラーを防ぐために重要）
type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function RoomPage(props: PageProps) {
  // Next.js 15のルールに基づき、Promiseをアンラップする
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  
  const roomId = params.roomId;
  const isAdmin = searchParams.admin === "true";

  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState("waiting");

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      // 部屋の状態を取得
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (roomData) {
        setRoomStatus(roomData.status);
      } else if (isAdmin) {
        // 管理者が入った時に部屋データがなければ作成
        await supabase.from("rooms").insert([{ id: roomId, status: "waiting" }]);
      }

      // 回答を取得
      const { data: ansData } = await supabase.from("answers").select("*").eq("room_id", roomId);
      if (ansData) setAnswers(ansData);
    };

    fetchData();

    // リアルタイム監視
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

  const submitAnswer = async () => {
    if (!name || !answer) return alert("名前と回答を入力してね");
    setLoading(true);
    await supabase.from("answers").insert([{ room_id: roomId, author_name: name, content: answer }]);
    setLoading(false);
    alert("送信完了！");
    setAnswer("");
  };

  const updateStatus = async (status: string) => {
    await supabase.from("rooms").update({ status }).eq("id", roomId);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen font-serif">
      <header className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">文芸たほいや</h1>
        <p className="text-sm text-gray-500 italic">Room ID: {roomId} {isAdmin && "(管理者モード)"}</p>
      </header>

      {isAdmin && (
  <div className="bg-black text-white p-6 rounded-xl space-y-4 shadow-2xl">
    <div className="flex justify-between items-start">
      <div>
        <p className="font-bold border-b border-gray-700 pb-1 text-orange-400">🔧 運営パネル</p>
        <p className="text-2xl font-mono mt-2">Room ID: {roomId}</p>
      </div>
      
      {/* QRコードを表示！ */}
      <div className="bg-white p-2 rounded-lg">
        <QRCodeCanvas 
          value={`${window.location.origin}/room/${roomId}`} 
          size={100}
        />
      </div>
    </div>

    <div className="flex gap-2 flex-wrap text-xs">
       {/* ...ここには前のボタンたち（updateStatusなど）が入ります... */}
    </div>
    
    <p className="text-[10px] text-gray-500 text-center italic">このQRコードを参加者のスマホで読み取ってもらってください</p>
  </div>
)}

      {roomStatus === "waiting" && (
        <div className="bg-white p-6 rounded-2xl shadow-md border-t-4 border-orange-500">
          <h2 className="text-xl font-bold mb-4">✍️ あなたの回答を投稿</h2>
          <div className="space-y-4">
            <input type="text" placeholder="あなたの名前" className="w-full border-2 p-3 rounded-xl focus:border-orange-500 outline-none" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="小説の書き出しを考えて..." className="w-full border-2 p-3 rounded-xl h-32 focus:border-orange-500 outline-none" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
            <button onClick={submitAnswer} disabled={loading} className="w-full bg-orange-600 text-white p-4 rounded-xl font-bold hover:bg-orange-700 transition">
              {loading ? "送信中..." : "回答を送信する"}
            </button>
          </div>
        </div>
      )}

      {(roomStatus === "reveal" || roomStatus === "result") && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center border-b-2 border-gray-200 pb-4">ーー 届いた回答 ーー</h2>
          <div className="grid gap-6">
            {answers.map((item, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow border-l-8 border-gray-800 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-lg leading-relaxed text-gray-800">{item.content}</p>
                {roomStatus === "result" && (
                  <p className="text-right text-orange-600 font-bold mt-4 pt-2 border-t border-dashed">— {item.author_name}</p>
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