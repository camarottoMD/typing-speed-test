# ⌨️ Typing Speed Test

Teste de velocidade de digitação construído em HTML, CSS e JavaScript puros. Escolha a dificuldade e o modo, digite um trecho de texto e acompanhe WPM, precisão e tempo em tempo real.

> Baseado no desafio [Typing Speed Test](https://www.frontendmentor.io/challenges/typing-speed-test) do Frontend Mentor.

## Status do projeto

- [x] Estrutura base (HTML semântico + CSS com os tokens do design system)
- [x] Layout responsivo (dropdowns no mobile) + estados de hover/focus
- [x] Carregamento das passagens (`data.json`) e seleção de dificuldade/modo
- [x] Motor do teste de digitação (captura de teclas, marcação de acertos/erros, cursor)
- [x] Cronômetro e cálculo de WPM/precisão em tempo real
- [x] Tela de resultados e reinício do teste
- [x] Recorde pessoal persistente (`localStorage`) e animação de confete

## Tecnologias

- HTML5 semântico
- CSS puro (custom properties, Flexbox)
- JavaScript (vanilla, sem frameworks)
- Fonte [Sora](https://fonts.google.com/specimen/Sora), auto-hospedada

## Como rodar localmente

O projeto usa `fetch` para carregar `data.json`, então precisa ser servido por um servidor local (abrir o `index.html` direto pelo `file://` não funciona por causa de CORS).

```bash
# qualquer servidor estático resolve, por exemplo:
npx serve .
# ou a extensão "Live Server" do VS Code
```

## Estrutura de pastas

```
├── index.html
├── data.json           # banco de passagens (fácil/médio/difícil)
├── css/
│   └── style.css
├── js/
│   └── app.js
├── assets/             # ícones, fontes e imagens
└── design/             # mockups de referência
```

## Design

Paleta de cores, tipografia e espaçamentos seguem [`style-guide.md`](./style-guide.md). Os mockups de referência (desktop e mobile) estão em [`/design`](./design).
