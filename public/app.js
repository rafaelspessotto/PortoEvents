const PREFERENCES = [
  { id: "musica", label: "Music", keys: ["musica", "concerto", "dj", "clubbing"] },
  { id: "teatro", label: "Theater", keys: ["teatro", "palcos", "comedia", "circo"] },
  { id: "cinema", label: "Cinema", keys: ["cinema", "filme"] },
  { id: "arte", label: "Art", keys: ["arte", "exposi", "galeria"] },
  { id: "familia", label: "Family", keys: ["famil", "criancas", "infancia"] },
  { id: "desporto", label: "Sports", keys: ["desporto", "movimento", "corrida"] },
];

const STORAGE_KEY = "portoevents_user";
const GEO_CACHE_KEY = "portoevents_geo_cache";
const USERS_KEY = "portoevents_users";
const FALLBACK_AVATAR = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=300&q=60";
const DEMO_EMAIL = "joao.festeiro@reconnect.pt";
const LEGACY_DEMO_EMAIL = "demo@reconnect.pt";
const DEMO_AVATAR = "/veio.jpeg";
const DEMO_NAME = "João Festeiro";

const authScreenEl = document.getElementById("authScreen");
const onboardingScreenEl = document.getElementById("onboardingScreen");
const appShellEl = document.getElementById("appShell");
const loginFormEl = document.getElementById("loginForm");
const onlyPreferredEl = document.getElementById("onlyPreferred");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const savePrefsBtn = document.getElementById("savePrefsBtn");
const finishOnboardingBtn = document.getElementById("finishOnboardingBtn");
const moreEventsBtn = document.getElementById("moreEventsBtn");
const searchInputEl = document.getElementById("searchInput");

const helloUserEl = document.getElementById("helloUser");
const profileAvatarEl = document.getElementById("profileAvatar");
const profileNavAvatarEl = document.getElementById("profileNavAvatar");
const profileNavNameEl = document.getElementById("profileNavName");
const profileMenuTriggerEl = document.getElementById("profileMenuTrigger");
const profileDropdownEl = document.getElementById("profileDropdown");
const profileNameEl = document.getElementById("profileName");
const profileEmailEl = document.getElementById("profileEmail");
const eventsListEl = document.getElementById("eventsList");
const nearRowEl = document.getElementById("nearRow");
const highlightCardEl = document.getElementById("highlightCard");
const prefsGridEl = document.getElementById("prefsGrid");
const onboardingPrefsGridEl = document.getElementById("onboardingPrefsGrid");
const mapCategoriesEl = document.getElementById("mapCategories");

const screenHome = document.getElementById("screenHome");
const screenProfile = document.getElementById("screenProfile");
const navButtons = Array.from(document.querySelectorAll(".nav-btn, .nav-menu-item"));

let currentUser = null;
let payload = { events: [], lastUpdated: null };
let filteredEvents = [];
let mapInstance = null;
let mapMarkers = [];
let visibleEventsCount = 8;
const geoCache = readGeoCache();

const EVENTS_PAGE_SIZE = 8;
const DEMO_ELDERLY_SOURCE_ID = "demo-elderly";
const DEMO_DISABLE_REFRESH = true;

const ELDERLY_INCLUDE_KEYWORDS = [
  "exposi",
  "museu",
  "galeria",
  "teatro",
  "concerto",
  "recital",
  "classica",
  "fado",
  "jazz",
  "cinema",
  "filme",
  "oficina",
  "workshop",
  "patrimonio",
  "cultural",
  "aguarela",
  "ceramica",
  "pintura",
  "coro",
  "orquestra",
  "visita guiada",
];

const ELDERLY_EXCLUDE_KEYWORDS = [
  "dj",
  "clubbing",
  "rave",
  "after party",
  "noturna",
  "corrida",
  "cycling",
  "crossfit",
  "fight",
  "polo aquatico",
  "hidroginastica",
  "meia maratona",
  "noite academica",
];

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function isDemoEmail(email) {
  const normalizedEmail = (email || "").toLowerCase();
  return normalizedEmail === DEMO_EMAIL || normalizedEmail === LEGACY_DEMO_EMAIL;
}

function resolveAvatar(email, avatar) {
  if (isDemoEmail(email)) return DEMO_AVATAR;
  if (avatar) return avatar;
  return "";
}

