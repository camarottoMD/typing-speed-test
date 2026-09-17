// Typing Speed Test — lógica da aplicação
// Módulos até aqui:
//  1. Dropdown (dificuldade/modo) — os mesmos botões (.segmented-option) servem
//     tanto para as pills do desktop quanto para os itens de lista do mobile.
//  2. Passagens — carrega o data.json e sorteia um trecho por dificuldade.

(function () {
  "use strict";

  const passageEl = document.getElementById("passage");

  // ---------------------------------------------------------------------
  // Passagens: carrega data.json uma vez e sorteia um trecho por dificuldade
  // ---------------------------------------------------------------------

  let passagesByDifficulty = null;

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

  async function showRandomPassage(difficulty) {
    await loadPassages();
    const passage = pickRandomPassage(difficulty);
    passageEl.textContent = passage.text;
    passageEl.dataset.passageId = passage.id;
  }

  function getSelectedDifficulty() {
    const selected = document.querySelector("#difficulty-group .segmented-option.is-selected");
    return selected ? selected.dataset.difficulty : "easy";
  }

  // Carrega a primeira passagem assim que o script roda (dificuldade padrão: fácil)
  showRandomPassage(getSelectedDifficulty()).catch((error) => {
    console.error(error);
    passageEl.textContent = "Não foi possível carregar o texto. Recarregue a página.";
  });

  // ---------------------------------------------------------------------
  // Início do teste: desbloqueia a passagem e joga o foco pro input oculto.
  // A lógica de comparar o que foi digitado com a passagem entra na próxima etapa.
  // ---------------------------------------------------------------------

  const startOverlay = document.getElementById("start-overlay");
  const startButton = document.getElementById("start-button");
  const typingInput = document.getElementById("typing-input");

  function unlockPassage() {
    passageEl.classList.remove("is-locked");
    startOverlay.hidden = true;
    typingInput.focus();
  }

  startButton.addEventListener("click", unlockPassage);
  passageEl.addEventListener("click", unlockPassage);

  // A passagem é focável (tabindex="0"); Enter/Espaço reproduzem o comportamento de clique
  passageEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      unlockPassage();
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

        // Trocar a dificuldade sorteia um novo trecho compatível com ela
        if (option.dataset.difficulty) {
          showRandomPassage(option.dataset.difficulty).catch((error) => console.error(error));
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
