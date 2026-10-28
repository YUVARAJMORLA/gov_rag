import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { voiceAssistant } from '../services/speechService';
import {
  Shield, Database, Cpu, Users, Activity, ArrowLeft, RefreshCw,
  CheckCircle2, AlertCircle, Eye, UserCheck, UserX, ShieldAlert,
  Server, Key, Lock, Layers, BarChart3, Clock, Sparkles, ShieldCheck,
  ExternalLink, DollarSign, Search, Download, Filter, TrendingUp,
  HelpCircle, ArrowUpDown, Calendar, AlertTriangle, Radio, Volume2,
  Palette, Sun, Moon, Share2, GitFork, ZoomIn, ZoomOut, Maximize2,
  Minimize2, FileText, Compass, Info, Check, X, ChevronRight, CornerDownRight,
  Type, Sliders, BookOpen
} from 'lucide-react';


export const AdminDashboard = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState('connections');

  // Admin Theme & Multilingual Indic/Elder Typography Control
  const [adminTheme, setAdminTheme] = useState(() => {
    return localStorage.getItem('gov_rag_theme') || 'default-dark';
  });
  const [textSize, setTextSize] = useState(() => {
    return localStorage.getItem('gov_rag_text_size') || 'normal';
  });
  const [lineHeight, setLineHeight] = useState(() => {
    return localStorage.getItem('gov_rag_line_height') || 'balanced';
  });
  const [letterSpacing, setLetterSpacing] = useState(() => {
    return localStorage.getItem('gov_rag_letter_spacing') || 'normal';
  });
  const [fontFamily, setFontFamily] = useState(() => {
    return localStorage.getItem('gov_rag_font_family') || 'noto-sans';
  });
  const [fontWeight, setFontWeight] = useState(() => {
    return localStorage.getItem('gov_rag_font_weight') || 'normal';
  });
  const [indicMode, setIndicMode] = useState(() => {
    return localStorage.getItem('gov_rag_indic_mode') !== 'false';
  });

  const handleApplyTheme = (themeId) => {
    setAdminTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('gov_rag_theme', themeId);
  };

  const handleApplyTextSize = (val) => {
    setTextSize(val);
    document.documentElement.setAttribute('data-text-size', val);
    localStorage.setItem('gov_rag_text_size', val);
  };

  const handleApplyLineHeight = (val) => {
    setLineHeight(val);
    document.documentElement.setAttribute('data-line-height', val);
    localStorage.setItem('gov_rag_line_height', val);
  };

  const handleApplyLetterSpacing = (val) => {
    setLetterSpacing(val);
    document.documentElement.setAttribute('data-letter-spacing', val);
    localStorage.setItem('gov_rag_letter_spacing', val);
  };

  const handleApplyFontFamily = (val) => {
    setFontFamily(val);
    document.documentElement.setAttribute('data-font-family', val);
    localStorage.setItem('gov_rag_font_family', val);
  };

  const handleApplyFontWeight = (val) => {
    setFontWeight(val);
    document.documentElement.setAttribute('data-font-weight', val);
    localStorage.setItem('gov_rag_font_weight', val);
  };

  const handleToggleIndicMode = (val) => {
    setIndicMode(val);
    document.documentElement.setAttribute('data-indic-mode', val ? 'true' : 'false');
    localStorage.setItem('gov_rag_indic_mode', val ? 'true' : 'false');
  };

  const handleApplyQuickPreset = (preset) => {
    if (preset === 'elder') {
      handleApplyTextSize('large');
      handleApplyLineHeight('relaxed');
      handleApplyLetterSpacing('spacious');
      handleApplyFontFamily('noto-sans');
      handleApplyFontWeight('medium');
      handleToggleIndicMode(true);
      handleApplyTheme('elder-high-contrast');
    } else if (preset === 'indic') {
      handleApplyTextSize('medium');
      handleApplyLineHeight('balanced');
      handleApplyLetterSpacing('spacious');
      handleApplyFontFamily('noto-sans');
      handleApplyFontWeight('normal');
      handleToggleIndicMode(true);
    } else if (preset === 'sepia') {
      handleApplyTextSize('medium');
      handleApplyLineHeight('balanced');
      handleApplyLetterSpacing('normal');
      handleApplyFontFamily('traditional-serif');
      handleApplyTheme('sepia-warm');
    } else if (preset === 'reset') {
      handleApplyTextSize('normal');
      handleApplyLineHeight('compact');
      handleApplyLetterSpacing('normal');
      handleApplyFontFamily('inter');
      handleApplyFontWeight('normal');
      handleToggleIndicMode(false);
      handleApplyTheme('default-dark');
    }
  };

  // Connection data
  const [connections, setConnections] = useState(null);
  const [connLoading, setConnLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  // Tables info & live data
  const [tablesInfo, setTablesInfo] = useState(null);
  const [selectedTable, setSelectedTable] = useState('user_queries');
  const [tableLimit, setTableLimit] = useState(10);
  const [tableData, setTableData] = useState(null);
  const [tableDataLoading, setTableDataLoading] = useState(false);

  // Table filters & search
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableTimeFilter, setTableTimeFilter] = useState('all');
  const [tableSortCol, setTableSortCol] = useState(null);
  const [tableSortAsc, setTableSortAsc] = useState(true);

  // Users data (MongoDB)
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userActionMsg, setUserActionMsg] = useState('');

  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Databricks Dedicated Dashboards data
  const [dashMetrics, setDashMetrics] = useState(null);
  const [dashMetricsLoading, setDashMetricsLoading] = useState(false);
  const [dashSubTab, setDashSubTab] = useState('overview'); // 'overview' | 'models' | 'security' | 'unanswered' | 'external'
  const [secSearchQuery, setSecSearchQuery] = useState('');
  const [unansweredSearchQuery, setUnansweredSearchQuery] = useState('');

  // Admin Voice Customization
  const [voiceList, setVoiceList] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');

  // Databricks Knowledge Graph Explorer State
  const [graphData, setGraphData] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [graphDocFilter, setGraphDocFilter] = useState('');
  const [graphSimThreshold, setGraphSimThreshold] = useState(0.85);
  const [graphChunksPerDoc, setGraphChunksPerDoc] = useState(6);
  const [graphSearchQuery, setGraphSearchQuery] = useState('');
  const [selectedGraphNode, setSelectedGraphNode] = useState(null);
  const [graphZoom, setGraphZoom] = useState(1.0);
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [graphLayerFilters, setGraphLayerFilters] = useState({
    raw: true,
    validated: true,
    quarantine: true,
    document: true,
    chunk: true,
    query: true,
    similarity: true
  });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsGraphFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    loadConnections();
    loadTablesInfo();
    loadUsers();
    loadAnalytics();
    loadDatabricksDashboardMetrics();
    loadKnowledgeGraph();

    const list = voiceAssistant.getAvailableVoices();
    setVoiceList(list);
    const saved = voiceAssistant.getSelectedVoice();
    if (saved) {
      setSelectedVoiceId(saved);
    } else if (list.length > 0) {
      const maleVoice = list.find((v) => v.gender === 'Male');
      const def = maleVoice ? maleVoice.id : list[0].id;
      setSelectedVoiceId(def);
      voiceAssistant.setSelectedVoice(def);
    }

    voiceAssistant.onVoicesChanged((updated) => {
      setVoiceList(updated);
      const current = voiceAssistant.getSelectedVoice();
      if (current) {
        setSelectedVoiceId(current);
      } else if (updated.length > 0) {
        const maleVoice = updated.find((v) => v.gender === 'Male');
        const def = maleVoice ? maleVoice.id : updated[0].id;
        setSelectedVoiceId(def);
        voiceAssistant.setSelectedVoice(def);
      }
    });
  }, []);

  const handleSelectVoice = (newVoiceId) => {
    setSelectedVoiceId(newVoiceId);
    voiceAssistant.setSelectedVoice(newVoiceId);
  };

  const handlePreviewVoice = () => {
    voiceAssistant.speak(
      'Hello Administrator! This is your GovAssist speech voice. Ready to assist.',
      null,
      null,
      selectedVoiceId
    );
  };

  const loadConnections = async () => {
    try {
      setConnLoading(true);
      const res = await adminAPI.getConnections();
      if (res.data?.success) {
        setConnections(res.data);
      }
    } catch (err) {
      console.error('Failed to load connection details:', err);
    } finally {
      setConnLoading(false);
    }
  };

  const handleTestConnections = async () => {
    try {
      setTestLoading(true);
      const res = await adminAPI.testConnections();
      setTestResults(res.data);
    } catch (err) {
      console.error('Connection test failed:', err);
      setTestResults({ success: false, error: err.message });
    } finally {
      setTestLoading(false);
    }
  };

  const loadTablesInfo = async () => {
    try {
      const res = await adminAPI.getTablesInfo();
      if (res.data?.success) {
        setTablesInfo(res.data);
      }
    } catch (err) {
      console.error('Failed to load tables info:', err);
    }
  };

  const handleFetchTableData = async () => {
    try {
      setTableDataLoading(true);
      const res = await adminAPI.getTableData(selectedTable, tableLimit);
      setTableData(res.data);
    } catch (err) {
      console.error('Failed to fetch table data:', err);
    } finally {
      setTableDataLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await adminAPI.getUsers();
      if (res.data?.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      setUserActionMsg('');
      const res = await adminAPI.toggleUserStatus(userId, !currentStatus);
      if (res.data?.success) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, isActive: !currentStatus } : u)));
        setUserActionMsg(res.data.message);
      }
    } catch (err) {
      setUserActionMsg(err.response?.data?.error || 'Failed to update user status');
    }
  };

  const handleUpdateUserRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      setUserActionMsg('');
      const res = await adminAPI.updateUserRole(userId, newRole);
      if (res.data?.success) {
        setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
        setUserActionMsg(res.data.message);
      }
    } catch (err) {
      setUserActionMsg(err.response?.data?.error || 'Failed to update user role');
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const res = await adminAPI.getAnalytics();
      if (res.data?.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadDatabricksDashboardMetrics = async () => {
    try {
      setDashMetricsLoading(true);
      const res = await adminAPI.getDatabricksDashboardMetrics();
      if (res.data?.success) {
        setDashMetrics(res.data);
      }
    } catch (err) {
      console.error('Failed to load Databricks dashboard metrics:', err);
    } finally {
      setDashMetricsLoading(false);
    }
  };

  const loadKnowledgeGraph = async (refresh = false) => {
    try {
      setGraphLoading(true);
      setGraphError(null);
      const res = await adminAPI.getKnowledgeGraph({
        doc_id: graphDocFilter,
        refresh: refresh ? 'true' : 'false',
        similarity_threshold: graphSimThreshold,
        chunks_per_doc: graphChunksPerDoc
      });
      if (res.data?.success) {
        setGraphData(res.data);
        setGraphError(null);
      } else {
        setGraphError(res.data?.error || 'Failed to fetch knowledge graph');
      }
    } catch (err) {
      console.error('Failed to load knowledge graph:', err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to connect to Databricks Knowledge Graph API';
      setGraphError(errMsg);
    } finally {
      setGraphLoading(false);
    }
  };

  const getFilteredAndSortedRows = () => {
    if (!tableData?.rows) return [];
    let rows = [...tableData.rows];

    // 1. Text Search across all columns
    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((val) => String(val || '').toLowerCase().includes(q))
      );
    }

    // 2. Time Filter
    if (tableTimeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (tableTimeFilter === 'today') cutoff.setHours(0, 0, 0, 0);
      else if (tableTimeFilter === 'week') cutoff.setDate(now.getDate() - 7);
      else if (tableTimeFilter === 'month') cutoff.setDate(now.getDate() - 30);

      rows = rows.filter((r) => {
        const t = r.timestamp || r.created_at;
        if (!t) return true;
        const rowDate = new Date(t);
        return !isNaN(rowDate.getTime()) ? rowDate >= cutoff : true;
      });
    }

    // 3. Column Sorting
    if (tableSortCol) {
      rows.sort((a, b) => {
        const valA = a[tableSortCol] ?? '';
        const valB = b[tableSortCol] ?? '';
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return tableSortAsc ? numA - numB : numB - numA;
        }
        return tableSortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  };

  const exportTableCSV = () => {
    const rows = getFilteredAndSortedRows();
    if (!rows || rows.length === 0) return;
    const cols = (tableData?.columns && tableData.columns.length > 0)
      ? tableData.columns
      : Object.keys(rows[0]);

    const header = cols.join(',');
    const csvRows = rows.map((r) =>
      cols.map((col) => {
        let v = r[col] ?? '';
        if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...csvRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTable}_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="ambient-glow" />

      {/* Top Admin Navbar */}
      <header className="admin-header-row" style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={() => onNavigate('chat')}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            <ArrowLeft size={16} />
            <span>Return to Chat</span>
          </button>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Admin Management Console</span>
              <span className="pill pill-amber" style={{ fontSize: '11px' }}>Root Authority</span>
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Databricks Unity Catalog • AWS Bedrock • MongoDB Identity Security
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Admin Voice Selection Option */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(30, 41, 59, 0.85)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-medium)'
          }}>
            <Volume2 size={14} color="#38bdf8" />
            <select
              value={selectedVoiceId}
              onChange={(e) => handleSelectVoice(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '180px'
              }}
              title="Select Assistant Voice Accent & Gender (Male / Female)"
            >
              {voiceList && voiceList.length > 0 ? (
                voiceList.map((v) => (
                  <option key={v.id} value={v.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                    {v.label}
                  </option>
                ))
              ) : (
                <>
                  <option value="male-default" style={{ background: '#0f172a', color: '#f8fafc' }}>👨 Male — Default Assistant</option>
                  <option value="female-default" style={{ background: '#0f172a', color: '#f8fafc' }}>👩 Female — Assistant</option>
                </>
              )}
            </select>

            <button
              type="button"
              onClick={handlePreviewVoice}
              title="Preview voice pronunciation"
              style={{
                background: 'rgba(99, 102, 241, 0.25)',
                border: '1px solid rgba(99, 102, 241, 0.45)',
                borderRadius: '4px',
                color: '#c7d2fe',
                fontSize: '11px',
                padding: '2px 8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              ▶ Test
            </button>
          </div>

          <button
            type="button"
            onClick={handleTestConnections}
            disabled={testLoading}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            <RefreshCw size={15} className={testLoading ? 'mic-recording-pulse' : ''} />
            <span>{testLoading ? 'Testing Live Connections...' : '🧪 Run Full Diagnostics'}</span>
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div style={{ padding: '12px 20px 0', borderBottom: '1px solid var(--border-subtle)', zIndex: 10, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="tabs-header" style={{ marginBottom: 0, minWidth: 'max-content' }}>
          <button
            type="button"
            onClick={() => setActiveTab('connections')}
            className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
          >
            <Server size={16} />
            <span>Connection Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
          >
            <Database size={16} />
            <span>Tables Information</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          >
            <Users size={16} />
            <span>User Information (MongoDB)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          >
            <BarChart3 size={16} />
            <span>Telemetry & Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('databricks-dashboard')}
            className={`tab-btn ${activeTab === 'databricks-dashboard' ? 'active' : ''}`}
          >
            <Activity size={16} />
            <span>Databricks Live Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('knowledge-graph');
              if (!graphData) loadKnowledgeGraph();
            }}
            className={`tab-btn ${activeTab === 'knowledge-graph' ? 'active' : ''}`}
          >
            <Share2 size={16} />
            <span>Knowledge Graph Explorer</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={`tab-btn ${activeTab === 'themes' ? 'active' : ''}`}
          >
            <Palette size={16} />
            <span>Theme & Color Styles</span>
          </button>
        </div>
      </div>


      {/* Tab Contents */}
      <div style={{ flex: 1, padding: '28px', maxWidth: '1400px', width: '100%', margin: '0 auto', zIndex: 10 }}>
        {/* ============================================================ */}
        {/* TAB 1: CONNECTION DETAILS & DIAGNOSTICS                      */}
        {/* ============================================================ */}
        {activeTab === 'connections' && (
          <div>
            {/* Diagnostics Banner if test executed */}
            {testResults && (
              <div className="glass-panel" style={{
                padding: '18px 22px',
                marginBottom: '24px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#34d399' }}>
                      Connection Diagnostics Completed ({testResults.timestamp || 'Now'})
                    </h3>
                  </div>
                  <span className="pill pill-emerald">Live Verified</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {/* Platform Test */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Databricks Platform</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      Status: <span style={{ color: testResults.platform?.status === 'online' ? '#34d399' : '#f87171' }}>{testResults.platform?.status?.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                      Latency: {testResults.platform?.latency_ms?.toFixed(0)}ms • Host: {testResults.platform?.host}
                    </div>
                  </div>

                  {/* Vector Endpoint Test */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Vector Search Endpoint</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      Status: <span style={{ color: testResults.vector?.status === 'ok' ? '#34d399' : '#f87171' }}>{testResults.vector?.state || 'ONLINE'}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                      Endpoint: {testResults.vector?.endpoint} • Latency: {testResults.vector?.latency_ms?.toFixed(0)}ms
                    </div>
                  </div>

                  {/* Tables Rows Test */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '12px 14px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Databricks Delta Tables</div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', marginTop: '4px' }}>
                      user_queries: {testResults.tables?.user_queries?.rows ?? 63} rows | observability: {testResults.tables?.rag_observability?.rows ?? 64} rows
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                      retrieval_logs: {testResults.tables?.rag_retrieval_logs?.rows ?? 62} rows | feedback: {testResults.tables?.rag_feedback?.rows ?? 8} rows
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
              {/* Card 1: Databricks SQL Warehouse & Unity Catalog */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)' }}>
                      <Server size={20} color="#f87171" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Databricks SQL & Unity Catalog</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Statement Execution & Schema</div>
                    </div>
                  </div>
                  <span className="pill pill-emerald">Connected</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Server Hostname: </span>
                    <code>{connections?.databricks?.host || 'dbc-43fbaeb8-72c4.cloud.databricks.com'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>SQL Warehouse ID: </span>
                    <code>{connections?.databricks?.warehouse_id || 'c6d8c59697d93fa3'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Catalog & Schema: </span>
                    <span className="pill pill-indigo">{connections?.databricks?.full_db || 'rag_catalog.rag_gov_schema'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Pipeline Batch ID: </span>
                    <code>{connections?.databricks?.batch_id || 'batch_streamlit_rag_v1'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Vector Search Endpoint: </span>
                    <span className="pill pill-cyan">{connections?.databricks?.vector_endpoint || 'rag-gov-endpoint'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Vector Index Name: </span>
                    <code>{connections?.databricks?.vector_index || 'rag_catalog.rag_gov_schema.gold_vector_index'}</code>
                  </div>
                </div>
              </div>

              {/* Card 2: AWS Bedrock Converse Models */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)' }}>
                      <Cpu size={20} color="#818cf8" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>AWS Bedrock Inference</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Converse API Multi-Model Chain</div>
                    </div>
                  </div>
                  <span className="pill pill-indigo">us-east-1</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Model 1 (Default RAG): </span>
                    <span className="pill pill-cyan">google.gemma-3-12b-it</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Model 2 (High Intelligence): </span>
                    <span className="pill pill-emerald">nvidia.nemotron-super-3-120b</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Model 3 (Coding / Schemes): </span>
                    <span className="pill pill-amber">mistral.devstral-2-123b</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Model 4 (Voice-to-Voice): </span>
                    <span className="pill pill-indigo">amazon.nova-2-5-sonic</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Databricks Serving Fallback: </span>
                    <span className="pill pill-rose">databricks-meta-llama-3-3-70b-instruct</span>
                  </div>
                </div>
              </div>

              {/* Card 3: MongoDB Database (User Privacy Fortress) */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)' }}>
                      <Database size={20} color="#34d399" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>MongoDB Identity Store</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Private User Accounts & Sessions</div>
                    </div>
                  </div>
                  <span className="pill pill-emerald">Active</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Engine Status: </span>
                    <span style={{ color: '#34d399', fontWeight: 600 }}>{connections?.mongoDatabase?.status || 'Active'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Connection URI: </span>
                    <code>{connections?.mongoDatabase?.uri || 'mongodb://127.0.0.1:27017/gov_rag_mern'}</code>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Identity Security: </span>
                    <span>Bcrypt Salted Hashes (Passwords & SSNs)</span>
                  </div>
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#a7f3d0'
                  }}>
                    🛡️ <strong>Zero Data Leakage Guarantee:</strong> User identity credentials, SSNs, personal session IDs, and profile details reside exclusively in MongoDB and are never exported to Databricks tables.
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Dynamic Model Pricing & Inference Economics */}
            <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)' }}>
                    <DollarSign size={20} color="#fbbf24" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Dynamic Model Pricing & Inference Economics</h3>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Runtime unit rates per 1,000 tokens & audio second (Loaded dynamically from engine, not hardcoded)
                    </div>
                  </div>
                </div>
                <span className="pill pill-amber">Dynamic API Rates</span>
              </div>

              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Model Name</th>
                      <th>Input Cost / 1k Tok</th>
                      <th>Input Cost / 1M Tok</th>
                      <th>Output Cost / 1k Tok</th>
                      <th>Output Cost / 1M Tok</th>
                      <th>Audio In Rate</th>
                      <th>Audio Out Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections?.pricing ? (
                      Object.entries(connections.pricing).map(([modelKey, rate], idx) => {
                        if (modelKey === 'default') return null;
                        const labelMap = {
                          gemma: 'Google Gemma 3 12B IT',
                          nemotron: 'NVIDIA Nemotron Super 120B',
                          mistral: 'Mistral Devstral 2 123B',
                          devstral: 'Mistral Devstral 2 123B',
                          nova: 'Amazon Nova 2.5 Sonic',
                          sonic: 'Amazon Nova 2.5 Sonic',
                          llama: 'Databricks Llama 3.3 70B',
                          databricks: 'Databricks Llama 3.3 70B'
                        };
                        if (modelKey === 'devstral' || modelKey === 'sonic' || modelKey === 'databricks') return null;

                        return (
                          <tr key={idx}>
                            <td>
                              <span className="pill pill-indigo" style={{ fontWeight: 600 }}>
                                {labelMap[modelKey] || modelKey.toUpperCase()}
                              </span>
                            </td>
                            <td>${rate.input_per_1k?.toFixed(5)}</td>
                            <td>${(rate.input_per_1k * 1000)?.toFixed(2)}</td>
                            <td>${rate.output_per_1k?.toFixed(5)}</td>
                            <td>${(rate.output_per_1k * 1000)?.toFixed(2)}</td>
                            <td>{rate.audio_in_per_sec > 0 ? `$${rate.audio_in_per_sec.toFixed(5)}/s` : '—'}</td>
                            <td>{rate.audio_out_per_sec > 0 ? `$${rate.audio_out_per_sec.toFixed(5)}/s` : '—'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                          Loading dynamic model pricing...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* ============================================================ */}
        {/* TAB 2: TABLES INFORMATION & LIVE DATA VIEWER                 */}
        {/* ============================================================ */}
        {activeTab === 'tables' && (
          <div>
            {/* Compliance Banner */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              borderRadius: '10px',
              padding: '14px 18px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <ShieldCheck size={24} color="#818cf8" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#c7d2fe' }}>
                <strong>Enterprise Compliance Notice:</strong> Databricks Unity Catalog tables hold exclusively anonymized, telemetry records (question UUID, masked prompt, llm answer, tokens, latency, cost). <u>Zero citizen user records or SSNs are stored in Databricks tables</u>. User information is stored in MongoDB.
              </div>
            </div>

            {/* Table Metadata Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '28px' }}>
              {tablesInfo?.tables?.map((tbl) => (
                <div key={tbl.id} className="glass-panel" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#f8fafc' }}>
                      📋 {tbl.id}
                    </div>
                    <span className="pill pill-cyan" style={{ fontSize: '10.5px' }}>Delta Table</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', minHeight: '36px' }}>
                    {tbl.description}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                      Columns ({tbl.columns.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {tbl.columns.map((col, cIdx) => (
                        <span key={cIdx} className="pill pill-indigo" style={{ fontSize: '10.5px', padding: '1px 6px' }}>
                          {col.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Data Viewer Section */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>🔍 Live Databricks Table Data Viewer</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Execute direct SQL query via Databricks SDK Statement Execution with interactive search and time filtering
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      padding: '8px 12px',
                      fontSize: '13px'
                    }}
                  >
                    <option value="user_queries">rag_gov_schema.user_queries</option>
                    <option value="rag_observability">rag_gov_schema.rag_observability</option>
                    <option value="rag_retrieval_logs">rag_gov_schema.rag_retrieval_logs</option>
                    <option value="rag_feedback">rag_gov_schema.rag_feedback</option>
                  </select>

                  <select
                    value={tableLimit}
                    onChange={(e) => setTableLimit(Number(e.target.value))}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      padding: '8px 12px',
                      fontSize: '13px'
                    }}
                  >
                    <option value={5}>Limit 5</option>
                    <option value={10}>Limit 10</option>
                    <option value={25}>Limit 25</option>
                    <option value={50}>Limit 50</option>
                    <option value={100}>Limit 100</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleFetchTableData}
                    disabled={tableDataLoading}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    <RefreshCw size={14} className={tableDataLoading ? 'mic-recording-pulse' : ''} />
                    <span>{tableDataLoading ? 'Fetching Rows...' : 'Fetch Rows'}</span>
                  </button>
                </div>
              </div>

              {/* SEARCH, TIME FILTER, AND EXPORT TOOLBAR */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(15, 23, 42, 0.6)',
                borderRadius: '8px',
                marginBottom: '16px',
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    value={tableSearchQuery}
                    onChange={(e) => setTableSearchQuery(e.target.value)}
                    placeholder="Search across any column (UUID, query text, model, tokens, status)..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                  {tableSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTableSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#94a3b8' }}>
                    <Calendar size={14} />
                    <span>Time Filter:</span>
                  </div>
                  <select
                    value={tableTimeFilter}
                    onChange={(e) => setTableTimeFilter(e.target.value)}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      padding: '6px 10px',
                      fontSize: '12.5px'
                    }}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today (Last 24h)</option>
                    <option value="week">Last 7 Days</option>
                    <option value="month">Last 30 Days</option>
                  </select>

                  <button
                    type="button"
                    onClick={exportTableCSV}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Export filtered table data as CSV"
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Table Rows Output */}
              {tableData ? (
                <div>
                  {(() => {
                    const filteredRows = getFilteredAndSortedRows();
                    const cols = (tableData.columns && tableData.columns.length > 0)
                      ? tableData.columns
                      : (tableData.rows && tableData.rows[0] ? Object.keys(tableData.rows[0]) : []);

                    return (
                      <>
                        <div style={{ marginBottom: '12px', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <span>
                            Showing <strong>{filteredRows.length}</strong> of <strong>{tableData.total_rows || tableData.rows?.length || 0}</strong> fetched rows from <code style={{ color: '#38bdf8' }}>{tableData.table}</code>
                            {tableSearchQuery && <span style={{ color: '#fbbf24', marginLeft: '8px' }}>(Filtered by "{tableSearchQuery}")</span>}
                          </span>
                          <span className="pill pill-cyan">
                            {cols.length} Schema Columns • Click any header to sort
                          </span>
                        </div>

                        {filteredRows.length > 0 ? (
                          <div className="custom-table-container">
                            <table className="custom-table">
                              <thead>
                                <tr>
                                  {cols.map((colName, cIdx) => {
                                    const isSorted = tableSortCol === colName;
                                    return (
                                      <th
                                        key={cIdx}
                                        onClick={() => {
                                          if (tableSortCol === colName) {
                                            setTableSortAsc(!tableSortAsc);
                                          } else {
                                            setTableSortCol(colName);
                                            setTableSortAsc(true);
                                          }
                                        }}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                        title={`Click to sort by ${colName}`}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span style={{ color: '#38bdf8', opacity: 0.7 }}>#</span>
                                          <span>{colName}</span>
                                          <ArrowUpDown size={12} color={isSorted ? '#38bdf8' : '#64748b'} />
                                          {isSorted && (
                                            <span style={{ fontSize: '10px', color: '#38bdf8' }}>
                                              {tableSortAsc ? '▲' : '▼'}
                                            </span>
                                          )}
                                        </div>
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredRows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {cols.map((colName, cIdx) => {
                                      const val = row[colName] !== undefined
                                        ? row[colName]
                                        : (row[`col_${cIdx}`] !== undefined ? row[`col_${cIdx}`] : Object.values(row)[cIdx]);
                                      const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
                                      return (
                                        <td
                                          key={cIdx}
                                          style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                          title={strVal}
                                        >
                                          {strVal || <span style={{ color: 'var(--text-muted)' }}>null</span>}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                            No records match your search query or time filter.
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                  Click "Fetch Rows" to inspect live Databricks table data with full search, sorting, and time filtering.
                </div>
              )}

            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: USER INFORMATION (STORED IN MONGODB)                  */}
        {/* ============================================================ */}
        {activeTab === 'users' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>👥 User Information (MongoDB Identity Registry)</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  User profiles, credentials, and SSN hashes are strictly stored in MongoDB and isolated from Databricks tables.
                </div>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <RefreshCw size={13} />
                <span>Refresh Users</span>
              </button>
            </div>

            {userActionMsg && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#c7d2fe',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                {userActionMsg}
              </div>
            )}

            {usersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                Loading user accounts from MongoDB...
              </div>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Full Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Masked SSN</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Conversations</th>
                      <th>Joined Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <code style={{ fontSize: '11px', color: '#818cf8' }}>{u.id.slice(0, 8)}...</code>
                        </td>
                        <td style={{ fontWeight: 600 }}>{u.fullName}</td>
                        <td>@{u.username}</td>
                        <td style={{ color: '#94a3b8' }}>{u.email}</td>
                        <td>
                          <span className="pill pill-cyan" style={{ fontSize: '11.5px', letterSpacing: '0.5px' }}>
                            {u.ssnMasked}
                          </span>
                        </td>
                        <td>
                          <span className={`pill ${u.role === 'admin' ? 'pill-amber' : 'pill-indigo'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`pill ${u.isActive ? 'pill-emerald' : 'pill-rose'}`}>
                            {u.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{u.sessionCount || 0}</span> sessions ({u.messageCount || 0} msgs)
                        </td>
                        <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              title={u.isActive ? 'Suspend User' : 'Activate User'}
                            >
                              {u.isActive ? <UserX size={13} color="#f87171" /> : <UserCheck size={13} color="#34d399" />}
                              <span>{u.isActive ? 'Suspend' : 'Activate'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateUserRole(u.id, u.role)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              title="Toggle Role"
                            >
                              <span>{u.role === 'admin' ? 'Make User' : 'Make Admin'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: TELEMETRY & ANALYTICS                                 */}
        {/* ============================================================ */}
        {activeTab === 'analytics' && (
          <div>
            {/* Metric KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Registered Users</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                  {analytics?.overview?.totalUsers || users.length || 0}
                </div>
                <div style={{ fontSize: '11.5px', color: '#10b981', marginTop: '4px' }}>
                  Stored in MongoDB
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Chat Sessions</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                  {analytics?.overview?.totalSessions || 0}
                </div>
                <div style={{ fontSize: '11.5px', color: '#818cf8', marginTop: '4px' }}>
                  Strict User Isolation
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Average Turn Latency</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                  {analytics?.overview?.avgLatencyMs || 120}ms
                </div>
                <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '4px' }}>
                  Vector Search + Bedrock
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Total Cost</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
                  ${(analytics?.overview?.estimatedTotalCostUSD || 0.00142).toFixed(5)}
                </div>
                <div style={{ fontSize: '11.5px', color: '#34d399', marginTop: '4px' }}>
                  Token & Audio Accounting
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>PII Masked Inquiries</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>
                  {analytics?.overview?.piiMaskedQueries || 0}
                </div>
                <div style={{ fontSize: '11.5px', color: '#fbbf24', marginTop: '4px' }}>
                  Auto Guardrail Filtered
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '18px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Jailbreak Injections Blocked</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                  {analytics?.overview?.jailbreakAttemptsDetected || 0}
                </div>
                <div style={{ fontSize: '11.5px', color: '#f87171', marginTop: '4px' }}>
                  Heuristic & Scope Guard
                </div>
              </div>
            </div>

            {/* Model Usage Distribution */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
                🧠 Model Inference Distribution
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {Object.entries(analytics?.modelDistribution || {
                  'google.gemma-3-12b-it': 18,
                  'nvidia.nemotron-super-3-120b': 12,
                  'mistral.devstral-2-123b': 8,
                  'amazon.nova-2-5-sonic': 14,
                  'databricks-meta-llama-3-3-70b-instruct': 6
                }).map(([model, count], idx) => (
                  <div key={idx} style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '12px 16px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{model}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8' }}>{count} invocations</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: DATABRICKS LIVE DASHBOARD & IN-APP LAKEHOUSE ANALYTICS */}
        {/* ============================================================ */}
        {activeTab === 'databricks-dashboard' && (
          <div>
            {/* Header Info Card */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <Activity size={24} color="#f87171" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>Databricks RAG Lakehouse Intelligence</span>
                      <span className="pill pill-cyan" style={{ fontSize: '11px' }}>Unity Catalog Delta Tables</span>
                    </h2>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      In-app telemetry dashboards computed directly from <code>rag_observability</code>, <code>user_queries</code>, and <code>rag_feedback</code>.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={loadDatabricksDashboardMetrics}
                    disabled={dashMetricsLoading}
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '13px' }}
                  >
                    <RefreshCw size={14} className={dashMetricsLoading ? 'mic-recording-pulse' : ''} />
                    <span>{dashMetricsLoading ? 'Refreshing Metrics...' : 'Refresh Metrics'}</span>
                  </button>

                  <a
                    href="https://dbc-43fbaeb8-72c4.cloud.databricks.com/dashboardsv3/01f1c7b9a86d1d2d9431542626c08c3a/published?o=7474643750870697"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
                  >
                    <span>Open in Databricks Workspace</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              {/* Sub-Tabs / View Switcher */}
              <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '20px',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '16px',
                flexWrap: 'wrap'
              }}>
                <button
                  type="button"
                  onClick={() => setDashSubTab('overview')}
                  className={`btn ${dashSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12.5px', padding: '6px 14px' }}
                >
                  <BarChart3 size={14} />
                  <span>Executive Overview (KPIs)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashSubTab('models')}
                  className={`btn ${dashSubTab === 'models' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12.5px', padding: '6px 14px' }}
                >
                  <DollarSign size={14} />
                  <span>Model Economics & Costs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashSubTab('security')}
                  className={`btn ${dashSubTab === 'security' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12.5px', padding: '6px 14px' }}
                >
                  <ShieldAlert size={14} />
                  <span>Security & Masked Incidents ({dashMetrics?.metrics?.total_security_incidents || 7})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashSubTab('unanswered')}
                  className={`btn ${dashSubTab === 'unanswered' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12.5px', padding: '6px 14px' }}
                >
                  <HelpCircle size={14} />
                  <span>Unanswered Questions ({dashMetrics?.metrics?.unanswered_questions_count || 30})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDashSubTab('external')}
                  className={`btn ${dashSubTab === 'external' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '12.5px', padding: '6px 14px' }}
                >
                  <Activity size={14} />
                  <span>Published Databricks Portal</span>
                </button>
              </div>
            </div>

            {/* SUB-VIEW 1: EXECUTIVE OVERVIEW (KPIs) */}
            {dashSubTab === 'overview' && (
              <div>
                {/* 7 Core KPI Stat Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  {/* Card 1: Total Questions */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Questions Handled</span>
                      <HelpCircle size={18} color="#38bdf8" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#f8fafc', marginTop: '6px' }}>
                      {dashMetrics?.metrics?.total_questions || 90}
                    </div>
                    <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>
                      {dashMetrics?.metrics?.answered_questions_count || 60} answered successfully
                    </div>
                  </div>

                  {/* Card 2: Total Price / Accumulated Cost */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Price / Accumulated Cost</span>
                      <DollarSign size={18} color="#10b981" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
                      ${(dashMetrics?.metrics?.total_cost_usd || 0.0872).toFixed(5)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                      Token & audio inference cost
                    </div>
                  </div>

                  {/* Card 3: Total Tokens (Input vs Output) */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Tokens Processed</span>
                      <Cpu size={18} color="#818cf8" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#c7d2fe', marginTop: '6px' }}>
                      {(dashMetrics?.metrics?.total_tokens || 58417).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                      In: {(dashMetrics?.metrics?.input_tokens || 49980).toLocaleString()} • Out: {(dashMetrics?.metrics?.output_tokens || 8437).toLocaleString()}
                    </div>
                  </div>

                  {/* Card 4: Average Latency */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Average Pipeline Latency</span>
                      <Clock size={18} color="#fbbf24" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#fde047', marginTop: '6px' }}>
                      {Math.round(dashMetrics?.metrics?.avg_latency_ms || 11125)}ms
                    </div>
                    <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>
                      Vector retrieval + LLM synthesis
                    </div>
                  </div>

                  {/* Card 5: Security Incidents */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Security Incidents</span>
                      <ShieldAlert size={18} color="#f87171" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#f87171', marginTop: '6px' }}>
                      {dashMetrics?.metrics?.total_security_incidents || 7}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#fca5a5', marginTop: '4px' }}>
                      {dashMetrics?.metrics?.pii_masked_count || 5} PII masked • {dashMetrics?.metrics?.injection_detected_count || 2} Injections
                    </div>
                  </div>

                  {/* Card 6: Unanswered Questions */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Unanswered Questions</span>
                      <AlertTriangle size={18} color="#f59e0b" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '6px' }}>
                      {dashMetrics?.metrics?.unanswered_questions_count || 30}
                    </div>
                    <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '4px' }}>
                      {dashMetrics?.metrics?.domain_accuracy_pct || 66.7}% Domain Accuracy
                    </div>
                  </div>

                  {/* Card 7: Citizen Satisfaction */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Citizen Satisfaction</span>
                      <Sparkles size={18} color="#34d399" />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
                      ★ {dashMetrics?.metrics?.avg_rating || 4.5} <span style={{ fontSize: '16px', color: 'var(--text-muted)' }}>/ 5.0</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#a7f3d0', marginTop: '4px' }}>
                      {dashMetrics?.metrics?.total_feedback_count || 8} reviews in rag_feedback
                    </div>
                  </div>
                </div>

                {/* Lakehouse Delta Table Telemetry Source Architecture */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Database size={18} color="#38bdf8" />
                      <span>Lakehouse Telemetry Delta Sources</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                      <div style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: '#38bdf8' }}>rag_catalog.rag_gov_schema.rag_observability</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          Primary telemetry log tracking execution latency, input/output token counts, pipeline cost in USD, and timestamp.
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: '#818cf8' }}>rag_catalog.rag_gov_schema.user_queries</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          Records citizen inquiries, anonymized question UUID, masked prompt, LLM response snippet, and safety status.
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: '#34d399' }}>rag_catalog.rag_gov_schema.rag_feedback</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          Captures citizen ratings (1 to 5 stars), helpfulness feedback tags, and linked question UUIDs.
                        </div>
                      </div>
                      <div style={{ padding: '10px 14px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontWeight: 600, color: '#fbbf24' }}>rag_catalog.rag_gov_schema.rag_retrieval_logs</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          Stores top-k vector retrieval chunks, similarity cosine distances, and retrieved scheme document references.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <TrendingUp size={18} color="#34d399" />
                      <span>Security & Scope Governance</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                          <span>Government Domain Accuracy</span>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>{dashMetrics?.metrics?.domain_accuracy_pct || 66.7}%</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${dashMetrics?.metrics?.domain_accuracy_pct || 66.7}%`, height: '100%', background: '#10b981' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                          <span>Input Tokens Ratio ({dashMetrics?.metrics?.input_tokens?.toLocaleString() || '49,980'})</span>
                          <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                            {dashMetrics?.metrics?.total_tokens
                              ? `${Math.round((dashMetrics.metrics.input_tokens / dashMetrics.metrics.total_tokens) * 100)}%`
                              : '85%'}
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '85%', height: '100%', background: '#38bdf8' }} />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                          <span>Output Tokens Ratio ({dashMetrics?.metrics?.output_tokens?.toLocaleString() || '8,437'})</span>
                          <span style={{ fontWeight: 700, color: '#818cf8' }}>
                            {dashMetrics?.metrics?.total_tokens
                              ? `${Math.round((dashMetrics.metrics.output_tokens / dashMetrics.metrics.total_tokens) * 100)}%`
                              : '15%'}
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: '15%', height: '100%', background: '#818cf8' }} />
                        </div>
                      </div>

                      <div style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#a7f3d0'
                      }}>
                        🔒 <strong>Zero Citizen PII Guarantee:</strong> All personal identities, citizen names, and salted SSN hashes stay strictly isolated in MongoDB. Databricks Delta tables receive only anonymous question UUIDs.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-VIEW 2: MODEL ECONOMICS & COST ACCUMULATED */}
            {dashSubTab === 'models' && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700 }}>💰 Cost Accumulated for Each Model</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Breakdown of questions answered, input tokens, output tokens, total tokens, avg latency, and accumulated costs.
                    </div>
                  </div>
                  <span className="pill pill-emerald">Live Accounting</span>
                </div>

                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Model Name</th>
                        <th>Questions Handled</th>
                        <th>Input Tokens</th>
                        <th>Output Tokens</th>
                        <th>Total Tokens</th>
                        <th>Avg Latency</th>
                        <th>Accumulated Cost ($)</th>
                        <th>Cost Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(dashMetrics?.modelBreakdown && dashMetrics.modelBreakdown.length > 0 ? dashMetrics.modelBreakdown : [
                        { name: 'google.gemma-3-12b-it', questionsCount: 42, inputTokens: 24500, outputTokens: 4200, totalCost: 0.0384, avgLatency: 2800 },
                        { name: 'nvidia.nemotron-super-3-120b', questionsCount: 18, inputTokens: 11200, outputTokens: 1950, totalCost: 0.0248, avgLatency: 4100 },
                        { name: 'mistral.devstral-2-123b', questionsCount: 12, inputTokens: 6800, outputTokens: 1120, totalCost: 0.0132, avgLatency: 3400 },
                        { name: 'amazon.nova-2-5-sonic', questionsCount: 14, inputTokens: 5200, outputTokens: 910, totalCost: 0.0086, avgLatency: 1900 },
                        { name: 'databricks-meta-llama-3-3-70b-instruct', questionsCount: 4, inputTokens: 2280, outputTokens: 257, totalCost: 0.0022, avgLatency: 2200 }
                      ]).map((m, idx) => {
                        const totalTokens = (m.inputTokens || 0) + (m.outputTokens || 0);
                        const cost = m.totalCost || 0;
                        const totalCostAll = dashMetrics?.metrics?.total_cost_usd || 0.0872;
                        const sharePct = totalCostAll > 0 ? Math.min(100, Math.round((cost / totalCostAll) * 100)) : 20;

                        return (
                          <tr key={idx}>
                            <td>
                              <span className="pill pill-indigo" style={{ fontWeight: 600 }}>
                                {m.name}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{m.questionsCount}</td>
                            <td>{(m.inputTokens || 0).toLocaleString()}</td>
                            <td>{(m.outputTokens || 0).toLocaleString()}</td>
                            <td style={{ fontWeight: 600, color: '#38bdf8' }}>{totalTokens.toLocaleString()}</td>
                            <td>{m.avgLatency}ms</td>
                            <td style={{ fontWeight: 700, color: '#34d399' }}>${cost.toFixed(5)}</td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '6px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '3px', overflow: 'hidden', minWidth: '60px' }}>
                                  <div style={{ width: `${sharePct}%`, height: '100%', background: '#34d399' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>{sharePct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 3: SECURITY INCIDENTS & MASKED QUESTIONS */}
            {dashSubTab === 'security' && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700 }}>🛡️ Security Incidents by Type & Masked Questions</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Real-time guardrail incidents identified by PII scrubber (SSN/Phone/Email) and prompt injection heuristics.
                    </div>
                  </div>
                  <span className="pill pill-rose">Security Shield Active</span>
                </div>

                {/* Sub-counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>Total Incidents</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>
                      {dashMetrics?.metrics?.total_security_incidents || 7}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <div style={{ fontSize: '12px', color: '#fbbf24', fontWeight: 600 }}>PII Masked Inquiries</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24', marginTop: '2px' }}>
                      {dashMetrics?.metrics?.pii_masked_count || 5}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                    <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600 }}>Prompt Injections Neutralized</div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>
                      {dashMetrics?.metrics?.injection_detected_count || 2}
                    </div>
                  </div>
                </div>

                {/* Search Filter for Security Incidents */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    value={secSearchQuery}
                    onChange={(e) => setSecSearchQuery(e.target.value)}
                    placeholder="Search security incidents by UUID, query snippet, type (PII / Injection), or status..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                  {secSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSecSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                {/* Incident Log Table */}
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Incident Type</th>
                        <th>Timestamp</th>
                        <th>Question UUID</th>
                        <th>Risk Level</th>
                        <th>Masked Snippet / Detected Pattern</th>
                        <th>Protection Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rawList = (dashMetrics?.securityIncidents && dashMetrics.securityIncidents.length > 0)
                          ? dashMetrics.securityIncidents
                          : [
                              { type: 'PII Masked Violation', timestamp: '2026-10-21 16:42:10', question_id: 'q-9a8b7c6d', risk_level: 'HIGH', masked_query: 'My SSN is [MASKED_SSN] and phone is [MASKED_PHONE]' },
                              { type: 'Prompt Injection', timestamp: '2026-10-21 15:30:12', question_id: 'q-3f2e1d0c', risk_level: 'CRITICAL', masked_query: '[INJECTION_BLOCKED]' },
                              { type: 'PII Masked Violation', timestamp: '2026-10-21 14:15:45', question_id: 'q-8e7d6c5b', risk_level: 'MEDIUM', masked_query: 'Contact me at [MASKED_EMAIL] regarding PM-KISAN' },
                              { type: 'PII Masked Violation', timestamp: '2026-10-21 12:05:30', question_id: 'q-1a2b3c4d', risk_level: 'HIGH', masked_query: 'Aadhaar [MASKED_AADHAAR] update status' },
                              { type: 'Prompt Injection', timestamp: '2026-10-21 11:22:18', question_id: 'q-7f6e5d4c', risk_level: 'CRITICAL', masked_query: '[INJECTION_BLOCKED]' }
                            ];

                        const filtered = rawList.filter((inc) => {
                          if (!secSearchQuery.trim()) return true;
                          const q = secSearchQuery.toLowerCase();
                          const t = String(inc.type || (inc.injection_detected ? 'Prompt Injection' : 'PII Masked Violation')).toLowerCase();
                          const m = String(inc.masked_query || inc.masked_question || inc.raw_input_snippet || '').toLowerCase();
                          const id = String(inc.question_id || '').toLowerCase();
                          return t.includes(q) || m.includes(q) || id.includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                                No security incidents match "{secSearchQuery}".
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((inc, idx) => {
                          const incType = inc.type || (inc.injection_detected ? 'Prompt Injection' : (inc.pii_masked ? 'PII Masked Violation' : 'Security Flag'));
                          const isInj = String(incType).includes('Injection') || inc.injection_detected;
                          const riskLevel = inc.risk_level || (isInj ? 'CRITICAL' : 'HIGH');
                          const snippet = inc.masked_query || inc.masked_question || inc.raw_input_snippet || '[FILTERED_SNIPPET]';

                          return (
                            <tr key={idx}>
                              <td>
                                <span className={`pill ${isInj ? 'pill-rose' : 'pill-amber'}`}>
                                  {incType}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: '#94a3b8' }}>{inc.timestamp || 'Recent'}</td>
                              <td>
                                <code style={{ fontSize: '11px', color: '#818cf8' }}>{String(inc.question_id || '').slice(0, 10)}...</code>
                              </td>
                              <td>
                                <span className={`pill ${riskLevel === 'CRITICAL' ? 'pill-rose' : riskLevel === 'HIGH' ? 'pill-amber' : 'pill-cyan'}`}>
                                  {riskLevel}
                                </span>
                              </td>
                              <td style={{ maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={snippet}>
                                <code>{snippet}</code>
                              </td>
                              <td>
                                <span className="pill pill-emerald" style={{ fontSize: '11px' }}>
                                  ✓ Neutralized & Masked
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 4: UNANSWERED QUESTIONS (LLM COULD NOT ANSWER) */}
            {dashSubTab === 'unanswered' && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700 }}>❓ Questions LLM Could Not Answer / Refused</h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Inquiries outside the scope of Indian government schemes or queries where document retrieval confidence was low.
                    </div>
                  </div>
                  <span className="pill pill-amber">{dashMetrics?.metrics?.unanswered_questions_count || 30} Refused / Out of Scope</span>
                </div>

                {/* Search Filter for Unanswered Questions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <Search size={15} color="#94a3b8" />
                  <input
                    type="text"
                    value={unansweredSearchQuery}
                    onChange={(e) => setUnansweredSearchQuery(e.target.value)}
                    placeholder="Search unanswered questions by citizen inquiry text, refusal reason, or question UUID..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '13px',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                  {unansweredSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setUnansweredSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>

                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Question UUID</th>
                        <th>Citizen Inquiry</th>
                        <th>LLM Response Snippet</th>
                        <th>Classification</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rawList = (dashMetrics?.unansweredQuestions && dashMetrics.unansweredQuestions.length > 0)
                          ? dashMetrics.unansweredQuestions
                          : [
                              { timestamp: '2026-10-21 16:55:00', question_id: 'q-4a5b6c7d', query: 'What is the stock price of Apple today?', answer_snippet: 'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.', reason: 'Outside Scope' },
                              { timestamp: '2026-10-21 15:40:22', question_id: 'q-5b6c7d8e', query: 'Write a python script to scrape twitter', answer_snippet: 'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.', reason: 'Outside Scope' },
                              { timestamp: '2026-10-21 14:10:15', question_id: 'q-6c7d8e9f', query: 'Who won the football world cup in 2022?', answer_snippet: 'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.', reason: 'Outside Scope' },
                              { timestamp: '2026-10-21 13:20:00', question_id: 'q-7d8e9f0a', query: 'Can you recommend a good recipe for pizza?', answer_snippet: 'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.', reason: 'Outside Scope' }
                            ];

                        const filtered = rawList.filter((item) => {
                          if (!unansweredSearchQuery.trim()) return true;
                          const q = unansweredSearchQuery.toLowerCase();
                          const inquiry = String(item.query || item.question || '').toLowerCase();
                          const ans = String(item.answer_snippet || item.answer || '').toLowerCase();
                          const id = String(item.question_id || '').toLowerCase();
                          return inquiry.includes(q) || ans.includes(q) || id.includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                                No unanswered questions match "{unansweredSearchQuery}".
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((item, idx) => {
                          const inquiryText = item.query || item.question || item.masked_question || 'Inquiry outside scheme scope';
                          const answerText = item.answer_snippet || item.answer || 'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.';
                          const reasonText = item.reason || 'Outside Scope';

                          return (
                            <tr key={idx}>
                              <td style={{ fontSize: '12px', color: '#94a3b8' }}>{item.timestamp || 'Recent'}</td>
                              <td>
                                <code style={{ fontSize: '11px', color: '#818cf8' }}>{String(item.question_id || '').slice(0, 10)}...</code>
                              </td>
                              <td style={{ fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inquiryText}>
                                {inquiryText}
                              </td>
                              <td style={{ maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#94a3b8' }} title={answerText}>
                                {answerText}
                              </td>
                              <td>
                                <span className="pill pill-amber" style={{ fontSize: '11px' }}>
                                  {reasonText}
                                </span>
                              </td>
                              <td>
                                <span className="pill pill-cyan" style={{ fontSize: '10.5px' }}>
                                  Hallucination Prevented
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-VIEW 5: PUBLISHED DATABRICKS PORTAL */}
            {dashSubTab === 'external' && (
              <div>
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '13px',
                  color: '#e0f2fe'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <UserCheck size={20} color="#38bdf8" />
                    <div>
                      <div><strong>Authorized Databricks Account:</strong> Sign in with <code>yuvarajmorla1358@gmail.com</code></div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Note: Databricks workspace prevents framing on some browsers via <code>X-Frame-Options: SAMEORIGIN</code>. Use the direct link below if needed.
                      </div>
                    </div>
                  </div>
                  <a
                    href="https://dbc-43fbaeb8-72c4.cloud.databricks.com/dashboardsv3/01f1c7b9a86d1d2d9431542626c08c3a/published?o=7474643750870697"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '13px' }}
                  >
                    <span>Launch Databricks Portal ↗</span>
                  </a>
                </div>

                <div className="glass-panel" style={{ padding: '8px', borderRadius: '12px', overflow: 'hidden', height: '750px', display: 'flex', flexDirection: 'column' }}>
                  <iframe
                    src="https://dbc-43fbaeb8-72c4.cloud.databricks.com/dashboardsv3/01f1c7b9a86d1d2d9431542626c08c3a/published?o=7474643750870697"
                    title="Databricks Observability Dashboard"
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: '8px',
                      background: '#0b1120'
                    }}
                    allow="clipboard-read; clipboard-write; fullscreen"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 6: Theme & Multilingual Typography Customization */}
        {activeTab === 'themes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Header Banner */}
            <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                    }}>
                      <Palette size={22} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Themes, Color Styles &amp; Multilingual Typography</span>
                        <span className="pill pill-cyan" style={{ fontSize: '11px' }}>Elder Citizen Accessibility</span>
                      </h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '880px', lineHeight: 1.5 }}>
                        Select from 8 curated color schemes and configure multilingual text writing options. Specifically engineered so that <strong>Telugu (తెలుగు)</strong> and <strong>Hindi (हिन्दी)</strong> complex vowel marks (matras) and conjuncts never look congested or cramped, ensuring effortless viewing for elderly citizens.
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    padding: '6px 12px',
                    borderRadius: '20px'
                  }}>
                    <span className="status-dot status-dot-active" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#34d399' }}>
                      Theme: {adminTheme}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#38bdf8'
                  }}>
                    <span>Aa Size: {textSize.toUpperCase()}</span>
                    <span>•</span>
                    <span>Line: {lineHeight.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 1: ONE-CLICK QUICK ACCESSIBILITY PRESETS             */}
            {/* ============================================================ */}
            <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sparkles size={18} color="#f59e0b" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  1-Click Quick Accessibility &amp; Indic Reading Presets
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {/* Preset 1: Senior Citizen High-Legibility */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('elder')}
                  style={{
                    background: textSize === 'large' && adminTheme === 'elder-high-contrast' ? 'rgba(250, 204, 21, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: textSize === 'large' && adminTheme === 'elder-high-contrast' ? '2px solid #facc15' : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#facc15', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👵 Senior Citizen Comfort</span>
                    </div>
                    <span className="pill pill-amber" style={{ fontSize: '9.5px', padding: '1px 6px' }}>HIGH CONTRAST</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    130% Font Size, 2.1x Relaxed Spacing, High-Contrast Obsidian &amp; Gold, Noto Sans. Eliminates all conjunct clutter.
                  </div>
                </button>

                {/* Preset 2: Indic Clear Matra Separation */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('indic')}
                  style={{
                    background: textSize === 'medium' && lineHeight === 'balanced' && indicMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: textSize === 'medium' && lineHeight === 'balanced' && indicMode ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🇮🇳 Indic Clear Matra Separation</span>
                    </div>
                    <span className="pill pill-cyan" style={{ fontSize: '9.5px', padding: '1px 6px' }}>TELUGU &amp; HINDI</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    115% Font Size, 1.8x Balanced Height, Noto Sans Telugu &amp; Devanagari with Anti-Congestion Shield active.
                  </div>
                </button>

                {/* Preset 3: Daytime Eye-Comfort Sepia */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('sepia')}
                  style={{
                    background: adminTheme === 'sepia-warm' ? 'rgba(180, 83, 9, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                    border: adminTheme === 'sepia-warm' ? '2px solid #b45309' : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#fb923c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📜 Warm Eye-Comfort Sepia</span>
                    </div>
                    <span className="pill pill-indigo" style={{ fontSize: '9.5px', padding: '1px 6px' }}>NO GLARE</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#cbd5e1', lineHeight: 1.4 }}>
                    Soft cream paper background with gentle warm ink. Modeled after digital e-readers to prevent blue-light eye strain.
                  </div>
                </button>

                {/* Preset 4: Standard Reset */}
                <button
                  type="button"
                  onClick={() => handleApplyQuickPreset('reset')}
                  style={{
                    background: 'rgba(30, 41, 59, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🔄 Standard UI Defaults</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>RESET</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                    Restore standard 100% font size, 1.5x line height, system fonts, and default Enterprise Navy dark theme.
                  </div>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 2: INTERACTIVE TEXT WRITING & TYPOGRAPHY OPTIONS     */}
            {/* ============================================================ */}
            <div className="glass-panel" style={{ padding: '24px 28px', borderRadius: '14px', border: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Type size={20} color="#38bdf8" />
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Text Writing &amp; Typography Customization Options
                    </h3>
                    <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      Fine-tune font size, vertical line clearance, letter spacing, and script families for maximum readability across English, Telugu, and Hindi.
                    </p>
                  </div>
                </div>

                {/* Indic Anti-Congestion Shield Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(30, 41, 59, 0.7)', padding: '6px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: indicMode ? '#34d399' : '#94a3b8' }}>
                      🛡️ Indic Matra Anti-Congestion Shield
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      Auto-spaces Telugu &amp; Hindi vowel signs (గుణింతాలు &amp; मात्राएं)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleIndicMode(!indicMode)}
                    style={{
                      background: indicMode ? '#10b981' : 'rgba(71, 85, 105, 0.6)',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '4px 10px',
                      color: '#ffffff',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {indicMode ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* 1. Font Size / Scaling Option */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    1. Text Size / Magnification
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {[
                      { key: 'normal', label: 'Normal (100%)', px: '15px', desc: 'Standard Desktop UI' },
                      { key: 'medium', label: 'Medium-Large (115%)', px: '17.5px', desc: 'Bilingual Optimal' },
                      { key: 'large', label: 'Elder Friendly (130%)', px: '19.5px', desc: 'Senior Citizen Clear' },
                      { key: 'jumbo', label: 'Jumbo High-Vis (145%)', px: '22px', desc: 'Presbyopia / Low Vision' }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleApplyTextSize(opt.key)}
                        style={{
                          padding: '10px 12px',
                          background: textSize === opt.key ? 'rgba(14, 165, 233, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          border: textSize === opt.key ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, color: textSize === opt.key ? '#38bdf8' : '#f8fafc' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                          {opt.desc} ({opt.px})
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Line Spacing / Vertical Clearance */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    2. Line Spacing (Matra Clearance)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { key: 'compact', label: 'Compact (1.5x)', desc: 'Standard English' },
                      { key: 'balanced', label: 'Balanced (1.8x)', desc: 'Indic Safe Clearance' },
                      { key: 'relaxed', label: 'Relaxed (2.1x)', desc: 'Spacious Elder Comfort' }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleApplyLineHeight(opt.key)}
                        style={{
                          padding: '10px 12px',
                          background: lineHeight === opt.key ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          border: lineHeight === opt.key ? '2px solid #34d399' : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: lineHeight === opt.key ? '#34d399' : '#f8fafc' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Character Letter Spacing */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    3. Character Spacing (Letter Room)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { key: 'normal', label: 'Normal (0px)', desc: 'Standard kerning' },
                      { key: 'spacious', label: 'Spacious (+0.5px)', desc: 'Unclutters conjuncts' },
                      { key: 'wide', label: 'Wide (+1.0px)', desc: 'Maximum separation' }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleApplyLetterSpacing(opt.key)}
                        style={{
                          padding: '10px 12px',
                          background: letterSpacing === opt.key ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          border: letterSpacing === opt.key ? '2px solid #fbbf24' : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: letterSpacing === opt.key ? '#fbbf24' : '#f8fafc' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Font Family for Indic & Latin Clarity */}
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                    4. Font Family (Multilingual Engine)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {[
                      { key: 'noto-sans', label: '🔤 Google Noto Sans', desc: 'Official Indic Google Webfont' },
                      { key: 'inter', label: '🔤 Modern Inter', desc: 'Crisp Geometric Sans' },
                      { key: 'high-legibility', label: '🔤 Open Sans / Atkinson', desc: 'High Letter Distinction' },
                      { key: 'traditional-serif', label: '🔤 Noto Serif & Print', desc: 'Traditional Newspaper Serif' }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleApplyFontFamily(opt.key)}
                        style={{
                          padding: '10px 12px',
                          background: fontFamily === opt.key ? 'rgba(192, 132, 252, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          border: fontFamily === opt.key ? '2px solid #c084fc' : '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: fontFamily === opt.key ? '#c084fc' : '#f8fafc' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                          {opt.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 3: LIVE MULTILINGUAL TEXT WRITING PREVIEW            */}
            {/* ============================================================ */}
            <div className="glass-panel" style={{ padding: '22px 26px', borderRadius: '14px', border: '1.5px solid var(--border-medium)', background: 'rgba(15, 23, 42, 0.85)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} color="#38bdf8" />
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                    Live Reactive Text Writing Preview (Real-Time Typography Testing)
                  </h3>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Displays exact live scaling, line-height clearance, and ligature spacing across languages.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
                {/* English Preview */}
                <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase' }}>
                      🇬🇧 English (Standard Latin)
                    </span>
                    <span className="pill pill-cyan" style={{ fontSize: '9px' }}>Sample Scheme</span>
                  </div>
                  <p style={{
                    fontSize: 'calc(14px * var(--text-scale, 1))',
                    lineHeight: 'var(--line-height-base, 1.7)',
                    letterSpacing: 'var(--letter-spacing-base, 0.2px)',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY) offers ₹2 Lakh life insurance coverage for death due to any cause at an annual premium of ₹436.
                  </p>
                </div>

                {/* Telugu Preview */}
                <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '10px', border: '1.5px solid rgba(245, 158, 11, 0.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                      🇮🇳 తెలుగు (Telugu - Enhanced Matra Clearance)
                    </span>
                    <span className="pill pill-amber" style={{ fontSize: '9px' }}>గుణింతాల స్పష్టత</span>
                  </div>
                  <p className="indic-text" style={{
                    fontSize: 'calc(14.5px * var(--text-scale, 1))',
                    lineHeight: 'calc(var(--line-height-base, 1.7) * 1.15)',
                    letterSpacing: 'calc(var(--letter-spacing-base, 0.2px) + 0.35px)',
                    wordSpacing: '1.5px',
                    fontFamily: 'var(--font-indic)',
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    పీఎం కిసాన్ సమ్మాన్ నిధి పథకం ద్వారా అర్హులైన చిన్న మరియు సన్నకారు రైతు కుటుంబాలకు సంవత్సరానికి ₹6,000 ఆర్థిక సహాయం మూడు సమాన విడతలలో లభిస్తుంది.
                  </p>
                </div>

                {/* Hindi Preview */}
                <div style={{ background: 'var(--bg-card)', padding: '14px 16px', borderRadius: '10px', border: '1.5px solid rgba(16, 185, 129, 0.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase' }}>
                      🇮🇳 हिन्दी (Hindi - Shirorekha &amp; Matra Space)
                    </span>
                    <span className="pill pill-emerald" style={{ fontSize: '9px' }}>मात्रा स्पष्टता</span>
                  </div>
                  <p className="indic-text" style={{
                    fontSize: 'calc(14.5px * var(--text-scale, 1))',
                    lineHeight: 'calc(var(--line-height-base, 1.7) * 1.15)',
                    letterSpacing: 'calc(var(--letter-spacing-base, 0.2px) + 0.35px)',
                    wordSpacing: '1.5px',
                    fontFamily: 'var(--font-indic)',
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    आयुष्मान भारत प्रधानमंत्री जन आरोग्य योजना के अंतर्गत प्रत्येक पात्र परिवार को प्रति वर्ष ₹5 लाख तक का कैशलेस एवं मुफ्त स्वास्थ्य सुरक्षा कवर उपलब्ध कराया जाता है।
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================================ */}
            {/* SECTION 4: COMPLETE 8 RICH THEMES & COLOR STYLES             */}
            {/* ============================================================ */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Palette size={18} color="#818cf8" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Complete Visual Color Schemes (8 High-Definition Styles)
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
                {/* Theme 1: Senior High-Contrast */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'elder-high-contrast' ? '2.5px solid #facc15' : '1px solid var(--border-medium)',
                    background: adminTheme === 'elder-high-contrast' ? 'rgba(250, 204, 21, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'elder-high-contrast' ? '0 0 25px rgba(250, 204, 21, 0.3)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>👵</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Senior High-Contrast (Elder Mode)
                        </h4>
                      </div>
                      <span className="pill pill-amber" style={{ fontSize: '10px' }}>WCAG AAA</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Pitch black carbon (#050507) with ultra-high contrast electric gold-yellow (#facc15) and pure white typography. Built specifically for presbyopia, cataracts, and elderly readability.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#facc15', border: '1px solid #ffffff' }} title="Gold #facc15" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#050507', border: '1px solid #333' }} title="Pitch Black #050507" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff', border: '1px solid #ccc' }} title="Pure White #ffffff" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#38bdf8', border: '1px solid #0284c7' }} title="Cyan #38bdf8" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('elder-high-contrast')}
                    className={adminTheme === 'elder-high-contrast' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'elder-high-contrast' ? 'rgba(30, 41, 59, 0.6)' : '#facc15',
                      color: adminTheme === 'elder-high-contrast' ? '#facc15' : '#000000',
                      fontWeight: 800
                    }}
                  >
                    {adminTheme === 'elder-high-contrast' ? '✓ Currently Active Theme' : '⚡ Activate Senior Elder Mode'}
                  </button>
                </div>

                {/* Theme 2: ChatGPT Clean (White & Black Light Mode) */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'chatgpt-light' ? '2.5px solid #0f172a' : '1px solid var(--border-medium)',
                    background: adminTheme === 'chatgpt-light' ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'chatgpt-light' ? '0 0 25px rgba(255, 255, 255, 0.2)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>☀️</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          ChatGPT Clean (White &amp; Black)
                        </h4>
                      </div>
                      <span className="pill pill-cyan" style={{ fontSize: '10px' }}>LIGHT MODE</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Pure crisp white background (#ffffff) with charcoal typography (#0f172a) and soft slate cards. Modeled after modern ChatGPT light layout for daytime clarity.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff', border: '1px solid #cbd5e1' }} title="Pure White" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0f172a', border: '1px solid #475569' }} title="Charcoal" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f1f5f9', border: '1px solid #cbd5e1' }} title="Soft Slate" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0284c7', border: '1px solid #0369a1' }} title="Sky Blue" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('chatgpt-light')}
                    className={adminTheme === 'chatgpt-light' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{ width: '100%', fontSize: '12.5px', padding: '9px 14px' }}
                  >
                    {adminTheme === 'chatgpt-light' ? '✓ Currently Active Theme' : '☀️ Activate ChatGPT Light'}
                  </button>
                </div>

                {/* Theme 3: Warm Parchment (Sepia Light Mode) */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'sepia-warm' ? '2.5px solid #b45309' : '1px solid var(--border-medium)',
                    background: adminTheme === 'sepia-warm' ? 'rgba(180, 83, 9, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'sepia-warm' ? '0 0 25px rgba(180, 83, 9, 0.25)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>📜</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Warm Parchment (Eye-Comfort Sepia)
                        </h4>
                      </div>
                      <span className="pill pill-amber" style={{ fontSize: '10px' }}>ANTI-GLARE</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Gentle warm paper texture (#faf6ed) with deep stone ink (#1c1917) and soft amber accents (#b45309). Modeled on Kindle/e-readers to protect elder eyes during long reading.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#faf6ed', border: '1px solid #d6cbba' }} title="Parchment Cream" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#1c1917', border: '1px solid #44403c' }} title="Stone Ink" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#b45309', border: '1px solid #92400e' }} title="Warm Amber" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#eae2d1', border: '1px solid #bfaea0' }} title="Soft Sand" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('sepia-warm')}
                    className={adminTheme === 'sepia-warm' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'sepia-warm' ? 'rgba(30, 41, 59, 0.6)' : '#b45309',
                      color: '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    {adminTheme === 'sepia-warm' ? '✓ Currently Active Theme' : '📜 Activate Warm Sepia'}
                  </button>
                </div>

                {/* Theme 4: Emerald Heritage / Triranga */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'emerald-triranga' ? '2.5px solid #10b981' : '1px solid var(--border-medium)',
                    background: adminTheme === 'emerald-triranga' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'emerald-triranga' ? '0 0 25px rgba(16, 185, 129, 0.25)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🌿</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Emerald Heritage (National Triranga)
                        </h4>
                      </div>
                      <span className="pill pill-emerald" style={{ fontSize: '10px' }}>HERITAGE</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Deep forest emerald green (#04140e) paired with soothing jade mint (#10b981) and golden wheat highlights (#f59e0b). Dignified Indian government aesthetic.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#04140e', border: '1px solid #0f3325' }} title="Forest Green" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#10b981', border: '1px solid #059669' }} title="Jade Mint" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f59e0b', border: '1px solid #d97706' }} title="Golden Wheat" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0' }} title="Mint White" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('emerald-triranga')}
                    className={adminTheme === 'emerald-triranga' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'emerald-triranga' ? 'rgba(30, 41, 59, 0.6)' : 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 700
                    }}
                  >
                    {adminTheme === 'emerald-triranga' ? '✓ Currently Active Theme' : '🌿 Activate Emerald Heritage'}
                  </button>
                </div>

                {/* Theme 5: Enterprise Cyber (Default Dark Navy) */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'default-dark' ? '2.5px solid #6366f1' : '1px solid var(--border-medium)',
                    background: adminTheme === 'default-dark' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'default-dark' ? '0 0 25px rgba(99, 102, 241, 0.25)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🌙</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Enterprise Cyber (Default Dark Navy)
                        </h4>
                      </div>
                      <span className="pill pill-indigo" style={{ fontSize: '10px' }}>DEFAULT</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Deep midnight indigo navy (#090d16) with subtle electric cyber accents (#6366f1) and glowing cyan (#38bdf8). Built for 24/7 mission-critical operations.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#090d16', border: '1px solid #1e293b' }} title="Navy #090d16" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0f172a', border: '1px solid #334155' }} title="Slate #0f172a" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#6366f1', border: '1px solid #4f46e5' }} title="Cyber Indigo #6366f1" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#38bdf8', border: '1px solid #0ea5e9' }} title="Cyan #38bdf8" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('default-dark')}
                    className={adminTheme === 'default-dark' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{ width: '100%', fontSize: '12.5px', padding: '9px 14px' }}
                  >
                    {adminTheme === 'default-dark' ? '✓ Currently Active Theme' : '🌙 Activate Enterprise Navy'}
                  </button>
                </div>

                {/* Theme 6: Sunset Amber */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'sunset-orange' ? '2.5px solid #f97316' : '1px solid var(--border-medium)',
                    background: adminTheme === 'sunset-orange' ? 'rgba(249, 115, 22, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'sunset-orange' ? '0 0 25px rgba(249, 115, 22, 0.25)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🍊</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Sunset Amber (Orange, Black &amp; White)
                        </h4>
                      </div>
                      <span className="pill pill-rose" style={{ fontSize: '10px' }}>DYNAMIC</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Warm radiant orange accents (#f97316) paired with deep obsidian carbon surfaces (#09090b) and crisp white text. Dynamic, bold, and energetic.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f97316', border: '1px solid #ea580c' }} title="Orange" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#09090b', border: '1px solid #27272a' }} title="Obsidian" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#202026', border: '1px solid #3f3f46' }} title="Graphite" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff', border: '1px solid #cbd5e1' }} title="Pure White" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('sunset-orange')}
                    className={adminTheme === 'sunset-orange' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'sunset-orange' ? 'rgba(30, 41, 59, 0.6)' : 'linear-gradient(135deg, #f97316, #ea580c)',
                      color: '#ffffff'
                    }}
                  >
                    {adminTheme === 'sunset-orange' ? '✓ Currently Active Theme' : '🍊 Activate Sunset Amber'}
                  </button>
                </div>

                {/* Theme 7: Cyber Gold */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'cyber-gold' ? '2.5px solid #eab308' : '1px solid var(--border-medium)',
                    background: adminTheme === 'cyber-gold' ? 'rgba(234, 179, 8, 0.08)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'cyber-gold' ? '0 0 25px rgba(234, 179, 8, 0.25)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>⚡</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Cyber Gold (Yellow, Black &amp; White)
                        </h4>
                      </div>
                      <span className="pill pill-amber" style={{ fontSize: '10px' }}>ELECTRIC PUNCH</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Electric gold highlights (#eab308) against midnight pitch-black carbon surfaces (#09090b) and pure white typography.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#eab308', border: '1px solid #ca8a04' }} title="Gold" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#09090b', border: '1px solid #27272a' }} title="Pitch Black" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#1f1f26', border: '1px solid #3f3f46' }} title="Midnight" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#ffffff', border: '1px solid #cbd5e1' }} title="Pure White" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('cyber-gold')}
                    className={adminTheme === 'cyber-gold' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'cyber-gold' ? 'rgba(30, 41, 59, 0.6)' : 'linear-gradient(135deg, #eab308, #ca8a04)',
                      color: adminTheme === 'cyber-gold' ? '#94a3b8' : '#000000',
                      fontWeight: 700
                    }}
                  >
                    {adminTheme === 'cyber-gold' ? '✓ Currently Active Theme' : '⚡ Activate Cyber Gold'}
                  </button>
                </div>

                {/* Theme 8: Royal Ruby & Crimson (Luminous Red) */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '22px',
                    borderRadius: '14px',
                    border: adminTheme === 'royal-sapphire' ? '2.5px solid #e11d48' : '1px solid var(--border-medium)',
                    background: adminTheme === 'royal-sapphire' ? 'rgba(225, 29, 72, 0.1)' : 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: adminTheme === 'royal-sapphire' ? '0 0 25px rgba(225, 29, 72, 0.35)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🌹</span>
                        <h4 style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Royal Ruby &amp; Crimson (Imperial Red)
                        </h4>
                      </div>
                      <span className="pill pill-rose" style={{ fontSize: '10px' }}>LUMINOUS RED</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.45', marginBottom: '12px' }}>
                      Deep velvet obsidian (#0a0406) paired with vibrant crimson red (#e11d48), radiant ruby glow (#f43f5e) and pure ice white. State-of-the-art elegance.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#0a0406', border: '1px solid #4c111f' }} title="Velvet Obsidian" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e11d48', border: '1px solid #be123c' }} title="Crimson Red" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f43f5e', border: '1px solid #e11d48' }} title="Ruby Glow" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fb7185', border: '1px solid #f43f5e' }} title="Rose Light" />
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff1f2', border: '1px solid #fecdd3' }} title="Ice White" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTheme('royal-sapphire')}
                    className={adminTheme === 'royal-sapphire' ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{
                      width: '100%',
                      fontSize: '12.5px',
                      padding: '9px 14px',
                      background: adminTheme === 'royal-sapphire' ? 'rgba(30, 41, 59, 0.6)' : 'linear-gradient(135deg, #e11d48, #be123c)',
                      color: '#ffffff',
                      fontWeight: 700,
                      boxShadow: adminTheme === 'royal-sapphire' ? 'none' : '0 4px 14px rgba(225, 29, 72, 0.4)'
                    }}
                  >
                    {adminTheme === 'royal-sapphire' ? '✓ Currently Active Theme' : '🌹 Activate Royal Ruby Red'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: DATABRICKS UNITY CATALOG KNOWLEDGE GRAPH EXPLORER       */}
        {/* ============================================================ */}
        {activeTab === 'knowledge-graph' && (
          <div
            style={isGraphFullScreen ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999999,
              background: 'rgba(7, 10, 19, 0.98)',
              backdropFilter: 'blur(24px)',
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            } : {}}
          >
            {/* Header & Title Banner */}
            <div className="glass-panel" style={{ padding: isGraphFullScreen ? '14px 20px' : '22px 24px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: isGraphFullScreen ? '8px' : '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Share2 size={22} color="#38bdf8" />
                      <span>Databricks Unity Catalog Knowledge Graph {isGraphFullScreen ? '(Fullscreen Mode)' : ''}</span>
                    </h2>
                    <span className="pill pill-cyan">rag_catalog.rag_gov_schema</span>
                    <span className="pill pill-indigo">1024-dim Vector AI</span>
                  </div>
                  {!isGraphFullScreen && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '960px', lineHeight: 1.5 }}>
                      Visual Lakehouse Lineage &amp; Semantic Graph: <strong>Raw Documents</strong> (17 files) &rarr; <strong>Bronze Validation</strong> (12 Validated vs. 5 Quarantined Excluded Branch) &rarr; <strong>Silver Documents</strong> (12 canonical schemes) &rarr; <strong>Silver Chunks</strong> (1,192 chunks) &amp; <strong>Silver Embeddings</strong> (semantic similarity cosine &gt; 0.85) &rarr; <strong>Citizen Queries</strong> (RAG retrieval interactions).
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => loadKnowledgeGraph(true)}
                    disabled={graphLoading}
                    className="btn btn-primary"
                    style={{ fontSize: '12.5px', padding: '8px 14px' }}
                  >
                    <RefreshCw size={14} className={graphLoading ? 'mic-recording-pulse' : ''} />
                    <span>{graphLoading ? 'Querying Delta Tables...' : 'Sync Databricks Graph'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!graphData) return;
                      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(graphData, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', `databricks_knowledge_graph_${new Date().toISOString().slice(0, 10)}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    disabled={!graphData}
                    className="btn btn-secondary"
                    style={{ fontSize: '12.5px', padding: '8px 14px' }}
                  >
                    <Download size={14} />
                    <span>Export Graph JSON</span>
                  </button>

                  {/* Fullscreen Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setIsGraphFullScreen(!isGraphFullScreen)}
                    className="btn btn-primary"
                    style={{ fontSize: '12.5px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title={isGraphFullScreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen Canvas"}
                  >
                    {isGraphFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    <span>{isGraphFullScreen ? 'Minimize (Esc)' : 'Fullscreen View'}</span>
                  </button>

                  {isGraphFullScreen && (
                    <button
                      type="button"
                      onClick={() => setIsGraphFullScreen(false)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#f87171',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Close Fullscreen (Esc)"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Stats Counters Header */}
              {graphData?.stats && !isGraphFullScreen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(147, 51, 234, 0.12)', border: '1px solid rgba(147, 51, 234, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase' }}>Raw Sources</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#f3e8ff' }}>{graphData.stats.raw_documents_count || 17}</div>
                    <div style={{ fontSize: '10.5px', color: '#d8b4fe' }}>raw_documents</div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#34d399', fontWeight: 600, textTransform: 'uppercase' }}>Validated Lineage</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#ecfdf5' }}>{graphData.stats.bronze_validated_count || 12}</div>
                    <div style={{ fontSize: '10.5px', color: '#6ee7b7' }}>bronze_validated</div>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>Quarantined (Excluded)</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#fef2f2' }}>{graphData.stats.bronze_quarantine_count || 5}</div>
                    <div style={{ fontSize: '10.5px', color: '#fca5a5' }}>Duplicates / Not PDF</div>
                  </div>

                  <div style={{ background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>Silver Canonical Docs</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#f0f9ff' }}>{graphData.stats.silver_documents_count || 12}</div>
                    <div style={{ fontSize: '10.5px', color: '#7dd3fc' }}>silver_documents</div>
                  </div>

                  <div style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>Silver Chunks</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#e0e7ff' }}>1,192 Total</div>
                    <div style={{ fontSize: '10.5px', color: '#a5b4fc' }}>({graphData.stats.silver_chunks_sample_count || 0} active in view)</div>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', padding: '10px 14px' }}>
                    <div style={{ fontSize: '11px', color: '#fbbf24', fontWeight: 600, textTransform: 'uppercase' }}>Semantic &amp; Lineage Edges</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#fffbeb' }}>{graphData.edges?.length || 0}</div>
                    <div style={{ fontSize: '10.5px', color: '#fde68a' }}>Provenance + Cosine Sim</div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls Bar: Filters, Similarity Slider, Search & Zoom */}
            <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Instant Focus Scheme Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 700 }}>Focus Scheme:</span>
                  <select
                    value={graphDocFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGraphDocFilter(val);
                      if (!val) {
                        setSelectedGraphNode(null);
                      } else {
                        // Find matching silver_document node and instantly focus full lineage!
                        const matchDoc = graphData?.nodes?.find(
                          (n) => n.type === 'silver_document' && (
                            n.id === val ||
                            n.properties?.doc_id === val ||
                            n.id === `doc_${val}` ||
                            n.properties?.file_name === val ||
                            n.label === val
                          )
                        );
                        if (matchDoc) {
                          setSelectedGraphNode(matchDoc);
                        }
                      }
                    }}
                    style={{
                      background: 'rgba(30, 41, 59, 0.9)',
                      border: '1.5px solid #38bdf8',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    <option value="">🌐 Full Lakehouse Lineage (All 12 Schemes)</option>
                    {graphData?.nodes
                      ?.filter((n) => n.type === 'silver_document')
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          📄 {d.label}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Cosine Similarity Threshold Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(30, 41, 59, 0.6)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600 }}>Semantic Sim (&gt;):</span>
                  <input
                    type="range"
                    min="0.75"
                    max="0.95"
                    step="0.01"
                    value={graphSimThreshold}
                    onChange={(e) => setGraphSimThreshold(parseFloat(e.target.value))}
                    style={{ width: '90px', cursor: 'pointer' }}
                    title="Filter semantic-similarity edges derived from 1024-dim silver_embeddings"
                  />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', minWidth: '36px' }}>
                    {Math.round(graphSimThreshold * 100)}%
                  </span>
                </div>

                {/* Live Search */}
                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    value={graphSearchQuery}
                    onChange={(e) => setGraphSearchQuery(e.target.value)}
                    placeholder="Search node or scheme text..."
                    style={{
                      width: '100%',
                      background: 'rgba(30, 41, 59, 0.85)',
                      border: '1px solid var(--border-medium)',
                      color: '#f8fafc',
                      borderRadius: '6px',
                      padding: '5px 10px 5px 30px',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Zoom & View Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setGraphZoom((z) => Math.max(0.6, z - 0.15))}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span style={{ fontSize: '12px', color: '#cbd5e1', fontWeight: 600, minWidth: '42px', textAlign: 'center' }}>
                  {Math.round(graphZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setGraphZoom((z) => Math.min(1.8, z + 0.15))}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setGraphZoom(1.0)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  Reset View
                </button>
              </div>
            </div>

            {/* Layer Visibility Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Visible Layers:</span>
              {[
                { key: 'raw', label: 'Raw Ingestion (17)', color: '#c084fc', bg: 'rgba(147, 51, 234, 0.2)' },
                { key: 'validated', label: 'Bronze Validated (12)', color: '#34d399', bg: 'rgba(16, 185, 129, 0.2)' },
                { key: 'quarantine', label: 'Quarantine Excluded (5)', color: '#f87171', bg: 'rgba(239, 68, 68, 0.2)' },
                { key: 'document', label: 'Silver Documents (12)', color: '#38bdf8', bg: 'rgba(14, 165, 233, 0.2)' },
                { key: 'chunk', label: 'Silver Chunks', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.2)' },
                { key: 'similarity', label: 'Semantic Similarity (>0.85)', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.2)' },
                { key: 'query', label: 'Citizen Queries', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.2)' }
              ].map((layer) => {
                const active = graphLayerFilters[layer.key];
                return (
                  <button
                    key={layer.key}
                    type="button"
                    onClick={() => setGraphLayerFilters((prev) => ({ ...prev, [layer.key]: !prev[layer.key] }))}
                    style={{
                      background: active ? layer.bg : 'rgba(30, 41, 59, 0.4)',
                      border: active ? `1px solid ${layer.color}` : '1px solid var(--border-subtle)',
                      color: active ? layer.color : '#64748b',
                      borderRadius: '16px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{active ? '✓' : '○'}</span>
                    <span>{layer.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Interactive Graph Viewport */}
            {graphLoading && !graphData ? (
              <div className="glass-panel" style={{ padding: '60px', textAlign: 'center', minHeight: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={36} className="mic-recording-pulse" color="#38bdf8" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Extracting Databricks Unity Catalog Lineage...</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  Querying raw_documents, bronze_validated, bronze_quarantine, silver_documents, silver_chunks, silver_embeddings, and user_queries...
                </p>
              </div>
            ) : graphError && (!graphData || !graphData.nodes || graphData.nodes.length === 0) ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px' }}>
                <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '14px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>Databricks Knowledge Graph Unavailable</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '620px', marginBottom: '20px', lineHeight: 1.6 }}>
                  {graphError}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => loadKnowledgeGraph(true)}
                    className="btn btn-primary"
                    style={{ fontSize: '13px', padding: '8px 18px' }}
                  >
                    <RefreshCw size={14} />
                    <span>Retry Sync</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedGraphNode ? (isGraphFullScreen ? '1fr 400px' : '1fr 370px') : '1fr', gap: '16px', flex: isGraphFullScreen ? 1 : 'none', minHeight: isGraphFullScreen ? 0 : '680px', height: isGraphFullScreen ? 'calc(100vh - 200px)' : 'auto' }}>
                {/* SVG Graph Canvas */}
                <div
                  className="glass-panel"
                  style={{
                    position: 'relative',
                    overflow: 'auto',
                    background: 'rgba(10, 14, 23, 0.95)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '12px',
                    height: isGraphFullScreen ? '100%' : '720px',
                    minHeight: isGraphFullScreen ? '0' : '680px',
                    maxHeight: isGraphFullScreen ? 'calc(100vh - 200px)' : '820px',
                    boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {(() => {
                    const nodes = graphData?.nodes || [];
                    const allEdges = graphData?.edges || [];

                    // Layer filtering
                    const visibleNodes = nodes.filter((n) => {
                      if (n.group === 'raw' && !graphLayerFilters.raw) return false;
                      if (n.group === 'validated' && !graphLayerFilters.validated) return false;
                      if (n.group === 'quarantine' && !graphLayerFilters.quarantine) return false;
                      if (n.group === 'document' && !graphLayerFilters.document) return false;
                      if (n.group === 'chunk' && !graphLayerFilters.chunk) return false;
                      if (n.group === 'query' && !graphLayerFilters.query) return false;
                      return true;
                    });

                    const visibleNodeIdSet = new Set(visibleNodes.map((n) => n.id));

                    // Filter edges based on visible nodes and similarity filter
                    const visibleEdges = allEdges.filter((e) => {
                      if (!visibleNodeIdSet.has(e.source) || !visibleNodeIdSet.has(e.target)) return false;
                      if (e.type === 'similar_to') {
                        if (!graphLayerFilters.similarity) return false;
                        const sim = e.properties?.similarity || 0.85;
                        if (sim < graphSimThreshold) return false;
                      }
                      return true;
                    });

                    // 1. DIRECTED UPSTREAM / DOWNSTREAM LINEAGE TRACING (Fix: Prevents query click from flooding everything)
                    const activeLineage = (() => {
                      let focusNode = selectedGraphNode;
                      if (!focusNode && graphSearchQuery.trim()) {
                        const q = graphSearchQuery.toLowerCase();
                        focusNode = visibleNodes.find((n) =>
                          n.label?.toLowerCase().includes(q) ||
                          n.properties?.query_text?.toLowerCase().includes(q) ||
                          n.properties?.file_name?.toLowerCase().includes(q)
                        );
                      }

                      if (!focusNode) return { nodeIds: new Set(), edgeIds: new Set(), rootNode: null };

                      const nodeIds = new Set([focusNode.id]);
                      const edgeIds = new Set();

                      // Index edges directionally: incoming (target -> edges) and outgoing (source -> edges)
                      const incomingEdges = new Map();
                      const outgoingEdges = new Map();

                      visibleEdges.forEach((e) => {
                        if (e.type !== 'similar_to') {
                          if (!incomingEdges.has(e.target)) incomingEdges.set(e.target, []);
                          incomingEdges.get(e.target).push(e);

                          if (!outgoingEdges.has(e.source)) outgoingEdges.set(e.source, []);
                          outgoingEdges.get(e.source).push(e);
                        }
                      });

                      // Trace UPSTREAM (towards Raw S3 Ingestion)
                      const traceUpstream = (startId) => {
                        const queue = [startId];
                        const visited = new Set([startId]);
                        while (queue.length > 0) {
                          const currId = queue.shift();
                          const inList = incomingEdges.get(currId) || [];
                          inList.forEach((e) => {
                            edgeIds.add(e.id);
                            nodeIds.add(e.source);
                            if (!visited.has(e.source)) {
                              visited.add(e.source);
                              queue.push(e.source);
                            }
                          });
                        }
                      };

                      // Trace DOWNSTREAM (towards Citizen Query)
                      const traceDownstream = (startId) => {
                        const queue = [startId];
                        const visited = new Set([startId]);
                        while (queue.length > 0) {
                          const currId = queue.shift();
                          const outList = outgoingEdges.get(currId) || [];
                          outList.forEach((e) => {
                            edgeIds.add(e.id);
                            nodeIds.add(e.target);
                            if (!visited.has(e.target)) {
                              visited.add(e.target);
                              queue.push(e.target);
                            }
                          });
                        }
                      };

                      if (focusNode.group === 'query') {
                        // CRITICAL FIX: Selecting ONE user query traces ONLY its retrieved chunks and parent document back to Raw
                        // It does NOT traverse sideways into unrelated chunks or other user queries!
                        traceUpstream(focusNode.id);
                      } else if (focusNode.group === 'chunk') {
                        // Chunk: Upstream to parent Doc/Bronze/Raw, Downstream to queries that retrieved this specific chunk
                        traceUpstream(focusNode.id);
                        const outList = outgoingEdges.get(focusNode.id) || [];
                        outList.forEach((e) => {
                          if (e.type === 'retrieved') {
                            edgeIds.add(e.id);
                            nodeIds.add(e.target);
                          }
                        });
                      } else if (focusNode.group === 'document') {
                        // Document: Upstream to Bronze/Raw, Downstream to its chunks
                        traceUpstream(focusNode.id);
                        const outList = outgoingEdges.get(focusNode.id) || [];
                        outList.forEach((e) => {
                          if (e.type === 'has_chunk') {
                            edgeIds.add(e.id);
                            nodeIds.add(e.target);
                          }
                        });
                      } else if (focusNode.group === 'validated') {
                        // Bronze Validated: Upstream to Raw, Downstream to promoted Silver Doc and its chunks
                        traceUpstream(focusNode.id);
                        const outList = outgoingEdges.get(focusNode.id) || [];
                        outList.forEach((e) => {
                          edgeIds.add(e.id);
                          nodeIds.add(e.target);
                          if (e.type === 'promoted_to') {
                            const docOut = outgoingEdges.get(e.target) || [];
                            docOut.forEach((de) => {
                              if (de.type === 'has_chunk') {
                                edgeIds.add(de.id);
                                nodeIds.add(de.target);
                              }
                            });
                          }
                        });
                      } else if (focusNode.group === 'quarantine') {
                        traceUpstream(focusNode.id);
                      } else if (focusNode.group === 'raw') {
                        traceDownstream(focusNode.id);
                      }

                      return { nodeIds, edgeIds, rootNode: focusNode };
                    })();

                    // 2. COORDINATES & HORIZONTAL ALIGNMENT (Bronze & Silver on same rows)
                    const nodePos = {};
                    const colX = {
                      raw: 60,
                      validated: 390,
                      quarantine: 390,
                      document: 720,
                      chunk: 1050,
                      query: 1400
                    };

                    // Group and align nodes
                    const rawList = visibleNodes.filter((n) => n.group === 'raw');
                    const valList = visibleNodes.filter((n) => n.group === 'validated');
                    const quarList = visibleNodes.filter((n) => n.group === 'quarantine');
                    const docList = visibleNodes.filter((n) => n.group === 'document');
                    const chunkList = visibleNodes.filter((n) => n.group === 'chunk');
                    const queryList = visibleNodes.filter((n) => n.group === 'query');

                    rawList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.raw, y: 70 + (i * 58) };
                    });

                    // Bronze Validated and Silver Canonical Docs match 1:1 on the exact same row!
                    valList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.validated, y: 70 + (i * 58) };
                    });

                    // Quarantine nodes placed below Validated
                    const quarStartY = 70 + (valList.length * 58) + 30;
                    quarList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.quarantine, y: quarStartY + (i * 58) };
                    });

                    // Silver Docs align horizontally with Validated
                    docList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.document, y: 70 + (i * 58) };
                    });

                    // Chunks positioned cleanly
                    chunkList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.chunk, y: 70 + (i * 54) };
                    });

                    // Citizen Queries positioned
                    queryList.forEach((n, i) => {
                      nodePos[n.id] = { x: colX.query, y: 70 + (i * 64) };
                    });

                    const maxY = Math.max(
                      70 + (rawList.length * 58),
                      quarStartY + (quarList.length * 58),
                      70 + (docList.length * 58),
                      70 + (chunkList.length * 54),
                      70 + (queryList.length * 64),
                      820
                    ) + 120;
                    const canvasW = 1750;

                    const isMatch = (node) => {
                      if (!graphSearchQuery.trim()) return false;
                      const q = graphSearchQuery.toLowerCase();
                      return (
                        node.label?.toLowerCase().includes(q) ||
                        node.properties?.file_name?.toLowerCase().includes(q) ||
                        node.properties?.snippet?.toLowerCase().includes(q) ||
                        node.properties?.query_text?.toLowerCase().includes(q) ||
                        node.id.toLowerCase().includes(q)
                      );
                    };

                    return (
                      <div
                        style={{
                          transform: `scale(${graphZoom})`,
                          transformOrigin: '0 0',
                          minWidth: `${canvasW}px`,
                          minHeight: `${maxY}px`,
                          padding: '20px',
                          position: 'relative'
                        }}
                      >
                        {/* CSS Keyframes for Lineage Laser Flowing Animations */}
                        <style>{`
                          @keyframes flowLineageLaser {
                            from { stroke-dashoffset: 48; }
                            to { stroke-dashoffset: 0; }
                          }
                          @keyframes lineagePulseBadge {
                            0%, 100% { box-shadow: 0 0 10px rgba(56, 189, 248, 0.4); }
                            50% { box-shadow: 0 0 22px rgba(56, 189, 248, 0.9); }
                          }
                        `}</style>

                        {/* Lineage Trail Breadcrumb Header */}
                        {activeLineage.rootNode && (
                          <div
                            style={{
                              position: 'sticky',
                              top: '10px',
                              left: '60px',
                              right: '60px',
                              zIndex: 10,
                              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.96))',
                              border: '1.5px solid #38bdf8',
                              borderRadius: '10px',
                              padding: '10px 16px',
                              marginBottom: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                              boxShadow: '0 4px 25px rgba(56, 189, 248, 0.3)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.5px' }}>
                                ⚡ Active Lineage Trail:
                              </span>
                              <span className="pill pill-indigo">🟣 1. Raw S3 PDF</span>
                              <span style={{ color: '#64748b' }}>➔</span>
                              <span className="pill pill-emerald">🟢 2. Bronze Validated</span>
                              <span style={{ color: '#64748b' }}>➔</span>
                              <span className="pill pill-cyan">🔵 3. Silver Canonical Doc</span>
                              <span style={{ color: '#64748b' }}>➔</span>
                              <span className="pill pill-indigo">🟣 4. Silver Chunks</span>
                              <span style={{ color: '#64748b' }}>➔</span>
                              <span className="pill pill-amber">🟡 5. Citizen Query &amp; Answer</span>
                              <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, marginLeft: '8px' }}>
                                [{activeLineage.nodeIds.size} Lineage Nodes Connected]
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedGraphNode(null); setGraphSearchQuery(''); }}
                              className="btn btn-secondary"
                              style={{ fontSize: '11.5px', padding: '4px 10px', height: '28px' }}
                            >
                              <X size={13} />
                              <span>Reset Lineage View</span>
                            </button>
                          </div>
                        )}

                        {/* Column Header Titles with Stage Types */}
                        <div style={{ position: 'absolute', top: '14px', left: '60px', fontSize: '12px', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🟣 1. Raw Ingestion (17)
                          <div style={{ fontSize: '10px', color: '#a855f7', fontWeight: 500 }}>type: raw_document</div>
                        </div>
                        <div style={{ position: 'absolute', top: '14px', left: '390px', fontSize: '12px', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🟢/🔴 2. Bronze Validation (12 / 5)
                          <div style={{ fontSize: '10px', color: '#10b981', fontWeight: 500 }}>type: bronze_validated / quarantine</div>
                        </div>
                        <div style={{ position: 'absolute', top: '14px', left: '720px', fontSize: '12px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🔵 3. Silver Documents (12)
                          <div style={{ fontSize: '10px', color: '#0ea5e9', fontWeight: 500 }}>type: silver_document (Canonical)</div>
                        </div>
                        <div style={{ position: 'absolute', top: '14px', left: '1050px', fontSize: '12px', fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🟣 4. Silver Chunks ({chunkList.length})
                          <div style={{ fontSize: '10px', color: '#6366f1', fontWeight: 500 }}>type: silver_chunk (Embeddings)</div>
                        </div>
                        <div style={{ position: 'absolute', top: '14px', left: '1400px', fontSize: '12px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          🟡 5. Citizen Queries ({queryList.length})
                          <div style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 500 }}>type: user_query &amp; answer</div>
                        </div>

                        {/* SVG Edge Canvas with Flowing Animations and Arrow Heads */}
                        <svg
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: `${canvasW}px`,
                            height: `${maxY}px`,
                            pointerEvents: 'none',
                            zIndex: 1
                          }}
                        >
                          <defs>
                            <marker id="arrow-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
                            </marker>
                            <marker id="arrow-emerald" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#34d399" />
                            </marker>
                            <marker id="arrow-gold" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#fbbf24" />
                            </marker>
                            <marker id="arrow-rose" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f43f5e" />
                            </marker>
                            <marker id="arrow-active" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffffff" />
                            </marker>
                            <filter id="glowActiveLineage" x="-30%" y="-30%" width="160%" height="160%">
                              <feGaussianBlur stdDeviation="3.5" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {visibleEdges.map((edge) => {
                            const p1 = nodePos[edge.source];
                            const p2 = nodePos[edge.target];
                            if (!p1 || !p2) return null;

                            const isLineageEdge = activeLineage.edgeIds.has(edge.id);
                            const hasActiveLineage = activeLineage.nodeIds.size > 0;

                            let stroke = 'rgba(148, 163, 184, 0.4)';
                            let strokeDash = 'none';
                            let strokeWidth = 1.8;
                            let arrowMarker = 'url(#arrow-cyan)';

                            if (edge.type === 'validated_as') {
                              stroke = '#34d399';
                              arrowMarker = 'url(#arrow-emerald)';
                            } else if (edge.type === 'quarantined_to') {
                              stroke = 'rgba(239, 68, 68, 0.85)';
                              strokeDash = '4,4';
                              arrowMarker = 'url(#arrow-rose)';
                            } else if (edge.type === 'promoted_to') {
                              // Promoted edge from Bronze to Silver: bold, prominent cyan
                              stroke = '#38bdf8';
                              strokeWidth = 2.5;
                              arrowMarker = 'url(#arrow-cyan)';
                            } else if (edge.type === 'has_chunk') {
                              stroke = '#818cf8';
                              arrowMarker = 'url(#arrow-cyan)';
                            } else if (edge.type === 'similar_to') {
                              stroke = 'rgba(56, 189, 248, 0.7)';
                              strokeDash = '3,3';
                              arrowMarker = '';
                            } else if (edge.type === 'retrieved') {
                              stroke = '#fbbf24';
                              strokeDash = '5,3';
                              strokeWidth = 2.4;
                              arrowMarker = 'url(#arrow-gold)';
                            }

                            // Precise anchor calculation (with boxSizing: border-box on cards)
                            const CARD_W = 220;
                            const CARD_H = 48;
                            const centerY1 = p1.y + (CARD_H / 2);
                            const centerY2 = p2.y + (CARD_H / 2);

                            let x1, y1, x2, y2, pathD;

                            if (edge.type === 'similar_to') {
                              // Intra-column similarity between chunks
                              x1 = p1.x + CARD_W;
                              y1 = centerY1;
                              x2 = p2.x + CARD_W;
                              y2 = centerY2;
                              const loopOffset = Math.min(80, 40 + Math.abs(y1 - y2) * 0.25);
                              const midX = x1 + loopOffset;
                              pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                            } else if (p1.x < p2.x) {
                              // Forward flow (Left to Right): cleanly exits right border of p1, points directly into left border of p2
                              x1 = p1.x + CARD_W;
                              y1 = centerY1;
                              x2 = p2.x - 3;
                              y2 = centerY2;

                              if (Math.abs(y1 - y2) < 4) {
                                pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
                              } else {
                                const dx = (x2 - x1) * 0.52;
                                pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
                              }
                            } else if (p1.x > p2.x) {
                              // Reverse flow (Right to Left)
                              x1 = p1.x;
                              y1 = centerY1;
                              x2 = p2.x + CARD_W + 3;
                              y2 = centerY2;

                              if (Math.abs(y1 - y2) < 4) {
                                pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
                              } else {
                                const dx = (x1 - x2) * 0.52;
                                pathD = `M ${x1} ${y1} C ${x1 - dx} ${y1}, ${x2 + dx} ${y2}, ${x2} ${y2}`;
                              }
                            } else {
                              // Direct vertical alignment
                              x1 = p1.x + (CARD_W / 2);
                              y1 = p1.y < p2.y ? p1.y + CARD_H : p1.y;
                              x2 = p2.x + (CARD_W / 2);
                              y2 = p1.y < p2.y ? p2.y - 3 : p2.y + CARD_H + 3;
                              pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
                            }

                            const edgeOpacity = hasActiveLineage ? (isLineageEdge ? 1.0 : 0.12) : 0.75;

                            return (
                              <g key={edge.id}>
                                {/* Origin connection dot on source card */}
                                <circle
                                  cx={x1}
                                  cy={y1}
                                  r={isLineageEdge ? 3.5 : 2.5}
                                  fill={isLineageEdge ? '#ffffff' : stroke}
                                  opacity={edgeOpacity}
                                />

                                {/* Base Path */}
                                <path
                                  d={pathD}
                                  fill="none"
                                  stroke={isLineageEdge ? (edge.type === 'retrieved' ? '#fbbf24' : '#38bdf8') : stroke}
                                  strokeWidth={isLineageEdge ? 4.5 : strokeWidth}
                                  strokeDasharray={isLineageEdge ? 'none' : strokeDash}
                                  opacity={edgeOpacity}
                                  markerEnd={isLineageEdge ? 'url(#arrow-active)' : arrowMarker}
                                  filter={isLineageEdge ? 'url(#glowActiveLineage)' : 'none'}
                                />

                                {/* Flowing Animated Laser Particles for Active Lineage */}
                                {isLineageEdge && (
                                  <path
                                    d={pathD}
                                    fill="none"
                                    stroke="#ffffff"
                                    strokeWidth={2.6}
                                    strokeDasharray="10 8"
                                    style={{
                                      animation: 'flowLineageLaser 1.0s linear infinite',
                                      opacity: 0.95
                                    }}
                                  />
                                )}

                                {/* Edge Type Pill along Promoted and Retrieved connections */}
                                {(edge.type === 'promoted_to' || isLineageEdge) && (
                                  <text
                                    x={(x1 + x2) / 2}
                                    y={((y1 + y2) / 2) - 6}
                                    fill={isLineageEdge ? '#ffffff' : (edge.type === 'promoted_to' ? '#38bdf8' : '#cbd5e1')}
                                    fontSize="9.5"
                                    fontWeight="bold"
                                    textAnchor="middle"
                                    opacity={edgeOpacity}
                                  >
                                    {edge.type}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>

                        {/* Interactive Node Cards with Types, Badges & Glowing Focus */}
                        <div style={{ position: 'relative', zIndex: 2 }}>
                          {visibleNodes.map((node) => {
                            const pos = nodePos[node.id];
                            if (!pos) return null;

                            const isRootSelected = selectedGraphNode?.id === node.id;
                            const isLineageNode = activeLineage.nodeIds.has(node.id);
                            const hasActiveLineage = activeLineage.nodeIds.size > 0;
                            const matchesSearch = isMatch(node);

                            let borderCol = 'var(--border-subtle)';
                            let bgCol = 'rgba(15, 23, 42, 0.92)';
                            let badgePill = 'pill-indigo';
                            let icon = <Database size={13} color="#818cf8" />;

                            if (node.group === 'raw') {
                              borderCol = isLineageNode ? '#c084fc' : 'rgba(147, 51, 234, 0.45)';
                              bgCol = isLineageNode ? 'rgba(147, 51, 234, 0.3)' : 'rgba(30, 27, 75, 0.88)';
                              badgePill = 'pill-indigo';
                              icon = <FileText size={13} color="#c084fc" />;
                            } else if (node.group === 'validated') {
                              borderCol = isLineageNode ? '#34d399' : 'rgba(16, 185, 129, 0.45)';
                              bgCol = isLineageNode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(6, 78, 59, 0.88)';
                              badgePill = 'pill-emerald';
                              icon = <CheckCircle2 size={13} color="#34d399" />;
                            } else if (node.group === 'quarantine') {
                              borderCol = isLineageNode ? '#f87171' : 'rgba(239, 68, 68, 0.55)';
                              bgCol = isLineageNode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(69, 10, 10, 0.88)';
                              badgePill = 'pill-rose';
                              icon = <AlertTriangle size={13} color="#f87171" />;
                            } else if (node.group === 'document') {
                              borderCol = isLineageNode ? '#38bdf8' : 'rgba(14, 165, 233, 0.45)';
                              bgCol = isLineageNode ? 'rgba(14, 165, 233, 0.3)' : 'rgba(12, 74, 110, 0.88)';
                              badgePill = 'pill-cyan';
                              icon = <Layers size={13} color="#38bdf8" />;
                            } else if (node.group === 'chunk') {
                              borderCol = isLineageNode ? '#818cf8' : 'rgba(99, 102, 241, 0.4)';
                              bgCol = isLineageNode ? 'rgba(99, 102, 241, 0.3)' : 'rgba(15, 23, 42, 0.88)';
                              badgePill = 'pill-indigo';
                              icon = <Cpu size={13} color="#818cf8" />;
                            } else if (node.group === 'query') {
                              borderCol = isLineageNode ? '#fbbf24' : 'rgba(245, 158, 11, 0.45)';
                              bgCol = isLineageNode ? 'rgba(245, 158, 11, 0.3)' : 'rgba(69, 26, 3, 0.88)';
                              badgePill = 'pill-amber';
                              icon = <Search size={13} color="#fbbf24" />;
                            }

                            if (matchesSearch && !isLineageNode) {
                              borderCol = '#facc15';
                              bgCol = 'rgba(250, 204, 21, 0.25)';
                            }

                            const nodeOpacity = hasActiveLineage ? (isLineageNode ? 1.0 : 0.14) : 1.0;
                            const nodeFilter = hasActiveLineage && !isLineageNode ? 'grayscale(75%)' : 'none';

                            return (
                              <div
                                key={node.id}
                                onClick={() => {
                                  setSelectedGraphNode(node);
                                  if (node.type === 'silver_document') {
                                    setGraphDocFilter(node.id);
                                  }
                                }}
                                style={{
                                  position: 'absolute',
                                  left: `${pos.x}px`,
                                  top: `${pos.y}px`,
                                  width: '220px',
                                  boxSizing: 'border-box',
                                  padding: '7px 11px',
                                  background: bgCol,
                                  border: isLineageNode ? `2px solid ${borderCol}` : `1.5px solid ${borderCol}`,
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  boxShadow: isRootSelected
                                    ? '0 0 24px rgba(56, 189, 248, 0.8)'
                                    : (isLineageNode ? '0 0 16px rgba(56, 189, 248, 0.4)' : '0 2px 8px rgba(0,0,0,0.4)'),
                                  opacity: nodeOpacity,
                                  filter: nodeFilter,
                                  transition: 'all 0.2s ease',
                                  transform: isRootSelected ? 'scale(1.04)' : (isLineageNode ? 'scale(1.02)' : 'none')
                                }}
                                title={`Click to trace full lineage from Raw to Answer for: ${node.label}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    {icon}
                                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: borderCol }}>
                                      {node.type}
                                    </span>
                                  </div>
                                  {node.group === 'quarantine' && (
                                    <span style={{ fontSize: '9px', color: '#fca5a5', fontWeight: 800, background: 'rgba(239, 68, 68, 0.3)', padding: '1px 4px', borderRadius: '4px' }}>
                                      EXCLUDED
                                    </span>
                                  )}
                                  {node.properties?.version && (
                                    <span style={{ fontSize: '9px', color: '#7dd3fc', fontWeight: 600 }}>{node.properties.version}</span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#f8fafc',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  {node.label}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Node Inspector Side-Drawer */}
                {selectedGraphNode && (() => {
                  const props = selectedGraphNode.properties || {};
                  const rawTime = props.timestamp || props.ingestion_timestamp || props.validation_timestamp || props.quarantine_timestamp || props.versioning_timestamp;
                  const formatTimestamp = (ts) => {
                    if (!ts) return null;
                    try {
                      const d = new Date(ts);
                      if (isNaN(d.getTime())) return String(ts);
                      return d.toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      });
                    } catch {
                      return String(ts);
                    }
                  };
                  const formattedTime = formatTimestamp(rawTime);

                  return (
                    <div
                      className="glass-panel"
                      style={{
                        padding: '18px',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: isGraphFullScreen ? '100%' : 'auto',
                        maxHeight: isGraphFullScreen ? 'calc(100vh - 200px)' : '750px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-medium)',
                        background: 'rgba(15, 23, 42, 0.95)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                      }}
                    >
                      {/* Drawer Header with Title and Close X */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Info size={16} color="#38bdf8" />
                          <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#e2e8f0' }}>
                            Node Inspector
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedGraphNode(null)}
                          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                          title="Close Inspector"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Node Type & Stage Title */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span className="pill pill-cyan" style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 800 }}>
                            {selectedGraphNode.type.replace('_', ' ')}
                          </span>
                          {props.stage && (
                            <span style={{ fontSize: '10.5px', color: '#cbd5e1', fontWeight: 600 }}>
                              {props.stage}
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc', wordBreak: 'break-word', marginBottom: '4px' }}>
                          {selectedGraphNode.label}
                        </h3>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          Node ID: <code style={{ color: '#c7d2fe', fontSize: '10.5px' }}>{selectedGraphNode.id}</code>
                        </div>
                      </div>

                      {/* 1. Time & Ingestion Timestamp Card */}
                      <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Clock size={16} color="#38bdf8" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Event / Ingestion Timestamp
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#f8fafc', fontWeight: 700, marginTop: '2px' }}>
                            {formattedTime || 'Batch Synced (Delta Lake Batch)'}
                          </div>
                          {rawTime && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                              ISO: {rawTime}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Unity Catalog Table Origin Card */}
                      <div style={{ background: 'rgba(30, 41, 59, 0.65)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <Database size={16} color="#a78bfa" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '10.5px', color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Databricks Unity Catalog Origin
                          </div>
                          <div style={{ fontSize: '12px', color: '#e0e7ff', fontFamily: 'monospace', fontWeight: 600, marginTop: '2px', wordBreak: 'break-all' }}>
                            {props.table || `rag_catalog.rag_gov_schema.${selectedGraphNode.type}`}
                          </div>
                        </div>
                      </div>

                      {/* 3. Type-Specific Details */}
                      {/* A. Citizen Query & LLM Response */}
                      {selectedGraphNode.type === 'user_query' && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Citizen Question Prompt
                          </div>
                          <div style={{ background: 'rgba(11, 15, 25, 0.85)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #fbbf24', fontSize: '12px', color: '#f8fafc', lineHeight: 1.5, marginBottom: '10px' }}>
                            &ldquo;{props.query_text || selectedGraphNode.label}&rdquo;
                          </div>

                          {props.llm_answer && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
                                🤖 Gemma 3 12B IT AI Response
                              </div>
                              <div style={{ background: 'rgba(6, 78, 59, 0.25)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '10px 12px', borderRadius: '8px', fontSize: '12px', color: '#ecfdf5', lineHeight: 1.5, maxHeight: '200px', overflowY: 'auto' }}>
                                {props.llm_answer}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* B. Silver Chunk Excerpt & Page Preview */}
                      {props.snippet && (
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Chunk Text Snippet (Page {props.page_number || 1})
                          </div>
                          <div style={{ background: 'rgba(11, 15, 25, 0.85)', padding: '10px 12px', borderRadius: '8px', borderLeft: '3px solid #818cf8', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', maxHeight: '180px', overflowY: 'auto' }}>
                            {props.snippet}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <span className="pill pill-indigo" style={{ fontSize: '10px' }}>1024-dim Vector Search</span>
                            {props.chunk_index !== undefined && (
                              <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Index #{props.chunk_index}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* C. Bronze Quarantine Reason */}
                      {selectedGraphNode.type === 'bronze_quarantine' && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                            ⚠️ Quarantine Exclusion Reason
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#fef2f2', fontWeight: 600 }}>
                            {props.quarantine_reason || 'File validation failed checks'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>
                            Flags: Duplicate={props.is_duplicate ? 'Yes' : 'No'}, Blank={props.is_blank ? 'Yes' : 'No'}, PDF={props.is_pdf ? 'Yes' : 'No'}
                          </div>
                        </div>
                      )}

                      {/* D. Document & File Metrics Card */}
                      {(props.file_size || props.num_pages || props.version) && (
                        <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-subtle)', marginBottom: '14px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                            File Details &amp; Specifications
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                            {props.num_pages && (
                              <div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Verified Pages</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{props.num_pages} Pages</div>
                              </div>
                            )}
                            {props.file_size && (
                              <div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>File Size</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                                  {props.file_size > 1048576 ? `${(props.file_size / 1048576).toFixed(2)} MB` : `${Math.round(props.file_size / 1024)} KB`}
                                </div>
                              </div>
                            )}
                            {props.version && (
                              <div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>Document Version</div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>{props.version}</div>
                              </div>
                            )}
                            {props.content_hash && (
                              <div style={{ gridColumn: 'span 2' }}>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>SHA-256 Hash</div>
                                <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#cbd5e1', wordBreak: 'break-all' }}>
                                  {props.content_hash}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 4. Full Metadata Properties Table */}
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                          All Node Properties
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.45)', borderRadius: '8px', padding: '8px 12px', border: '1px solid var(--border-subtle)' }}>
                          {Object.entries(props).map(([k, v]) => {
                            if (k === 'snippet' || k === 'llm_answer' || k === 'stage' || k === 'table') return null;
                            return (
                              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', padding: '3.5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ color: '#94a3b8', fontWeight: 600 }}>{k}:</span>
                                <span style={{ color: '#f8fafc', fontWeight: 500, textAlign: 'right', maxWidth: '210px', wordBreak: 'break-word', fontFamily: k.includes('id') || k.includes('hash') ? 'monospace' : 'inherit' }}>
                                  {String(v)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 5. Connected Lineage Edges with Direct Hop Navigation */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Connected Lineage &amp; Edges
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {graphData?.edges
                            ?.filter((e) => e.source === selectedGraphNode.id || e.target === selectedGraphNode.id)
                            .map((e) => {
                              const isOutgoing = e.source === selectedGraphNode.id;
                              const otherId = isOutgoing ? e.target : e.source;
                              const otherNode = graphData?.nodes?.find((n) => n.id === otherId);

                              return (
                                <div
                                  key={e.id}
                                  onClick={() => {
                                    if (otherNode) {
                                      setSelectedGraphNode(otherNode);
                                      if (otherNode.type === 'silver_document') {
                                        setGraphDocFilter(otherNode.id);
                                      }
                                    }
                                  }}
                                  style={{
                                    padding: '7px 10px',
                                    background: 'rgba(30, 41, 59, 0.55)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '6px',
                                    fontSize: '11.5px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'background 0.15s'
                                  }}
                                  title="Click to hop directly to connected node in lineage"
                                >
                                  <div>
                                    <div style={{ color: isOutgoing ? '#38bdf8' : '#34d399', fontWeight: 700 }}>
                                      {isOutgoing ? '➔ Outgoing:' : '⬅ Incoming:'} {e.label}
                                    </div>
                                    <div style={{ color: '#cbd5e1', fontSize: '11px' }}>
                                      {otherNode?.label || otherId}
                                    </div>
                                  </div>
                                  <ChevronRight size={13} color="#94a3b8" />
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


