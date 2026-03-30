import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud, Play, Zap, Box, Hexagon, Component, Layers } from 'lucide-react';

const SidebarLeft = ({ file, setFile, onAnalyze, onUseSample, parsedData }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const currentFileName = file?.name || '';
  const rooms = parsedData?.rooms || [];

  const containerVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.aside 
      className="glass-panel"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants}>
        <div className="section-label"><UploadCloud size={14} /> Input</div>
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
          />
          <UploadCloud className="upload-icon" size={32} />
          <div className="upload-text">
            Drop floor plan image<br/>
            <strong>or click to browse</strong>
          </div>
          {currentFileName && (
            <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--accent2)', fontWeight: 600 }}>
              ✓ {currentFileName}
            </div>
          )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <button className="btn btn-primary" onClick={onAnalyze}>
          <Play size={16} fill="currentColor" /> ANALYZE FLOOR PLAN
        </button>
        <button className="btn btn-secondary" onClick={onUseSample}>
          <Zap size={16} /> USE SAMPLE (Plan B)
        </button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="section-label"><Box size={14} /> Detected Rooms</div>
        <div className="room-list">
          {rooms.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Upload a floor plan to begin
            </div>
          ) : (
            rooms.map((r, i) => (
              <motion.div 
                key={i} 
                className="room-item"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="room-label">{r.label || 'ROOM'}</span>
                <span className="room-count">Detected</span>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="section-label"><Hexagon size={14} /> Legend</div>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--load-bearing)', boxShadow: '0 0 10px var(--load-bearing)' }}></div>
            Load-Bearing Wall
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--partition)', boxShadow: '0 0 10px var(--partition)' }}></div>
            Partition Wall
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--accent3)', boxShadow: '0 0 10px var(--accent3)' }}></div>
            Slab / Column
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--accent2)', boxShadow: '0 0 10px var(--accent2)' }}></div>
            Floor Area
          </div>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} style={{ marginTop: 'auto' }}>
        <div className="section-label"><Component size={14} /> Controls</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
          <Layers size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/> Left drag — Orbit<br/>
          <Layers size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/> Right drag — Pan<br/>
          <Layers size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/> Scroll — Zoom
        </div>
      </motion.div>
    </motion.aside>
  );
};

export default SidebarLeft;
