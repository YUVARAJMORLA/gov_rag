"""
nova_live_session.py
--------------------
Real-time Bidirectional Live Speech-to-Speech with Amazon Nova 2.5 Sonic.
Uses aws_sdk_bedrock_runtime bidirectional streaming to stream microphone audio
directly to Amazon Nova Sonic and play synthesized speech through speakers in real time.
"""

import os
import asyncio
import base64
import json
import uuid
import time
import threading
import struct
from typing import Optional, Dict, Any, Tuple, List
import boto3
import pyaudio
from dotenv import load_dotenv

load_dotenv()

from aws_sdk_bedrock_runtime.client import (
    AsyncBedrockRuntimeClient,
    InvokeModelWithBidirectionalStreamOperationInput
)
from aws_sdk_bedrock_runtime.models import (
    InvokeModelWithBidirectionalStreamInputChunk,
    BidirectionalInputPayloadPart
)
from aws_sdk_bedrock_runtime.config import AsyncBedrockRuntimeConfig
from smithy_aws_core.identity.environment import EnvironmentCredentialsResolver
from smithy_http.aio.crt import AWSCRTHTTPClient

INPUT_SAMPLE_RATE = 16000
OUTPUT_SAMPLE_RATE = 24000
CHANNELS = 1
FORMAT = pyaudio.paInt16
CHUNK_SIZE = 1024
OUTPUT_CHUNK_SIZE = 2048


def ensure_aws_credentials(default_region="us-east-1"):
    """
    Ensures environment variables are populated for Smithy's EnvironmentCredentialsResolver.
    Reads from .env, environment, or ~/.aws credentials.
    """
    region = os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or default_region
    ak = os.getenv("AWS_ACCESS_KEY_ID")
    sk = os.getenv("AWS_SECRET_ACCESS_KEY")
    st = os.getenv("AWS_SESSION_TOKEN")

    if not ak or not sk:
        try:
            session = boto3.Session()
            creds = session.get_credentials()
            if creds:
                frozen = creds.get_frozen_credentials()
                if frozen.access_key and "AWS_ACCESS_KEY_ID" not in os.environ:
                    os.environ["AWS_ACCESS_KEY_ID"] = frozen.access_key
                if frozen.secret_key and "AWS_SECRET_ACCESS_KEY" not in os.environ:
                    os.environ["AWS_SECRET_ACCESS_KEY"] = frozen.secret_key
                if frozen.token and "AWS_SESSION_TOKEN" not in os.environ:
                    os.environ["AWS_SESSION_TOKEN"] = frozen.token
            region = session.region_name or region
        except Exception as e:
            print(f"[AWS CREDS NOTICE] {e}")

    if "AWS_DEFAULT_REGION" not in os.environ:
        os.environ["AWS_DEFAULT_REGION"] = region
    return region


