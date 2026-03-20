import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

/* =========================================================================
   DESIGN TOKENS
   ========================================================================= */
const T = {
  bg:       "#08080c",
  surface:  "#14141a",
  gold:     "#c9a66b",
  goldDark: "#a07d4a",
  goldLight:"#e0c992",
  text:     "#e8e4df",
  text65:   "rgba(232,228,223,.65)",
  text55:   "rgba(232,228,223,.55)",
  text45:   "rgba(232,228,223,.45)",
  red:      "#e07070",
};

/* =========================================================================
   PLEX API HELPERS
   ========================================================================= */
// In Tauri the WebView can reach local servers directly; proxy only needed in browser dev
const IS_TAURI = typeof window !== "undefined" && (!!window.__TAURI__ || !!window.__TAURI_INTERNALS__);

function plexProxyUrl(serverBase, path) {
  if (IS_TAURI) return `${serverBase}${path}`;
  return `/plex-proxy/${encodeURIComponent(serverBase)}${path}`;
}

async function plexFetch(fullUrl) {
  const parsed = new URL(fullUrl);
  const base = `${parsed.protocol}//${parsed.host}`;
  const path = parsed.pathname + parsed.search;
  let res;
  try {
    res = await fetch(plexProxyUrl(base, path), {
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new Error("Could not reach the Plex server. Check the URL is correct.");
  }
  if (!res.ok) throw new Error(`Plex server responded with ${res.status}`);
  return res.json();
}

async function plexFindMusicSection(serverUrl, token) {
  const data = await plexFetch(`${serverUrl}/library/sections?X-Plex-Token=${token}`);
  const sections = data.MediaContainer.Directory || [];
  const music = sections.find((s) => s.type === "artist");
  if (!music) throw new Error("No music library found on this Plex server.");
  return music.key;
}

async function plexFetchAlbums(serverUrl, token, sectionKey) {
  const data = await plexFetch(
    `${serverUrl}/library/sections/${sectionKey}/all?type=9&X-Plex-Token=${token}`
  );
  return data.MediaContainer.Metadata || [];
}

async function plexFetchTracks(serverUrl, token, ratingKey) {
  const data = await plexFetch(
    `${serverUrl}/library/metadata/${ratingKey}/children?X-Plex-Token=${token}`
  );
  return data.MediaContainer.Metadata || [];
}

// --- Mock Data (fallback when not connected to Plex) ---
const ALBUMS = [
  { id: 1, title: "Rumours", artist: "Fleetwood Mac", year: 1977 },
  { id: 2, title: "OK Computer", artist: "Radiohead", year: 1997 },
  { id: 3, title: "Purple Rain", artist: "Prince", year: 1984 },
  { id: 4, title: "Blue Train", artist: "John Coltrane", year: 1958 },
  { id: 5, title: "Hounds of Love", artist: "Kate Bush", year: 1985 },
  { id: 6, title: "Remain in Light", artist: "Talking Heads", year: 1980 },
  { id: 7, title: "Loveless", artist: "My Bloody Valentine", year: 1991 },
  { id: 8, title: "Vespertine", artist: "Björk", year: 2001 },
  { id: 9, title: "Dummy", artist: "Portishead", year: 1994 },
  { id: 10, title: "Homogenic", artist: "Björk", year: 1997 },
  { id: 11, title: "Miseducation", artist: "Lauryn Hill", year: 1998 },
  { id: 12, title: "Selected Ambient Works", artist: "Aphex Twin", year: 1992 },
  { id: 13, title: "Disintegration", artist: "The Cure", year: 1989 },
  { id: 14, title: "Spirit of Eden", artist: "Talk Talk", year: 1988 },
  { id: 15, title: "Third", artist: "Portishead", year: 2008 },
];

const TRACKS = {
  1: ["Second Hand News", "Dreams", "Never Going Back Again", "Don't Stop", "Go Your Own Way", "Songbird", "The Chain", "You Make Loving Fun", "I Don't Want to Know", "Oh Daddy", "Gold Dust Woman"],
  2: ["Airbag", "Paranoid Android", "Subterranean Homesick Alien", "Exit Music", "Let Down", "Karma Police", "Fitter Happier", "Electioneering", "Climbing Up the Walls", "No Surprises", "Lucky", "The Tourist"],
  3: ["Let's Go Crazy", "Take Me with U", "The Beautiful Ones", "Computer Blue", "Darling Nikki", "When Doves Cry", "I Would Die 4 U", "Baby I'm a Star", "Purple Rain"],
  4: ["Blue Train", "Moment's Notice", "Locomotion", "I'm Old Fashioned", "Lazy Bird"],
  5: ["Running Up That Hill", "Hounds of Love", "The Big Sky", "Mother Stands for Comfort", "Cloudbusting", "And Dream of Sheep", "Under Ice", "Waking the Witch", "Watching You Without Me", "Jig of Life", "Hello Earth", "The Morning Fog"],
  6: ["Born Under Punches", "Crosseyed and Painless", "The Great Curve", "Once in a Lifetime", "Houses in Motion", "Seen and Not Seen", "Listening Wind", "The Overload"],
  7: ["Only Shallow", "Loomer", "Touched", "To Here Knows When", "When You Sleep", "I Only Said", "Come In Alone", "Sometimes", "Blown a Wish", "What You Want"],
  8: ["Hidden Place", "Cocoon", "It's Not Up to You", "Undo", "Pagan Poetry", "Possibly Maybe", "An Echo a Stain", "Sun in My Mouth", "Heirloom", "Harm of Will", "Unison"],
  9: ["Mysterons", "Sour Times", "Strangers", "It Could Be Sweet", "Wandering Star", "It's a Fire", "Numb", "Roads", "Pedestal", "Biscuit", "Glory Box"],
  10: ["Hunter", "Jóga", "Unravel", "Bachelorette", "All Neon Like", "5 Years", "Immature", "Alarm Call", "Pluto", "All Is Full of Love"],
  11: ["Intro", "Lost Ones", "Ex-Factor", "To Zion", "Doo Wop", "Superstar", "Final Hour", "When It Hurts So Bad", "I Used to Love Him", "Forgive Them Father", "Every Ghetto", "Nothing Even Matters", "Everything Is Everything", "The Miseducation of Lauryn Hill"],
  12: ["Xtal", "Tha", "Pulsewidth", "Ageispolis", "i", "Green Calx", "Heliosphan", "We Are the Music Makers", "Schottkey 7th Path", "Ptolemy", "Hedphelym", "Delphinium", "Actium"],
  13: ["Plainsong", "Pictures of You", "Closedown", "Lovesong", "Last Dance", "Lullaby", "Fascination Street", "Prayers for Rain", "The Same Deep Water as You", "Disintegration", "Homesick", "Untitled"],
  14: ["The Rainbow", "Eden", "Desire", "Inheritance", "I Believe in You", "Wealth"],
  15: ["Silence", "Hunter", "Nylon Smile", "The Rip", "Plastic", "We Carry On", "Deep Water", "Machine Gun", "Small", "Third", "Threads"],
};

/* =========================================================================
   SPRING PHYSICS ENGINE
   - Continuous float position (not integer snapping)
   - Critically-damped spring for settling
   - Momentum carry from drag/wheel release
   - requestAnimationFrame loop, no CSS transitions on covers
   ========================================================================= */
function useSpringCarousel(itemCount, initialIndex = 7) {
  const pos = useRef(initialIndex);
  const vel = useRef(0);
  const tgt = useRef(initialIndex);
  const raf = useRef(null);
  const [renderPos, setRenderPos] = useState(initialIndex);
  const [settled, setSettled] = useState(initialIndex);
  const dragging = useRef(false);
  const dragX0 = useRef(0);
  const dragPos0 = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const dragVel = useRef(0);
  const wheelTO = useRef(null);

  const STIFF = 170;
  const DAMP = 22;
  const THRESH = 0.0008;
  const VTHRESH = 0.008;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const tick = useCallback(() => {
    if (dragging.current) {
      setRenderPos(pos.current);
      raf.current = requestAnimationFrame(tick);
      return;
    }

    const dt = 1 / 60;
    const dx = pos.current - tgt.current;
    const a = (-STIFF * dx - DAMP * vel.current);
    vel.current += a * dt;
    pos.current += vel.current * dt;

    if (pos.current < -0.15) { pos.current = -0.15; vel.current *= -0.2; }
    if (pos.current > itemCount - 0.85) { pos.current = itemCount - 0.85; vel.current *= -0.2; }

    if (Math.abs(dx) < THRESH && Math.abs(vel.current) < VTHRESH) {
      pos.current = tgt.current;
      vel.current = 0;
      setRenderPos(tgt.current);
      setSettled(tgt.current);
      return;
    }

    setRenderPos(pos.current);
    setSettled(Math.round(clamp(pos.current, 0, itemCount - 1)));
    raf.current = requestAnimationFrame(tick);
  }, [itemCount]);

  const go = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
  }, [tick]);

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        tgt.current = clamp(Math.round(tgt.current) - 1, 0, itemCount - 1);
        go();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        tgt.current = clamp(Math.round(tgt.current) + 1, 0, itemCount - 1);
        go();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [itemCount, go]);

  // Wheel: accumulate into velocity, debounce snap
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const d = (e.deltaX || e.deltaY) * 0.004;
    vel.current += d * 8;
    clearTimeout(wheelTO.current);
    wheelTO.current = setTimeout(() => {
      const proj = pos.current + vel.current * 0.14;
      tgt.current = clamp(Math.round(proj), 0, itemCount - 1);
    }, 80);
    tgt.current = clamp(Math.round(pos.current + vel.current * 0.11), 0, itemCount - 1);
    go();
  }, [itemCount, go]);

  // Drag
  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    dragX0.current = e.clientX;
    dragPos0.current = pos.current;
    lastX.current = e.clientX;
    lastT.current = performance.now();
    dragVel.current = 0;
    vel.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
    go();
  }, [go]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const now = performance.now();
    const dt = Math.max(now - lastT.current, 1);
    const iv = (lastX.current - e.clientX) / dt;
    dragVel.current = dragVel.current * 0.65 + iv * 0.35;
    lastX.current = e.clientX;
    lastT.current = now;
    const dx = e.clientX - dragX0.current;
    pos.current = dragPos0.current - dx * 0.006;
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    vel.current = dragVel.current * 14;
    const proj = pos.current + vel.current * 0.14;
    tgt.current = clamp(Math.round(proj), 0, itemCount - 1);
    go();
  }, [itemCount, go]);

  const jumpTo = useCallback((i) => {
    tgt.current = clamp(i, 0, itemCount - 1);
    go();
  }, [itemCount, go]);

  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    clearTimeout(wheelTO.current);
  }, []);

  return { renderPos, settled, onWheel, onPointerDown, onPointerMove, onPointerUp, jumpTo };
}

