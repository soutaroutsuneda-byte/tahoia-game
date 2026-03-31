"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
import { QRCodeCanvas } from "qrcode.react";
import Link from "next/link";

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
  const [votes, setVotes] = useState<any[]>([]); // 投票データを保存
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [correctId, setCorrectId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      // 部屋情報
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (roomData) {
        setRoomStatus(roomData.status);
        setCorrectId(roomData.correct_answer_id);
      } else if (isAdmin) {
        await supabase.from("rooms").insert([{ id: roomId, status: "waiting" }]);
      }

      // 回答一覧
      const { data: ansData } = await supabase.from("answers").select("*").eq("room_id", roomId);
      if (ansData) setAnswers(ansData);

      // 投票一覧
      const { data: voteData } = await supabase.from("votes").select("*").eq("room_id", roomId);
      if (voteData) setVotes(voteData);
    };

    fetchData();

    // リアルタイム更新の監視
    const channel = supabase.channel(`room-realtime-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (p: any) => {
        setRoomStatus(p.new.status);
        setCorrectId(p.new.correct_answer_id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` }, async () => {
        const { data } = await supabase.from("answers").select("*").eq("room_id", roomId);
        if (data) setAnswers(data);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` }, async () => {
        const { data } = await supabase.from("votes").select("*").eq("room_id", roomId);
        if (data) setVotes(data);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, isAdmin]);

  const submitAnswer = async () => {
    if (!name || !answer) return alert("名前と回答を入れてね！");
    setLoading(true);
    await supabase.from("answers").insert([{ room_id: roomId, author_name: name, content: answer }]);
    setLoading(false);
    alert("送信完了！");
    setAnswer("");
  };

  const handleVote = async (answerId: string) => {
    if (!name) return alert("投票者の名前（あなたの名前）を入力してください");
    if (hasVoted) return alert("投票は一人一回です！");
    
    const { error } = await supabase.from("votes").insert([
      { room_id: roomId, answer_id: answerId, voter_name: name }
    ]);
    if (!error) {
      setHasVoted(true);
      alert("投票しました！");
    }
  };

  const updateStatus = async (status: string) => {
    await supabase.from("rooms").update({ status }).eq("id", roomId);
  };

  const setCorrectAnswer = async (id: string) => {
    await supabase.from("rooms").update({ correct_answer_id: id }).eq("id", roomId);
    alert("正解を設定しました！");
  };

  // ...（前略：useStateやuseEffectはそのまま）...

return (
  /* 
     一番外側のdiv: PCでは画面全体の背景をグレー(bg-gray-200)にし、
     中身を中央寄せ(flex justify-center)にします。
  */
  <div className="min-h-screen bg-gray-200 flex justify-center">
    
    {/* 
       スマホ画面風のコンテナ: 
       横幅を最大375pxに固定(max-w-[375px] w-full)
       背景をいつものオレンジ(bg-orange-50)
       PCでは影をつけて浮き上がらせる(shadow-2xl)
    */}
    <div className="w-full max-w-[375px] min-h-screen bg-orange-50 shadow-2xl flex flex-col font-serif text-gray-800 relative overflow-x-hidden">
      
      {/* 
         スクロール領域: 
         スマホ画面の中でスクロールするようにします
      */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 pb-20">
        
        <header className="text-center pt-4">
          <h1 className="text-4xl font-bold mb-2">文芸たほいや</h1>
          <p className="text-[10px] text-gray-500 font-sans tracking-widest uppercase">Room ID: {roomId}</p>
        </header>

        {/* 🚀 運営パネル（中身は以前と同じ） */}
        {isAdmin && (
          <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-4 shadow-xl border-2 border-slate-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-yellow-400 text-sm">👑 運営パネル</p>
                <Link href="/" className="text-[10px] text-blue-300 underline mt-2 block">← 新しいゲームを始める</Link>
              </div>
              <div className="bg-white p-1 rounded-lg shadow-inner">
                <QRCodeCanvas value={typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}` : ""} size={60} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button onClick={() => updateStatus("waiting")} className={`py-2 rounded-lg text-[10px] font-bold ${roomStatus==='waiting'?'bg-yellow-600':'bg-slate-700'}`}>1.受付</button>
              <button onClick={() => updateStatus("reveal")} className={`py-2 rounded-lg text-[10px] font-bold ${roomStatus==='reveal'?'bg-yellow-600':'bg-slate-700'}`}>2.投票</button>
              <button onClick={() => updateStatus("result")} className={`py-2 rounded-lg text-[10px] font-bold ${roomStatus==='result'?'bg-yellow-600':'bg-slate-700'}`}>3.発表</button>
            </div>
          </div>
        )}

        {/* --- 以降、waiting/reveal/result の中身は以前と同じ --- */}
        {/* （ただし、余白や文字サイズを 375px に合わせて微調整しています） */}

        {roomStatus === "waiting" && (
          <div className="bg-white p-6 rounded-3xl shadow-lg border-b-4 border-orange-200">
            <h2 className="text-xl font-bold mb-4 text-center">✍️ 回答投稿</h2>
            <div className="space-y-4">
              <input type="text" placeholder="あなたの名前" className="w-full border-2 p-3 rounded-2xl text-sm outline-none focus:border-orange-400" value={name} onChange={(e)=>setName(e.target.value)} />
              <textarea placeholder="書き出しを入力..." className="w-full border-2 p-3 rounded-2xl h-32 text-sm outline-none focus:border-orange-400" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
              <button onClick={submitAnswer} disabled={loading} className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-md active:scale-95 transition-all text-sm">送信する</button>
            </div>
          </div>
        )}

        {(roomStatus === "reveal" || roomStatus === "result") && (
          <div className="space-y-6">
            {roomStatus === "reveal" && (
              <div className="bg-white p-4 rounded-2xl shadow border-2 border-orange-300">
                <p className="text-xs font-bold mb-2">投票者の名前：</p>
                <input type="text" placeholder="名前を入れて投票" className="w-full border p-2 rounded-lg text-sm" value={name} onChange={(e)=>setName(e.target.value)} />
              </div>
            )}

            <div className="grid gap-4">
              {answers.map((item) => {
                const isCorrect = String(item.id) === String(correctId);
                const itemVotes = votes.filter(v => String(v.answer_id) === String(item.id));
                
                return (
                  <div key={item.id} className={`relative p-5 rounded-2xl transition-all duration-700 border-2 ${
                    roomStatus === "result" && isCorrect 
                      ? "bg-yellow-50 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.4)] scale-105 animate-pulse" 
                      : "bg-white border-gray-100 shadow-sm"
                  }`}>
                    <p className="text-md leading-relaxed font-medium">{item.content}</p>
                    
                    {roomStatus === "reveal" && (
                      <div className="mt-4 flex justify-between items-center">
                        {!isAdmin && (
                          <button onClick={() => handleVote(item.id)} disabled={hasVoted} className={`px-4 py-1.5 rounded-full font-bold text-[10px] transition-all ${hasVoted ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                            {hasVoted ? "投票済" : "これが本物！"}
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => setCorrectAnswer(item.id)} className={`text-[10px] p-1.5 rounded ${isCorrect ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}>
                            {isCorrect ? "★正解" : "正解に設定"}
                          </button>
                        )}
                      </div>
                    )}

                    {roomStatus === "result" && (
                      <div className="mt-4 pt-3 border-t border-dashed border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCorrect ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                            得票: {itemVotes.length}
                          </span>
                          <span className="text-[11px] font-bold text-orange-600 truncate max-w-[150px]">✍️ {item.author_name}</span>
                        </div>
                        {itemVotes.length > 0 && (
                          <div className="text-[9px] text-gray-400 italic leading-tight">
                            投票者: {itemVotes.map(v => v.voter_name).join(", ")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);


      {roomStatus === "waiting" && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border-b-8 border-orange-200">
          <h2 className="text-2xl font-bold mb-6 text-center">✍️ 回答投稿</h2>
          <div className="space-y-4">
            <input type="text" placeholder="あなたの名前" className="w-full border-2 p-3 rounded-2xl outline-none focus:border-orange-400" value={name} onChange={(e)=>setName(e.target.value)} />
            <textarea placeholder="書き出しを入力..." className="w-full border-2 p-3 rounded-2xl h-32 outline-none focus:border-orange-400" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
            <button onClick={submitAnswer} disabled={loading} className="w-full bg-orange-600 text-white p-4 rounded-2xl font-bold shadow-lg active:scale-95 transition-all">送信する</button>
          </div>
        </div>
      )}

      {(roomStatus === "reveal" || roomStatus === "result") && (
        <div className="space-y-6">
          {roomStatus === "reveal" && (
            <div className="bg-white p-4 rounded-2xl shadow border-2 border-orange-300 mb-6">
              <p className="text-sm font-bold mb-2">投票者の名前：</p>
              <input type="text" placeholder="名前を入力して投票してね" className="w-full border p-2 rounded-lg" value={name} onChange={(e)=>setName(e.target.value)} />
            </div>
          )}

          <div className="grid gap-6">
            {answers.map((item) => {
              const isCorrect = String(item.id) === String(correctId);
              const itemVotes = votes.filter(v => String(v.answer_id) === String(item.id));
              
              return (
                <div key={item.id} className={`relative p-6 rounded-3xl transition-all duration-700 border-4 ${
                  roomStatus === "result" && isCorrect 
                    ? "bg-yellow-50 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)] scale-105 animate-pulse" 
                    : "bg-white border-gray-100 shadow-md"
                }`}>
                  <p className="text-xl leading-relaxed font-medium">{item.content}</p>
                  
                  {roomStatus === "reveal" && (
                    <div className="mt-4 flex justify-between items-center">
                      {!isAdmin && (
                        <button onClick={() => handleVote(item.id)} disabled={hasVoted} className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${hasVoted ? 'bg-gray-100 text-gray-400' : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'}`}>
                          {hasVoted ? "投票済" : "これが本物だ！"}
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => setCorrectAnswer(item.id)} className={`text-[10px] p-2 rounded ${isCorrect ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}>
                          {isCorrect ? "★正解設定中" : "正解に設定"}
                        </button>
                      )}
                    </div>
                  )}

                  {roomStatus === "result" && (
                    <div className="mt-6 pt-4 border-t border-dashed border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${isCorrect ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          得票数: {itemVotes.length}
                        </span>
                        <span className="text-sm font-bold text-orange-600">✍️ {item.author_name}</span>
                      </div>
                      {itemVotes.length > 0 && (
                        <div className="text-[11px] text-gray-400 italic">
                          投票者: {itemVotes.map(v => v.voter_name).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}