NOVA_RAG_SYSTEM_PROMPT = (
    "You are an enterprise AI assistant strictly dedicated to Indian government schemes and citizen initiatives.\n"
    "CRITICAL CONSTRAINTS & BEHAVIOR RULES:\n"
    "1. LANGUAGE: You must understand questions asked in both Hindi (e.g. 'पीएम किसान स्कीम', 'विकासित भारत', 'बेटी बचाओ', 'आयुष्मान भारत') and English. "
    "However, YOU MUST ALWAYS DELIVER YOUR SPOKEN AND TEXT RESPONSES ENTIRELY IN ENGLISH. Never output Hindi words or Devanagari script.\n"
    "2. STRICT RAG CONTEXT GROUNDING & ZERO GENERAL KNOWLEDGE REFUSAL:\n"
    "You are strictly restricted to the Indian government schemes documents catalog. "
    "If the user asks ANY question outside this scope — including world trivia, capitals, geography, foreign nations, "
    "technology platforms like Databricks, software, coding, sports, movies, celebrities, or general science "
    "(e.g., 'what is capital of india', 'what is databricks') — YOU MUST STRICTLY REFUSE TO ANSWER by saying EXACTLY:\n"
    "'I cannot answer this question as it is outside the scope of the provided Indian government schemes documents.'\n"
    "NEVER provide the factual answer from your pre-trained general knowledge. NEVER name the capital of India. NEVER explain Databricks.\n"
    "3. SCHEME ACCURACY & GUIDELINES KNOWLEDGE:\n"
    "When asked about approved Indian government schemes, provide clear, concise, conversational answers in 2 to 3 sentences in English based on the authorized scheme documents:\n"
    "- PM-KISAN (Pradhan Mantri Kisan Samman Nidhi):\n"
    "  * Benefit: Financial income support of Rs 6,000 per year in three equal four-monthly installments of Rs 2,000 directly transferred to bank accounts via Direct Benefit Transfer (DBT).\n"
    "  * Eligibility: All landholding farmer families with cultivable land in their names (subject to exclusion criteria like institutional landholders, income tax payees, constitutional post holders).\n"
    "  * Registration & Application Process: Eligible farmers can register online on the official PM-KISAN portal (pmkisan.gov.in) under 'New Farmer Registration', through Common Service Centres (CSCs), or via state Nodal Officers and revenue offices.\n"
    "  * Required Documents: Aadhaar Card (mandatory for identity and e-KYC verification), Land Ownership Records (Record of Rights / RoR, Khasra/Khatauni, Patta No., or Dag No.), Bank Account Passbook (showing Account Number and IFSC code linked with Aadhaar/DBT), active Mobile Number, and passport-size photograph.\n"
    "  * Application Form Fields: State, District, Sub-Division, Tehsil/Block, Village/Gram Panchayat, Farmer Full Name, Gender, Category (SC/ST/OBC/General), Aadhaar Number, Mobile Number, Father's/Husband's Name, Bank Account & IFSC, land holding details (Pattadar name, Dag/Patta number, area), and family member details.\n"
    "- Pradhan Mantri Vishwakarma Scheme: Comprehensive support for traditional artisans across 18 trades (carpenters, blacksmiths, potters, etc.). Provides PM Vishwakarma ID, basic skill training (5-7 days) with Rs 500/day stipend, Rs 15,000 toolkit incentive, and collateral-free enterprise loans up to Rs 3 lakh at 5% interest. Registration requires Aadhaar, mobile number, bank account, and proof of trade via CSC.\n"
    "- Ayushman Bharat (PM-JAY & ABDM): Provides health insurance coverage of Rs 5 lakh per family per year for secondary and tertiary hospitalization to over 12 crore poor families. ABDM creates the 14-digit ABHA health ID for electronic health records.\n"
    "- Beti Bachao Beti Padhao (BBBP): Flagship initiative aimed at improving the Child Sex Ratio, ensuring survival, protection, and education of the girl child, complemented by Sukanya Samriddhi Yojana (SSY).\n"
    "- ASPIRE: Sets up Livelihood Business Incubators (LBIs) and Technology Business Incubators (TBIs) to promote innovation and rural agro-enterprises under MSME.\n"
    "- SFURTI: Organizes traditional artisans into clusters and establishes Common Facility Centres (CFCs) with modern equipment and market access.\n"
    "- MSME Clusters (MSE-CDP): Supports infrastructure development, testing centres, and common facility centers for Micro and Small Enterprises clusters.\n"
    "- PMJJBY: Renewable life insurance cover of Rs 2 lakh for death due to any cause for persons aged 18-50 at an annual premium of Rs 436."
)


# --- Audio Device Helpers for AVD & Wired Earphones ---

def list_audio_input_devices() -> List[Dict[str, Any]]:
    """Enumerates available microphone / input audio devices."""
    devices = []
    try:
        p = pyaudio.PyAudio()
        for i in range(p.get_device_count()):
            try:
                info = p.get_device_info_by_index(i)
                if info.get("maxInputChannels", 0) > 0:
                    devices.append({
                        "index": i,
                        "name": info.get("name", f"Device {i}"),
                        "channels": info.get("maxInputChannels", 1),
                        "defaultSampleRate": int(info.get("defaultSampleRate", 16000))
                    })
            except Exception:
                pass
        p.terminate()
    except Exception as e:
        print(f"[AUDIO DEVICE ENUM ERROR] {e}")
    return devices


