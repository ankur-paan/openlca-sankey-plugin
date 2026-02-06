import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import './App.css'
import SankeyDiagram, { type SankeyConfig } from './components/SankeyDiagram'
import { toPng } from 'html-to-image';
import { saveAs } from 'file-saver';

interface SankeyNode {
  name: string;
  flowName?: string;
  direct?: number;
  upstream?: number;
  directPct?: number;
  upstreamPct?: number;
  processId?: string;
  isRoot?: boolean;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  share?: number;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalImpact?: number;
  impactUnit?: string;
  impactCategory?: string;
  rootIndex?: number;
}

/* ═══════════ GLASS DESIGN TOKENS ═══════════ */
const G = {
  bg: 'rgba(255,255,255,0.42)',
  blur: 'blur(40px) saturate(200%)',
  border: '1px solid rgba(255,255,255,0.55)',
  innerBorder: '1px solid rgba(200,200,200,0.25)',
  shadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
  inputBg: 'rgba(255,255,255,0.55)',
  inputBorder: '1px solid rgba(200,200,200,0.4)',
  sectionBg: 'rgba(255,255,255,0.28)',
  accent: '#e91e63',
  text: '#1e293b',
  textSec: '#64748b',
  textMuted: '#94a3b8',
}

const selectCSS: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8,
  border: G.inputBorder, background: G.inputBg, color: G.text,
  outline: 'none', cursor: 'pointer',
}

const numCSS: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 8,
  border: G.inputBorder, background: G.inputBg, color: G.text,
  outline: 'none', boxSizing: 'border-box',
}

/* ═══════════ TINY HELPERS ═══════════ */
function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, ...style }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: G.textSec }}>{label}</label>
      {children}
    </div>
  )
}

