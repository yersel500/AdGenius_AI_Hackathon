import {marked} from "https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.0/lib/marked.esm.js";

interface Message {
  role: string;
  content: string;
  timestamp: string;
  image_url?: string;
  image_id?: string;
}

interface UserPreferences {
  socialNetworks: string[];
  tone: string;
}

const convElement = document.getElementById("conversation");
const promptInput = document.getElementById("prompt-input") as HTMLInputElement;
const spinner = document.getElementById("spinner");

// Track displayed messages for initial load only
const initialLoadMessages = new Set<string>();
let isInitialLoad = true;

// Track user preferences
let selectedSocialNetworks: string[] = [];
let selectedTone: string = "normal";

function initializeControls() {
  // Handle social network checkboxes
  document.querySelectorAll('input[name="social_networks"]').forEach((checkbox: HTMLInputElement) => {
    checkbox.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        selectedSocialNetworks.push(target.value);
      } else {
        selectedSocialNetworks = selectedSocialNetworks.filter((network) => network !== target.value);
      }
    });
  });

  // Handle tone buttons
  document.querySelectorAll(".tone-btn").forEach((button: HTMLButtonElement) => {
    button.addEventListener("click", (e) => {
      const target = e.target as HTMLButtonElement;
      document.querySelectorAll(".tone-btn").forEach((btn) => btn.classList.remove("active"));
      target.classList.add("active");
      selectedTone = target.dataset.tone || "normal";
    });
  });
}

async function onFetchResponse(response: Response): Promise<void> {
  let decoder = new TextDecoder();
  if (response.ok) {
    const reader = response.body.getReader();
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      const text = decoder.decode(value);
      addMessages(text);
      spinner.classList.remove("active");
    }
    promptInput.disabled = false;
    promptInput.focus();
  } else {
    const text = await response.text();
    console.error(`Unexpected response: ${response.status}`, {response, text});
    throw new Error(`Unexpected response: ${response.status}`);
  }
}

function tryParseMessage(line: string): Message | null {
  try {
    return JSON.parse(line);
  } catch (e) {
    return null;
  }
}

function addMessages(responseText: string) {
  const lines = responseText.split("\n");

  for (const line of lines) {
    if (line.length <= 1) continue;

    const message = tryParseMessage(line);
    if (!message) continue;

    const {timestamp, role, content, image_url, image_id} = message;
    const id = `msg-${timestamp}`;

    // Skip if we've already displayed this message during initial load
    if (isInitialLoad && initialLoadMessages.has(id)) {
      continue;
    }

    if (image_url && image_id) {
      addImageMessage(message);
      if (isInitialLoad) {
        initialLoadMessages.add(id);
      }
      continue;
    }

    let msgDiv = document.getElementById(id);
    if (!msgDiv) {
      msgDiv = document.createElement("div");
      msgDiv.id = id;
      msgDiv.title = `${role} at ${timestamp}`;
      msgDiv.classList.add("border-top", "pt-2", role);
      if (role === "user") {
        msgDiv.classList.add("user");
      } else if (role === "assistant") {
        msgDiv.classList.add("llm-response");
      }
      convElement.appendChild(msgDiv);
    }

    msgDiv.innerHTML = marked.parse(content);
    if (isInitialLoad) {
      initialLoadMessages.add(id);
    }
  }

  window.scrollTo({top: document.body.scrollHeight, behavior: "smooth"});
}

function addImageMessage(message: Message) {
  const {timestamp, content, image_url, image_id} = message;
  const id = `msg-${timestamp}`;

  let msgDiv = document.getElementById(id);
  if (!msgDiv) {
    msgDiv = document.createElement("div");
    msgDiv.id = id;
    msgDiv.classList.add("border-top", "pt-2", "assistant-image");
    convElement.appendChild(msgDiv);

    const img = document.createElement("img");
    img.src = image_url;
    img.alt = content;
    img.classList.add("generated-image");

    const controls = document.createElement("div");
    controls.classList.add("image-controls");

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.classList.add("btn", "btn-primary", "me-2");
    downloadBtn.onclick = () => downloadImage(image_url, `image-${image_id}.png`);

    const variationBtn = document.createElement("button");
    variationBtn.textContent = "Generate Variation";
    variationBtn.classList.add("btn", "btn-secondary");
    variationBtn.onclick = () => generateVariation(image_id);

    controls.appendChild(downloadBtn);
    controls.appendChild(variationBtn);

    msgDiv.appendChild(img);
    msgDiv.appendChild(controls);
  }
}

async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Failed to download image:", error);
  }
}

const baseUrl = "http://localhost:8000";
const chatUrl = `${baseUrl}/chat/`;
const generateVariationUrl = `${baseUrl}/generate-variation/`;
const generateImageUrl = `${baseUrl}/generate-image/`;

async function generateVariation(imageId: string) {
  try {
    const response = await fetch(generateVariationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
        n: 1,
        size: "1024x1024",
      }),
    });

    const result = await response.json();
    if (result.success) {
      addImageMessage({
        role: "assistant",
        content: `Variation of image ${imageId}`,
        timestamp: new Date().toISOString(),
        image_url: result.image_url,
        image_id: result.image_id,
      });
    } else {
      console.error("Failed to generate variation:", result.error);
    }
  } catch (error) {
    console.error("Failed to generate variation:", error);
  }
}

async function onSubmit(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  spinner.classList.add("active");
  const prompt = promptInput.value.trim();

  // Set isInitialLoad to false when submitting new messages
  isInitialLoad = false;

  if (prompt.startsWith("/image ")) {
    const imagePrompt = prompt.slice(7);
    try {
      const response = await fetch(generateImageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      const result = await response.json();
      if (result.success) {
        addImageMessage({
          role: "assistant",
          content: imagePrompt,
          timestamp: new Date().toISOString(),
          image_url: result.image_url,
          image_id: result.image_id,
        });
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
      onError(error);
    } finally {
      spinner.classList.remove("active");
      promptInput.value = "";
      promptInput.disabled = false;
      promptInput.focus();
    }
    return;
  }

  const body = new FormData();
  body.append("prompt", prompt);
  body.append("social_networks", JSON.stringify(selectedSocialNetworks));
  body.append("tone", selectedTone);

  promptInput.value = "";
  promptInput.disabled = true;

  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      body,
    });
    await onFetchResponse(response);
  } catch (error) {
    onError(error);
  }
}

function onError(error: any) {
  console.error(error);
  document.getElementById("error").classList.remove("d-none");
  spinner.classList.remove("active");
}

// Initialize controls and event listeners
initializeControls();
document.querySelector("form").addEventListener("submit", (e) => onSubmit(e).catch(onError));

// Initial load
fetch(chatUrl)
  .then(async (response) => {
    await onFetchResponse(response);
    // Set isInitialLoad to false after initial load completes
    isInitialLoad = false;
  })
  .catch(onError);
