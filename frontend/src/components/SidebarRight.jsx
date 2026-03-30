import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Target, Layers, AlignLeft, HardHat, TrendingDown, Maximize2, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SidebarRight = ({ parsedData, materialsData }) => {
  const summary = parsedData?.summary || {};
  const recs = materialsData?.recommendations || [];
  const concerns = recs.flatMap(r => r.structural_concerns || []) || [];
  const cost = materialsData?.estimated_total_cost_inr;
  const breakdown = materialsData?.cost_breakdown;

  const uniqueRecs = [];
  const seenTypes = new Set();
  recs.forEach(rec => {
    if (!seenTypes.has(rec.element_type)) {
      seenTypes.add(rec.element_type);
      uniqueRecs.push(rec);
    }
  });

  const parentVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
  };
  
  const childVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  const hasData = Object.keys(summary).length > 0;
  const visibleConcerns = concerns.slice(0, 3);
  const hiddenConcernsCount = concerns.length - 3;

  return (
    <motion.aside 
      className="glass-panel right"
      initial="hidden"
      animate="visible"
      variants={parentVariants}
    >
      <motion.div variants={childVariants}>
        <div className="section-label"><Target size={14} /> Structure Stats</div>
        <div className="stats-grid">
          <motion.div className="stat-card" whileHover={{ scale: 1.02 }}>
            <div className="stat-value">{summary.total_walls || '--'}</div>
            <div className="stat-label">Total Walls</div>
          </motion.div>
          <motion.div className="stat-card" whileHover={{ scale: 1.02 }}>
            <div className="stat-value">{summary.load_bearing || '--'}</div>
            <div className="stat-label">Load-Bearing</div>
          </motion.div>
          <motion.div className="stat-card" whileHover={{ scale: 1.02 }}>
            <div className="stat-value">{summary.total_rooms || '--'}</div>
            <div className="stat-label">Rooms</div>
          </motion.div>
          <motion.div className="stat-card" whileHover={{ scale: 1.02 }}>
            <div className="stat-value" style={{ color: concerns.length > 0 ? 'var(--accent)' : 'var(--accent2)' }}>
              {hasData ? (materialsData?.summary?.total_concerns ?? concerns.length) : '--'}
            </div>
            <div className="stat-label">Concerns</div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={childVariants}>
        <div className="section-label"><TrendingDown size={14} /> Estimated Cost</div>
        <motion.div className="cost-display" whileHover={{ scale: 1.01 }}>
          <div className="cost-amount">
            {cost ? '₹' + Math.round(cost).toLocaleString('en-IN') : '--'}
          </div>
          <div className="cost-label">ESTIMATED MATERIAL COST (INR)</div>
          
          {breakdown && (
            <div className="cost-breakdown-wrapper">
              <div className="cost-bar">
                <div style={{ width: `${(breakdown.load_bearing / cost) * 100}%`, background: 'var(--load-bearing)' }} title="Load Bearing" />
                <div style={{ width: `${(breakdown.slab / cost) * 100}%`, background: 'var(--slab)' }} title="Floor Slab" />
                <div style={{ width: `${(breakdown.partition / cost) * 100}%`, background: 'var(--partition)' }} title="Partition" />
              </div>
              <div className="cost-legend">
                <span><span className="dot" style={{background: 'var(--load-bearing)'}}></span> Load-Bearing</span>
                <span><span className="dot" style={{background: 'var(--slab)'}}></span> Slabs</span>
                <span><span className="dot" style={{background: 'var(--partition)'}}></span> Partitions</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      <motion.div variants={childVariants}>
        <div className="section-label"><HardHat size={14} /> Recommendations</div>
        <div className="material-list">
          {!recs.length ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Run analysis to see optimized materials
            </div>
          ) : (
            <AnimatePresence>
              {uniqueRecs.map((rec, i) => {
                const top = rec.top_materials?.[0];
                const alt = rec.top_materials?.[1]; 
                if (!top) return null;
                
                const cls = rec.element_type === 'LOAD_BEARING' ? 'load' : rec.element_type === 'PARTITION' ? 'partition' : 'slab';
                
                return (
                  <motion.div 
                    key={i} 
                    className={`material-card ${cls}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {/* Primary Material */}
                    <div className="mat-header">
                      <div className="mat-name">⭐ {top.material.name}</div>
                      <div className="mat-score">{(top.tradeoff_score * 100).toFixed(0)}%</div>
                    </div>
                    <div className="mat-type">
                      <Maximize2 size={12} style={{marginRight:'4px', verticalAlign:'middle'}}/>
                      {rec.element_type.replace('_', ' ')} · Span: {rec.span_m}m
                    </div>
                    <div className="score-bar">
                      <motion.div 
                        className="score-fill" 
                        initial={{ width: 0 }}
                        animate={{ width: `${top.tradeoff_score * 100}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        style={{ background: cls === 'partition' ? 'var(--partition)' : cls === 'slab' ? 'var(--slab)' : 'var(--load-bearing)' }}
                      ></motion.div>
                    </div>
                    <div className="mat-desc">
                      <AlignLeft size={10} style={{marginRight: '4px', verticalAlign: 'middle'}}/> {top.material.description}
                    </div>

                    {/* Alternative Material (if exists) */}
                    {alt && (
                      <div className="alt-mat">
                        <div className="mat-header" style={{ marginBottom: '0.2rem' }}>
                          <div className="mat-name" style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Alt: {alt.material.name}</div>
                          <div className="mat-score" style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.65rem' }}>{(alt.tradeoff_score * 100).toFixed(0)}%</div>
                        </div>
                        <div className="mat-desc" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>
                          {alt.material.description}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <motion.div variants={childVariants}>
        <div className="section-label"><Info size={14} /> Structural Concerns</div>
        <div className="concern-list">
          {concerns.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: hasData ? 'var(--accent2)' : 'var(--text-dim)' }}>
              {hasData ? '✓ No structural concerns detected' : 'No concerns detected yet'}
            </div>
          ) : (
            <>
              {visibleConcerns.map((c, i) => (
                <motion.div key={i} className="concern-item" initial={{ opacity:0 }} animate={{ opacity:1 }}>
                  <span>⚠</span> <span>{c.replace('⚠️', '')}</span>
                </motion.div>
              ))}
              {hiddenConcernsCount > 0 && (
                <div className="concern-hidden-badge">
                  + {hiddenConcernsCount} more minor concerns
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      <motion.div variants={childVariants}>
        <div className="section-label"><Cpu size={14} /> AI Explanation</div>
        <motion.div className="explanation-box raw-markdown" whileHover={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {materialsData?.explanation ? (
            <ReactMarkdown>{materialsData.explanation}</ReactMarkdown>
          ) : 'Run analysis to see AI-generated structural explanation...'}
        </motion.div>
      </motion.div>
    </motion.aside>
  );
};

export default SidebarRight;