function Slider({ label, value, min, max, step, unit, fmt, onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const display = fmt ? fmt(value) : `${value}${unit || ''}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: G.textSec, width: 70, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} step={step || 1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#e91e63', height: 4 }}
      />
      <span style={{ fontSize: 10, color: G.text, width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{display}</span>
    </div>
  )
}

/* ═══════════ APP ═══════════ */
function App() {
  const [data, setData] = useState<SankeyData>({ nodes: [], links: [] })
  const [status, setStatus] = useState("Checking connection...")
  const [config, setConfig] = useState<SankeyConfig>({
    fontSizeTitle: 12,
    fontSizeFlow: 10,
    fontSizeDirect: 11,
    fontSizeUpstream: 11,
    boxSize: 240,
    boxHeight: 120,
    layerGap: 80,
    headerRatio: 0.30,
    contentRatio: 0.50,
    startColor: '#e91e63',
    endColor: '#e91e63',
    opacity: 0.5,
    theme: 'scientific',
    impactUnit: '',
    minContribution: 0,
    maxProcesses: 25,
    orientation: 'north',
    connectionStyle: 'curve'
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width: Math.round(width), height: Math.round(height) })
        }
      }
    })
    ro.observe(containerRef.current)
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) })
    }
    return () => ro.disconnect()
  }, [])

  const [systems, setSystems] = useState<{ id: string, name: string }[]>([])
  const [selectedSystemId, setSelectedSystemId] = useState<string>('')
  const [impactMethods, setImpactMethods] = useState<{ id: string, name: string }[]>([])
  const [selectedMethodId, setSelectedMethodId] = useState<string>('')
  const [impactCategories, setImpactCategories] = useState<{ id: string, name: string, refUnit?: string }[]>([])
  const [selectedImpactId, setSelectedImpactId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const latestMethodRequestRef = useRef<string>('')
  const selectedSystemIdRef = useRef<string>('')
  useEffect(() => { selectedSystemIdRef.current = selectedSystemId }, [selectedSystemId])

  const fetchGraph = useCallback((systemId: string, methodId?: string, impactId?: string) => {
    if (!systemId) return;
    setLoading(true)
    setStatus("Calculating...")
    const params = new URLSearchParams();
    if (methodId) params.append('impact_method_id', methodId);
    if (impactId) params.append('impact_category_id', impactId);
    params.append('max_nodes', String(config.maxProcesses));
    params.append('min_share', String(config.minContribution));

    axios.get(`http://localhost:8000/api/sankey/${systemId}?${params.toString()}`)
      .then(res => {
        setData(res.data)
        if (res.data.impactUnit) {
          setConfig(prev => ({ ...prev, impactUnit: res.data.impactUnit }))
        }
        const nodeCount = res.data.nodes?.length || 0
        const edgeCount = res.data.links?.length || 0
        setStatus(`Loaded ${nodeCount} processes, ${edgeCount} connections`)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err);
        setStatus("Error loading graph")
        setLoading(false)
      })
  }, [config.maxProcesses, config.minContribution])

  const fetchCategoriesForMethod = useCallback((methodId: string) => {
    latestMethodRequestRef.current = methodId;
    setImpactCategories([]);
    setSelectedImpactId('');

    axios.get(`http://localhost:8000/api/method/${methodId}/categories`)
      .then(res => {
        if (latestMethodRequestRef.current !== methodId) return;
        const list = res.data.map((s: any) => ({
          id: s['@id'], name: s.name, refUnit: s.refUnit || '',
        }));
        setImpactCategories(list);
        if (list.length > 0) {
          setSelectedImpactId(list[0].id);
          const unitLabel = list[0].refUnit ? `${list[0].name} [${list[0].refUnit}]` : list[0].name;
          setConfig(prev => ({ ...prev, impactUnit: unitLabel }));
          const currentSystemId = selectedSystemIdRef.current;
          if (currentSystemId) fetchGraph(currentSystemId, methodId, list[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch categories for method", err));
  }, [fetchGraph]);

  useEffect(() => {
    axios.get('http://localhost:8000/api/status')
      .then(res => {
        setStatus(`Connected (openLCA ${res.data.version})`)
        const systemsPromise = axios.get('http://localhost:8000/api/descriptors/ProductSystem');
        const methodsPromise = axios.get('http://localhost:8000/api/descriptors/ImpactMethod');
        Promise.all([systemsPromise, methodsPromise]).then(([sysRes, methRes]) => {
          const sysList = sysRes.data.map((s: any) => ({ id: s['@id'], name: s.name }));
          setSystems(sysList);
          const methList = methRes.data.map((s: any) => ({ id: s['@id'], name: s.name }));
          setImpactMethods(methList);
          if (sysList.length > 0) { setSelectedSystemId(sysList[0].id); selectedSystemIdRef.current = sysList[0].id; }
          if (methList.length > 0) { setSelectedMethodId(methList[0].id); fetchCategoriesForMethod(methList[0].id); }
        }).catch(err => console.error("Failed to fetch initial data", err));
      })
      .catch(() => setStatus("Error: Backend disconnected"))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSystemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedSystemId(id)
    fetchGraph(id, selectedMethodId, selectedImpactId)
  }

  const handleExport = useCallback(() => {
    if (svgRef.current === null) return
    const svgEl = svgRef.current
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    const hintTexts = clone.querySelectorAll(':scope > text')
    hintTexts.forEach(t => t.remove())
    const mainG = clone.querySelector('g')
    if (mainG) mainG.setAttribute('transform', 'scale(1)')
    clone.style.position = 'absolute'
    clone.style.left = '-99999px'
    clone.style.top = '-99999px'
    document.body.appendChild(clone)
    const mainGClone = clone.querySelector('g')
    if (!mainGClone) { document.body.removeChild(clone); return }
    const bbox = mainGClone.getBBox()
    document.body.removeChild(clone)
    const margin = 10
    const vbX = bbox.x - margin, vbY = bbox.y - margin
    const vbW = bbox.width + margin * 2, vbH = bbox.height + margin * 2
    clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
    clone.setAttribute('width', String(Math.ceil(vbW)))
    clone.setAttribute('height', String(Math.ceil(vbH)))
    clone.style.position = ''
    clone.style.left = ''
    clone.style.top = ''
    document.body.appendChild(clone)
    toPng(clone as any, { cacheBust: true, pixelRatio: 4, backgroundColor: '#ffffff' })
      .then((dataUrl) => { document.body.removeChild(clone); saveAs(dataUrl, `sankey-export.png`) })
      .catch((err) => { document.body.removeChild(clone); console.log(err) })
  }, [])

  /* ════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f1f5f9' }}>

      {/* ═══════ LIQUID GLASS SIDEBAR ═══════ */}
      <div style={{
        width: sidebarOpen ? 320 : 0,
        minWidth: sidebarOpen ? 320 : 0,
        height: '100%',
        transition: 'width 0.3s cubic-bezier(.4,0,.2,1), min-width 0.3s cubic-bezier(.4,0,.2,1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 20,
      }}>
        <div style={{
          width: 320, height: '100%', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 6,
          padding: '16px 18px', boxSizing: 'border-box',
          background: G.bg,
          backdropFilter: G.blur, WebkitBackdropFilter: G.blur,
          borderRight: G.border,
          boxShadow: G.shadow,
        }}>

          {/* Header */}
          <div style={{ paddingBottom: 12, borderBottom: G.innerBorder, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: G.text, letterSpacing: '-0.01em' }}>
              Sankey Settings
            </h1>
            <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>{status}</div>
            {data.impactCategory && (
              <div style={{ fontSize: 11, color: G.accent, marginTop: 4, fontWeight: 600 }}>
                {data.impactCategory}{data.impactUnit && ` [${data.impactUnit}]`}
              </div>
            )}
          </div>

          {/* Product System */}
          <Field label="Product System">
            <select value={selectedSystemId} onChange={handleSystemChange} style={selectCSS}>
              {systems.length === 0 && <option value="">No systems found</option>}
              {systems.map((s, i) => <option key={`${s.id}_${i}`} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          {/* Impact Method */}
          <Field label="Impact Method">
            <select value={selectedMethodId} onChange={(e) => { setSelectedMethodId(e.target.value); fetchCategoriesForMethod(e.target.value); }} style={selectCSS}>
              {impactMethods.length === 0 && <option value="">No methods found</option>}
              {impactMethods.map((m, i) => <option key={`${m.id}_${i}`} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          {/* Impact Category */}
          <Field label="Impact Category">
            <select value={selectedImpactId} onChange={(e) => {
              const id = e.target.value;
              setSelectedImpactId(id);
              const cat = impactCategories.find(c => c.id === id);
              if (cat) { const u = cat.refUnit ? `${cat.name} [${cat.refUnit}]` : cat.name; setConfig(p => ({ ...p, impactUnit: u })); }
              fetchGraph(selectedSystemId, selectedMethodId, id);
            }} style={selectCSS}>
              {impactCategories.length === 0 && <option value="">No categories found</option>}
              {impactCategories.map((c, i) => <option key={`${c.id}_${i}`} value={c.id}>{c.name}{c.refUnit ? ` [${c.refUnit}]` : ''}</option>)}
            </select>
          </Field>

          {/* Number inputs row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Min share (%)" style={{ flex: 1 }}>
              <input type="number" step="0.001" min="0" max="100" value={config.minContribution}
                onChange={(e) => setConfig({ ...config, minContribution: Number(e.target.value) })} style={numCSS} />
            </Field>
            <Field label="Max processes" style={{ flex: 1 }}>
              <input type="number" min="1" max="200" value={config.maxProcesses}
                onChange={(e) => setConfig({ ...config, maxProcesses: Number(e.target.value) })} style={numCSS} />
            </Field>
          </div>

          {/* Orientation / Connections row */}
          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="Orientation" style={{ flex: 1 }}>
              <select value={config.orientation} onChange={(e) => setConfig({ ...config, orientation: e.target.value as any })} style={selectCSS}>
                <option value="north">Top-down</option><option value="south">Bottom-up</option>
                <option value="west">Left-right</option><option value="east">Right-left</option>
              </select>
            </Field>
            <Field label="Connections" style={{ flex: 1 }}>
              <select value={config.connectionStyle} onChange={(e) => setConfig({ ...config, connectionStyle: e.target.value as any })} style={selectCSS}>
                <option value="curve">Curve</option><option value="straight">Straight</option>
              </select>
            </Field>
          </div>

          {/* Theme */}
          <Field label="Theme">
            <select value={config.theme} onChange={(e) => setConfig({ ...config, theme: e.target.value as any })} style={selectCSS}>
              <option value="scientific">Light</option><option value="futuristic">Dark</option>
            </select>
          </Field>

          {/* ── Font Sizes section ── */}
          <div style={{ background: G.sectionBg, borderRadius: 10, padding: '10px 12px', border: G.innerBorder }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: G.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Font Sizes</div>
            <Slider label="Title" value={config.fontSizeTitle} min={8} max={20} onChange={(v) => setConfig({ ...config, fontSizeTitle: v })} />
            <Slider label="Flow" value={config.fontSizeFlow} min={7} max={18} onChange={(v) => setConfig({ ...config, fontSizeFlow: v })} />
            <Slider label="Direct" value={config.fontSizeDirect} min={7} max={18} onChange={(v) => setConfig({ ...config, fontSizeDirect: v })} />
            <Slider label="Upstream" value={config.fontSizeUpstream} min={7} max={18} onChange={(v) => setConfig({ ...config, fontSizeUpstream: v })} />
          </div>

          {/* ── Layout section ── */}
          <div style={{ background: G.sectionBg, borderRadius: 10, padding: '10px 12px', border: G.innerBorder }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: G.textSec, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Layout</div>
            <Slider label="Box Width" value={config.boxSize} min={150} max={500} unit="px" onChange={(v) => setConfig({ ...config, boxSize: v })} />
            <Slider label="Box Height" value={config.boxHeight} min={60} max={300} unit="px" onChange={(v) => setConfig({ ...config, boxHeight: v })} />
            <Slider label="Layer Gap" value={config.layerGap} min={10} max={300} unit="px" onChange={(v) => setConfig({ ...config, layerGap: v })} />
            <Slider label="Header" value={config.headerRatio} min={0.15} max={0.60} step={0.01} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setConfig({ ...config, headerRatio: v })} />
            <Slider label="Dir/Up Split" value={config.contentRatio} min={0.25} max={0.75} step={0.01} fmt={(v) => `${Math.round(v * 100)}/${Math.round((1 - v) * 100)}`} onChange={(v) => setConfig({ ...config, contentRatio: v })} />
            <Slider label="Link Opacity" value={config.opacity} min={0.2} max={1} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => setConfig({ ...config, opacity: v })} />
          </div>

          {/* ── Action buttons ── */}
          <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: G.innerBorder, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => fetchGraph(selectedSystemId || '', selectedMethodId, selectedImpactId)} disabled={loading}
              style={{
                width: '100%', padding: '10px 0', border: 'none', borderRadius: 10,
                background: 'linear-gradient(135deg, #e91e63, #c2185b)', color: '#fff',
                fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, boxShadow: '0 4px 14px rgba(233,30,99,0.3)',
              }}>
              {loading ? 'Calculating...' : 'Refresh'}
            </button>
            <button onClick={handleExport}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 10,
                border: G.innerBorder, background: G.inputBg,
                backdropFilter: 'blur(10px)', color: G.text,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
              Export PNG
            </button>
          </div>

        </div>
      </div>

      {/* ═══════ MAIN DIAGRAM AREA ═══════ */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#ffffff' }}>
        {/* Toggle sidebar */}
        <button onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Hide Settings' : 'Show Settings'}
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: 30,
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 10, border: G.border, background: G.bg,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', cursor: 'pointer', color: G.text,
          }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(6px)', zIndex: 10,
          }}>
            <div style={{
              padding: '14px 28px', borderRadius: 14, background: G.bg,
              backdropFilter: G.blur, border: G.border, boxShadow: G.shadow,
              color: G.text, fontWeight: 500, fontSize: 14,
            }}>Computing Sankey graph...</div>
          </div>
        )}

        {/* Diagram container */}
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#ffffff' }}>
          <SankeyDiagram ref={svgRef} data={data} width={dimensions.width} height={dimensions.height} config={config} />
        </div>
      </div>

    </div>
  )
}

export default App
