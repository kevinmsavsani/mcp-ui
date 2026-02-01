import { useState, useEffect, useRef } from "react";
import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
    return [
        { title: "MCP Chatbot | Multi-Server Test" },
        { name: "description", content: "Chat with multiple MCP servers seamlessly" },
    ];
};

interface Message {
    role: "user" | "bot";
    content: string;
    server?: string;
    tool?: string;
    timestamp: Date;
}

interface ServerStatus {
    connected: boolean;
    type: string;
}

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([
        { role: "bot", content: "Hello! I'm connected to 3 MCP servers. How can I help you today?", timestamp: new Date() }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [servers, setServers] = useState<Record<string, ServerStatus>>({});
    const [mode, setMode] = useState<"auto" | "manual">("auto");
    const [selectedServer, setSelectedServer] = useState<string>("local-python");

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const BACKEND_URL = "http://localhost:3001"; // Default backend port

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/api/servers`);
                if (res.ok) {
                    const data = await res.json();
                    setServers(data);
                }
            } catch (e) {
                console.error("Failed to fetch server status");
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: "user", content: input, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input,
                    mode: mode,
                    server: selectedServer
                }),
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Failed to get response");

            const botMsg: Message = {
                role: "bot",
                content: Array.isArray(data.response) ? data.response.map((c: any) => c.text).join("\n") : data.response,
                server: data.server,
                tool: data.tool,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error: any) {
            setMessages(prev => [...prev, {
                role: "bot",
                content: `Error: ${error.message}`,
                timestamp: new Date()
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>MCP Orchestrator</h2>
                </div>

                <div className="server-list">
                    <div style={{ marginBottom: '24px' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>ROUTING MODE</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div
                                className={`routing-pill ${mode === 'auto' ? 'active' : ''}`}
                                onClick={() => setMode('auto')}
                            >
                                Auto
                            </div>
                            <div
                                className={`routing-pill ${mode === 'manual' ? 'active' : ''}`}
                                onClick={() => setMode('manual')}
                            >
                                Manual
                            </div>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>CONNECTED SERVERS</p>
                    {Object.entries(servers).map(([name, status]) => (
                        <div
                            key={name}
                            className={`server-item ${mode === 'manual' && selectedServer === name ? 'active' : ''}`}
                            onClick={() => mode === 'manual' && setSelectedServer(name)}
                            style={{ cursor: mode === 'manual' ? 'pointer' : 'default' }}
                        >
                            <div className="server-name">
                                {name}
                                <div className={`status-indicator ${status.connected ? 'status-online' : 'status-offline'}`} />
                            </div>
                            <div className="server-type">{status.type}</div>
                        </div>
                    ))}
                    {Object.keys(servers).length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Trying to connect...</p>
                    )}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="main-chat">
                <header className="chat-header">
                    <div>
                        <h3 style={{ fontSize: '1.1rem' }}>
                            {mode === 'auto' ? 'Intelligent Routing' : `Connected to: ${selectedServer}`}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {mode === 'auto' ? 'Automatically selecting the best server for your query' : 'Direct manual server connection'}
                        </p>
                    </div>
                </header>

                <div className="messages-container">
                    {messages.map((msg, i) => (
                        <div key={i} className={`message message-${msg.role}`}>
                            <div className="message-content">{msg.content}</div>
                            {msg.server && (
                                <div className="message-meta">
                                    <span>🛰️ {msg.server}</span>
                                    {msg.tool && <span>🛠️ {msg.tool}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="message message-bot" style={{ opacity: 0.7 }}>
                            Thinking...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-container">
                    <form onSubmit={handleSend} className="input-wrapper">
                        <input
                            type="text"
                            placeholder="Ask anything... (e.g. Try 'echo hello' for local server)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading || !input.trim()}>
                            {loading ? "..." : "Send"}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
