function navigate(viewId, params = null) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  currentView = viewId;
  const bc = document.getElementById('breadcrumbs');
  bc.innerHTML = `<span class="hover:text-white cursor-pointer" onclick="navigate('home')"><i class="fa-solid fa-house ml-1"></i> ראשי</span>`;
  if (viewId === 'category' && params) {
    currentCategory = appDatabase.find(c => c.id === params);
    renderCategoryView();
    bc.innerHTML += `<span class="mx-2 text-dark-600">/</span><span class="${currentCategory.textColor} font-bold">${currentCategory.title}</span>`;
  } else if (viewId === 'generator' && params) {
    appDatabase.forEach(cat => { const t = cat.prompts.find(p => p.id === params); if (t) { currentCategory = cat; currentTool = t; } });
    renderGeneratorView();
    bc.innerHTML += `<span class="mx-2 text-dark-600">/</span><span class="hover:text-white cursor-pointer" onclick="navigate('category', '${currentCategory.id}')">${currentCategory.title}</span><span class="mx-2 text-dark-600">/</span><span class="text-white">${currentTool.title}</span>`;
  } else if (viewId === 'history') {
    bc.innerHTML += `<span class="mx-2 text-dark-600">/</span><span class="text-brand-primary">הכספת שלי (היסטוריה)</span>`;
    renderHistory();
  } else if (viewId === 'builder') {
    bc.innerHTML += `<span class="mx-2 text-dark-600">/</span><span class="text-brand-secondary">בונה המנועים</span>`;
  } else if (viewId === 'stats') {
    bc.innerHTML += `<span class="mx-2 text-dark-600">/</span><span class="text-brand-success">סטטיסטיקות</span>`;
    renderStats();
  }
}

function renderHomeView() {
  const grid = document.getElementById('categories-grid');
  grid.innerHTML = '';
  appDatabase.forEach((cat, idx) => {
    const div = document.createElement('div');
    div.className = `glass-panel interactive-card rounded-3xl p-6 flex flex-col h-full border-t-2 border-t-transparent hover:border-t-${cat.color.split('-')[1]}-500`;
    div.style.animation = `fadeIn 0.5s ease-out ${idx * 0.1}s forwards`;
    div.onclick = () => navigate('category', cat.id);
    div.innerHTML = `<div class="w-14 h-14 rounded-2xl ${cat.color} bg-opacity-20 flex items-center justify-center text-3xl mb-5 border border-${cat.color.split('-')[1]}-500/30"><i class="fa-solid ${cat.icon} ${cat.textColor}"></i></div><h3 class="text-xl font-bold text-white mb-2">${cat.title}</h3><p class="text-gray-400 text-sm flex-grow">${cat.desc}</p><div class="mt-4 text-sm font-semibold ${cat.textColor}">${cat.prompts.length} מנועים</div>`;
    grid.appendChild(div);
  });
}