function resolveName(email, name) {
  if (isDemoEmail(email)) return DEMO_NAME;
  return name || "";
}

function readUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      name: resolveName(parsed.email, parsed.name),
      email: parsed.email || "",
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      onboarded: Boolean(parsed.onboarded),
      avatar: resolveAvatar(parsed.email, parsed.avatar),
    };
  } catch {
    return null;
  }
}

function readGeoCache() {
  const raw = localStorage.getItem(GEO_CACHE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  currentUser = user;
}

function persistGeoCache() {
  localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geoCache));
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isElderlyFriendlyEvent(event) {
  const text = normalizeText(`${event.title} ${event.category} ${event.description} ${event.venue}`);

  if (ELDERLY_EXCLUDE_KEYWORDS.some((key) => text.includes(key))) {
    return false;
  }

  return ELDERLY_INCLUDE_KEYWORDS.some((key) => text.includes(key));
}

function eventMatchesPreference(event, preferenceId) {
  const preference = PREFERENCES.find((item) => item.id === preferenceId);
  if (!preference) return false;
  const text = normalizeText(`${event.title} ${event.category} ${event.description}`);
  return preference.keys.some((key) => text.includes(key));
}

function isPreferred(event) {
  if (!currentUser?.preferences?.length) return false;
  return currentUser.preferences.some((prefId) => eventMatchesPreference(event, prefId));
}

function formatDate(dateString) {
  if (!dateString) return "No date";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function setScreen(screenName) {
  const screens = {
    home: screenHome,
    profile: screenProfile,
  };

  Object.entries(screens).forEach(([key, element]) => {
    element.classList.toggle("hidden", key !== screenName);
  });

  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.screen === screenName);
  });

  profileMenuTriggerEl.classList.toggle("active", screenName === "profile");
  closeProfileMenu();

  if (screenName === "home") {
    ensureMap();
    setTimeout(() => mapInstance?.invalidateSize(), 40);
    updateMap(filteredEvents);
  }
}

function openProfileMenu() {
  profileDropdownEl.classList.remove("hidden");
  profileMenuTriggerEl.setAttribute("aria-expanded", "true");
}

function closeProfileMenu() {
  profileDropdownEl.classList.add("hidden");
  profileMenuTriggerEl.setAttribute("aria-expanded", "false");
}

function toggleProfileMenu() {
  if (profileDropdownEl.classList.contains("hidden")) {
    openProfileMenu();
    return;
  }

  closeProfileMenu();
}

function renderAuthState() {
  const loggedIn = Boolean(currentUser);
  authScreenEl.classList.toggle("hidden", loggedIn);
  onboardingScreenEl.classList.toggle("hidden", true);
  appShellEl.classList.toggle("hidden", !loggedIn);

  if (!loggedIn) return;

  helloUserEl.textContent = `Hello, ${currentUser.name || "Friend"}!`;
  profileNameEl.textContent = currentUser.name || "User";
  profileEmailEl.textContent = currentUser.email || "email";
  profileNavNameEl.textContent = currentUser.name || "Profile";

  const avatarMarkup = currentUser.avatar
    ? `<img src="${currentUser.avatar}" alt="Profile photo of ${currentUser.name || "user"}">`
    : `<span>${(currentUser.name || "U").charAt(0).toUpperCase()}</span>`;

  profileAvatarEl.innerHTML = avatarMarkup;
  profileNavAvatarEl.innerHTML = avatarMarkup;

  renderPreferences();
  renderMapCategories();
  setScreen("home");
}

function renderOnboardingState() {
  authScreenEl.classList.add("hidden");
  appShellEl.classList.add("hidden");
  onboardingScreenEl.classList.remove("hidden");
  renderOnboardingPreferences();
}

function renderPreferences() {
  const selected = new Set(currentUser?.preferences || []);
  prefsGridEl.innerHTML = PREFERENCES.map((pref) => {
    const active = selected.has(pref.id) ? "active" : "";
    return `<label class="pref-item ${active}"><input type="checkbox" value="${pref.id}" ${active ? "checked" : ""}>${pref.label}</label>`;
  }).join("");
}

function renderOnboardingPreferences() {
  const selected = new Set(currentUser?.preferences || []);
  onboardingPrefsGridEl.innerHTML = PREFERENCES.map((pref) => {
    const active = selected.has(pref.id) ? "active" : "";
    return `<label class="pref-item ${active}"><input type="checkbox" value="${pref.id}" ${active ? "checked" : ""}>${pref.label}</label>`;
  }).join("");
}

