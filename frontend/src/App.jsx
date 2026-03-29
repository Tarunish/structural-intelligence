import React, { useState, useRef } from 'react';
import ThreeCanvas from './components/ThreeCanvas';
import SidebarLeft from './components/SidebarLeft';
import SidebarRight from './components/SidebarRight';
import { getMockData } from './utils/mockData';
import './index.css';

const API = 'http://localhost:8001';

function App() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('READY');
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [materialsData, setMaterialsData] = useState(null);

  const canvasRef = useRef(null);

  const runPipeline = async (useSample = false) => {
    if (!useSample && !file) {
      alert('Please upload a floor plan image first, or click "Use Sample"');
      return;
    }

    setIsLoading(true);
    setStatus('ANALYZING...');

    try {
      let data;
      try {
        const formData = new FormData();
        if (!useSample && file) formData.append('file', file);

        const endpoint = useSample
          ? `${API}/api/full-pipeline?use_fallback=true`
          : `${API}/api/full-pipeline`;

        const res = await fetch(endpoint, {
          method: 'POST',
          body: useSample ? null : formData,
          signal: AbortSignal.timeout(30000)
        });

        if (!res.ok) throw new Error(`API ${res.status}`);
        data = await res.json();
      } catch (apiErr) {
        console.warn('API unavailable, using embedded mock data:', apiErr);
        await new Promise(r => setTimeout(r, 800));
        data = getMockData();
      }

      setParsedData(data.parsed);
      setMaterialsData(data.materials);
      setStatus(data.parsed?.fallback_used ? 'DEMO MODE' : 'COMPLETE');

    } catch (err) {
      console.error(err);
      setStatus('ERROR');
      alert('Pipeline error: ' + err.message);
    }

    setIsLoading(false);
  };

  return (
    <>
      <header>
        <div className="logo">STRUCTURAL<span>.</span>AI</div>
        <div className="status-pill">
          <div className="status-dot"></div>
          <span>{status}</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
          PS2 · Autonomous Structural Intelligence
        </div>
      </header>

      <div className="app">
        <SidebarLeft 
          file={file} 
          setFile={setFile} 
          onAnalyze={() => runPipeline(false)} 
          onUseSample={() => runPipeline(true)} 
          parsedData={parsedData}
        />
        
        <ThreeCanvas 
          ref={canvasRef} 
          parsedData={parsedData} 
          isLoading={isLoading} 
        />
        
        <SidebarRight 
          parsedData={parsedData} 
          materialsData={materialsData} 
        />
      </div>
    </>
  );
}

export default App;
