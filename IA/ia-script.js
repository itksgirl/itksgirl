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

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    userInput.value = button.dataset.question;
    userInput.focus();
  });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const pergunta = userInput.value.trim();

  if (pergunta === "") {
    return;
  }

  criarMensagem("Você", pergunta, "user-message");

  userInput.value = "";
  sendButton.disabled = true;

  const mensagemDeAnalise = mostrarAnalise();

  setTimeout(() => {
    mensagemDeAnalise.remove();

    criarMensagem(
      "ITKs AI",
      "A interface está funcionando perfeitamente. Na próxima etapa, conectaremos meu cérebro à API para que eu responda perguntas reais de programação.",
      "ai-message"
    );

    sendButton.disabled = false;
    userInput.focus();
  }, 1800);
});