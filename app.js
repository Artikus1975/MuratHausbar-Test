'use strict';

const APP_VERSION = 'v0.33';

function fatalDataError(message){
  const safe = escapeHtml(message);
  document.body.innerHTML = `<main><section class="view active"><div class="card"><p class="eyebrow">Datenfehler</p><h2>Hausbar konnte nicht gestartet werden</h2><p>${safe}</p></div></section></main>`;
  throw new Error(message);
}

function validateGeneratedData(){
  if(typeof HB_GENERATED_DATA === 'undefined') fatalDataError('HB_GENERATED_DATA fehlt. Legacy-Daten werden nicht geladen.');
  const data = HB_GENERATED_DATA;
  if(!data || !Array.isArray(data.inventory) || !Array.isArray(data.recipes)) fatalDataError('Generierte Datenbasis hat nicht die erwartete Struktur.');
  if(data.inventory.length !== 142 || data.recipes.length !== 70) fatalDataError('Generierte Datenbasis hat unerwartete Inventar- oder Rezeptanzahl.');

  const inventoryIds = data.inventory.map(item => item.id);
  const recipeIds = data.recipes.map(recipe => recipe.id);
  if(new Set(inventoryIds).size !== 142 || new Set(recipeIds).size !== 70) fatalDataError('Doppelte Inventar- oder Rezept-ID erkannt.');

  const ingredients = data.recipes.flatMap(recipe => Array.isArray(recipe.ingredients) ? recipe.ingredients : []);
  const requiredCount = ingredients.filter(item => item.required && item.required.value === true).length;
  const optionalCount = ingredients.filter(item => item.required && item.required.value === false).length;
  const exactCount = ingredients.filter(item => item.mapping && item.mapping.type === 'EXAKT').length;
  const externalCount = ingredients.filter(item => item.mapping && item.mapping.type === 'NICHT_INVENTAR_ZULAESSIG').length;
  const inventoryIdSet = new Set(inventoryIds);
  const unresolved = ingredients.filter(item => item.mapping && item.mapping.type === 'EXAKT' && !inventoryIdSet.has(item.mapping.inventoryId));
  if(ingredients.length !== 229 || requiredCount !== 225 || optionalCount !== 4) fatalDataError('Zutaten- oder Pflicht/Optional-Zähler stimmen nicht mit Block A überein.');
  if(exactCount !== 165 || externalCount !== 64 || unresolved.length !== 0) fatalDataError('Inventarmapping stimmt nicht mit Block A überein.');
  if(data.recipes.some(recipe => recipe.releaseGate?.approved !== true || recipe.releaseGate?.code !== 'JA')) fatalDataError('Freigabe_App-Release-Gate ist nicht vollständig JA.');

  const banned = new Set(['Rye Whiskey Sour','French 77','Hot Buttered Rum','Port Tonic']);
  if(data.recipes.some(recipe => banned.has(recipe.name))) fatalDataError('Ausgeschlossenes Legacy-Rezept in generierter Datenbasis erkannt.');
  if(!data.taxonomies?.recipeFilters || !Array.isArray(data.toolCatalog)) fatalDataError('Taxonomie oder Werkzeugkatalog fehlt.');
  return data;
}

const DATA = validateGeneratedData();
const inventory = DATA.inventory.map(normalizeItem);
const recipes = DATA.recipes;
const taxonomy = DATA.taxonomies.recipeFilters;
const inventoryIdSet = new Set(inventory.map(item => item.id));
const toolNameById = new Map(DATA.toolCatalog.map(tool => [tool.id, tool.name]));

const state = {
  view: 'home',
  search: '',
  filters: { category: '', flavor: '', usage: '', origin: '' },
  recipeSearch: '',
  recipeFilters: { drinkStyle: '', base: '', flavor: '', strength: '', occasion: '' }
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  renderAppVersion();
  renderAll();
});

function renderAppVersion(){
  document.title = `Hausbar Next ${APP_VERSION}`;
  document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = APP_VERSION; });
}

