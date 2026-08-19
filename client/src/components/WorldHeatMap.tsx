import { useMemo } from "react";

const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [-98, 38],
  "Canada": [-106, 56],
  "United Kingdom": [-2, 54],
  "France": [2, 47],
  "Germany": [10, 51],
  "Netherlands": [5, 52],
  "Belgium": [4, 51],
  "Italy": [12, 43],
  "Spain": [-4, 40],
  "Portugal": [-8, 39],
  "Switzerland": [8, 47],
  "Austria": [14, 47],
  "Sweden": [15, 62],
  "Norway": [8, 62],
  "Denmark": [10, 56],
  "Finland": [26, 64],
  "Poland": [20, 52],
  "Czech Republic": [15, 50],
  "Ireland": [-8, 53],
  "Greece": [22, 39],
  "Romania": [25, 46],
  "Russia": [100, 60],
  "Turkey": [35, 39],
  "Japan": [138, 36],
  "China": [105, 35],
  "South Korea": [128, 36],
  "India": [79, 21],
  "Singapore": [104, 1],
  "Hong Kong": [114, 22],
  "Taiwan": [121, 24],
  "Thailand": [101, 14],
  "Indonesia": [118, -2],
  "Australia": [134, -25],
  "New Zealand": [174, -41],
  "Brazil": [-51, -10],
  "Argentina": [-64, -34],
  "Mexico": [-102, 23],
  "Colombia": [-74, 4],
  "Egypt": [30, 27],
  "South Africa": [25, -29],
  "Nigeria": [8, 10],
  "Kenya": [38, 0],
  "Israel": [35, 31],
  "UAE": [54, 24],
  "Saudi Arabia": [45, 24],
  "Unknown": [0, 0],
};

function projectMercator(lon: number, lat: number, width: number, height: number): [number, number] {
  const x = ((lon + 180) / 360) * width;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = height / 2 - (mercN / Math.PI) * (height / 2);
  return [x, y];
}

const WORLD_PATH = "M167,121l1,1l0,1l-2,1l-1,0l0,-1l1,-1l1,-1ZM171,118l1,0l1,1l-1,1l-1,0l0,-2ZM225,105l1,1l0,1l-1,0l0,-2ZM239,99l1,1l-1,1l0,-2ZM240,96l1,1l-1,1l0,-2ZM258,88l2,1l0,1l-2,0l0,-2ZM275,76l1,2l-2,0l1,-2ZM286,72l2,1l-1,1l-1,-2ZM180,122l-1,1l-1,0l0,-1l2,0ZM174,117l1,1l-1,1l0,-2Z";

interface WorldHeatMapProps {
  visitsByCountry: Record<string, number>;
}

