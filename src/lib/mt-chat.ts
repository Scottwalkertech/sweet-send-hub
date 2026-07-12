// Supabase-backed live chat between customers and admin operators.
// Requires a `chat_messages` table on the external Supabase project — see
// the SQL migration provided alongside this feature.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/external-supabase";

export type ChatSender = "user" | "admin";

export type DbChatMessage = {
  id: string;
  thread_user_id: string;
  sender: ChatSender;
  body: string;
  created_at: string;
};

export type ChatThreadSummary = {
  thread_user_id: string;
  last_body: string;
  last_sender: ChatSender;
  last_at: string;
  unread_admin: number; // customer messages the admin has not yet answered after
};

// -- Single thread (customer view + admin conversation pane) -----------------
export function useChatThread(threadUserId: string | null | undefined) {
  const [messages, setMessages] = useState<DbChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!threadUserId) { setMessages([]); setLoading(false); return; }
    const { data, error } = await supabase
      .from("chat_messages" as never)
      .select("*")
      .eq("thread_user_id", threadUserId)
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setMessages((data ?? []) as unknown as DbChatMessage[]);
    setLoading(false);
  }, [threadUserId]);

  useEffect(() => {
    load();
    if (!threadUserId) return;
    const channel = supabase
      .channel(`chat:${threadUserId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `thread_user_id=eq.${threadUserId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadUserId, load]);

  return { messages, loading, error, refresh: load };
}

export async function sendChatMessage(threadUserId: string, sender: ChatSender, body: string) {
  const text = body.trim();
  if (!text) return;
  const { error } = await supabase
    .from("chat_messages" as never)
    .insert({ thread_user_id: threadUserId, sender, body: text } as never);
  if (error) throw error;
}

// -- Admin: index of all threads with last-message previews ------------------
export function useAllChatThreads(enabled: boolean) {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) { setError(error.message); setLoading(false); return; }
    const rows = (data ?? []) as unknown as DbChatMessage[];
    const map = new Map<string, ChatThreadSummary>();
    for (const m of rows) {
      const cur = map.get(m.thread_user_id);
      if (!cur) {
        map.set(m.thread_user_id, {
          thread_user_id: m.thread_user_id,
          last_body: m.body,
          last_sender: m.sender,
          last_at: m.created_at,
          unread_admin: m.sender === "user" ? 1 : 0,
        });
      } else if (m.sender === "user" && cur.last_sender === "user") {
        cur.unread_admin += 1;
      }
    }
    setThreads(Array.from(map.values()).sort((a, b) => b.last_at.localeCompare(a.last_at)));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const channel = supabase
      .channel(`chat-index:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled, load]);

  return { threads, loading, error, refresh: load };
}

export async function deleteChatThread(threadUserId: string) {
  await supabase.from("chat_messages" as never).delete().eq("thread_user_id", threadUserId);
}
