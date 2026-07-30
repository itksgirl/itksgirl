const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");
const suggestionButtons = document.querySelectorAll(".suggestion-button");

// Elementos da barra lateral
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const menuClose = document.getElementById("menu-close");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const newChatButton = document.getElementById("new-chat");

const LIMITE_PERGUNTA = 4000;
const TEMPO_MAXIMO_REQUISICAO = 60000;

let requisicaoEmAndamento = false;
let historicoMensagens = [];

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

    // Impede elementos desnecessários ou perigosos.
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

    // Impede atributos capazes de executar ações perigosas.
    FORBID_ATTR: [
      "style",
      "srcdoc",
      "formaction"
    ]
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
     
      messageText.querySelectorAll("pre code").forEach((bloco) => {
  hljs.highlightElement(bloco);
});
    } else {
      /*
        Se Marked ou DOMPurify não carregarem,
        a mensagem aparece como texto comum.
        Assim, nenhum HTML é executado.
      */
      messageText.textContent = textoSeguro;
    }
  } else {
    /*
      Mensagens do usuário e mensagens de carregamento
      nunca são inseridas como HTML.
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
    `Olá! 👋 Eu sou a **ITKs AI**.

💻 Posso ajudar com programação, desenvolvimento web, tecnologia e inteligência artificial.

Digite sua dúvida ou cole seu código para começarmos.`,
    "ai-message"
  );
}

// =========================
// NOVA CONVERSA
// =========================

function iniciarNovaConversa() {
  if (requisicaoEmAndamento) return;
  historicoDaConversa = [];
 /*
    innerHTML é usado apenas para apagar elementos
    já existentes, e não para inserir conteúdo do usuário.
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

async function buscarRespostaNaIA(pergunta, historico) {
  const controller = new AbortController();

  const temporizador = setTimeout(() => {
    controller.abort();
  }, TEMPO_MAXIMO_REQUISICAO);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },

      body: JSON.stringify({
        pergunta,
        historico
      }),

      signal: controller.signal,

      /*
        Como futuramente poderá existir login,
        mantém cookies restritos ao mesmo site.
      */
      credentials: "same-origin"
    });

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error("Resposta inválida do servidor.");
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
      throw new Error("A IA retornou uma resposta vazia.");
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
    const perguntaSugerida =
      button.dataset.question?.trim();

    if (!perguntaSugerida) return;

    userInput.value = perguntaSugerida.slice(
      0,
      LIMITE_PERGUNTA
    );

    atualizarBotaoEnviar();
    userInput.focus();
  });
});

// =========================
// ENVIO DA MENSAGEM
// =========================

chatForm.addEventListener("submit", async (event) => {
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
    const resposta = await buscarRespostaNaIA(pergunta, historicoDaConversa);

    mensagemDeAnalise.remove();

    criarMensagem(
      "ITKs AI",
      resposta,
      "ai-message"
    );
    
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
      Não exibimos detalhes internos do erro
      no console público do navegador.
    */
    console.error(
      "Falha ao obter resposta da ITKs AI."
    );
  } finally {
    requisicaoEmAndamento = false;

    atualizarBotaoEnviar();
    userInput.focus();
  }
});

// =========================
// ESTADO INICIAL
// =========================

atualizarBotaoEnviar();