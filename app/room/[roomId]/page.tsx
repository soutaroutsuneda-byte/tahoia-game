"use client";

import { useState, useEffect, use } from "react";
import { supabase } from "../../lib/supabase";
export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  
  // 回答を保存するリスト
  const [answers, setAnswers] = useState<any[]>([]);
  const [isShuffled, setIsShuffled] = useState(false);

  // --- 1. 最初にデータを読み込み ＆ リアルタイム監視 ---
  useEffect(() => {
    // 既存の回答を取得
    const fetchAnswers = async () => {
      const { data } = await supabase
        .from("answers")
        .select("*")
        .eq("room_id", roomId);
      if (data) setAnswers(data);
    };

    fetchAnswers();

    // 誰かが投稿した瞬間にリストを更新する（リアルタイム機能）
    const channel = supabase
      .channel("realtime-answers")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "answers", filter: `room_id=eq.${roomId}` },
        (payload) => {
          setAnswers((current) => [...current, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // --- 2. 送信処理 ---
  const submitAnswer = async () => {
    if (!name || !answer) return alert("名前と回答を入れてね！");
    setLoading(true);
    const { error } = await supabase.from("answers").insert([
      { room_id: roomId, author_name: name, content: answer },
    ]);
    setLoading(false);
    if (error) alert(error.message);
    else {
      setAnswer("");
      alert("送信完了！");
    }
  };

  // --- 3. シャッフル処理（匿名にする） ---
  const handleShuffle = () => {
    // Fisher-Yates アルゴリズムでバラバラにする
    const shuffled = [...answers].sort(() => Math.random() - 0.5);
    setAnswers(shuffled);
    setIsShuffled(true);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-orange-50 min-h-screen">
      <h1 className="text-4xl font-serif font-bold text-center text-gray-800">文芸たほいや</h1>

      {/* 投稿フォーム */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-orange-200">
        <h2 className="text-lg font-bold mb-4">✍️ 回答を投稿する</h2>
        <div className="space-y-4">
          <input
            type="text"
            className="w-full border-2 p-3 rounded-xl outline-none focus:border-orange-400 transition"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="あなたの名前"
          />
          <textarea
            className="w-full border-2 p-3 rounded-xl h-24 outline-none focus:border-orange-400 transition"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="本物っぽい書き出しを考えてください..."
          />
          <button
            onClick={submitAnswer}
            disabled={loading}
            className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold hover:bg-orange-700 disabled:bg-gray-300 transition"
          >
            {loading ? "送信中..." : "回答を送信！"}
          </button>
        </div>
      </div>

      {/* 回答一覧表示 */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-700">📚 届いた回答 ({answers.length}件)</h2>
          <button
            onClick={handleShuffle}
            className="bg-black text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-800 transition"
          >
            ランダムに並べ替える
          </button>
        </div>

        <div className="grid gap-4">
          {answers.map((item, index) => (
            <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border-l-8 border-orange-400">
              <p className="text-lg leading-relaxed text-gray-800">
                {item.content}
              </p>
              {/* シャッフル前は名前を出す、シャッフル後は名前を隠す（匿名性） */}
              {!isShuffled && (
                <p className="text-sm text-gray-400 mt-2 text-right">— {item.author_name}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-gray-400 text-xs mt-10">Room ID: {roomId}</p>
    </div>
  );
}