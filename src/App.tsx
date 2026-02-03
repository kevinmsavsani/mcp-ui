import { useState, useEffect, useRef } from "react";
import { Settings, Send, Server, Zap, Shield, Cpu, Calculator } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    toolCount?: number;
}

export default function App() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "bot",
            content: "Hello! I'm your MCP Orchestrator. I automatically route your requests through the best available servers. How can I help you today?",
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [servers, setServers] = useState<Record<string, ServerStatus>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const BACKEND_URL = "/api"; // Using proxy from vite.config.ts

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch(`${BACKEND_URL}/servers`);
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
            const response = await fetch(`${BACKEND_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input
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

    const getServerIcon = (name: string) => {
        if (name.includes('calculator')) return <Calculator size={16} />;
        if (name.includes('github')) return <Shield size={16} />;
        if (name.includes('atlassian')) return <Server size={16} />;
        return <Cpu size={16} />;
    };

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>MCP Orchestrator</h2>
                </div>

                <div className="server-list">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Server size={14} /> CONNECTED SERVERS
                    </p>
                    {Object.entries(servers).map(([name, status]) => (
                        <div
                            key={name}
                            className="server-item"
                            style={{ cursor: 'default' }}
                        >
                            <div className="server-name">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {getServerIcon(name)}
                                    {name}
                                </span>
                                <div className={`status-indicator ${status.connected ? 'status-online' : 'status-offline'}`} />
                            </div>
                            <div className="server-type">
                                {status.type} {status.toolCount !== undefined && `• ${status.toolCount} tools`}
                            </div>
                        </div>
                    ))}
                    {Object.keys(servers).length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Trying to connect to backend...</p>
                    )}
                </div>

                <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <Settings size={18} />
                        <span>Settings</span>
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="main-chat">
                <header className="chat-header">
                    <div>
                        <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Zap size={18} color="var(--accent-color)" />
                            Intelligent Routing
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Automatically selecting the best server for your query
                        </p>
                    </div>
                </header>

                <div className="messages-container">
                    {messages.map((msg, i) => (
                        <div key={i} className={`message message-${msg.role}`}>
                            <div className="message-content markdown-content">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            {msg.server && (
                                <div className="message-meta">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {getServerIcon(msg.server)} {msg.server}
                                    </span>
                                    {msg.tool && <span>🛠️ {msg.tool}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                    {loading && (
                        <div className="message message-bot" style={{ opacity: 0.7 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div className="typing-dot"></div>
                                <span>Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="input-container">
                    <form onSubmit={handleSend} className="input-wrapper">
                        <input
                            type="text"
                            placeholder="Ask anything... (e.g. 'add 5 and 3' or 'calculate 10 * 20')"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading || !input.trim()}>
                            {loading ? <Cpu size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </form>
                </div>
            </main>

            <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .typing-dot {
          width: 4px;
          height: 4px;
          background: var(--text-secondary);
          border-radius: 50%;
          animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
          from { opacity: 0.2; }
          to { opacity: 1; }
        }
      `}</style>
        </div>
    );
}
