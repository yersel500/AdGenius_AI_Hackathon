from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Optional, List
from dotenv import load_dotenv
import os
import base64
import aiohttp
import uuid
import json

import fastapi
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import logfire
from fastapi.responses import HTMLResponse, Response, StreamingResponse, JSONResponse
from pydantic import Field, TypeAdapter, BaseModel
import requests

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    Message,
    MessagesTypeAdapter,
    ModelTextResponse,
    UserPrompt,
)

load_dotenv()
DALLE_API_KEY = os.getenv("OPENAI_API_KEY", "")
news_key = os.getenv("NEWS_API_KEY")

logfire.configure(send_to_logfire="if-token-present")

# News Setup
url = "https://newsapi.org/v2/top-headlines"
params = {"country": "us", "apiKey": news_key}

response = requests.get(url, params=params)
news_data = response.json()

if news_data["status"] == "ok":
    articles = news_data["articles"]
else:
    print("Error:", news_data["message"])


# User preferences model
class UserPreferences(BaseModel):
    social_networks: List[str] = Field(default_factory=list)
    tone: str = "normal"


# Enable CORS
app = fastapi.FastAPI()
origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="."), name="static")
logfire.instrument_fastapi(app)


@dataclass
class MyDeps:
    text_agent: Agent[None, str]
    image_agent: Agent[None, str]


agent = Agent(
    "openai:gpt-4o",
    deps_type=MyDeps,
    system_prompt=(
        "You are only limited to generate responses about news "
        "or generate images. "
        "If user ask about another topic, only mentions you only focus in provide news and you are not able to respond question about other topics. "
        "In the news, always at the end provide also the url of the image: urlToImage"
        'If the user includes "/image" in their message '
        "Just answer you are generating the image "
        'Use the "image_reply" if user ask to generate images. '
        'Otherwise, use "text_reply"'
    ),
)

text_agent = Agent("groq:llama-3.3-70b-versatile")
image_agent = Agent(
    "groq:llama-3.3-70b-versatile",
    system_prompt=(
        "Refactor the user prompt to obtain the best possible image. Just give 1 option and be concise"
    ),
)


@agent.system_prompt
def add_news():
    return f" You have the following news: {articles}. Your reply will be based on this news"


@agent.tool
async def image_reply(ctx: RunContext[MyDeps], prompt: str):
    r = await ctx.deps.image_agent.run(prompt)
    print(r.data)
    request = ImageGenerationRequest(prompt=r.data, n=1, size="1024x1024")
    response = await generate_image(request)
    data = json.loads(response.body.decode())

    if data["success"]:
        return data["image_url"]
    else:
        raise Exception("Image generation failed")


class ImageMessage(BaseModel):
    role: str = "assistant"
    content: str
    timestamp: str
    image_url: str
    image_id: str


class ImageGenerationRequest(BaseModel):
    prompt: str
    n: int = 1
    size: str = "1024x1024"


class ImageVariationRequest(BaseModel):
    image_id: str
    n: int = 1
    size: str = "1024x1024"


async def generate_dalle_image(
    prompt: str, n: int = 1, size: str = "1024x1024"
) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {DALLE_API_KEY}"},
            json={"prompt": prompt, "n": n, "size": size},
        ) as response:
            return await response.json()


async def create_image_variation(
    image_path: str, n: int = 1, size: str = "1024x1024"
) -> dict:
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        data.add_field("image", open(image_path, "rb"))
        data.add_field("n", str(n))
        data.add_field("size", size)

        async with session.post(
            "https://api.openai.com/v1/images/variations",
            headers={"Authorization": f"Bearer {DALLE_API_KEY}"},
            data=data,
        ) as response:
            return await response.json()


@app.get("/")
async def index() -> HTMLResponse:
    return HTMLResponse((THIS_DIR / "chat_app.html").read_bytes())


@app.get("/chat_app.ts")
async def main_ts() -> Response:
    return Response((THIS_DIR / "chat_app.ts").read_bytes(), media_type="text/plain")


@app.get("/chat/")
async def get_chat() -> Response:
    msgs = database.get_messages()
    return Response(
        b"\n".join(MessageTypeAdapter.dump_json(m) for m in msgs),
        media_type="text/plain",
    )


