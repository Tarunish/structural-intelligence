import React, { useRef } from 'react';

const SidebarLeft = ({ file, setFile, onAnalyze, onUseSample, parsedData }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const currentFileName = file?.name || '';
  const rooms = parsedData?.rooms || [];

  return (
    <aside className="panel-left">
      <div>
        <div className="section-label">Input</div>
        <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} // Custom handling above
          />
          <div className="upload-icon">🏗</div>
          <div className="upload-text">Drop floor plan image<br/><strong>or click to upload</strong></div>
          {currentFileName && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--accent2)' }}>
              ✓ {currentFileName}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={onAnalyze}>
          ▶ ANALYZE FLOOR PLAN
        </button>
        <button className="btn btn-secondary" onClick={onUseSample}>
          ⚡ USE SAMPLE (Plan B)
        </button>
      </div>

      <div>
        <div className="section-label">Detected Rooms</div>
        <div className="room-list">
          {rooms.length === 0 ? (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              Upload a floor plan to begin
            </div>
          ) : (
            rooms.map((r, i) => (
              <div key={i} className="room-item">
                <span>{r.label || 'ROOM'}</span>
                <span className="room-count">Detected</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="section-label">Legend</div>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--load-bearing)' }}></div>
            Load-Bearing Wall
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--partition)' }}></div>
            Partition Wall
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'var(--accent3)' }}></div>
            Slab / Column
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#4a8fff' }}></div>
            Floor Slab
          </div>
        </div>
      </div>

      <div>
        <div className="section-label">View Controls</div>
        <div style={{ fontSize: '0.63rem', color: 'var(--text-dim)', lineHeight: 1.8 }}>
          🖱 Left drag — Orbit<br/>
          🖱 Right drag — Pan<br/>
          🖱 Scroll — Zoom<br/>
          ⌨ Buttons below canvas
        </div>
      </div>
    </aside>
  );
};

export default SidebarLeft;
