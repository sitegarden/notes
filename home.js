import {
  auth,
  googleProvider,
  db
} from "./firebase.js";

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  isAdmin
} from "./admin.js";

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const reloadBtn = document.getElementById("reloadBtn");

const userName = document.getElementById("userName");
const userStatus = document.getElementById("userStatus");
const homeContent = document.getElementById("homeContent");

const recentTimeline = document.getElementById("recentTimeline");

const quickMemoList = document.getElementById("quickMemoList");
const taskList = document.getElementById("taskList");
const normalMemoList = document.getElementById("normalMemoList");
const diaryList = document.getElementById("diaryList");
const dreamList = document.getElementById("dreamList");
const musicList = document.getElementById("musicList");
const storyList = document.getElementById("storyList");
const peopleList = document.getElementById("peopleList");

let currentUser = null;
let isCurrentAdmin = false;

const DISPLAY_LIMIT = 5;
const TIMELINE_LIMIT = 12;

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error(error);
    alert("ログインに失敗しました");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error(error);
    alert("ログアウトに失敗しました");
  }
});

reloadBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await loadHome();
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  isCurrentAdmin = isAdmin(user);

  if (!user) {
    userName.textContent = "未ログイン";
    userStatus.textContent = "Googleでログインすると、最近のメモを表示できます。";
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    homeContent.classList.add("hidden");
    return;
  }

  userName.textContent = user.displayName || "ログイン中";
  userStatus.textContent = isCurrentAdmin
    ? "管理人モードで表示中です。"
    : "クイックメモとタスクを表示中です。";

  loginBtn.classList.add("hidden");
  logoutBtn.classList.remove("hidden");
  homeContent.classList.remove("hidden");

  document.querySelectorAll(".admin-only").forEach((element) => {
    element.classList.toggle("hidden", !isCurrentAdmin);
  });

  await loadHome();
});

async function loadHome() {
  clearAllLists();

  userStatus.textContent = "最近の記録を読み込んでいます...";

  try {
    const sections = [];

    const quickMemos = await fetchUserCollection("quickMemos");
    sections.push({
      type: "quick",
      label: "クイックメモ",
      url: "quick.html",
      items: quickMemos.map((item) => ({
        ...item,
        displayTitle: getQuickMemoTitle(item),
        displayText: item.body || "",
        displayDate: getDisplayDate(item)
      }))
    });

    const tasks = await fetchUserCollection("tasks");
    sections.push({
      type: "task",
      label: "タスク",
      url: "task.html",
      items: tasks.map((item) => ({
        ...item,
        displayTitle: item.title || "無題のタスク",
        displayText: item.memo || item.category || "",
        displayDate: getDisplayDate(item)
      }))
    });

    if (isCurrentAdmin) {
      const normalMemos = await fetchUserCollection("normalMemos");
      sections.push({
        type: "normal",
        label: "通常メモ",
        url: "normal.html",
        items: normalMemos.map((item) => ({
          ...item,
          displayTitle: item.title || "無題のメモ",
          displayText: item.body || "",
          displayDate: getDisplayDate(item)
        }))
      });

      const diaries = await fetchUserCollection("diaries");
      sections.push({
        type: "diary",
        label: "日記",
        url: "diary.html",
        items: diaries.map((item) => ({
          ...item,
          displayTitle: item.date ? `${item.date} の日記` : "日記",
          displayText: item.body || item.mood || "",
          displayDate: item.date || getDisplayDate(item)
        }))
      });

      const dreams = await fetchUserCollection("dreamDiaries");
      sections.push({
        type: "dream",
        label: "夢日記",
        url: "dream.html",
        items: dreams.map((item) => ({
          ...item,
          displayTitle: item.date ? `${item.date} の夢` : "夢日記",
          displayText: item.body || item.mood || "",
          displayDate: item.date || getDisplayDate(item)
        }))
      });

      const musicMemos = await fetchUserCollection("musicMemos");
      sections.push({
        type: "music",
        label: "曲メモ",
        url: "music.html",
        items: musicMemos.map((item) => ({
          ...item,
          displayTitle: item.title || "無題の曲",
          displayText: [item.artist, item.genre].filter(Boolean).join(" / "),
          displayDate: getDisplayDate(item)
        }))
      });

      const storyWorks = await fetchUserCollection("storyWorks");
      sections.push({
        type: "story",
        label: "ストーリー",
        url: "story.html",
        items: storyWorks.map((item) => ({
          ...item,
          displayTitle: item.title || "無題の作品",
          displayText: item.description || "",
          displayDate: getDisplayDate(item)
        }))
      });

      const people = await fetchUserCollection("people");
      sections.push({
        type: "people",
        label: "人物帳",
        url: "people.html",
        items: people.map((item) => ({
          ...item,
          displayTitle: item.name || "名前なし",
          displayText: makePeopleText(item),
          displayDate: getDisplayDate(item)
        }))
      });
    }

    sections.forEach((section) => {
      section.items.sort(compareByDateDesc);
    });

    renderSection(quickMemoList, sections.find((s) => s.type === "quick"));
    renderSection(taskList, sections.find((s) => s.type === "task"));

    if (isCurrentAdmin) {
      renderSection(normalMemoList, sections.find((s) => s.type === "normal"));
      renderSection(diaryList, sections.find((s) => s.type === "diary"));
      renderSection(dreamList, sections.find((s) => s.type === "dream"));
      renderSection(musicList, sections.find((s) => s.type === "music"));
      renderSection(storyList, sections.find((s) => s.type === "story"));
      renderSection(peopleList, sections.find((s) => s.type === "people"));
    }

    renderTimeline(sections);

    userStatus.textContent = isCurrentAdmin
      ? "すべての最近の記録を表示しています。"
      : "最近のクイックメモとタスクを表示しています。";
  } catch (error) {
    console.error(error);
    userStatus.textContent = "読み込みに失敗しました。";
    alert("最近の記録の読み込みに失敗しました");
  }
}

