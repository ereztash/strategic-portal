function saveToHistory() {
  if (!currentGeneratedStrategic) return;
  const history = JSON.parse(localStorage.getItem('zeroToAi_history'));
  history.unshift({ id: Date.now(), toolTitle: currentTool.title, date: new Date().toLocaleDateString('he-IL'), prompt: currentGeneratedStrategic });
  localStorage.setItem('zeroToAi_history', JSON.stringify(history));
  const btn = document.getElementById('save-btn');
  btn.innerHTML = `<i class="fa-solid fa-check text-brand-secondary"></i> נשמר!`;
  setTimeout(() => btn.innerHTML = `<i class="fa-regular fa-bookmark"></i> שמור`, 2000);
}

function resetOutput() {
  document.getElementById('generated-prompt').value = '';
  document.getElementById('generated-prompt').classList.add('opacity-0');
  document.getElementById('output-placeholder').style.display = 'flex';
  document.getElementById('compare-toggle-container').style.display = 'none';
  document.getElementById('output-actions').classList.add('opacity-0', 'pointer-events-none');
  currentGeneratedStrategic = '';
  currentGeneratedGeneric = '';
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('zeroToAi_history'));
  const grid = document.getElementById('history-grid');
  const empty = document.getElementById('empty-history');
  grid.innerHTML = '';
  if (history.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';
  history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'glass-panel p-5 rounded-2xl border border-dark-600 flex flex-col';
    el.innerHTML = `<div class="flex justify-between items-center mb-3"><span class="text-brand-primary font-bold text-sm"><i class="fa-solid fa-wrench ml-1"></i> ${item.toolTitle}</span><span class="text-xs text-gray-500">${item.date}</span></div><div class="bg-dark-900 rounded-lg p-3 text-xs text-gray-300 font-mono line-clamp-3 mb-4 flex-grow border border-dark-600/50">${item.prompt}</div><div class="flex gap-2 mt-auto"><button onclick="copyFromHistory('${item.id}', this)" class="flex-1 bg-dark-800 hover:bg-dark-700 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-dark-600"><i class="fa-solid fa-copy ml-1"></i> העתק</button><button onclick="deleteFromHistory(${item.id})" class="bg-dark-800 hover:bg-brand-accent/20 text-gray-400 hover:text-brand-accent px-3 py-2 rounded-lg transition-colors border border-dark-600"><i class="fa-solid fa-trash"></i></button></div>`;
    grid.appendChild(el);
  });
}

function copyFromHistory(id, btnElement) {
  const history = JSON.parse(localStorage.getItem('zeroToAi_history'));
  const item = history.find(i => i.id == id);
  if (!item) return;
  navigator.clipboard.writeText(item.prompt).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = item.prompt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  });
  btnElement.innerHTML = '<i class="fa-solid fa-check ml-1"></i> הועתק';
  setTimeout(() => btnElement.innerHTML = '<i class="fa-solid fa-copy ml-1"></i> העתק', 1500);
}

function deleteFromHistory(id) {
  let history = JSON.parse(localStorage.getItem('zeroToAi_history'));
  history = history.filter(i => i.id != id);
  localStorage.setItem('zeroToAi_history', JSON.stringify(history));
  renderHistory();
}
function clearHistory() { localStorage.setItem('zeroToAi_history', JSON.stringify([])); renderHistory(); }

let builderFieldCount = 0;
function addBuilderField() {
  builderFieldCount++;
  const container = document.getElementById('builder-fields');
  const fieldId = `field_${builderFieldCount}`;
  const div = document.createElement('div');
  div.className = 'flex gap-2 items-center bg-dark-800 p-2 rounded-lg border border-dark-600';
  div.id = `builder_row_${fieldId}`;
  div.innerHTML = `<input type="text" placeholder="שם השדה (למשל: נושא)" class="input-field flex-1 rounded px-2 py-1 text-xs" id="label_${fieldId}"><input type="text" value="${fieldId}" readonly class="bg-dark-900 text-gray-500 rounded px-2 py-1 text-xs w-20 outline-none"><button onclick="document.getElementById('builder_row_${fieldId}').remove()" class="text-brand-accent px-2"><i class="fa-solid fa-xmark"></i></button>`;
  container.appendChild(div);
}

