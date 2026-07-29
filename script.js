const button = document.getElementById("ks-ai-send");
const input = document.getElementById("ks-ai-input");
const messages = document.getElementById("ks-ai-messages");

button.addEventListener("click", async () => {
  const message = input.value;

  if (!message) return;

  messages.innerHTML += `<br><b>Você:</b> ${message}`;
  input.value = "";

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: message
    })
  });

  const data = await response.json();

  messages.innerHTML += `<br><b>IA:</b> ${data.reply}`;
});