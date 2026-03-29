import React from 'react';

const SidebarRight = ({ parsedData, materialsData }) => {
  const summary = parsedData?.summary || {};
  const recs = materialsData?.recommendations || [];
  const concerns = recs.flatMap(r => r.structural_concerns || []) || [];
  const cost = materialsData?.estimated_total_cost_inr;

  // Process recommendations into unique material cards
  const uniqueRecs = [];
  const seenTypes = new Set();
  recs.forEach(rec => {
    if (!seenTypes.has(rec.element_type)) {
      seenTypes.add(rec.element_type);
      uniqueRecs.push(rec);
    }
  });

  return (
    <aside className="panel-right">
      <div>
        <div className="section-label">Structure Stats</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{summary.total_walls || '--'}</div>
            <div className="stat-label">Total Walls</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{summary.load_bearing || '--'}</div>
            <div className="stat-label">Load-Bearing</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{summary.total_rooms || '--'}</div>
            <div className="stat-label">Rooms</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>
              {(materialsData?.summary?.total_concerns ?? concerns.length) || '--'}
            </div>
            <div className="stat-label">Concerns</div>
          </div>
        </div>
      </div>

      <div>
        <div className="section-label">Estimated Cost</div>
        <div className="cost-display">
          <div className="cost-amount">
            {cost ? '₹' + Math.round(cost).toLocaleString('en-IN') : '--'}
          </div>
          <div className="cost-label">ESTIMATED MATERIAL COST (INR)</div>
        </div>
      </div>

      <div>
        <div className="section-label">Material Recommendations</div>
        <div className="material-list">
          {!recs.length ? (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              Run analysis to see recommendations
            </div>
          ) : (
            uniqueRecs.map((rec, i) => {
              const top = rec.top_materials?.[0];
              if (!top) return null;
              
              const mat = top.material;
              const score = top.tradeoff_score;
              const cls = rec.element_type === 'LOAD_BEARING' ? 'load' : rec.element_type === 'PARTITION' ? 'partition' : 'slab';
              
              return (
                <div key={i} className={`material-card ${cls}`}>
                  <div className="mat-header">
                    <div className="mat-name">{mat.name}</div>
                    <div className="mat-score">{(score * 100).toFixed(0)}%</div>
                  </div>
                  <div className="mat-type">
                    {rec.element_type.replace('_', ' ')} · Span: {rec.span_m}m
                  </div>
                  <div className="score-bar">
                    <div 
                      className="score-fill" 
                      style={{ 
                        width: `${score * 100}%`,
                        background: cls === 'partition' ? 'var(--accent2)' : cls === 'slab' ? 'var(--accent3)' : 'var(--accent)'
                      }}
                    ></div>
                  </div>
                  <div style={{ marginTop: '0.4rem', fontSize: '0.6rem', color: 'var(--text-dim)' }}>
                    {mat.description}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="section-label">Structural Concerns</div>
        <div>
          {concerns.length === 0 ? (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              No concerns detected yet
            </div>
          ) : (
            concerns.map((c, i) => (
              <div key={i} className="concern-item">⚠ {c}</div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="section-label">AI Explanation</div>
        <div className="explanation-box">
          {materialsData?.explanation || 'Run analysis to see AI-generated structural explanation...'}
        </div>
      </div>
    </aside>
  );
};

export default SidebarRight;