export default function WorldHeatMap({ visitsByCountry }: WorldHeatMapProps) {
  const width = 800;
  const height = 420;

  const maxVisits = useMemo(() => {
    const vals = Object.values(visitsByCountry);
    return vals.length > 0 ? Math.max(...vals) : 1;
  }, [visitsByCountry]);

  const markers = useMemo(() => {
    return Object.entries(visitsByCountry)
      .filter(([country]) => country !== "Unknown" && COUNTRY_COORDS[country])
      .map(([country, count]) => {
        const [lon, lat] = COUNTRY_COORDS[country];
        const [x, y] = projectMercator(lon, lat, width, height);
        const intensity = count / maxVisits;
        const radius = Math.max(4, Math.min(20, 4 + intensity * 16));
        return { country, count, x, y, radius, intensity };
      })
      .sort((a, b) => a.count - b.count);
  }, [visitsByCountry, maxVisits]);

  const graticuleLines = useMemo(() => {
    const lines: string[] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const points: string[] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        const [x, y] = projectMercator(lon, lat, width, height);
        points.push(`${x},${y}`);
      }
      lines.push(`M${points.join("L")}`);
    }
    for (let lat = -60; lat <= 80; lat += 30) {
      const points: string[] = [];
      for (let lon = -180; lon <= 180; lon += 5) {
        const [x, y] = projectMercator(lon, lat, width, height);
        points.push(`${x},${y}`);
      }
      lines.push(`M${points.join("L")}`);
    }
    return lines.join(" ");
  }, []);

  const coastlines = useMemo(() => {
    const regions: Array<{ path: string }> = [];

    const addRegion = (coords: number[][]) => {
      const pts = coords.map(([lon, lat]) => {
        const [x, y] = projectMercator(lon, lat, width, height);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      regions.push({ path: `M${pts.join("L")}Z` });
    };

    addRegion([[-125,50],[-125,25],[-105,25],[-100,30],[-80,25],[-82,30],[-75,35],[-70,42],[-67,45],[-65,48],[-60,47],[-55,50],[-60,55],[-65,60],[-70,58],[-80,62],[-85,65],[-90,68],[-100,70],[-110,72],[-120,70],[-130,72],[-140,60],[-135,55],[-130,52],[-125,50]]);
    addRegion([[-120,35],[-118,33],[-110,32],[-105,30],[-100,28],[-97,26],[-95,19],[-90,16],[-87,14],[-85,11],[-83,10],[-80,8],[-77,8],[-75,5],[-70,5],[-65,10],[-60,11],[-55,5],[-50,0],[-45,-3],[-40,-5],[-38,-10],[-35,-12],[-40,-20],[-48,-25],[-50,-28],[-53,-33],[-58,-38],[-65,-42],[-68,-52],[-70,-50],[-72,-45],[-75,-40],[-72,-35],[-70,-30],[-70,-20],[-75,-15],[-80,-5],[-78,2],[-80,5],[-80,8],[-82,10],[-85,14],[-90,16],[-95,19],[-97,26],[-100,28],[-105,30],[-110,32],[-115,32],[-120,35]]);
    addRegion([[-10,36],[-5,36],[0,36],[5,37],[10,37],[12,38],[15,38],[18,40],[20,40],[25,38],[27,37],[30,37],[35,37],[35,32],[32,31],[25,30],[20,32],[15,32],[10,35],[5,36],[0,36],[-5,36],[-10,36]]);
    addRegion([[-10,36],[-10,42],[-2,44],[0,43],[3,43],[5,44],[8,44],[10,46],[7,48],[2,49],[-2,48],[-5,48],[-8,44],[-10,42]]);
    addRegion([[2,49],[5,52],[4,53],[7,54],[8,55],[10,54],[12,54],[14,52],[15,51],[18,48],[17,46],[14,46],[12,44],[10,46],[7,48],[2,49]]);
    addRegion([[-8,54],[-6,52],[-5,50],[0,50],[2,51],[2,53],[0,54],[-2,56],[-5,58],[-6,58],[-8,57],[-8,54]]);
    addRegion([[5,60],[8,58],[12,56],[15,57],[18,57],[20,58],[22,59],[22,60],[20,62],[18,64],[15,67],[12,68],[10,69],[8,68],[5,62],[5,60]]);
    addRegion([[20,40],[22,42],[23,44],[26,45],[28,46],[30,48],[32,50],[34,52],[30,55],[28,56],[24,55],[22,54],[20,52],[18,51],[15,51],[14,52],[16,54],[14,55],[18,57],[22,59],[25,60],[28,62],[30,64],[30,68],[28,70],[32,70],[40,68],[50,68],[55,70],[60,72],[70,72],[75,70],[80,68],[85,70],[90,72],[100,72],[110,70],[120,68],[130,65],[135,60],[140,55],[140,50],[135,48],[135,43],[140,42],[142,45],[145,48],[148,50],[150,52],[155,55],[160,60],[162,62],[165,65],[170,66],[175,68],[180,68],[180,65],[178,62],[170,58],[165,55],[160,50],[155,45],[150,42],[148,42],[145,43],[142,45],[140,42],[135,43],[135,48],[140,50],[140,45],[135,40],[130,35],[126,38],[125,35],[120,35],[115,30],[110,25],[105,20],[100,15],[100,10],[105,5],[110,0],[115,-5],[120,-8],[115,-8],[110,-5],[105,0],[100,5],[100,10],[95,10],[90,22],[85,22],[80,15],[75,15],[70,22],[65,25],[60,25],[55,25],[50,25],[48,28],[45,25],[42,15],[44,12],[45,10],[50,10],[52,14],[55,17],[56,24],[57,25],[60,25],[62,22],[58,20],[55,17],[52,14],[50,10],[45,10],[44,12],[42,15],[35,12],[32,12],[30,15],[35,32],[35,37],[30,37],[28,37],[26,38],[23,38],[20,40]]);
    addRegion([[-15,12],[-17,14],[-16,18],[-12,20],[-8,20],[-5,18],[-2,15],[2,12],[5,10],[8,8],[10,6],[10,4],[8,5],[5,5],[3,6],[0,5],[-3,5],[-5,4],[-8,5],[-10,5],[-12,8],[-15,10],[-15,12]]);
    addRegion([[30,5],[32,2],[35,0],[38,-2],[40,-5],[40,-10],[38,-15],[35,-18],[32,-20],[30,-25],[28,-30],[26,-33],[28,-34],[30,-34],[32,-28],[35,-22],[38,-18],[40,-15],[42,-12],[45,-10],[48,-5],[50,0],[50,5],[48,8],[45,10],[42,10],[40,8],[38,5],[35,5],[32,5],[30,5]]);
    addRegion([[110,-10],[115,-8],[120,-8],[125,-8],[130,-8],[135,-12],[138,-15],[140,-18],[145,-20],[148,-22],[150,-25],[152,-28],[153,-30],[150,-35],[148,-38],[145,-40],[140,-38],[135,-35],[130,-32],[125,-30],[120,-30],[115,-32],[115,-35],[118,-35],[120,-33],[125,-30],[128,-28],[130,-28],[128,-25],[125,-22],[122,-18],[120,-15],[118,-12],[115,-10],[110,-10]]);
    addRegion([[95,5],[98,8],[100,10],[102,12],[105,15],[108,18],[110,20],[112,18],[114,15],[112,12],[110,10],[108,8],[105,5],[100,2],[98,0],[95,2],[95,5]]);
    addRegion([[125,35],[128,36],[130,35],[132,34],[135,35],[140,38],[142,40],[145,42],[145,38],[140,35],[135,33],[130,32],[127,33],[125,35]]);

    return regions;
  }, []);

  return (
    <div className="w-full" data-testid="world-heat-map">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto rounded-lg border border-border/30"
        style={{ background: "linear-gradient(180deg, #0c1222 0%, #0a1628 100%)" }}
      >
        <defs>
          <radialGradient id="hotGlow">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#ef4444" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="warmGlow">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#0ea5e9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d={graticuleLines} fill="none" stroke="#1e3a5f" strokeWidth="0.3" opacity="0.4" />

        {coastlines.map((region, i) => (
          <path
            key={i}
            d={region.path}
            fill="#1a2744"
            stroke="#2a4a6b"
            strokeWidth="0.5"
            opacity="0.8"
          />
        ))}

        {markers.map((m) => (
          <g key={m.country}>
            <circle
              cx={m.x}
              cy={m.y}
              r={m.radius * 2.5}
              fill={m.intensity > 0.5 ? "url(#hotGlow)" : "url(#warmGlow)"}
              filter="url(#softGlow)"
              opacity={0.4 + m.intensity * 0.4}
            />
            <circle
              cx={m.x}
              cy={m.y}
              r={m.radius}
              fill={m.intensity > 0.7 ? "#f97316" : m.intensity > 0.3 ? "#22d3ee" : "#0ea5e9"}
              filter="url(#glow)"
              opacity={0.7 + m.intensity * 0.3}
              stroke={m.intensity > 0.5 ? "#fdba74" : "#67e8f9"}
              strokeWidth="0.5"
            />
            <circle
              cx={m.x}
              cy={m.y}
              r={Math.max(2, m.radius * 0.4)}
              fill="white"
              opacity={0.8}
            />
            <title>{`${m.country}: ${m.count} visit${m.count !== 1 ? 's' : ''}`}</title>
          </g>
        ))}

        {markers.filter(m => m.count > 0).slice(-5).map((m) => {
          const labelX = m.x + m.radius + 4;
          const labelY = m.y - 2;
          const clampedX = Math.min(Math.max(labelX, 40), width - 60);
          return (
            <g key={`label-${m.country}`}>
              <rect
                x={clampedX - 2}
                y={labelY - 8}
                width={m.country.length * 5.5 + 20}
                height={14}
                rx={3}
                fill="#0f172a"
                fillOpacity="0.85"
                stroke="#334155"
                strokeWidth="0.5"
              />
              <text
                x={clampedX + 2}
                y={labelY + 2}
                fontSize="8"
                fill="#94a3b8"
                fontFamily="monospace"
              >
                {m.country} ({m.count})
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center justify-center gap-6 mt-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-sky-500/70" />
          <span>Low traffic</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-cyan-400/80" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-orange-500/90" />
          <span>High traffic</span>
        </div>
      </div>
    </div>
  );
}