def test_microphone_signal(device_index: Optional[int] = None, duration_sec: float = 1.2) -> Dict[str, Any]:
    """
    Samples audio from the specified or default microphone for duration_sec,
    measuring peak amplitude to verify wired earphones / AVD mic redirection.
    """
    p = pyaudio.PyAudio()
    kwargs = {
        "format": FORMAT,
        "channels": CHANNELS,
        "rate": INPUT_SAMPLE_RATE,
        "input": True,
        "frames_per_buffer": CHUNK_SIZE
    }
    if device_index is not None:
        kwargs["input_device_index"] = device_index

    try:
        stream = p.open(**kwargs)
        num_buffers = max(1, int((duration_sec * INPUT_SAMPLE_RATE) / CHUNK_SIZE))
        max_amp = 0
        total_bytes = 0
        for _ in range(num_buffers):
            data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
            if data:
                total_bytes += len(data)
                samples = struct.unpack(f"{len(data)//2}h", data)
                local_max = max(abs(x) for x in samples)
                if local_max > max_amp:
                    max_amp = local_max
        stream.close()

        pct = min(100, int((max_amp / 32768.0) * 100))
        if max_amp < 150:
            status = "silent"
            msg = "Complete silence (0%). In AVD, check Remote Audio Recording in RDP settings & Windows Microphone access."
        elif max_amp < 1200:
            status = "very_low"
            msg = f"Very low signal ({pct}%). Please increase your microphone input volume in Windows Sound Settings or speak louder."
        else:
            status = "good"
            msg = f"Audio detected clearly ({pct}% volume). Microphone is actively picking up your voice!"

        return {
            "status": status,
            "max_amplitude": max_amp,
            "volume_percent": pct,
            "message": msg,
            "total_bytes": total_bytes
        }
    except Exception as e:
        return {
            "status": "error",
            "max_amplitude": 0,
            "volume_percent": 0,
            "message": f"Failed to open microphone: {e}",
            "total_bytes": 0
        }
    finally:
        try:
            p.terminate()
        except Exception:
            pass


