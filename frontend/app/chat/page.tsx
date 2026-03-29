"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { sendChat, sendFollowUp } from "@/lib/api";
import ChatBubble from "@/components/ChatBubble";
import { Send, LayoutDashboard, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = { role: "user" | "assistant"; content: string };

// Maps LLM-generated persona names to friendly explanations shown in chat
const PERSONA_EXPLANATIONS: Record<string, string> = {
  "impulse spender": `🛍️ **You've been classified as an Impulse Spender.**\n\nThis means your transactions show frequent small, unplanned purchases — things like late-night Swiggy orders, weekend splurges, or random UPI payments that individually feel harmless but collectively drain your savings. Your spending is emotional and reactive rather than planned.\n\n💡 The good news? Just becoming aware of triggers is half the battle. Small habit shifts here create massive FIRE gains over time.`,
  "subscription collector": `📱 **You've been classified as a Subscription Collector.**\n\nYour statement shows multiple recurring small charges — streaming services, app subscriptions, premium plans — spread across months. These "set and forget" debits are the sneakiest drain on a budget because each one feels cheap individually, but together they compound into a significant monthly leak.\n\n💡 Cutting even 2-3 of these and redirecting that amount into a SIP can meaningfully shift your FIRE probability.`,
  "social spender": `👥 **You've been classified as a Social Spender.**\n\nYour money flows heavily around people — splitting bills, sending money to friends, eating out, events, and experiences. Your financial life is deeply social, which makes it hard to say no in the moment.\n\n💡 This isn't a bad thing — experiences have real value! The fix is building an "experience budget" so social spending becomes intentional, not a leakage.`,
  "default": `🧠 **Your Financial Persona has been mapped.**\n\nOur Detective Agent analyzed your transaction patterns across merchants, amounts, and timing to assign this profile. It reflects where your money goes instinctively — the unconscious habits behind your numbers.\n\n💡 Understanding your persona is the first step. Your 6-month roadmap has been calibrated specifically around it.`,
};

function getPersonaExplanation(persona: string): string {
  const lower = persona.toLowerCase().replace(/[*"]/g, "").trim();
  for (const key of Object.keys(PERSONA_EXPLANATIONS)) {
    if (lower.includes(key)) return PERSONA_EXPLANATIONS[key];
  }
  return PERSONA_EXPLANATIONS["default"].replace(
    "Your Financial Persona has been mapped.",
    `You've been classified as: **${persona}**`
  );
}

const MESSAGES_KEY = "dhan_i_messages";

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Restore messages from sessionStorage on mount ──────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(MESSAGES_KEY);
    const rawText = sessionStorage.getItem("dhan_i_raw_text");

    if (rawText) {
      // Fresh file upload — clear old messages and run analysis
      sessionStorage.removeItem(MESSAGES_KEY);
      runInitialAnalysis(rawText);
    } else if (saved) {
      // Returning from dashboard — restore previous conversation
      setMessages(JSON.parse(saved));
    }
  }, []);

  // ── Persist messages every time they change ──────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // ── Auto-scroll ──────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const addMessages = (msgs: Message[]) =>
    setMessages(prev => [...prev, ...msgs]);

  async function runInitialAnalysis(rawText: string) {
    setIsLoading(true);
    setMessages([{ role: "assistant", content: "Analyzing your statements now to map your financial DNA... Give me a few seconds! 🕵️" }]);

    try {
      const res = await sendChat("Build my holistic financial profile and roadmap.", { raw_text: rawText });
      sessionStorage.setItem("dhan_i_state", JSON.stringify(res));

      const persona = res.full_state?.user_persona || "";
      const personaExplanation = getPersonaExplanation(persona);

      setMessages([
        { role: "assistant", content: "Analysis complete! 🚀" },
        { role: "assistant", content: personaExplanation },
        { role: "assistant", content: res.final_response || "Your roadmap is ready — check the Dashboard!" },
      ]);
    } catch (e) {
      addMessages([{ role: "assistant", content: "Sorry, the multi-agent analysis faced an error. Please try again." }]);
    } finally {
      setIsLoading(false);
      sessionStorage.removeItem("dhan_i_raw_text");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const query = input;
    addMessages([{ role: "user", content: query }]);
    setInput("");
    setIsLoading(true);

    try {
      const cachedStateStr = sessionStorage.getItem("dhan_i_state");
      const cachedState = cachedStateStr ? JSON.parse(cachedStateStr).full_state : {};
      const res = await sendFollowUp(query, cachedState);
      addMessages([{ role: "assistant", content: res.final_response }]);
    } catch (err) {
      addMessages([{ role: "assistant", content: "I'm having trouble connecting right now. Try again in a moment!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-900 text-neutral-100 font-sans">
      <header className="p-4 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center z-10">
        <h1 className="text-2xl font-black bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">Dhan-I</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:opacity-90 px-4 py-2 rounded-lg font-medium transition shadow-lg shadow-emerald-900/40"
        >
          <LayoutDashboard size={18} />
          <span>View Dashboard</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 max-w-5xl mx-auto w-full" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-neutral-800 px-5 py-4 rounded-2xl rounded-tl-sm w-16 flex justify-center border border-neutral-700/50">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="p-4 bg-neutral-950 border-t border-neutral-800">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask your Cognitive Twin about your financial future..."
            className="flex-1 bg-neutral-800 rounded-full px-6 py-4 outline-none focus:ring-2 ring-emerald-500/50 transition placeholder:text-neutral-500 shadow-inner"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 p-4 rounded-full transition shadow-lg"
          >
            <Send size={20} className="ml-0.5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