@app.post("/generate-image/")
async def generate_image(request: ImageGenerationRequest) -> JSONResponse:
    result = await generate_dalle_image(request.prompt, request.n, request.size)
    if "data" in result:
        image_id = str(uuid.uuid4())
        image_url = result["data"][0]["url"]

        image_message = ImageMessage(
            content=request.prompt,
            timestamp=str(uuid.uuid4()),
            image_url=image_url,
            image_id=image_id,
        )
        database.add_image(image_message)

        return JSONResponse(
            {"success": True, "image_url": image_url, "image_id": image_id}
        )
    return JSONResponse({"success": False, "error": "Failed to generate image"})


@app.post("/generate-variation/")
async def generate_variation(request: ImageVariationRequest) -> JSONResponse:
    original_image = database.get_image_by_id(request.image_id)
    if not original_image:
        return JSONResponse({"success": False, "error": "Original image not found"})

    async with aiohttp.ClientSession() as session:
        async with session.get(original_image.image_url) as response:
            if response.status == 200:
                image_path = THIS_DIR / f"temp_{request.image_id}.png"
                with open(image_path, "wb") as f:
                    f.write(await response.read())

                try:
                    result = await create_image_variation(
                        str(image_path), request.n, request.size
                    )
                    if "data" in result:
                        new_image_id = str(uuid.uuid4())
                        image_url = result["data"][0]["url"]

                        image_message = ImageMessage(
                            content=f"Variation of {original_image.content}",
                            timestamp=str(uuid.uuid4()),
                            image_url=image_url,
                            image_id=new_image_id,
                        )
                        database.add_image(image_message)

                        return JSONResponse(
                            {
                                "success": True,
                                "image_url": image_url,
                                "image_id": new_image_id,
                            }
                        )
                finally:
                    if image_path.exists():
                        image_path.unlink()

    return JSONResponse({"success": False, "error": "Failed to generate variation"})


@app.post("/chat/")
async def post_chat(
    prompt: Annotated[str, fastapi.Form()],
    social_networks: Annotated[str, fastapi.Form()] = "[]",
    tone: Annotated[str, fastapi.Form()] = "normal",
) -> StreamingResponse:
    # Parse the preferences
    networks = json.loads(social_networks)
    user_preferences = UserPreferences(social_networks=networks, tone=tone)

    final_prompt = f"{prompt}. The post is oriented to be posted in {user_preferences.social_networks} and the tone should be {user_preferences.tone}"

    # Store preferences for future use (not implemented in logic yet)
    print(f"Selected networks: {user_preferences.social_networks}")
    print(f"Selected tone: {user_preferences.tone}")
    print(f"Final prompt: {final_prompt}")

    async def stream_messages():
        yield MessageTypeAdapter.dump_json(UserPrompt(content=final_prompt)) + b"\n"
        messages = list(database.get_messages())
        async with agent.run_stream(
            prompt, message_history=messages, deps=MyDeps(text_agent, image_agent)
        ) as result:
            async for text in result.stream(debounce_by=0.01):
                m = ModelTextResponse(content=text, timestamp=result.timestamp())
                yield MessageTypeAdapter.dump_json(m) + b"\n"
        database.add_messages(result.new_messages_json())

    return StreamingResponse(stream_messages(), media_type="text/plain")


THIS_DIR = Path(__file__).parent
MessageTypeAdapter: TypeAdapter[Message] = TypeAdapter(
    Annotated[Message, Field(discriminator="role")]
)


@dataclass
class Database:
    file: Path = THIS_DIR / ".chat_app_messages.jsonl"
    images_file: Path = THIS_DIR / ".chat_app_images.jsonl"

    def add_messages(self, messages: bytes):
        with self.file.open("ab") as f:
            f.write(messages + b"\n")

    def get_messages(self) -> Iterator[Message]:
        if self.file.exists():
            with self.file.open("rb") as f:
                for line in f:
                    if line:
                        yield from MessagesTypeAdapter.validate_json(line)

    def add_image(self, image_message: ImageMessage):
        with self.images_file.open("a") as f:
            f.write(image_message.model_dump_json() + "\n")

    def get_image_by_id(self, image_id: str) -> Optional[ImageMessage]:
        if self.images_file.exists():
            with self.images_file.open() as f:
                for line in f:
                    if line:
                        image = ImageMessage.model_validate_json(line)
                        if image.image_id == image_id:
                            return image
        return None


database = Database()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("chat_app:app", reload=True, reload_dirs=[str(THIS_DIR)])