async function fetchUserCollection(collectionName) {
  const q = query(
    collection(db, collectionName),
    where("uid", "==", currentUser.uid)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));
}

function clearAllLists() {
  recentTimeline.innerHTML = "";
  quickMemoList.innerHTML = "";
  taskList.innerHTML = "";
  normalMemoList.innerHTML = "";
  diaryList.innerHTML = "";
  dreamList.innerHTML = "";
  musicList.innerHTML = "";
  storyList.innerHTML = "";
  peopleList.innerHTML = "";
}

function renderTimeline(sections) {
  const allItems = sections.flatMap((section) => {
    return section.items.map((item) => ({
      ...item,
      sectionLabel: section.label,
      sectionUrl: section.url
    }));
  });

  allItems.sort(compareByDateDesc);

  const latestItems = allItems.slice(0, TIMELINE_LIMIT);

  if (latestItems.length === 0) {
    recentTimeline.innerHTML = `<p class="empty-text">まだ記録がありません。</p>`;
    return;
  }

  latestItems.forEach((item) => {
    const card = document.createElement("a");
    card.className = "timeline-card";
    card.href = item.sectionUrl;

    const label = document.createElement("span");
    label.className = "timeline-label";
    label.textContent = item.sectionLabel;

    const title = document.createElement("h3");
    title.textContent = item.displayTitle || "無題";

    const text = document.createElement("p");
    text.textContent = makePreview(item.displayText || "");

    const date = document.createElement("small");
    date.textContent = item.displayDate || "日付なし";

    card.appendChild(label);
    card.appendChild(title);

    if (item.displayText) {
      card.appendChild(text);
    }

    card.appendChild(date);
    recentTimeline.appendChild(card);
  });
}

function renderSection(container, section) {
  if (!section) return;

  const items = section.items.slice(0, DISPLAY_LIMIT);

  if (items.length === 0) {
    container.innerHTML = `<p class="empty-text">まだ記録がありません。</p>`;
    return;
  }

  items.forEach((item) => {
    const link = document.createElement("a");
    link.className = "home-list-item";
    link.href = section.url;

    const title = document.createElement("strong");
    title.textContent = item.displayTitle || "無題";

    const text = document.createElement("span");
    text.textContent = makePreview(item.displayText || "");

    const date = document.createElement("small");
    date.textContent = item.displayDate || "日付なし";

    link.appendChild(title);

    if (item.displayText) {
      link.appendChild(text);
    }

    link.appendChild(date);

    container.appendChild(link);
  });
}

function getQuickMemoTitle(item) {
  const body = item.body || "";
  const firstLine = body.split("\n").find((line) => line.trim());

  return firstLine ? firstLine.trim() : "無題のメモ";
}

function getDisplayDate(item) {
  const date = item.updatedAt || item.createdAt;

  if (!date) return "";

  if (date.toDate) {
    return formatDate(date.toDate());
  }

  if (typeof date === "string") {
    return date;
  }

  return "";
}

function getSortTime(item) {
  const date = item.updatedAt || item.createdAt;

  if (!date) return 0;

  if (date.toDate) {
    return date.toDate().getTime();
  }

  if (typeof date === "string") {
    const time = new Date(date).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  return 0;
}

function compareByDateDesc(a, b) {
  return getSortTime(b) - getSortTime(a);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function makePreview(text) {
  return String(text)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function makePeopleText(person) {
  return [
    person.nickname,
    person.subType,
    person.relation,
    person.mbti,
    person.enneagram
  ]
    .filter(Boolean)
    .join(" / ");
}