function saveCustomEngine() {
  const title = document.getElementById('build-title').value.trim();
  const desc = document.getElementById('build-desc').value.trim();
  const symptom = document.getElementById('build-symptom').value.trim();
  const template = document.getElementById('build-template').value.trim();
  if (!title || !template) return alert('חובה למלא שם מנוע ותבנית.');
  const fields = [];
  const rows = document.getElementById('builder-fields').children;
  for (let i = 0; i < rows.length; i++) {
    const rowId = rows[i].id.replace('builder_row_', '');
    const label = document.getElementById(`label_${rowId}`).value || `שדה ${i + 1}`;
    fields.push({ id: rowId, label, type: 'text', placeholder: '...' });
  }
  const customArr = JSON.parse(localStorage.getItem('zeroToAi_custom'));
  customArr.push({ id: `custom_${Date.now()}`, title, shortDesc: desc, symptom, symptomIcon: 'fa-bolt', fields, template });
  localStorage.setItem('zeroToAi_custom', JSON.stringify(customArr));
  alert('מנוע אישי נוצר ושוריין במערכת!');
  window.location.reload();
}

function trackStat(action, toolId) {
  const stats = JSON.parse(localStorage.getItem('zeroToAi_stats'));
  if (!stats.tools[toolId]) stats.tools[toolId] = { generates: 0, copies: 0 };
  if (action === 'generate') { stats.totalGen++; stats.tools[toolId].generates++; }
  if (action === 'copy') { stats.totalCopied++; stats.tools[toolId].copies++; }
  localStorage.setItem('zeroToAi_stats', JSON.stringify(stats));
}

function renderStats() {
  const stats = JSON.parse(localStorage.getItem('zeroToAi_stats'));
  document.getElementById('stat-total-gen').innerText = stats.totalGen;
  document.getElementById('stat-total-cop').innerText = stats.totalCopied;
  document.getElementById('stat-total-tools').innerText = Object.keys(stats.tools).length;
  const board = document.getElementById('stats-leaderboard');
  board.innerHTML = '';
  const toolMap = {};
  appDatabase.forEach(cat => cat.prompts.forEach(p => toolMap[p.id] = p.title));
  const toolsArr = Object.entries(stats.tools).sort((a, b) => b[1].generates - a[1].generates);
  if (toolsArr.length === 0) board.innerHTML = '<div class="text-gray-500 text-sm">אין עדיין נתונים להצגה.</div>';
  toolsArr.forEach(([id, data]) => {
    const title = toolMap[id] || id;
    const successRate = data.generates > 0 ? Math.round((data.copies / data.generates) * 100) : 0;
    board.innerHTML += `<div class="flex flex-col md:flex-row items-start md:items-center justify-between bg-dark-800 p-4 rounded-xl border border-dark-600"><div class="font-bold text-white mb-2 md:mb-0">${title}</div><div class="flex items-center gap-6 text-sm"><div class="text-gray-400">חולל: <span class="text-brand-primary font-bold">${data.generates}</span></div><div class="text-gray-400">הועתק: <span class="text-brand-success font-bold">${data.copies}</span></div><div class="bg-dark-900 px-2 py-1 rounded text-xs border border-dark-600">יחס הצלחה: <span class="${successRate > 50 ? 'text-brand-success' : 'text-brand-warning'} font-bold">${successRate}%</span></div></div></div>`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadCustomTools();
  renderHomeView();
  setTimeout(() => {
    const loader = document.getElementById('app-loader');
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 500);
  }, 800);
  navigate('home');
});
