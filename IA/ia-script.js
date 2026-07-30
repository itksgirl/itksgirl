import { supabase } from "./supabase-config.js";

const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");
const suggestionButtons = document.querySelectorAll(
  ".suggestion-button"
);

// Elementos da barra lateral
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const menuClose = document.getElementById("menu-close");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const newChatButton = document.getElementById("new-chat");

const LIMITE_PERGUNTA = 4000;
const LIMITE_MENSAGENS_HISTORICO = 20;
const LIMITE_TOTAL_HISTORICO = 12000;
const TEMPO_MAXIMO_REQUISICAO = 60000;

let requisicaoEmAndamento = false;
let historicoDaConversa = [];

// =========================
// VERIFICAÇÃO DOS ELEMENTOS
// =========================

if (
  !chatForm ||
  !userInput ||
  !chatMessages ||
  !sendButton
) {
  throw new Error(
    "A interface da ITKs AI não foi carregada corretamente."
  );
}

// =========================
// BARRA LATERAL
// =========================

function abrirSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.add("open");
  sidebarOverlay.classList.add("active");

  document.body.style.overflow = "hidden";
}

function fecharSidebar() {
  if (!sidebar || !sidebarOverlay) return;

  sidebar.classList.remove("open");
  sidebarOverlay.classList.remove("active");

  document.body.style.overflow = "";
}

if (menuButton) {
  menuButton.addEventListener("click", abrirSidebar);
}

if (menuClose) {
  menuClose.addEventListener("click", fecharSidebar);
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", fecharSidebar);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    fecharSidebar();
  }
});

// =========================
// BOTÃO ENVIAR
// =========================

function atualizarBotaoEnviar() {
  const pergunta = userInput.value.trim();

  sendButton.disabled =
    pergunta.length === 0 ||
    pergunta.length > LIMITE_PERGUNTA ||
    requisicaoEmAndamento;
}

userInput.addEventListener("input", atualizarBotaoEnviar);

// Enter envia.
// Shift + Enter cria uma nova linha.
userInput.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey &&
    !requisicaoEmAndamento
  ) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

// =========================
// MARKDOWN SEGURO
// =========================

function criarHtmlSeguro(texto) {
  const markedDisponivel =
    typeof window.marked !== "undefined" &&
    typeof window.marked.parse === "function";

  const domPurifyDisponivel =
    typeof window.DOMPurify !== "undefined" &&
    typeof window.DOMPurify.sanitize === "function";

  if (!markedDisponivel || !domPurifyDisponivel) {
    return null;
  }

  const htmlGerado = window.marked.parse(texto, {
    gfm: true,
    breaks: true
  });

  return window.DOMPurify.sanitize(htmlGerado, {
    USE_PROFILES: {
      html: true
    },

    FORBID_TAGS: [
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "video",
      "audio"
    ],

    FORBID_ATTR: [
      "style",
      "srcdoc",
      "formaction"
    ]
  });
}

// =========================
// DESTAQUE DOS CÓDIGOS
// =========================

function destacarBlocosDeCodigo(elemento) {
  const highlightDisponivel =
    typeof window.hljs !== "undefined" &&
    typeof window.hljs.highlightElement === "function";

  if (!highlightDisponivel) return;

  elemento
    .querySelectorAll("pre code")
    .forEach((bloco) => {
      window.hljs.highlightElement(bloco);
    });
}

// =========================
// CRIAR MENSAGEM
// =========================

function criarMensagem(nome, texto, tipo) {
  const message = document.createElement("div");
  message.classList.add("message", tipo);

  const messageName = document.createElement("span");
  messageName.classList.add("message-name");
  messageName.textContent = nome;

  const messageText = document.createElement("div");
  messageText.classList.add("message-text");

  const textoSeguro =
    typeof texto === "string"
      ? texto
      : "Não foi possível exibir esta mensagem.";

  const deveRenderizarMarkdown =
    tipo === "ai-message";

  if (deveRenderizarMarkdown) {
    const htmlSeguro = criarHtmlSeguro(textoSeguro);

    if (htmlSeguro !== null) {
      messageText.innerHTML = htmlSeguro;
      destacarBlocosDeCodigo(messageText);
    } else {
      messageText.textContent = textoSeguro;
    }
  } else {
    /*
      Mensagens da pessoa usuária e de carregamento
      são sempre tratadas como texto puro.
    */
    messageText.textContent = textoSeguro;
  }

  message.appendChild(messageName);
  message.appendChild(messageText);

  chatMessages.appendChild(message);

  message.scrollIntoView({
    behavior: "smooth",
    block: "end"
  });

  return message;
}

// =========================
// MENSAGEM INICIAL
// =========================

function mostrarMensagemInicial() {
  criarMensagem(
    "ITKs AI",
    "Olá! Eu sou uma assistente especializada em programação. Envie uma dúvida ou cole um código para começarmos.",
    "ai-message"
  );
}

// =========================
// CONTROLE DO HISTÓRICO
// =========================

