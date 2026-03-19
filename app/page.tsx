"use client";
import { useRouter } from "next/navigation";

export default function Lobby() {
  const router = useRouter();

  const createRoom = () => {
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    router.push(`/room/${newRoomId}?admin=true`);
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 font-serif text-gray-800">
      <div className="bg-white p-12 rounded-3xl shadow-2xl border-2 border-orange-200 text-center max-w-md w-full">
        {/* タイトル下の文言を消し、余白を調整しました */}
        <h1 className="text-5xl font-bold mb-12">文芸たほいや</h1>
        
        <div className="space-y-6">
          <button
            onClick={createRoom}
            className="w-full bg-orange-600 text-white p-6 rounded-2xl text-2xl font-bold shadow-lg hover:bg-orange-700 transition-all active:scale-95"
          >
            新しくゲームを始める
          </button>

          <p className="text-sm text-gray-400">
            ボタンを押すと、新しいルームIDが自動生成され、<br />
            管理画面へ移動します。
          </p>
        </div>
      </div>

      <footer className="fixed bottom-4 right-4 opacity-20 hover:opacity-100 transition">
        <button onClick={() => {
          const id = prompt("入室するルームIDを入れてください");
          if(id) router.push(`/room/${id}?admin=true`);
        }} className="text-xs text-gray-400 underline italic">Admin Login</button>
      </footer>
    </div>
  );
}