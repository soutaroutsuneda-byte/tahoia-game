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
        <h1 className="text-5xl font-bold mb-4">文芸たほいや</h1>
        <p className="text-gray-500 mb-10 italic">ー 文化祭専用システム ー</p>
        <button
          onClick={createRoom}
          className="w-full bg-orange-600 text-white p-6 rounded-2xl text-2xl font-bold shadow-lg hover:bg-orange-700 transition-all active:scale-95"
        >
          新しくゲームを始める
        </button>
      </div>
    </div>
  );
}