function calcularTotalCaracteres(historico) {
  return historico.reduce((total, mensagem) => {
    return total + mensagem.content.length;
  }, 0);
}

function limitarHistorico(historico) {
  const historicoLimitado = historico
    .slice(-LIMITE_MENSAGENS_HISTORICO);

  /*
    Remove mensagens antigas em pares:
    uma mensagem da pessoa e uma resposta da IA.
  */
  while (
    calcularTotalCaracteres(historicoLimitado) >
      LIMITE_TOTAL_HISTORICO &&
    historicoLimitado.length >= 2
  ) {
    historicoLimitado.splice(0, 2);
  }

  return historicoLimitado;
}

function registrarInteracao(pergunta, resposta) {
  historicoDaConversa.push(
    {
      role: "user",
      content: pergunta
    },
    {
      role: "assistant",
      content: resposta
    }
  );

  historicoDaConversa = limitarHistorico(
    historicoDaConversa
  );
}

// =========================
// NOVA CONVERSA
// =========================

function iniciarNovaConversa() {
  if (requisicaoEmAndamento) return;

  historicoDaConversa = [];

  /*
    Apaga somente os elementos já existentes.
    Nenhum conteúdo externo é inserido com innerHTML.
  */
  chatMessages.replaceChildren();

  userInput.value = "";

  atualizarBotaoEnviar();
  mostrarMensagemInicial();
  fecharSidebar();

  userInput.focus();
}

if (newChatButton) {
  newChatButton.addEventListener(
    "click",
    iniciarNovaConversa
  );
}

// =========================
// MENSAGEM DE ESPERA
// =========================

function mostrarAnalise() {
  return criarMensagem(
    "ITKs AI",
    "ITKs AI está analisando...",
    "loading-message"
  );
}

// =========================
// CONSULTA À IA
// =========================

async function buscarRespostaNaIA(
  pergunta,
  historico
) {
  const controller = new AbortController();

  const temporizador = setTimeout(() => {
    controller.abort();
  }, TEMPO_MAXIMO_REQUISICAO);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },

      body: JSON.stringify({
        pergunta,
        historico
      }),

      signal: controller.signal,
      credentials: "same-origin"
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        "O servidor retornou uma resposta inválida."
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.erro === "string"
          ? data.erro
          : "Não foi possível obter uma resposta."
      );
    }

    if (
      typeof data?.resposta !== "string" ||
      data.resposta.trim().length === 0
    ) {
      throw new Error(
        "A IA retornou uma resposta vazia."
      );
    }

    return data.resposta.trim();
  } finally {
    clearTimeout(temporizador);
  }
}

// =========================
// BOTÕES DE SUGESTÃO
// =========================

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (requisicaoEmAndamento) return;

    const perguntaSugerida =
      button.dataset.question?.trim();

    if (!perguntaSugerida) return;

    userInput.value = perguntaSugerida.slice(
      0,
      LIMITE_PERGUNTA
    );

    atualizarBotaoEnviar();

    /*
      O botão agora envia a pergunta,
      em vez de apenas preencher o campo.
    */
    chatForm.requestSubmit();
  });
});

// =========================
// ENVIO DA MENSAGEM
// =========================

chatForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (requisicaoEmAndamento) return;

    const pergunta = userInput.value.trim();

    if (!pergunta) return;

    if (pergunta.length > LIMITE_PERGUNTA) {
      criarMensagem(
        "ITKs AI",
        `A pergunta pode ter no máximo ${LIMITE_PERGUNTA} caracteres.`,
        "ai-message"
      );

      return;
    }

    requisicaoEmAndamento = true;
    atualizarBotaoEnviar();

    criarMensagem(
      "Você",
      pergunta,
      "user-message"
    );

    userInput.value = "";

    const mensagemDeAnalise = mostrarAnalise();

    try {
      /*
        Envia somente as mensagens anteriores.
        A pergunta atual é adicionada pelo backend.
      */
      const resposta = await buscarRespostaNaIA(
        pergunta,
        historicoDaConversa
      );

      mensagemDeAnalise.remove();

      criarMensagem(
        "ITKs AI",
        resposta,
        "ai-message"
      );

      registrarInteracao(
        pergunta,
        resposta
      );
    } catch (erro) {
      mensagemDeAnalise.remove();

      const requisicaoExpirou =
        erro instanceof DOMException &&
        erro.name === "AbortError";

      const mensagemDeErro = requisicaoExpirou
        ? "A resposta demorou mais do que o esperado. Aguarde um pouco e tente novamente."
        : "Ainda não consegui acessar meu cérebro. Verifique a conexão do servidor e tente novamente.";

      criarMensagem(
        "ITKs AI",
        mensagemDeErro,
        "ai-message"
      );

      /*
        Não exibe detalhes internos no navegador.
      */
      console.error(
        "Falha ao obter resposta da ITKs AI."
      );
    } finally {
      requisicaoEmAndamento = false;

      atualizarBotaoEnviar();
      userInput.focus();
    }
  }
);

// =========================
// ESTADO INICIAL
// =========================

atualizarBotaoEnviar();