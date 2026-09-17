// Typing Speed Test — lógica da aplicação
// Módulos até aqui:
//  1. Dropdown (dificuldade/modo) — os mesmos botões (.segmented-option) servem
//     tanto para as pills do desktop quanto para os itens de lista do mobile.
//  2. Passagens — carrega o data.json e sorteia um trecho por dificuldade.

(function () {
  "use strict";

  const passageEl = document.getElementById("passage");
  const startOverlay = document.getElementById("start-overlay");
  const startButton = document.getElementById("start-button");
  const typingInput = document.getElementById("typing-input");
  const accuracyEl = document.getElementById("stat-accuracy");
  const wpmEl = document.getElementById("stat-wpm");
  const timeEl = document.getElementById("stat-time");
  const statsAnnouncerEl = document.getElementById("stats-announcer");

  const testScreen = document.getElementById("test-screen");
  const resultsScreen = document.getElementById("results-screen");
  const resultsIconEl = document.getElementById("results-icon");
  const resultsTitleEl = document.getElementById("results-title");
  const resultsSubtitleEl = document.getElementById("results-subtitle");
  const resultsWpmEl = document.getElementById("results-wpm");
  const resultsAccuracyEl = document.getElementById("results-accuracy");
  const resultsCharactersCorrectEl = document.getElementById("results-characters-correct");
  const resultsCharactersIncorrectEl = document.getElementById("results-characters-incorrect");
  const restartButton = document.getElementById("restart-button");
  const testRestart = document.getElementById("test-restart");
  const testRestartButton = document.getElementById("test-restart-button");
  const personalBestValueEl = document.getElementById("personal-best-value");

  // ---------------------------------------------------------------------
  // Recorde pessoal: persiste no localStorage entre sessões. Envolvido em
  // try/catch porque localStorage pode estar bloqueado (modo privado, etc.)
  // ---------------------------------------------------------------------

  const PERSONAL_BEST_KEY = "typingSpeedTest.personalBestWpm";

  function getPersonalBest() {
    try {
      const raw = localStorage.getItem(PERSONAL_BEST_KEY);
      return raw === null ? null : Number(raw);
    } catch {
      return null;
    }
  }

  function setPersonalBest(wpm) {
    personalBestValueEl.textContent = `${wpm} WPM`;
    try {
      localStorage.setItem(PERSONAL_BEST_KEY, String(wpm));
    } catch {
      // Sem storage disponível: o recorde só vale pra essa sessão
    }
  }

  function renderPersonalBest() {
    const best = getPersonalBest();
    personalBestValueEl.textContent = best === null ? "–– WPM" : `${best} WPM`;
  }

  renderPersonalBest();

  // ---------------------------------------------------------------------
  // Passagens: carrega data.json uma vez e sorteia um trecho por dificuldade
  // ---------------------------------------------------------------------

  let passagesByDifficulty = null;
  let currentPassageText = "";

  async function loadPassages() {
    if (passagesByDifficulty) return passagesByDifficulty;
    const response = await fetch("./data.json");
    if (!response.ok) throw new Error(`Falha ao carregar data.json: ${response.status}`);
    passagesByDifficulty = await response.json();
    return passagesByDifficulty;
  }

  function pickRandomPassage(difficulty) {
    const list = passagesByDifficulty[difficulty];
    return list[Math.floor(Math.random() * list.length)];
  }

  /** Recria a passagem como um span por caractere — é isso que o motor de
   *  digitação usa pra pintar acerto/erro/cursor em cada posição. */
  function renderPassageSpans(text) {
    const fragment = document.createDocumentFragment();
    for (const char of text) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = char;
      fragment.appendChild(span);
    }
    passageEl.innerHTML = "";
    passageEl.appendChild(fragment);
  }

  async function showRandomPassage(difficulty) {
    await loadPassages();
    const passage = pickRandomPassage(difficulty);
    currentPassageText = passage.text;
    passageEl.dataset.passageId = passage.id;
    renderPassageSpans(passage.text);
    resetForNewAttempt();
  }

  function getSelectedDifficulty() {
    const selected = document.querySelector("#difficulty-group .segmented-option.is-selected");
    return selected ? selected.dataset.difficulty : "easy";
  }

  function getSelectedMode() {
    const selected = document.querySelector("#mode-group .segmented-option.is-selected");
    return selected ? selected.dataset.mode : "timed";
  }

  // Carrega a primeira passagem assim que o script roda (dificuldade padrão: fácil)
  showRandomPassage(getSelectedDifficulty()).catch((error) => {
    console.error(error);
    passageEl.textContent = "Não foi possível carregar o texto. Recarregue a página.";
  });

  // ---------------------------------------------------------------------
  // Motor de digitação: compara o valor do input oculto, caractere a
  // caractere, com a passagem — e pinta o resultado nos spans.
  // ---------------------------------------------------------------------

  let previousValue = "";
  let correctKeystrokes = 0;
  let incorrectKeystrokes = 0;

  function calculateAccuracy() {
    const total = correctKeystrokes + incorrectKeystrokes;
    return total === 0 ? 100 : Math.round((correctKeystrokes / total) * 100);
  }

  function updateAccuracyDisplay() {
    const total = correctKeystrokes + incorrectKeystrokes;
    const accuracy = calculateAccuracy();
    accuracyEl.textContent = `${accuracy}%`;
    // Sem digitação ainda: mantém a cor neutra padrão do estado inicial
    accuracyEl.classList.toggle("is-perfect", total > 0 && accuracy === 100);
    accuracyEl.classList.toggle("is-error", accuracy < 100);
  }

  /** Repinta cada span da passagem de acordo com o valor atual do input. */
  function renderDiff(value) {
    const chars = passageEl.children;
    for (let i = 0; i < chars.length; i++) {
      const span = chars[i];
      span.classList.remove("is-correct", "is-incorrect", "is-cursor");
      if (i < value.length) {
        span.classList.add(value[i] === currentPassageText[i] ? "is-correct" : "is-incorrect");
      }
    }
    if (value.length < chars.length) {
      chars[value.length].classList.add("is-cursor");
    }
  }

  typingInput.addEventListener("input", () => {
    // A primeira tecla digitada (quando o teste começou por clique na
    // passagem, não pelo botão) é o gatilho real do cronômetro
    if (testState === "idle") startTest();

    let value = typingInput.value;

    // Não deixa digitar além do tamanho da passagem
    if (value.length > currentPassageText.length) {
      value = value.slice(0, currentPassageText.length);
      typingInput.value = value;
    }

    // Só conta keystroke (certo/errado) quando o texto cresce — apagar com
    // backspace não desfaz o erro já contabilizado, só tira a marcação visual
    if (value.length > previousValue.length) {
      for (let i = previousValue.length; i < value.length; i++) {
        if (value[i] === currentPassageText[i]) {
          correctKeystrokes++;
        } else {
          incorrectKeystrokes++;
        }
      }
    }

    previousValue = value;
    renderDiff(value);
    updateAccuracyDisplay();

    if (value.length === currentPassageText.length) finishTest();
  });

  // Colar texto tornaria o teste trivial — só digitação de verdade conta
  typingInput.addEventListener("paste", (event) => event.preventDefault());

  // ---------------------------------------------------------------------
  // Cronômetro + WPM. Dois modos:
  //  - "timed": conta 60s regressivos (o mockup mostra "0:60" → "0:00",
  //    por isso o formato é sempre "0:SS" em vez do mm:ss convencional)
  //  - "passage": conta pra cima, sem limite, até o trecho acabar
  // ---------------------------------------------------------------------

  const TIMED_DURATION_SECONDS = 60;
  // Anunciar a cada tick (250ms) spamaria leitores de tela — só falamos os
  // números de novo depois desse intervalo
  const STATS_ANNOUNCE_INTERVAL_MS = 5000;

  let testState = "idle"; // idle -> running -> finished
  let startTimestamp = 0;
  let timerIntervalId = null;
  let lastStatsAnnounceAt = 0;

  function formatMinutesSeconds(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function renderInitialTime() {
    timeEl.textContent = getSelectedMode() === "timed" ? "0:60" : "0:00";
  }

  function calculateWpm(elapsedSeconds) {
    const elapsedMinutes = elapsedSeconds / 60;
    if (elapsedMinutes <= 0) return 0;
    // Convenção padrão: 1 "palavra" = 5 caracteres corretos digitados
    return Math.round(correctKeystrokes / 5 / elapsedMinutes);
  }

  function tick() {
    const elapsedSeconds = (Date.now() - startTimestamp) / 1000;
    const mode = getSelectedMode();

    if (mode === "timed") {
      const remaining = Math.max(0, TIMED_DURATION_SECONDS - elapsedSeconds);
      timeEl.textContent = `0:${String(Math.ceil(remaining)).padStart(2, "0")}`;
    } else {
      timeEl.textContent = formatMinutesSeconds(Math.floor(elapsedSeconds));
    }

    wpmEl.textContent = String(calculateWpm(elapsedSeconds));
    announceStatsThrottled();

    if (mode === "timed" && elapsedSeconds >= TIMED_DURATION_SECONDS) {
      finishTest();
    }
  }

  /** Atualiza a live region de estatísticas no máximo 1x a cada 5s — os
   *  <strong> visuais mudam a cada 250ms, o que seria barulho demais pra
   *  leitor de tela se anunciado toda vez. */
  function announceStatsThrottled() {
    const now = Date.now();
    if (now - lastStatsAnnounceAt < STATS_ANNOUNCE_INTERVAL_MS) return;
    lastStatsAnnounceAt = now;
    statsAnnouncerEl.textContent =
      `${wpmEl.textContent} palavras por minuto, ` +
      `precisão ${calculateAccuracy()}%, ` +
      `tempo ${timeEl.textContent}`;
  }

  function startTest() {
    if (testState !== "idle") return;
    testState = "running";
    startTimestamp = Date.now();
    timerIntervalId = setInterval(tick, 250);
    tick();
  }

  /** Encerra o teste (tempo esgotado ou trecho completo) e mostra os resultados.
   *  As mensagens de "recorde batido" entram quando o localStorage for ligado —
   *  por enquanto é sempre a mensagem genérica de "teste concluído". */
  function finishTest() {
    if (testState === "finished") return;
    testState = "finished";
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    tick();
    typingInput.disabled = true;
    showResults();
  }

  function showResults() {
    const accuracy = calculateAccuracy();
    const finalWpm = Number(wpmEl.textContent);
    const previousBest = getPersonalBest();

    resultsScreen.classList.remove("is-high-score");

    if (previousBest === null) {
      // Primeiro teste já concluído — define a régua inicial
      setPersonalBest(finalWpm);
      resultsIconEl.src = "./assets/images/icon-completed.svg";
      resultsTitleEl.textContent = "Baseline Established!";
      resultsSubtitleEl.textContent = "Você definiu a régua. Agora o desafio é superar você mesmo.";
    } else if (finalWpm > previousBest) {
      setPersonalBest(finalWpm);
      resultsScreen.classList.add("is-high-score");
      resultsIconEl.src = "./assets/images/icon-new-pb.svg";
      resultsTitleEl.textContent = "High Score Smashed!";
      resultsSubtitleEl.textContent = "Você está cada vez mais rápido. Digitação incrível.";
    } else {
      resultsIconEl.src = "./assets/images/icon-completed.svg";
      resultsTitleEl.textContent = "Teste Concluído!";
      resultsSubtitleEl.textContent = "Boa corrida. Continue tentando bater seu recorde.";
    }

    resultsWpmEl.textContent = String(finalWpm);
    resultsAccuracyEl.textContent = `${accuracy}%`;
    resultsAccuracyEl.classList.toggle("is-perfect", accuracy === 100);
    resultsAccuracyEl.classList.toggle("is-error", accuracy < 100);
    resultsCharactersCorrectEl.textContent = String(correctKeystrokes);
    resultsCharactersIncorrectEl.textContent = String(incorrectKeystrokes);

    testScreen.hidden = true;
    resultsScreen.hidden = false;
    // Joga o foco pro heading: sem isso, quem navega por teclado/leitor de
    // tela fica "preso" no input desabilitado sem saber que a tela mudou
    resultsTitleEl.focus();
  }

  restartButton.addEventListener("click", () => {
    resultsScreen.hidden = true;
    testScreen.hidden = false;
    showRandomPassage(getSelectedDifficulty())
      .then(() => startButton.focus()) // mesma lógica do foco nos resultados: guia quem usa teclado/leitor de tela
      .catch((error) => console.error(error));
  });

  /** Zera tudo pra uma tentativa nova: contadores, cronômetro, tela bloqueada. */
  function resetForNewAttempt() {
    if (timerIntervalId) {
      clearInterval(timerIntervalId);
      timerIntervalId = null;
    }
    testState = "idle";
    startTimestamp = 0;

    previousValue = "";
    correctKeystrokes = 0;
    incorrectKeystrokes = 0;
    typingInput.value = "";
    typingInput.disabled = false;

    updateAccuracyDisplay();
    wpmEl.textContent = "0";
    renderInitialTime();
    statsAnnouncerEl.textContent = "";
    lastStatsAnnounceAt = 0;
    lockPassage();
  }

  // ---------------------------------------------------------------------
  // Início do teste: desbloqueia a passagem e joga o foco pro input oculto.
  // Clicar no botão "Iniciar" começa o cronômetro na hora; clicar só no
  // texto apenas foca — o cronômetro começa na primeira tecla digitada.
  // ---------------------------------------------------------------------

  function lockPassage() {
    passageEl.classList.add("is-locked");
    startOverlay.hidden = false;
    testRestart.hidden = true;
  }

  function unlockPassage(startImmediately) {
    passageEl.classList.remove("is-locked");
    startOverlay.hidden = true;
    testRestart.hidden = false;
    typingInput.focus();
    if (startImmediately) startTest();
  }

  startButton.addEventListener("click", () => unlockPassage(true));
  passageEl.addEventListener("click", () => unlockPassage(false));

  // "Reiniciar Teste" fica visível durante o teste (ver lockPassage/unlockPassage
  // acima) e sorteia um novo trecho da mesma dificuldade, a qualquer momento.
  // Diferente de trocar a dificuldade: aqui o trecho já vem desbloqueado e
  // pronto pra digitar na hora, sem precisar clicar em "Iniciar" de novo.
  testRestartButton.addEventListener("click", () => {
    showRandomPassage(getSelectedDifficulty())
      .then(() => unlockPassage(false))
      .catch((error) => console.error(error));
  });

  // A passagem é focável (tabindex="0"); Enter/Espaço reproduzem o comportamento de clique
  passageEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      unlockPassage(false);
    }
  });

  // ---------------------------------------------------------------------
  // Dropdowns de dificuldade/modo
  // ---------------------------------------------------------------------

  const dropdowns = Array.from(document.querySelectorAll("[data-dropdown]"));

  /** Fecha todos os dropdowns, exceto o passado em `exceptEl` (se houver). */
  function closeAllDropdowns(exceptEl) {
    dropdowns.forEach((dropdown) => {
      if (dropdown === exceptEl) return;
      dropdown.classList.remove("is-open");
      dropdown.querySelector(".dropdown-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector(".dropdown-trigger");
    const triggerLabel = dropdown.querySelector(".dropdown-trigger-label");
    const radiogroup = dropdown.querySelector('[role="radiogroup"]');
    const options = Array.from(dropdown.querySelectorAll(".segmented-option"));

    trigger.addEventListener("click", () => {
      const willOpen = !dropdown.classList.contains("is-open");
      closeAllDropdowns();
      dropdown.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    /** Marca `option` como selecionada do grupo (comportamento de rádio: só
     *  uma por vez) e aplica "roving tabindex" — só ela fica no fluxo do Tab,
     *  as demais só são alcançáveis pelas setas (padrão WAI-ARIA de radiogroup). */
    function selectOption(option, { moveFocus = false } = {}) {
      options.forEach((opt) => {
        const isSelected = opt === option;
        opt.classList.toggle("is-selected", isSelected);
        opt.setAttribute("aria-checked", String(isSelected));
        opt.tabIndex = isSelected ? 0 : -1;
      });

      if (triggerLabel) {
        triggerLabel.textContent = option.textContent;
      }

      if (moveFocus) {
        // Navegação por teclado: mantém o menu aberto enquanto o usuário
        // percorre as opções com as setas, igual um <select> nativo.
        option.focus();
      } else {
        dropdown.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      }

      // Trocar a dificuldade sorteia um novo trecho compatível com ela;
      // trocar o modo mantém o trecho mas reinicia o cronômetro/contadores
      if (option.dataset.difficulty) {
        showRandomPassage(option.dataset.difficulty).catch((error) => console.error(error));
      } else if (option.dataset.mode) {
        resetForNewAttempt();
      }
    }

    options.forEach((option) => {
      option.addEventListener("click", () => selectOption(option));
    });

    // Setas movem o foco E a seleção entre as opções do grupo, replicando o
    // comportamento nativo de radio buttons; Home/End pulam pra primeira/última.
    radiogroup.addEventListener("keydown", (event) => {
      const currentIndex = options.indexOf(document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = options.length - 1;
      }

      if (nextIndex === null) return;
      event.preventDefault();
      selectOption(options[nextIndex], { moveFocus: true });
    });
  });

  // Clique fora de qualquer dropdown aberto fecha todos
  document.addEventListener("click", (event) => {
    const clickedInsideDropdown = dropdowns.some((dropdown) => dropdown.contains(event.target));
    if (!clickedInsideDropdown) closeAllDropdowns();
  });

  // Esc fecha o dropdown aberto e devolve o foco pro botão que o abriu
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openDropdown = dropdowns.find((dropdown) => dropdown.classList.contains("is-open"));
    if (!openDropdown) return;
    closeAllDropdowns();
    openDropdown.querySelector(".dropdown-trigger")?.focus();
  });
})();