function cacheElements(){
  els.views = document.querySelectorAll('.view');
  els.navButtons = document.querySelectorAll('.bottom-nav button');
  els.homeStats = document.getElementById('homeStats');
  els.dailyDrinkCard = document.getElementById('dailyDrinkCard');
  els.dailyDrinkName = document.getElementById('dailyDrinkName');
  els.dailyDrinkStyle = document.getElementById('dailyDrinkStyle');
  els.dailyDrinkCheck = document.getElementById('dailyDrinkCheck');
  els.rerollTodayMenu = document.getElementById('rerollTodayMenu');
  els.todayMenuGrid = document.getElementById('todayMenuGrid');
  els.searchInput = document.getElementById('searchInput');
  els.categoryFilter = document.getElementById('categoryFilter');
  els.flavorFilter = document.getElementById('flavorFilter');
  els.usageFilter = document.getElementById('usageFilter');
  els.originFilter = document.getElementById('originFilter');
  els.resetFilters = document.getElementById('resetFilters');
  els.inventoryCount = document.getElementById('inventoryCount');
  els.inventoryGrid = document.getElementById('inventoryGrid');
  els.recipeSearch = document.getElementById('recipeSearch');
  els.recipeDrinkStyleFilter = document.getElementById('recipeDrinkStyleFilter');
  els.recipeBaseFilter = document.getElementById('recipeBaseFilter');
  els.recipeFlavorFilter = document.getElementById('recipeFlavorFilter');
  els.recipeStrengthFilter = document.getElementById('recipeStrengthFilter');
  els.recipeOccasionFilter = document.getElementById('recipeOccasionFilter');
  els.resetRecipeFilters = document.getElementById('resetRecipeFilters');
  els.recipeCount = document.getElementById('recipeCount');
  els.recipeGrid = document.getElementById('recipeGrid');
  els.dialog = document.getElementById('itemDialog');
  els.closeDialog = document.getElementById('closeDialog');
  els.detailName = document.getElementById('detailName');
  els.detailCategory = document.getElementById('detailCategory');
  els.detailBody = document.getElementById('detailBody');
  els.recipeDialog = document.getElementById('recipeDialog');
  els.closeRecipeDialog = document.getElementById('closeRecipeDialog');
  els.recipeDetailName = document.getElementById('recipeDetailName');
  els.recipeDetailCategory = document.getElementById('recipeDetailCategory');
  els.recipeDetailBody = document.getElementById('recipeDetailBody');
}

function bindEvents(){
  els.navButtons.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  if(els.rerollTodayMenu) els.rerollTodayMenu.addEventListener('click', () => { saveTodayMenu(generateTodayMenu({ reroll: true })); renderHome(); });
  els.searchInput.addEventListener('input', event => { state.search = event.target.value.trim().toLowerCase(); renderInventory(); });
  els.categoryFilter.addEventListener('change', event => setFilter('category', event.target.value));
  els.flavorFilter.addEventListener('change', event => setFilter('flavor', event.target.value));
  els.usageFilter.addEventListener('change', event => setFilter('usage', event.target.value));
  els.originFilter.addEventListener('change', event => setFilter('origin', event.target.value));
  els.resetFilters.addEventListener('click', resetFilters);
  els.recipeSearch.addEventListener('input', event => { state.recipeSearch = event.target.value.trim().toLowerCase(); renderRecipes(); });
  els.recipeDrinkStyleFilter.addEventListener('change', event => setRecipeFilter('drinkStyle', event.target.value));
  els.recipeBaseFilter.addEventListener('change', event => setRecipeFilter('base', event.target.value));
  els.recipeFlavorFilter.addEventListener('change', event => setRecipeFilter('flavor', event.target.value));
  els.recipeStrengthFilter.addEventListener('change', event => setRecipeFilter('strength', event.target.value));
  els.recipeOccasionFilter.addEventListener('change', event => setRecipeFilter('occasion', event.target.value));
  els.resetRecipeFilters.addEventListener('click', resetRecipeFilters);
  els.closeDialog.addEventListener('click', () => els.dialog.close());
  els.closeRecipeDialog.addEventListener('click', () => els.recipeDialog.close());

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open-recipe-id]');
    if(!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    openRecipe(trigger.dataset.openRecipeId);
  });
}