class SimpleNovaSonic:
    """
    Real-time bidirectional streaming client for Amazon Nova Sonic.
    Streams input audio and receives streaming text & audio concurrently.
    """

    def __init__(self, model_id=None, region=None, input_device_index=None, output_device_index=None):
        configured_region = ensure_aws_credentials()
        self.model_id = model_id or os.getenv("BEDROCK_MODEL_4", "amazon.nova-2-5-sonic")
        self.region = region or os.environ.get("AWS_DEFAULT_REGION", configured_region)
        self.input_device_index = input_device_index
        self.output_device_index = output_device_index
        self.current_mic_amp = 0
        self.client = None
        self.stream = None
        self.response_task = None
        self.is_active = False
        self.prompt_name = str(uuid.uuid4())
        self.content_name = str(uuid.uuid4())
        self.audio_content_name = str(uuid.uuid4())
        self.audio_queue = asyncio.Queue()
        self.role = None
        self.display_assistant_text = True
        self.last_error = None

        # Turn Tracking
        self.turns: List[Dict[str, Any]] = []
        self.current_user_tokens: List[str] = []
        self.current_assistant_tokens: List[str] = []
        self.last_user_text: str = ""
        self.last_assistant_text: str = ""
        self.turn_start_time: float = time.time()

    async def _initialize_client(self):
        ensure_aws_credentials(self.region)
        config = await AsyncBedrockRuntimeConfig.resolve(
            endpoint_uri=f"https://bedrock-runtime.{self.region}.amazonaws.com",
            region=self.region,
            aws_credentials_identity_resolver=EnvironmentCredentialsResolver(),
            transport=AWSCRTHTTPClient()
        )
        self.client = AsyncBedrockRuntimeClient(config=config)

    async def send_event(self, event_json: str):
        event = InvokeModelWithBidirectionalStreamInputChunk(
            value=BidirectionalInputPayloadPart(
                bytes_=event_json.encode('utf-8')
            )
        )
        await self.stream.input_stream.send(event)

    async def start_session(self, system_prompt: Optional[str] = None):
        if not self.client:
            await self._initialize_client()

        print(f"\n[NOVA LIVE] Connecting bidirectional stream to {self.model_id}...")

        self.stream = await self.client.invoke_model_with_bidirectional_stream(
            InvokeModelWithBidirectionalStreamOperationInput(
                model_id=self.model_id
            )
        )

        self.is_active = True

        session_start = '''
        {
          "event": {
            "sessionStart": {
              "inferenceConfiguration": {
                "maxTokens": 1024,
                "topP": 0.9,
                "temperature": 0.7
              }
            }
          }
        }
        '''
        await self.send_event(session_start)

        prompt_start = f'''
        {{
          "event": {{
            "promptStart": {{
              "promptName": "{self.prompt_name}",
              "textOutputConfiguration": {{
                "mediaType": "text/plain"
              }},
              "audioOutputConfiguration": {{
                "mediaType": "audio/lpcm",
                "sampleRateHertz": 24000,
                "sampleSizeBits": 16,
                "channelCount": 1,
                "voiceId": "matthew",
                "encoding": "base64",
                "audioType": "SPEECH"
              }}
            }}
          }}
        }}
        '''
        await self.send_event(prompt_start)

        text_content_start = f'''
        {{
            "event": {{
                "contentStart": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.content_name}",
                    "type": "TEXT",
                    "interactive": false,
                    "role": "SYSTEM",
                    "textInputConfiguration": {{
                        "mediaType": "text/plain"
                    }}
                }}
            }}
        }}
        '''
        await self.send_event(text_content_start)

        if not system_prompt:
            system_prompt = NOVA_RAG_SYSTEM_PROMPT

        safe_sys = json.dumps(system_prompt)[1:-1]

        text_input = f'''
        {{
            "event": {{
                "textInput": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.content_name}",
                    "content": "{safe_sys}"
                }}
            }}
        }}
        '''
        await self.send_event(text_input)

        text_content_end = f'''
        {{
            "event": {{
                "contentEnd": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.content_name}"
                }}
            }}
        }}
        '''
        await self.send_event(text_content_end)

        self.response_task = asyncio.create_task(self._process_responses())

    async def start_audio_input(self):
        audio_content_start = f'''
        {{
            "event": {{
                "contentStart": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.audio_content_name}",
                    "type": "AUDIO",
                    "interactive": true,
                    "role": "USER",
                    "audioInputConfiguration": {{
                        "mediaType": "audio/lpcm",
                        "sampleRateHertz": 16000,
                        "sampleSizeBits": 16,
                        "channelCount": 1,
                        "audioType": "SPEECH",
                        "encoding": "base64"
                    }}
                }}
            }}
        }}
        '''
        await self.send_event(audio_content_start)

    async def send_audio_chunk(self, audio_bytes: bytes):
        if not self.is_active:
            return
        blob = base64.b64encode(audio_bytes)
        audio_event = f'''
        {{
            "event": {{
                "audioInput": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.audio_content_name}",
                    "content": "{blob.decode('utf-8')}"
                }}
            }}
        }}
        '''
        await self.send_event(audio_event)

    async def end_audio_input(self):
        audio_content_end = f'''
        {{
            "event": {{
                "contentEnd": {{
                    "promptName": "{self.prompt_name}",
                    "contentName": "{self.audio_content_name}"
                }}
            }}
        }}
        '''
        await self.send_event(audio_content_end)

    async def end_session(self):
        if not self.is_active:
            return

        prompt_end = f'''
        {{
            "event": {{
                "promptEnd": {{
                    "promptName": "{self.prompt_name}"
                }}
            }}
        }}
        '''
        await self.send_event(prompt_end)

        session_end = '''
        {
            "event": {
                "sessionEnd": {}
            }
        }
        '''
        await self.send_event(session_end)

        self.is_active = False
        try:
            await self.stream.input_stream.close()
        except Exception:
            pass

    def _finalize_turn(self):
        u_text = "".join(self.current_user_tokens).strip()
        a_text = "".join(self.current_assistant_tokens).strip()
        lat_ms = (time.time() - self.turn_start_time) * 1000 if self.turn_start_time > 0 else 1200.0

        # Preserve question even if assistant response was interrupted or pending
        if u_text:
            ans = a_text if a_text else "(Response completed)"
            self.last_user_text = u_text
            self.last_assistant_text = ans
            self.turns.append({
                "turn_id": len(self.turns) + 1,
                "user_text": u_text,
                "assistant_text": ans,
                "latency_ms": max(lat_ms, 500.0)
            })
            self.current_user_tokens = []
            self.current_assistant_tokens = []

    async def _process_responses(self):
        try:
            while self.is_active:
                output = await self.stream.await_output()
                result = await output[1].receive()

                if result.value and result.value.bytes_:
                    response_data = result.value.bytes_.decode('utf-8')
                    json_data = json.loads(response_data)

                    if 'event' in json_data:
                        event = json_data['event']
                        if 'contentStart' in event:
                            content_start = event['contentStart']
                            new_role = content_start.get('role')

                            # When a new USER speech block begins and we already have an assistant answer,
                            # finalize the previous question-answer pair as ONE unified turn!
                            if new_role == "USER" and self.current_user_tokens and self.current_assistant_tokens:
                                self._finalize_turn()
                                self.turn_start_time = time.time()

                            self.role = new_role
                            if 'additionalModelFields' in content_start:
                                add_fields = content_start['additionalModelFields']
                                if isinstance(add_fields, str):
                                    try:
                                        add_fields = json.loads(add_fields)
                                    except Exception:
                                        add_fields = {}
                                self.display_assistant_text = (add_fields.get('generationStage') == 'SPECULATIVE')
                            else:
                                self.display_assistant_text = True

                        elif 'textOutput' in event:
                            text = event['textOutput']['content']
                            if self.role == "ASSISTANT":
                                # Accumulate all sentences of this answer into current_assistant_tokens
                                if self.display_assistant_text or not self.current_assistant_tokens:
                                    self.current_assistant_tokens.append(text)
                                    print(text, end="", flush=True)
                            elif self.role == "USER":
                                self.current_user_tokens.append(text)
                                print(f"\n[USER TRANSCRIBED]: {text}", flush=True)

                        elif 'audioOutput' in event:
                            audio_content = event['audioOutput']['content']
                            audio_bytes = base64.b64decode(audio_content)
                            await self.audio_queue.put(audio_bytes)

        except Exception as e:
            if self.is_active:
                err = f"Nova Stream notice: {e}"
                print(f"[NOVA STREAM NOTICE] {err}")
                self.last_error = err

    async def play_audio(self):
        try:
            p = pyaudio.PyAudio()
            stream_kwargs = {
                "format": FORMAT,
                "channels": CHANNELS,
                "rate": OUTPUT_SAMPLE_RATE,
                "output": True,
                "frames_per_buffer": 2048
            }
            if self.output_device_index is not None:
                stream_kwargs["output_device_index"] = self.output_device_index
            stream = p.open(**stream_kwargs)
        except Exception as pe:
            err = f"Speaker initialization failed: {pe}. Check output audio device."
            print(f"[PLAYBACK ERROR] {err}")
            self.last_error = err
            return

        try:
            while self.is_active or not self.audio_queue.empty():
                try:
                    audio_data = await asyncio.wait_for(self.audio_queue.get(), timeout=0.3)
                except asyncio.TimeoutError:
                    continue

                for i in range(0, len(audio_data), OUTPUT_CHUNK_SIZE):
                    if not self.is_active and self.audio_queue.empty():
                        break
                    end = min(i + OUTPUT_CHUNK_SIZE, len(audio_data))
                    chunk = audio_data[i:end]
                    await asyncio.to_thread(stream.write, chunk)
        except Exception as e:
            if self.is_active:
                print(f"[PLAYBACK NOTICE] {e}")
        finally:
            try:
                stream.stop_stream()
                stream.close()
                p.terminate()
            except Exception:
                pass

    async def capture_audio(self):
        try:
            p = pyaudio.PyAudio()
            stream_kwargs = {
                "format": FORMAT,
                "channels": CHANNELS,
                "rate": INPUT_SAMPLE_RATE,
                "input": True,
                "frames_per_buffer": CHUNK_SIZE
            }
            if self.input_device_index is not None:
                stream_kwargs["input_device_index"] = self.input_device_index
            stream = p.open(**stream_kwargs)
        except Exception as pe:
            err = f"Microphone initialization failed: {pe}. Please verify microphone permissions and AVD audio redirection."
            print(f"[CAPTURE ERROR] {err}")
            self.last_error = err
            return

        await self.start_audio_input()
        try:
            while self.is_active:
                audio_data = await asyncio.to_thread(stream.read, CHUNK_SIZE, exception_on_overflow=False)
                if audio_data:
                    samples = struct.unpack(f"{len(audio_data)//2}h", audio_data)
                    self.current_mic_amp = max(abs(s) for s in samples)
                await self.send_audio_chunk(audio_data)
        except Exception as e:
            if self.is_active:
                err = f"Audio capture warning: {e}"
                print(f"[CAPTURE NOTICE] {err}")
                self.last_error = err
        finally:
            try:
                stream.stop_stream()
                stream.close()
                p.terminate()
            except Exception:
                pass
            try:
                await self.end_audio_input()
            except Exception:
                pass