function renderMapCategories() {
  mapCategoriesEl.innerHTML = [
    "<button class='chip chip-strong' type='button' data-cat='all'>All</button>",
    ...PREFERENCES.map((pref) => `<button class='chip' type='button' data-cat='${pref.id}'>${pref.label}</button>`),
  ].join("");
}

function filterEvents() {
  let list = payload.events.filter((event) => event.sourceId === DEMO_ELDERLY_SOURCE_ID);
  const search = normalizeText(searchInputEl.value);

  if (search) {
    list = list.filter((event) => normalizeText(`${event.title} ${event.venue} ${event.category}`).includes(search));
  }

  if (onlyPreferredEl.checked) {
    list = list.filter(isPreferred);
  }

  list.sort((a, b) => Number(isPreferred(b)) - Number(isPreferred(a)));
  filteredEvents = list;
  visibleEventsCount = EVENTS_PAGE_SIZE;
}

function renderHomeSections() {
  if (!filteredEvents.length) {
    eventsListEl.innerHTML = "<p>No events to display.</p>";
    moreEventsBtn.classList.add("hidden");
    nearRowEl.innerHTML = "";
    highlightCardEl.innerHTML = "";
    return;
  }

  const visibleEvents = filteredEvents.slice(0, visibleEventsCount);

  eventsListEl.innerHTML = visibleEvents.map((event) => `
    <article class="event-row" tabindex="0" aria-label="${event.title}">
      <img class="event-cover" src="${event.image || FALLBACK_AVATAR}" alt="Event ${event.title}">
      <div class="event-overlay">
        <div class="event-overlay__content">
          <h4>${event.title}</h4>
          <p>${event.venue || "Porto"}</p>
          <div class="meta-pills">
            <span>${event.category || "Event"}</span>
            <span>${formatDate(event.startDate)}</span>
          </div>
        </div>
      </div>
    </article>
  `).join("");

  moreEventsBtn.classList.toggle("hidden", visibleEventsCount >= filteredEvents.length);

  nearRowEl.innerHTML = filteredEvents.slice(0, 4).map((event) => `
    <article class="near-card">
      <img src="${event.image || FALLBACK_AVATAR}" alt="${event.title}">
      <h4>${event.title.length > 22 ? `${event.title.slice(0, 22)}...` : event.title}</h4>
      <small>${event.category || "Event"}</small>
    </article>
  `).join("");

  const upcoming = filteredEvents[0];
  highlightCardEl.innerHTML = `
    <span class="badge">Upcoming Event</span>
    <h3>${upcoming.title}</h3>
    <p>${upcoming.description || "Discover this event with the people you care about most."}</p>
    <small>${formatDate(upcoming.startDate)} ${upcoming.venue ? `• ${upcoming.venue}` : ""}</small>
  `;
}

function ensureMap() {
  if (mapInstance || typeof L === "undefined") return;
  mapInstance = L.map("eventsMap", { center: [41.1579, -8.6291], zoom: 12 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(mapInstance);
}

function clearMarkers() {
  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];
}

async function geocodeVenue(venue) {
  if (!venue) return null;
  const key = venue.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(geoCache, key)) {
    return geoCache[key];
  }

  try {
    const query = encodeURIComponent(`${venue}, Porto, Portugal`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      geoCache[key] = null;
      persistGeoCache();
      return null;
    }

    const point = { lat: Number(data[0].lat), lon: Number(data[0].lon) };
    geoCache[key] = point;
    persistGeoCache();
    return point;
  } catch {
    return null;
  }
}

async function updateMap(events) {
  ensureMap();
  if (!mapInstance) return;

  clearMarkers();
  const latlngs = [];

  for (const event of events.slice(0, 18)) {
    const point = await geocodeVenue(event.venue);
    if (!point) continue;

    const marker = L.marker([point.lat, point.lon]).addTo(mapInstance);
    marker.bindPopup(`<strong>${event.title}</strong><br>${event.venue || "Porto"}`);
    mapMarkers.push(marker);
    latlngs.push([point.lat, point.lon]);
  }

  if (latlngs.length) {
    mapInstance.fitBounds(latlngs, { padding: [25, 25], maxZoom: 14 });
  } else {
    mapInstance.setView([41.1579, -8.6291], 12);
  }
}