/* =========================================================================
   ALBUM ART — Procedural SVG (falls back when no Plex artwork)
   ========================================================================= */
function AlbumArt({ album, size = 220 }) {
  if (album.thumbUrl) {
    return (
      <img
        src={album.thumbUrl}
        width={size}
        height={size}
        style={{ display: "block", borderRadius: 6, objectFit: "cover", width: size, height: size }}
      />
    );
  }

  const h = album.id * 2654435761;
  const h1 = h % 360;
  const h2 = (h * 7 + 137) % 360;
  const p = h % 5;

  const P = [
    <>
      <rect width={size} height={size} fill={`hsl(${h1},35%,15%)`} />
      <rect x={size*.08} y={size*.08} width={size*.38} height={size*.38} fill={`hsl(${h2},50%,30%)`} rx="3" />
      <rect x={size*.54} y={size*.54} width={size*.38} height={size*.38} fill={`hsl(${h1},40%,25%)`} rx="3" />
      <circle cx={size*.72} cy={size*.25} r={size*.13} fill={`hsl(${h2},60%,45%)`} opacity=".7" />
    </>,
    <>
      <rect width={size} height={size} fill={`hsl(${h1},25%,10%)`} />
      <circle cx={size/2} cy={size/2} r={size*.42} fill="none" stroke={`hsl(${h2},50%,35%)`} strokeWidth="2" />
      <circle cx={size/2} cy={size/2} r={size*.3} fill="none" stroke={`hsl(${h2},50%,30%)`} strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={size*.16} fill={`hsl(${h2},60%,40%)`} />
    </>,
    <>
      <rect width={size} height={size} fill={`hsl(${h1},30%,18%)`} />
      <polygon points={`0,0 ${size},0 ${size},${size}`} fill={`hsl(${h2},40%,25%)`} />
      <rect x={size*.3} y={size*.3} width={size*.4} height={size*.4} fill={`hsl(${h1},50%,35%)`} rx="50%" />
    </>,
    <>
      <rect width={size} height={size} fill={`hsl(${h1},30%,12%)`} />
      {[.15,.35,.55,.75].map((y,i)=><rect key={i} x="0" y={size*y} width={size} height={size*.1} fill={`hsl(${(h2+i*30)%360},50%,${25+i*5}%)`} />)}
    </>,
    <>
      <rect width={size} height={size} fill={`hsl(${h1},20%,8%)`} />
      <ellipse cx={size*.5} cy={size*.7} rx={size*.6} ry={size*.25} fill={`hsl(${h1},30%,20%)`} />
      <circle cx={size*.3} cy={size*.25} r={size*.09} fill={`hsl(${h2},70%,60%)`} />
      <rect x={size*.1} y={size*.85} width={size*.8} height={size*.05} fill={`hsl(${h2},40%,30%)`} rx="2" />
    </>,
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display:"block", borderRadius:6 }}>
      {P[p]}
      <text x={size*.08} y={size*.93} fill="rgba(255,255,255,.55)" fontSize={size*.052} fontFamily="'DM Sans',sans-serif" fontWeight="500">{album.artist}</text>
      <text x={size*.08} y={size*.82} fill="rgba(255,255,255,.85)" fontSize={size*.072} fontFamily="'Playfair Display',serif" fontWeight="700">{album.title.length>20?album.title.slice(0,18)+"…":album.title}</text>
    </svg>
  );
}

