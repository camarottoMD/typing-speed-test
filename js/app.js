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

  const testScreen = document.getElementById("test-screen");
  const resultsScreen = document.getElementById("results-screen");
  const resultsIconEl = document.getElementById("results-icon");
  const resultsTitleEl = document.getElementById("results-title");
  const resultsSubtitleEl = document.getElementById("results-subtitle");
  const resultsWpmEl = document.getElementById("results-wpm");
  const resultsAccuracyEl = document.getElementById("results-accuracy");
  const resultsCharactersEl = document.getElementById("results-characters");
  const restartButton = document.getElementById("restart-button");
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

  let testState = "idle"; // idle -> running -> finished
  let startTimestamp = 0;
  let timerIntervalId = null;

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

    if (mode === "timed" && elapsedSeconds >= TIMED_DURATION_SECONDS) {
      finishTest();
    }
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
    resultsCharactersEl.textContent = `${correctKeystrokes}/${incorrectKeystrokes}`;

    testScreen.hidden = true;
    resultsScreen.hidden = false;
  }

  restartButton.addEventListener("click", () => {
    resultsScreen.hidden = true;
    testScreen.hidden = false;
    showRandomPassage(getSelectedDifficulty()).catch((error) => console.error(error));
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
  }

  function unlockPassage(startImmediately) {
    passageEl.classList.remove("is-locked");
    startOverlay.hidden = true;
    typingInput.focus();
    if (startImmediately) startTest();
  }

  startButton.addEventListener("click", () => unlockPassage(true));
  passageEl.addEventListener("click", () => unlockPassage(false));

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
    const options = Array.from(dropdown.querySelectorAll(".segmented-option"));

    trigger.addEventListener("click", () => {
      const willOpen = !dropdown.classList.contains("is-open");
      closeAllDropdowns();
      dropdown.classList.toggle("is-open", willOpen);
      trigger.setAttribute("aria-expanded", String(willOpen));
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        // Só uma opção do grupo pode estar selecionada por vez (comportamento de rádio)
        options.forEach((opt) => {
          opt.classList.toggle("is-selected", opt === option);
          opt.setAttribute("aria-checked", String(opt === option));
        });

        if (triggerLabel) {
          triggerLabel.textContent = option.textContent;
        }

        dropdown.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");

        // Trocar a dificuldade sorteia um novo trecho compatível com ela;
        // trocar o modo mantém o trecho mas reinicia o cronômetro/contadores
        if (option.dataset.difficulty) {
          showRandomPassage(option.dataset.difficulty).catch((error) => console.error(error));
        } else if (option.dataset.mode) {
          resetForNewAttempt();
        }
      });
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
