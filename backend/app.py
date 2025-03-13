import asyncio
import os
import json
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from pydub import AudioSegment
import edge_tts
import re
import time
from io import BytesIO
from dotenv import load_dotenv
import uvicorn
from fastapi.staticfiles import StaticFiles
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('tts_server')

load_dotenv()

app = FastAPI()
app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def preprocess_text(text):    
    text = re.sub(r'\bunk\b', '', text)
    return text

def gemini_text_generator(query: str):
    # Start timing when Gemini receives the query
    start_time = time.time()
    
    client = genai.Client(api_key=os.getenv('GOOGLE_API_KEY'), vertexai=False)
    chat = client.chats.create(model="gemini-2.0-flash-001")
    
    pattern = re.compile(r'[.!?:]\s*')
    
    preprocess_query = preprocess_text(query)
    
    buffer = ""
    first_chunk_received = False
    
    for chunk in chat.send_message_stream(preprocess_query):
        if not first_chunk_received:
            first_chunk_time = time.time()
            elapsed_time = first_chunk_time - start_time
            first_chunk_received = True
            logging.info(f"Time to generate first text chunk: {elapsed_time:.3f} seconds")
        
        clean_text = chunk.text.replace("*", "")
        buffer += clean_text
        
        while True:
            match = pattern.search(buffer)
            
            if match:
                sentence = buffer[:match.end()].strip()
                yield sentence
                buffer = buffer[match.end():]
            else:
                break
    
    if buffer.strip():
        yield buffer.strip()

async def text_to_speech_stream(query: str):
    voice = "vi-VN-HoaiMyNeural"
    
    # Start timing for voice generation
    voice_start_time = time.time()
    
    first_audio_sent = False
    
    gen_text = gemini_text_generator(query)
    
    for sentence in gen_text:
        if not sentence or not sentence.strip():
            continue
        
        communicate = edge_tts.Communicate(sentence, voice)
        audio_data = bytearray()
        
        async for tts_chunk in communicate.stream():
            if tts_chunk["type"] == "audio":
                audio_data.extend(tts_chunk["data"])
        
        audio_segment = AudioSegment.from_mp3(BytesIO(audio_data))
        duration_seconds = len(audio_segment) / 1000.0
        
        # Log only for the first sentence
        if not first_audio_sent:
            first_audio_time = time.time()
            elapsed_time = first_audio_time - voice_start_time
            first_audio_sent = True
            logging.info(f"Time to generate first voice chunk: {elapsed_time:.3f} seconds")
        
        # Calculate sleep time
        processing_time = time.time() - first_audio_time if first_audio_sent else 0
        sleep_time = max(0, duration_seconds - processing_time)
        
        # Send the data
        data = {
            "text": sentence,
            "audio": audio_data.hex(),
            "duration": sleep_time
        }
        yield f"event: ttsUpdate\ndata: {json.dumps(data)}\n\n"
        
        # Sleep to simulate real-time audio playback
        await asyncio.sleep(sleep_time)

@app.get("/stream-tts")
async def stream_tts(query: str = Query(..., description="The query to process")):
    return StreamingResponse(text_to_speech_stream(query), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)