/* =========================================================================
   COVER FLOW RENDERER
   - Reads continuous float from spring engine
   - All transforms computed per rAF frame, ZERO CSS transitions on covers
   - GPU-composited: only transform + opacity + filter
   ========================================================================= */
function CoverFlow({ albums, renderPos, settled, onWheel, onPointerDown, onPointerMove, onPointerUp, jumpTo }) {
  const ref = useRef(null);
  const SZ = 220;
  const GAP = 64;
  const PUSH = 155;
  const ROT = 62;
  const POP = 110;
  const SC = 1.14;

  useEffect(() => {
    const el = ref.current;
    if (el) el.addEventListener("wheel", onWheel, { passive: false });
    return () => el?.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        width:"100%", height:"clamp(280px, 44vh, 460px)",
        perspective:"1400px", perspectiveOrigin:"50% 36%",
        position:"relative", cursor:"grab",
        userSelect:"none", touchAction:"none", overflow:"hidden",
      }}
      tabIndex={0} role="listbox" aria-label="Album cover flow" aria-roledescription="carousel"
    >
      {/* Floor fade */}
      <div style={{
        position:"absolute", bottom:0, left:0, right:0, height:"32%",
        background:"linear-gradient(to bottom, rgba(8,8,12,0) 0%, rgba(8,8,12,.85) 100%)",
        pointerEvents:"none", zIndex:9999,
      }} />

      {albums.map((album, i) => {
        const off = i - renderPos;
        const abs = Math.abs(off);
        if (abs > 7) return null;

        // Centeredness (1 = dead centre, smooth falloff)
        const c = Math.max(0, 1 - abs);
        const c2 = c * c;

        // X: smooth centre-to-side blend
        let tx;
        if (abs < 1) {
          tx = off * PUSH;
        } else {
          const sign = off > 0 ? 1 : -1;
          tx = sign * (PUSH + (abs - 1) * GAP);
        }

        // Z: pop centre forward, sides recede gently
        const tz = c2 * POP - (1 - c) * abs * 6;

        // Rotation: smooth from 0 to ROT
        const rotAmount = Math.min(1, abs * 1.3);
        const ry = abs < 0.005 ? 0 : (off < 0 ? ROT * rotAmount : -ROT * rotAmount);

        // Scale
        const sc = 1 + (SC - 1) * c2;

        // Opacity
        const op = abs > 6 ? 0 : abs > 4 ? .15 : Math.max(.3, 1 - abs * .1);

        // Z-index
        const zi = Math.round(200 - abs * 10);

        // Brightness: sides dim
        const br = .42 + .58 * c;

        return (
          <div
            key={album.id}
            role="option"
            aria-selected={i === settled}
            aria-label={`${album.title} by ${album.artist}`}
            onClick={() => jumpTo(i)}
            style={{
              position:"absolute",
              left:"50%", top:"50%",
              width:SZ, height:SZ,
              marginLeft:-SZ/2, marginTop:-SZ/2 - 24,
              transformStyle:"preserve-3d",
              transform:`translateX(${tx}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`,
              opacity:op, zIndex:zi,
              cursor:"pointer",
              willChange:"transform, opacity",
              filter:`brightness(${br})`,
              // NO transition property — driven entirely by rAF
            }}
          >
            <AlbumArt album={album} size={SZ} />
            {/* Reflection */}
            <div style={{
              marginTop:6, transform:"scaleY(-1)", opacity:.11,
              maskImage:"linear-gradient(to bottom,rgba(0,0,0,.45) 0%,transparent 50%)",
              WebkitMaskImage:"linear-gradient(to bottom,rgba(0,0,0,.45) 0%,transparent 50%)",
              pointerEvents:"none",
            }}>
              <AlbumArt album={album} size={SZ} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================================
   PLAYER CONTROLS
   ========================================================================= */
function PlayerControls({ isPlaying, onPlayPause, onPrev, onNext, currentTrack, album, progress, onSeek }) {
  const trackName = typeof currentTrack === "string" ? currentTrack : currentTrack?.title;
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, padding:"0 40px" }}>
      <div style={{ textAlign:"center", minHeight:48 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, color:"#e8e4df", letterSpacing:".02em" }}>
          {trackName || "Select an album"}
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.text55, marginTop:3, letterSpacing:".04em", textTransform:"uppercase" }}>
          {album ? `${album.artist}  ·  ${album.title}` : ""}
        </div>
      </div>

      <div style={{ width:"100%", maxWidth:400, position:"relative" }}>
        <input
          type="range" min="0" max="100" step="0.1"
          value={progress}
          onChange={e => onSeek(Number(e.target.value))}
          className="seek-bar"
          aria-label="Playback position"
          style={{ background: `linear-gradient(to right, #c9a66b ${progress}%, rgba(255,255,255,.08) ${progress}%)` }}
        />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:32, marginTop:4 }}>
        <button onClick={onPrev} style={bS} aria-label="Previous track">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
        </button>
        <button onClick={onPlayPause} style={{...bS,...pS}} aria-label={isPlaying?"Pause":"Play"}>
          {isPlaying
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>}
        </button>
        <button onClick={onNext} style={bS} aria-label="Next track">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>
    </div>
  );
}

