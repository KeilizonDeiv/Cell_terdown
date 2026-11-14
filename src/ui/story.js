// Renders the scroll story (hero → specs → parts → power) for one cell type from its data.
import { derive } from '../data/cells.js';

const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

export function renderStory(root, cell) {
  const k = derive(cell);
  const n = cell.parts.length;
  const pad = (i) => String(i).padStart(2, '0');
  const chip = (p) => `<span class="chip${p.chipKind ? ' ' + p.chipKind : ''}">${p.chip}</span>`;

  root.innerHTML = `
  <section class="step hero" data-step="hero" id="top">
    <div class="card">
      <p class="eyebrow">${cell.hero.eyebrow}</p>
      <h1>${cell.hero.pre}<span>${cell.hero.post}</span></h1>
      <p class="tag">${cell.hero.tag}</p>
      <p class="lede">This cell stores about ${fmt(k.wh)} watt-hours. Scroll down and it comes apart, one layer at a time, so you can see what every piece is made of and what it does. Drag the model to turn it.</p>
      <p class="cue">Scroll to take it apart</p>
      <p class="fallback">3D view needs WebGL, which this browser has turned off. All the text below still works.</p>
    </div>
  </section>

  <section class="step specs-step" data-step="specs" id="specs">
    <div class="card">
      <p class="eyebrow">Why it is called powerful</p>
      <h2>${cell.specsTitle}</h2>
      <dl class="specs">
        <div><dt>Size</dt><dd class="sm">${cell.size}</dd></div>
        <div><dt>Capacity</dt><dd>~${fmt(cell.capacityAh)}<small>Ah</small></dd></div>
        <div><dt>Nominal voltage</dt><dd>~${fmt(cell.voltage, 1)}<small>V</small></dd></div>
        <div><dt>Energy</dt><dd>~${fmt(k.wh)}<small>Wh</small></dd></div>
        <div><dt>Mass</dt><dd>~${cell.massKg < 1 ? fmt(cell.massKg * 1000) + '<small>g</small>' : fmt(cell.massKg, 1) + '<small>kg</small>'}</dd></div>
        <div><dt>${cell.compare.label}</dt><dd>${cell.compare.value}<small>${cell.compare.unit}</small></dd></div>
      </dl>
      <p>${cell.specsText}</p>
      <p class="note">Representative figures for this class of cell, rounded. They vary by version and maker.</p>
    </div>
  </section>

  ${cell.parts.map((p, i) => `
  <section class="step part" data-step="${p.id}" id="part-${p.id}">
    <div class="card">
      <div class="head"><span class="no">${pad(i + 1)} / ${pad(n)}</span><span>${p.label}</span></div>
      <h2>${p.name}</h2>
      ${chip(p)}
      <dl class="facts">
        <div><dt>What it is</dt><dd>${p.what}</dd></div>
        <div><dt>Made of</dt><dd>${p.made}</dd></div>
        <div><dt>What it does</dt><dd>${p.does}</dd></div>
      </dl>
    </div>
  </section>`).join('')}

  <section class="step power" data-step="power" id="power">
    <div class="card">
      <p class="eyebrow">What it makes</p>
      <h2>Electricity, from moving lithium</h2>
      <ol class="flow">
        <li><p>While discharging, lithium ions leave the <b>anode</b>, cross the <b>separator</b> through the <b>electrolyte</b>, and settle into the <b>cathode</b>.</p></li>
        <li><p>Each ion leaves an electron behind. The electrolyte won't carry electrons, so they leave through the negative terminal (−).</p></li>
        <li><p>The electrons flow through the motor, doing work, and return at the positive terminal (+). That flow is the current.</p></li>
        <li><p>One of these cells holds about ${fmt(k.wh)} Wh. A 75 kWh car pack would need about ${fmt(Math.ceil(75000 / k.wh))} of them. The numbers below show how the three types compare.</p></li>
      </ol>
    </div>
  </section>`;
}
