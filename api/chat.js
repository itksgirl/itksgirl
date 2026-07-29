export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  try {
    const { pergunta } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você é a IA assistente do site It Ks Girl. Ajude usuários com programação de forma clara e amigável."
          },
          {
            role: "user",
            content: pergunta
          }
        ]
      })
    });

    const data = await response.json();

if (!response.ok) {
  console.log("Resposta completa da OpenAI:", JSON.stringify(data));

  return res.status(500).json({
    erro: JSON.stringify(data)
  });
}

res.status(200).json({
  resposta: data.choices[0].message.content
});

  } catch (error) {
    console.error(error);

    res.status(500).json({
      erro: error.message
    });
  }
}