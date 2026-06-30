// js/hp-graph.js — loads + queries the Provia HP concept graph (ES module).
// Static JSON, fetched once. Drives adaptive selection + root-causing.

let _nodes = null;
let _edges = null;
let _byId = null;

export async function loadGraph() {
  if (_nodes) return { nodes: _nodes, edges: _edges };
  const [nRes, eRes] = await Promise.all([
    fetch('/public/hp/graph_nodes.json').then(r => r.ok ? r.json() : fetch('/hp/graph_nodes.json').then(x => x.json())),
    fetch('/public/hp/graph_edges.json').then(r => r.ok ? r.json() : fetch('/hp/graph_edges.json').then(x => x.json())),
  ]);
  _nodes = nRes.nodes || [];
  _edges = eRes.edges || [];
  _byId = new Map(_nodes.map(n => [n.id, n]));
  return { nodes: _nodes, edges: _edges };
}

export function getNode(id) { return _byId ? _byId.get(id) : null; }

export function conceptNodes(delprov) {
  return (_nodes || []).filter(n => n.delprov === delprov && n.level >= 2);
}

export function prereqsOf(nodeId) {
  return (_edges || []).filter(e => e.to === nodeId && e.type === 'prereq').map(e => e.from);
}

// Adaptive pick: weakest eligible node whose prereqs are not themselves weak.
// masteryMap: { node_id: 0..100 }. Returns node id, or a default starter.
export function pickNextNode(delprov, masteryMap = {}) {
  const candidates = conceptNodes(delprov);
  if (!candidates.length) return null;

  const score = (n) => {
    const m = masteryMap[n.id] ?? 0;
    const pre = prereqsOf(n.id);
    const preWeak = pre.some(p => (masteryMap[p] ?? 0) < 60);
    // Prefer mid-low mastery (zone of proximal development), de-prioritize nodes with weak prereqs.
    let s = 100 - m;                 // weaker = higher priority
    if (m === 0) s -= 5;             // unseen: slightly lower than a known-weak node
    if (preWeak) s -= 40;            // foundation missing → drill the prereq first, not this
    return s;
  };

  // If a weak prereq exists, surface it instead.
  const weakestCandidate = candidates.slice().sort((a, b) => score(b) - score(a))[0];
  const weakPre = prereqsOf(weakestCandidate.id).find(p => (masteryMap[p] ?? 0) < 60);
  return weakPre || weakestCandidate.id;
}

// Difficulty target tracks mastery: ~70% success = optimal challenge.
export function difficultyFor(nodeId, masteryMap = {}) {
  const n = getNode(nodeId);
  const m = (masteryMap[nodeId] ?? 0) / 100;
  const band = n?.difficulty_band || [0.3, 0.8];
  // Aim just above current mastery, clamped to the node's realistic band.
  const target = Math.max(band[0], Math.min(band[1], m + 0.1));
  return Number(target.toFixed(2));
}