const bS = {
  background:"none", border:"1px solid rgba(255,255,255,.1)",
  borderRadius:"50%", width:44, height:44,
  display:"flex", alignItems:"center", justifyContent:"center",
  color:T.text65, cursor:"pointer", transition:"all .2s",
};
const pS = {
  width:56, height:56,
  background:`linear-gradient(135deg,${T.gold},${T.goldDark})`,
  border:"none", color:T.bg,
};

/* =========================================================================
   TRACK LIST
   ========================================================================= */
function TrackList({ tracks, currentTrackIndex, onSelectTrack }) {
  if (!tracks?.length) return null;
  return (
    <div style={{ maxWidth:480, margin:"0 auto", padding:"0 20px" }}>
      <div style={{
        fontFamily:"'DM Sans',sans-serif", fontSize:11,
        textTransform:"uppercase", letterSpacing:".12em",
        color:T.text55, marginBottom:10, paddingLeft:4,
      }}>Tracklist</div>
      <div style={{
        maxHeight:200, overflowY:"auto",
        scrollbarWidth:"thin", scrollbarColor:"rgba(255,255,255,.12) transparent",
      }}>
        {tracks.map((t, i) => {
          const a = i === currentTrackIndex;
          const name = typeof t === "string" ? t : t.title;
          const dur = typeof t === "string"
            ? `${Math.floor(2.5+(t.length%4))}:${String((t.length*7)%60).padStart(2,"0")}`
            : t.duration
              ? `${Math.floor(t.duration/60000)}:${String(Math.floor((t.duration%60000)/1000)).padStart(2,"0")}`
              : null;
          return (
            <button
              key={i}
              className="track-row"
              aria-selected={a}
              onClick={() => onSelectTrack(i)}
            >
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, width:22, textAlign:"right", flexShrink:0, color:a ? T.gold : T.text45 }}>
                {a ? "▸" : String(i+1).padStart(2,"0")}
              </span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:a ? T.goldLight : T.text65, fontWeight:a?500:400, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {name}
              </span>
              {dur && (
                <span style={{ marginLeft:"auto", fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.text45, flexShrink:0 }}>
                  {dur}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   SEARCH PALETTE
   - Triggered by "/" key or search icon in header
   - Filters by title or artist, shows top-10 results
   - Arrow keys navigate, Enter/click selects → jumpTo index
   ========================================================================= */
function SearchPalette({ albums, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const lq = q.toLowerCase();
    return albums
      .map((a, i) => ({ ...a, _idx: i }))
      .filter(a =>
        a.title.toLowerCase().includes(lq) ||
        a.artist.toLowerCase().includes(lq)
      )
      .slice(0, 10);
  }, [albums, q]);

  useEffect(() => { setHi(0); }, [results.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = listRef.current?.children[hi];
    el?.scrollIntoView({ block: "nearest" });
  }, [hi]);

  function handleKeyDown(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); return; }
    if (e.key === "Enter" && results[hi]) { onSelect(results[hi]._idx); }
  }

  const rowS = (active) => ({
    display: "flex", alignItems: "center", gap: 12,
    padding: "9px 14px", cursor: "pointer",
    background: active ? "rgba(201,166,107,.1)" : "transparent",
    borderLeft: `2px solid ${active ? T.gold : "transparent"}`,
    transition: "background .08s",
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 10002,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: IS_TAURI ? 88 : 72,
        background: "rgba(0,0,0,.55)",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search albums"
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(540px, 92vw)",
          background: T.surface,
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,.7)",
        }}
      >
        {/* Input row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: T.text45, flexShrink: 0 }}>
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search albums or artists…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: T.text, fontFamily: "'DM Sans',sans-serif", fontSize: 15,
              caretColor: T.gold,
            }}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.text45, padding: 2, lineHeight: 1 }}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          )}
          <kbd style={{
            flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: 11,
            color: T.text45, background: "rgba(255,255,255,.05)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 4,
            padding: "2px 6px",
          }}>Esc</kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div
            ref={listRef}
            style={{ maxHeight: 360, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,.1) transparent" }}
          >
            {results.map((a, i) => (
              <div
                key={a._idx}
                style={rowS(i === hi)}
                onClick={() => onSelect(a._idx)}
                onMouseEnter={() => setHi(i)}
              >
                {/* Mini art swatch */}
                <div style={{ width: 36, height: 36, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                  <AlbumArt album={a} size={36} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 14,
                    color: T.text, fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {/* Highlight matching chars */}
                    {a.title}
                  </div>
                  <div style={{
                    fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.text55, marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.artist}{a.year ? ` · ${a.year}` : ""}
                  </div>
                </div>
                {i === hi && (
                  <kbd style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.gold,
                    background: "rgba(201,166,107,.08)", border: "1px solid rgba(201,166,107,.2)",
                    borderRadius: 3, padding: "1px 5px", flexShrink: 0,
                  }}>↵</kbd>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {q.trim() && results.length === 0 && (
          <div style={{
            padding: "24px 16px", textAlign: "center",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: T.text45,
          }}>
            No albums matching "{q}"
          </div>
        )}

        {/* Hint when empty */}
        {!q && (
          <div style={{
            padding: "12px 16px",
            fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: T.text45,
            display: "flex", gap: 16,
          }}>
            <span><kbd style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.text45, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 3, padding: "1px 5px" }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.text45, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 3, padding: "1px 5px" }}>↵</kbd> jump to album</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   ALPHABET SCRUBBER
   ========================================================================= */
function AlphabetScrubber({ letters, letterMap, jumpTo, onSearchOpen }) {
  const [active, setActive] = useState(null);
  const indicatorRef = useRef(null);
  const stripRef = useRef(null);
  const scrubbing = useRef(false);

  const jump = useCallback((clientY) => {
    const el = stripRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(0.9999, (clientY - rect.top) / rect.height));
    const letter = letters[Math.floor(pct * letters.length)];
    if (!letter) return;

    // Move indicator via DOM to avoid re-render on every pixel
    if (indicatorRef.current) {
      indicatorRef.current.style.top = `${clientY - 22}px`;
      indicatorRef.current.style.display = "flex";
      indicatorRef.current.textContent = letter;
    }

    setActive(letter);
    if (letterMap[letter] !== undefined) jumpTo(letterMap[letter]);
  }, [letters, letterMap, jumpTo]);

  const onPointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbing.current = true;
    jump(e.clientY);
  }, [jump]);

  const onPointerMove = useCallback((e) => {
    if (!scrubbing.current) return;
    jump(e.clientY);
  }, [jump]);

  const onEnd = useCallback(() => {
    scrubbing.current = false;
    setActive(null);
    if (indicatorRef.current) indicatorRef.current.style.display = "none";
  }, []);

  const itemH = Math.min(20, Math.max(11, Math.floor((typeof window !== "undefined" ? window.innerHeight * 0.65 : 520) / letters.length)));

  return (
    <>
      {/* Floating letter indicator bubble */}
      <div ref={indicatorRef} style={{
        display: "none",
        position: "fixed", right: 38, zIndex: 10001,
        width: 46, height: 46, borderRadius: "50% 0 50% 50%",
        background: "linear-gradient(135deg,#c9a66b,#a07d4a)",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700,
        color: "#08080c", pointerEvents: "none",
        boxShadow: "0 4px 20px rgba(0,0,0,.5)",
      }} />

      {/* Strip */}
      <div
        style={{
          position: "fixed", right: 2, top: "50%", transform: "translateY(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "6px 3px",
          background: active ? "rgba(14,14,20,.7)" : "transparent",
          borderRadius: 12, zIndex: 10000,
          transition: "background .15s",
        }}
      >
        {/* Search icon — 2× the letter font size */}
        <button
          onClick={onSearchOpen}
          aria-label="Search albums"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: T.text45, padding: "4px 0", marginBottom: 5,
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 18, lineHeight: 1,
            transition: "color .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.gold}
          onMouseLeave={e => e.currentTarget.style.color = T.text45}
        >
          <svg width={Math.min(33, (itemH - 1) * 3)} height={Math.min(33, (itemH - 1) * 3)} viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>
        <div
          ref={stripRef}
          role="listbox"
          aria-label="Jump to letter"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onEnd}
          onPointerCancel={onEnd}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none", touchAction: "none", cursor: "default" }}
        >
          {letters.map(l => (
            <div
              key={l}
              role="option"
              aria-selected={active === l}
              aria-label={`Jump to ${l}`}
              style={{
                width: 18, height: itemH,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'DM Sans',sans-serif",
                fontSize: Math.min(11, itemH - 1),
                fontWeight: active === l ? 700 : 400,
                color: active === l ? T.gold : T.text45,
                transition: "color .1s",
                lineHeight: 1,
              }}
            >{l}</div>
          ))}
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   PLEX CONFIG MODAL
   ========================================================================= */
function PlexConfig({ show, onClose, initialUrl, initialToken, onConnect }) {
  const [url, setUrl] = useState(initialUrl || "");
  const [tok, setTok] = useState(initialToken || "");
  const [status, setStatus] = useState("idle"); // idle | connecting | error
  const [error, setError] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const firstInputRef = useRef(null);
  const dialogRef = useRef(null);

  // Sync if parent provides saved values after mount
  useEffect(() => { setUrl(initialUrl || ""); }, [initialUrl]);
  useEffect(() => { setTok(initialToken || ""); }, [initialToken]);

  // Focus first input when modal opens
  useEffect(() => {
    if (show) setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [show]);

  // Focus trap: keep Tab/Shift+Tab inside the dialog
  function handleKeyDown(e) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key !== "Tab") return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }

  async function handleConnect() {
    const u = url.trim().replace(/\/$/, "");
    const t = tok.trim();
    if (!u || !t) { setError("Enter both a server URL and token."); return; }
    setStatus("connecting");
    setError("");
    try {
      await onConnect(u, t);
    } catch (e) {
      setStatus("error");
      setError(e.message || "Could not connect to Plex server.");
    }
  }

  if (!show) return null;

  const stepStyle = {
    display:"flex", gap:10, alignItems:"flex-start",
    fontFamily:"'DM Sans',sans-serif", fontSize:13,
    color:T.text65, lineHeight:1.55,
  };
  const numStyle = {
    flexShrink:0, width:22, height:22, borderRadius:"50%",
    background:"rgba(201,166,107,.15)", color:"#c9a66b",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:11, fontWeight:600, marginTop:1,
  };
  const codeStyle = {
    background:"rgba(255,255,255,.06)", borderRadius:4,
    padding:"2px 6px", fontFamily:"'DM Mono', monospace",
    fontSize:12, color:"#e0c992", whiteSpace:"nowrap",
  };

  return (
    <div
      role="presentation"
      style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,.82)",
        display:"flex", alignItems:"center", justifyContent:"center",
        zIndex:10000,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plex-modal-title"
        onKeyDown={handleKeyDown}
        onClick={e => e.stopPropagation()}
        style={{
          background:T.surface, border:"1px solid rgba(255,255,255,.07)",
          borderRadius:16, padding:32, maxWidth:showHelp ? 520 : 420, width:"90%",
          maxHeight:"90vh", overflowY:"auto",
          scrollbarWidth:"thin", scrollbarColor:"rgba(255,255,255,.12) transparent",
        }}
      >
        <h3 id="plex-modal-title" style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:T.text, margin:"0 0 20px" }}>Connect to Plex</h3>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Server URL field */}
          <div>
            <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.text55, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:5 }}>
              Server URL
            </label>
            <input
              ref={firstInputRef}
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConnect()}
              placeholder="192.168.0.2:32400"
              style={iS}
            />
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.text45, marginTop:4, lineHeight:1.4 }}>
              Your Plex server's local IP and port. Find this in Plex Settings → Remote Access, or check your server machine's network settings. Default port is 32400.
            </div>
          </div>

          {/* Token field */}
          <div>
            <label style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.text55, textTransform:"uppercase", letterSpacing:".08em", display:"block", marginBottom:5 }}>
              X-Plex-Token
            </label>
            <input
              value={tok}
              onChange={e => setTok(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleConnect()}
              placeholder="Paste your token here"
              type="password"
              style={iS}
            />
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background:"rgba(220,60,60,.1)", border:"1px solid rgba(220,60,60,.2)",
              borderRadius:8, padding:"10px 14px",
              fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#e07070", lineHeight:1.4,
            }}>
              {error}
            </div>
          )}

          {/* Toggle help */}
          <button
            onClick={() => setShowHelp(h => !h)}
            style={{
              background:"none", border:"none", padding:0, cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif", fontSize:13,
              color:"#c9a66b", textAlign:"left",
              display:"flex", alignItems:"center", gap:6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"
              style={{ transform: showHelp ? "rotate(90deg)" : "rotate(0deg)", transition:"transform .2s" }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
            {showHelp ? "Hide instructions" : "How do I find my Plex token?"}
          </button>

          {/* Expandable help section */}
          {showHelp && (
            <div style={{
              background:"rgba(255,255,255,.02)",
              border:"1px solid rgba(255,255,255,.06)",
              borderRadius:10, padding:16,
              display:"flex", flexDirection:"column", gap:14,
            }}>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, color:"rgba(232,228,223,.55)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:2 }}>
                Method 1 — Browser Developer Tools (quickest)
              </div>

              <div style={stepStyle}>
                <div style={numStyle}>1</div>
                <div>Open <span style={codeStyle}>app.plex.tv</span> in your browser and sign in to your Plex account.</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>2</div>
                <div>Navigate to any media item in your library (click on a film, album, or episode).</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>3</div>
                <div>Open your browser's Developer Tools (F12, or Cmd+Option+I on macOS) and go to the <strong style={{color:"#e0c992"}}>Network</strong> tab.</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>4</div>
                <div>In the Network tab's filter/search box, type <span style={codeStyle}>X-Plex-Token</span>. You'll see it appear as a query parameter on requests to your server. Copy the token value.</div>
              </div>

              <div style={{ height:1, background:"rgba(255,255,255,.06)", margin:"4px 0" }} />

              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, color:"rgba(232,228,223,.55)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:2 }}>
                Method 2 — View XML (Plex admin only)
              </div>

              <div style={stepStyle}>
                <div style={numStyle}>1</div>
                <div>Open Plex Web App and navigate to any media item in your library.</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>2</div>
                <div>Click the <strong style={{color:"#e0c992"}}>···</strong> (more) menu on the item, then select <strong style={{color:"#e0c992"}}>Get Info</strong>.</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>3</div>
                <div>In the info panel, click <strong style={{color:"#e0c992"}}>View XML</strong> at the bottom left. A new tab will open with XML data.</div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>4</div>
                <div>Look at the URL in your browser's address bar. At the very end you'll see <span style={codeStyle}>X-Plex-Token=xxxxx</span>. That value is your token.</div>
              </div>

              <div style={{ height:1, background:"rgba(255,255,255,.06)", margin:"4px 0" }} />

              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, fontWeight:600, color:"rgba(232,228,223,.55)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:2 }}>
                Method 3 — cURL (for a persistent token)
              </div>

              <div style={stepStyle}>
                <div style={numStyle}>1</div>
                <div style={{flex:1}}>Run this in a terminal (replacing your credentials):
                  <div style={{
                    background:"rgba(0,0,0,.4)", borderRadius:6, padding:"10px 12px",
                    marginTop:8, fontFamily:"'DM Mono', monospace", fontSize:11,
                    color:"rgba(232,228,223,.65)", lineHeight:1.6,
                    overflowX:"auto", whiteSpace:"pre",
                  }}>{`curl -X POST https://plex.tv/users/sign_in.json \\
  -H "X-Plex-Client-Identifier: overflow-app" \\
  -H "X-Plex-Product: Overflow" \\
  -H "X-Plex-Version: 1.0" \\
  -d "user[login]=YOUR_EMAIL" \\
  -d "user[password]=YOUR_PASSWORD"`}</div>
                </div>
              </div>
              <div style={stepStyle}>
                <div style={numStyle}>2</div>
                <div>The response JSON will contain an <span style={codeStyle}>authToken</span> field. This token persists until you explicitly revoke it, unlike browser tokens which may expire.</div>
              </div>

              <div style={{
                background:"rgba(201,166,107,.08)", borderRadius:6, padding:"10px 12px",
                fontFamily:"'DM Sans',sans-serif", fontSize:12,
                color:"rgba(232,228,223,.5)", lineHeight:1.5, marginTop:4,
              }}>
                <strong style={{color:"#c9a66b"}}>Note:</strong> If you use two-factor authentication, append your 2FA code directly to the end of your password (e.g. <span style={codeStyle}>mypassword123456</span>). Tokens generated via the browser methods tend to be temporary. The cURL method or Plex's PIN-based auth flow are better for apps.
              </div>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={status === "connecting"}
            style={{
              borderRadius:8, width:"100%", height:42,
              background: status === "connecting"
                ? "rgba(201,166,107,.3)"
                : "linear-gradient(135deg,#c9a66b,#a07d4a)",
              border:"none", color:"#08080c",
              fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:600,
              cursor: status === "connecting" ? "default" : "pointer",
              marginTop:4, transition:"background .2s",
            }}
          >
            {status === "connecting" ? "Connecting…" : "Connect"}
          </button>
        </div>

        <div style={{
          fontFamily:"'DM Sans',sans-serif", fontSize:11,
          color:T.text45, marginTop:14, lineHeight:1.4,
          display:"flex", alignItems:"flex-start", gap:6,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0, marginTop:1, opacity:.5}}>
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <span>Your token is stored only in your browser's local storage and is sent directly to your Plex server. It never touches any third-party service.</span>
        </div>
      </div>
    </div>
  );
}

const iS = {
  background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.08)",
  borderRadius:8, padding:"10px 14px", color:T.text,
  fontFamily:"'DM Sans',sans-serif", fontSize:14,
  width:"100%", boxSizing:"border-box",
};

/* =========================================================================
   MAIN APP
   ========================================================================= */
export default function App() {
  // Connection state (persisted to localStorage)
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("overflow_url") || "");
  const [token, setToken] = useState(() => localStorage.getItem("overflow_token") || "");
  const [connected, setConnected] = useState(false);

  // Albums: start with mock, replaced on successful Plex connection
  const [albums, setAlbums] = useState([]);
  // Tracks keyed by album id/ratingKey — loaded lazily per album
  const [plexTracks, setPlexTracks] = useState({});

  const albumCount = albums.length;
  const { renderPos, settled, onWheel, onPointerDown, onPointerMove, onPointerUp, jumpTo } = useSpringCarousel(albumCount, Math.max(0, Math.min(7, albumCount - 1)));

  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showPlex, setShowPlex] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Audio element for real playback
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const album = albums[settled] || albums[0];
  const tracks = connected
    ? (plexTracks[album?.id] || [])
    : (TRACKS[album?.id] || []);
  const track = tracks[trackIdx] || null;

  // Auto-connect on load if credentials are saved (ref guard prevents StrictMode double-fire)
  const autoConnectAttempted = useRef(false);
  useEffect(() => {
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    if (serverUrl && token) {
      handleConnect(serverUrl, token).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tracks for the current album lazily (Plex mode)
  useEffect(() => {
    if (!connected || !album?.id || plexTracks[album.id]) return;
    plexFetchTracks(serverUrl, token, album.id)
      .then(raw => {
        const mapped = raw.map(t => ({
          title: t.title,
          duration: t.duration,
          partKey: t.Media?.[0]?.Part?.[0]?.key || null,
          ratingKey: t.ratingKey,
        }));
        setPlexTracks(prev => ({ ...prev, [album.id]: mapped }));
      })
      .catch(() => {});
  }, [settled, connected, album?.id]);

  // Keep onended up to date with current track list so last-track works correctly
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = () => {
      setTrackIdx(ti => {
        if (ti + 1 >= tracks.length) { setPlaying(false); return 0; }
        return ti + 1;
      });
    };
  }, [tracks.length]);

  // Clamp trackIdx when tracks change (e.g. album switch)
  useEffect(() => {
    if (tracks.length > 0 && trackIdx >= tracks.length) {
      setTrackIdx(0);
      setPlaying(false);
    }
  }, [tracks.length, trackIdx]);

  // Single effect manages audio src + play/pause together to avoid timing races
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !connected) { audio?.pause(); return; }

    const t = tracks[trackIdx];
    if (!t?.partKey) {
      if (!playing) audio.pause();
      return;
    }

    const src = plexProxyUrl(serverUrl, `${t.partKey}?X-Plex-Token=${token}`);
    if (audio.src !== new URL(src, location.href).href) {
      audio.src = src;
      setProgress(0);
    }

    if (playing) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [trackIdx, playing, connected, tracks]);

  // Simulated playback (mock mode only)
  useEffect(() => {
    if (connected || !playing) return;
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          setTrackIdx(ti => {
            if (ti + 1 >= tracks.length) { setPlaying(false); return 0; }
            return ti + 1;
          });
          return 0;
        }
        return p + .5;
      });
    }, 150);
    return () => clearInterval(iv);
  }, [playing, tracks.length, connected]);

  // Tauri: media key events
  useEffect(() => {
    if (!IS_TAURI) return;
    const unsubs = Promise.all([
      listen("media-play-pause", () => setPlaying(p => !p)),
      listen("media-next", () => {
        setTrackIdx(ti => {
          if (ti + 1 >= tracks.length) { setPlaying(false); return 0; }
          return ti + 1;
        });
      }),
      listen("media-prev", () => setTrackIdx(ti => Math.max(0, ti - 1))),
    ]);
    return () => { unsubs.then(fns => fns.forEach(f => f())); };
  }, [tracks.length]);

  // Tauri: update tray tooltip + menu when track changes
  useEffect(() => {
    if (!IS_TAURI || !track) return;
    const name = typeof track === "string" ? track : track.title;
    invoke("update_now_playing", {
      track: name || "",
      artist: album?.artist || "",
      album: album?.title || "",
    }).catch(() => {});
  }, [track, album]);

  // "/" key opens search
  useEffect(() => {
    const h = (e) => {
      if (e.key === "/" && !showSearch && !showPlex && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showSearch, showPlex]);

  // Reset on album change
  const prevSettled = useRef(settled);
  useEffect(() => {
    if (settled !== prevSettled.current) {
      prevSettled.current = settled;
      setTrackIdx(0);
      setProgress(0);
      setPlaying(false);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    }
  }, [settled]);


  async function handleConnect(url, tok) {
    if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
    const sectionKey = await plexFindMusicSection(url, tok);
    const raw = await plexFetchAlbums(url, tok, sectionKey);
    const mapped = raw.map(a => ({
      id: a.ratingKey,
      title: a.title,
      artist: a.parentTitle || "Unknown Artist",
      year: a.year || "",
      thumbUrl: a.thumb ? plexProxyUrl(url, `${a.thumb}?X-Plex-Token=${tok}`) : null,
    }));
    const sortKey = a => a.artist.replace(/^(the|a|an)\s+/i, "").toLowerCase();
    mapped.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    if (mapped.length === 0) throw new Error("No albums found in this Plex library. Check that it contains a Music section.");
    setAlbums(mapped);
    setPlexTracks({});
    setTrackIdx(0);
    setProgress(0);
    setPlaying(false);
    setServerUrl(url);
    setToken(tok);
    setConnected(true);
    localStorage.setItem("overflow_url", url);
    localStorage.setItem("overflow_token", tok);
    setShowPlex(false);
  }

  const { letterMap, letters } = useMemo(() => {
    const map = {};
    albums.forEach((a, i) => {
      const ch = a.artist.replace(/^(the|a|an)\s+/i, "").charAt(0).toUpperCase();
      const key = /[A-Z]/.test(ch) ? ch : "#";
      if (!(key in map)) map[key] = i;
    });
    const sorted = Object.keys(map).sort((a, b) =>
      a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)
    );
    return { letterMap: map, letters: sorted };
  }, [albums]);

  const bgH = album?.id != null ? (parseInt(album.id, 10) * 47) % 360 : 220;

  return (
    <>
      <div style={{
        minHeight:"100vh",
        background:`radial-gradient(ellipse at 50% 15%, hsl(${bgH},18%,9%) 0%, #08080c 65%)`,
        color:"#e8e4df",
        display:"flex", flexDirection:"column",
        transition:"background 1.2s ease",
        overflow:"hidden",
        fontFamily:"'DM Sans',sans-serif",
      }}>
        {/* Dedicated drag strip in Tauri — full width, no content, always grabbable */}
        {IS_TAURI && (
          <div data-tauri-drag-region style={{ height:36, width:"100%", flexShrink:0 }} />
        )}

        {/* Header row — logo left, controls right */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding: IS_TAURI ? "0 20px 6px" : "18px 20px 0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              width:28, height:28, borderRadius:"50%",
              background:"linear-gradient(135deg,#c9a66b,#a07d4a)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#08080c"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
              <span style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:600, letterSpacing:".04em", color:T.text }}>
                Overflow
              </span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:T.text45, letterSpacing:".04em" }}>
                v{__APP_VERSION__}
              </span>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {connected && (
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.gold, letterSpacing:".04em" }}>
                {albums.length} albums
              </span>
            )}
            <button onClick={() => setShowPlex(true)} style={{
              background: connected ? "rgba(201,166,107,.08)" : "rgba(255,255,255,.04)",
              border: connected ? `1px solid rgba(201,166,107,.25)` : "1px solid rgba(255,255,255,.1)",
              borderRadius:8, padding:"6px 14px",
              color: connected ? T.gold : T.text55,
              fontFamily:"'DM Sans',sans-serif",
              fontSize:12, cursor:"pointer", letterSpacing:".04em",
            }}>
              {connected ? "Connected" : "Connect Plex"}
            </button>
          </div>
        </div>

        {albums.length === 0 && !connected && (
          <div style={{ textAlign:"center", color:T.text55, fontFamily:"'DM Sans',sans-serif", fontSize:15, padding:"80px 0" }}>
            Connect Plex to browse your library
          </div>
        )}

        {albums.length > 0 && (
          <div style={{ textAlign:"center", padding:"14px 0 2px", fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.text45, letterSpacing:".1em", textTransform:"uppercase" }}>
            {settled + 1} / {albums.length}
          </div>
        )}

        <CoverFlow
          albums={albums} renderPos={renderPos} settled={settled}
          onWheel={onWheel} onPointerDown={onPointerDown}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          jumpTo={jumpTo}
        />

        <div style={{ padding:"6px 0 14px", flexShrink:0 }}>
          <PlayerControls
            isPlaying={playing}
            onPlayPause={() => setPlaying(p => !p)}
            onPrev={() => { if (trackIdx > 0) { setTrackIdx(i => i-1); setProgress(0); } }}
            onNext={() => { if (trackIdx < tracks.length-1) { setTrackIdx(i => i+1); setProgress(0); } }}
            currentTrack={track} album={album} progress={progress}
            onSeek={pct => {
              setProgress(pct);
              if (connected && audioRef.current?.duration) {
                audioRef.current.currentTime = (pct / 100) * audioRef.current.duration;
              }
            }}
          />
        </div>

        <div style={{ flex:1, overflow:"hidden", paddingBottom:20 }}>
          <TrackList
            tracks={tracks}
            currentTrackIndex={trackIdx}
            onSelectTrack={i => {
              setTrackIdx(i);
              setProgress(0);
              setPlaying(true);
            }}
          />
        </div>

        {connected && letters.length > 1 && (
          <AlphabetScrubber letters={letters} letterMap={letterMap} jumpTo={jumpTo} onSearchOpen={() => setShowSearch(true)} />
        )}

        {showSearch && albums.length > 0 && (
          <SearchPalette
            albums={albums}
            onSelect={idx => { jumpTo(idx); setShowSearch(false); }}
            onClose={() => setShowSearch(false)}
          />
        )}

        <PlexConfig
          show={showPlex}
          onClose={() => setShowPlex(false)}
          initialUrl={serverUrl}
          initialToken={token}
          onConnect={handleConnect}
        />
      </div>
    </>
  );
}