class LiveNovaSonicManager:
    """
    Threaded session manager to run SimpleNovaSonic in a background thread,
    controlled by Start Live Session and End Session buttons in Streamlit.
    """

    def __init__(self, model_id=None, input_device_index=None, output_device_index=None):
        self.model_id = model_id or os.getenv("BEDROCK_MODEL_4", "amazon.nova-2-5-sonic")
        self.input_device_index = input_device_index
        self.output_device_index = output_device_index
        self.session = None
        self.thread = None
        self.loop = None
        self.is_running = False
        self.start_time = 0.0
        self.last_error = None

    def start(self, system_prompt: Optional[str] = None):
        if self.is_running:
            return
        self.is_running = True
        self.last_error = None
        self.start_time = time.time()
        self.thread = threading.Thread(target=self._run_loop, args=(system_prompt,), daemon=True)
        self.thread.start()

    def _run_loop(self, system_prompt):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.session = SimpleNovaSonic(
            model_id=self.model_id,
            input_device_index=self.input_device_index,
            output_device_index=self.output_device_index
        )
        self.loop.run_until_complete(self._async_session(system_prompt))

    async def _async_session(self, system_prompt):
        try:
            await self.session.start_session(system_prompt=system_prompt)
            playback_task = asyncio.create_task(self.session.play_audio())
            capture_task = asyncio.create_task(self.session.capture_audio())

            while self.is_running:
                await asyncio.sleep(0.1)

            # User clicked End Session: Gracefully signal end of audio input first
            if self.session.is_active:
                try:
                    await self.session.end_audio_input()
                except Exception:
                    pass

                # Allow up to 2.5s grace period for Bedrock to deliver in-flight speech transcription
                for _ in range(25):
                    await asyncio.sleep(0.1)
                    if self.session.current_user_tokens and self.session.current_assistant_tokens:
                        break
                    if self.session.current_user_tokens and not self.session.current_assistant_tokens:
                        await asyncio.sleep(0.5)
                        break

                self.session._finalize_turn()
                await self.session.end_session()

            tasks = [t for t in [playback_task, capture_task] if not t.done()]
            for t in tasks:
                t.cancel()
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            err = f"Nova live session error: {e}"
            print(f"[LIVE NOVA RUNNER ERROR] {err}")
            self.last_error = err

    def get_live_transcripts(self) -> Tuple[str, str, List[Dict[str, Any]], str, str]:
        """Returns (current_turn_user_text, current_turn_assistant_text, completed_turns, last_u, last_a)."""
        if not self.session:
            return "", "", [], "", ""
        u_live = "".join(self.session.current_user_tokens).strip()
        a_live = "".join(self.session.current_assistant_tokens).strip()
        return u_live, a_live, list(self.session.turns), self.session.last_user_text, self.session.last_assistant_text

    def get_error(self) -> Optional[str]:
        if self.session and self.session.last_error:
            return self.session.last_error
        return self.last_error

    def get_mic_level(self) -> int:
        """Returns peak audio input amplitude as percentage (0-100%)."""
        if self.session and self.session.is_active:
            amp = getattr(self.session, "current_mic_amp", 0)
            return min(100, int((amp / 32768.0) * 100))
        return 0

    def stop(self) -> List[Dict[str, Any]]:
        self.is_running = False
        if self.thread and self.thread.is_alive():
            # Wait for graceful audio flush and turn finalization
            self.thread.join(timeout=4.5)

        turns = list(self.session.turns) if self.session else []
        return turns
