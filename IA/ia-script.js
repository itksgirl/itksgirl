const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const sendButton = document.getElementById("send-button");
const suggestionButtons = document.querySelectorAll(".suggestion-button");

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

function mostrarAnalise() {
  return criarMensagem(
    "ITKs AI",
    "ITKs AI está analisando seu código...",
    "loading-message"
  );
}

async function buscarRespostaNaIA(pergunta) {
  const response = await fetch("/api/chat", {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      pergunta: pergunta
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

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;
    userInput.focus();
  });
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const pergunta = userInput.value.trim();

  if (pergunta === "") {
    return;
  }

  criarMensagem("Você", pergunta, "user-message");

  userInput.value = "";
  sendButton.disabled = true;

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

    console.error("Erro ao consultar a IA:", erro);
  } finally {
    sendButton.disabled = false;
    userInput.focus();
  }
});