function applyMapCategoryFilter(categoryId) {
  if (categoryId === "all") {
    updateMap(filteredEvents);
    return;
  }

  const subset = filteredEvents.filter((event) => eventMatchesPreference(event, categoryId));
  updateMap(subset);
}

async function loadEvents() {
  const response = await fetch("/api/events");
  const data = await response.json();
  payload = data;
  filterEvents();
  renderHomeSections();
  updateMap(filteredEvents);
}

async function refreshEvents() {
  if (DEMO_DISABLE_REFRESH) return;
  refreshBtn.disabled = true;
  try {
    await fetch("/api/events/refresh", { method: "POST" });
    await loadEvents();
  } finally {
    refreshBtn.disabled = false;
  }
}

loginFormEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) return;

  const users = readUsers();
  const key = email.toLowerCase();
  const found = users[key];

  if (found) {
    const normalizedUser = {
      ...found,
      name: resolveName(found.email, found.name),
      avatar: resolveAvatar(found.email, found.avatar),
    };
    users[key] = normalizedUser;
    saveUsers(users);
    saveUser(normalizedUser);
    renderOnboardingState();
    return;
  }

  const defaultName = resolveName(email, email.split("@")[0] || "User");
  const createdUser = {
    name: defaultName,
    email,
    preferences: [],
    onboarded: false,
    avatar: resolveAvatar(email),
  };

  saveUser(createdUser);
  users[key] = createdUser;
  saveUsers(users);
  renderOnboardingState();
});

finishOnboardingBtn.addEventListener("click", async () => {
  if (!currentUser) return;

  const selected = Array.from(document.querySelectorAll("#onboardingPrefsGrid input:checked")).map(
    (el) => el.value,
  );

  const updated = {
    ...currentUser,
    preferences: selected,
    onboarded: true,
  };

  const users = readUsers();
  users[currentUser.email.toLowerCase()] = updated;
  saveUsers(users);
  saveUser(updated);

  renderAuthState();
  await loadEvents();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  currentUser = null;
  renderAuthState();
});

savePrefsBtn.addEventListener("click", () => {
  if (!currentUser) return;
  const selected = Array.from(document.querySelectorAll("#prefsGrid input:checked")).map((el) => el.value);
  const updated = { ...currentUser, preferences: selected, onboarded: true };
  const users = readUsers();
  users[currentUser.email.toLowerCase()] = updated;
  saveUsers(users);
  saveUser(updated);
  renderPreferences();
  filterEvents();
  renderHomeSections();
  updateMap(filteredEvents);
});

moreEventsBtn.addEventListener("click", () => {
  visibleEventsCount += EVENTS_PAGE_SIZE;
  renderHomeSections();
});

prefsGridEl.addEventListener("click", (event) => {
  const label = event.target.closest(".pref-item");
  if (!label) return;
  const input = label.querySelector("input");
  input.checked = !input.checked;
  label.classList.toggle("active", input.checked);
});

onboardingPrefsGridEl.addEventListener("click", (event) => {
  const label = event.target.closest(".pref-item");
  if (!label) return;
  const input = label.querySelector("input");
  input.checked = !input.checked;
  label.classList.toggle("active", input.checked);
});

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => setScreen(btn.dataset.screen));
});

profileMenuTriggerEl.addEventListener("click", () => {
  toggleProfileMenu();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".nav-profile-menu")) return;
  closeProfileMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeProfileMenu();
  }
});

searchInputEl.addEventListener("input", () => {
  filterEvents();
  renderHomeSections();
});

onlyPreferredEl.addEventListener("change", () => {
  filterEvents();
  renderHomeSections();
  updateMap(filteredEvents);
});

refreshBtn.addEventListener("click", refreshEvents);

if (DEMO_DISABLE_REFRESH) {
  refreshBtn.disabled = true;
  refreshBtn.title = "Refresh disabled for demo mode";
}

mapCategoriesEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-cat]");
  if (!button) return;

  Array.from(mapCategoriesEl.querySelectorAll("button")).forEach((el) => {
    el.classList.toggle("chip-strong", el === button);
  });

  applyMapCategoryFilter(button.dataset.cat);
});

localStorage.removeItem(STORAGE_KEY);
renderAuthState();
