function renderCategoryView() {
  document.getElementById('cat-header-icon').className = `w-16 h-16 rounded-2xl ${currentCategory.color} flex items-center justify-center text-3xl`;
  document.getElementById('cat-header-icon').innerHTML = `<i class="fa-solid ${currentCategory.icon} text-white"></i>`;
  document.getElementById('cat-header-title').textContent = currentCategory.title;
  document.getElementById('cat-header-desc').textContent = currentCategory.desc;
  const grid = document.getElementById('symptoms-grid');
  grid.innerHTML = '';
  currentCategory.prompts.forEach((prompt, i) => {
    const div = document.createElement('div');
    div.className = 'glass-panel interactive-card rounded-2xl p-5 flex flex-col group opacity-0';
    div.style.animation = `fadeIn 0.4s ease-out ${i * 0.1}s forwards`;
    div.onclick = () => navigate('generator', prompt.id);
    div.innerHTML = `<div class="flex items-center gap-3 mb-4"><div class="w-10 h-10 rounded-xl bg-dark-900 border border-dark-600 flex items-center justify-center text-gray-300"><i class="fa-solid ${prompt.symptomIcon}"></i></div><h4 class="font-bold text-white">${prompt.title}</h4></div><div class="bg-dark-900/50 p-3 rounded-xl border border-dark-600/50 mb-3 flex-grow text-sm text-gray-300 italic">"${prompt.symptom}"</div><p class="text-xs text-brand-primary mt-auto">${prompt.shortDesc}</p>`;
    grid.appendChild(div);
  });
}

function renderGeneratorView() {
  document.getElementById('tool-icon').className = `fa-solid ${currentTool.symptomIcon}`;
  document.getElementById('tool-title').textContent = currentTool.title;
  document.getElementById('tool-desc').textContent = currentTool.shortDesc;
  document.getElementById('tool-strategy').textContent = currentTool.strategy || 'מנוע מותאם אישית.';
  const form = document.getElementById('dynamic-form');
  form.innerHTML = '';
  currentTool.fields.forEach(f => {
    const w = document.createElement('div');
    w.innerHTML = `<label class="block text-sm text-gray-300 mb-1">${f.label}</label>`;
    const input = document.createElement(f.type === 'textarea' ? 'textarea' : 'input');
    input.id = f.id;
    input.className = `input-field w-full rounded-xl p-3 text-white text-sm ${f.type === 'textarea' ? 'h-20' : ''}`;
    input.placeholder = f.placeholder || '';
    w.appendChild(input);
    form.appendChild(w);
  });
  resetOutput();
}

function generatePrompt() {
  if (!currentTool) return;
  const data = {};
  currentTool.fields.forEach(f => { data[f.id] = document.getElementById(f.id).value.trim() || `[${f.label}]`; });
  currentGeneratedStrategic = currentTool.generate(data);
  currentGeneratedGeneric = currentTool.generic(data);
  trackStat('generate', currentTool.id);
  document.getElementById('output-placeholder').style.display = 'none';
  document.getElementById('compare-toggle-container').style.display = 'flex';
  document.getElementById('output-actions').classList.remove('opacity-0', 'pointer-events-none');
  setCompareMode('strategic');
}

function setCompareMode(mode) {
  compareMode = mode;
  const textarea = document.getElementById('generated-prompt');
  document.getElementById('tab-strategic').className = mode === 'strategic' ? 'px-3 py-1.5 text-xs font-bold rounded-md bg-brand-primary text-white transition-all' : 'px-3 py-1.5 text-xs font-bold rounded-md text-gray-400 hover:text-white transition-all';
  document.getElementById('tab-generic').className = mode === 'generic' ? 'px-3 py-1.5 text-xs font-bold rounded-md bg-brand-accent text-white transition-all' : 'px-3 py-1.5 text-xs font-bold rounded-md text-gray-400 hover:text-white transition-all';
  textarea.classList.remove('opacity-0', 'compare-strategic', 'compare-generic');
  void textarea.offsetWidth;
  textarea.value = mode === 'strategic' ? currentGeneratedStrategic : currentGeneratedGeneric;
  textarea.classList.add('opacity-100', `compare-${mode}`);
}

function copyPrompt() {
  const textarea = document.getElementById('generated-prompt');
  textarea.select();
  document.execCommand('copy');
  const btn = document.getElementById('copy-btn');
  btn.innerHTML = `<i class="fa-solid fa-check text-brand-success"></i> הועתק!`;
  trackStat('copy', currentTool.id);
  setTimeout(() => btn.innerHTML = `<i class="fa-regular fa-copy"></i> העתק`, 2000);
}
