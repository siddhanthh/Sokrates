import Link from 'next/link';

export default function Home() {
  const categories = [
    { name: 'Philosophy & Logic', icon: '🧠', slug: 'philosophy' },
    { name: 'Ethics & Morality', icon: '⚖️', slug: 'ethics' },
    { name: 'Epistemology & Knowledge', icon: '🔍', slug: 'epistemology' },
    { name: 'Metaphysics & Existence', icon: '🌌', slug: 'metaphysics' },
    { name: 'Political Philosophy', icon: '🏛️', slug: 'political-theory' },
    { name: 'AI & Consciousness', icon: '🤖', slug: 'ai-ethics' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Sokrates
            </span>
            <span className="text-xs uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              v0.1.0 Scaffolding
            </span>
          </div>

          <nav className="flex items-center space-x-6">
            <Link href="/feed" className="text-sm font-medium text-slate-300 hover:text-white transition">
              Feed
            </Link>
            <Link href="/topics" className="text-sm font-medium text-slate-300 hover:text-white transition">
              Topics
            </Link>
            <Link href="/debates" className="text-sm font-medium text-slate-300 hover:text-white transition">
              Public Debates
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-16 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-time Semantic Matchmaking Powered by pgvector & Gemini</span>
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight text-white leading-tight">
            Engage in Meaningful <br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Intellectual Dialogue
            </span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed">
            Sokrates connects curious minds for 1-on-1 debates and group discussions matching your exact intellectual profile.
            Enhanced with real-time AI conversation partners, post-chat digests, and interactive argument maps.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/register"
              className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition shadow-lg shadow-amber-500/20"
            >
              Start Discussing
            </Link>
            <Link
              href="/topics"
              className="px-6 py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium transition"
            >
              Browse 20+ Topics
            </Link>
          </div>
        </div>

        {/* Intellectual Categories */}
        <div className="mt-20">
          <h2 className="text-center text-xs uppercase tracking-widest text-slate-500 font-semibold mb-6">
            Featured Intellectual Domains
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.slug}
                className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 hover:border-amber-500/40 hover:bg-slate-900 transition text-center group cursor-pointer"
              >
                <span className="text-3xl mb-2 group-hover:scale-110 transition duration-200">{cat.icon}</span>
                <span className="text-xs font-medium text-slate-300 group-hover:text-amber-400 transition">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg">
              01
            </div>
            <h3 className="text-lg font-bold text-white">Semantic 1-on-1 Matchmaking</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Match with peers based on 768-dimensional interest vector embeddings using PostgreSQL pgvector HNSW indexing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg">
              02
            </div>
            <h3 className="text-lg font-bold text-white">Real-Time AI Partner Fallback</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              If no human match is available within 30 seconds, Groq LPU streams tokens over WebSockets for continuous intellectual debate.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-lg">
              03
            </div>
            <h3 className="text-lg font-bold text-white">AI Argument Maps & Digests</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transform discussions into structured React Flow node graph argument maps and 3-sentence stance digests.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>© 2026 Sokrates Project. Built for deep human connection and intellectual discovery.</div>
          <div className="flex space-x-6">
            <Link href="/privacy" className="hover:text-slate-400 transition">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-400 transition">Terms</Link>
            <Link href="/api/health" className="hover:text-slate-400 transition">System Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
