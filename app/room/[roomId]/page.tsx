"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link"; // リンク用

type PageProps = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function RoomPage(props: PageProps) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const roomId = params.roomId;
  const isAdmin = searchParams.admin === "true";

  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [voted, setVoted] = useState(false); // 自分が投票したか

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (roomData) {
        setRoomStatus(roomData.status);
        setCorrectId(roomData.correct_answer_id);
      } else if (isAdmin) {
        await supabase.from("rooms").insert([{ id: roomId, status: "waiting" }]);
      }

      const { data: ansData } = await supabase.from("answers").select("*").eq("room_id", roomId);
      if (ansData) setAnswers(ansData);
    };

    fetchData();

    const channel = supabase.channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, 
        (payload: any) => {
          setRoomStatus(payload.new.status);
          setCorrectId(payload.new.correct_answer_id);
        }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` }, 
        () => {
          // 回答や投票に変更があったら再取得
          supabase.from("answers").select("*").eq("room_id", roomId).then(({ data }) => {
            if (data) setAnswers(data);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, isAdmin]);

  const submitAnswer = async () => {
    if (!name || !answer) return alert("名前と回答を入力してね");
    setLoading(true);
    await supabase.from("answers").insert([{ room_id: roomId, author_name: name, content: answer, votes: 0 }]);
    setLoading(false);
    alert("送信完了！");
    setAnswer("");
  };

  const updateStatus = async (status: string) => {
    await supabase.from("rooms").update({ status }).eq("id", roomId);
  };

  const setCorrectAnswer = async (id: string) => {
    await supabase.from("rooms").update({ correct_answer_id: id }).eq("id", roomId);
    alert("正解を設定しました！");
  };

  const handleVote = async (id: string, currentVotes: number) => {
    if (voted) return alert("投票は一人一回までです！");
    const { error } = await supabase.from("answers").update({ votes: currentVotes + 1 }).eq("id", id);
    if (!error) setVoted(true);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-8 bg-orange-50 min-h-screen font-serif text-gray-800">
      <header className="text-center">
        <h1 className="text-4xl font-bold mb-2">文芸たほいや</h1>
        <p className="text-sm text-gray-500 italic font-sans">Room ID: {roomId}</p>
      </header>

      {isAdmin && (
        <div className="bg-black text-white p-6 rounded-2xl space-y-4 shadow-2xl">
          <div className="flex justify-between items-start border-b border-gray-700 pb-4">
            <div>
              <p className="font-bold text-orange-400">🔧 運営パネル</p>
              <Link href="/" className="text-xs text-blue-400 underline mt-1 block">← 新しいゲームを始める（トップへ）</Link>
            </div>
            <div className="bg-white p-1 rounded-lg">
              <QRCodeCanvas value={typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}` : ""} size={70} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-xs">
            <button onClick={() => updateStatus("waiting")} className={`p-2 rounded font-bold ${roomStatus==='waiting'?'bg-orange-600':'bg-gray-800'}`}>1.回答受付</button>
            <button onClick={() => updateStatus("reveal")} className={`p-2 rounded font-bold ${roomStatus==='reveal'?'bg-orange-600':'bg-gray-800'}`}>2.投票開始</button>
            <button onClick={() => updateStatus("result")} className={`p-2 rounded font-bold ${roomStatus==='result'?'bg-orange-600':'bg-gray-800'}`}>3.正解発表</button>
          </div>
          <p className="text-[10px] text-gray-400 text-center italic">「正解発表」の前に、一覧から正解の横の「★」を押してください</p>
        </div>
      )}

      {roomStatus === "waiting" && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border-2 border-orange-200">
          <h2 className="text-2xl font-bold mb-6 text-center">✍️ 回答を投稿する</h2>
          <div className="space-y-4">
            <input type="text" placeholder="名前" className="w-full border-2 p-3 rounded-xl outline-none" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="小説の書き出し..." className="w-full border-2 p-3 rounded-xl h-32 outline-none" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
            <button onClick={submitAnswer} disabled={loading} className="w-full bg-orange-600 text-white p-4 rounded-xl font-bold shadow-lg">
              {loading ? "送信中..." : "回答を送信"}
            </button>
          </div>
        </div>
      )}

      {(roomStatus === "reveal" || roomStatus === "result") && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center border-b-2 border-orange-200 pb-2">
            {roomStatus === "reveal" ? "🔍 どれが本物？" : "🎊 結果発表"}
          </h2>
          <div className="grid gap-6">
            {answers.map((item, index) => {
              const isCorrect = item.id === correctId;
              return (
                <div key={index} className={`relative p-6 rounded-2xl shadow-md border-l-8 transition-all duration-500 ${
                  roomStatus === "result" && isCorrect ? "bg-green-50 border-green-500 scale-105 ring-4 ring-green-200" : "bg-white border-gray-800"
                }`}>
                  <p className="text-lg leading-relaxed">{item.content}</p>
                  
                  <div className="mt-4 flex justify-between items-center">
                    {/* 投票ボタン（一覧表示中のみ） */}
                    {roomStatus === "reveal" && !isAdmin && (
                      <button 
                        onClick={() => handleVote(item.id, item.votes || 0)}
                        disabled={voted}
                        className={`text-sm px-4 py-1 rounded-full border-2 transition ${voted ? 'bg-gray-100 text-gray-400 border-gray-200' : 'border-orange-500 text-orange-600 hover:bg-orange-50'}`}
                      >
                        {voted ? "投票済み" : "これが本物！"}
                      </button>
                    )}

                    {/* 管理者用：正解設定ボタン */}
                    {isAdmin && roomStatus === "reveal" && (
                      <button onClick={() => setCorrectAnswer(item.id)} className={`text-[10px] px-2 py-1 rounded ${isCorrect ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                        {isCorrect ? "★ 正解に設定済み" : "これを正解に設定"}
                      </button>
                    )}

                    {/* 結果表示（名前と投票数） */}
                    {roomStatus === "result" && (
                      <div className="w-full flex justify-between items-end">
                        <span className="text-orange-600 font-bold bg-orange-100 px-3 py-1 rounded-lg text-sm">票数: {item.votes || 0}</span>
                        <span className="text-gray-500 font-bold">— {item.author_name} {isCorrect && " (正解)"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}