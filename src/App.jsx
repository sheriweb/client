import { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import './index.css';
import { postJSON, getJSON, postForm, BASE } from './lib/api';

// Inline icons (small, 16px)
const IHome = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12l9-9 9 9"/><path d="M9 21V9h6v12"/></svg>
);
const ISearch = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
);
const IMap = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3z"/><path d="M8 3v15"/><path d="M16 6v15"/></svg>
);
const IList = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
);
const IUpload = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 15V5"/></svg>
);
const IDashboard = (p)=> (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('search'); // 'url' | 'search' | 'maps' | 'results' | 'dashboard' | 'import'
  const [form, setForm] = useState({ url: '', country: '', category: '', crawlDepth: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Search state
  const [query, setQuery] = useState('real estate in US');
  const [limit, setLimit] = useState(5);
  const [searchResults, setSearchResults] = useState([]);
  // Results state
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(10);
  const [toast, setToast] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichDone, setEnrichDone] = useState(0);
  const [enrichingSet, setEnrichingSet] = useState(new Set());
  const [enrichPool] = useState(12);
  const [themeDark, setThemeDark] = useState(false);
  const [autoEnrichPending, setAutoEnrichPending] = useState(false);
  // Dashboard/Settings local state
  const [statsTotal, setStatsTotal] = useState(0);
  const [recentRows, setRecentRows] = useState([]);
  const [defaultDepth, setDefaultDepth] = useState(1);

  // Maps import state
  const [mapsUrl, setMapsUrl] = useState('');
  const [mapsLimit, setMapsLimit] = useState(50);
  const [mapsIncludeNoWebsite, setMapsIncludeNoWebsite] = useState(true);
  const [mapsRows, setMapsRows] = useState([]);
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const [mapsPage, setMapsPage] = useState(1);
  const [mapsPageSize, setMapsPageSize] = useState(20);
  const [mapsAggressive, setMapsAggressive] = useState(false);

  // Saved search presets (chips)
  const presets = [
    { label: 'Real Estate · US', prompt: 'real estate in US' },
    { label: 'Restaurants · UK', prompt: 'restaurants in UK' },
    { label: 'Hospitals · Pakistan', prompt: 'hospitals in Pakistan' },
    { label: 'Software Companies · UAE', prompt: 'software companies in UAE' },
  ];

  // Results loader (defined before effects that depend on it)
  const loadResults = useCallback(async (p = page, l = pageLimit) => {
    setLoading(true); setError('');
    try {
      const res = await getJSON(`/api/scrape/results?page=${p}&limit=${l}`);
      setRows(res.data || []);
      setTotal(Number(res.total) || 0);
      const nextPage = Number(res.page ?? p) || 1;
      setPage(nextPage);
      // Keep the requested page size to avoid servers that clamp 'limit'
      setPageLimit(l);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageLimit]);

  // Auto-load results when opening Results tab (do not force page=1 on every re-render)
  useEffect(() => {
    if (activeTab === 'results') {
      loadResults(page, pageLimit);
    }
  }, [activeTab, pageLimit]);

  // If auto-enrich was requested after import, trigger once rows are loaded on Results tab
  useEffect(() => {
    if (activeTab !== 'results') return;
    if (!autoEnrichPending) return;
    if (rows.length === 0) return;
    setAutoEnrichPending(false);
    // trigger enrich all but skip already enriched rows
    void enrichAllCurrentPage();
  }, [activeTab, autoEnrichPending, rows.length]);

  // Removed local caching per request: always show live backend data only

  // Theme persistence
  useLayoutEffect(() => {
    const saved = localStorage.getItem('themeDark');
    const initial = saved === null ? false : saved === '1';
    setThemeDark(initial);
    // Reset then apply only on <html>
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    if (initial) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    }
    try { console.log('[theme:init]', { initial, className: document.documentElement.className }); } catch { void 0; }
  }, []);
  useLayoutEffect(() => {
    localStorage.setItem('themeDark', themeDark ? '1' : '0');
    if (themeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeDark]);

  // Load dashboard stats when needed
  const loadStats = useCallback(async () => {
    try {
      const res = await getJSON(`/api/scrape/results?page=1&limit=5`);
      setStatsTotal(res.total || 0);
      setRecentRows(res.data || []);
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadStats();
    }
  }, [activeTab, loadStats]);

  // Settings: load & persist default crawl depth
  useEffect(() => {
    const saved = parseInt(localStorage.getItem('defaultDepth') || '1', 10);
    if (saved === 1 || saved === 2) setDefaultDepth(saved);
  }, []);
  useEffect(() => { localStorage.setItem('defaultDepth', String(defaultDepth)); }, [defaultDepth]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      try { new URL(form.url); } catch { throw new Error('Please enter a valid URL (https://...)'); }
      const res = await postJSON('/api/scrape/url', {
        url: form.url,
        country: form.country || undefined,
        category: form.category || undefined,
        crawlDepth: Number(form.crawlDepth) || 1,
      });
      setResult(res.data);
      setToast('URL scraped and saved');
    } catch (err) {
      setError(err.message);
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSearchResults([]);
    try {
      const res = await postJSON('/api/scrape/search', {
        prompt: query,
        limit: Number(limit) || 5,
        crawlDepth: 1,
      });
      setSearchResults(res.data || []);
      setToast(`Found ${res.count || (res.data || []).length} sites`);
    } catch (err) {
      setError(err.message);
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  // (moved earlier)

  const Tab = ({ id, children }) => (
    <button type="button"
      onClick={() => setActiveTab(id)}
      className={`rounded-full px-3 py-1 text-sm border transition ${
        activeTab === id ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-600 shadow' : 'bg-white text-gray-700 hover:bg-indigo-50'
      }`}
    >{children}</button>
  );

  const Button = ({ children, disabled, ...props }) => (
    <button
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50"
      {...props}
    >
      {disabled && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>}
      {children}
    </button>
  );

  const applyTheme = useCallback((isDark) => {
    // persist first
    try { localStorage.setItem('themeDark', isDark ? '1' : '0'); } catch { void 0; }
    // update DOM immediately
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    // then state
    setThemeDark(isDark);
    try { console.log('[theme:apply]', { isDark, className: document.documentElement.className }); } catch { void 0; }
    setToast(isDark ? 'Dark mode on' : 'Light mode on');
  }, []);

  // Enrich helpers
  const enrichOne = useCallback(async (url, depth = 2) => {
    // mark row as loading
    setEnrichingSet(prev => {
      const n = new Set(prev); n.add(url); return n;
    });
    try {
      const res = await postJSON('/api/scrape/url', { url, crawlDepth: depth });
      setRows(prev => prev.map(x => x.url === url ? { ...x, ...res.data } : x));
    } finally {
      setEnrichingSet(prev => { const n = new Set(prev); n.delete(url); return n; });
    }
  }, []);

  const enrichAllCurrentPage = useCallback(async () => {
    if (enriching) return;
    const targets = rows
      .filter(r => !(Array.isArray(r.emails) && r.emails.length > 0))
      .filter(r => !enrichingSet.has(r.url))
      .map(r => r.url);
    if (targets.length === 0) { setToast('Nothing to enrich'); return; }
    setEnriching(true); setEnrichDone(0); setToast(`Enriching 0/${targets.length}...`);
    try {
      // Add all to loading set upfront so UI shows busy states
      setEnrichingSet(prev => { const n = new Set(prev); targets.forEach(u=>n.add(u)); return n; });
      // Phase 1: quick pass depth=1
      const runPool = async (urls, depth, denom) => {
        const pool = Math.min(enrichPool, urls.length || enrichPool);
        let idx = 0;
        const worker = async () => {
          while (true) {
            const myIndex = idx; idx += 1;
            if (myIndex >= urls.length) break;
            const u = urls[myIndex];
            try { await enrichOne(u, depth); } catch { /* ignore */ }
            setEnrichDone(prev => {
              const n = prev + 1;
              setToast(`Enriching ${n}/${denom}...`);
              return n;
            });
          }
        };
        await Promise.all(Array.from({length: pool}, () => worker()));
      };
      setEnrichDone(0);
      // We'll compute denom after phase 1 refresh to include both phases accurately
      await runPool(targets, 1, targets.length);
      // Refresh current page rows so we compute remaining accurately after phase 1
      try { await loadResults(page, pageLimit); } catch { /* ignore */ }
      // Phase 2: only remaining rows without emails, depth=2
      const remaining = (rws => rws.filter(r => !Array.isArray(r.emails) || r.emails.length === 0).map(r => r.url))(rows);
      const rem = remaining.filter(u => targets.includes(u));
      if (rem.length > 0) {
        const denom = targets.length + rem.length;
        // Adjust current done to reflect phase1 already completed in the new denominator toast on first increment of phase2
        await runPool(rem, 2, denom);
      }
      setToast('Enrich complete');
    } finally {
      setEnriching(false);
    }
  }, [rows, enriching, enrichOne, enrichingSet, enrichPool, loadResults, page, pageLimit]);

  return (
    <div className={(themeDark ? 'dark ' : '') + "min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950"}>
      <header className="border-b bg-gradient-to-r from-indigo-50 via-blue-50 to-fuchsia-50 backdrop-blur dark:from-indigo-900/40 dark:via-blue-900/40 dark:to-fuchsia-900/40">
        <div className="mx-auto max-w-6xl px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight dark:text-white">Web Scraping & Lead Extraction Tool</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Search, scrape, and export website leads.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tab id="url"><span className="inline-flex items-center gap-1"><IHome/> <span>URL Scraper</span></span></Tab>
              <Tab id="search"><span className="inline-flex items-center gap-1"><ISearch/> <span>Search</span></span></Tab>
              <Tab id="maps"><span className="inline-flex items-center gap-1"><IMap/> <span>Maps</span></span></Tab>
              <Tab id="results"><span className="inline-flex items-center gap-1"><IList/> <span>Results</span></span></Tab>
              <Tab id="import"><span className="inline-flex items-center gap-1"><IUpload/> <span>Import</span></span></Tab>
              <Tab id="dashboard"><span className="inline-flex items-center gap-1"><IDashboard/> <span>Dashboard</span></span></Tab>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>applyTheme(!themeDark)} className="rounded-full border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 dark:text-white">
              {themeDark ? '☾ Dark' : '☀︎ Light'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 text-slate-900 dark:text-slate-100">
        {activeTab === 'url' && (
        <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-4 dark:bg-slate-900 dark:ring-white/10">
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Website URL</label>
            <input
              name="url"
              type="url"
              required
              value={form.url}
              onChange={onChange}
              placeholder="https://example.com"
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <input
              name="country"
              value={form.country}
              onChange={onChange}
              placeholder="PK"
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              name="category"
              value={form.category}
              onChange={onChange}
              placeholder="real-estate"
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Crawl Depth</label>
            <select
              name="crawlDepth"
              value={form.crawlDepth}
              onChange={onChange}
              className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
          <div className="md:col-span-4 flex items-center gap-3">
            <Button type="submit" disabled={loading}>{loading ? 'Scraping...' : 'Scrape URL'}</Button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <h3 className="text-sm text-gray-500 dark:text-gray-400">Result</h3>
          {result ? <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">1 found</span> : null}
        </div>

        {!result && (
          <div className="mt-3 rounded-lg border border-dashed p-4 text-sm text-gray-500 dark:text-gray-400 dark:border-white/10">No result yet. Paste a URL and click “Scrape URL”.</div>
        )}

        

        

        {result && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl ring-1 ring-black/5 p-4 bg-white dark:bg-slate-900 dark:ring-white/10">
              <h2 className="font-semibold mb-2">Meta</h2>
              <p className="text-sm"><span className="font-medium">Title:</span> {result.meta?.title || '—'}</p>
              <p className="text-sm"><span className="font-medium">Description:</span> {result.meta?.description || '—'}</p>
            </div>
            <div className="rounded-xl ring-1 ring-black/5 p-4 bg-white dark:bg-slate-900 dark:ring-white/10">
              <h2 className="font-semibold mb-2">Contacts</h2>
              <p className="text-sm"><span className="font-medium">Emails:</span> {result.emails?.length ? result.emails.join(', ') : '—'}</p>
              <p className="text-sm"><span className="font-medium">Phones:</span> {result.phones?.length ? result.phones.slice(0,10).join(', ') : '—'}</p>
              <p className="text-sm"><span className="font-medium">Address:</span> {result.address || '—'}</p>
            </div>
            <div className="rounded-xl ring-1 ring-black/5 p-4 bg-white dark:bg-slate-900 dark:ring-white/10 md:col-span-2">
              <h2 className="font-semibold mb-2">Social Links</h2>
              <ul className="list-disc pl-6 text-sm space-y-1">
                {result.socialLinks?.facebook && <li>Facebook: <a className="text-indigo-400" href={result.socialLinks.facebook} target="_blank" rel="noreferrer">{result.socialLinks.facebook}</a></li>}
                {result.socialLinks?.instagram && <li>Instagram: <a className="text-indigo-400" href={result.socialLinks.instagram} target="_blank" rel="noreferrer">{result.socialLinks.instagram}</a></li>}
                {result.socialLinks?.twitter && <li>Twitter/X: <a className="text-indigo-400" href={result.socialLinks.twitter} target="_blank" rel="noreferrer">{result.socialLinks.twitter}</a></li>}
                {result.socialLinks?.linkedin && <li>LinkedIn: <a className="text-indigo-400" href={result.socialLinks.linkedin} target="_blank" rel="noreferrer">{result.socialLinks.linkedin}</a></li>}
              </ul>
            </div>
          </div>
        )}
        
        </section>
        )}
        
        {activeTab === 'search' && (
          <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-4 dark:bg-slate-900 dark:ring-white/10">
            <form onSubmit={onSearch} className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium mb-1">Search Prompt</label>
                <input
                  value={query}
                  onChange={(e)=>setQuery(e.target.value)}
                  placeholder="Real estate in US"
                  className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limit</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={limit}
                  onChange={(e)=>setLimit(Math.max(1, Math.min(500, parseInt(e.target.value||'0',10))))}
                  className="w-28 rounded border px-3 py-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Higher limits may take longer.</p>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading}>{loading? 'Searching...' : 'Search & Scrape'}</Button>
              </div>
              {error && <div className="md:col-span-6 text-sm text-red-600">{error}</div>}
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {presets.map(p => (
                <button key={p.label} onClick={()=>setQuery(p.prompt)} className="rounded-full border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-800">
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm text-gray-500">Results</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{searchResults.length} found</span>
            </div>

            <div className="mt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total {mapsRows.length}</div>
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Page size</label>
                  <select value={mapsPageSize} onChange={(e)=>{const n=Number(e.target.value)||20; setMapsPageSize(n); setMapsPage(1);}} className="rounded border px-3 py-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button disabled={mapsPage<=1} onClick={()=>setMapsPage(p=>Math.max(1,p-1))}>Prev</Button>
                  <Button disabled={mapsPage>=Math.ceil((mapsRows.length||1)/mapsPageSize)} onClick={()=>setMapsPage(p=>p+1)}>Next</Button>
                </div>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/5 dark:ring-white/10">
              <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">URL</th>
                    <th className="text-left p-2">Emails</th>
                    <th className="text-left p-2">Phones</th>
                    <th className="text-left p-2">Social</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/10">
                  {searchResults.length === 0 && (
                    <tr><td className="p-3 text-gray-500" colSpan={6}>No results yet. Try a prompt like "real estate in US".</td></tr>
                  )}
                  {searchResults.map((row)=>{
                    const title = row?.meta?.title || new URL(row.url).hostname;
                    return (
                      <tr key={row._id || row.url} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                        <td className="p-2 font-medium">{title}</td>
                        <td className="p-2 text-indigo-600"><a href={row.url} target="_blank" rel="noreferrer">{row.url}</a></td>
                        <td className="p-2">{row.emails?.slice(0,2).join(', ') || '—'}</td>
                        <td className="p-2">{row.phones?.slice(0,2).join(', ') || '—'}</td>
                        <td className="p-2 flex gap-2">
                          {row.socialLinks?.facebook && <a className="text-indigo-600" href={row.socialLinks.facebook} target="_blank" rel="noreferrer">FB</a>}
                          {row.socialLinks?.instagram && <a className="text-indigo-600" href={row.socialLinks.instagram} target="_blank" rel="noreferrer">IG</a>}
                          {row.socialLinks?.twitter && <a className="text-indigo-600" href={row.socialLinks.twitter} target="_blank" rel="noreferrer">X</a>}
                          {row.socialLinks?.linkedin && <a className="text-indigo-600" href={row.socialLinks.linkedin} target="_blank" rel="noreferrer">IN</a>}
                        </td>
                        <td className="p-2">
                          <button
                            className="rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-slate-800"
                            onClick={async ()=>{
                              try {
                                setToast('Fetching details...');
                                const res = await postJSON('/api/scrape/url', { url: row.url, crawlDepth: 1 });
                                const updated = searchResults.map(r => (r.url === row.url ? { ...r, ...res.data } : r));
                                setSearchResults(updated);
                                setToast('Details fetched');
                              } catch (e) {
                                setToast(e.message || 'Failed to fetch details');
                              }
                            }}
                          >Get details</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'maps' && (
          <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-4 dark:bg-slate-900 dark:ring-white/10">
            <form onSubmit={async (e)=>{
              e.preventDefault();
              setMapsLoading(true); setMapsError(''); setMapsRows([]);
              try {
                const res = await postJSON('/api/scrape/maps', {
                  mapsUrl,
                  limit: Math.max(1, Math.min(500, Number(mapsLimit)||50)),
                  includeNoWebsite: !!mapsIncludeNoWebsite,
                  aggressive: !!mapsAggressive,
                });
                setMapsRows(res.data || []);
                setMapsPage(1);
                setToast(`Imported ${res.count || (res.data||[]).length} listings`);
              } catch (err) {
                setMapsError(err.message);
                setToast(err.message);
              } finally {
                setMapsLoading(false);
              }
            }} className="grid gap-4 md:grid-cols-6">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium mb-1">Google Maps URL</label>
                <input
                  value={mapsUrl}
                  onChange={(e)=>setMapsUrl(e.target.value)}
                  placeholder="Paste Google Maps search link"
                  className="w-full rounded border px-3 py-2 focus:outline-none focus:ring focus:ring-indigo-200 bg-white text-slate-900 placeholder-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Limit</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={mapsLimit}
                  onChange={(e)=>setMapsLimit(Math.max(1, Math.min(500, parseInt(e.target.value||'0',10))))}
                  className="w-28 rounded border px-3 py-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={mapsIncludeNoWebsite} onChange={(e)=>setMapsIncludeNoWebsite(e.target.checked)} /> Include items without website
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input type="checkbox" checked={mapsAggressive} onChange={(e)=>setMapsAggressive(e.target.checked)} /> Aggressive mode
                </label>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={mapsLoading}>{mapsLoading? 'Importing...' : 'Import from Maps'}</Button>
              </div>
              {mapsError && <div className="md:col-span-6 text-sm text-red-600">{mapsError}</div>}
            </form>

            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-sm text-gray-500 dark:text-gray-400">Listings</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{mapsRows.length} items</span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/5 dark:ring-white/10">
              <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Website</th>
                    <th className="text-left p-2">Phone</th>
                    <th className="text-left p-2">Rating</th>
                    <th className="text-left p-2">Reviews</th>
                    <th className="text-left p-2">Address</th>
                    <th className="text-left p-2">Emails</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/10">
                  {mapsRows.length === 0 && (
                    <tr><td className="p-3 text-gray-500 dark:text-gray-400" colSpan={8}>No listings yet. Paste a Google Maps search link and click Import.</td></tr>
                  )}
                  {(mapsRows.slice((mapsPage-1)*mapsPageSize, (mapsPage-1)*mapsPageSize + mapsPageSize)).map((r, idx)=>{
                    const absoluteIndex = (mapsPage-1)*mapsPageSize + idx;
                    const site = r.website;
                    return (
                      <tr key={(r.website||'')+absoluteIndex} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                        <td className="p-2 font-medium">{r.name || '—'}</td>
                        <td className="p-2 text-indigo-600">{site ? <a href={site} target="_blank" rel="noreferrer">{site}</a> : '—'}</td>
                        <td className="p-2">{r.phone || '—'}</td>
                        <td className="p-2">{typeof r.rating === 'number' ? r.rating.toFixed(1) : '—'}</td>
                        <td className="p-2">{typeof r.reviews === 'number' ? r.reviews : '—'}</td>
                        <td className="p-2 max-w-[320px] truncate" title={r.address || ''}>{r.address || '—'}</td>
                        <td className="p-2">{r.emails?.slice(0,2).join(', ') || '—'}</td>
                        <td className="p-2">
                          <button
                            disabled={!site}
                            className="rounded border px-2 py-1 text-xs disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800"
                            onClick={async ()=>{
                              if (!site) return;
                              try {
                                setToast('Fetching details...');
                                const res = await postJSON('/api/scrape/url', { url: site, crawlDepth: 1 });
                                const updated = mapsRows.slice();
                                updated[absoluteIndex] = { ...updated[absoluteIndex], ...res.data };
                                setMapsRows(updated);
                                setToast('Details fetched');
                              } catch (e) {
                                setToast(e.message || 'Failed to fetch details');
                              }
                            }}
                          >Get details</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">Page {mapsPage} of {Math.max(1, Math.ceil((mapsRows.length||1)/mapsPageSize))}</div>
              <div className="flex gap-2">
                <Button disabled={mapsPage<=1} onClick={()=>setMapsPage(p=>Math.max(1,p-1))}>Prev</Button>
                <Button disabled={mapsPage>=Math.ceil((mapsRows.length||1)/mapsPageSize)} onClick={()=>setMapsPage(p=>p+1)}>Next</Button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'import' && (
          <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-4 dark:bg-slate-900 dark:ring-white/10">
            <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-3">Upload & Import CSV</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Expected columns: name, address_1, address_2, phone_number, website, rating, reviews_count</p>
            <form className="flex flex-col md:flex-row gap-3 items-end" onSubmit={async (e)=>{
              e.preventDefault();
              const input = e.currentTarget.querySelector('input[type=file]');
              const auto = e.currentTarget.querySelector('input[name=autoEnrich]')?.checked;
              const replace = e.currentTarget.querySelector('input[name=replacePrev]')?.checked ?? true;
              if (!input || !input.files || input.files.length === 0) { setToast('Choose a CSV file'); return; }
              const fd = new FormData();
              fd.append('file', input.files[0]);
              setLoading(true); setToast('Importing CSV...');
              try {
                const res = await postForm(`/api/scrape/import-csv?replace=${replace ? 'true' : 'false'}`, fd);
                setToast(`Imported ${res.count || 0} rows`);
                input.value = '';
                setActiveTab('results');
                await loadResults(1, pageLimit);
                if (auto) {
                  setAutoEnrichPending(true);
                }
              } catch (err) {
                setToast(err.message || 'Import failed');
              } finally {
                setLoading(false);
              }
            }}>
              <div>
                <label className="block text-sm font-medium mb-1">CSV file</label>
                <input type="file" accept=".csv,.xlsx" className="block w-72 text-sm" />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" name="replacePrev" defaultChecked /> Replace previous results
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" name="autoEnrich" /> Auto enrich after import
              </label>
              <Button type="submit" disabled={loading}>Upload & Import</Button>
            </form>
          </section>
        )}

        {activeTab === 'results' && (
          <section className="bg-white rounded-xl shadow-sm ring-1 ring-black/5 p-4 dark:bg-slate-900 dark:ring-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-gray-500 dark:text-gray-400">Results</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">Total {total}</span>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Page size</label>
                  <select value={pageLimit} onChange={(e)=>{setPageLimit(Number(e.target.value)); loadResults(1, Number(e.target.value));}} className="rounded border px-3 py-2 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                    <option value={1000}>1000</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={enrichAllCurrentPage} disabled={enriching || loading}>{enriching ? `Enriching ${enrichDone}/${rows.length}` : 'Enrich All (page)'}</Button>
                <Button onClick={async ()=>{ try { await postJSON('/api/scrape/clear', {}); setPage(1); await loadResults(1, pageLimit); setToast('Cleared previous results'); } catch(e){ setToast(e.message||'Failed to clear'); } }} disabled={loading}>Clear Results</Button>
                <a
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-white hover:from-indigo-700 hover:to-violet-700"
                  href={`${BASE}/api/scrape/results?format=csv&page=${page}&limit=${pageLimit}`}
                >Export CSV (page)</a>
                <a
                  className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-white hover:from-indigo-700 hover:to-violet-700"
                  href={`${BASE}/api/scrape/results?format=csv&page=1&limit=200000`}
                >Export CSV (all)</a>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg ring-1 ring-black/5 dark:ring-white/10">
              <table className="min-w-full text-sm text-slate-900 dark:text-slate-100">
                <thead className="bg-gray-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
                  <tr>
                    <th className="text-left p-2">Title</th>
                    <th className="text-left p-2">URL</th>
                    <th className="text-left p-2">Emails</th>
                    <th className="text-left p-2">Phones</th>
                    <th className="text-left p-2">Rating</th>
                    <th className="text-left p-2">Reviews</th>
                    <th className="text-left p-2">Created</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-white/10">
                  {!loading && rows.length === 0 && (
                    <tr><td className="p-3 text-gray-500 dark:text-gray-400" colSpan={8}>No saved results yet. Run a search or scrape a URL first.</td></tr>
                  )}
                  {loading && Array.from({length:5}).map((_,i)=>(
                    <tr key={i} className="animate-pulse">
                      <td className="p-2"><div className="h-4 w-48 bg-gray-200 rounded"/></td>
                      <td className="p-2"><div className="h-4 w-64 bg-gray-200 rounded"/></td>
                      <td className="p-2"><div className="h-4 w-24 bg-gray-200 rounded"/></td>
                      <td className="p-2"><div className="h-4 w-24 bg-gray-200 rounded"/></td>
                      <td className="p-2"><div className="h-4 w-20 bg-gray-200 rounded"/></td>
                    </tr>
                  ))}
                  {!loading && rows.map((r, index)=>{
                    const title = r?.meta?.title || new URL(r.url).hostname;
                    const hasEmail = Array.isArray(r.emails) && r.emails.length > 0;
                    const isBusy = enrichingSet.has(r.url);
                    return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                        <td className="p-2 font-medium">{title}</td>
                        <td className="p-2 text-indigo-600"><a href={r.url} target="_blank" rel="noreferrer">{r.url}</a></td>
                        <td className="p-2">{(r.emails||[]).slice(0,2).join(', ') || '—'}</td>
                        <td className="p-2">{(r.phones||[]).slice(0,2).join(', ') || '—'}</td>
                        <td className="p-2">{typeof r.rating === 'number' ? r.rating.toFixed(1) : '—'}</td>
                        <td className="p-2">{typeof r.reviews === 'number' ? r.reviews : '—'}</td>
                        <td className="p-2">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="p-2">
                          <button
                            disabled={hasEmail || isBusy}
                            className={`rounded border px-2 py-1 text-xs ${hasEmail ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                            onClick={async ()=>{ await enrichOne(r.url); }}
                          >{isBusy ? 'Enriching...' : hasEmail ? 'Enriched' : 'Enrich'}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-500">Page {page} of {Math.max(1, Math.ceil(total / pageLimit))}</div>
              <div className="flex gap-2">
                <Button disabled={loading || page<=1} onClick={()=>loadResults(page-1, pageLimit)}>Prev</Button>
                <Button disabled={loading || page>=Math.ceil(total/pageLimit)} onClick={()=>loadResults(page+1, pageLimit)}>Next</Button>
              </div>
            </div>
          </section>
        )}

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 right-4 rounded-md bg-black text-white px-4 py-2 text-sm shadow" onAnimationEnd={()=>setToast('')}>
            {toast}
          </div>
        )}
      </main>
    </div>
  );
}