function renderAll(){
  renderHome();
  renderInventory();
  renderRecipes();
  setView(state.view);
}

function setView(view){
  state.view = view;
  els.views.forEach(element => element.classList.toggle('active', element.id === `view-${view}`));
  els.navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === view));
}

function normalizeItem(item){
  const flavorTags = arrayOf(item.flavorTags);
  const usageTags = arrayOf(item.usageTags);
  const origin = String(item.originVisible || '').trim();
  return {
    ...item,
    flavorTags,
    usageTags,
    origin,
    searchText: [
      item.name, item.producer, item.category, item.subcategory, item.amount, origin,
      item.descriptionVisible, ...flavorTags, ...usageTags
    ].filter(Boolean).join(' ').toLowerCase()
  };
}

function arrayOf(value){
  return Array.isArray(value) ? [...new Set(value.map(entry => String(entry).trim()).filter(Boolean))] : [];
}

function sameValue(a, b){
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function listContains(list, selected){
  if(!selected) return true;
  return arrayOf(list).some(value => sameValue(value, selected));
}

function setFilter(name, value){
  state.filters[name] = value;
  renderInventory();
}

function resetFilters(){
  state.search = '';
  state.filters = { category: '', flavor: '', usage: '', origin: '' };
  els.searchInput.value = '';
  renderInventory();
}

function itemMatches(item, filters, search){
  if(search && !item.searchText.includes(search)) return false;
  if(filters.category && !sameValue(item.category, filters.category)) return false;
  if(filters.flavor && !listContains(item.flavorTags, filters.flavor)) return false;
  if(filters.usage && !listContains(item.usageTags, filters.usage)) return false;
  if(filters.origin && !sameValue(item.origin, filters.origin)) return false;
  return true;
}

function filteredInventory(ignoreFilterName = null){
  const filters = { ...state.filters };
  if(ignoreFilterName) filters[ignoreFilterName] = '';
  return inventory.filter(item => itemMatches(item, filters, state.search));
}

function inventoryOptionsFor(filterName){
  const source = filteredInventory(filterName);
  if(filterName === 'category') return uniqueSorted(source.map(item => item.category).filter(Boolean));
  if(filterName === 'flavor') return uniqueSorted(source.flatMap(item => item.flavorTags));
  if(filterName === 'usage') return uniqueSorted(source.flatMap(item => item.usageTags));
  if(filterName === 'origin') return uniqueSorted(source.map(item => item.origin).filter(Boolean));
  return [];
}

function renderInventory(){
  populateAllFilters();
  const items = filteredInventory();
  els.inventoryCount.textContent = `${items.length} von ${inventory.length} Flaschen`;
  els.inventoryGrid.innerHTML = items.map(renderItemCard).join('') || '<p class="empty">Keine Flaschen gefunden.</p>';
  els.inventoryGrid.querySelectorAll('[data-item-id]').forEach(button => button.addEventListener('click', () => openItem(button.dataset.itemId)));
}

function populateAllFilters(){
  populateSelect(els.categoryFilter, 'Alle Kategorien', inventoryOptionsFor('category'), state.filters.category, value => { state.filters.category = value; });
  populateSelect(els.flavorFilter, 'Alle Geschmäcker', inventoryOptionsFor('flavor'), state.filters.flavor, value => { state.filters.flavor = value; });
  populateSelect(els.usageFilter, 'Alle Nutzungen', inventoryOptionsFor('usage'), state.filters.usage, value => { state.filters.usage = value; });
  populateSelect(els.originFilter, 'Alle Herkünfte', inventoryOptionsFor('origin'), state.filters.origin, value => { state.filters.origin = value; });
}

function uniqueSorted(values){
  const map = new Map();
  arrayOf(values).forEach(value => {
    const key = String(value).trim().toLowerCase();
    if(key && !map.has(key)) map.set(key, value);
  });
  return Array.from(map.values()).sort((a,b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

function populateSelect(select, label, options, value, onInvalid){
  const safeOptions = arrayOf(options);
  const exists = !value || safeOptions.some(option => sameValue(option, value));
  const finalValue = exists ? value : '';
  select.innerHTML = [`<option value="">${escapeHtml(label)}</option>`, ...safeOptions.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)].join('');
  select.value = finalValue;
  if(!exists && onInvalid) onInvalid('');
}

function renderItemCard(item){
  const tags = [...item.flavorTags.slice(0,3), ...item.usageTags.slice(0,2)].slice(0,5);
  return `<button class="item-card" data-item-id="${escapeHtml(item.id)}">
    <h3>${escapeHtml(item.name)}</h3>
    <p class="meta">${escapeHtml([item.category, item.subcategory].filter(Boolean).join(' · '))}</p>
    <div class="tag-row">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
  </button>`;
}

function openItem(id){
  const item = inventory.find(entry => entry.id === id);
  if(!item) return;
  els.detailName.textContent = item.name;
  els.detailCategory.textContent = item.category || '';
  const description = String(item.descriptionVisible || '').trim();
  const leadingTags = [...item.flavorTags.slice(0,4), ...item.usageTags.slice(0,2)].slice(0,6);
  els.detailBody.innerHTML = `
    <div class="bottle-hero-detail premium-bottle-hero clean-public-hero bottle-public-card">
      <div class="bottle-hero-copy">
        <p class="eyebrow">Flaschenprofil</p>
        <h3>${escapeHtml(item.name)}</h3>
        ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        ${leadingTags.length ? `<div class="signature-strip">${leadingTags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      </div>
      ${item.origin ? `<div class="quiet-meta"><span>Herkunft</span><strong>${escapeHtml(item.origin)}</strong></div>` : ''}
    </div>`;
  els.dialog.showModal();
}

function renderHome(){
  const categories = new Set(inventory.map(item => item.category).filter(Boolean));
  els.homeStats.innerHTML = [
    ['Flaschen', inventory.length], ['Rezepte', recipes.length], ['Kategorien', categories.size]
  ].map(([label,value]) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const daily = getDailyDrink();
  if(daily){
    els.dailyDrinkName.textContent = daily.name;
    els.dailyDrinkStyle.textContent = [daily.filters.display.drinkStyle, daily.filters.display.occasion].filter(Boolean).join(' · ');
    const dailyCheck = externalCheckText(daily);
    els.dailyDrinkCheck.textContent = dailyCheck;
    els.dailyDrinkCheck.hidden = !dailyCheck;
    els.dailyDrinkCard.dataset.openRecipeId = daily.id;
  } else {
    els.dailyDrinkCheck.textContent = '';
    els.dailyDrinkCheck.hidden = true;
  }
  const menu = getTodayMenu();
  els.todayMenuGrid.innerHTML = menu.map(renderHomeMenuItem).join('') || '<p class="empty">Noch keine Empfehlungen vorhanden.</p>';
}

function berlinDateKey(){
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function hashString(value){
  let hash = 2166136261;
  for(const ch of String(value)){
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededIndex(length, seed){
  if(!length) return 0;
  return hashString(seed) % length;
}

function sortedRecipes(){
  return [...recipes].sort((a,b) => String(a.name).localeCompare(String(b.name), 'de', { sensitivity: 'base' }));
}

function availabilityAssessment(recipe){
  const missingRequiredTracked = [];
  const requiredExternalCheck = [];
  const optionalExternal = [];
  for(const ingredient of recipe.ingredients || []){
    const required = ingredient.required?.value === true;
    const type = ingredient.mapping?.type;
    if(type === 'EXAKT'){
      if(required && !inventoryIdSet.has(ingredient.mapping.inventoryId)) missingRequiredTracked.push(ingredient);
    } else if(type === 'NICHT_INVENTAR_ZULAESSIG'){
      if(required) requiredExternalCheck.push(ingredient);
      else optionalExternal.push(ingredient);
    }
  }
  const status = missingRequiredTracked.length > 0
    ? 'BLOCKED'
    : requiredExternalCheck.length > 0
      ? 'CHECK_EXTERNAL'
      : 'READY';
  return {
    status,
    blockedTracked: status === 'BLOCKED',
    missingRequiredTracked,
    requiredExternalCheck,
    optionalExternal
  };
}

function externalCheckText(recipe){
  const assessment = availabilityAssessment(recipe);
  if(assessment.status !== 'CHECK_EXTERNAL') return '';
  const names = [...new Set(assessment.requiredExternalCheck.map(ingredient => String(ingredient.name || '').trim()).filter(Boolean))];
  return names.length ? `Vorher prüfen: ${joinHuman(names)}` : 'Vorher prüfen';
}

function selectableRecipes(){
  return sortedRecipes().filter(recipe => availabilityAssessment(recipe).status !== 'BLOCKED');
}

function getDailyDrink(){
  const list = selectableRecipes();
  if(!list.length) return null;
  return list[seededIndex(list.length, `daily-${berlinDateKey()}`)];
}

function pickRecipe(candidates, seed, usedIds){
  const clean = candidates.filter(recipe => !usedIds.has(recipe.id));
  if(!clean.length) return null;
  return clean[seededIndex(clean.length, seed)];
}

function generateTodayMenu(options = {}){
  const dateKey = berlinDateKey();
  const seedSuffix = options.reroll ? `${Date.now()}-${Math.random()}` : dateKey;
  const source = selectableRecipes();
  const used = new Set();
  const aperitifCandidates = source.filter(recipe => recipe.filters.codes.occasion === 'APERITIF' || recipe.filters.codes.drinkStyle === 'SPRITZ_APERITIF');
  const mainCodes = new Set(['SOURS','HIGHBALL_LONGDRINK','SPIRIT_FORWARD']);
  const mainCandidates = source.filter(recipe => mainCodes.has(recipe.filters.codes.drinkStyle));
  const dessertCandidates = source.filter(recipe => recipe.filters.codes.occasion === 'AFTER_DINNER' || recipe.filters.codes.drinkStyle === 'DESSERT_DRINKS');

  const aperitif = pickRecipe(aperitifCandidates, `aperitif-${seedSuffix}`, used) || pickRecipe(source, `aperitif-fallback-${seedSuffix}`, used);
  if(aperitif) used.add(aperitif.id);
  const main = pickRecipe(mainCandidates, `main-${seedSuffix}`, used) || pickRecipe(source, `main-fallback-${seedSuffix}`, used);
  if(main) used.add(main.id);
  const dessert = pickRecipe(dessertCandidates, `dessert-${seedSuffix}`, used) || pickRecipe(source, `dessert-fallback-${seedSuffix}`, used);
  if(dessert) used.add(dessert.id);

  return [
    { slot: 'Aperitif', recipe: aperitif },
    { slot: 'Hauptdrink', recipe: main },
    { slot: 'Digestif / Dessert', recipe: dessert }
  ].filter(entry => entry.recipe);
}

function todayMenuStorageKey(){
  return `hausbar-next-today-menu-${berlinDateKey()}`;
}

function saveTodayMenu(menu){
  try {
    localStorage.setItem(todayMenuStorageKey(), JSON.stringify(menu.map(entry => ({ slot: entry.slot, id: entry.recipe.id }))));
  } catch (_) {}
}

function getTodayMenu(){
  const key = todayMenuStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if(raw){
      const saved = JSON.parse(raw);
      const hydrated = saved.map(entry => ({ slot: entry.slot, recipe: recipes.find(recipe => recipe.id === entry.id) })).filter(entry => entry.recipe);
      if(hydrated.length === 3 && hydrated.every(entry => availabilityAssessment(entry.recipe).status !== 'BLOCKED')) return hydrated;
    }
  } catch (_) {}
  const menu = generateTodayMenu();
  saveTodayMenu(menu);
  return menu;
}

function renderHomeMenuItem(entry){
  const recipe = entry.recipe;
  const subtitle = [recipe.filters.display.drinkStyle, recipe.filters.display.base].filter(Boolean).join(' · ');
  const checkText = externalCheckText(recipe);
  return `<button class="home-menu-item" data-open-recipe-id="${escapeHtml(recipe.id)}" type="button">
    <span>${escapeHtml(entry.slot)}</span>
    <strong>${escapeHtml(recipe.name)}</strong>
    <small>${escapeHtml(subtitle || 'Rezept')}</small>
    ${checkText ? `<small class="availability-check">${escapeHtml(checkText)}</small>` : ''}
  </button>`;
}

function setRecipeFilter(name, value){
  state.recipeFilters[name] = value;
  renderRecipes();
}

function recipeMatchesFilters(recipe){
  const codes = recipe.filters?.codes || {};
  if(state.recipeFilters.drinkStyle && codes.drinkStyle !== state.recipeFilters.drinkStyle) return false;
  if(state.recipeFilters.base && codes.base !== state.recipeFilters.base) return false;
  if(state.recipeFilters.flavor && !arrayOf(codes.flavors).includes(state.recipeFilters.flavor)) return false;
  if(state.recipeFilters.strength && codes.strength !== state.recipeFilters.strength) return false;
  if(state.recipeFilters.occasion && codes.occasion !== state.recipeFilters.occasion) return false;
  return true;
}

function renderRecipes(){
  populateRecipeFilters();
  const query = state.recipeSearch;
  const list = recipes.filter(recipe => (!query || recipeSearchText(recipe).includes(query)) && recipeMatchesFilters(recipe));
  els.recipeCount.textContent = `${list.length} von ${recipes.length} Rezepten`;
  els.recipeGrid.innerHTML = list.map(renderRecipeCard).join('') || '<p class="empty">Keine Rezepte gefunden.</p>';
}

function usedRecipeCodes(){
  return {
    DRINK_STIL: new Set(recipes.map(recipe => recipe.filters.codes.drinkStyle)),
    BASIS: new Set(recipes.map(recipe => recipe.filters.codes.base)),
    GESCHMACK: new Set(recipes.flatMap(recipe => arrayOf(recipe.filters.codes.flavors))),
    STAERKE: new Set(recipes.map(recipe => recipe.filters.codes.strength)),
    ANLASS: new Set(recipes.map(recipe => recipe.filters.codes.occasion))
  };
}

const USED_RECIPE_CODES = usedRecipeCodes();

function codedOptions(taxonomyKey){
  return arrayOfTaxonomy(taxonomy[taxonomyKey])
    .filter(entry => USED_RECIPE_CODES[taxonomyKey]?.has(entry.code))
    .sort((a,b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map(entry => ({ value: entry.code, label: entry.display }));
}

function arrayOfTaxonomy(value){
  return Array.isArray(value) ? value.filter(entry => entry && entry.code && entry.display) : [];
}

function populateCodedSelect(select, label, options, value, onInvalid){
  const codes = new Set(options.map(option => option.value));
  const exists = !value || codes.has(value);
  select.innerHTML = [`<option value="">${escapeHtml(label)}</option>`, ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)].join('');
  select.value = exists ? value : '';
  if(!exists && onInvalid) onInvalid('');
}

function populateRecipeFilters(){
  populateCodedSelect(els.recipeDrinkStyleFilter, 'Alle Drink-Stile', codedOptions('DRINK_STIL'), state.recipeFilters.drinkStyle, value => { state.recipeFilters.drinkStyle = value; });
  populateCodedSelect(els.recipeBaseFilter, 'Alle Basen', codedOptions('BASIS'), state.recipeFilters.base, value => { state.recipeFilters.base = value; });
  populateCodedSelect(els.recipeFlavorFilter, 'Alle Geschmäcker', codedOptions('GESCHMACK'), state.recipeFilters.flavor, value => { state.recipeFilters.flavor = value; });
  populateCodedSelect(els.recipeStrengthFilter, 'Alle Stärken', codedOptions('STAERKE'), state.recipeFilters.strength, value => { state.recipeFilters.strength = value; });
  populateCodedSelect(els.recipeOccasionFilter, 'Alle Anlässe', codedOptions('ANLASS'), state.recipeFilters.occasion, value => { state.recipeFilters.occasion = value; });
}

function resetRecipeFilters(){
  state.recipeSearch = '';
  state.recipeFilters = { drinkStyle: '', base: '', flavor: '', strength: '', occasion: '' };
  els.recipeSearch.value = '';
  renderRecipes();
}

function equipmentDisplayText(recipe){
  const raw = String(recipe.serving?.equipment?.requirementText || '').trim();
  if(!raw) return '';
  return raw.replace(/EQ-WERK-\d{3}/g, id => {
    const name = toolNameById.get(id);
    if(!name) throw new Error(`Unbekannte Werkzeug-ID im sichtbaren Equipmenttext: ${id}`);
    return name;
  })
    .replace(/\bODER\b/g, 'oder')
    .replace(/\bNUR\b/g, 'nur')
    .replace(/\bBEI\b/g, 'bei')
    .replace(/\bZWEITEILIGEM\b/g, 'zweiteiligem')
    .replace(/\bSHAKER\b/g, 'Shaker')
    .replace(/\bOPTIONAL\b/g, 'optional')
    .replace(/\bALS\b/g, 'als')
    .replace(/\bVARIANTEN\b/g, 'Varianten')
    .replace(/\bORIGINALEVIDENZ\b/g, 'Originalevidenz');
}

function recipeSearchText(recipe){
  const display = recipe.filters?.display || {};
  const glass = recipe.serving?.glass || {};
  const equipment = equipmentDisplayText(recipe);
  return [
    recipe.name,
    ...arrayOf(recipe.aliases),
    recipe.description?.short,
    recipe.description?.portrait,
    ...(recipe.ingredients || []).flatMap(ingredient => [ingredient.name, ingredient.mapping?.inventoryName]),
    display.drinkStyle, display.base, ...arrayOf(display.flavors), display.strength, display.occasion,
    recipe.preparation?.housebarText,
    glass.primary?.text, glass.secondary?.text,
    recipe.serving?.ice, recipe.serving?.garnish, equipment
  ].filter(Boolean).join(' ').toLowerCase();
}

function recipeDisplayTags(recipe){
  const display = recipe.filters.display;
  return [display.drinkStyle, display.base, ...arrayOf(display.flavors), display.strength, display.occasion].filter(Boolean);
}

function renderRecipeCard(recipe){
  const display = recipe.filters.display;
  const tags = recipeDisplayTags(recipe).slice(0,4);
  const subtitle = [display.drinkStyle, display.base, display.strength].filter(Boolean).join(' · ');
  return `<button class="item-card recipe-card" data-recipe-id="${escapeHtml(recipe.id)}" data-open-recipe-id="${escapeHtml(recipe.id)}">
    <h3>${escapeHtml(recipe.name)}</h3>
    <p class="meta">${escapeHtml(subtitle)}</p>
    ${recipe.description?.short ? `<p class="recipe-preview">${escapeHtml(recipe.description.short)}</p>` : ''}
    <div class="tag-row">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
  </button>`;
}

function compactRecipeMeta(recipe){
  return [recipe.filters?.display?.drinkStyle, recipe.filters?.display?.base].filter(Boolean).join(' · ');
}

function formatIngredient(ingredient){
  const amount = ingredient.amount !== null && ingredient.amount !== undefined
    ? (typeof ingredient.amount === 'number' ? new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(ingredient.amount) : String(ingredient.amount))
    : '';
  const unit = String(ingredient.unit?.display || '').trim();
  const prefix = [amount, unit].filter(Boolean).join(' ');
  const name = String(ingredient.name || '').trim();
  const optional = ingredient.required?.value === false ? ' · Optional' : '';
  return `${prefix ? `${prefix} ` : ''}${name}${optional}`.trim();
}

function ingredientMappingText(ingredient){
  const mapping = ingredient.mapping || {};
  if(mapping.type === 'EXAKT'){
    const inventoryName = String(mapping.inventoryName || '').trim();
    return inventoryName ? `Hausbar: ${inventoryName}` : '';
  }
  if(mapping.type === 'NICHT_INVENTAR_ZULAESSIG'){
    return ingredient.required?.value === false
      ? 'Nicht inventargeführt · optional'
      : 'Nicht inventargeführt · Verfügbarkeit prüfen';
  }
  return '';
}

function recipeMetaTile(label, value, quiet = false){
  const clean = String(value || '').trim();
  if(!clean) return '';
  const tileClass = quiet ? 'recipe-meta-tile recipe-meta-tile--quiet' : 'recipe-meta-tile';
  return `<div class="${tileClass}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(clean)}</strong></div>`;
}

function openRecipe(id){
  const recipe = recipes.find(entry => entry.id === id);
  if(!recipe) return;
  els.recipeDetailName.textContent = recipe.name;
  els.recipeDetailCategory.textContent = compactRecipeMeta(recipe);
  const ingredients = [...(recipe.ingredients || [])].sort((a,b) => Number(a.position || 0) - Number(b.position || 0));
  const serving = recipe.serving || {};
  const glass = serving.glass || {};
  const equipment = equipmentDisplayText(recipe);
  const metaTiles = [
    recipeMetaTile('Stärke', recipe.filters?.display?.strength),
    recipeMetaTile('Glas', glass.primary?.text),
    recipeMetaTile('Alternativglas', glass.secondary?.text),
    recipeMetaTile('Eis', serving.ice),
    recipeMetaTile('Optionale Garnitur', serving.garnish, true),
    recipeMetaTile('Werkzeug', equipment, true)
  ].filter(Boolean).join('');

  els.recipeDetailBody.innerHTML = `
    ${recipe.description?.portrait ? `<div class="detail-section highlight-section recipe-description"><h3>Beschreibung</h3><p>${escapeHtml(recipe.description.portrait)}</p></div>` : ''}
    <div class="detail-section"><h3>Zutaten</h3>${ingredients.length ? `<ul class="clean-list ingredient-list">${ingredients.map(ingredient => {
      const mappingText = ingredientMappingText(ingredient);
      return `<li><div class="ingredient-copy"><span class="ingredient-primary">${escapeHtml(formatIngredient(ingredient))}</span>${mappingText ? `<small class="ingredient-mapping">${escapeHtml(mappingText)}</small>` : ''}</div></li>`;
    }).join('')}</ul>` : ''}</div>
    ${recipe.preparation?.housebarText ? `<div class="detail-section"><h3>Zubereitung</h3><p>${escapeHtml(recipe.preparation.housebarText)}</p></div>` : ''}
    ${metaTiles ? `<div class="recipe-meta-grid compact-recipe-meta recipe-quick-facts">${metaTiles}</div>` : ''}
  `;
  els.recipeDialog.showModal();
}

function joinHuman(values){
  const list = arrayOf(values);
  if(list.length <= 1) return list[0] || '';
  if(list.length === 2) return `${list[0]} und ${list[1]}`;
  return `${list.slice(0,-1).join(', ')} und ${list[list.length-1]}`;
}

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
