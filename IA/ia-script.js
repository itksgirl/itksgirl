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
  sendButton.disabled = userInput.value.trim() === "";
}

userInput.addEventListener("input", atualizarBotaoEnviar);

// Enter envia
// Shift + Enter quebra linha
userInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

// =========================
// CRIAR MENSAGEM
// =========================

function criarMensagem(nome, texto, tipo) {
  const message = document.createElement("div");
  message.classList.add("message", tipo);

  const messageName = document.createElement("span");
  messageName.classList.add("message-name");
  messageName.textContent = nome;

  const messageText = document.createElement("p");
  messageText.textContent = texto;

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
// NOVA CONVERSA
// =========================

function iniciarNovaConversa() {
  chatMessages.innerHTML = "";

  userInput.value = "";

  atualizarBotaoEnviar();

  mostrarMensagemInicial();

  fecharSidebar();

  userInput.focus();
}

if (newChatButton) {
  newChatButton.addEventListener("click", iniciarNovaConversa);
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

async function buscarRespostaNaIA(pergunta) {
  const response = await fetch("/api/chat", {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      pergunta
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.erro || "Não foi possível obter uma resposta."
    );
  }

  return data.resposta;
}

// =========================
// BOTÕES DE SUGESTÃO
// =========================

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;

    atualizarBotaoEnviar();

    userInput.focus();
  });
});

// =========================
// ENVIO DA MENSAGEM
// =========================

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pergunta = userInput.value.trim();

  if (!pergunta) return;

  criarMensagem(
    "Você",
    pergunta,
    "user-message"
  );

  userInput.value = "";

  atualizarBotaoEnviar();

  const mensagemDeAnalise = mostrarAnalise();

  try {
    const resposta = await buscarRespostaNaIA(pergunta);

    mensagemDeAnalise.remove();

    criarMensagem(
      "ITKs AI",
      resposta,
      "ai-message"
    );
  } catch (erro) {
    mensagemDeAnalise.remove();

    criarMensagem(
      "ITKs AI",
      "Ainda não consegui acessar meu cérebro. Verifique a conexão do servidor e tente novamente.",
      "ai-message"
    );

    console.error(erro);
  } finally {
    atualizarBotaoEnviar();

    userInput.focus();
  }
});

// =========================
// ESTADO INICIAL
// =========================

atualizarBotaoEnviar();