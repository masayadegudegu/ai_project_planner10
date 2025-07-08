
import React from 'react';

interface FlowConnectorProps {
  from: { x: number; y: number };
  to: { x: number; y: number };
  id: string;
  onDelete?: () => void;
}

const FlowConnector: React.FC<FlowConnectorProps> = ({ from, to, id, onDelete }) => {
  const STROKE_WIDTH = 2;
  const ARROW_SIZE = 8;
  const PADDING = 10;

  // Adjust points for padding and arrowhead
  const adjustedFromX = from.x;
  const adjustedToX = to.x;
  
  const midX = (adjustedFromX + adjustedToX) / 2;
  const midY = (from.y + to.y) / 2;

  const pathData = `M${adjustedFromX},${from.y} C${adjustedFromX + 50},${from.y} ${adjustedToX - 50},${to.y} ${adjustedToX},${to.y}`;

  return (
    <svg 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        aria-hidden="true"
    >
      <defs>
        <marker
          id={`arrowhead-${id}`}
          markerWidth={ARROW_SIZE}
          markerHeight={ARROW_SIZE * 0.7}
          refX={ARROW_SIZE}
          refY={ARROW_SIZE * 0.35}
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE*0.35} L0,${ARROW_SIZE*0.7} Z`} fill="#64748b" />
        </marker>
      </defs>
      
      <g style={{ pointerEvents: onDelete ? 'auto' : 'none' }}>
        <path
            d={pathData}
            stroke="#64748b"
            strokeWidth={STROKE_WIDTH}
            markerEnd={`url(#arrowhead-${id})`}
            fill="none"
        />
        {/* Hitbox for easier interaction */}
        <path
            d={pathData}
            stroke="transparent"
            strokeWidth="16"
            fill="none"
            className={onDelete ? "cursor-pointer group" : ""}
            onClick={onDelete}
        />

        {onDelete && (
             <g transform={`translate(${midX}, ${midY})`} className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={onDelete}>
                <circle cx="0" cy="0" r="8" fill="white" stroke="#ef4444" strokeWidth="1"/>
                <path d="M -3.5 -3.5 L 3.5 3.5 M -3.5 3.5 L 3.5 -3.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
            </g>
        )}
      </g>
    </svg>
  );
};

export default FlowConnector;