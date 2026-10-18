const labelVariants = [
  ['quien te reclut', 'me reclut', 'reclutado por', 'reclut'],
  ['nombre o apodo', 'nombre', 'apodo'],
  ['edad'],
  ['usuario de roblox', 'usuario roblox', 'roblox'],
  ['país', 'pais', 'nacionalidad'],
  ['pronombre'],
];

const ACK = ['ok', 'okey', 'oki', 'si', 'sí', 'dale', 'confirmo', 'sip', 'yes', 'listo', 'va'];

const matchLabel = (line) => {
  const low = String(line || '').toLowerCase();
  let best = null;
  for (let g = 0; g < labelVariants.length; g++) {
    for (const x of labelVariants[g]) {
      const idx = low.indexOf(x);
      if (idx === -1 || idx > 8) continue;
      if (!best || idx < best.idx || (idx === best.idx && x.length > best.v.length)) {
        best = { g, v: x, idx };
      }
    }
  }
  return best ? { g: best.g, v: best.v } : null;
};

const extractValue = (line, label) => {
  const low = line.toLowerCase();
  const li = low.indexOf(label.toLowerCase());
  let after = line.slice(li + label.length);
  const sep = after.search(/[:：?？]/);
  if (sep !== -1) after = after.slice(sep + 1);
  after = after.replace(/\([^)]*\)|（[^）]*）/g, ' ');
  return after.replace(/^[\s:：\-–—?.¿!¡*]+/, '').trim();
};

const parseFormData = (rawLines, formData) => {
  let hasLabels = false;

  for (const line of rawLines) {
    const m = matchLabel(line);
    if (!m) continue;
    hasLabels = true;
    const val = extractValue(line, m.v);
    if (val) formData[m.g] = val;
  }

  for (let i = 0; i < rawLines.length - 1; i++) {
    const m = matchLabel(rawLines[i]);
    if (!m || formData[m.g]) continue;
    const nxt = rawLines[i + 1];
    if (matchLabel(nxt)) continue;
    const val = nxt.replace(/^[\s•\-–—*]+/, '').trim();
    if (val && val.length <= 120) formData[m.g] = val;
  }

  const onlyAck = rawLines.length === 1 && ACK.includes(rawLines[0].toLowerCase());
  if (!hasLabels && !onlyAck) {
    for (const line of rawLines) {
      let slot = 0;
      while (formData[slot] && slot < 6) slot += 1;
      if (slot >= 6) break;
      formData[slot] = line;
    }
  }

  return { hasLabels };
};

module.exports = { parseFormData, matchLabel, ACK };
