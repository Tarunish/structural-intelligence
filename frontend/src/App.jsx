import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
      if (useSample) {
        await new Promise(r => setTimeout(r, 800)); // Simulate delay
        data = getMockData();
      } else {
        try {
          const formData = new FormData();
          formData.append('file', file);

          const res = await fetch(`${API}/api/full-pipeline`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(30000)
          });

          if (!res.ok) throw new Error(`API ${res.status}`);
          data = await res.json();
        } catch (apiErr) {
          console.warn('API unavailable, using embedded mock data:', apiErr);
          await new Promise(r => setTimeout(r, 800));
          data = getMockData();
        }
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

  const isAnalyzing = status === 'ANALYZING...';

  return (
    <>
      <motion.header 
        initial={{ y: -70 }} 
        animate={{ y: 0 }} 
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="logo">STRUCTURAL<span>.</span>AI</div>
        <motion.div 
          className={`status-pill ${isAnalyzing ? 'analyzing' : ''}`}
          layout
        >
          <div className="status-dot"></div>
          <span>{status}</span>
        </motion.div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
          <span className="mono">PS2</span> · Autonomous Structural Intelligence
        </div>
      </motion.header>

      <div className="app">
        <SidebarLeft 
          file={file} 
          setFile={setFile} 
          onAnalyze={() => runPipeline(false)} 
          onUseSample={() => runPipeline(true)} 
          parsedData={parsedData}
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ position: 'relative', width: '100%', height: '100%' }}
        >
          <ThreeCanvas 
            ref={canvasRef} 
            parsedData={parsedData} 
            isLoading={isLoading} 
          />
        </motion.div>
        
        <SidebarRight 
          parsedData={parsedData} 
          materialsData={materialsData} 
        />
      </div>
    </>
  );
}

export default App;
